import sys
from pathlib import Path

import pytest

# Add the src directory so Python can import simulation.py.
SRC_DIR = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC_DIR))


def get_simulation_functions():
    import simulation
    return (
        simulation.simulate_scenario,
        simulation.simulate_replenishment,
        simulation.run_explicit_scenario_simulation,
    )


simulate_scenario, simulate_replenishment, simulate_explicit_scenarios = get_simulation_functions()


def test_shipment_arrives_on_expected_day():
    results = simulate_scenario(

        scenario_name="test",
        initial_inventory=300,
        daily_demand=100,
        simulation_days=7,
        supplier_lead_time=2,
        shipment_quantity=1000,
        shipment_day=1,
    )

    # Dispatch on Day 1 + 2 days of lead time = arrival on Day 3.
    day_3 = results.loc[results["day"] == 3].iloc[0]

    assert day_3["incoming_quantity"] == 1000


def test_inventory_decreases_after_demand():
    results = simulate_scenario(
        scenario_name="test",
        initial_inventory=300,
        daily_demand=100,
        simulation_days=2,
        supplier_lead_time=5,
        shipment_quantity=1000,
    )

    day_1 = results.loc[results["day"] == 1].iloc[0]

    assert day_1["starting_inventory"] == 300
    assert day_1["fulfilled_demand"] == 100
    assert day_1["ending_inventory"] == 200


def test_unmet_demand_when_inventory_is_insufficient():
    results = simulate_scenario(
        scenario_name="test",
        initial_inventory=50,
        daily_demand=100,
        simulation_days=1,
        supplier_lead_time=5,
        shipment_quantity=1000,
    )

    day_1 = results.iloc[0]

    assert day_1["fulfilled_demand"] == 50
    assert day_1["unmet_demand"] == 50
    assert day_1["ending_inventory"] == 0


def test_inventory_never_becomes_negative():
    results = simulate_scenario(
        scenario_name="test",
        initial_inventory=100,
        daily_demand=150,
        simulation_days=5,
        supplier_lead_time=5,
        shipment_quantity=200,
    )

    assert (results["ending_inventory"] >= 0).all()


def test_negative_initial_inventory_is_rejected():
    with pytest.raises(ValueError):
        simulate_scenario(
            scenario_name="test",
            initial_inventory=-10,
            daily_demand=100,
            simulation_days=5,
            supplier_lead_time=2,
            shipment_quantity=100,
        )


def test_replenishment_order_is_placed():
    results = simulate_replenishment(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=5,
        supplier_lead_time=2,
        reorder_point=300,
        order_quantity=1000,
    )

    day_1 = results[0]

    assert day_1["ending_inventory"] == 200
    assert day_1["order_placed"] == 1000


def test_replenishment_shipment_arrives_on_expected_day():
    results = simulate_replenishment(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=5,
        supplier_lead_time=2,
        reorder_point=300,
        order_quantity=1000,
    )

    day_1 = results[0]
    day_3 = results[2]

    assert day_1["order_placed"] == 1000
    assert day_3["incoming_quantity"] == 1000


def test_zero_day_lead_time():
    results = simulate_replenishment(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=3,
        supplier_lead_time=0,
        reorder_point=300,
        order_quantity=1000,
    )

    # The first day's order should be placed.
    assert results[0]["order_placed"] == 1000

    # A zero-day shipment should not remain pending.
    assert results[0]["pending_orders"] == 0

    # The inventory should not become negative.
    for day in results:
        assert day["ending_inventory"] >= 0


def test_run_simulation_generates_three_scenarios():
    import simulation

    combined, summary = simulation.run_simulation(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=30,
        shipment_quantity=1000,
    )

    scenario_names = set(combined["scenario"].str.lower())
    assert {"baseline", "mitigated", "automatic_replenishment"} <= scenario_names
    assert {"baseline", "mitigated", "automatic_replenishment"} <= set(summary)


def test_decision_report_includes_all_three_scenarios(tmp_path, monkeypatch):
    import json
    import decision_report

    # Generate fresh simulation artifacts from the current simulation logic.
    import simulation

    simulation_results, _ = simulation.run_simulation(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=30,
        shipment_quantity=1000,
    )

    reports_dir = Path(__file__).resolve().parents[1] / "reports"
    simulation_file = reports_dir / "simulation_daily_results.csv"
    supplier_file = reports_dir / "selected_supplier.json"
    report_file = tmp_path / "decision_report.txt"

    simulation_results.to_csv(simulation_file, index=False)

    with supplier_file.open("r", encoding="utf-8") as file:
        supplier = json.load(file)

    monkeypatch.setattr(decision_report, "SIMULATION_FILE", simulation_file)
    monkeypatch.setattr(decision_report, "SELECTED_SUPPLIER_FILE", supplier_file)
    monkeypatch.setattr(decision_report, "DECISION_REPORT_FILE", report_file)

    result = decision_report.generate_decision_report()

    report_text = report_file.read_text(encoding="utf-8")

    assert "BASELINE" in report_text
    assert "MITIGATED" in report_text
    assert "AUTOMATIC REPLENISHMENT" in report_text
    assert result["selected_supplier"]["supplier_name"] == supplier["supplier_name"]


def test_decision_report_missing_files_raise_clear_errors(tmp_path):
    import decision_report

    missing_simulation = tmp_path / "missing.csv"
    missing_supplier = tmp_path / "missing_supplier.json"

    with pytest.raises(FileNotFoundError):
        decision_report.load_simulation_data(missing_simulation)

    with pytest.raises(FileNotFoundError):
        decision_report.load_selected_supplier(missing_supplier)


def test_simulation_rejects_non_numeric_inputs():
    import simulation

    with pytest.raises(TypeError):
        simulation.simulate_scenario(
            scenario_name="test",
            initial_inventory="bad",
            daily_demand=100,
            simulation_days=5,
            supplier_lead_time=2,
            shipment_quantity=100,
        )

    with pytest.raises(TypeError):
        simulation.simulate_replenishment(
            initial_inventory=300,
            daily_demand="bad",
            simulation_days=5,
            supplier_lead_time=2,
            reorder_point=300,
            order_quantity=100,
        )


def test_replenishment_results_are_repeatable():
    import simulation

    first = simulation.simulate_replenishment(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=5,
        supplier_lead_time=2,
        reorder_point=300,
        order_quantity=1000,
    )
    second = simulation.simulate_replenishment(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=5,
        supplier_lead_time=2,
        reorder_point=300,
        order_quantity=1000,
    )

    assert first == second
    assert first[0]["order_placed"] == 1000
    assert first[2]["incoming_quantity"] == 1000


def test_explicit_scenarios_are_pure_and_reject_fractional_day_assumptions():
    assumptions = {
        "initial_inventory": 20,
        "daily_demand": 10,
        "simulation_days": 5,
        "shipment_quantity": 30,
        "baseline_lead_time_days": 4,
        "mitigated_lead_time_days": 2,
    }
    result = simulate_explicit_scenarios(**assumptions)

    assert result["scenarios"]["baseline"]["summary"]["days_with_stockout"] == 2
    assert result["scenarios"]["mitigation_assumption"]["summary"]["days_with_stockout"] == 0
    assert result["assumptions"]["mitigation_is_a_user_supplied_assumption"] is True

    fractional = {**assumptions, "mitigated_lead_time_days": 2.5}
    with pytest.raises(ValueError, match="whole number"):
        simulate_explicit_scenarios(**fractional)


def test_run_simulation_has_expected_summary_fields():
    import simulation

    combined, summary = simulation.run_simulation(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=10,
        shipment_quantity=500,
    )

    assert list(combined["scenario"].unique()) == [
        "baseline",
        "mitigated",
        "automatic_replenishment",
    ]
    assert set(summary) >= {
        "baseline",
        "mitigated",
        "automatic_replenishment",
        "selected_supplier",
        "replenishment_settings",
    }
    assert summary["selected_supplier"]["supplier_name"]
