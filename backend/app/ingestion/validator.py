import re
import logging
from typing import Dict, Any, List, Optional, Tuple, Set
import dateutil.parser

logger = logging.getLogger("synchain.ingestion.validator")


def _is_numeric(val: Any) -> Tuple[bool, Optional[float]]:
    if val is None or val == "":
        return False, None
    if isinstance(val, (int, float)):
        return True, float(val)
    val_str = str(val).strip()
    # Remove commas and currency signs
    cleaned = re.sub(r"[\$,]", "", val_str)
    try:
        num = float(cleaned)
        return True, num
    except (ValueError, TypeError):
        return False, None


def _is_valid_date(val: Any) -> Tuple[bool, Optional[str]]:
    if val is None or val == "":
        return True, None
    val_str = str(val).strip()
    try:
        dt = dateutil.parser.parse(val_str, fuzzy=False)
        return True, dt.date().isoformat()
    except Exception:
        return False, None


def validate_supply_chain_data(
    records: List[Dict[str, Any]],
    entity_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Validates a list of normalized canonical records.
    Records should have keys from CANONICAL_SCHEMA.
    """
    total_rows = len(records)
    valid_rows = 0
    invalid_rows = 0
    duplicates_count = 0
    
    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []
    seen_composite_keys: Set[str] = set()

    for idx, row in enumerate(records, start=1):
        row_has_error = False

        # 1. Empty row check
        usable_values = [v for k, v in row.items() if k != "_unmapped" and v is not None and str(v).strip() != ""]
        if not usable_values:
            errors.append({
                "row": idx,
                "field": "row",
                "raw_value": "EMPTY",
                "message": "Row contains no usable supply-chain data"
            })
            invalid_rows += 1
            continue

        # 2. Required identifier check
        # In a general supply-chain row, at least an item ID, order ID, or partner must exist
        has_identifier = bool(
            row.get("product_id") or row.get("product_name") or
            row.get("order_id") or row.get("shipment_id") or row.get("supplier")
        )
        if not has_identifier:
            errors.append({
                "row": idx,
                "field": "product_id / order_id",
                "raw_value": None,
                "message": "Missing key identifier (requires product_id, product_name, or order_id)"
            })
            row_has_error = True

        # 3. Numeric validation: Quantity
        qty_val = row.get("quantity")
        if qty_val is not None and str(qty_val).strip() != "":
            is_num, parsed_num = _is_numeric(qty_val)
            if not is_num:
                errors.append({
                    "row": idx,
                    "field": "quantity",
                    "raw_value": qty_val,
                    "message": f'Quantity must be numeric (found: "{qty_val}")'
                })
                row_has_error = True
            elif parsed_num is not None and parsed_num < 0:
                errors.append({
                    "row": idx,
                    "field": "quantity",
                    "raw_value": qty_val,
                    "message": f'Quantity cannot be negative (found: "{qty_val}")'
                })
                row_has_error = True

        # 4. Numeric validation: Unit Price
        price_val = row.get("unit_price")
        if price_val is not None and str(price_val).strip() != "":
            is_num, parsed_num = _is_numeric(price_val)
            if not is_num:
                errors.append({
                    "row": idx,
                    "field": "unit_price",
                    "raw_value": price_val,
                    "message": f'Unit price must be numeric (found: "{price_val}")'
                })
                row_has_error = True
            elif parsed_num is not None and parsed_num < 0:
                errors.append({
                    "row": idx,
                    "field": "unit_price",
                    "raw_value": price_val,
                    "message": f'Unit price cannot be negative (found: "{price_val}")'
                })
                row_has_error = True

        # 5. Date validations
        date_fields = ["order_date", "expected_delivery", "actual_delivery"]
        parsed_dates = {}
        for df in date_fields:
            val = row.get(df)
            if val is not None and str(val).strip() != "":
                valid_date, iso_date = _is_valid_date(val)
                if not valid_date:
                    errors.append({
                        "row": idx,
                        "field": df,
                        "raw_value": val,
                        "message": f'Invalid date format for {df} (found: "{val}")'
                    })
                    row_has_error = True
                else:
                    parsed_dates[df] = iso_date

        # Check chronology if multiple dates exist
        if "order_date" in parsed_dates and "actual_delivery" in parsed_dates:
            if parsed_dates["actual_delivery"] < parsed_dates["order_date"]:
                warnings.append({
                    "row": idx,
                    "field": "actual_delivery",
                    "raw_value": parsed_dates["actual_delivery"],
                    "message": f'Actual delivery ({parsed_dates["actual_delivery"]}) is earlier than order date ({parsed_dates["order_date"]})'
                })

        # 6. Duplicate detection
        # Create a unique signature for deduplication
        sku = str(row.get("product_id") or row.get("product_name") or "").strip().lower()
        loc = str(row.get("source_location") or "").strip().lower()
        order = str(row.get("order_id") or "").strip().lower()

        composite_key = f"{order}:{sku}:{loc}"
        if composite_key != "::":
            if composite_key in seen_composite_keys:
                duplicates_count += 1
                warnings.append({
                    "row": idx,
                    "field": "duplicate",
                    "raw_value": composite_key,
                    "message": f"Duplicate record detected (already seen in earlier rows)"
                })
            else:
                seen_composite_keys.add(composite_key)

        if row_has_error:
            invalid_rows += 1
        else:
            valid_rows += 1

    summary_text = (
        f"Total rows: {total_rows} | "
        f"Valid rows: {valid_rows} | "
        f"Invalid rows: {invalid_rows} | "
        f"Duplicates: {duplicates_count}"
    )

    return {
        "is_valid": invalid_rows == 0,
        "total_rows": total_rows,
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows,
        "duplicates_count": duplicates_count,
        "summary": summary_text,
        "errors": errors[:100],  # cap to top 100 to avoid payload explosion
        "warnings": warnings[:100],
    }
