"""Optional ML analysis adapters for explicitly supplied intelligence data."""

import importlib.util
import logging
import math
import sys
import threading
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Callable

import joblib
import pandas as pd

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[4]
ML_LAB_SRC = PROJECT_ROOT / "ml-lab" / "src"
DELAY_MODEL_PATH = PROJECT_ROOT / "ml-lab" / "models" / "delay_model.joblib"
DELAY_MODEL_SOURCE = "synthetic_development_data"
DELAY_MODEL_PRODUCTION_READY = False
TEXT_MODEL_ID = "mathurvarun84/supply-chain-distilbert-risk"
FORECAST_MODEL_ID = "amazon/chronos-t5-tiny"
FORECAST_MIN_DAILY_OBSERVATIONS = 30
FORECAST_HORIZON_DAYS = 7
FORECAST_MAX_CONTEXT_DAYS = 180

DELAY_FEATURES = (
    "supplier_location",
    "component_type",
    "transport_mode",
    "distance_km",
    "weather_condition",
    "seasonal_rainy_period",
    "traffic_level",
    "supplier_risk_rating",
    "supplier_on_time_rate",
    "supplier_quality_rate",
    "supplier_capacity_utilization",
    "order_quantity",
    "inventory_at_order",
    "planned_lead_time_days",
    "unit_cost",
)
SUPPLIER_PROFILE_FIELDS = (
    "supplier_id",
    "supplier_name",
    "location",
    "component_types",
    "supplier_risk_rating",
    "average_lead_time_days",
    "on_time_delivery_rate",
    "quality_rate",
    "unit_cost_index",
    "available_capacity_units",
    "distance_from_warehouse_km",
    "active",
)
TEXT_FIELDS = ("risk_description", "disruption_report", "incident_description")

_MODEL_LOCK = threading.Lock()
_DELAY_MODEL: Any = None
_TEXT_COMPONENTS: tuple[Any, Any, Any] | None = None
_CHRONOS_COMPONENTS: tuple[Any, Any] | None = None
_DYNAMIC_MODULE_LOCK = threading.Lock()
_RECOMMENDER: Callable[..., list[dict[str, Any]]] | None = None
_SCENARIO_SIMULATOR: Callable[..., dict[str, Any]] | None = None


def _status(
    status: str,
    message: str,
    **details: Any,
) -> dict[str, Any]:
    return {"status": status, "message": message, **details}


def _get_delay_model() -> Any:
    global _DELAY_MODEL
    if _DELAY_MODEL is None:
        with _MODEL_LOCK:
            if _DELAY_MODEL is None:
                if not DELAY_MODEL_PATH.is_file():
                    raise FileNotFoundError(
                        f"Trained shipment-delay artifact is missing: {DELAY_MODEL_PATH.name}"
                    )
                model = joblib.load(DELAY_MODEL_PATH)
                feature_names = list(getattr(model, "feature_names_in_", []))
                if feature_names != list(DELAY_FEATURES):
                    raise ValueError(
                        "Shipment-delay artifact features do not match the inference contract."
                    )
                classifier = getattr(model, "named_steps", {}).get("classifier")
                classes = list(getattr(classifier, "classes_", []))
                if 1 not in classes or not callable(getattr(model, "predict_proba", None)):
                    raise ValueError(
                        "Shipment-delay artifact is missing the expected delayed-class probability output."
                    )
                _DELAY_MODEL = model
    return _DELAY_MODEL


def _predict_delay(model: Any, shipment: dict[str, Any]) -> dict[str, Any]:
    missing = [feature for feature in DELAY_FEATURES if feature not in shipment or shipment[feature] is None]
    if missing:
        raise ValueError("Missing required features: " + ", ".join(missing))

    input_frame = pd.DataFrame([{name: shipment[name] for name in DELAY_FEATURES}])
    probabilities = model.predict_proba(input_frame)[0]
    classes = list(model.named_steps["classifier"].classes_)
    delay_probability = float(probabilities[classes.index(1)])
    if not math.isfinite(delay_probability) or not 0 <= delay_probability <= 1:
        raise ValueError("Shipment-delay model returned an invalid probability.")

    risk_level = (
        "HIGH" if delay_probability >= 0.70
        else "MEDIUM" if delay_probability >= 0.40
        else "LOW"
    )
    return {
        "delay_probability": round(delay_probability, 4),
        "delay_probability_percent": round(delay_probability * 100, 2),
        "risk_level": risk_level,
        "model_type": "RandomForestClassifier",
        "data_source": DELAY_MODEL_SOURCE,
        "production_ready": DELAY_MODEL_PRODUCTION_READY,
    }


def _run_delay_predictions(datasets: dict[str, Any]) -> dict[str, Any]:
    rows = datasets.get("erp", {}).get("rows", [])
    if not rows:
        return _status(
            "skipped_insufficient_data",
            "No ERP records are available for shipment-delay inference.",
            predictions=[],
            missing_features=list(DELAY_FEATURES),
            provenance={
                "data_source": DELAY_MODEL_SOURCE,
                "production_ready": DELAY_MODEL_PRODUCTION_READY,
            },
        )

    missing_by_record: list[list[str]] = []
    eligible: list[tuple[int, dict[str, Any]]] = []
    for index, row in enumerate(rows, start=1):
        missing = [
            feature
            for feature in DELAY_FEATURES
            if feature not in row or row[feature] is None
        ]
        if missing:
            missing_by_record.append(missing)
        else:
            eligible.append((index, row))

    all_missing = sorted({feature for missing in missing_by_record for feature in missing})
    if not eligible:
        return _status(
            "skipped_insufficient_data",
            "No ERP row contains every explicitly required shipment-delay feature.",
            predictions=[],
            missing_features=all_missing,
            provenance={
                "data_source": DELAY_MODEL_SOURCE,
                "production_ready": DELAY_MODEL_PRODUCTION_READY,
            },
        )

    model = _get_delay_model()
    predictions = [
        {"record_number": index, **_predict_delay(model, row)}
        for index, row in eligible
    ]
    return _status(
        "completed",
        "Shipment-delay inference completed for records with all required features.",
        predictions=predictions,
        missing_features=all_missing,
        skipped_record_count=len(missing_by_record),
        provenance={
            "data_source": DELAY_MODEL_SOURCE,
            "production_ready": DELAY_MODEL_PRODUCTION_READY,
            "warning": "Trained on synthetic development data; probabilities and risk bands are not validated for real-world decisions.",
        },
    )


def _get_text_components() -> tuple[Any, Any, Any]:
    global _TEXT_COMPONENTS
    if _TEXT_COMPONENTS is None:
        with _MODEL_LOCK:
            if _TEXT_COMPONENTS is None:
                import torch
                from transformers import AutoModelForSequenceClassification, AutoTokenizer

                tokenizer = AutoTokenizer.from_pretrained(TEXT_MODEL_ID)
                model = AutoModelForSequenceClassification.from_pretrained(TEXT_MODEL_ID)
                model.eval()
                _TEXT_COMPONENTS = (tokenizer, model, torch)
    return _TEXT_COMPONENTS


def _run_text_risk(datasets: dict[str, Any]) -> dict[str, Any]:
    documents = []
    for dataset_type, dataset in datasets.items():
        for index, row in enumerate(dataset.get("rows", []), start=1):
            fields = {
                field: str(row[field]).strip()
                for field in TEXT_FIELDS
                if row.get(field) is not None and str(row[field]).strip()
            }
            if fields:
                text = " ".join(f"{field.replace('_', ' ')}: {value}" for field, value in fields.items())
                documents.append((dataset_type, index, text))

    if not documents:
        return _status(
            "skipped_insufficient_data",
            "Text inference was skipped because no uploaded row contains a supported risk, disruption, or incident description.",
            predictions=[],
            provenance={"model_id": TEXT_MODEL_ID},
        )

    tokenizer, model, torch = _get_text_components()
    predictions = []
    for dataset_type, record_number, text in documents[:100]:
        inputs = tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=256,
        )
        with torch.inference_mode():
            logits = model(**inputs).logits
            scores = torch.softmax(logits[0], dim=-1)
        class_index = int(torch.argmax(scores).item())
        label = model.config.id2label.get(class_index, model.config.id2label.get(str(class_index)))
        if not isinstance(label, str):
            raise ValueError("Text-risk model configuration has no label for its predicted class.")
        predictions.append({
            "dataset": dataset_type,
            "record_number": record_number,
            "predicted_label": label,
            "model_score": round(float(scores[class_index].item()), 6),
            "score_is_calibrated": False,
        })

    return _status(
        "completed",
        "Text-risk classification completed. Labels and scores are model outputs, not calibrated operational risk measures.",
        predictions=predictions,
        truncated_document_count=max(0, len(documents) - 100),
        provenance={
            "model_id": TEXT_MODEL_ID,
            "task": "text classification",
            "labels": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            "training_data": "The model card identifies a custom electronics supply-chain disruption dataset; independent validation was not provided.",
            "calibrated": False,
        },
    )


def _get_chronos_components() -> tuple[Any, Any]:
    global _CHRONOS_COMPONENTS
    if _CHRONOS_COMPONENTS is None:
        with _MODEL_LOCK:
            if _CHRONOS_COMPONENTS is None:
                import torch
                from chronos import ChronosPipeline

                pipeline = ChronosPipeline.from_pretrained(
                    FORECAST_MODEL_ID,
                    device_map="cpu",
                    torch_dtype=torch.float32,
                )
                _CHRONOS_COMPONENTS = (pipeline, torch)
    return _CHRONOS_COMPONENTS


def _validated_daily_series(rows: list[dict[str, Any]]) -> tuple[list[tuple[str, str, list[tuple[date, float]]]], list[str]]:
    grouped: dict[tuple[str, str], list[tuple[date, float]]] = defaultdict(list)
    for row in rows:
        observed = row.get("observation_date")
        if observed is None:
            continue
        try:
            observed_date = date.fromisoformat(str(observed))
        except ValueError:
            continue
        demand = row.get("daily_demand")
        if demand is None or not math.isfinite(float(demand)) or float(demand) < 0:
            continue
        grouped[(str(row.get("warehouse_id", "")), str(row.get("product_id", "")))].append(
            (observed_date, float(demand))
        )

    valid = []
    skipped = []
    if not grouped:
        skipped.append("WMS history needs observation_date, warehouse_id, product_id, and daily_demand on each observation.")
    for (warehouse_id, product_id), points in grouped.items():
        points.sort(key=lambda point: point[0])
        dates = [point[0] for point in points]
        if len(set(dates)) != len(dates):
            skipped.append(f"Warehouse {warehouse_id}, product {product_id}: duplicate daily observations.")
            continue
        if len(points) < FORECAST_MIN_DAILY_OBSERVATIONS:
            skipped.append(
                f"Warehouse {warehouse_id}, product {product_id}: {len(points)} observations; at least {FORECAST_MIN_DAILY_OBSERVATIONS} are required."
            )
            continue
        if any(right - left != timedelta(days=1) for left, right in zip(dates, dates[1:])):
            skipped.append(f"Warehouse {warehouse_id}, product {product_id}: daily history contains missing dates.")
            continue
        valid.append((warehouse_id, product_id, points[-FORECAST_MAX_CONTEXT_DAYS:]))
    return valid, skipped


def _run_demand_forecasts(datasets: dict[str, Any]) -> dict[str, Any]:
    rows = datasets.get("wms", {}).get("rows", [])
    series, skipped = _validated_daily_series(rows)
    if not series:
        return _status(
            "skipped_insufficient_data",
            "Chronos forecasting was skipped because no WMS series has at least 30 consecutive daily demand observations.",
            forecasts=[],
            skipped_series=skipped,
            frequency="daily",
            horizon_days=FORECAST_HORIZON_DAYS,
            provenance={"model_id": FORECAST_MODEL_ID},
        )

    pipeline, torch = _get_chronos_components()
    forecasts = []
    for warehouse_id, product_id, points in series:
        context = torch.tensor([value for _, value in points], dtype=torch.float32)
        sampled_forecasts = pipeline.predict(
            context,
            prediction_length=FORECAST_HORIZON_DAYS,
        )
        quantiles = torch.quantile(
            sampled_forecasts[0],
            torch.tensor([0.1, 0.5, 0.9], dtype=torch.float32),
            dim=0,
        ).tolist()
        start_date = points[-1][0] + timedelta(days=1)
        forecasts.append({
            "warehouse_id": warehouse_id,
            "product_id": product_id,
            "frequency": "daily",
            "history_observations": len(points),
            "forecast": [
                {
                    "date": (start_date + timedelta(days=offset)).isoformat(),
                    "lower_80": float(quantiles[0][offset]),
                    "median": float(quantiles[1][offset]),
                    "upper_80": float(quantiles[2][offset]),
                }
                for offset in range(FORECAST_HORIZON_DAYS)
            ],
        })
    return _status(
        "completed",
        "Daily demand forecasts are estimates with model-generated 80% prediction intervals, not guarantees.",
        forecasts=forecasts,
        skipped_series=skipped,
        frequency="daily",
        horizon_days=FORECAST_HORIZON_DAYS,
        provenance={
            "model_id": FORECAST_MODEL_ID,
            "model_size": "T5 tiny",
            "forecast_type": "zero-shot probabilistic",
        },
    )


def _load_ml_module(module_name: str, file_path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load ML-lab module {file_path.name}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _get_recommender() -> Callable[..., list[dict[str, Any]]]:
    global _RECOMMENDER
    if _RECOMMENDER is None:
        with _DYNAMIC_MODULE_LOCK:
            if _RECOMMENDER is None:
                predictor_path = ML_LAB_SRC / "predict.py"
                recommender_path = ML_LAB_SRC / "recommend_supplier.py"
                previous = sys.modules.get("predict")
                predictor_module = previous or _load_ml_module(
                    "_synchain_ml_predict", predictor_path
                )
                sys.modules["predict"] = predictor_module
                try:
                    recommender = _load_ml_module(
                        "_synchain_uploaded_supplier_recommender",
                        recommender_path,
                    )
                finally:
                    if previous is None:
                        sys.modules.pop("predict", None)
                    else:
                        sys.modules["predict"] = previous
                _RECOMMENDER = recommender.recommend_suppliers
    return _RECOMMENDER


def _supplier_recommendations(datasets: dict[str, Any]) -> dict[str, Any]:
    rows = datasets.get("erp", {}).get("rows", [])
    if not rows:
        return _status(
            "skipped_insufficient_data",
            "No ERP supplier records are available for recommendations.",
            recommendations=[],
            missing_fields=list(SUPPLIER_PROFILE_FIELDS),
        )

    profiles = []
    missing_profiles: set[str] = set()
    by_supplier: dict[str, dict[str, Any]] = {}
    for row in rows:
        missing_profiles.update(
            field for field in SUPPLIER_PROFILE_FIELDS if row.get(field) is None
        )
        if any(row.get(field) is None for field in SUPPLIER_PROFILE_FIELDS):
            continue
        supplier_id = str(row["supplier_id"])
        profile = {field: row[field] for field in SUPPLIER_PROFILE_FIELDS}
        existing = by_supplier.get(supplier_id)
        if existing is not None and existing != profile:
            return _status(
                "skipped_insufficient_data",
                "Repeated ERP rows contain conflicting supplier profiles; recommendations were skipped.",
                recommendations=[],
                missing_fields=[],
            )
        if existing is None:
            by_supplier[supplier_id] = profile
            profiles.append(profile)

    shipment_fields = (
        "component_type",
        "transport_mode",
        "weather_condition",
        "seasonal_rainy_period",
        "traffic_level",
        "order_quantity",
        "inventory_at_order",
        "planned_lead_time_days",
        "unit_cost",
    )
    shipment = next(
        (
            row for row in rows
            if all(row.get(field) is not None for field in shipment_fields)
        ),
        None,
    )
    if not profiles or shipment is None:
        missing = sorted(missing_profiles)
        if shipment is None:
            missing.extend(
                field for field in shipment_fields
                if not any(row.get(field) is not None for row in rows)
            )
        return _status(
            "skipped_insufficient_data",
            "Recommendations require explicit compatible supplier profiles, capacity and active status, plus a complete shipment scenario.",
            recommendations=[],
            missing_fields=sorted(set(missing)),
        )

    model = _get_delay_model()
    recommendations = _get_recommender()(
        {field: shipment[field] for field in DELAY_FEATURES if field in shipment},
        max_results=5,
        supplier_records=profiles,
        predictor=lambda candidate: _predict_delay(model, candidate),
    )
    return _status(
        "completed",
        "Recommendations use only the uploaded supplier profiles and explicit shipment scenario; no supplier change is authorized.",
        recommendations=recommendations,
        ranking_factors={
            "estimated_delay_probability": 0.40,
            "average_lead_time_days": 0.25,
            "quality_rate": 0.20,
            "unit_cost_index": 0.15,
        },
        provenance={"supplier_source": "uploaded_user_data"},
    )


def _get_scenario_simulator() -> Callable[..., dict[str, Any]]:
    global _SCENARIO_SIMULATOR
    if _SCENARIO_SIMULATOR is None:
        with _DYNAMIC_MODULE_LOCK:
            if _SCENARIO_SIMULATOR is None:
                module = _load_ml_module(
                    "_synchain_explicit_scenario_simulation",
                    ML_LAB_SRC / "simulation.py",
                )
                _SCENARIO_SIMULATOR = module.run_explicit_scenario_simulation
    return _SCENARIO_SIMULATOR


def _as_integer(value: Any, field: str) -> int:
    number = float(value)
    if not math.isfinite(number) or not number.is_integer():
        raise ValueError(f"{field} must be a finite whole number.")
    return int(number)


def _run_scenario_simulation(datasets: dict[str, Any]) -> dict[str, Any]:
    rows = datasets.get("wms", {}).get("rows", [])
    fields = (
        "current_stock",
        "daily_demand",
        "scenario_horizon_days",
        "simulation_shipment_quantity",
        "baseline_lead_time_days",
        "mitigated_lead_time_days",
    )
    scenario = next(
        (row for row in rows if all(row.get(field) is not None for field in fields)),
        None,
    )
    if scenario is None:
        missing = sorted(
            field for field in fields
            if not any(row.get(field) is not None for row in rows)
        )
        return _status(
            "skipped_insufficient_data",
            "Simulation requires explicit inventory, demand, horizon, shipment quantity, baseline lead time, and mitigation lead-time assumptions in a WMS row.",
            scenarios={},
            missing_fields=missing,
        )
    inputs = {
        "initial_inventory": _as_integer(scenario["current_stock"], "current_stock"),
        "daily_demand": _as_integer(scenario["daily_demand"], "daily_demand"),
        "simulation_days": _as_integer(scenario["scenario_horizon_days"], "scenario_horizon_days"),
        "shipment_quantity": _as_integer(scenario["simulation_shipment_quantity"], "simulation_shipment_quantity"),
        "baseline_lead_time_days": _as_integer(scenario["baseline_lead_time_days"], "baseline_lead_time_days"),
        "mitigated_lead_time_days": _as_integer(scenario["mitigated_lead_time_days"], "mitigated_lead_time_days"),
    }
    result = _get_scenario_simulator()(**inputs)
    return _status("completed", "Simulation completed from explicit uploaded scenario inputs.", **result)


def run_ml_analysis(datasets: dict[str, Any]) -> dict[str, Any]:
    """Run each optional component independently so one failure cannot hide other results."""
    runners = {
        "shipment_delay": _run_delay_predictions,
        "text_risk": _run_text_risk,
        "demand_forecast": _run_demand_forecasts,
        "supplier_recommendations": _supplier_recommendations,
        "simulation": _run_scenario_simulation,
    }
    results = {}
    for name, runner in runners.items():
        try:
            results[name] = runner(datasets)
        except ModuleNotFoundError as exc:
            logger.exception("Optional ML component %s is unavailable", name)
            results[name] = _status(
                "unavailable",
                f"Optional dependency '{exc.name}' is not installed for this component.",
            )
        except FileNotFoundError as exc:
            logger.exception("Optional ML component %s is unavailable", name)
            results[name] = _status("unavailable", str(exc))
        except Exception as exc:
            logger.exception("Optional ML component %s failed", name)
            results[name] = _status(
                "failed",
                f"{name.replace('_', ' ').capitalize()} inference failed: {exc}",
            )
    return results
