"""
Sales Scenario Simulation Service for SynChain AI.
Evaluates configurable 'what-if' assumptions on sales volume, pricing elasticity,
demand shocks, and operational inventory fulfillment caps with transparent formulas.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import numpy as np

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.postgres.models import SalesTransaction, Inventory, Product
from app.schemas.sales import SalesScenarioRequest, SalesScenarioResponse
from app.services.sales.sales_forecasting_service import SalesForecastingService


class SalesScenarioService:

    @classmethod
    def simulate_scenario(
        cls,
        db: Session,
        request: SalesScenarioRequest,
    ) -> SalesScenarioResponse:
        """
        Runs transparent what-if calculations without modifying real database state.
        Applies volume, price, demand shocks, and optional inventory buffer fulfillment caps.
        """
        # 1. Obtain baseline projection from forecasting service
        baseline_forecast = SalesForecastingService.generate_sales_forecast(
            db=db,
            horizon_days=request.horizon_days,
            product_id=request.product_id,
            category=request.product_category,
            evaluate=False,
        )

        base_pts = baseline_forecast.forecast_points
        if not base_pts:
            # Fallback if no forecast generated
            return SalesScenarioResponse(
                scenario_name=request.scenario_name,
                horizon_days=request.horizon_days,
                assumptions={
                    "volume_change_pct": request.volume_change_pct,
                    "price_change_pct": request.price_change_pct,
                    "demand_shock_pct": request.demand_shock_pct,
                    "apply_fulfillment_constraints": request.apply_fulfillment_constraints,
                },
                baseline_projected_units=0.0,
                baseline_projected_revenue=0.0,
                scenario_projected_units=0.0,
                scenario_projected_revenue=0.0,
                fulfilled_units=0.0,
                unmet_units=0.0,
                revenue_variance_usd=0.0,
                revenue_variance_pct=0.0,
                fulfillment_constrained=False,
                bottlenecks=["No baseline sales data available for simulation."],
                formula_breakdown={
                    "formula": "Fulfilled Units * Scenario Unit Price",
                },
                daily_trajectory=[],
            )

        total_base_rev = sum(p.predicted_revenue for p in base_pts)
        total_base_units = sum(p.predicted_units for p in base_pts)
        base_asp = total_base_rev / max(1.0, total_base_units)

        # 2. Query available inventory if fulfillment constraints enabled
        available_stock_cap = float("inf")
        bottlenecks: List[str] = []

        if request.apply_fulfillment_constraints:
            if request.product_id:
                # Find matching product in inventory
                inv_items = (
                    db.query(Inventory)
                    .join(Product, Inventory.product_id == Product.id)
                    .filter(Product.sku == request.product_id)
                    .all()
                )
                if inv_items:
                    total_avail = sum(max(0, (i.stock_quantity or 0) - (i.reserved_quantity or 0)) for i in inv_items)
                    incoming = sum(max(0, (i.incoming_quantity or 0)) for i in inv_items)
                    available_stock_cap = float(total_avail + incoming)
                    bottlenecks.append(
                        f"Product '{request.product_id}' total warehouse buffer capped at {total_avail:,} on-hand + {incoming:,} incoming units."
                    )
                else:
                    bottlenecks.append(
                        f"No warehouse inventory buffer mapped for SKU '{request.product_id}'; unconstrained assumption used."
                    )
            else:
                # Global warehouse stock
                global_inv = db.query(
                    func.coalesce(func.sum(Inventory.stock_quantity - Inventory.reserved_quantity), 0),
                    func.coalesce(func.sum(Inventory.incoming_quantity), 0),
                ).first()
                if global_inv:
                    on_hand = float(global_inv[0])
                    incoming = float(global_inv[1])
                    available_stock_cap = max(1.0, on_hand + incoming)
                    bottlenecks.append(
                        f"Total supply-chain capacity capped across all warehouses at {int(on_hand):,} on-hand + {int(incoming):,} incoming units."
                    )

        # 3. Apply Multipliers
        vol_factor = 1.0 + (request.volume_change_pct / 100.0)
        price_factor = 1.0 + (request.price_change_pct / 100.0)
        shock_factor = 1.0 + (request.demand_shock_pct / 100.0)

        scenario_asp = round(base_asp * price_factor, 2)

        cumulative_demand_units = 0.0
        cumulative_fulfilled_units = 0.0
        cumulative_scenario_rev = 0.0
        daily_trajectory: List[Dict[str, Any]] = []

        is_constrained = False

        for pt in base_pts:
            # Baseline day
            b_rev = pt.predicted_revenue
            b_units = pt.predicted_units

            # Raw unconstrained scenario demand
            s_demand_units = round(b_units * vol_factor * shock_factor, 1)
            cumulative_demand_units += s_demand_units

            # Check inventory cap
            if cumulative_demand_units > available_stock_cap:
                is_constrained = True
                units_can_fulfill = max(0.0, available_stock_cap - cumulative_fulfilled_units)
                fulfilled_day = min(s_demand_units, units_can_fulfill)
                unmet_day = s_demand_units - fulfilled_day
            else:
                fulfilled_day = s_demand_units
                unmet_day = 0.0

            cumulative_fulfilled_units += fulfilled_day
            rev_day = round(fulfilled_day * scenario_asp, 2)
            cumulative_scenario_rev += rev_day

            daily_trajectory.append({
                "date": pt.date,
                "baseline_units": b_units,
                "baseline_revenue": b_rev,
                "scenario_demand_units": s_demand_units,
                "fulfilled_units": round(fulfilled_day, 1),
                "unmet_units": round(unmet_day, 1),
                "scenario_revenue": rev_day,
                "is_stockout_capped": unmet_day > 0,
            })

        tot_scenario_units = round(cumulative_demand_units, 1)
        tot_fulfilled_units = round(cumulative_fulfilled_units, 1)
        tot_unmet_units = round(tot_scenario_units - tot_fulfilled_units, 1)
        tot_scenario_rev = round(cumulative_scenario_rev, 2)

        rev_variance_usd = round(tot_scenario_rev - total_base_rev, 2)
        rev_variance_pct = round((rev_variance_usd / max(0.01, total_base_rev)) * 100.0, 1) if total_base_rev > 0 else 0.0

        if is_constrained and tot_unmet_units > 0:
            lost_potential_rev = round(tot_unmet_units * scenario_asp, 2)
            bottlenecks.append(
                f"Fulfillment limitation caused {tot_unmet_units:,.0f} unmet units, resulting in ${lost_potential_rev:,.2f} unrealized revenue."
            )

        formula_breakdown = {
            "scenario_unit_price": f"Base ASP (${base_asp:.2f}) * (1 + {request.price_change_pct}%/100) = ${scenario_asp:.2f}",
            "scenario_demand_units": f"Base Units ({total_base_units:.0f}) * (1 + {request.volume_change_pct}%) * (1 + {request.demand_shock_pct}%) = {tot_scenario_units:.0f}",
            "fulfilled_revenue": f"Fulfilled Units ({tot_fulfilled_units:.0f}) * Scenario ASP (${scenario_asp:.2f}) = ${tot_scenario_rev:,.2f}",
            "variance": f"${tot_scenario_rev:,.2f} - ${total_base_rev:,.2f} = ${rev_variance_usd:+,.2f} ({rev_variance_pct:+.1f}%)",
        }

        return SalesScenarioResponse(
            scenario_name=request.scenario_name,
            horizon_days=request.horizon_days,
            assumptions={
                "volume_change_pct": request.volume_change_pct,
                "price_change_pct": request.price_change_pct,
                "demand_shock_pct": request.demand_shock_pct,
                "apply_fulfillment_constraints": request.apply_fulfillment_constraints,
                "product_id": request.product_id,
                "product_category": request.product_category,
            },
            baseline_projected_units=round(total_base_units, 1),
            baseline_projected_revenue=round(total_base_rev, 2),
            scenario_projected_units=tot_scenario_units,
            scenario_projected_revenue=tot_scenario_rev,
            fulfilled_units=tot_fulfilled_units,
            unmet_units=tot_unmet_units,
            revenue_variance_usd=rev_variance_usd,
            revenue_variance_pct=rev_variance_pct,
            fulfillment_constrained=is_constrained,
            bottlenecks=bottlenecks if bottlenecks else ["No supply-chain fulfillment bottlenecks detected under tested parameters."],
            formula_breakdown=formula_breakdown,
            daily_trajectory=daily_trajectory,
        )
