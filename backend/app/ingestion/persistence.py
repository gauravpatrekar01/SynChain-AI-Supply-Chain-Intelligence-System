"""Canonical row resolution and persistence, shared with integration normalization."""
from datetime import date, datetime, timezone
from sqlalchemy import text
from app.models.postgres.models import Product, Supplier, Warehouse, Inventory, Order, OrderItem, ExternalData, ImportedRecord
from app.models.postgres.observations import DemandObservation, LeadTimeObservation


def lock_writes(db):
    # All canonical file/API writers use the same transaction-scoped lock.
    db.execute(text("SELECT pg_advisory_xact_lock(739214620)"))


def one(db, model, **key):
    cached = db.info.get("import_lookup", {}).get(model)
    if cached is not None:
        columns = tuple(key)
        indices = db.info.setdefault("import_indices", {})
        cache_key = (model, columns)
        if cache_key not in indices:
            index = {}
            for obj in cached:
                index.setdefault(tuple(getattr(obj, c) for c in columns), []).append(obj)
            indices[cache_key] = index
        rows = indices[cache_key].get(tuple(key.values()), [])
    else:
        rows = db.query(model).filter_by(**key).limit(2).all()
    if len(rows) > 1:
        raise ValueError(f"Ambiguous existing {model.__tablename__} business key; reconcile duplicates first")
    return rows[0] if rows else None


def reference(db, model, field, value):
    obj = one(db, model, **{field: value})
    if obj is None:
        raise ValueError(f"Unknown {model.__tablename__} {field}: {value}; import master data first")
    return obj.id


def resolve(db, dataset, row, user_id):
    """Return target, model and exact values. No mutations during preview."""
    if dataset == "delay_features":
        key = "shipment:" + row["shipment_id"]
        values = dict(row)
        for field in ("supplier_on_time_rate", "supplier_quality_rate", "supplier_capacity_utilization"):
            if not 0 <= float(values[field]) <= 1:
                raise ValueError(f"{field} must be a fraction between 0 and 1")
        for field in ("distance_km", "supplier_on_time_rate", "supplier_quality_rate", "supplier_capacity_utilization", "planned_lead_time_days", "unit_cost"):
            values[field] = float(values[field])
        return one(db, ExternalData, source_name=key, data_type="delay_observation"), ExternalData, dict(source_name=key, data_type="delay_observation", payload=values)
    if dataset == "products":
        return one(db, Product, sku=row["product_id"]), Product, dict(sku=row["product_id"], name=row["product_name"], category=row["category"], price=row["unit_price"])
    if dataset == "suppliers":
        values = {k: v for k, v in row.items() if k != "supplier"}
        return one(db, Supplier, name=row["supplier"]), Supplier, dict(name=row["supplier"], **values)
    if dataset == "warehouses":
        return one(db, Warehouse, name=row["source_location"]), Warehouse, dict(name=row["source_location"], location=row["location"], country=row["country"], capacity_units=row["capacity_units"], latitude=row.get("latitude"), longitude=row.get("longitude"))
    product_id = reference(db, Product, "sku", row["product_id"])
    if dataset == "orders":
        order = one(db, Order, external_id=row["order_id"])
        target = one(db, OrderItem, order_id=order.id, product_id=product_id) if order else None
        if order and order.user_id != user_id:
            raise ValueError("Order belongs to another user or ERP source; manual reconciliation required")
        return target, OrderItem, dict(product_id=product_id, quantity=row["quantity"], unit_price=row["unit_price"])
    warehouse_id = reference(db, Warehouse, "name", row["source_location"])
    route = dict(product_id=product_id, warehouse_id=warehouse_id)
    if dataset == "inventory":
        if row["reserved_quantity"] > row["quantity"]:
            raise ValueError("Reserved quantity exceeds on-hand quantity")
        return one(db, Inventory, **route), Inventory, dict(**route, stock_quantity=row["quantity"], reserved_quantity=row["reserved_quantity"], incoming_quantity=row["incoming_quantity"])
    if dataset == "demand":
        key = dict(**route, observation_date=date.fromisoformat(row["observation_date"]))
        if key["observation_date"] > datetime.now(timezone.utc).date():
            raise ValueError("Historical observations cannot be in the future")
        return one(db, DemandObservation, **key), DemandObservation, dict(**key, quantity=row["quantity"])
    supplier_id = reference(db, Supplier, "name", row["supplier"])
    if dataset == "buffers":
        target = one(db, Inventory, **route)
        if not target:
            raise ValueError("Import inventory for this product and warehouse before setting a buffer policy")
        return target, Inventory, dict(supplier_id=supplier_id, service_level=row["service_level"], review_days=row["review_days"])
    values = dict(**route, supplier_id=supplier_id, receipt_id=row["receipt_id"], order_date=date.fromisoformat(row["order_date"]), actual_delivery=date.fromisoformat(row["actual_delivery"]), expected_delivery=date.fromisoformat(row["expected_delivery"]) if row.get("expected_delivery") else None)
    if values["actual_delivery"] < values["order_date"] or values["actual_delivery"] > datetime.now(timezone.utc).date():
        raise ValueError("Receipt date must be on/after order date and not in the future")
    if values["expected_delivery"] and values["expected_delivery"] < values["order_date"]:
        raise ValueError("Expected delivery must be on/after order date")
    return one(db, LeadTimeObservation, receipt_id=row["receipt_id"]), LeadTimeObservation, values


def persist(db, dataset, row, user_id, target, model, values):
    if dataset == "orders":
        order = one(db, Order, external_id=row["order_id"])
        if not order:
            order = Order(external_id=row["order_id"], user_id=user_id)
            db.add(order)
        order.order_date = datetime.fromisoformat(row["order_date"]).replace(tzinfo=timezone.utc)
        order.order_status = row["status"]
        order.shipping_date = datetime.fromisoformat(row["shipping_date"]).replace(tzinfo=timezone.utc) if row.get("shipping_date") else None
        order.shipping_mode = row.get("shipping_mode")
        db.flush()
        values["order_id"] = order.id
    if target is None:
        target = model(**values)
        db.add(target)
    else:
        for field, value in values.items():
            setattr(target, field, value)
    db.flush()
    return target


def preload(db, dataset, raw_rows, mapping):
    """Bound lookups to keys present in this file instead of issuing N queries per row."""
    sources = {target: source for source, target in mapping.items() if target}
    def values(field):
        return {str(r[sources[field]]).strip() for r in raw_rows if field in sources and r.get(sources[field]) is not None}
    cache = {}
    cache[Product] = db.query(Product).filter(Product.sku.in_(values("product_id"))).all()
    cache[Warehouse] = db.query(Warehouse).filter(Warehouse.name.in_(values("source_location"))).all()
    cache[Supplier] = db.query(Supplier).filter(Supplier.name.in_(values("supplier"))).all()
    product_ids = [p.id for p in cache[Product]]
    warehouse_ids = [w.id for w in cache[Warehouse]]
    if dataset in ("inventory", "buffers"):
        cache[Inventory] = db.query(Inventory).filter(Inventory.product_id.in_(product_ids), Inventory.warehouse_id.in_(warehouse_ids)).all()
    if dataset == "demand":
        dates = []
        for value in values("observation_date"):
            try: dates.append(date.fromisoformat(value[:10]))
            except ValueError: pass
        cache[DemandObservation] = db.query(DemandObservation).filter(DemandObservation.product_id.in_(product_ids), DemandObservation.warehouse_id.in_(warehouse_ids), DemandObservation.observation_date.in_(dates)).all()
    if dataset == "lead_times":
        cache[LeadTimeObservation] = db.query(LeadTimeObservation).filter(LeadTimeObservation.receipt_id.in_(values("receipt_id"))).all()
    if dataset == "orders":
        cache[Order] = db.query(Order).filter(Order.external_id.in_(values("order_id"))).all()
        cache[OrderItem] = db.query(OrderItem).filter(OrderItem.order_id.in_([o.id for o in cache[Order]]), OrderItem.product_id.in_(product_ids)).all()
    if dataset == "delay_features":
        cache[ExternalData] = db.query(ExternalData).filter(ExternalData.data_type == "delay_observation", ExternalData.source_name.in_(["shipment:"+v for v in values("shipment_id")])).all()
    ids = [obj.id for objects in cache.values() for obj in objects]
    provenance = {}
    for record in db.query(ImportedRecord).filter(ImportedRecord.target_entity_id.in_(ids), ImportedRecord.status == "imported").order_by(ImportedRecord.created_at.desc()).all():
        provenance.setdefault(record.target_entity_id, record.source_type)
    db.info["import_provenance"] = provenance
    db.info["import_lookup"] = cache
    db.info["import_indices"] = {}


def clear_lookup(db):
    db.info.pop("import_lookup", None)
    db.info.pop("import_indices", None)
    db.info.pop("import_provenance", None)
