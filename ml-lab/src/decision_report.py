import json
from pathlib import Path

import pandas as pd


# ==========================================================
# 1. PROJECT PATHS
# ==========================================================

SRC_DIR = Path(__file__).resolve().parent
ML_LAB_DIR = SRC_DIR.parent
REPORTS_DIR = ML_LAB_DIR / "reports"

SIMULATION_FILE = REPORTS_DIR / "simulation_daily_results.csv"
SELECTED_SUPPLIER_FILE = REPORTS_DIR / "selected_supplier.json"
DECISION_REPORT_FILE = REPORTS_DIR / "decision_report.txt"


# ==========================================================
# 2. LOAD AND VALIDATE INPUT FILES
# ==========================================================

REQUIRED_SCENARIOS = (
    "baseline",
    "mitigated",
    "automatic_replenishment",
)

SCENARIO_LABELS = {
    "baseline": "BASELINE",
    "mitigated": "MITIGATED",
    "automatic_replenishment": "AUTOMATIC REPLENISHMENT",
}


def _normalize_scenario_name(value: object) -> str:
    """Convert scenario labels to a canonical lowercase form."""

    return str(value).strip().lower().replace(" ", "_")


def load_simulation_data(
    simulation_file: str | Path | None = None,
) -> pd.DataFrame:
    """Load and validate daily simulation results."""

    file_path = Path(simulation_file) if simulation_file else SIMULATION_FILE

    if not file_path.exists():
        raise FileNotFoundError(
            f"Simulation results not found: {file_path}\n"
            "Run simulation.py first."
        )

    try:
        df = pd.read_csv(file_path)
    except pd.errors.EmptyDataError as exc:
        raise ValueError(f"Simulation CSV is empty: {file_path}") from exc

    required_columns = {
        "scenario",
        "day",
        "unmet_demand",
        "ending_inventory",
    }

    missing_columns = required_columns - set(df.columns)

    if missing_columns:
        raise ValueError(
            f"Simulation CSV is missing columns: "
            f"{sorted(missing_columns)}"
        )

    df = df.copy()
    df["scenario"] = df["scenario"].map(_normalize_scenario_name)

    available_scenarios = set(df["scenario"].dropna().unique())
    missing_scenarios = set(REQUIRED_SCENARIOS) - available_scenarios

    if missing_scenarios:
        raise ValueError(
            "Simulation CSV must contain all required scenarios: "
            f"{', '.join(sorted(REQUIRED_SCENARIOS))}. "
            "Run simulation.py again."
        )

    return df


def load_selected_supplier(
    supplier_file: str | Path | None = None,
) -> dict:
    """Load the exact supplier selected by simulation.py."""

    file_path = (
        Path(supplier_file)
        if supplier_file is not None
        else SELECTED_SUPPLIER_FILE
    )

    if not file_path.exists():
        raise FileNotFoundError(
            f"Selected supplier file not found: {file_path}\n"
            "Run simulation.py first."
        )

    try:
        with file_path.open("r", encoding="utf-8") as file:
            supplier = json.load(file)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Selected supplier JSON is invalid: {file_path}"
        ) from exc

    if not isinstance(supplier, dict):
        raise ValueError(
            f"Selected supplier JSON must contain an object: {file_path}"
        )

    required_fields = {
        "supplier_id",
        "supplier_name",
        "location",
        "estimated_delay_probability",
        "average_lead_time_days",
        "available_capacity_units",
        "quality_rate",
        "prediction_source",
    }

    missing_fields = required_fields - set(supplier.keys())

    if missing_fields:
        raise ValueError(
            "Selected supplier JSON is missing fields: "
            f"{sorted(missing_fields)}"
        )

    return supplier


# ==========================================================
# 3. CALCULATE SCENARIO METRICS
# ==========================================================

def calculate_summaries(df: pd.DataFrame) -> dict:
    """Calculate inventory and stockout metrics for each scenario."""

    summaries = {}

    for scenario_name in REQUIRED_SCENARIOS:
        scenario_df = (
            df[df["scenario"] == scenario_name]
            .sort_values("day")
            .copy()
        )

        if scenario_df.empty:
            raise ValueError(f"No simulation data found for {scenario_name}.")

        required_numeric_columns = ["day", "unmet_demand", "ending_inventory"]
        if scenario_df[required_numeric_columns].isna().any().any():
            raise ValueError(
                f"Missing numeric simulation values in {scenario_name}."
            )

        stockout_rows = scenario_df[scenario_df["unmet_demand"] > 0]

        summaries[scenario_name] = {
            "ending_inventory": float(
                scenario_df["ending_inventory"].iloc[-1]
            ),
            "total_unmet_demand": float(
                scenario_df["unmet_demand"].sum()
            ),
            "days_with_stockout": int(
                (scenario_df["unmet_demand"] > 0).sum()
            ),
            "first_stockout_day": (
                int(stockout_rows["day"].iloc[0])
                if not stockout_rows.empty
                else None
            ),
        }

    return summaries


# ==========================================================
# 4. ANALYZE SIMULATION RESULTS
# ==========================================================

def analyze_results(summaries: dict) -> dict:
    """Explain differences across the baseline, supplier, and replenishment scenarios."""

    baseline = summaries["baseline"]
    mitigated = summaries["mitigated"]
    replenishment = summaries["automatic_replenishment"]

    mitigated_stockout_delay = _compare_stockout_days(
        baseline["first_stockout_day"],
        mitigated["first_stockout_day"],
        "The alternative supplier",
    )
    replenishment_stockout_delay = _compare_stockout_days(
        baseline["first_stockout_day"],
        replenishment["first_stockout_day"],
        "Automatic replenishment",
    )

    mitigated_unmet_change = (
        mitigated["total_unmet_demand"] - baseline["total_unmet_demand"]
    )
    replenishment_unmet_change = (
        replenishment["total_unmet_demand"] - baseline["total_unmet_demand"]
    )

    stockout_finding = (
        "The alternative supplier delays the first stockout by "
        f"{mitigated_stockout_delay['delta']} days."
        if mitigated_stockout_delay["delta"] is not None
        and mitigated_stockout_delay["delta"] > 0
        else "The alternative supplier does not improve the first stockout day."
    )

    if replenishment["first_stockout_day"] is None:
        replenishment_finding = (
            "Automatic replenishment eliminates stockouts during the simulation."
        )
    elif replenishment["first_stockout_day"] is not None:
        replenishment_finding = (
            "Automatic replenishment first stockout: "
            f"Day {replenishment['first_stockout_day']}."
        )

    if mitigated_unmet_change < 0:
        demand_finding = (
            "The alternative supplier reduces unmet demand by "
            f"{abs(mitigated_unmet_change):g} units."
        )
    elif mitigated_unmet_change > 0:
        demand_finding = (
            "The alternative supplier increases unmet demand by "
            f"{mitigated_unmet_change:g} units."
        )
    else:
        demand_finding = "Total unmet demand remains unchanged for the alternative supplier."

    if replenishment_unmet_change < 0:
        replenishment_demand_finding = (
            "Automatic replenishment reduces unmet demand by "
            f"{abs(replenishment_unmet_change):g} units."
        )
    elif replenishment_unmet_change > 0:
        replenishment_demand_finding = (
            "Automatic replenishment increases unmet demand by "
            f"{replenishment_unmet_change:g} units."
        )
    else:
        replenishment_demand_finding = (
            "Automatic replenishment does not change total unmet demand."
        )

    if replenishment["first_stockout_day"] is None and replenishment_unmet_change <= 0:
        next_action = (
            "Automatic replenishment provides the strongest outcome in this simulation. "
            "Validate the operating assumptions before using it as the primary decision."
        )
    elif mitigated_unmet_change < 0:
        next_action = (
            "The alternative supplier improves the simulation, but automatic replenishment "
            "should be evaluated against the operating cost and inventory policy before use."
        )
    else:
        next_action = (
            "The simulation does not show a sustained improvement in unmet demand. Review "
            "supplier timing, inventory policy, and replenishment assumptions."
        )

    return {
        "stockout_delay": mitigated_stockout_delay["delta"],
        "unmet_demand_change": mitigated_unmet_change,
        "stockout_finding": stockout_finding,
        "demand_finding": demand_finding,
        "replenishment_finding": replenishment_finding,
        "replenishment_demand_finding": replenishment_demand_finding,
        "next_action": next_action,
    }


def _compare_stockout_days(
    baseline_day: int | None,
    candidate_day: int | None,
    scenario_label: str,
) -> dict:
    """Return the stockout-day difference and a human-readable explanation."""

    if baseline_day is None and candidate_day is None:
        return {"delta": None, "text": f"{scenario_label} and baseline have no stockout."}

    if baseline_day is None:
        return {"delta": None, "text": f"The baseline has no stockout, while {scenario_label.lower()} does."}

    if candidate_day is None:
        return {"delta": None, "text": f"{scenario_label} has no stockout during the simulation period."}

    delta = candidate_day - baseline_day
    if delta > 0:
        text = (
            f"{scenario_label} delays the first stockout by {delta} days."
        )
    elif delta == 0:
        text = f"{scenario_label} experiences the first stockout on the same day as the baseline."
    else:
        text = (
            f"{scenario_label} experiences the first stockout {abs(delta)} days earlier."
        )

    return {"delta": delta, "text": text}


# ==========================================================
# 5. BUILD THE DECISION REPORT
# ==========================================================

def generate_decision_report(
    simulation_file: str | Path | None = None,
    supplier_file: str | Path | None = None,
    output_file: str | Path | None = None,
) -> dict:
    """Generate a decision report using simulation results
    and the exact supplier selected by simulation.py.
    """

    # Load both generated files.
    df = load_simulation_data(simulation_file)
    selected_supplier = load_selected_supplier(supplier_file)

    # Calculate scenario summaries.
    summaries = calculate_summaries(df)

    # Analyze scenario differences.
    findings = analyze_results(summaries)

    simulation_days = int(df["day"].max())

    baseline = summaries.get("baseline") or summaries.get("BASELINE")
    mitigated = summaries.get("mitigated") or summaries.get("MITIGATED")

    stockout_delay = findings["stockout_delay"]
    unmet_demand_change = findings["unmet_demand_change"]

    # Compare the supplier lead time against the baseline assumption.
    baseline_lead_time = 5
    selected_lead_time = float(
        selected_supplier["average_lead_time_days"]
    )

    report_lines = [
        "=" * 65,
        "             SYNCHAIN AI - DECISION REPORT",
        "=" * 65,
        "",
        "1. SIMULATION OVERVIEW",
        "Scenarios analyzed: BASELINE, MITIGATED, AUTOMATIC REPLENISHMENT",
        f"Simulation period: {simulation_days} days",
        "",
        "2. INVENTORY COMPARISON",
    ]

    for scenario_key in ("baseline", "mitigated", "automatic_replenishment"):
        scenario_summary = summaries.get(scenario_key) or summaries.get(scenario_key.upper())
        scenario_label = SCENARIO_LABELS.get(scenario_key, scenario_key.upper())

        first_day = scenario_summary["first_stockout_day"]

        first_day_text = (
            f"Day {first_day}"
            if first_day is not None
            else "No stockout"
        )

        report_lines.extend([
            "",
            f"{scenario_label}:",
            (
                "  Ending inventory: "
                f"{scenario_summary['ending_inventory']:g} units"
            ),
            (
                "  Total unmet demand: "
                f"{scenario_summary['total_unmet_demand']:g} units"
            ),
            (
                "  Days with stockout: "
                f"{scenario_summary['days_with_stockout']}"
            ),
            f"  First stockout: {first_day_text}",
        ])

    # ------------------------------------------------------
    # Selected supplier details
    # ------------------------------------------------------

    delay_probability = float(
        selected_supplier["estimated_delay_probability"]
    )

    # Support JSON files storing either probability (0-1)
    # or percentage (0-100).
    delay_percent = (
        delay_probability * 100
        if delay_probability <= 1
        else delay_probability
    )

    quality_rate = float(selected_supplier["quality_rate"])

    # Support quality values expressed as either 0-1 or 0-100.
    quality_percent = (
        quality_rate * 100
        if quality_rate <= 1
        else quality_rate
    )

    report_lines.extend([
        "",
        "3. ALTERNATIVE SUPPLIER RECOMMENDATION",
        f"Recommended supplier: {selected_supplier['supplier_name']}",
        f"Supplier ID: {selected_supplier['supplier_id']}",
        f"Location: {selected_supplier['location']}",
        (
            "Component type: "
            f"{selected_supplier.get('component_type', 'Not specified')}"
        ),
        f"Estimated delay probability: {delay_percent:.2f}%",
        (
            "Average lead time: "
            f"{selected_lead_time:g} days"
        ),
        (
            "Available capacity: "
            f"{selected_supplier['available_capacity_units']} units"
        ),
        f"Supplier quality rate: {quality_percent:.2f}%",
        (
            "On-time delivery rate: "
            f"{float(selected_supplier.get('on_time_delivery_rate', 0)):.2%}"
        ),
        (
            "Prediction source: "
            f"{selected_supplier['prediction_source']}"
        ),
        (
            "Recommendation score: "
            f"{selected_supplier.get('recommendation_score', 'Not available')}"
        ),
        "",
        (
            "Supplier decision source: "
            "selected_supplier.json generated by simulation.py"
        ),
        (
            "Note: The estimated delay probability is a model prediction, "
            "not a guarantee of actual delivery performance."
        ),
        "",
        "4. SIMULATION FINDINGS",
        f"- {findings['stockout_finding']}",
        f"- {findings['demand_finding']}",
        (
            f"- Baseline assumed lead time: "
            f"{baseline_lead_time} days."
        ),
        (
            f"- Selected supplier lead time: "
            f"{selected_lead_time:g} days."
        ),
        "",
        "5. RECOMMENDED NEXT ACTION",
        findings["next_action"],
        "",
        "6. IMPORTANT LIMITATIONS",
        "- Results depend on the simulation assumptions and inputs.",
        "- The dataset contains synthetic development data.",
        "- A shorter lead time does not guarantee lower unmet demand.",
        "- Estimated delay probability is not an observed shipment delay.",
        "- Supplier cost index is relative, not an actual currency price.",
        "- Supplier capacity does not necessarily represent uncommitted stock.",
        "- Validate model performance before real operational use.",
        "",
        "=" * 65,
    ])

    # Save and print the report.
    report_text = "\n".join(report_lines)

    target_report_file = Path(output_file) if output_file is not None else DECISION_REPORT_FILE
    target_report_file.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    target_report_file.write_text(
        report_text,
        encoding="utf-8",
    )

    print(report_text)

    print(
        "\nDecision report saved to:"
        f"\n{target_report_file}"
    )

    return {
        "summaries": summaries,
        "selected_supplier": selected_supplier,
        "findings": findings,
        "report_path": str(target_report_file),
    }


# ==========================================================
# 6. SCRIPT ENTRY POINT
# ==========================================================

if __name__ == "__main__":
    generate_decision_report()
