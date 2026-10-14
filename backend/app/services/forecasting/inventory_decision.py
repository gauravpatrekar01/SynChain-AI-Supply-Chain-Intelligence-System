"""
Inventory Decision Module for SynChain AI.

Provides parameterized, mathematically defensible calculations for:
- Expected lead-time demand
- Safety stock buffers
- Reorder points (ROP)
- Critical fractile cost optimization

Avoids hardcoded arbitrary quantities and explicitly separates
censored sales observations from unconstrained customer demand.
"""

from typing import Dict, Any, List, Optional, Tuple, Union
import math
import numpy as np


class InventoryDecisionModule:
    """
    Parameterized inventory decision engine for calculating safety stock,
    reorder points, and lead-time demand buffers.
    """

    @staticmethod
    def _norm_ppf(p: float) -> float:
        """
        Calculates normal percentage point function (inverse CDF) without external dependencies.
        Uses Abramowitz and Stegun rational approximation (formula 26.2.23).
        """
        if p <= 0.0 or p >= 1.0:
            raise ValueError(f"Probability must be strictly between 0 and 1, got {p}")

        # Symmetry around p = 0.5
        if p < 0.5:
            return -InventoryDecisionModule._norm_ppf(1.0 - p)

        t = math.sqrt(-2.0 * math.log(1.0 - p))
        c0 = 2.515517
        c1 = 0.802853
        c2 = 0.010328
        d1 = 1.432788
        d2 = 0.189269
        d3 = 0.001308

        numerator = c0 + c1 * t + c2 * (t ** 2)
        denominator = 1.0 + d1 * t + d2 * (t ** 2) + d3 * (t ** 3)
        return t - (numerator / denominator)

    def calculate_inventory_policy(
        self,
        demand_forecast: Union[List[float], List[Dict[str, Any]]],
        lead_time_days: int,
        service_level: float = 0.95,
        cumulative_lead_time_errors: Optional[List[float]] = None,
        daily_forecast_rmse: Optional[float] = None,
        lead_time_std_days: float = 0.0,
        holding_cost_per_unit: Optional[float] = None,
        stockout_cost_per_unit: Optional[float] = None,
        min_empirical_samples: int = 5,
        current_stock: Optional[float] = None,
        standard_reorder_quantity: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Calculates expected lead-time demand, safety stock, and reorder point.

        Parameters
        ----------
        demand_forecast : List[float] or List[Dict[str, Any]]
            Daily forecast predictions across the horizon.
            If dicts, looks for 'predictedDemandUnits' or 'predicted_demand'.
        lead_time_days : int
            Supplier replenishment lead time in days (must be >= 1).
        service_level : float
            Target cycle service level CSL in (0.50, 1.00), e.g., 0.90 or 0.95.
        cumulative_lead_time_errors : Optional[List[float]]
            Empirical cumulative lead-time forecast errors:
            e_L = sum_{h=1}^L actual_{t+h} - sum_{h=1}^L forecast_{t+h}.
            Preferred non-parametric approach when available.
        daily_forecast_rmse : Optional[float]
            Single-day out-of-sample forecast RMSE as fallback if empirical cumulative errors missing.
        lead_time_std_days : float
            Supplier lead-time standard deviation sigma_LT >= 0.0.
        holding_cost_per_unit : Optional[float]
            Unit holding cost per period (must be > 0 if provided).
        stockout_cost_per_unit : Optional[float]
            Unit stockout penalty cost per period (must be > 0 if provided).
        min_empirical_samples : int
            Minimum required empirical error samples to trust non-parametric distribution.

        Returns
        -------
        Dict[str, Any]
            Inventory decision output including expected lead-time demand, safety stock,
            reorder point, confidence intervals, cost fractile, and explicit assumptions.
        """
        # 1. Input Validation
        if not isinstance(lead_time_days, int) or lead_time_days < 1:
            raise ValueError(f"lead_time_days must be an integer >= 1, got {lead_time_days}")

        if not isinstance(service_level, (int, float)) or not (0.50 < service_level < 1.00):
            raise ValueError(f"service_level must be strictly between 0.50 and 1.00, got {service_level}")

        if lead_time_std_days < 0.0:
            raise ValueError(f"lead_time_std_days cannot be negative, got {lead_time_std_days}")

        if holding_cost_per_unit is not None and holding_cost_per_unit <= 0.0:
            raise ValueError(f"holding_cost_per_unit must be positive, got {holding_cost_per_unit}")

        if stockout_cost_per_unit is not None and stockout_cost_per_unit <= 0.0:
            raise ValueError(f"stockout_cost_per_unit must be positive, got {stockout_cost_per_unit}")

        # Parse forecast sequence
        if not demand_forecast:
            raise ValueError("demand_forecast cannot be empty.")

        daily_demands: List[float] = []
        for item in demand_forecast:
            if isinstance(item, (int, float)):
                daily_demands.append(float(item))
            elif isinstance(item, dict):
                val = item.get("predictedDemandUnits", item.get("predicted_demand", item.get("demand", None)))
                if val is None:
                    raise ValueError(f"Missing predicted demand value in record: {item}")
                daily_demands.append(float(val))
            else:
                raise TypeError(f"Unsupported demand forecast element type: {type(item)}")

        if any(d < 0.0 for d in daily_demands):
            raise ValueError("demand_forecast cannot contain negative predictions.")

        if len(daily_demands) < lead_time_days:
            return {
                "status": "insufficient_horizon",
                "error_message": (
                    f"Forecast horizon ({len(daily_demands)} days) is shorter than "
                    f"the replenishment lead time ({lead_time_days} days)."
                ),
                "expected_lead_time_demand": None,
                "safety_stock": None,
                "reorder_point": None
            }

        # 2. Expected Lead-Time Demand (D_L)
        lead_time_slice = daily_demands[:lead_time_days]
        expected_lt_demand = float(np.sum(lead_time_slice))
        mean_daily_forecast = float(np.mean(lead_time_slice))

        assumptions: List[str] = [
            f"Replenishment horizon evaluates {lead_time_days} consecutive forward forecast days.",
            f"Target Cycle Service Level (CSL) is {service_level * 100:.1f}%.",
            "Warning: Historical training observations reflect censored sales, which may underestimate unconstrained demand."
        ]

        # 3. Safety Stock Determination
        safety_stock: float = 0.0
        method_used: str = "undefined"
        z_factor: float = self._norm_ppf(service_level)
        effective_sigma_lt: float = 0.0

        has_empirical_errors = (
            cumulative_lead_time_errors is not None and 
            len(cumulative_lead_time_errors) >= min_empirical_samples
        )

        if has_empirical_errors:
            # Empirical Quantile Approach (Non-parametric)
            method_used = "empirical_cumulative_error"
            errors_arr = np.asarray(cumulative_lead_time_errors, dtype=float)
            empirical_quantile_error = float(np.percentile(errors_arr, service_level * 100.0))
            
            # If lead-time variability exists, augment empirical variance using total variance law
            if lead_time_std_days > 0.0:
                emp_var = float(np.var(errors_arr))
                total_lt_var = emp_var + ((mean_daily_forecast ** 2) * (lead_time_std_days ** 2))
                effective_sigma_lt = float(math.sqrt(total_lt_var))
                safety_stock = max(0.0, float(z_factor * effective_sigma_lt))
                assumptions.append(
                    f"Augmented empirical error variance ({emp_var:.1f}) with supplier lead-time variability "
                    f"(sigma_LT = {lead_time_std_days} days) using total variance law."
                )
            else:
                effective_sigma_lt = float(np.std(errors_arr))
                safety_stock = max(0.0, empirical_quantile_error)
                assumptions.append(
                    f"Safety stock derived non-parametrically from {len(errors_arr)} time-respecting "
                    f"cumulative {lead_time_days}-day forecast errors."
                )
        elif daily_forecast_rmse is not None and daily_forecast_rmse > 0.0:
            # Parametric Gaussian Fallback
            method_used = "parametric_analytic"
            demand_var_lt = float(lead_time_days) * (daily_forecast_rmse ** 2)
            lt_var_component = (mean_daily_forecast ** 2) * (lead_time_std_days ** 2)
            total_lt_var = demand_var_lt + lt_var_component
            effective_sigma_lt = float(math.sqrt(total_lt_var))

            safety_stock = max(0.0, float(z_factor * effective_sigma_lt))
            assumptions.append(
                f"Safety stock estimated analytically using Gaussian approximation with daily forecast RMSE "
                f"({daily_forecast_rmse:.2f}) scaled by sqrt({lead_time_days}) days."
            )
            assumptions.append(
                "Caution: Parametric scaling assumes uncorrelated daily forecast errors. "
                "In multi-step recursive forecasting, autocorrelation may cause actual lead-time variance to differ."
            )
        else:
            return {
                "status": "insufficient_uncertainty_data",
                "error_message": (
                    "Neither empirical cumulative lead-time errors nor daily forecast RMSE was provided. "
                    "Cannot defensibly calculate safety stock without quantified forecast uncertainty."
                ),
                "expected_lead_time_demand": round(expected_lt_demand, 2),
                "safety_stock": None,
                "reorder_point": None,
                "assumptions": assumptions
            }

        # 4. Reorder Point (ROP = Expected Lead-Time Demand + Safety Stock)
        reorder_point = max(0.0, expected_lt_demand + safety_stock)

        # 5. Optional Economic Critical Fractile (Newsvendor)
        critical_fractile = None
        if holding_cost_per_unit is not None and stockout_cost_per_unit is not None:
            critical_fractile = round(
                stockout_cost_per_unit / (stockout_cost_per_unit + holding_cost_per_unit), 4
            )
            assumptions.append(
                f"Economic critical fractile p / (p + h) is {critical_fractile:.4f} "
                f"(holding cost h = {holding_cost_per_unit}, stockout cost p = {stockout_cost_per_unit})."
            )

        # 6. Upper & Lower Uncertainty Bounds for Lead-Time Demand
        if method_used == "empirical_cumulative_error" and lead_time_std_days == 0.0:
            lower_err_quantile = float(np.percentile(errors_arr, (1.0 - service_level) * 100.0))
            demand_lower_bound = max(0.0, expected_lt_demand + lower_err_quantile)
            demand_upper_bound = expected_lt_demand + safety_stock
        else:
            demand_lower_bound = max(0.0, expected_lt_demand - (z_factor * effective_sigma_lt))
            demand_upper_bound = expected_lt_demand + (z_factor * effective_sigma_lt)

        # 7. Current Stock & Recommended Reorder Quantity (if current_stock provided)
        reorder_required = None
        recommended_reorder_qty = None
        if current_stock is not None:
            if current_stock < 0.0:
                raise ValueError(f"current_stock cannot be negative, got {current_stock}")
            reorder_required = bool(current_stock <= reorder_point)
            if reorder_required:
                if standard_reorder_quantity is not None and standard_reorder_quantity > 0:
                    recommended_reorder_qty = round(float(standard_reorder_quantity), 2)
                    assumptions.append(
                        f"Standard batch replenishment order recommended: {recommended_reorder_qty:.0f} units."
                    )
                else:
                    target_ceiling = reorder_point + expected_lt_demand
                    recommended_reorder_qty = round(max(0.0, target_ceiling - current_stock), 2)
                    assumptions.append(
                        f"Continuous review (s, S) replenishment policy recommends restoring buffer to {target_ceiling:.1f} units "
                        f"(reorder quantity = {recommended_reorder_qty:.1f} units)."
                    )
            else:
                recommended_reorder_qty = 0.0
                assumptions.append(
                    f"Current stock ({current_stock:.0f} units) satisfies reorder point ({reorder_point:.1f} units); "
                    "no replenishment order required at this time."
                )

        return {
            "status": "success",
            "lead_time_days": lead_time_days,
            "target_service_level": service_level,
            "expected_lead_time_demand": round(expected_lt_demand, 2),
            "safety_stock": round(safety_stock, 2),
            "reorder_point": round(reorder_point, 2),
            "current_stock": round(current_stock, 2) if current_stock is not None else None,
            "recommended_reorder_quantity": recommended_reorder_qty,
            "reorder_required": reorder_required,
            "lead_time_uncertainty_sigma": round(effective_sigma_lt, 2),
            "lead_time_demand_bounds": {
                "lower": round(demand_lower_bound, 2),
                "upper": round(demand_upper_bound, 2),
                "nominal_coverage_pct": round(service_level * 100.0, 1)
            },
            "method_used": method_used,
            "critical_fractile": critical_fractile,
            "lead_time_std_days": lead_time_std_days,
            "assumptions": assumptions
        }