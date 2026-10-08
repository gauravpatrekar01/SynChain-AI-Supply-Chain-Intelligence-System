import re
import logging
from typing import Dict, Any, List, Optional
from decimal import Decimal
import dateutil.parser

logger = logging.getLogger("synchain.ingestion.normalizer")

# Canonical supply-chain schema definitions
CANONICAL_SCHEMA: Dict[str, Dict[str, Any]] = {
    "product_id": {
        "label": "Product ID / SKU",
        "description": "Unique SKU or product code identifier",
        "aliases": [
            "sku", "product_id", "productid", "item_code", "itemcode",
            "material_code", "materialcode", "product_code", "productcode",
            "part_number", "part_no", "partno", "item_number", "item_no",
            "itemno", "article_no", "article_id"
        ]
    },
    "product_name": {
        "label": "Product Name",
        "description": "Descriptive title or name of the product",
        "aliases": [
            "product_name", "productname", "item_name", "itemname",
            "name", "title", "description", "product_desc", "item_desc",
            "material_name", "material_desc", "part_name"
        ]
    },
    "category": {
        "label": "Category / Group",
        "description": "Category or commodity classification",
        "aliases": [
            "category", "item_group", "itemgroup", "product_category",
            "product_group", "group", "class", "commodity", "commodity_type", "type"
        ]
    },
    "quantity": {
        "label": "Quantity",
        "description": "Current inventory, batch count, or order volume",
        "aliases": [
            "quantity", "qty", "stock_quantity", "stockquantity",
            "available_quantity", "available_qty", "actual_qty", "actual_quantity",
            "stock", "units", "inventory_level", "on_hand", "balance_qty", "count"
        ]
    },
    "unit_price": {
        "label": "Unit Price / Cost",
        "description": "Standard price, rate, or unit cost",
        "aliases": [
            "unit_price", "unitprice", "price", "standard_rate", "rate",
            "cost", "unit_cost", "amount", "standard_cost", "val", "value"
        ]
    },
    "supplier": {
        "label": "Supplier / Vendor",
        "description": "Manufacturer, supplier, or vendor entity name",
        "aliases": [
            "supplier", "supplier_name", "suppliername", "vendor", "vendor_name",
            "source_vendor", "manufacturer", "provider", "partner", "distributor"
        ]
    },
    "source_location": {
        "label": "Source Location / Warehouse",
        "description": "Origin warehouse, facility, depot, or origin city",
        "aliases": [
            "source_location", "sourcelocation", "warehouse", "warehouse_name",
            "location", "origin", "from", "from_location", "facility",
            "site", "source", "wh_name", "source_city", "depot"
        ]
    },
    "destination": {
        "label": "Destination",
        "description": "Receiving warehouse, customer port, or destination city",
        "aliases": [
            "destination", "dest", "to", "to_location", "delivery_location",
            "ship_to", "target_location", "destination_city", "recipient"
        ]
    },
    "order_id": {
        "label": "Order ID",
        "description": "Purchase or sales order identifier",
        "aliases": [
            "order_id", "orderid", "po_number", "ponumber", "order_number",
            "ordernumber", "order_no", "orderno", "purchase_order",
            "sales_order", "document_no", "ref_no"
        ]
    },
    "shipment_id": {
        "label": "Shipment / Tracking ID",
        "description": "Tracking number, consignment, or bill of lading ID",
        "aliases": [
            "shipment_id", "shipmentid", "tracking_number", "tracking_id",
            "consignment_no", "waybill", "bol_number", "shipment_no", "awb"
        ]
    },
    "order_date": {
        "label": "Order Date",
        "description": "Date when the order or transaction was created",
        "aliases": [
            "order_date", "orderdate", "po_date", "podate", "created_date",
            "date", "transaction_date", "doc_date"
        ]
    },
    "expected_delivery": {
        "label": "Expected Delivery Date",
        "description": "Promised or estimated arrival date (ETA)",
        "aliases": [
            "expected_delivery", "expected_date", "expecteddate", "delivery_date",
            "deliverydate", "due_date", "duedate", "eta", "promised_date",
            "target_date", "estimated_delivery"
        ]
    },
    "actual_delivery": {
        "label": "Actual Delivery Date",
        "description": "Actual date received, completed, or signed for",
        "aliases": [
            "actual_delivery", "actual_date", "actualdate", "received_date",
            "completion_date", "delivered_at", "delivered_date"
        ]
    },
    "status": {
        "label": "Status",
        "description": "Operational lifecycle state or health status",
        "aliases": [
            "status", "order_status", "orderstatus", "state", "health_status",
            "shipment_status", "condition"
        ]
    }
}


def _simplify_header(header: str) -> str:
    """Normalize string by removing non-alphanumeric chars and lowercasing."""
    return re.sub(r"[^a-z0-9]", "", str(header).lower())


def auto_map_columns(detected_columns: List[str]) -> Dict[str, Optional[str]]:
    """
    Given a list of detected column names, returns a mapping:
    { detected_column: canonical_field or None }
    """
    mapping: Dict[str, Optional[str]] = {}
    assigned_canonicals = set()

    simplified_canonicals = {
        field: {
            "exact": _simplify_header(field),
            "aliases": [_simplify_header(alias) for alias in meta["aliases"]],
        }
        for field, meta in CANONICAL_SCHEMA.items()
    }

    # Pass 1: Exact matches against canonical key or alias
    for col in detected_columns:
        simplified_col = _simplify_header(col)
        matched_field: Optional[str] = None

        for field, data in simplified_canonicals.items():
            if field in assigned_canonicals:
                continue
            if simplified_col == data["exact"] or simplified_col in data["aliases"]:
                matched_field = field
                break

        if matched_field:
            mapping[col] = matched_field
            assigned_canonicals.add(matched_field)
        else:
            mapping[col] = None

    # Pass 2: Substring or containment matches for remaining unmapped columns
    for col, current_match in mapping.items():
        if current_match is not None:
            continue
        simplified_col = _simplify_header(col)

        for field, data in simplified_canonicals.items():
            if field in assigned_canonicals:
                continue
            # Check if any alias is contained inside the column or vice-versa
            for alias in data["aliases"]:
                if len(alias) >= 4 and (alias in simplified_col or simplified_col in alias):
                    mapping[col] = field
                    assigned_canonicals.add(field)
                    break
            if mapping[col] is not None:
                break

    return mapping


def _parse_safe_date(val: Any) -> Optional[str]:
    """Parse date safely into ISO YYYY-MM-DD format."""
    if not val:
        return None
    val_str = str(val).strip()
    try:
        dt = dateutil.parser.parse(val_str, fuzzy=False)
        return dt.date().isoformat()
    except Exception:
        try:
            # Try fuzzy parser
            dt = dateutil.parser.parse(val_str, fuzzy=True)
            return dt.date().isoformat()
        except Exception:
            return val_str  # Retain raw string if unable to parse


def _parse_safe_numeric(val: Any) -> Optional[float]:
    """Extract float/int numeric value safely."""
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        return val
    try:
        cleaned = re.sub(r"[\$,]", "", str(val).strip())
        num = float(cleaned)
        return int(num) if num.is_integer() else num
    except Exception:
        return None


def normalize_records(
    records: List[Dict[str, Any]],
    column_mapping: Dict[str, Optional[str]]
) -> List[Dict[str, Any]]:
    """
    Transforms raw row records into SynChain canonical schema format.
    Unmapped attributes are stored under '_unmapped'.
    """
    normalized_list: List[Dict[str, Any]] = []

    # Invert mapping: canonical_field -> source_col
    # Note: user might map multiple cols to distinct canonical fields
    field_to_source: Dict[str, str] = {}
    for src_col, canon_field in column_mapping.items():
        if canon_field and canon_field in CANONICAL_SCHEMA:
            field_to_source[canon_field] = src_col

    for row in records:
        canonical_row: Dict[str, Any] = {}
        unmapped_data: Dict[str, Any] = {}

        # 1. Populate canonical fields
        for canon_field in CANONICAL_SCHEMA:
            src_col = field_to_source.get(canon_field)
            if src_col and src_col in row:
                val = row[src_col]
                if val is not None:
                    # Clean type
                    if canon_field == "quantity":
                        num = _parse_safe_numeric(val)
                        canonical_row[canon_field] = num if num is not None else val
                    elif canon_field == "unit_price":
                        num = _parse_safe_numeric(val)
                        canonical_row[canon_field] = num if num is not None else val
                    elif canon_field in ("order_date", "expected_delivery", "actual_delivery"):
                        canonical_row[canon_field] = _parse_safe_date(val)
                    else:
                        canonical_row[canon_field] = str(val).strip()
                else:
                    canonical_row[canon_field] = None
            else:
                canonical_row[canon_field] = None

        # 2. Gather unmapped columns
        for src_col, val in row.items():
            if column_mapping.get(src_col) is None and val is not None:
                unmapped_data[src_col] = val

        canonical_row["_unmapped"] = unmapped_data
        normalized_list.append(canonical_row)

    return normalized_list
