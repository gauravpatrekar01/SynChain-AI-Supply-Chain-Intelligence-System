import json
from pathlib import Path

import pandas as pd

from recommend_supplier import recommend_suppliers


# ============================================================
# PATH CONFIGURATION
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = PROJECT_ROOT / "reports"

SELECTED_SUPPLIER_FILE = REPORT_DIR / "selected_supplier.json"
SIMULATION_REPORT_FILE = REPORT_DIR / "simulation_daily_results.csv"


def _coerce_int(name: str, value: object, *, minimum: int | None = None) -> int:
    """Validate and normalize integer-like simulation inputs."""
    if value is None:
        raise ValueError(f"{name} cannot be None.")

    try:
        coerced = int(value)
    except (TypeError, ValueError) as exc:
        raise TypeError(f"{name} must be an integer value.") from exc

    if minimum is not None and coerced < minimum:
        raise ValueError(f"{name} must be >= {minimum}.")

    return coerced


def validate_simulation_inputs(
    *,
    initial_inventory: int,
    daily_demand: int,
    simulation_days: int,
    shipment_quantity: int,
    supplier_lead_time: int | None = None,
    reorder_point: int | None = None,
    shipment_day: int | None = None,
) -> dict:
    """Normalize common input values used by the simulation functions."""
    validated = {
        "initial_inventory": _coerce_int(
            "initial_inventory",
            initial_inventory,
            minimum=0,
        ),
        "daily_demand": _coerce_int(
            "daily_demand",
            daily_demand,
            minimum=0,
        ),
        "simulation_days": _coerce_int(
            "simulation_days",
            simulation_days,
            minimum=1,
        ),
        "shipment_quantity": _coerce_int(
            "shipment_quantity",
            shipment_quantity,
            minimum=0,
        ),
    }

    if supplier_lead_time is not None:
        validated["supplier_lead_time"] = _coerce_int(
            "supplier_lead_time",
            supplier_lead_time,
            minimum=0,
        )

    if reorder_point is not None:
        validated["reorder_point"] = _coerce_int(
            "reorder_point",
            reorder_point,
            minimum=0,
        )

    if shipment_day is not None:
        validated["shipment_day"] = _coerce_int(
            "shipment_day",
            shipment_day,
            minimum=1,
        )
        if validated["shipment_day"] > validated["simulation_days"]:
            raise ValueError(
                "shipment_day must be within the simulation period."
            )

    return validated


def build_shipment_request(
    *,
    component_type: str = "Battery",
    supplier_location: str = "Pune",
    order_quantity: int,
    inventory_at_order: int,
    transport_mode: str = "Road",
    distance_km: int = 450,
    weather_condition: str = "Rain",
    seasonal_rainy_period: int = 1,
    traffic_level: str = "High",
    supplier_risk_rating: str = "Medium",
    supplier_on_time_rate: float = 0.82,
    supplier_quality_rate: float = 0.91,
    supplier_capacity_utilization: float = 0.85,
    planned_lead_time_days: int = 5,
    unit_cost: float = 250.0,
) -> dict:
    """Create a shipment payload for the recommendation model."""
    return {
        "supplier_location": supplier_location,
        "component_type": component_type,
        "transport_mode": transport_mode,
        "distance_km": int(distance_km),
        "weather_condition": weather_condition,
        "seasonal_rainy_period": int(seasonal_rainy_period),
        "traffic_level": traffic_level,
        "supplier_risk_rating": supplier_risk_rating,
        "supplier_on_time_rate": float(supplier_on_time_rate),
        "supplier_quality_rate": float(supplier_quality_rate),
        "supplier_capacity_utilization": float(supplier_capacity_utilization),
        "order_quantity": int(order_quantity),
        "inventory_at_order": int(inventory_at_order),
        "planned_lead_time_days": int(planned_lead_time_days),
        "unit_cost": float(unit_cost),
    }


# ============================================================
# 1. SINGLE-SHIPMENT INVENTORY SIMULATION
# ============================================================

def simulate_scenario(
    scenario_name: str,
    initial_inventory: int,
    daily_demand: int,
    simulation_days: int,
    supplier_lead_time: int,
    shipment_quantity: int,
    shipment_day: int = 1,
) -> pd.DataFrame:
    """
    Run a deterministic, single-shipment inventory simulation.

    A shipment dispatched on shipment_day arrives after
    supplier_lead_time days.

    Shipments arriving during the simulation are received before
    that day's demand is fulfilled.
    """

    normalized = validate_simulation_inputs(
        initial_inventory=initial_inventory,
        daily_demand=daily_demand,
        simulation_days=simulation_days,
        shipment_quantity=shipment_quantity,
        supplier_lead_time=supplier_lead_time,
        shipment_day=shipment_day,
    )

    inventory = normalized["initial_inventory"]
    daily_demand = normalized["daily_demand"]
    simulation_days = normalized["simulation_days"]
    supplier_lead_time = normalized["supplier_lead_time"]
    shipment_quantity = normalized["shipment_quantity"]
    shipment_day = normalized["shipment_day"]
    cumulative_unmet_demand = 0
    records = []

    # Calculate the expected shipment arrival day.
    arrival_day = shipment_day + supplier_lead_time

    for day in range(1, simulation_days + 1):
        starting_inventory = inventory
        incoming_quantity = 0

        # 1. Receive the shipment if it arrives today.
        if day == arrival_day:
            incoming_quantity = shipment_quantity
            inventory += incoming_quantity

        # 2. Fulfil today's demand.
        demand = daily_demand
        fulfilled_demand = min(inventory, demand)
        unmet_demand = demand - fulfilled_demand

        inventory -= fulfilled_demand
        cumulative_unmet_demand += unmet_demand

        # 3. Record daily results.
        records.append(
            {
                "scenario": scenario_name,
                "day": day,
                "starting_inventory": starting_inventory,
                "incoming_quantity": incoming_quantity,
                "demand": demand,
                "fulfilled_demand": fulfilled_demand,
                "unmet_demand": unmet_demand,
                "ending_inventory": inventory,
                "cumulative_unmet_demand": cumulative_unmet_demand,
            }
        )

    return pd.DataFrame(records)


# ============================================================
# 2. BASELINE VS. ALTERNATIVE SUPPLIER SIMULATION
# ============================================================

def run_simulation(
    initial_inventory: int = 300,
    daily_demand: int = 100,
    simulation_days: int = 30,
    shipment_quantity: int = 1000,
) -> tuple[pd.DataFrame, dict]:
    """
    Compare three inventory strategies:
    1. Baseline supplier with a 5-day lead time.
    2. Alternative supplier selected by the recommendation system.
    3. Automatic replenishment using a reorder point.

    Returns:
        combined: Daily results for all three scenarios.
        summary: Metrics for each scenario and selected supplier.
    """

    validated = validate_simulation_inputs(
        initial_inventory=initial_inventory,
        daily_demand=daily_demand,
        simulation_days=simulation_days,
        shipment_quantity=shipment_quantity,
    )
    initial_inventory = validated["initial_inventory"]
    daily_demand = validated["daily_demand"]
    simulation_days = validated["simulation_days"]
    shipment_quantity = validated["shipment_quantity"]

    if daily_demand <= 0:
        raise ValueError("Daily demand must be greater than zero.")

    if shipment_quantity <= 0:
        raise ValueError("Shipment quantity must be positive.")

    shipment = build_shipment_request(
        order_quantity=shipment_quantity,
        inventory_at_order=initial_inventory,
    )

    # --------------------------------------------------------
    # C. Select the best alternative supplier
    # --------------------------------------------------------

    recommendations = recommend_suppliers(
        shipment,
        max_results=5,
    )

    if not recommendations:
        raise RuntimeError("No eligible alternative suppliers found.")

    selected_supplier = recommendations[0]

    alternative_lead_time = int(
        selected_supplier["average_lead_time_days"]
    )

    if alternative_lead_time < 1:
        raise ValueError(
            "Alternative supplier lead time must be at least one day."
        )

    # --------------------------------------------------------
    # D. Save the selected supplier
    # --------------------------------------------------------

    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    with SELECTED_SUPPLIER_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(selected_supplier, file, indent=4, default=str)

    # --------------------------------------------------------
    # E. Run baseline scenario
    # --------------------------------------------------------

    baseline = simulate_scenario(
        scenario_name="baseline",
        initial_inventory=initial_inventory,
        daily_demand=daily_demand,
        simulation_days=simulation_days,
        supplier_lead_time=5,
        shipment_quantity=shipment_quantity,
        shipment_day=1,
    )

    # --------------------------------------------------------
    # F. Run alternative supplier scenario
    # --------------------------------------------------------

    mitigated = simulate_scenario(
        scenario_name="mitigated",
        initial_inventory=initial_inventory,
        daily_demand=daily_demand,
        simulation_days=simulation_days,
        supplier_lead_time=alternative_lead_time,
        shipment_quantity=shipment_quantity,
        shipment_day=1,
    )

    # --------------------------------------------------------
    # G. Run automatic replenishment scenario
    # --------------------------------------------------------

    # Reorder when inventory falls to approximately 3 days
    # of demand. One order can be pending at a time.
    reorder_point = daily_demand * 3

    replenishment_results = simulate_replenishment(
        initial_inventory=initial_inventory,
        daily_demand=daily_demand,
        simulation_days=simulation_days,
        supplier_lead_time=alternative_lead_time,
        reorder_point=reorder_point,
        order_quantity=shipment_quantity,
    )

    automatic = pd.DataFrame(replenishment_results)
    automatic.insert(0, "scenario", "automatic_replenishment")

    # --------------------------------------------------------
    # H. Combine all three scenarios
    # --------------------------------------------------------

    combined = pd.concat(
        [baseline, mitigated, automatic],
        ignore_index=True,
        sort=False,
    )

    # --------------------------------------------------------
    # I. Calculate metrics for each scenario
    # --------------------------------------------------------

    summary = {}

    for scenario_name, scenario_data in combined.groupby(
        "scenario",
        sort=True,
    ):
        stockout_days = scenario_data.loc[
            scenario_data["unmet_demand"] > 0,
            "day",
        ]

        summary[scenario_name] = {
            "ending_inventory": int(
                scenario_data["ending_inventory"].iloc[-1]
            ),
            "total_unmet_demand": int(
                scenario_data["unmet_demand"].sum()
            ),
            "days_with_stockout": int(
                (scenario_data["unmet_demand"] > 0).sum()
            ),
            "first_stockout_day": (
                int(stockout_days.iloc[0])
                if not stockout_days.empty
                else None
            ),
        }

    # --------------------------------------------------------
    # J. Include selected supplier details
    # --------------------------------------------------------

    summary["selected_supplier"] = {
        "supplier_id": selected_supplier["supplier_id"],
        "supplier_name": selected_supplier["supplier_name"],
        "location": selected_supplier["location"],
        "average_lead_time_days": alternative_lead_time,
        "estimated_delay_probability": selected_supplier[
            "estimated_delay_probability"
        ],
    }

    summary["replenishment_settings"] = {
        "reorder_point": reorder_point,
        "order_quantity": shipment_quantity,
        "supplier_lead_time_days": alternative_lead_time,
    }

    return combined, summary

# ============================================================
# 3. INVENTORY REPLENISHMENT SIMULATION
# ============================================================


def simulate_replenishment(
    initial_inventory: int,
    daily_demand: int,
    simulation_days: int,
    supplier_lead_time: int,
    reorder_point: int,
    order_quantity: int,
) -> list[dict]:
    """
    Simulate inventory replenishment using a reorder point.

    If inventory reaches the reorder point, an order is placed
    when no other order is pending.

    A zero-day shipment arrives immediately when ordered.
    """

    validated = validate_simulation_inputs(
        initial_inventory=initial_inventory,
        daily_demand=daily_demand,
        simulation_days=simulation_days,
        shipment_quantity=order_quantity,
        supplier_lead_time=supplier_lead_time,
        reorder_point=reorder_point,
    )

    if validated["daily_demand"] <= 0:
        raise ValueError("Daily demand must be greater than zero.")

    if validated["shipment_quantity"] <= 0:
        raise ValueError("Order quantity must be greater than zero.")

    inventory = validated["initial_inventory"]
    supplier_lead_time = validated["supplier_lead_time"]
    reorder_point = validated["reorder_point"]
    pending_orders = []
    results = []
    total_unmet_demand = 0

    for day in range(1, simulation_days + 1):
        starting_inventory = inventory
        incoming_quantity = 0

        # 1. Receive shipments scheduled for today.
        arriving_orders = [
            order
            for order in pending_orders
            if order["arrival_day"] <= day
        ]

        for order in arriving_orders:
            incoming_quantity += order["quantity"]

        # Remove orders that have arrived.
        pending_orders = [
            order
            for order in pending_orders
            if order["arrival_day"] > day
        ]

        inventory += incoming_quantity

        # 2. Fulfil today's demand.
        fulfilled_demand = min(
            inventory,
            daily_demand,
        )

        unmet_demand = daily_demand - fulfilled_demand

        inventory -= fulfilled_demand
        total_unmet_demand += unmet_demand

        # 3. Place an order if inventory is low
        # and no other order is pending.
        order_placed = 0

        if inventory <= reorder_point and not pending_orders:
            order_placed = order_quantity

            if supplier_lead_time == 0:
                # The order arrives immediately.
                inventory += order_quantity
                incoming_quantity += order_quantity

            else:
                # Schedule the shipment for a future day.
                pending_orders.append(
                    {
                        "order_day": day,
                        "arrival_day": day + supplier_lead_time,
                        "quantity": order_quantity,
                    }
                )

        # 4. Save the day's metrics.
        results.append(
            {
                "day": day,
                "starting_inventory": starting_inventory,
                "incoming_quantity": incoming_quantity,
                "demand": daily_demand,
                "fulfilled_demand": fulfilled_demand,
                "unmet_demand": unmet_demand,
                "ending_inventory": inventory,
                "order_placed": order_placed,
                "pending_orders": len(pending_orders),
                "cumulative_unmet_demand": total_unmet_demand,
            }
        )

    return results


# ============================================================
# 4. MAIN ENTRY POINT
# ============================================================

def main():
    """
    Run the simulation, save daily results, and print summaries.
    """

    REPORT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Run the baseline and alternative supplier simulations.
    results, summary = run_simulation()

    # Save daily results to CSV.
    results.to_csv(
        SIMULATION_REPORT_FILE,
        index=False,
    )

    # Print the report.
    print("\n" + "=" * 65)
    print("SYNCHAIN AI - INVENTORY SIMULATION")
    print("=" * 65)

    print("\nScenario summary:")

    for scenario, metrics in summary.items():
        print(f"\n{scenario.upper()}")

        for key, value in metrics.items():
            print(f"  {key}: {value}")

    print(
        "\nDaily results saved to:"
        f"\n{SIMULATION_REPORT_FILE}"
    )

    print(
        "\nSelected supplier details saved to:"
        f"\n{SELECTED_SUPPLIER_FILE}"
    )


if __name__ == "__main__":
    main()
