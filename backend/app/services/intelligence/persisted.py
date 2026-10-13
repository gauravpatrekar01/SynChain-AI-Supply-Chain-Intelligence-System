"""Adapt authoritative observations to the existing ML preprocessing contract."""
from datetime import datetime, timezone
from app.ingestion.service import fingerprint
from app.models.postgres.models import ExternalData, Inventory, Product, Warehouse, Supplier
from app.models.postgres.observations import DemandObservation, LeadTimeObservation
from .ml_analysis import run_ml_analysis


def datasets(db):
    demand = db.query(DemandObservation).order_by(DemandObservation.product_id, DemandObservation.warehouse_id, DemandObservation.observation_date).all()
    wms = [{"warehouse_id": str(d.warehouse_id), "product_id": str(d.product_id), "observation_date": d.observation_date.isoformat(), "daily_demand": d.quantity} for d in demand]
    # Lead times alone cannot populate the delay model's trained feature vector.
    erp = [dict(record.payload) for record in db.query(ExternalData).filter_by(data_type="delay_observation").order_by(ExternalData.source_name).all()]
    result = {}
    if wms: result["wms"] = {"rows": wms, "status": "ready"}
    if erp: result["erp"] = {"rows": erp, "status": "ready"}
    return result


def version(db, data):
    # Also invalidate recommendation/risk analyses on any canonical entity change.
    from app.services.operations import snapshot
    source = snapshot(db)
    source.pop("updated_at", None)
    return fingerprint([data, source])


def analyze(db, user_id):
    data = datasets(db)
    dataset_version = version(db, data)
    ml = run_ml_analysis(data)
    result = {"analysis_status": "ready" if data else "not_ready", "available_datasets": list(data), "summary": {"total_risks": 0, "dataset_quality": "validated canonical inputs", "dataset_count": len(data)}, "risks": [], "recommendations": [], "limitations": ["Only persisted canonical fields are passed to existing model preprocessing.", "The delay artifact was trained on synthetic development data and is not production validated.", "Lead-time history alone is insufficient for the 15-feature delay model; import delay features separately."], "ml_analysis": ml, "generated_at": datetime.now(timezone.utc).isoformat(), "dataset_version": dataset_version}
    # A parallel import during inference makes this result stale immediately.
    db.expire_all()
    if version(db, datasets(db)) != dataset_version:
        result["analysis_status"] = "not_ready"
        result["message"] = "Source data changed during analysis. Run analysis again."
        result["ml_analysis"] = {}
        return result
    db.add(ExternalData(source_name=str(user_id), data_type="canonical_analysis", payload=result))
    db.commit()
    return result


def latest(db, user_id):
    record = db.query(ExternalData).filter_by(source_name=str(user_id), data_type="canonical_analysis").order_by(ExternalData.retrieved_at.desc()).first()
    current = version(db, datasets(db))
    if record and record.payload.get("dataset_version") == current:
        return record.payload
    return {"analysis_status": "not_ready", "available_datasets": list(datasets(db)), "summary": {"total_risks": 0, "dataset_quality": "not_analyzed"}, "risks": [], "recommendations": [], "limitations": ["Run analysis on the current persisted data. Previous predictions are invalid after relevant source changes."], "message": "No current analysis for this dataset version.", "dataset_version": current}
