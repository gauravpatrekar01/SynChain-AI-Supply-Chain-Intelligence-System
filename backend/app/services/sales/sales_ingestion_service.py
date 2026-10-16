"""
Sales Data Ingestion Service for SynChain AI.
Handles CSV parsing, schema auto-mapping, row-level validation,
in-file and in-database duplicate detection, preview generation,
atomic database persistence with transaction rollback, and transaction CRUD.
"""

import io
import os
import re
import csv
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple, Set
from decimal import Decimal
import dateutil.parser

from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc
from fastapi import UploadFile, HTTPException, status

from app.models.postgres.models import SalesTransaction, DataImport, User
from app.schemas.sales import (
    SalesCSVRowValidationError,
    SalesUploadPreviewResponse,
    SalesImportSummaryResponse,
    SalesTransactionResponse,
    SalesTransactionListResponse,
    SalesTransactionUpdate,
)

logger = logging.getLogger("synchain.sales.ingestion")

# Staging directory for sales file uploads
STAGING_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage", "sales_staging")
os.makedirs(STAGING_DIR, exist_ok=True)

# Minimum required columns for sales transactions
REQUIRED_SALES_FIELDS = [
    "transaction_id",
    "transaction_date",
    "product_id",
    "product_name",
    "product_category",
    "quantity_sold",
    "unit_selling_price",
    "discount_amount",
    "region",
]

OPTIONAL_SALES_FIELDS = [
    "customer_id",
    "order_id",
    "tax_amount",
    "return_quantity",
    "currency",
]

# Canonical aliases for header matching
SALES_HEADER_ALIASES: Dict[str, List[str]] = {
    "transaction_id": ["transaction_id", "transactionid", "tx_id", "txid", "trans_id", "id", "sale_id", "sales_id"],
    "transaction_date": ["transaction_date", "transactiondate", "trans_date", "date", "sale_date", "saledate", "order_date", "timestamp"],
    "product_id": ["product_id", "productid", "sku", "item_code", "itemcode", "part_no", "part_number", "product_code"],
    "product_name": ["product_name", "productname", "item_name", "itemname", "product", "title", "description"],
    "product_category": ["product_category", "productcategory", "category", "item_group", "itemgroup", "group", "class", "segment"],
    "quantity_sold": ["quantity_sold", "quantitysold", "quantity", "qty", "units_sold", "unitssold", "volume", "units"],
    "unit_selling_price": ["unit_selling_price", "unitsellingprice", "unit_price", "unitprice", "selling_price", "sellingprice", "price", "rate"],
    "discount_amount": ["discount_amount", "discountamount", "discount", "disc_amt", "rebate", "markdown"],
    "region": ["region", "territory", "sales_region", "zone", "area", "market", "country", "location"],
    "customer_id": ["customer_id", "customerid", "client_id", "account_id", "buyer_id", "cust_id"],
    "order_id": ["order_id", "orderid", "po_number", "sales_order", "so_number", "order_no"],
    "tax_amount": ["tax_amount", "taxamount", "tax", "vat", "gst", "sales_tax"],
    "return_quantity": ["return_quantity", "returnquantity", "returns", "returned_units", "return_qty", "returned_qty"],
    "currency": ["currency", "curr", "currency_code", "curr_code"],
}


def _simplify(s: str) -> str:
    """Strip punctuation and lowercase."""
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def map_sales_columns(raw_headers: List[str]) -> Tuple[Dict[str, str], List[str]]:
    """
    Auto-maps detected CSV headers to canonical sales fields.
    Returns (mapping: {detected_header: canonical_field}, missing_required_fields).
    """
    mapping: Dict[str, str] = {}
    assigned_canonicals: Set[str] = set()

    simplified_headers = {h: _simplify(h) for h in raw_headers}

    # Pass 1: exact and alias matches
    for field, aliases in SALES_HEADER_ALIASES.items():
        all_targets = [_simplify(field)] + [_simplify(a) for a in aliases]
        for header, simp in simplified_headers.items():
            if header in mapping:
                continue
            if simp in all_targets:
                mapping[header] = field
                assigned_canonicals.add(field)
                break

    # Pass 2: substring containment for unmapped required fields
    for field, aliases in SALES_HEADER_ALIASES.items():
        if field in assigned_canonicals:
            continue
        all_targets = [_simplify(field)] + [_simplify(a) for a in aliases]
        for header, simp in simplified_headers.items():
            if header in mapping:
                continue
            for target in all_targets:
                if (len(target) >= 4 and target in simp) or (len(simp) >= 4 and simp in target):
                    mapping[header] = field
                    assigned_canonicals.add(field)
                    break
            if field in assigned_canonicals:
                break

    missing_required = [f for f in REQUIRED_SALES_FIELDS if f not in assigned_canonicals]
    return mapping, missing_required


class SalesIngestionService:

    @classmethod
    async def upload_and_preview(
        cls,
        db: Session,
        file: UploadFile,
        current_user: Optional[User] = None,
    ) -> SalesUploadPreviewResponse:
        """
        Parses CSV, validates column schema, detects row errors and duplicates,
        stages the validated payload, and returns a rich preview.
        """
        filename = file.filename or "sales_data.csv"
        if not filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files (.csv) are currently supported for sales data ingestion.",
            )

        content_bytes = await file.read()
        if len(content_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )

        # Handle UTF-8 with BOM or fallback to latin-1
        try:
            text = content_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = content_bytes.decode("latin-1")
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unable to decode CSV file content: {str(exc)}",
                )

        # Parse CSV lines
        csv_file = io.StringIO(text)
        # Sniff delimiter
        sample = text[:4096]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
            delimiter = dialect.delimiter
        except Exception:
            delimiter = ","

        csv_file.seek(0)
        reader = csv.reader(csv_file, delimiter=delimiter)
        try:
            raw_headers = next(reader)
        except StopIteration:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV file contains no rows.",
            )

        raw_headers = [h.strip() for h in raw_headers if h is not None]
        if not raw_headers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV header line is empty.",
            )

        # Map columns
        col_mapping, missing_required = map_sales_columns(raw_headers)
        inverted_map = {detected: canonical for detected, canonical in col_mapping.items()}

        import_id = str(uuid.uuid4())

        # Collect rows
        rows: List[Dict[str, Any]] = []
        for line_num, row_data in enumerate(reader, start=2):
            if not row_data or all(not str(cell).strip() for cell in row_data):
                continue  # skip completely blank lines
            row_dict: Dict[str, Any] = {}
            for idx, val in enumerate(row_data):
                if idx < len(raw_headers):
                    header = raw_headers[idx]
                    canonical = inverted_map.get(header)
                    if canonical:
                        row_dict[canonical] = val.strip() if val is not None else ""
                    else:
                        row_dict[header] = val.strip() if val is not None else ""
            row_dict["_row_number"] = line_num
            rows.append(row_dict)

        total_rows = len(rows)

        # Row-level validation and duplicate detection
        validation_errors: List[SalesCSVRowValidationError] = []
        seen_tx_ids_in_file: Dict[str, int] = {}
        in_file_duplicates: Set[str] = set()

        # Check existing database transactions
        incoming_tx_ids = [
            str(r.get("transaction_id", "")).strip()
            for r in rows
            if r.get("transaction_id")
        ]
        existing_tx_ids = set()
        if incoming_tx_ids:
            # Query in batches of 1000
            for i in range(0, len(incoming_tx_ids), 1000):
                batch = incoming_tx_ids[i:i + 1000]
                found = db.query(SalesTransaction.transaction_id).filter(
                    SalesTransaction.transaction_id.in_(batch)
                ).all()
                for (fid,) in found:
                    existing_tx_ids.add(fid)

        parsed_valid_rows: List[Dict[str, Any]] = []

        for r in rows:
            row_num = r["_row_number"]
            row_has_error = False

            # 1. Transaction ID
            tx_id = str(r.get("transaction_id", "")).strip()
            if not tx_id:
                validation_errors.append(SalesCSVRowValidationError(
                    row_number=row_num,
                    field="transaction_id",
                    value=None,
                    message="Required 'transaction_id' is missing or blank.",
                ))
                row_has_error = True
            else:
                if tx_id in seen_tx_ids_in_file:
                    in_file_duplicates.add(tx_id)
                    validation_errors.append(SalesCSVRowValidationError(
                        row_number=row_num,
                        field="transaction_id",
                        value=tx_id,
                        message=f"Duplicate transaction_id '{tx_id}' found in row {row_num} (first seen in row {seen_tx_ids_in_file[tx_id]}).",
                    ))
                    row_has_error = True
                else:
                    seen_tx_ids_in_file[tx_id] = row_num

                if tx_id in existing_tx_ids:
                    validation_errors.append(SalesCSVRowValidationError(
                        row_number=row_num,
                        field="transaction_id",
                        value=tx_id,
                        message=f"Transaction ID '{tx_id}' already exists in the database.",
                    ))
                    # Note: We mark as error for preview; user can choose to skip or overwrite on import

            # 2. Transaction Date
            date_raw = str(r.get("transaction_date", "")).strip()
            parsed_date = None
            if not date_raw:
                validation_errors.append(SalesCSVRowValidationError(
                    row_number=row_num,
                    field="transaction_date",
                    value=None,
                    message="Required 'transaction_date' is missing or blank.",
                ))
                row_has_error = True
            else:
                try:
                    parsed_date = dateutil.parser.parse(date_raw)
                    if parsed_date.tzinfo is None:
                        parsed_date = parsed_date.replace(tzinfo=timezone.utc)
                except Exception:
                    validation_errors.append(SalesCSVRowValidationError(
                        row_number=row_num,
                        field="transaction_date",
                        value=date_raw,
                        message=f"Invalid date format '{date_raw}'. Expected ISO YYYY-MM-DD or parseable datetime.",
                    ))
                    row_has_error = True

            # 3. Product ID & Name
            prod_id = str(r.get("product_id", "")).strip()
            if not prod_id:
                validation_errors.append(SalesCSVRowValidationError(
                    row_number=row_num,
                    field="product_id",
                    value=None,
                    message="Required 'product_id' (SKU) is missing.",
                ))
                row_has_error = True

            prod_name = str(r.get("product_name", "")).strip()
            if not prod_name:
                validation_errors.append(SalesCSVRowValidationError(
                    row_number=row_num,
                    field="product_name",
                    value=None,
                    message="Required 'product_name' is missing.",
                ))
                row_has_error = True

            category = str(r.get("product_category", "General")).strip() or "General"
            region = str(r.get("region", "")).strip()
            if not region:
                validation_errors.append(SalesCSVRowValidationError(
                    row_number=row_num,
                    field="region",
                    value=None,
                    message="Required 'region' is missing.",
                ))
                row_has_error = True

            # 4. Quantity Sold
            qty_raw = r.get("quantity_sold", "")
            qty_sold = 0
            try:
                qty_sold = int(float(qty_raw))
                if qty_sold < 1:
                    validation_errors.append(SalesCSVRowValidationError(
                        row_number=row_num,
                        field="quantity_sold",
                        value=qty_raw,
                        message=f"quantity_sold must be an integer >= 1 (got {qty_sold}).",
                    ))
                    row_has_error = True
            except Exception:
                validation_errors.append(SalesCSVRowValidationError(
                    row_number=row_num,
                    field="quantity_sold",
                    value=qty_raw,
                    message=f"Invalid quantity_sold value '{qty_raw}'. Must be an integer >= 1.",
                ))
                row_has_error = True

            # 5. Unit Selling Price
            price_raw = r.get("unit_selling_price", "")
            unit_price = 0.0
            try:
                # remove currency signs if present
                clean_price = str(price_raw).replace("$", "").replace("€", "").replace("£", "").replace(",", "").strip()
                unit_price = float(clean_price)
                if unit_price < 0.0:
                    validation_errors.append(SalesCSVRowValidationError(
                        row_number=row_num,
                        field="unit_selling_price",
                        value=price_raw,
                        message=f"unit_selling_price cannot be negative (got {unit_price}).",
                    ))
                    row_has_error = True
            except Exception:
                validation_errors.append(SalesCSVRowValidationError(
                    row_number=row_num,
                    field="unit_selling_price",
                    value=price_raw,
                    message=f"Invalid unit_selling_price '{price_raw}'. Must be a non-negative number.",
                ))
                row_has_error = True

            # 6. Discount Amount
            disc_raw = r.get("discount_amount", 0.0)
            disc_amt = 0.0
            if disc_raw not in (None, "", "null", "None"):
                try:
                    clean_disc = str(disc_raw).replace("$", "").replace(",", "").strip()
                    disc_amt = float(clean_disc)
                    if disc_amt < 0.0:
                        validation_errors.append(SalesCSVRowValidationError(
                            row_number=row_num,
                            field="discount_amount",
                            value=disc_raw,
                            message="discount_amount cannot be negative.",
                        ))
                        row_has_error = True
                except Exception:
                    validation_errors.append(SalesCSVRowValidationError(
                        row_number=row_num,
                        field="discount_amount",
                        value=disc_raw,
                        message=f"Invalid discount_amount '{disc_raw}'.",
                    ))
                    row_has_error = True

            # 7. Optional Return Quantity
            return_qty_raw = r.get("return_quantity", 0)
            return_qty = 0
            if return_qty_raw not in (None, "", "null", "None"):
                try:
                    return_qty = int(float(return_qty_raw))
                    if return_qty < 0:
                        validation_errors.append(SalesCSVRowValidationError(
                            row_number=row_num,
                            field="return_quantity",
                            value=return_qty_raw,
                            message="return_quantity cannot be negative.",
                        ))
                        row_has_error = True
                    elif return_qty > qty_sold and qty_sold > 0:
                        validation_errors.append(SalesCSVRowValidationError(
                            row_number=row_num,
                            field="return_quantity",
                            value=return_qty_raw,
                            message=f"return_quantity ({return_qty}) cannot exceed quantity_sold ({qty_sold}).",
                        ))
                        row_has_error = True
                except Exception:
                    validation_errors.append(SalesCSVRowValidationError(
                        row_number=row_num,
                        field="return_quantity",
                        value=return_qty_raw,
                        message=f"Invalid return_quantity '{return_qty_raw}'.",
                    ))
                    row_has_error = True

            # 8. Optional Tax Amount
            tax_raw = r.get("tax_amount", 0.0)
            tax_amt = 0.0
            if tax_raw not in (None, "", "null", "None"):
                try:
                    clean_tax = str(tax_raw).replace("$", "").replace(",", "").strip()
                    tax_amt = max(0.0, float(clean_tax))
                except Exception:
                    tax_amt = 0.0

            customer_id = str(r.get("customer_id", "")).strip() or None
            order_id = str(r.get("order_id", "")).strip() or None
            currency = str(r.get("currency", "USD")).strip() or "USD"

            # Compute Revenues
            gross_rev = round(float(qty_sold) * float(unit_price), 2)
            net_rev = round(max(0.0, float(qty_sold - return_qty) * float(unit_price) - float(disc_amt)), 2)

            validated_row = {
                "transaction_id": tx_id,
                "transaction_date": parsed_date.isoformat() if parsed_date else date_raw,
                "product_id": prod_id,
                "product_name": prod_name,
                "product_category": category,
                "quantity_sold": qty_sold,
                "unit_selling_price": unit_price,
                "discount_amount": disc_amt,
                "gross_revenue": gross_rev,
                "net_revenue": net_rev,
                "region": region,
                "customer_id": customer_id,
                "order_id": order_id,
                "tax_amount": tax_amt,
                "return_quantity": return_qty,
                "currency": currency,
                "is_valid": not row_has_error,
                "_row_number": row_num,
            }
            parsed_valid_rows.append(validated_row)

        valid_rows_count = sum(1 for r in parsed_valid_rows if r["is_valid"] and r["transaction_id"] not in existing_tx_ids)
        invalid_rows_count = len(parsed_valid_rows) - valid_rows_count

        # Stage file payload for two-step confirmation
        staged_filepath = os.path.join(STAGING_DIR, f"{import_id}.json")
        staged_payload = {
            "import_id": import_id,
            "filename": filename,
            "total_rows": total_rows,
            "parsed_rows": parsed_valid_rows,
            "columns_detected": raw_headers,
            "mapped_columns": col_mapping,
            "missing_required": missing_required,
            "existing_db_tx_ids": list(existing_tx_ids),
            "staged_at": datetime.now(timezone.utc).isoformat(),
        }
        with open(staged_filepath, "w", encoding="utf-8") as f:
            json.dump(staged_payload, f, default=str)

        # Build preview sample (first 10 rows)
        preview_sample = parsed_valid_rows[:10]

        is_importable = len(missing_required) == 0 and valid_rows_count > 0

        summary = {
            "total_records_detected": total_rows,
            "valid_records_to_import": valid_rows_count,
            "invalid_or_rejected_records": invalid_rows_count,
            "duplicate_in_file": len(in_file_duplicates),
            "already_in_database": len(existing_tx_ids),
            "missing_required_columns_count": len(missing_required),
            "revenue_definition": "Net Revenue = max(0, (quantity_sold - return_quantity) * unit_selling_price - discount_amount)",
        }

        return SalesUploadPreviewResponse(
            import_id=import_id,
            filename=filename,
            total_rows_detected=total_rows,
            columns_detected=raw_headers,
            missing_required_columns=missing_required,
            mapped_columns=col_mapping,
            preview_rows=preview_sample,
            validation_errors=validation_errors[:50],  # Return first 50 row errors
            valid_rows_count=valid_rows_count,
            invalid_rows_count=invalid_rows_count,
            duplicate_in_file_count=len(in_file_duplicates),
            existing_in_db_count=len(existing_tx_ids),
            is_importable=is_importable,
            summary=summary,
        )

    @classmethod
    def execute_import(
        cls,
        db: Session,
        import_id: str,
        skip_duplicates: bool = True,
        user_id: Optional[uuid.UUID] = None,
    ) -> SalesImportSummaryResponse:
        """
        Executes confirmed import of staged sales records with an atomic database transaction.
        Rolls back cleanly on any database error.
        """
        staged_filepath = os.path.join(STAGING_DIR, f"{import_id}.json")
        if not os.path.exists(staged_filepath):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Staged import session '{import_id}' has expired or was not found. Please upload the CSV again.",
            )

        with open(staged_filepath, "r", encoding="utf-8") as f:
            staged = json.load(f)

        parsed_rows: List[Dict[str, Any]] = staged.get("parsed_rows", [])
        existing_in_db = set(staged.get("existing_db_tx_ids", []))

        # Create DataImport tracking record
        data_import_record = None
        if user_id:
            try:
                data_import_record = DataImport(
                    id=uuid.UUID(import_id),
                    user_id=user_id,
                    filename=staged.get("filename", "sales_data.csv"),
                    file_type="csv",
                    source_type="file",
                    entity_type="sales",
                    status="processing",
                    rows_total=len(parsed_rows),
                    columns_detected=staged.get("columns_detected"),
                    column_mapping=staged.get("mapped_columns"),
                )
                db.add(data_import_record)
                db.flush()
            except Exception as e:
                logger.warning(f"Could not persist DataImport record: {e}")
                db.rollback()

        imported_count = 0
        duplicate_count = 0
        rejected_count = 0
        total_net_rev = 0.0
        total_units = 0
        min_date: Optional[datetime] = None
        max_date: Optional[datetime] = None
        error_samples: List[str] = []

        # Refresh existing IDs from database inside transaction
        all_incoming_ids = [r["transaction_id"] for r in parsed_rows if r.get("is_valid") and r.get("transaction_id")]
        db_existing = set()
        if all_incoming_ids:
            for i in range(0, len(all_incoming_ids), 1000):
                batch = all_incoming_ids[i:i + 1000]
                found = db.query(SalesTransaction.transaction_id).filter(
                    SalesTransaction.transaction_id.in_(batch)
                ).all()
                for (fid,) in found:
                    db_existing.add(fid)

        transactions_to_insert: List[SalesTransaction] = []
        seen_in_batch: Set[str] = set()

        try:
            for r in parsed_rows:
                if not r.get("is_valid", False):
                    rejected_count += 1
                    continue

                tx_id = r["transaction_id"]
                if tx_id in db_existing or tx_id in seen_in_batch:
                    duplicate_count += 1
                    if skip_duplicates:
                        continue
                    else:
                        rejected_count += 1
                        error_samples.append(f"Row {r.get('_row_number')}: Duplicate transaction '{tx_id}' skipped.")
                        continue

                seen_in_batch.add(tx_id)

                tx_date = dateutil.parser.parse(r["transaction_date"])
                if tx_date.tzinfo is None:
                    tx_date = tx_date.replace(tzinfo=timezone.utc)

                if min_date is None or tx_date < min_date:
                    min_date = tx_date
                if max_date is None or tx_date > max_date:
                    max_date = tx_date

                qty = int(r["quantity_sold"])
                ret_qty = int(r.get("return_quantity", 0))
                price = Decimal(str(r["unit_selling_price"]))
                disc = Decimal(str(r.get("discount_amount", 0.0)))
                tax = Decimal(str(r.get("tax_amount", 0.0)))

                gross = Decimal(str(qty)) * price
                net = max(Decimal("0.00"), (Decimal(str(qty - ret_qty)) * price) - disc)

                total_net_rev += float(net)
                total_units += max(0, qty - ret_qty)

                tx = SalesTransaction(
                    id=uuid.uuid4(),
                    transaction_id=tx_id,
                    transaction_date=tx_date,
                    product_id=r["product_id"],
                    product_name=r["product_name"],
                    product_category=r.get("product_category", "General"),
                    quantity_sold=qty,
                    unit_selling_price=price,
                    discount_amount=disc,
                    gross_revenue=gross,
                    net_revenue=net,
                    region=r["region"],
                    customer_id=r.get("customer_id"),
                    order_id=r.get("order_id"),
                    tax_amount=tax,
                    return_quantity=ret_qty,
                    currency=r.get("currency", "USD"),
                    import_id=uuid.UUID(import_id) if data_import_record else None,
                )
                transactions_to_insert.append(tx)
                imported_count += 1

            # Bulk insert in batches of 1000
            for i in range(0, len(transactions_to_insert), 1000):
                db.bulk_save_objects(transactions_to_insert[i:i + 1000])
                db.flush()

            if data_import_record:
                data_import_record.status = "completed"
                data_import_record.rows_processed = imported_count
                data_import_record.rows_failed = rejected_count + duplicate_count
                data_import_record.completed_at = datetime.now(timezone.utc)
                data_import_record.result = {
                    "imported": imported_count,
                    "duplicates": duplicate_count,
                    "rejected": rejected_count,
                    "total_net_revenue": round(total_net_rev, 2),
                    "total_units_sold": total_units,
                }

            db.commit()

            # Clean up staging file on success
            try:
                os.remove(staged_filepath)
            except Exception:
                pass

            return SalesImportSummaryResponse(
                import_id=import_id,
                status="completed" if imported_count > 0 else "empty",
                total_records_processed=len(parsed_rows),
                imported_count=imported_count,
                duplicate_count=duplicate_count,
                rejected_count=rejected_count,
                total_net_revenue=round(total_net_rev, 2),
                total_units_sold=total_units,
                date_min=min_date.strftime("%Y-%m-%d") if min_date else None,
                date_max=max_date.strftime("%Y-%m-%d") if max_date else None,
                error_samples=error_samples[:10],
            )

        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to execute sales import: {exc}", exc_info=True)
            if data_import_record:
                try:
                    data_import_record.status = "failed"
                    data_import_record.error_summary = {"error": str(exc)}
                    db.commit()
                except Exception:
                    db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database transaction error during import. All changes rolled back cleanly: {str(exc)}",
            ) from exc

    @classmethod
    def list_transactions(
        cls,
        db: Session,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        product_id: Optional[str] = None,
        category: Optional[str] = None,
        region: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> SalesTransactionListResponse:
        """
        Retrieves paginated, filtered sales transactions with summary aggregates.
        """
        query = db.query(SalesTransaction)

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            query = query.filter(
                or_(
                    func.lower(SalesTransaction.transaction_id).like(term),
                    func.lower(SalesTransaction.product_id).like(term),
                    func.lower(SalesTransaction.product_name).like(term),
                    func.lower(SalesTransaction.region).like(term),
                    func.lower(SalesTransaction.customer_id).like(term),
                    func.lower(SalesTransaction.order_id).like(term),
                )
            )

        if product_id and product_id.strip():
            query = query.filter(SalesTransaction.product_id == product_id.strip())

        if category and category.strip() and category.lower() != "all":
            query = query.filter(func.lower(SalesTransaction.product_category) == category.strip().lower())

        if region and region.strip() and region.lower() != "all":
            query = query.filter(func.lower(SalesTransaction.region) == region.strip().lower())

        if start_date:
            try:
                s_dt = dateutil.parser.parse(start_date)
                query = query.filter(SalesTransaction.transaction_date >= s_dt)
            except Exception:
                pass

        if end_date:
            try:
                e_dt = dateutil.parser.parse(end_date)
                query = query.filter(SalesTransaction.transaction_date <= e_dt)
            except Exception:
                pass

        total = query.count()
        total_pages = max(1, (total + page_size - 1) // page_size)
        offset = (page - 1) * page_size

        items = query.order_by(desc(SalesTransaction.transaction_date)).offset(offset).limit(page_size).all()

        # Compute summary
        totals = db.query(
            func.coalesce(func.sum(SalesTransaction.net_revenue), 0),
            func.coalesce(func.sum(SalesTransaction.quantity_sold - SalesTransaction.return_quantity), 0),
        ).first()

        total_rev = float(totals[0]) if totals else 0.0
        total_units = int(totals[1]) if totals else 0
        asp = round(total_rev / max(1, total_units), 2)

        return SalesTransactionListResponse(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=[SalesTransactionResponse.model_validate(tx) for tx in items],
            summary={
                "filtered_total_revenue": total_rev,
                "filtered_units_sold": total_units,
                "filtered_asp": asp,
            },
        )

    @classmethod
    def get_transaction(cls, db: Session, tx_id: uuid.UUID) -> SalesTransactionResponse:
        tx = db.query(SalesTransaction).filter(SalesTransaction.id == tx_id).first()
        if not tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sales transaction with ID '{tx_id}' not found.",
            )
        return SalesTransactionResponse.model_validate(tx)

    @classmethod
    def update_transaction(
        cls,
        db: Session,
        tx_id: uuid.UUID,
        payload: SalesTransactionUpdate,
    ) -> SalesTransactionResponse:
        tx = db.query(SalesTransaction).filter(SalesTransaction.id == tx_id).first()
        if not tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sales transaction with ID '{tx_id}' not found.",
            )

        if payload.transaction_date is not None:
            tx.transaction_date = payload.transaction_date
        if payload.product_name is not None:
            tx.product_name = payload.product_name
        if payload.product_category is not None:
            tx.product_category = payload.product_category
        if payload.quantity_sold is not None:
            tx.quantity_sold = payload.quantity_sold
        if payload.unit_selling_price is not None:
            tx.unit_selling_price = Decimal(str(payload.unit_selling_price))
        if payload.discount_amount is not None:
            tx.discount_amount = Decimal(str(payload.discount_amount))
        if payload.tax_amount is not None:
            tx.tax_amount = Decimal(str(payload.tax_amount))
        if payload.return_quantity is not None:
            tx.return_quantity = payload.return_quantity
        if payload.region is not None:
            tx.region = payload.region
        if payload.customer_id is not None:
            tx.customer_id = payload.customer_id
        if payload.order_id is not None:
            tx.order_id = payload.order_id
        if payload.currency is not None:
            tx.currency = payload.currency

        # Recompute revenues
        gross = Decimal(str(tx.quantity_sold)) * Decimal(str(tx.unit_selling_price))
        net = max(
            Decimal("0.00"),
            (Decimal(str(tx.quantity_sold - tx.return_quantity)) * Decimal(str(tx.unit_selling_price))) - Decimal(str(tx.discount_amount))
        )
        tx.gross_revenue = gross
        tx.net_revenue = net

        db.commit()
        db.refresh(tx)
        return SalesTransactionResponse.model_validate(tx)

    @classmethod
    def delete_transaction(cls, db: Session, tx_id: uuid.UUID) -> Dict[str, Any]:
        tx = db.query(SalesTransaction).filter(SalesTransaction.id == tx_id).first()
        if not tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sales transaction with ID '{tx_id}' not found.",
            )
        deleted_id = tx.transaction_id
        db.delete(tx)
        db.commit()
        return {
            "success": True,
            "message": f"Transaction '{deleted_id}' successfully removed.",
            "deleted_id": str(tx_id),
        }
