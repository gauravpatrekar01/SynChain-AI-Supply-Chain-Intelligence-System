"""Read models derived exclusively from canonical persisted entities."""
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from statistics import mean
from sqlalchemy import func
from fastapi import HTTPException
from app.models.postgres.models import Product, Supplier, Warehouse, Inventory, Order, OrderItem, DemandForecast, DataImport, ImportedRecord, ModelRun
from app.models.postgres.observations import DemandObservation, LeadTimeObservation
from app.services.inventory_metrics import inventory_metrics
from app.ingestion.service import fingerprint


def snapshot(db):
    products = {p.id: p for p in db.query(Product).all()}
    warehouses = {w.id: w for w in db.query(Warehouse).all()}
    inventories = db.query(Inventory).all()
    metrics = inventory_metrics(db, inventories)
    inventory = []
    for inv in inventories:
        p, w = products[inv.product_id], warehouses[inv.warehouse_id]
        inventory.append({"id": str(inv.id), "sku": p.sku, "name": p.name, "category": p.category, "facility": w.name, "onHandUnits": inv.stock_quantity, "reservedUnits": inv.reserved_quantity, "incomingUnits": inv.incoming_quantity, "unitPrice": float(p.price), "supplier_id": str(inv.supplier_id) if inv.supplier_id else None, "service_level": float(inv.service_level) if inv.service_level else None, "review_days": inv.review_days, **metrics[inv.id]})
    suppliers = [{"id": str(s.id), "name": s.name, "tier": s.tier, "category": s.category, "country": s.country, "reliabilityScore": float(s.reliability_score), "spendAnnualUsd": float(s.spend_annual_usd), "healthStatus": s.health_status, "singleSourceRisk": s.single_source_risk} for s in db.query(Supplier).all()]
    forecast = []
    grouped = defaultdict(list)
    for f in db.query(DemandForecast).order_by(DemandForecast.forecast_date).all():
        grouped[f.forecast_date].append(f)
    for day, rows in grouped.items():
        forecast.append({"date": day.isoformat(), "predictedDemandUnits": float(sum(r.predicted_demand for r in rows)), "confidenceLower": float(sum(r.confidence_lower for r in rows)), "confidenceUpper": float(sum(r.confidence_upper for r in rows)), "historicalBaseline": None})
    orders = [{"id": str(o.id), "external_id": o.external_id, "status": o.order_status, "order_date": o.order_date.isoformat(), "shipping_date": o.shipping_date.isoformat() if o.shipping_date else None, "shipping_mode": o.shipping_mode} for o in db.query(Order).order_by(Order.order_date.desc()).all()]
    history = [{"sku": products[d.product_id].sku, "warehouse": warehouses[d.warehouse_id].name, "date": d.observation_date.isoformat(), "quantity": d.quantity} for d in db.query(DemandObservation).order_by(DemandObservation.observation_date).all()]
    topology_nodes = [{"id": str(s["id"]), "label": s["name"], "type": "supplier_t1" if s["tier"] == "Tier-1" else "supplier_t2", "country": s["country"], "status": s["healthStatus"], "riskScore": None, "failureProb": None, "capacityUtilization": None, "currentOrdersCount": None, "leadTimeDays": None, "primaryProduct": s["category"], "upstreamIds": [], "downstreamIds": []} for s in suppliers]
    topology_nodes += [{"id": str(w.id), "label": w.name, "type": "warehouse", "country": w.country, "status": "unknown", "riskScore": None, "failureProb": None, "capacityUtilization": None, "currentOrdersCount": None, "leadTimeDays": None, "primaryProduct": "", "upstreamIds": [], "downstreamIds": []} for w in warehouses.values()]
    edges = []
    seen_routes = set()
    for inv in inventories:
        if inv.supplier_id and (inv.supplier_id, inv.warehouse_id) not in seen_routes:
            seen_routes.add((inv.supplier_id, inv.warehouse_id))
            edges.append({"id": str(inv.supplier_id)+":"+str(inv.warehouse_id), "source": str(inv.supplier_id), "target": str(inv.warehouse_id), "animated": False, "status": "unknown", "flowRateUnits": None, "activeCargoValueUsd": None, "transitHours": None, "transportMode": "Not provided"})
    for node in topology_nodes:
        node["upstreamIds"] = [e["source"] for e in edges if e["target"] == node["id"]]
        node["downstreamIds"] = [e["target"] for e in edges if e["source"] == node["id"]]
    return {"digitalTwinNodes": topology_nodes, "digitalTwinEdges": edges, "inventory": inventory, "suppliers": suppliers, "demandForecast": forecast, "demandHistory": history, "orders": orders, "products": [{"id": str(p.id), "sku": p.sku, "name": p.name, "price": float(p.price)} for p in products.values()], "warehouses": [{"id": str(w.id), "name": w.name, "country": w.country, "latitude": float(w.latitude) if w.latitude is not None else None, "longitude": float(w.longitude) if w.longitude is not None else None} for w in warehouses.values()], "forecast_status": "ready" if forecast else "No current forecast. Import at least 30 consecutive daily observations per warehouse and generate a forecast.", "updated_at": datetime.now(timezone.utc).isoformat()}


def risks(db):
    result = []
    for inv in snapshot(db)["inventory"]:
        if inv["status"] != "ready" or inv["inventory_position"] > inv["reorder_point"]:
            continue
        probability = inv["stockout_risk"]
        result.append({"id": "risk-"+inv["id"], "entityType": "inventory", "entityId": inv["id"], "entityName": inv["name"]+" / "+inv["facility"], "riskScore": round(100*probability), "severity": "CRITICAL" if inv["available_quantity"] <= inv["safety_stock"] else "HIGH", "category": "Replenishment threshold", "explanation": f"Available {inv['available_quantity']}; position {inv['inventory_position']}; reorder point {inv['reorder_point']}. Normal approximation from observed daily demand and lead times.", "contributingFactors": [{"feature": "average_daily_demand", "value": inv["average_daily_demand"]}, {"feature": "lead_time_days", "value": inv["lead_time_days"]}], "confidenceScore": None, "createdAt": datetime.now(timezone.utc).isoformat()})
    return result


def recommendations(db):
    return [{"id": "rec-"+i["id"], "action": f"Review replenishment of {i['replenishment_quantity']} units of {i['sku']}", "reason": f"Inventory position {i['inventory_position']} is at/below reorder point {i['reorder_point']} at {i['facility']}.", "expectedBenefit": "Restore the configured replenishment target; purchasing approval is still required.", "estimatedCost": round(i["replenishment_quantity"]*i["unitPrice"], 2), "confidence": None, "affectedEntities": [i["name"], i["facility"]], "createdAt": datetime.now(timezone.utc).isoformat()} for i in snapshot(db)["inventory"] if i["status"] == "ready" and i["replenishment_quantity"] > 0]


def forecast_product(db, sku, horizon=30):
    from app.ingestion.persistence import lock_writes, one
    from app.services.forecasting.prophet_forecast import ForecastingService
    from app.services.intelligence.ml_analysis import _validated_daily_series
    lock_writes(db)
    product = one(db, Product, sku=sku)
    if not product:
        raise HTTPException(404, "Unknown product SKU")
    observed = db.query(DemandObservation).filter_by(product_id=product.id).all()
    rows = [{"warehouse_id": str(d.warehouse_id), "product_id": sku, "observation_date": d.observation_date.isoformat(), "daily_demand": d.quantity} for d in observed]
    series, skipped = _validated_daily_series(rows)
    if not series or skipped:
        raise HTTPException(422, {"status": "insufficient_data", "message": "Every warehouse series needs at least 30 consecutive daily observations", "details": skipped})
    date_sets = [set(d for d, q in points) for w, p, points in series]
    if any(dates != date_sets[0] for dates in date_sets):
        raise HTTPException(422, "Warehouse histories must cover the same dates before product aggregation")
    latest = max(date_sets[0])
    if latest < datetime.now(timezone.utc).date() - timedelta(days=1):
        raise HTTPException(422, "History is stale; import demand through yesterday before forecasting")
    daily = defaultdict(int)
    for w, p, points in series:
        for day, quantity in points:
            daily[day.isoformat()] += quantity
    version = fingerprint(sorted(rows, key=lambda r: (r["warehouse_id"], r["observation_date"])))
    run = ModelRun(model_name="Prophet", run_type="forecast", started_at=datetime.now(timezone.utc), metrics={"dataset_version": version, "sku": sku, "history_through": latest.isoformat()})
    result = ForecastingService().generate_demand_forecast([{"date": d, "demand": q} for d, q in sorted(daily.items())], horizon)
    db.query(DemandForecast).filter_by(product_id=product.id).delete(synchronize_session=False)
    for point in result["forecast"]:
        db.add(DemandForecast(product_id=product.id, forecast_date=datetime.fromisoformat(point["date"]).date(), predicted_demand=max(0, point["predicted_demand"]), confidence_lower=max(0, point["confidence_lower"]), confidence_upper=max(0, point["confidence_upper"]), historical_baseline=mean(daily.values()), model_version=result["model_version"]+":"+version[:16]))
    run.completed_at = datetime.now(timezone.utc)
    db.add(run)
    db.commit()
    return {"status": "completed", "dataset_version": version, "history_through": latest.isoformat(), "forecast": result["forecast"]}


def simulate(db, inventory_id, days, demand_change_pct):
    inv = next((i for i in snapshot(db)["inventory"] if i["id"] == str(inventory_id)), None)
    if inv is None:
        raise HTTPException(404, "Unknown inventory route")
    if inv["status"] != "ready":
        raise HTTPException(422, inv["reason"])
    demand = inv["average_daily_demand"] * (1 + demand_change_pct / 100)
    # Deterministic demand stress projection, explicitly no invented arrival schedule.
    projected = [{"day": day, "projected_stock": max(0, inv["available_quantity"] - demand * day), "unmet_demand": max(0, demand * day - inv["available_quantity"])} for day in range(1, days+1)]
    return {"status": "completed", "inventory_id": inventory_id, "sku": inv["sku"], "assumptions": ["Constant daily demand adjusted by the requested percentage", "No incoming receipts scheduled; outstanding quantities have no arrival dates", "No cascade, revenue-loss or mitigation-savings estimates without supporting data"], "baseline": inv, "daily_results": projected, "generated_at": datetime.now(timezone.utc).isoformat()}
