
from pathlib import Path

import pandas as pd

from recommend_supplier import recommend_suppliers


PROJECT_ROOT = Path(__file__).resolve().parents[1]

REPORT_DIR = PROJECT_ROOT / "reports"


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
    Run a deterministic inventory simulation.

    A shipment is dispatched on shipment_day and arrives
    after supplier_lead_time days.

    Inventory is consumed after that day's arrivals.
    Any demand that cannot be fulfilled is recorded as
    unmet demand.
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

    # Dispatch on day 1 with a lead time of 2 days:
    # arrival occurs on day 3.
    arrival_day = shipment_day + supplier_lead_time

    for day in range(1, simulation_days + 1):

        incoming_quantity = 0

        if day == arrival_day:
            incoming_quantity = shipment_quantity
            inventory += incoming_quantity

        demand = daily_demand

        fulfilled_demand = min(inventory, demand)

        unmet_demand = demand - fulfilled_demand

        inventory -= fulfilled_demand

        cumulative_unmet_demand += unmet_demand

        records.append(
            {
                "scenario": scenario_name,
                "day": day,
                "starting_inventory": (
                    inventory
                    + fulfilled_demand
                    - incoming_quantity
                ),
                "incoming_quantity": incoming_quantity,
                "demand": demand,
                "fulfilled_demand": fulfilled_demand,
                "unmet_demand": unmet_demand,
                "ending_inventory": inventory,
                "cumulative_unmet_demand": (
                    cumulative_unmet_demand
                ),
            }
        )

    return pd.DataFrame(records)


def run_simulation(
    initial_inventory: int = 300,
    daily_demand: int = 100,
    simulation_days: int = 30,
    shipment_quantity: int = 1000,
) -> tuple[pd.DataFrame, dict]:

    # Example shipment requiring battery components.
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

    recommendations = recommend_suppliers(
        shipment,
        max_results=5,
    )

    if not recommendations:
        raise RuntimeError(
            "No eligible alternative suppliers found."
        )

    # Baseline uses the original five-day planned lead time.
    baseline = simulate_scenario(
        scenario_name="baseline",
        initial_inventory=initial_inventory,
        daily_demand=daily_demand,
        simulation_days=simulation_days,
        supplier_lead_time=5,
        shipment_quantity=shipment_quantity,
        shipment_day=1,
    )

    # Mitigation uses the lead time of the top-ranked supplier.
    selected_supplier = recommendations[0]

    mitigated = simulate_scenario(
        scenario_name="mitigated",
        initial_inventory=initial_inventory,
        daily_demand=daily_demand,
        simulation_days=simulation_days,
        supplier_lead_time=int(
            selected_supplier["average_lead_time_days"]
        ),
        shipment_quantity=shipment_quantity,
        shipment_day=1,
    )

    combined = pd.concat(
        [baseline, mitigated],
        ignore_index=True,
    )

    summary = {}

    for scenario_name, scenario_data in combined.groupby(
        "scenario"
    ):

        summary[scenario_name] = {
            "ending_inventory": int(
                scenario_data["ending_inventory"].iloc[-1]
            ),
            "total_unmet_demand": int(
                scenario_data["unmet_demand"].sum()
            ),
            "days_with_stockout": int(
                (
                    scenario_data["unmet_demand"] > 0
                ).sum()
            ),
        }

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


def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    results, summary = run_simulation()

    report_file = REPORT_DIR / "simulation_daily_results.csv"

    results.to_csv(report_file, index=False)

    print("=" * 65)
    print("SYNCHAIN AI - 30-DAY INVENTORY SIMULATION")
    print("=" * 65)

    print("\nScenario summary:")

    for scenario, metrics in summary.items():
        print(f"\n{scenario.upper()}")

        for key, value in metrics.items():
            print(f"  {key}: {value}")

    print(f"\nDaily results saved to: {report_file}")


if __name__ == "__main__":
    main()
