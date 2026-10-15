"""Inventory safety-stock and reorder-point calculations."""

from __future__ import annotations

import math
from statistics import NormalDist
from typing import Any


class InventoryDecisionModule:
    """Calculate safety stock, reorder points, and reorder quantities."""

    def calculate_inventory_policy(
        self,
        demand_forecast,
        lead_time_days: int,
        service_level: float = 0.95,
        cumulative_lead_time_errors: list[float] | None = None,
        daily_forecast_rmse: float | None = None,
        lead_time_std_days: float = 0.0,
        holding_cost_per_unit: float | None = None,
        stockout_cost_per_unit: float | None = None,
        current_stock: float | None = None,
        standard_reorder_quantity: float | None = None,
    ) -> dict[str, Any]:

        # Validate inputs.
        if (
            not isinstance(lead_time_days, int)
            or not 1 <= lead_time_days <= 365
        ):
            raise ValueError(
                "lead_time_days must be an integer between 1 and 365."
            )

        if (
            not math.isfinite(float(service_level))
            or not 0.5 < service_level < 1.0
        ):
            raise ValueError(
                "service_level must be between 0.5 and 1.0."
            )

        if (
            not math.isfinite(float(lead_time_std_days))
            or lead_time_std_days < 0
        ):
            raise ValueError(
                "lead_time_std_days must be finite and non-negative."
            )

        # Support either numeric forecasts or forecast dictionaries.
        values = []

        for point in demand_forecast:

            if isinstance(point, dict):
                raw_value = point.get(
                    "predictedDemandUnits",
                    point.get(
                        "predicted_demand",
                        point.get("demand"),
                    ),
                )
            else:
                raw_value = point

            if raw_value is None:
                raise ValueError(
                    "Each forecast point must contain a demand value."
                )

            value = float(raw_value)

            if not math.isfinite(value) or value < 0:
                raise ValueError(
                    "Forecast demand must be finite and non-negative."
                )

            values.append(value)

        # We need at least one forecast value for every lead-time day.
        if len(values) < lead_time_days:
            return {
                "status": "insufficient_horizon",
                "error_message": (
                    f"Forecast requires at least {lead_time_days} days; "
                    f"received {len(values)}."
                ),
            }

        lead_time_values = values[:lead_time_days]

        # Expected demand while waiting for replenishment.
        expected_demand = sum(lead_time_values)

        z_score = NormalDist().inv_cdf(service_level)

        safety_stock = 0.0
        uncertainty_sigma = None
        method_used = "forecast_mean_only"

        # Prefer an empirical distribution of historical lead-time errors.
        if cumulative_lead_time_errors:

            errors = [
                float(value)
                for value in cumulative_lead_time_errors
            ]

            if any(
                not math.isfinite(value)
                for value in errors
            ):
                raise ValueError(
                    "Cumulative lead-time errors must be finite."
                )

            if len(errors) >= 5:

                ordered_errors = sorted(errors)

                index = min(
                    len(ordered_errors) - 1,
                    max(
                        0,
                        math.ceil(
                            service_level * len(ordered_errors)
                        ) - 1,
                    ),
                )

                safety_stock = max(
                    0.0,
                    ordered_errors[index],
                )

                average_error = sum(errors) / len(errors)

                variance = sum(
                    (value - average_error) ** 2
                    for value in errors
                ) / max(1, len(errors) - 1)

                uncertainty_sigma = math.sqrt(variance)

                method_used = (
                    "empirical_cumulative_lead_time_error_quantile"
                )

        # If insufficient empirical data exists, use forecast RMSE.
        if (
            method_used == "forecast_mean_only"
            and daily_forecast_rmse is not None
        ):

            rmse = float(daily_forecast_rmse)

            if not math.isfinite(rmse) or rmse < 0:
                raise ValueError(
                    "daily_forecast_rmse must be finite and non-negative."
                )

            uncertainty_sigma = rmse * math.sqrt(lead_time_days)

            safety_stock = z_score * uncertainty_sigma

            method_used = "gaussian_rmse_approximation"

        # Alternative approximation when lead-time variability is known.
        if (
            method_used == "forecast_mean_only"
            and lead_time_std_days > 0
        ):

            average_daily_demand = (
                expected_demand / lead_time_days
            )

            uncertainty_sigma = (
                average_daily_demand * lead_time_std_days
            )

            safety_stock = z_score * uncertainty_sigma

            method_used = "lead_time_variability_approximation"

        critical_fractile = None
        if holding_cost_per_unit is not None and stockout_cost_per_unit is not None:
            hc = float(holding_cost_per_unit)
            sc = float(stockout_cost_per_unit)
            if hc + sc > 0:
                critical_fractile = round(sc / (sc + hc), 4)
                if method_used in ("gaussian_rmse_approximation", "forecast_mean_only"):
                    method_used = "parametric_analytic"

        reorder_point = expected_demand + safety_stock

        # Validate current inventory.
        current = (
            float(current_stock)
            if current_stock is not None
            else None
        )

        if current is not None:
            if not math.isfinite(current) or current < 0:
                raise ValueError(
                    "current_stock must be finite and non-negative."
                )

        # Validate standard replenishment batch size.
        batch_size = (
            float(standard_reorder_quantity)
            if standard_reorder_quantity is not None
            else 0.0
        )

        if not math.isfinite(batch_size) or batch_size < 0:
            raise ValueError(
                "standard_reorder_quantity must be finite "
                "and non-negative."
            )

        reorder_required = (
            current is not None
            and current <= reorder_point
        )

        recommended_quantity = 0.0

        if reorder_required and current is not None:

            recommended_quantity = max(
                0.0,
                math.ceil(reorder_point - current),
            )

            if batch_size > 0 and recommended_quantity > 0:

                recommended_quantity = max(
                    batch_size,
                    math.ceil(
                        recommended_quantity / batch_size
                    ) * batch_size,
                )

        return {
            "status": "success",
            "leadTimeDays": lead_time_days,
            "targetServiceLevel": service_level,
            "expectedLeadTimeDemand": round(
                expected_demand,
                3,
            ),
            "safetyStock": round(
                safety_stock,
                3,
            ),
            "reorderPoint": round(
                round(expected_demand, 3) + round(safety_stock, 3),
                2,
            ),
            "currentStock": current,
            "recommendedReorderQuantity": round(
                recommended_quantity,
                3,
            ),
            "reorderRequired": reorder_required,
            "dataSource": "forecast_calculation",
            "leadTimeUncertaintySigma": (
                round(uncertainty_sigma, 3)
                if uncertainty_sigma is not None
                else None
            ),
            "leadTimeDemandBounds": {
                "lower": max(
                    0.0,
                    round(expected_demand - safety_stock, 3),
                ),
                "upper": round(
                    expected_demand + safety_stock,
                    3,
                ),
                "nominalCoveragePct": service_level * 100,
            },
            "methodUsed": method_used,
            "criticalFractile": critical_fractile,
            "leadTimeStdDays": lead_time_std_days,
            "assumptions": [
                "Daily forecasts represent demand units per day.",
                (
                    "Safety stock uses empirical lead-time errors "
                    "or an RMSE-based approximation."
                ),
                (
                    "The result is a decision-support estimate, "
                    "not a guarantee of service level."
                ),
            ],
        }