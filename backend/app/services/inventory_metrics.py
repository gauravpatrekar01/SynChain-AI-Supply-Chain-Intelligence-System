"""Inventory calculations from daily observations and explicit replenishment policies."""
import math
from statistics import mean, variance, NormalDist
from datetime import timedelta
from app.models.postgres.models import Inventory, DemandForecast, RiskPrediction, RiskFactor, Recommendation
from app.models.postgres.observations import DemandObservation, LeadTimeObservation

MIN_DEMAND_DAYS = 30

def calculate_buffer(inv, demand, leads):
    result = {"status": "insufficient_data", "reason": None, "available_quantity": None, "inventory_position": None, "average_daily_demand": None, "demand_stddev": None, "lead_time_days": None, "lead_time_stddev": None, "safety_stock": None, "reorder_point": None, "replenishment_quantity": None, "stockout_risk": None, "days_of_supply": None, "max_stock": None, "observations": len(demand)}
    if inv.reserved_quantity is not None:
        result["available_quantity"] = inv.stock_quantity - inv.reserved_quantity
        if inv.incoming_quantity is not None:
            result["inventory_position"] = result["available_quantity"] + inv.incoming_quantity
    if inv.supplier_id is None or inv.service_level is None or inv.review_days is None:
        result["reason"] = "Import a buffer policy (supplier, service level and review days)."
        return result
    if result["inventory_position"] is None:
        result["reason"] = "Reserved and outstanding incoming quantities must be supplied explicitly."
        return result
    demand = sorted(demand, key=lambda d: d.observation_date)[-180:]
    if len(demand) < MIN_DEMAND_DAYS or any(b.observation_date - a.observation_date != timedelta(days=1) for a, b in zip(demand, demand[1:])):
        result["reason"] = "At least 30 consecutive daily demand observations are required; missing days are unknown."
        return result
    if len(leads) < 2:
        result["reason"] = "At least two completed lead-time observations for this supplier/product/warehouse are required."
        return result
    quantities = [d.quantity for d in demand]
    durations = [(l.actual_delivery-l.order_date).days for l in leads]
    avg, var_d = mean(quantities), variance(quantities)
    lead, var_l = mean(durations), variance(durations)
    sigma = math.sqrt(lead * var_d + avg * avg * var_l)
    safety = math.ceil(NormalDist().inv_cdf(float(inv.service_level)) * sigma)
    reorder = math.ceil(avg * lead + safety)
    maximum = math.ceil(avg * (lead + inv.review_days) + safety)
    # Shortage probability before next receipt, based on available stock alone.
    available = result["available_quantity"]
    risk = 1 - NormalDist(avg * lead, sigma).cdf(available) if sigma > 0 else float(available < avg * lead)
    result.update(status="ready", reason="Independent daily demand and lead time; normal approximation; cycle service level.", average_daily_demand=avg, demand_stddev=math.sqrt(var_d), lead_time_days=lead, lead_time_stddev=math.sqrt(var_l), safety_stock=safety, reorder_point=reorder, replenishment_quantity=max(0, maximum-result["inventory_position"]) if result["inventory_position"] <= reorder else 0, stockout_risk=risk, days_of_supply=available/avg if avg else None, max_stock=maximum)
    return result

def inventory_metrics(db, inventories=None):
    inventories = inventories if inventories is not None else db.query(Inventory).all()
    demand_by_route, leads_by_route = {}, {}
    for d in db.query(DemandObservation).all():
        demand_by_route.setdefault((d.product_id, d.warehouse_id), []).append(d)
    for lead in db.query(LeadTimeObservation).all():
        leads_by_route.setdefault((lead.product_id, lead.warehouse_id, lead.supplier_id), []).append(lead)
    return {inv.id: calculate_buffer(inv, demand_by_route.get((inv.product_id, inv.warehouse_id), []), leads_by_route.get((inv.product_id, inv.warehouse_id, inv.supplier_id), [])) for inv in inventories}

def recalculate(db, product_ids, invalidate_forecasts=False):
    db.flush()
    rows = db.query(Inventory).filter(Inventory.product_id.in_(product_ids)).all()
    metrics = inventory_metrics(db, rows)
    for inv in rows:
        m = metrics[inv.id]
        inv.safety_stock_level = m["safety_stock"]
        inv.reorder_level = m["reorder_point"]
        inv.reorder_quantity = m["replenishment_quantity"]
    if invalidate_forecasts:
        db.query(DemandForecast).filter(DemandForecast.product_id.in_(product_ids)).delete(synchronize_session=False)
    # Never present earlier model outputs as newly computed from changed inputs.
    entity_ids = set(product_ids) | {i.id for i in rows}
    predictions = db.query(RiskPrediction).filter(RiskPrediction.entity_id.in_(entity_ids)).all()
    for prediction in predictions:
        db.query(Recommendation).filter_by(risk_prediction_id=prediction.id).delete(synchronize_session=False)
        db.query(RiskFactor).filter_by(risk_prediction_id=prediction.id).delete(synchronize_session=False)
        db.delete(prediction)


def invalidate_supplier_predictions(db, supplier_ids):
    for prediction in db.query(RiskPrediction).filter(RiskPrediction.entity_type == "supplier", RiskPrediction.entity_id.in_(supplier_ids)).all():
        db.query(Recommendation).filter_by(risk_prediction_id=prediction.id).delete(synchronize_session=False)
        db.query(RiskFactor).filter_by(risk_prediction_id=prediction.id).delete(synchronize_session=False)
        db.delete(prediction)
