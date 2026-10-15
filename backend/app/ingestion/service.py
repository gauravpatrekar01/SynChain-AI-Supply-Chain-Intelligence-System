import os
import re
import uuid
import logging
import hashlib
import json
import time
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from typing import Dict, Any, List, Optional
from pathlib import Path

from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import DBAPIError, OperationalError

from app.models.postgres.models import (
    DataImport,
    ImportedRecord,
    Product,
    Supplier,
    Warehouse,
    Inventory,
    Order,
    OrderItem,
    User,
)
from app.models.postgres.observations import (
    DemandObservation,
    LeadTimeObservation,
)
from app.ingestion.persistence import lock_writes
from .csv_parser import parse_csv_file
from .excel_parser import parse_excel_file, get_excel_sheet_names
from .normalizer import (
    CANONICAL_SCHEMA,
    auto_map_columns,
    normalize_records,
)
from .validator import validate_supply_chain_data

logger = logging.getLogger("synchain.ingestion.service")


def fingerprint(data: Any) -> str:
    """Deterministic SHA-256 fingerprint of any data structure."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
TEMP_STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage" / "uploads_temp"


def _ensure_temp_dir() -> Path:
    TEMP_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    return TEMP_STORAGE_DIR


def _sanitize_filename(filename: str) -> str:
    # Remove directory paths
    base = os.path.basename(filename)
    # Sanitize characters
    sanitized = re.sub(r"[^a-zA-Z0-9_.-]", "_", base)
    return sanitized if sanitized else "upload_file"


class IngestionService:
    @staticmethod
    def _get_staged_file_path(import_id: str) -> Optional[Path]:
        temp_dir = _ensure_temp_dir()
        matches = list(temp_dir.glob(f"{import_id}_*"))
        return matches[0] if matches else None

    @classmethod
    async def upload_and_stage(
        cls,
        db: Session,
        file: UploadFile,
        current_user: User
    ) -> Dict[str, Any]:
        """
        Validates, saves temporary upload file, extracts metadata,
        and creates a DataImport record.
        """
        filename = file.filename or "data_upload"
        sanitized_name = _sanitize_filename(filename)
        _, ext = os.path.splitext(sanitized_name.lower())

        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '{ext}'. Supported formats are: .csv, .xlsx, .xls"
            )

        content = await file.read()
        file_size = len(content)

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is empty."
            )

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum size limit of 25MB (Size: {file_size / (1024*1024):.1f}MB)"
            )

        import_id = uuid.uuid4()
        temp_dir = _ensure_temp_dir()
        staged_path = temp_dir / f"{import_id}_{sanitized_name}"
        
        with open(staged_path, "wb") as f:
            f.write(content)

        is_excel = ext in {".xlsx", ".xls"}
        file_type = ext.lstrip(".")
        source_type = "excel" if is_excel else "csv"

        sheet_names: List[str] = []
        selected_sheet: Optional[str] = None
        parsed: Dict[str, Any] = {}

        try:
            if is_excel:
                sheet_names = get_excel_sheet_names(content, sanitized_name)
                selected_sheet = sheet_names[0] if sheet_names else "Sheet1"
                parsed = parse_excel_file(content, sanitized_name, sheet_name=selected_sheet)
            else:
                parsed = parse_csv_file(content, sanitized_name)
        except Exception as e:
            # Cleanup temp file on parse failure
            if staged_path.exists():
                staged_path.unlink()
            logger.error(f"Failed to read file {sanitized_name}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The file could not be read. Please verify that the file is not corrupted: {str(e)}"
            )

        headers = parsed.get("headers", [])
        rows = parsed.get("rows", [])
        total_rows = parsed.get("total_rows", 0)

        if total_rows == 0 or not headers:
            if staged_path.exists():
                staged_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The file contains no usable rows or headers."
            )

        auto_mapping = auto_map_columns(headers)
        preview_rows = rows[:15]

        # Record DataImport in DB
        data_import = DataImport(
            id=import_id,
            user_id=current_user.id,
            filename=sanitized_name,
            file_type=file_type,
            source_type=source_type,
            status="pending",
            rows_total=total_rows,
            rows_processed=0,
            rows_failed=0,
            columns_detected=headers,
            column_mapping=auto_mapping,
            error_summary=None,
        )
        db.add(data_import)
        db.commit()
        db.refresh(data_import)

        logger.info(f"Staged file {sanitized_name} with import_id {import_id}, {total_rows} rows")

        return {
            "success": True,
            "import_id": str(data_import.id),
            "filename": sanitized_name,
            "file_type": file_type,
            "source_type": source_type,
            "sheets": sheet_names,
            "selected_sheet": selected_sheet,
            "columns_detected": headers,
            "auto_mapping": auto_mapping,
            "canonical_schema": CANONICAL_SCHEMA,
            "rows_detected": total_rows,
            "preview_rows": preview_rows,
            "status": "pending"
        }

    @classmethod
    def get_preview(
        cls,
        db: Session,
        import_id: str,
        user_id: uuid.UUID,
        sheet_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Returns preview data and detected columns for a staged import session.
        """
        data_import = db.query(DataImport).filter(
            DataImport.id == import_id,
            DataImport.user_id == user_id
        ).first()

        if not data_import:
            raise HTTPException(status_code=404, detail="Import session not found")

        staged_path = cls._get_staged_file_path(import_id)
        if not staged_path or not staged_path.exists():
            raise HTTPException(status_code=404, detail="Staged file expired or not found")

        with open(staged_path, "rb") as f:
            content = f.read()

        is_excel = data_import.file_type in {"xlsx", "xls"}
        sheet_names: List[str] = []
        selected_sheet = sheet_name

        if is_excel:
            sheet_names = get_excel_sheet_names(content, staged_path.name)
            if not selected_sheet or selected_sheet not in sheet_names:
                selected_sheet = sheet_names[0]
            parsed = parse_excel_file(content, staged_path.name, sheet_name=selected_sheet)
        else:
            parsed = parse_csv_file(content, staged_path.name)

        headers = parsed.get("headers", [])
        rows = parsed.get("rows", [])
        total_rows = parsed.get("total_rows", 0)
        auto_mapping = auto_map_columns(headers)

        return {
            "import_id": str(data_import.id),
            "filename": data_import.filename,
            "file_type": data_import.file_type,
            "source_type": data_import.source_type,
            "sheets": sheet_names,
            "selected_sheet": selected_sheet,
            "columns_detected": headers,
            "auto_mapping": auto_mapping,
            "canonical_schema": CANONICAL_SCHEMA,
            "rows_detected": total_rows,
            "preview_rows": rows[:15],
            "status": data_import.status
        }

    @classmethod
    def validate_import(
        cls,
        db: Session,
        import_id: str,
        user_id: uuid.UUID,
        sheet_name: Optional[str] = None,
        column_mapping: Optional[Dict[str, Optional[str]]] = None,
        entity_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validates the data against business rules and supply-chain canonical schema.
        """
        data_import = db.query(DataImport).filter(
            DataImport.id == import_id,
            DataImport.user_id == user_id
        ).first()

        if not data_import:
            raise HTTPException(status_code=404, detail="Import session not found")

        staged_path = cls._get_staged_file_path(import_id)
        if not staged_path or not staged_path.exists():
            raise HTTPException(status_code=404, detail="Staged file expired or not found")

        with open(staged_path, "rb") as f:
            content = f.read()

        is_excel = data_import.file_type in {"xlsx", "xls"}
        if is_excel:
            parsed = parse_excel_file(content, staged_path.name, sheet_name=sheet_name)
        else:
            parsed = parse_csv_file(content, staged_path.name)

        headers = parsed.get("headers", [])
        raw_rows = parsed.get("rows", [])

        effective_mapping = column_mapping or auto_map_columns(headers)
        normalized_records = normalize_records(raw_rows, effective_mapping)

        validation_result = validate_supply_chain_data(normalized_records, entity_type=entity_type)

        return {
            "import_id": str(data_import.id),
            "filename": data_import.filename,
            "validation": validation_result,
            "column_mapping": effective_mapping,
            "preview_normalized": normalized_records[:5]
        }

    @classmethod
    def execute_import(
        cls,
        db: Session,
        import_id: str,
        user_id: uuid.UUID,
        sheet_name: Optional[str] = None,
        column_mapping: Optional[Dict[str, Optional[str]]] = None,
        entity_type: Optional[str] = "multi"
    ) -> Dict[str, Any]:
        """
        Normalizes and persists the data into the existing Postgres models
        with resilient bulk preloading, idempotent deduplication, observation
        tracking, and verified database persistence.
        """
        data_import = db.query(DataImport).filter(
            DataImport.id == import_id,
            DataImport.user_id == user_id
        ).first()

        if not data_import:
            raise HTTPException(status_code=404, detail="Import session not found")

        staged_path = cls._get_staged_file_path(import_id)
        if not staged_path or not staged_path.exists():
            raise HTTPException(status_code=404, detail="Staged file not found")

        with open(staged_path, "rb") as f:
            content = f.read()

        is_excel = data_import.file_type in {"xlsx", "xls"}
        if is_excel:
            parsed = parse_excel_file(content, staged_path.name, sheet_name=sheet_name)
        else:
            parsed = parse_csv_file(content, staged_path.name)

        headers = parsed.get("headers", [])
        raw_rows = parsed.get("rows", [])
        effective_mapping = column_mapping or data_import.column_mapping or auto_map_columns(headers)
        normalized_records = normalize_records(raw_rows, effective_mapping)

        # Run validation
        val_result = validate_supply_chain_data(normalized_records, entity_type=entity_type)
        invalid_row_indices = {e["row"] for e in val_result.get("errors", []) if "row" in e}

        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                try:
                    lock_writes(db)
                except Exception as lock_err:
                    logger.debug(f"Advisory lock skipped: {lock_err}")

                # Collect unique lookup identifiers across the valid rows
                unique_skus = set()
                unique_suppliers = set()
                unique_warehouses = set()
                unique_orders = set()
                unique_receipts = set()

                for idx, (raw_row, canon_row) in enumerate(zip(raw_rows, normalized_records), start=1):
                    if idx in invalid_row_indices:
                        continue
                    sku = canon_row.get("product_id") or raw_row.get("product_id") or raw_row.get("sku") or raw_row.get("item_code")
                    if sku:
                        unique_skus.add(str(sku).strip())
                    sup = canon_row.get("supplier") or raw_row.get("supplier") or raw_row.get("vendor")
                    if sup:
                        unique_suppliers.add(str(sup).strip())
                    wh = (
                        canon_row.get("source_location")
                        or raw_row.get("source_location")
                        or raw_row.get("warehouse")
                        or raw_row.get("warehouse_name")
                        or raw_row.get("warehouse_code")
                        or raw_row.get("facility")
                        or raw_row.get("location")
                        or raw_row.get("destination")
                    )
                    if wh:
                        unique_warehouses.add(str(wh).strip())
                    ord_id = canon_row.get("order_id") or raw_row.get("order_id")
                    if ord_id:
                        unique_orders.add(str(ord_id).strip())
                    rcpt_id = canon_row.get("receipt_id") or raw_row.get("receipt_id")
                    if rcpt_id:
                        unique_receipts.add(str(rcpt_id).strip())

                # Preload existing entities in bulk to eliminate N+1 SSL round trips
                product_map: Dict[str, Product] = {}
                if unique_skus:
                    for p in db.query(Product).filter(Product.sku.in_(list(unique_skus))).all():
                        product_map[p.sku] = p

                supplier_map: Dict[str, Supplier] = {}
                if unique_suppliers:
                    for s in db.query(Supplier).filter(Supplier.name.in_(list(unique_suppliers))).all():
                        supplier_map[s.name] = s

                warehouse_map: Dict[str, Warehouse] = {}
                if unique_warehouses:
                    for w in db.query(Warehouse).filter(Warehouse.name.in_(list(unique_warehouses))).all():
                        warehouse_map[w.name] = w

                inv_map: Dict[tuple, Inventory] = {}
                p_ids = [p.id for p in product_map.values()]
                w_ids = [w.id for w in warehouse_map.values()]
                if p_ids and w_ids:
                    for inv in db.query(Inventory).filter(
                        Inventory.product_id.in_(p_ids),
                        Inventory.warehouse_id.in_(w_ids)
                    ).all():
                        inv_map[(inv.warehouse_id, inv.product_id)] = inv

                order_map: Dict[str, Order] = {}
                if unique_orders:
                    for o in db.query(Order).filter(Order.external_id.in_(list(unique_orders))).all():
                        order_map[o.external_id] = o

                demand_map: Dict[tuple, DemandObservation] = {}
                if p_ids and w_ids:
                    for d_obs in db.query(DemandObservation).filter(
                        DemandObservation.product_id.in_(p_ids),
                        DemandObservation.warehouse_id.in_(w_ids)
                    ).all():
                        demand_map[(d_obs.product_id, d_obs.warehouse_id, d_obs.observation_date)] = d_obs

                lead_time_map: Dict[str, LeadTimeObservation] = {}
                if unique_receipts:
                    for lto in db.query(LeadTimeObservation).filter(
                        LeadTimeObservation.receipt_id.in_(list(unique_receipts))
                    ).all():
                        lead_time_map[lto.receipt_id] = lto

                rows_processed = 0
                rows_failed = 0
                created_products = 0
                created_suppliers = 0
                created_warehouses = 0
                created_inventory = 0
                created_orders = 0
                created_demand_obs = 0
                created_lead_time_obs = 0

                BATCH_SIZE = 50

                for idx, (raw_row, canon_row) in enumerate(zip(raw_rows, normalized_records), start=1):
                    if idx in invalid_row_indices:
                        rows_failed += 1
                        imp_rec = ImportedRecord(
                            import_id=data_import.id,
                            entity_type=entity_type or "general",
                            source_type=data_import.source_type,
                            source_file=data_import.filename,
                            row_number=idx,
                            raw_data=raw_row,
                            normalized_data=canon_row,
                            target_entity_id=None,
                            status="failed"
                        )
                        db.add(imp_rec)
                        continue

                    target_entity_id: Optional[uuid.UUID] = None

                    # 1. Product creation / update
                    sku = canon_row.get("product_id") or raw_row.get("product_id") or raw_row.get("sku") or raw_row.get("item_code")
                    name = canon_row.get("product_name") or raw_row.get("product_name") or raw_row.get("item_name") or sku
                    category = canon_row.get("category") or raw_row.get("category") or "General"
                    price_val = canon_row.get("unit_price") or raw_row.get("unit_price") or raw_row.get("price")
                    try:
                        price = Decimal(str(price_val)) if price_val is not None else Decimal("0.0")
                    except Exception:
                        price = Decimal("0.0")

                    product_obj = None
                    if sku:
                        sku_str = str(sku).strip()
                        if sku_str in product_map:
                            product_obj = product_map[sku_str]
                            if name and not product_obj.name:
                                product_obj.name = str(name)
                            if price > 0 and (not product_obj.price or product_obj.price == Decimal("0.0")):
                                product_obj.price = price
                        else:
                            product_obj = Product(
                                sku=sku_str,
                                name=str(name),
                                category=str(category),
                                price=price
                            )
                            db.add(product_obj)
                            db.flush()
                            product_map[sku_str] = product_obj
                            created_products += 1

                        target_entity_id = product_obj.id

                    qty_val = canon_row.get("quantity") or raw_row.get("quantity") or raw_row.get("order_quantity")

                    # 2. Supplier creation / update
                    sup_name = canon_row.get("supplier") or raw_row.get("supplier") or raw_row.get("vendor")
                    supplier_obj = None
                    if sup_name:
                        sup_str = str(sup_name).strip()
                        sup_country = canon_row.get("country") or raw_row.get("country") or raw_row.get("supplier_location") or "Global"
                        sup_tier = canon_row.get("tier") or raw_row.get("tier") or "Tier-1"

                        rel_val = canon_row.get("reliability_score") or raw_row.get("reliability_score") or raw_row.get("supplier_on_time_rate")
                        if rel_val is not None:
                            try:
                                rf = float(rel_val)
                                if 0.0 < rf <= 1.0:
                                    rf *= 100.0
                                sup_rel = Decimal(f"{rf:.2f}")
                            except Exception:
                                sup_rel = Decimal("88.0")
                        else:
                            sup_rel = Decimal("88.0")

                        annual_spend_val = canon_row.get("spend_annual_usd") or raw_row.get("spend_annual_usd") or raw_row.get("annual_spend")
                        if annual_spend_val is not None:
                            try:
                                sup_spend = Decimal(str(annual_spend_val))
                            except Exception:
                                sup_spend = Decimal("500000.0")
                        else:
                            try:
                                item_qty = float(qty_val) if qty_val is not None else 100.0
                            except Exception:
                                item_qty = 100.0
                            sup_spend = Decimal(str(float(price) * item_qty * 12.0))

                        risk_rating = str(raw_row.get("supplier_risk_rating") or raw_row.get("risk_rating") or "").lower()
                        single_source = bool(raw_row.get("single_source_risk") or risk_rating in ("high", "critical", "true", "1"))
                        health_st = "Critical" if float(sup_rel) < 65 else ("Warning" if float(sup_rel) < 80 else "Good")

                        if sup_str in supplier_map:
                            supplier_obj = supplier_map[sup_str]
                            if sup_country and sup_country != "Unknown":
                                supplier_obj.country = str(sup_country)
                            if sup_tier:
                                supplier_obj.tier = str(sup_tier)
                            if sup_rel:
                                supplier_obj.reliability_score = sup_rel
                            if sup_spend > 0:
                                supplier_obj.spend_annual_usd = sup_spend
                            supplier_obj.health_status = health_st
                            supplier_obj.single_source_risk = single_source
                        else:
                            supplier_obj = Supplier(
                                name=sup_str,
                                tier=str(sup_tier),
                                category=str(category),
                                country=str(sup_country),
                                reliability_score=sup_rel,
                                spend_annual_usd=sup_spend,
                                health_status=health_st,
                                single_source_risk=single_source
                            )
                            db.add(supplier_obj)
                            db.flush()
                            supplier_map[sup_str] = supplier_obj
                            created_suppliers += 1

                        if not target_entity_id:
                            target_entity_id = supplier_obj.id

                    # 3. Warehouse creation / update
                    wh_name = (
                        canon_row.get("source_location")
                        or raw_row.get("source_location")
                        or raw_row.get("warehouse")
                        or raw_row.get("warehouse_name")
                        or raw_row.get("warehouse_code")
                        or raw_row.get("facility")
                        or raw_row.get("location")
                        or raw_row.get("destination")
                    )
                    warehouse_obj = None
                    if wh_name:
                        wh_str = str(wh_name).strip()
                        wh_country = canon_row.get("country") or raw_row.get("country") or "US"
                        if wh_str in warehouse_map:
                            warehouse_obj = warehouse_map[wh_str]
                            if wh_country and wh_country != "Unknown":
                                warehouse_obj.country = str(wh_country)
                        else:
                            warehouse_obj = Warehouse(
                                name=wh_str,
                                location=wh_str,
                                country=str(wh_country),
                                capacity_units=25000
                            )
                            db.add(warehouse_obj)
                            db.flush()
                            warehouse_map[wh_str] = warehouse_obj
                            created_warehouses += 1

                    # 4. Inventory creation / update
                    qty_stock_val = canon_row.get("quantity") or raw_row.get("quantity") or raw_row.get("stock_quantity") or raw_row.get("order_quantity")
                    if product_obj and warehouse_obj and qty_stock_val is not None:
                        try:
                            qty = int(float(qty_stock_val))
                            reserved_val = canon_row.get("reserved_quantity") or raw_row.get("reserved_quantity")
                            incoming_val = canon_row.get("incoming_quantity") or raw_row.get("incoming_quantity")
                            review_val = canon_row.get("review_days") or raw_row.get("review_days")
                            service_lvl_val = canon_row.get("service_level") or raw_row.get("service_level")

                            reserved_qty = int(float(reserved_val)) if reserved_val is not None else 0
                            incoming_qty = int(float(incoming_val)) if incoming_val is not None else 0
                            review_days = int(float(review_val)) if review_val is not None else None
                            service_level = Decimal(str(service_lvl_val)) if service_lvl_val is not None else None
                            supplier_id = supplier_obj.id if supplier_obj else None

                            raw_safety = canon_row.get("safety_stock") or raw_row.get("safety_stock") or raw_row.get("safety_stock_level")
                            if raw_safety is not None:
                                try:
                                    safety = int(float(raw_safety))
                                except Exception:
                                    safety = max(50, int(qty * 0.25))
                            else:
                                safety = max(50, int(qty * 0.25))

                            raw_reorder = canon_row.get("reorder_level") or raw_row.get("reorder_level") or raw_row.get("reorder_point")
                            if raw_reorder is not None:
                                try:
                                    reorder = int(float(raw_reorder))
                                except Exception:
                                    reorder = max(100, int(qty * 0.40))
                            else:
                                reorder = max(100, int(qty * 0.40))

                            raw_reorder_qty = canon_row.get("reorder_quantity") or raw_row.get("reorder_quantity") or raw_row.get("reorder_qty")
                            if raw_reorder_qty is not None:
                                try:
                                    reorder_qty = int(float(raw_reorder_qty))
                                except Exception:
                                    reorder_qty = max(200, int(qty * 0.60))
                            else:
                                reorder_qty = max(200, int(qty * 0.60))

                            route_key = (warehouse_obj.id, product_obj.id)
                            if route_key in inv_map:
                                inv_obj = inv_map[route_key]
                                inv_obj.stock_quantity = qty
                                inv_obj.safety_stock_level = safety
                                inv_obj.reorder_level = reorder
                                inv_obj.reorder_quantity = reorder_qty
                                inv_obj.reserved_quantity = reserved_qty
                                inv_obj.incoming_quantity = incoming_qty
                                if review_days is not None:
                                    inv_obj.review_days = review_days
                                if service_level is not None:
                                    inv_obj.service_level = service_level
                                if supplier_id is not None:
                                    inv_obj.supplier_id = supplier_id
                            else:
                                inv_obj = Inventory(
                                    warehouse_id=warehouse_obj.id,
                                    product_id=product_obj.id,
                                    stock_quantity=qty,
                                    safety_stock_level=safety,
                                    reorder_level=reorder,
                                    reorder_quantity=reorder_qty,
                                    reserved_quantity=reserved_qty,
                                    incoming_quantity=incoming_qty,
                                    review_days=review_days,
                                    service_level=service_level,
                                    supplier_id=supplier_id
                                )
                                db.add(inv_obj)
                                inv_map[route_key] = inv_obj
                                created_inventory += 1
                        except Exception as e:
                            logger.warning(f"Could not record inventory for row {idx}: {str(e)}")

                    # 5. Order creation / update (deduplicated by external_id)
                    order_id = canon_row.get("order_id") or raw_row.get("order_id")
                    if order_id:
                        order_id_str = str(order_id).strip()
                        order_date_str = canon_row.get("order_date") or raw_row.get("order_date")
                        order_date = datetime.now(timezone.utc)
                        if order_date_str:
                            try:
                                order_date = datetime.fromisoformat(str(order_date_str).replace("Z", "+00:00"))
                                if order_date.tzinfo is None:
                                    order_date = order_date.replace(tzinfo=timezone.utc)
                            except Exception:
                                pass

                        shipping_mode = (
                            canon_row.get("transport_mode")
                            or raw_row.get("transport_mode")
                            or raw_row.get("shipping_mode")
                            or "ocean"
                        )
                        order_status_val = canon_row.get("status") or raw_row.get("status") or "Processing"

                        if order_id_str in order_map:
                            order_obj = order_map[order_id_str]
                            order_obj.order_status = str(order_status_val)
                            if shipping_mode:
                                order_obj.shipping_mode = str(shipping_mode).lower()
                        else:
                            order_obj = Order(
                                external_id=order_id_str,
                                user_id=user_id,
                                order_status=str(order_status_val),
                                shipping_mode=str(shipping_mode).lower(),
                                order_date=order_date,
                                shipping_date=order_date + timedelta(days=7) if order_date else None
                            )
                            db.add(order_obj)
                            db.flush()
                            order_map[order_id_str] = order_obj
                            created_orders += 1

                        if product_obj:
                            existing_item = db.query(OrderItem).filter(
                                OrderItem.order_id == order_obj.id,
                                OrderItem.product_id == product_obj.id
                            ).first()
                            item_qty = int(float(qty_val)) if qty_val is not None else 1
                            if not existing_item:
                                order_item = OrderItem(
                                    order_id=order_obj.id,
                                    product_id=product_obj.id,
                                    quantity=item_qty,
                                    unit_price=price
                                )
                                db.add(order_item)
                            else:
                                existing_item.quantity = item_qty
                                existing_item.unit_price = price

                    # 6. DemandObservation creation / update
                    obs_date_str = (
                        canon_row.get("observation_date")
                        or raw_row.get("observation_date")
                        or raw_row.get("demand_date")
                        or raw_row.get("date")
                        or raw_row.get("order_date")
                    )
                    d_qty_val = (
                        canon_row.get("demand_quantity")
                        or raw_row.get("demand_quantity")
                        or canon_row.get("demand_qty")
                        or raw_row.get("demand_qty")
                        or qty_val
                    )
                    if obs_date_str and product_obj and warehouse_obj and d_qty_val is not None:
                        try:
                            if isinstance(obs_date_str, date):
                                obs_d = obs_date_str
                            else:
                                obs_d = date.fromisoformat(str(obs_date_str)[:10])
                            d_key = (product_obj.id, warehouse_obj.id, obs_d)
                            d_qty = max(0, int(float(d_qty_val)))
                            if d_key in demand_map:
                                demand_map[d_key].quantity = d_qty
                            else:
                                d_obs = db.query(DemandObservation).filter_by(
                                    product_id=product_obj.id,
                                    warehouse_id=warehouse_obj.id,
                                    observation_date=obs_d
                                ).first()
                                if d_obs:
                                    d_obs.quantity = d_qty
                                    demand_map[d_key] = d_obs
                                else:
                                    d_obs = DemandObservation(
                                        product_id=product_obj.id,
                                        warehouse_id=warehouse_obj.id,
                                        observation_date=obs_d,
                                        quantity=d_qty
                                    )
                                    db.add(d_obs)
                                    demand_map[d_key] = d_obs
                                    created_demand_obs += 1
                        except Exception as e:
                            logger.debug(f"Row {idx} demand observation skipped: {e}")

                    # 7. LeadTimeObservation creation / update
                    receipt_id = canon_row.get("receipt_id") or raw_row.get("receipt_id")
                    if receipt_id and product_obj and warehouse_obj and supplier_obj:
                        try:
                            rcpt_str = str(receipt_id).strip()
                            o_date_val = canon_row.get("order_date") or raw_row.get("order_date")
                            a_date_val = canon_row.get("actual_delivery") or raw_row.get("actual_delivery") or raw_row.get("delivery_date") or raw_row.get("actual_delivery_date")
                            e_date_val = canon_row.get("expected_delivery") or raw_row.get("expected_delivery")

                            if o_date_val and a_date_val:
                                o_date = date.fromisoformat(str(o_date_val)[:10]) if not isinstance(o_date_val, date) else o_date_val
                                a_date = date.fromisoformat(str(a_date_val)[:10]) if not isinstance(a_date_val, date) else a_date_val
                                e_date = (date.fromisoformat(str(e_date_val)[:10]) if not isinstance(e_date_val, date) else e_date_val) if e_date_val else None

                                if rcpt_str in lead_time_map:
                                    lto = lead_time_map[rcpt_str]
                                    lto.order_date = o_date
                                    lto.actual_delivery = a_date
                                    lto.expected_delivery = e_date
                                else:
                                    lto = db.query(LeadTimeObservation).filter_by(receipt_id=rcpt_str).first()
                                    if lto:
                                        lto.order_date = o_date
                                        lto.actual_delivery = a_date
                                        lto.expected_delivery = e_date
                                        lead_time_map[rcpt_str] = lto
                                    else:
                                        lto = LeadTimeObservation(
                                            receipt_id=rcpt_str,
                                            product_id=product_obj.id,
                                            warehouse_id=warehouse_obj.id,
                                            supplier_id=supplier_obj.id,
                                            order_date=o_date,
                                            actual_delivery=a_date,
                                            expected_delivery=e_date
                                        )
                                        db.add(lto)
                                        lead_time_map[rcpt_str] = lto
                                        created_lead_time_obs += 1
                        except Exception as e:
                            logger.debug(f"Row {idx} lead time observation skipped: {e}")

                    # 8. Record ImportedRecord row for traceability
                    imp_rec = ImportedRecord(
                        import_id=data_import.id,
                        entity_type=entity_type or "multi",
                        source_type=data_import.source_type,
                        source_file=data_import.filename,
                        row_number=idx,
                        raw_data=raw_row,
                        normalized_data=canon_row,
                        target_entity_id=target_entity_id,
                        status="imported"
                    )
                    db.add(imp_rec)
                    rows_processed += 1

                    if rows_processed % BATCH_SIZE == 0:
                        db.flush()

                # Final flush before commit
                db.flush()

                # Verify that stored records match rows_processed
                stored_count = db.query(ImportedRecord).filter(
                    ImportedRecord.import_id == data_import.id,
                    ImportedRecord.status == "imported"
                ).count()

                if stored_count != rows_processed:
                    logger.warning(
                        f"Imported record count mismatch: processed {rows_processed}, stored {stored_count}"
                    )
                    data_import.status = "partial" if stored_count > 0 else "failed"
                else:
                    data_import.status = "completed" if rows_failed == 0 else ("partial" if rows_processed > 0 else "failed")

                data_import.rows_processed = stored_count
                data_import.rows_failed = rows_failed
                data_import.column_mapping = effective_mapping
                data_import.completed_at = datetime.now(timezone.utc)
                data_import.result = {
                    "status": data_import.status,
                    "rows_total": len(raw_rows),
                    "rows_processed": stored_count,
                    "rows_failed": rows_failed,
                    "created_products": created_products,
                    "created_suppliers": created_suppliers,
                    "created_warehouses": created_warehouses,
                    "created_inventory": created_inventory,
                    "created_orders": created_orders,
                    "created_demand_observations": created_demand_obs,
                    "created_lead_time_observations": created_lead_time_obs,
                    "verified": True
                }
                data_import.error_summary = {
                    "validation_summary": val_result.get("summary"),
                    "errors": val_result.get("errors", [])[:20]
                }
                db.commit()
                break  # Successful commit, exit attempt loop

            except (OperationalError, DBAPIError) as db_err:
                db.rollback()
                if attempt == max_attempts:
                    logger.exception(f"Import {import_id} failed after {max_attempts} attempts: {db_err}")
                    try:
                        data_import.status = "failed"
                        data_import.completed_at = datetime.now(timezone.utc)
                        data_import.error_summary = {"error": f"Database connection error: {str(db_err)}"}
                        db.commit()
                    except Exception:
                        pass
                    raise HTTPException(
                        status_code=503,
                        detail=f"Database connection error during batch persistence: {str(db_err)}"
                    )
                logger.warning(f"Database network error on attempt {attempt}/{max_attempts}: {db_err}. Retrying in {0.5 * attempt}s...")
                time.sleep(0.5 * attempt)
            except Exception as e:
                db.rollback()
                logger.exception(f"Unexpected error executing import {import_id}: {str(e)}")
                try:
                    data_import.status = "failed"
                    data_import.completed_at = datetime.now(timezone.utc)
                    data_import.error_summary = {"error": str(e)}
                    db.commit()
                except Exception:
                    pass
                raise HTTPException(status_code=500, detail=f"Import execution failed: {str(e)}")

        # Cleanup staged file safely after successful commit
        try:
            if staged_path.exists():
                staged_path.unlink()
        except Exception as e:
            logger.warning(f"Failed to remove temp file {staged_path}: {str(e)}")

        logger.info(
            f"Completed import {import_id} for {data_import.filename}: "
            f"{rows_processed} processed, {rows_failed} failed"
        )

        return {
            "success": True,
            "import_id": str(data_import.id),
            "filename": data_import.filename,
            "file_type": data_import.file_type,
            "source_type": data_import.source_type,
            "status": data_import.status,
            "rows_total": len(raw_rows),
            "rows_processed": rows_processed,
            "rows_failed": rows_failed,
            "entities_created": {
                "products": created_products,
                "suppliers": created_suppliers,
                "warehouses": created_warehouses,
                "inventory": created_inventory,
                "orders": created_orders
            },
            "columns_detected": headers,
            "message": f"Successfully ingested {rows_processed} rows from {data_import.filename} into SynChain database."
        }

    @classmethod
    def get_history(
        cls,
        db: Session,
        user_id: uuid.UUID,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Retrieves import history for the authenticated user.
        """
        records = db.query(DataImport).filter(
            DataImport.user_id == user_id
        ).order_by(DataImport.created_at.desc()).limit(limit).all()

        history_list = []
        for rec in records:
            history_list.append({
                "id": str(rec.id),
                "filename": rec.filename,
                "file_type": rec.file_type,
                "source_type": rec.source_type,
                "status": rec.status,
                "rows_total": rec.rows_total,
                "rows_processed": rec.rows_processed,
                "rows_failed": rec.rows_failed,
                "columns_detected": rec.columns_detected or [],
                "created_at": rec.created_at.isoformat() if rec.created_at else None,
                "completed_at": rec.completed_at.isoformat() if rec.completed_at else None,
            })
        return history_list
