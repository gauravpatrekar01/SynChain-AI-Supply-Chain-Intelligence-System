import os
import re
import uuid
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional
from pathlib import Path

from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

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
from .csv_parser import parse_csv_file
from .excel_parser import parse_excel_file, get_excel_sheet_names
from .normalizer import (
    CANONICAL_SCHEMA,
    auto_map_columns,
    normalize_records,
)
from .validator import validate_supply_chain_data

logger = logging.getLogger("synchain.ingestion.service")

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
        and records imported tracking entries.
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

        rows_processed = 0
        rows_failed = 0
        created_products = 0
        created_suppliers = 0
        created_warehouses = 0
        created_inventory = 0
        created_orders = 0

        for idx, (raw_row, canon_row) in enumerate(zip(raw_rows, normalized_records), start=1):
            if idx in invalid_row_indices:
                rows_failed += 1
                # Still record failed row in imported_records for auditing
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
            sku = canon_row.get("product_id")
            name = canon_row.get("product_name") or sku
            category = canon_row.get("category") or "General"
            price_val = canon_row.get("unit_price")
            price = Decimal(str(price_val)) if price_val is not None else Decimal("0.0")

            product_obj = None
            if sku:
                product_obj = db.query(Product).filter(Product.sku == str(sku)).first()
                if not product_obj:
                    product_obj = Product(
                        sku=str(sku),
                        name=str(name),
                        category=str(category),
                        price=price
                    )
                    db.add(product_obj)
                    created_products += 1
                else:
                    if name:
                        product_obj.name = str(name)
                    if price > 0:
                        product_obj.price = price
                db.flush()
                target_entity_id = product_obj.id

            qty_val = canon_row.get("quantity") or raw_row.get("quantity") or raw_row.get("order_quantity")

            # 2. Supplier creation / update
            sup_name = canon_row.get("supplier")
            if sup_name:
                supplier_obj = db.query(Supplier).filter(Supplier.name == str(sup_name)).first()
                sup_country = canon_row.get("country") or raw_row.get("country") or raw_row.get("supplier_location") or "Global"
                sup_tier = canon_row.get("tier") or raw_row.get("tier") or "Tier-1"
                
                # Calculate reliability
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

                # Calculate annual spend
                annual_spend_val = canon_row.get("spend_annual_usd") or raw_row.get("spend_annual_usd") or raw_row.get("annual_spend")
                if annual_spend_val is not None:
                    try:
                        sup_spend = Decimal(str(annual_spend_val))
                    except Exception:
                        sup_spend = Decimal("500000.0")
                else:
                    item_qty = float(qty_val) if qty_val is not None else 100.0
                    sup_spend = Decimal(str(float(price) * item_qty * 12.0))

                # Single source / risk
                risk_rating = str(raw_row.get("supplier_risk_rating") or raw_row.get("risk_rating") or "").lower()
                single_source = bool(raw_row.get("single_source_risk") or risk_rating in ("high", "critical", "true", "1"))
                health_st = "Critical" if float(sup_rel) < 65 else ("Warning" if float(sup_rel) < 80 else "Good")

                if not supplier_obj:
                    supplier_obj = Supplier(
                        name=str(sup_name),
                        tier=str(sup_tier),
                        category=str(category),
                        country=str(sup_country),
                        reliability_score=sup_rel,
                        spend_annual_usd=sup_spend,
                        health_status=health_st,
                        single_source_risk=single_source
                    )
                    db.add(supplier_obj)
                    created_suppliers += 1
                else:
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
                db.flush()
                if not target_entity_id:
                    target_entity_id = supplier_obj.id

            # 3. Warehouse creation / update
            wh_name = canon_row.get("source_location") or raw_row.get("source_location") or raw_row.get("warehouse") or raw_row.get("destination")
            warehouse_obj = None
            if wh_name:
                warehouse_obj = db.query(Warehouse).filter(Warehouse.name == str(wh_name)).first()
                wh_country = canon_row.get("country") or raw_row.get("country") or "US"
                if not warehouse_obj:
                    warehouse_obj = Warehouse(
                        name=str(wh_name),
                        location=str(wh_name),
                        country=str(wh_country),
                        capacity_units=25000
                    )
                    db.add(warehouse_obj)
                    created_warehouses += 1
                else:
                    if wh_country and wh_country != "Unknown":
                        warehouse_obj.country = str(wh_country)
                db.flush()

            # 4. Inventory creation / update
            qty_val = canon_row.get("quantity") or raw_row.get("order_quantity")
            if product_obj and warehouse_obj and qty_val is not None:
                try:
                    qty = int(float(qty_val))
                    inv_obj = db.query(Inventory).filter(
                        Inventory.warehouse_id == warehouse_obj.id,
                        Inventory.product_id == product_obj.id
                    ).first()
                    safety = max(50, int(qty * 0.25))
                    reorder = max(100, int(qty * 0.40))
                    reorder_qty = max(200, int(qty * 0.60))
                    if not inv_obj:
                        inv_obj = Inventory(
                            warehouse_id=warehouse_obj.id,
                            product_id=product_obj.id,
                            stock_quantity=qty,
                            safety_stock_level=safety,
                            reorder_level=reorder,
                            reorder_quantity=reorder_qty
                        )
                        db.add(inv_obj)
                        created_inventory += 1
                    else:
                        inv_obj.stock_quantity = qty
                        inv_obj.safety_stock_level = safety
                        inv_obj.reorder_level = reorder
                    db.flush()
                except Exception as e:
                    logger.warning(f"Could not record inventory for row {idx}: {str(e)}")

            # 5. Order creation / update
            order_id = canon_row.get("order_id") or raw_row.get("order_id")
            if order_id:
                order_date_str = canon_row.get("order_date") or raw_row.get("order_date")
                order_date = datetime.now(timezone.utc)
                if order_date_str:
                    try:
                        order_date = datetime.fromisoformat(order_date_str)
                    except Exception:
                        pass

                shipping_mode = (
                    canon_row.get("transport_mode")
                    or raw_row.get("transport_mode")
                    or raw_row.get("shipping_mode")
                    or "ocean"
                )
                
                order_status_val = canon_row.get("status") or raw_row.get("status") or "Processing"

                order_obj = Order(
                    user_id=user_id,
                    order_status=str(order_status_val),
                    shipping_mode=str(shipping_mode).lower(),
                    order_date=order_date,
                    shipping_date=order_date + timedelta(days=7)
                )
                db.add(order_obj)
                db.flush()
                created_orders += 1

                if product_obj:
                    order_item = OrderItem(
                        order_id=order_obj.id,
                        product_id=product_obj.id,
                        quantity=int(float(qty_val)) if qty_val is not None else 1,
                        unit_price=price
                    )
                    db.add(order_item)

            # Record ImportedRecord row for traceability
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

        # Update DataImport record
        data_import.status = "completed" if rows_failed == 0 else ("partial" if rows_processed > 0 else "failed")
        data_import.rows_processed = rows_processed
        data_import.rows_failed = rows_failed
        data_import.column_mapping = effective_mapping
        data_import.completed_at = datetime.now(timezone.utc)
        data_import.error_summary = {
            "validation_summary": val_result.get("summary"),
            "errors": val_result.get("errors", [])[:20]
        }
        db.commit()

        # Cleanup staged file safely
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
