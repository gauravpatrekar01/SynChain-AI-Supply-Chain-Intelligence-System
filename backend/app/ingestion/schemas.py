"""Explicit dataset contracts; exact legacy business keys, never guessed references."""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from datetime import date, datetime
import re

@dataclass(frozen=True)
class Field:
    kind: str = "text"
    required: bool = True
    aliases: tuple = ()
    maximum: int = 255

T = Field
SKU = T(aliases=("sku", "item_code"), maximum=100)
WH = T(aliases=("warehouse", "warehouse_name"))
SUP = T(aliases=("vendor", "supplier_name"))
QTY = T("integer", aliases=("qty", "stock_quantity", "on_hand", "actual_qty"))
SCHEMAS = {
    "products": {"product_id": SKU, "product_name": T(aliases=("name", "item_name")), "category": T(aliases=("item_group",)), "unit_price": T("decimal", aliases=("price", "standard_rate"))},
    "warehouses": {"source_location": WH, "location": T(aliases=("address",)), "country": T(maximum=100), "capacity_units": T("integer"), "latitude": T("latitude", required=False), "longitude": T("longitude", required=False)},
    "suppliers": {"supplier": SUP, "tier": T(maximum=50), "category": T(), "country": T(maximum=100), "reliability_score": T("percent"), "spend_annual_usd": T("decimal"), "health_status": T(maximum=50), "single_source_risk": T("boolean")},
    "inventory": {"product_id": SKU, "source_location": WH, "quantity": QTY, "reserved_quantity": T("integer"), "incoming_quantity": T("integer", aliases=("outstanding_quantity",))},
    "demand": {"product_id": SKU, "source_location": WH, "observation_date": T("date", aliases=("date",)), "quantity": T("integer", aliases=("demand", "daily_demand"))},
    "lead_times": {"receipt_id": T(maximum=100), "product_id": SKU, "source_location": WH, "supplier": SUP, "order_date": T("date"), "actual_delivery": T("date", aliases=("received_date",)), "expected_delivery": T("date", required=False)},
    "buffers": {"product_id": SKU, "source_location": WH, "supplier": SUP, "service_level": T("probability"), "review_days": T("integer")},
    "orders": {"order_id": T(aliases=("po_number", "order_number"), maximum=100), "product_id": SKU, "quantity": QTY, "unit_price": T("decimal", aliases=("price",)), "order_date": T("date"), "status": T(aliases=("order_status",), maximum=50), "shipping_date": T("date", required=False), "shipping_mode": T(required=False, maximum=100)},
}
SCHEMAS["delay_features"] = {
    "shipment_id": T(maximum=100), "supplier_location": T(), "component_type": T(), "transport_mode": T(),
    "distance_km": T("decimal"), "weather_condition": T(), "seasonal_rainy_period": T("boolean"),
    "traffic_level": T(), "supplier_risk_rating": T(), "supplier_on_time_rate": T("decimal"),
    "supplier_quality_rate": T("decimal"), "supplier_capacity_utilization": T("decimal"),
    "order_quantity": T("integer"), "inventory_at_order": T("integer"),
    "planned_lead_time_days": T("decimal"), "unit_cost": T("decimal"),
}

KEYS = {"delay_features": ("shipment_id",),"products": ("product_id",), "warehouses": ("source_location",), "suppliers": ("supplier",), "inventory": ("product_id", "source_location"), "buffers": ("product_id", "source_location"), "demand": ("product_id", "source_location", "observation_date"), "lead_times": ("receipt_id",), "orders": ("order_id", "product_id")}

def simplified(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())

def schema_for(dataset):
    if dataset not in SCHEMAS:
        raise ValueError("Select an explicit supported dataset; mixed imports are not supported")
    return SCHEMAS[dataset]

def metadata(dataset):
    return {key: {"label": key.replace("_", " ").title(), "description": f"{f.kind}; {'required' if f.required else 'optional'}", "required": f.required, "type": f.kind, "aliases": list(f.aliases)} for key, f in schema_for(dataset).items()}

def auto_map(headers, dataset):
    schema = schema_for(dataset)
    result = {}
    for header in headers:
        exact = [key for key in schema if simplified(key) == simplified(header)]
        candidates = exact or [key for key, f in schema.items() if simplified(header) in [simplified(a) for a in f.aliases]]
        result[header] = candidates[0] if len(candidates) == 1 else None
    return result

def convert(value, field):
    if value is None or str(value).strip() == "":
        if field.required:
            raise ValueError("Required value is blank")
        return None
    value = str(value).strip()
    if field.kind == "text":
        if len(value) > field.maximum:
            raise ValueError(f"Maximum length is {field.maximum}")
        return value
    if field.kind == "date":
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            try:
                return datetime.fromisoformat(value).date().isoformat()
            except ValueError:
                raise ValueError("Use an ISO date: YYYY-MM-DD")
    if field.kind == "boolean":
        if value.lower() not in ("true", "false", "1", "0"):
            raise ValueError("Use true/false or 1/0")
        return value.lower() in ("true", "1")
    try:
        number = Decimal(value)
    except InvalidOperation:
        raise ValueError("Expected a number without currency/thousands separators")
    if not number.is_finite() or (number < 0 and field.kind not in ("latitude", "longitude")):
        raise ValueError("Expected a finite nonnegative number")
    if field.kind in ("latitude", "longitude"):
        bound = 90 if field.kind == "latitude" else 180
        if abs(number) > bound or number.as_tuple().exponent < -6:
            raise ValueError(f"Coordinate must be between {-bound} and {bound}, at most six decimal places")
        return str(number)
    if field.kind == "integer":
        if number != number.to_integral_value() or number > 2147483647:
            raise ValueError("Expected a whole number between 0 and 2147483647")
        return int(number)
    if field.kind == "probability" and not Decimal("0.5") < number < 1:
        raise ValueError("Cycle service level must be greater than 0.5 and less than 1")
    if field.kind == "percent" and number > 100:
        raise ValueError("Percentage must be between 0 and 100")
    if number > Decimal("9999999999.99") or number.as_tuple().exponent < -6:
        raise ValueError("Number exceeds supported precision/range")
    if field.kind in ("decimal", "percent") and number != number.quantize(Decimal("0.01")):
        raise ValueError("At most two decimal places are supported")
    return str(number)
