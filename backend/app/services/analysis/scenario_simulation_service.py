"""
Scenario Analysis & Disruption Simulation Service.

Models and compares three distinct decision pathways:
- Scenario A: Wait for delayed primary shipment
- Scenario B: Order replenishment from alternative supplier
- Scenario C: Expedite existing shipment with priority freight

Calculates daily inventory trajectories, stockout dates, unmet demand units,
and total financial impacts without touching operational database records.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from app.schemas.analysis import (
    AnalysisSimulationRequest,
    AnalysisSimulationResponse,
    DailyTrajectoryPoint,
    ScenarioOutcome,
)


class ScenarioSimulationService:

    @classmethod
    def run_simulation(
        cls,
        request: AnalysisSimulationRequest,
    ) -> AnalysisSimulationResponse:
        """
        Simulates 30 days of daily consumption and replenishment across
        Scenario A (Wait), Scenario B (Alternative), and Scenario C (Expedite).
        """
        horizon_days = 30
        now = datetime.now(timezone.utc)

        current_inv = float(request.current_inventory)
        daily_demand = float(request.daily_demand)
        orig_lead = request.original_lead_time_days
        delay = request.shipment_delay_days
        batch_qty = float(request.replenishment_quantity)

        # Arrival days (1-indexed)
        # Scenario A: Arrives at original lead time + delay days
        arrival_a = orig_lead + delay
        # Scenario B: Arrives at alternative lead time days
        arrival_b = request.alternative_supplier_lead_time_days
        # Scenario C: Shaves off expedite_transit_reduction_days from the delayed arrival
        arrival_c = max(1, arrival_a - request.expedite_transit_reduction_days)

        stock_a = current_inv
        stock_b = current_inv
        stock_c = current_inv

        unmet_a = 0.0
        unmet_b = 0.0
        unmet_c = 0.0

        stockout_day_a: Optional[int] = None
        stockout_day_b: Optional[int] = None
        stockout_day_c: Optional[int] = None

        days_in_stockout_a = 0
        days_in_stockout_b = 0
        days_in_stockout_c = 0

        min_stock_a = current_inv
        min_stock_b = current_inv
        min_stock_c = current_inv

        trajectories: List[DailyTrajectoryPoint] = []

        # Day 0 initial state
        trajectories.append(
            DailyTrajectoryPoint(
                day=0,
                date=now.strftime("%Y-%m-%d"),
                scenario_a_wait_stock=round(stock_a, 1),
                scenario_b_alt_stock=round(stock_b, 1),
                scenario_c_expedite_stock=round(stock_c, 1),
            )
        )

        for day in range(1, horizon_days + 1):
            day_date = (now + timedelta(days=day)).strftime("%Y-%m-%d")

            # --- Scenario A: Wait ---
            if day == arrival_a:
                stock_a += batch_qty
            if stock_a >= daily_demand:
                stock_a -= daily_demand
            else:
                unmet_today = daily_demand - stock_a
                stock_a = 0.0
                unmet_a += unmet_today
                days_in_stockout_a += 1
                if stockout_day_a is None:
                    stockout_day_a = day
            min_stock_a = min(min_stock_a, stock_a)

            # --- Scenario B: Alternative Supplier ---
            if day == arrival_b:
                stock_b += batch_qty
            if stock_b >= daily_demand:
                stock_b -= daily_demand
            else:
                unmet_today = daily_demand - stock_b
                stock_b = 0.0
                unmet_b += unmet_today
                days_in_stockout_b += 1
                if stockout_day_b is None:
                    stockout_day_b = day
            min_stock_b = min(min_stock_b, stock_b)

            # --- Scenario C: Expedite ---
            if day == arrival_c:
                stock_c += batch_qty
            if stock_c >= daily_demand:
                stock_c -= daily_demand
            else:
                unmet_today = daily_demand - stock_c
                stock_c = 0.0
                unmet_c += unmet_today
                days_in_stockout_c += 1
                if stockout_day_c is None:
                    stockout_day_c = day
            min_stock_c = min(min_stock_c, stock_c)

            trajectories.append(
                DailyTrajectoryPoint(
                    day=day,
                    date=day_date,
                    scenario_a_wait_stock=round(stock_a, 1),
                    scenario_b_alt_stock=round(stock_b, 1),
                    scenario_c_expedite_stock=round(stock_c, 1),
                )
            )

        # Financial Calculations
        penalty_per_unit = request.unit_stockout_penalty_usd
        unit_cost = request.unit_cost_usd

        # Scenario A Costs
        stockout_cost_a = round(unmet_a * penalty_per_unit, 2)
        total_a = stockout_cost_a

        # Scenario B Costs: Stockout cost + Alternative price premium
        stockout_cost_b = round(unmet_b * penalty_per_unit, 2)
        alt_premium_pct = request.alternative_procurement_cost_premium_pct / 100.0
        procurement_premium_b = round(batch_qty * unit_cost * alt_premium_pct, 2)
        total_b = round(stockout_cost_b + procurement_premium_b, 2)

        # Scenario C Costs: Stockout cost + Expedite fee
        stockout_cost_c = round(unmet_c * penalty_per_unit, 2)
        expedite_fee_c = round(request.expedite_cost_usd, 2)
        total_c = round(stockout_cost_c + expedite_fee_c, 2)

        outcome_a = ScenarioOutcome(
            name="Scenario A: Wait for Shipment",
            description=f"Wait for primary shipment delayed by {delay} days (arrives Day {arrival_a}).",
            replenishment_day=arrival_a,
            stockout_day=stockout_day_a,
            days_in_stockout=days_in_stockout_a,
            total_unmet_demand=round(unmet_a, 1),
            stockout_penalty_cost=stockout_cost_a,
            logistics_extra_cost=0.0,
            procurement_premium_cost=0.0,
            total_financial_impact_usd=total_a,
            minimum_inventory_reached=round(min_stock_a, 1),
        )

        outcome_b = ScenarioOutcome(
            name="Scenario B: Alternative Supplier",
            description=f"Engage alternative supplier with {arrival_b}-day lead time (+{request.alternative_procurement_cost_premium_pct:.0f}% unit cost).",
            replenishment_day=arrival_b,
            stockout_day=stockout_day_b,
            days_in_stockout=days_in_stockout_b,
            total_unmet_demand=round(unmet_b, 1),
            stockout_penalty_cost=stockout_cost_b,
            logistics_extra_cost=0.0,
            procurement_premium_cost=procurement_premium_b,
            total_financial_impact_usd=total_b,
            minimum_inventory_reached=round(min_stock_b, 1),
        )

        outcome_c = ScenarioOutcome(
            name="Scenario C: Expedite Existing Freight",
            description=f"Pay expedited carrier fee (${request.expedite_cost_usd:.0f}) to reduce delay by {request.expedite_transit_reduction_days} days (arrives Day {arrival_c}).",
            replenishment_day=arrival_c,
            stockout_day=stockout_day_c,
            days_in_stockout=days_in_stockout_c,
            total_unmet_demand=round(unmet_c, 1),
            stockout_penalty_cost=stockout_cost_c,
            logistics_extra_cost=expedite_fee_c,
            procurement_premium_cost=0.0,
            total_financial_impact_usd=total_c,
            minimum_inventory_reached=round(min_stock_c, 1),
        )

        # Determine advisory recommendation
        costs = {"Scenario A (Wait)": total_a, "Scenario B (Alternative)": total_b, "Scenario C (Expedite)": total_c}
        best_scenario = min(costs, key=costs.get)

        if unmet_a == 0:
            advice = (
                f"Recommendation: Maintain primary order (Scenario A). Existing available inventory ({current_inv:.0f} units) "
                f"fully covers daily demand of {daily_demand:.0f} units during the {delay}-day delay without stockout."
            )
        elif best_scenario == "Scenario C (Expedite)" and total_c < total_a:
            savings = total_a - total_c
            advice = (
                f"Recommendation: Expedite the delayed shipment (Scenario C). Shaving {request.expedite_transit_reduction_days} days "
                f"for ${expedite_fee_c:.0f} prevents {unmet_a - unmet_c:.0f} units of unmet demand and saves ${savings:,.2f} in net exposure."
            )
        elif best_scenario == "Scenario B (Alternative)" and total_b < total_a:
            savings = total_a - total_b
            advice = (
                f"Recommendation: Switch replenishment to the alternative supplier (Scenario B). Faster delivery in {arrival_b} days "
                f"saves ${savings:,.2f} compared to waiting for the disrupted shipment."
            )
        else:
            advice = (
                f"Recommendation: Scenario A (Wait) has the lowest total financial exposure (${total_a:,.2f}) "
                f"as expediting or alternative supplier costs exceed the stockout penalty."
            )

        assumptions = [
            f"Daily demand is constant at {daily_demand:.1f} units/day over the 30-day projection.",
            f"Stockout penalty is calculated at ${penalty_per_unit:.2f} per unit of unmet customer demand.",
            f"Alternative supplier unit cost index is +{request.alternative_procurement_cost_premium_pct:.1f}% higher than baseline.",
            "Replenishment is received in full at the beginning of the indicated arrival day.",
            "Simulation is purely advisory for decision analysis and does not alter live database inventory.",
        ]

        comparison_summary = {
            "lowest_cost_scenario": best_scenario,
            "cost_difference_vs_wait": {
                "scenario_b_diff": round(total_b - total_a, 2),
                "scenario_c_diff": round(total_c - total_a, 2),
            },
            "unmet_demand_prevention": {
                "scenario_b_units_saved": round(max(0.0, unmet_a - unmet_b), 1),
                "scenario_c_units_saved": round(max(0.0, unmet_a - unmet_c), 1),
            },
        }

        return AnalysisSimulationResponse(
            product_sku=request.product_sku,
            parameters=request.model_dump(),
            trajectories=trajectories,
            scenario_a_wait=outcome_a,
            scenario_b_alternative=outcome_b,
            scenario_c_expedite=outcome_c,
            comparison_summary=comparison_summary,
            advisory_recommendation=advice,
            assumptions=assumptions,
        )
