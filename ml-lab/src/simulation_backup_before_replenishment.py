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

    if initial_inventory < 0:
        raise ValueError("Initial inventory cannot be negative.")

    if daily_demand < 0:
        raise ValueError("Daily demand cannot be negative.")

    if simulation_days < 1:
        raise ValueError("Simulation days must be positive.")

    if supplier_lead_time < 1:
        raise ValueError("Supplier lead time must be positive.")

    if shipment_quantity < 0:
        raise ValueError("Shipment quantity cannot be negative.")

    if shipment_day < 1 or shipment_day > simulation_days:
        raise ValueError(
            "Shipment day must be within the simulation period."
        )

    inventory = initial_inventory
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
    Compare a baseline supplier with an alternative supplier.

    The alternative supplier is selected by the supplier
    recommendation system.

    The complete selected-supplier recommendation is saved
    to reports/selected_supplier.json.

    Returns:
        combined: Daily results for both scenarios.
        summary: Summary metrics and selected supplier details.
    """

    # --------------------------------------------------------
    # A. Prepare the shipment information
    # --------------------------------------------------------

    shipment = {
        "supplier_location": "Pune",
        "component_type": "Battery",
        "transport_mode": "Road",
        "distance_km": 450,
        "weather_condition": "Rain",
        "seasonal_rainy_period": 1,
        "traffic_level": "High",
        "supplier_risk_rating": "Medium",
        "supplier_on_time_rate": 0.82,
        "supplier_quality_rate": 0.91,
        "supplier_capacity_utilization": 0.85,
        "order_quantity": shipment_quantity,
        "inventory_at_order": initial_inventory,
        "planned_lead_time_days": 5,
        "unit_cost": 250.0,
    }

    # --------------------------------------------------------
    # B. Recommend an alternative supplier
    # --------------------------------------------------------

    recommendations = recommend_suppliers(
        shipment,
        max_results=5,
    )

    if not recommendations:
        raise RuntimeError(
            "No eligible alternative suppliers found."
        )

    # Select the highest-ranked recommendation.
    selected_supplier = recommendations[0]

    # --------------------------------------------------------
    # C. Save the exact selected supplier
    # --------------------------------------------------------

    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    with SELECTED_SUPPLIER_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            selected_supplier,
            file,
            indent=4,
            default=str,
        )

    print(
        "\nSelected supplier saved to:"
        f"\n{SELECTED_SUPPLIER_FILE}"
    )

    # --------------------------------------------------------
    # D. Simulate the baseline supplier
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
    # E. Simulate the selected alternative supplier
    # --------------------------------------------------------

    alternative_lead_time = int(
        selected_supplier["average_lead_time_days"]
    )

    if alternative_lead_time < 1:
        raise ValueError(
            "Alternative supplier lead time must be at least one day."
        )

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
    # F. Combine both scenarios
    # --------------------------------------------------------

    combined = pd.concat(
        [baseline, mitigated],
        ignore_index=True,
    )

    # --------------------------------------------------------
    # G. Calculate metrics independently for each scenario
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
    # H. Include the exact selected supplier in the summary
    # --------------------------------------------------------

    summary["selected_supplier"] = {
        "supplier_id": selected_supplier["supplier_id"],
        "supplier_name": selected_supplier["supplier_name"],
        "location": selected_supplier["location"],
        "average_lead_time_days": selected_supplier[
            "average_lead_time_days"
        ],
        "estimated_delay_probability": selected_supplier[
            "estimated_delay_probability"
        ],
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

    if initial_inventory < 0:
        raise ValueError(
            "Initial inventory cannot be negative."
        )

    if daily_demand <= 0:
        raise ValueError(
            "Daily demand must be greater than zero."
        )

    if simulation_days <= 0:
        raise ValueError(
            "Simulation days must be greater than zero."
        )

    if supplier_lead_time < 0:
        raise ValueError(
            "Supplier lead time cannot be negative."
        )

    if reorder_point < 0:
        raise ValueError(
            "Reorder point cannot be negative."
        )

    if order_quantity <= 0:
        raise ValueError(
            "Order quantity must be greater than zero."
        )

    inventory = initial_inventory
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
