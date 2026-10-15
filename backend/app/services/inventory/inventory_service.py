import io
import csv
import math
import uuid
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, desc, asc
from sqlalchemy.orm import Session, joinedload

from app.models.postgres.models import Product, Warehouse, Inventory, Supplier, OrderItem, Sales, Purchase, Shipment
from app.services.inventory_metrics import inventory_metrics
from app.schemas.inventory import (
    InventoryCreate,
    InventoryUpdate,
    InventoryResponse,
    InventorySummaryStats,
    InventoryImportRowError,
    InventoryImportPreviewResponse,
    InventoryImportConfirmResponse,
    RecalculateBufferResponse,
    WarehouseOption,
    normalize_status,
)

HEADER_ALIAS_MAP: Dict[str, str] = {
    # SKU
    "sku": "sku",
    "product_code": "sku",
    "product_sku": "sku",
    "item_code": "sku",
    "code": "sku",
    "part_number": "sku",
    # Name
    "name": "name",
    "product_name": "name",
    "product": "name",
    "item_name": "name",
    "title": "name",
    "description": "name",
    # Category
    "category": "category",
    "product_category": "category",
    "item_category": "category",
    "group": "category",
    # Price
    "price": "price",
    "unit_price": "price",
    "cost": "price",
    # Warehouse / Location
    "warehouse_name": "warehouse_name",
    "warehouse": "warehouse_name",
    "facility": "warehouse_name",
    "location": "warehouse_name",
    "depot": "warehouse_name",
    "hub": "warehouse_name",
    # On-Hand Quantity
    "on_hand_quantity": "on_hand_quantity",
    "on_hand": "on_hand_quantity",
    "stock_quantity": "on_hand_quantity",
    "quantity": "on_hand_quantity",
    "units": "on_hand_quantity",
    "on_hand_units": "on_hand_quantity",
    # Reserved Quantity
    "reserved_quantity": "reserved_quantity",
    "reserved": "reserved_quantity",
    "reserved_units": "reserved_quantity",
    # Safety Stock
    "safety_stock": "safety_stock",
    "safety_stock_level": "safety_stock",
    "safety_floor": "safety_stock",
    "safety_units": "safety_stock",
    "safety_stock_units": "safety_stock",
    # Reorder Point
    "reorder_point": "reorder_point",
    "reorder_level": "reorder_point",
    "reorder_trigger": "reorder_point",
    "trigger_point": "reorder_point",
    # Reorder Quantity
    "reorder_quantity": "reorder_quantity",
    "reorder_qty": "reorder_quantity",
    "batch_quantity": "reorder_quantity",
    # Forecasting / Buffer
    "average_daily_demand": "average_daily_demand",
    "daily_demand": "average_daily_demand",
    "avg_demand": "average_daily_demand",
    "demand": "average_daily_demand",
    "lead_time_days": "lead_time_days",
    "lead_time": "lead_time_days",
    "lead_days": "lead_time_days",
}

TOKEN_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]], List[InventoryImportRowError], int]] = {}
CACHE_TTL_SECONDS = 900  # 15 minutes


def _clean_token_cache():
    now = time.time()
    expired = [k for k, v in TOKEN_CACHE.items() if now - v[0] > CACHE_TTL_SECONDS]
    for k in expired:
        TOKEN_CACHE.pop(k, None)


def sanitize_csv_cell(value: Any) -> str:
    """Strip formula injection triggers (=, +, -, @) and trim whitespace, preserving numeric negative values."""
    if value is None:
        return ""
    text = str(value).strip()
    # Don't strip leading minus sign from valid numbers (e.g. -100, -5.5) so validation can reject negative inputs
    if text.startswith("-") and len(text) > 1 and text[1:].replace(".", "", 1).isdigit():
        return text
    if text.startswith(("=", "+", "-", "@")):
        text = text.lstrip("=+-@").strip()
    return text


class InventoryService:

    @staticmethod
    def calculate_metrics(
        stock: int,
        reserved: int,
        safety: int,
        reorder: int,
        avg_demand: Optional[float] = None,
    ) -> Tuple[int, Optional[float], float, str]:
        """
        Calculates:
        1. available_quantity = on_hand - reserved
        2. days_of_supply = available / avg_daily_demand (safe against div by zero)
        3. buffer_health_percentage = available / safety_stock * 100
        4. status = 'critical' | 'warning' | 'optimal'
        """
        available = max(0, stock - reserved)

        # Buffer Health %
        if safety > 0:
            buffer_pct = round((available / safety) * 100.0, 1)
        else:
            buffer_pct = 100.0 if available > 0 else 0.0

        # Days of Inventory
        if avg_demand is not None and avg_demand > 0:
            days_of_supply = round(available / avg_demand, 1)
        elif safety > 0:
            # Fallback estimation using standard 15-day run rate of safety buffer
            days_of_supply = round(available / max(1.0, safety / 15.0), 1)
        else:
            days_of_supply = None

        # Status
        if available < safety or stock <= safety:
            st = "critical"
        elif available <= reorder:
            st = "warning"
        else:
            st = "optimal"

        return available, days_of_supply, buffer_pct, st

    @classmethod
    def serialize_inventory(cls, inv: Inventory, db: Optional[Session] = None) -> InventoryResponse:
        prod: Optional[Product] = inv.product
        wh: Optional[Warehouse] = inv.warehouse

        sku = prod.sku if prod else f"SKU-{str(inv.id)[:6].upper()}"
        name = prod.name if prod else "Standard Assembly"
        category = prod.category if prod else "General Materials"
        price = float(prod.price) if prod and prod.price is not None else 100.0
        facility = wh.name if wh else "Central Logistics Hub"
        location = wh.location if wh else None
        country = wh.country if wh else None

        stock = inv.stock_quantity or 0
        reserved = inv.reserved_quantity or 0
        safety = inv.safety_stock_level or 0
        reorder = inv.reorder_level or 0
        reorder_qty = inv.reorder_quantity or 0
        avg_demand = float(inv.average_daily_demand) if inv.average_daily_demand is not None else None
        lead_time = inv.lead_time_days

        available, days_of_supply, buffer_pct, st = cls.calculate_metrics(
            stock=stock,
            reserved=reserved,
            safety=safety,
            reorder=reorder,
            avg_demand=avg_demand,
        )

        return InventoryResponse(
            id=inv.id,
            product_id=inv.product_id,
            warehouse_id=inv.warehouse_id,
            sku=sku,
            name=name,
            category=category,
            price=price,
            facility=facility,
            location=location,
            country=country,
            on_hand_units=stock,
            reserved_units=reserved,
            available_units=available,
            safety_stock_units=safety,
            reorder_trigger=reorder,
            reorder_quantity=reorder_qty,
            average_daily_demand=avg_demand,
            lead_time_days=lead_time,
            days_of_supply=days_of_supply,
            buffer_health_percentage=buffer_pct,
            status=st,
            created_at=inv.created_at,
            updated_at=inv.updated_at,
            # Frontend camelCase aliases
            onHandUnits=stock,
            reservedUnits=reserved,
            availableUnits=available,
            safetyStockUnits=safety,
            reorderTrigger=reorder,
            reorderQuantity=reorder_qty,
            daysOfSupply=days_of_supply,
            bufferPct=buffer_pct,
            averageDailyDemand=avg_demand,
            leadTimeDays=lead_time,
            # Forecasting compatibility aliases
            currentStock=stock,
            current_stock=stock,
            safetyStock=safety,
            safety_stock=safety,
            reorderLevel=reorder,
            reorder_level=reorder,
            unitPrice=price,
            unit_price=price,
            dataSource="postgresql_live",
            data_source="postgresql_live",
            warehouse=facility,
            warehouseLocation=location or facility,
            warehouse_location=location or facility,
            hasHistoricalDemand=False,
            has_historical_demand=False,
            description=f"Live database inventory record in {facility}.",
        )

    @classmethod
    def get_items(
        cls,
        db: Session,
        search: Optional[str] = None,
        category: Optional[str] = None,
        facility: Optional[str] = None,
        status_filter: Optional[str] = None,
        sort_by: Optional[str] = "name",
        sort_order: Optional[str] = "asc",
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Inventory], int, InventorySummaryStats]:
        query = (
            db.query(Inventory)
            .options(joinedload(Inventory.product), joinedload(Inventory.warehouse))
            .join(Product, Inventory.product_id == Product.id)
            .join(Warehouse, Inventory.warehouse_id == Warehouse.id)
        )

        if search and search.strip():
            kw = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Product.name.ilike(kw),
                    Product.sku.ilike(kw),
                    Product.category.ilike(kw),
                    Warehouse.name.ilike(kw),
                    Warehouse.location.ilike(kw),
                )
            )

        if category and category.strip().lower() != "all":
            query = query.filter(Product.category.ilike(f"%{category.strip()}%"))

        if facility and facility.strip().lower() != "all":
            query = query.filter(Warehouse.name.ilike(f"%{facility.strip()}%"))

        all_matching = query.all()

        # Compute summary statistics across all matching records
        total_products = len(all_matching)
        total_on_hand = sum(i.stock_quantity or 0 for i in all_matching)
        total_safety = sum(i.safety_stock_level or 0 for i in all_matching)
        total_val = sum((i.stock_quantity or 0) * (float(i.product.price) if i.product and i.product.price else 0.0) for i in all_matching)

        critical_c = 0
        warning_c = 0
        optimal_c = 0

        filtered_by_status = []
        for inv in all_matching:
            stock = inv.stock_quantity or 0
            res = inv.reserved_quantity or 0
            saf = inv.safety_stock_level or 0
            reo = inv.reorder_level or 0
            avail = max(0, stock - res)

            if avail < saf or stock <= saf:
                st = "critical"
                critical_c += 1
            elif avail <= reo:
                st = "warning"
                warning_c += 1
            else:
                st = "optimal"
                optimal_c += 1

            if status_filter and status_filter.strip().lower() != "all":
                clean_target = normalize_status(status_filter)
                if st != clean_target:
                    continue
            filtered_by_status.append(inv)

        # Sorting
        sort_key = (sort_by or "name").lower()
        reverse = (sort_order or "asc").lower() == "desc"

        def extract_sort_val(inv: Inventory):
            if sort_key in ("name", "product_name"):
                return (inv.product.name if inv.product else "").lower()
            elif sort_key in ("sku", "code"):
                return (inv.product.sku if inv.product else "").lower()
            elif sort_key in ("category",):
                return (inv.product.category if inv.product else "").lower()
            elif sort_key in ("facility", "warehouse"):
                return (inv.warehouse.name if inv.warehouse else "").lower()
            elif sort_key in ("on_hand", "stock", "quantity", "on_hand_units"):
                return inv.stock_quantity or 0
            elif sort_key in ("safety_stock", "safety_floor", "safety_stock_units"):
                return inv.safety_stock_level or 0
            elif sort_key in ("buffer_health", "buffer_pct"):
                s = inv.safety_stock_level or 0
                a = max(0, (inv.stock_quantity or 0) - (inv.reserved_quantity or 0))
                return (a / s * 100) if s > 0 else (100 if a > 0 else 0)
            elif sort_key in ("created_at",):
                return inv.created_at or datetime.min.replace(tzinfo=timezone.utc)
            return (inv.product.name if inv.product else "").lower()

        filtered_by_status.sort(key=extract_sort_val, reverse=reverse)

        total_filtered = len(filtered_by_status)
        offset = max(0, (page - 1) * page_size)
        paginated_items = filtered_by_status[offset : offset + page_size]

        summary = InventorySummaryStats(
            total_products=total_products,
            total_on_hand_units=total_on_hand,
            total_safety_stock_units=total_safety,
            total_inventory_value_usd=round(total_val, 2),
            critical_count=critical_c,
            warning_count=warning_c,
            optimal_count=optimal_c,
        )

        return paginated_items, total_filtered, summary

    @staticmethod
    def get_by_id(db: Session, identifier: str) -> Optional[Inventory]:
        # Try UUID on Inventory.id
        try:
            val_uuid = uuid.UUID(identifier)
            inv = (
                db.query(Inventory)
                .options(joinedload(Inventory.product), joinedload(Inventory.warehouse))
                .filter(Inventory.id == val_uuid)
                .first()
            )
            if inv:
                return inv
        except ValueError:
            pass

        # Try SKU or Product ID
        try:
            prod_uuid = uuid.UUID(identifier)
            inv = (
                db.query(Inventory)
                .options(joinedload(Inventory.product), joinedload(Inventory.warehouse))
                .filter(Inventory.product_id == prod_uuid)
                .first()
            )
            if inv:
                return inv
        except ValueError:
            pass

        prod = db.query(Product).filter(Product.sku.ilike(identifier.strip())).first()
        if prod:
            inv = (
                db.query(Inventory)
                .options(joinedload(Inventory.product), joinedload(Inventory.warehouse))
                .filter(Inventory.product_id == prod.id)
                .first()
            )
            if inv:
                return inv

        return None

    @classmethod
    def resolve_warehouse(
        cls,
        db: Session,
        warehouse_id: Optional[UUID] = None,
        warehouse_name: Optional[str] = None,
    ) -> Warehouse:
        if warehouse_id:
            wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
            if wh:
                return wh

        if warehouse_name and warehouse_name.strip():
            w_name = warehouse_name.strip()
            wh = db.query(Warehouse).filter(Warehouse.name.ilike(w_name)).first()
            if wh:
                return wh

            # Create warehouse if user supplied a new name
            wh = Warehouse(
                name=w_name,
                location=w_name,
                country="Global",
                capacity_units=100000,
            )
            db.add(wh)
            db.flush()
            return wh

        # Default fallback warehouse
        first_wh = db.query(Warehouse).first()
        if first_wh:
            return first_wh

        new_wh = Warehouse(
            name="Central Distribution Hub",
            location="Austin, TX",
            country="United States",
            capacity_units=500000,
        )
        db.add(new_wh)
        db.flush()
        return new_wh

    @classmethod
    def create_item(cls, db: Session, data: InventoryCreate) -> Inventory:
        sku_clean = data.sku.strip()
        name_clean = data.name.strip()

        # 1. Resolve Warehouse
        warehouse = cls.resolve_warehouse(db, data.warehouse_id, data.warehouse_name)

        # 2. Resolve Product
        product = db.query(Product).filter(Product.sku.ilike(sku_clean)).first()
        if not product:
            product = Product(
                sku=sku_clean,
                name=name_clean,
                category=data.category.strip() or "General",
                price=data.price,
            )
            db.add(product)
            db.flush()
        else:
            # Update product attributes if supplied
            if name_clean:
                product.name = name_clean
            if data.category:
                product.category = data.category.strip()
            if data.price:
                product.price = data.price

        # 3. Check duplicate inventory route (warehouse + product)
        existing_inv = db.query(Inventory).filter(
            Inventory.warehouse_id == warehouse.id,
            Inventory.product_id == product.id,
        ).first()

        if existing_inv:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with SKU '{sku_clean}' is already registered in '{warehouse.name}'. Please edit the existing record or choose another facility.",
            )

        # 4. Create Inventory record
        inv = Inventory(
            warehouse_id=warehouse.id,
            product_id=product.id,
            stock_quantity=data.on_hand_quantity,
            reserved_quantity=data.reserved_quantity,
            safety_stock_level=data.safety_stock,
            reorder_level=data.reorder_point,
            reorder_quantity=data.reorder_quantity,
            average_daily_demand=data.average_daily_demand,
            lead_time_days=data.lead_time_days,
        )
        try:
            db.add(inv)
            db.commit()
            db.refresh(inv)
            return inv
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to persist inventory product to database: {str(e)}",
            )

    @classmethod
    def update_item(cls, db: Session, inv: Inventory, data: InventoryUpdate) -> Inventory:
        prod: Product = inv.product

        # If SKU is updated, check uniqueness
        if data.sku is not None:
            new_sku = data.sku.strip()
            if new_sku and (not prod or new_sku.lower() != prod.sku.lower()):
                existing_sku = db.query(Product).filter(
                    Product.sku.ilike(new_sku),
                    Product.id != inv.product_id,
                ).first()
                if existing_sku:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"SKU '{new_sku}' is already assigned to another product ('{existing_sku.name}').",
                    )
                prod.sku = new_sku

        if data.name is not None and data.name.strip():
            prod.name = data.name.strip()
        if data.category is not None and data.category.strip():
            prod.category = data.category.strip()
        if data.price is not None and data.price >= 0:
            prod.price = data.price

        # Update Warehouse if specified
        if data.warehouse_id or (data.warehouse_name and data.warehouse_name.strip()):
            new_wh = cls.resolve_warehouse(db, data.warehouse_id, data.warehouse_name)
            if new_wh.id != inv.warehouse_id:
                # Check route conflict
                existing_route = db.query(Inventory).filter(
                    Inventory.warehouse_id == new_wh.id,
                    Inventory.product_id == inv.product_id,
                    Inventory.id != inv.id,
                ).first()
                if existing_route:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Product is already assigned to '{new_wh.name}'.",
                    )
                inv.warehouse_id = new_wh.id

        # Update quantities
        if data.on_hand_quantity is not None:
            inv.stock_quantity = data.on_hand_quantity
        if data.reserved_quantity is not None:
            if data.reserved_quantity > (inv.stock_quantity or 0):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Reserved quantity ({data.reserved_quantity}) cannot exceed on-hand quantity ({inv.stock_quantity}).",
                )
            inv.reserved_quantity = data.reserved_quantity
        if data.safety_stock is not None:
            inv.safety_stock_level = data.safety_stock
        if data.reorder_point is not None:
            inv.reorder_level = data.reorder_point
        if data.reorder_quantity is not None:
            inv.reorder_quantity = data.reorder_quantity
        if data.average_daily_demand is not None:
            inv.average_daily_demand = data.average_daily_demand
        if data.lead_time_days is not None:
            inv.lead_time_days = data.lead_time_days

        try:
            db.commit()
            db.refresh(inv)
            return inv
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update inventory product: {str(e)}",
            )

    @classmethod
    def delete_item(cls, db: Session, inv: Inventory) -> None:
        """Safely delete inventory product, checking for foreign key constraints."""
        prod_id = inv.product_id

        # Check references in OrderItems
        order_item_count = db.query(OrderItem).filter(OrderItem.product_id == prod_id).count()
        # Check references in Sales
        sales_count = db.query(Sales).filter(Sales.product_id == prod_id).count()
        # Check references in Purchases
        purchase_count = db.query(Purchase).filter(Purchase.product_id == prod_id).count()

        conflicts = []
        if order_item_count > 0:
            conflicts.append(f"{order_item_count} customer order item(s)")
        if sales_count > 0:
            conflicts.append(f"{sales_count} sales historical record(s)")
        if purchase_count > 0:
            conflicts.append(f"{purchase_count} purchase order record(s)")

        if conflicts:
            conflict_msg = " and ".join(conflicts)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete product '{inv.product.name}' because it is actively referenced in {conflict_msg}.",
            )

        try:
            db.delete(inv)
            # If no other inventory records reference this product, we can also delete the product if safe
            remaining_inv = db.query(Inventory).filter(Inventory.product_id == prod_id, Inventory.id != inv.id).count()
            if remaining_inv == 0 and not conflicts:
                db.delete(inv.product)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete inventory item: {str(e)}",
            )

    @staticmethod
    def generate_csv_template() -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        headers = [
            "sku",
            "product_name",
            "category",
            "warehouse_name",
            "on_hand_quantity",
            "reserved_quantity",
            "safety_stock",
            "reorder_point",
            "reorder_quantity",
            "average_daily_demand",
            "lead_time_days",
            "price",
        ]
        writer.writerow(headers)
        writer.writerow([
            "IC-3NM-A18",
            "3nm Ultra AI Neural Processor",
            "Logic Silicon",
            "Austin Hub",
            45000,
            0,
            30000,
            35000,
            15000,
            1070,
            28,
            1250.00,
        ])
        writer.writerow([
            "HBM3E-24G",
            "High Bandwidth Memory 24GB",
            "Memory IC",
            "Memphis Hub",
            18500,
            1200,
            25000,
            28000,
            10000,
            1320,
            21,
            420.00,
        ])
        writer.writerow([
            "BATT-LFP-82K",
            "82kWh LFP Battery Cell Modules",
            "Energy Storage",
            "Dallas Depot",
            8200,
            400,
            6000,
            7500,
            4000,
            215,
            35,
            8900.00,
        ])
        return output.getvalue()

    @classmethod
    def preview_csv_import(
        cls,
        file_bytes: bytes,
        filename: str,
        db: Session,
    ) -> InventoryImportPreviewResponse:
        _clean_token_cache()

        if not filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file format. Only .csv files are supported.",
            )

        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum allowable limit of 5 MB.",
            )

        # Handle UTF-8 and UTF-8 BOM
        try:
            content = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                content = file_bytes.decode("latin-1")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Malformed character encoding. CSV must be valid UTF-8.",
                )

        f = io.StringIO(content)
        reader = csv.reader(f)
        try:
            raw_headers = next(reader)
        except StopIteration:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded CSV file is completely empty.",
            )

        # Map headers
        col_map: Dict[int, str] = {}
        for idx, h in enumerate(raw_headers):
            clean_h = sanitize_csv_cell(h).lower().replace(" ", "_")
            if clean_h in HEADER_ALIAS_MAP:
                col_map[idx] = HEADER_ALIAS_MAP[clean_h]

        if "sku" not in col_map.values():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required column 'sku' (or 'product_code') in CSV headers.",
            )
        if "name" not in col_map.values():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required column 'product_name' (or 'name') in CSV headers.",
            )

        # Pre-fetch existing products & warehouses to detect duplicates & match
        existing_products = {p.sku.lower(): p for p in db.query(Product).all()}
        warehouses = {w.name.lower(): w for w in db.query(Warehouse).all()}

        # Existing inventory routes: (warehouse_id, product_id)
        existing_routes = {(inv.warehouse_id, inv.product_id) for inv in db.query(Inventory).all()}

        seen_routes_in_file: Dict[Tuple[str, str], int] = {}
        seen_skus_in_file: Dict[str, int] = {}

        valid_records: List[Dict[str, Any]] = []
        errors: List[InventoryImportRowError] = []
        duplicate_count = 0

        row_num = 1
        for row in reader:
            row_num += 1
            if not row or not any(c.strip() for c in row):
                continue

            raw_dict: Dict[str, Any] = {}
            row_data: Dict[str, Any] = {}
            for idx, cell in enumerate(row):
                val = sanitize_csv_cell(cell)
                header_name = raw_headers[idx] if idx < len(raw_headers) else f"col_{idx}"
                raw_dict[header_name] = val
                target_field = col_map.get(idx)
                if target_field:
                    row_data[target_field] = val

            sku = (row_data.get("sku") or "").strip()
            name = (row_data.get("name") or "").strip()
            wh_name = (row_data.get("warehouse_name") or "").strip() or "Central Logistics Hub"

            if not sku:
                errors.append(InventoryImportRowError(
                    row=row_num,
                    field="sku",
                    message="Product SKU is required and cannot be empty.",
                    raw_data=raw_dict,
                ))
                continue

            if not name:
                errors.append(InventoryImportRowError(
                    row=row_num,
                    field="name",
                    message="Product name is required and cannot be empty.",
                    raw_data=raw_dict,
                ))
                continue

            sku_lower = sku.lower()
            wh_lower = wh_name.lower()
            route_key = (sku_lower, wh_lower)

            # Intra-file duplicate check
            if route_key in seen_routes_in_file:
                first_row = seen_routes_in_file[route_key]
                errors.append(InventoryImportRowError(
                    row=row_num,
                    field="sku",
                    message=f"Duplicate route for SKU '{sku}' at warehouse '{wh_name}' already appeared in row {first_row}.",
                    raw_data=raw_dict,
                ))
                duplicate_count += 1
                continue
            seen_routes_in_file[route_key] = row_num

            # DB duplicate check
            prod_match = existing_products.get(sku_lower)
            wh_match = warehouses.get(wh_lower)
            if prod_match and wh_match and (wh_match.id, prod_match.id) in existing_routes:
                errors.append(InventoryImportRowError(
                    row=row_num,
                    field="sku",
                    message=f"Product with SKU '{sku}' at warehouse '{wh_name}' already exists in PostgreSQL database.",
                    raw_data=raw_dict,
                ))
                duplicate_count += 1
                continue

            # Validate numeric fields
            row_errors = []
            def parse_non_neg_int(val_str: Optional[str], field_name: str, default: int = 0) -> int:
                if not val_str or not val_str.strip():
                    return default
                try:
                    v = int(float(val_str.strip()))
                    if v < 0:
                        row_errors.append(f"{field_name} cannot be negative ({v}).")
                    return v
                except ValueError:
                    row_errors.append(f"Invalid numeric value for {field_name}: '{val_str}'.")
                    return default

            def parse_non_neg_float(val_str: Optional[str], field_name: str, default: Optional[float] = None) -> Optional[float]:
                if not val_str or not val_str.strip():
                    return default
                try:
                    v = float(val_str.strip())
                    if v < 0:
                        row_errors.append(f"{field_name} cannot be negative ({v}).")
                    return v
                except ValueError:
                    row_errors.append(f"Invalid numeric value for {field_name}: '{val_str}'.")
                    return default

            on_hand = parse_non_neg_int(row_data.get("on_hand_quantity"), "on_hand_quantity", 0)
            reserved = parse_non_neg_int(row_data.get("reserved_quantity"), "reserved_quantity", 0)
            safety = parse_non_neg_int(row_data.get("safety_stock"), "safety_stock", 0)
            reorder = parse_non_neg_int(row_data.get("reorder_point"), "reorder_point", 0)
            reorder_qty = parse_non_neg_int(row_data.get("reorder_quantity"), "reorder_quantity", 0)
            avg_demand = parse_non_neg_float(row_data.get("average_daily_demand"), "average_daily_demand", None)
            lead_time = parse_non_neg_int(row_data.get("lead_time_days"), "lead_time_days", 14)
            price = parse_non_neg_float(row_data.get("price"), "price", 100.0)

            if reserved > on_hand:
                row_errors.append(f"Reserved quantity ({reserved}) cannot exceed on-hand quantity ({on_hand}).")

            if row_errors:
                for err in row_errors:
                    errors.append(InventoryImportRowError(
                        row=row_num,
                        field="validation",
                        message=err,
                        raw_data=raw_dict,
                    ))
                continue

            available, days_of_supply, buffer_pct, st = cls.calculate_metrics(
                stock=on_hand,
                reserved=reserved,
                safety=safety,
                reorder=reorder,
                avg_demand=avg_demand,
            )

            valid_records.append({
                "row_num": row_num,
                "sku": sku,
                "name": name,
                "category": (row_data.get("category") or "General").strip(),
                "warehouse_name": wh_name,
                "on_hand_quantity": on_hand,
                "reserved_quantity": reserved,
                "available_quantity": available,
                "safety_stock": safety,
                "reorder_point": reorder,
                "reorder_quantity": reorder_qty,
                "average_daily_demand": avg_demand,
                "lead_time_days": lead_time,
                "price": price or 100.0,
                "days_of_supply": days_of_supply,
                "buffer_health_percentage": buffer_pct,
                "status": st,
            })

        preview_token = str(uuid.uuid4())
        TOKEN_CACHE[preview_token] = (time.time(), valid_records, errors, duplicate_count)

        total_rows = row_num - 1
        valid_rows = len(valid_records)
        invalid_rows = max(0, total_rows - valid_rows - duplicate_count)

        return InventoryImportPreviewResponse(
            preview_token=preview_token,
            total_rows=total_rows,
            valid_rows=valid_rows,
            invalid_rows=max(0, invalid_rows),
            duplicate_rows=duplicate_count,
            errors=errors,
            preview_records=valid_records[:50],
        )

    @classmethod
    def confirm_csv_import(
        cls,
        preview_token: str,
        mode: str,
        db: Session,
    ) -> InventoryImportConfirmResponse:
        _clean_token_cache()

        if preview_token not in TOKEN_CACHE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Import preview session expired or invalid. Please re-upload your CSV.",
            )

        _, valid_records, errors, duplicate_count = TOKEN_CACHE[preview_token]

        if mode == "fail_on_duplicates" and duplicate_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Import cancelled: {duplicate_count} duplicate record(s) detected and 'Fail on duplicates' mode was selected.",
            )

        if not valid_records:
            return InventoryImportConfirmResponse(
                success=True,
                imported_count=0,
                skipped_count=duplicate_count,
                invalid_count=len(errors),
                imported_items=[],
                errors=errors,
            )

        imported_items = []
        try:
            for rec in valid_records:
                data = InventoryCreate(
                    sku=rec["sku"],
                    name=rec["name"],
                    category=rec["category"],
                    warehouse_name=rec["warehouse_name"],
                    on_hand_quantity=rec["on_hand_quantity"],
                    reserved_quantity=rec["reserved_quantity"],
                    safety_stock=rec["safety_stock"],
                    reorder_point=rec["reorder_point"],
                    reorder_quantity=rec["reorder_quantity"],
                    average_daily_demand=rec["average_daily_demand"],
                    lead_time_days=rec["lead_time_days"],
                    price=rec["price"],
                )
                inv = cls.create_item(db, data)
                imported_items.append(cls.serialize_inventory(inv, db))

            TOKEN_CACHE.pop(preview_token, None)
            return InventoryImportConfirmResponse(
                success=True,
                imported_count=len(imported_items),
                skipped_count=duplicate_count,
                invalid_count=len(errors),
                imported_items=imported_items,
                errors=errors,
            )
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to commit CSV records to PostgreSQL: {str(e)}",
            )

    @classmethod
    def recalculate_buffers(cls, db: Session, product_ids: Optional[List[UUID]] = None) -> RecalculateBufferResponse:
        """
        Recalculates buffer metrics using actual saved values:
        1. Checks observation data via inventory_metrics for statistical safety-stock modeling.
        2. Where daily demand and lead time are saved, calculates parametric safety stock and reorder point.
        3. Persists updated thresholds to PostgreSQL.
        4. Reports exact counts and details without fabricating fake demand.
        """
        query = db.query(Inventory)
        if product_ids:
            query = query.filter(Inventory.product_id.in_(product_ids))
        items = query.all()

        if not items:
            return RecalculateBufferResponse(
                success=True,
                message="No inventory records available to recalculate.",
                total_items=0,
                recalculated_count=0,
                statistical_count=0,
                parametric_count=0,
                insufficient_data_count=0,
                details=[],
            )

        statistical_count = 0
        parametric_count = 0
        insufficient_data_count = 0
        details = []

        # Run statistical calculation
        try:
            stat_metrics = inventory_metrics(db, items)
        except Exception:
            stat_metrics = {}

        for inv in items:
            m = stat_metrics.get(inv.id, {})
            name = inv.product.name if inv.product else "Item"
            sku = inv.product.sku if inv.product else str(inv.id)[:8]

            if m.get("status") == "ready":
                inv.safety_stock_level = m.get("safety_stock", inv.safety_stock_level)
                inv.reorder_level = m.get("reorder_point", inv.reorder_level)
                inv.reorder_quantity = m.get("replenishment_quantity", inv.reorder_quantity)
                statistical_count += 1
                details.append({
                    "sku": sku,
                    "name": name,
                    "method": "statistical_observation",
                    "safety_stock": inv.safety_stock_level,
                    "reorder_point": inv.reorder_level,
                    "reorder_quantity": inv.reorder_quantity,
                    "status": "recalculated",
                })
            elif inv.average_daily_demand and float(inv.average_daily_demand) > 0 and inv.lead_time_days and inv.lead_time_days > 0:
                # Parametric buffer calculation from saved inputs
                lead = float(inv.lead_time_days)
                avg = float(inv.average_daily_demand)
                # 95% service level factor = 1.645, estimated demand CV = 0.25, lead time CV = 0.15
                sigma = math.sqrt(lead * (0.25 * avg)**2 + avg**2 * (0.15 * lead)**2)
                calc_safety = max(inv.safety_stock_level or 0, math.ceil(1.645 * sigma))
                calc_reorder = math.ceil(avg * lead + calc_safety)
                calc_reorder_qty = max(inv.reorder_quantity or 0, math.ceil(avg * 14))

                inv.safety_stock_level = calc_safety
                inv.reorder_level = calc_reorder
                inv.reorder_quantity = calc_reorder_qty
                parametric_count += 1
                details.append({
                    "sku": sku,
                    "name": name,
                    "method": "parametric_formula",
                    "safety_stock": calc_safety,
                    "reorder_point": calc_reorder,
                    "reorder_quantity": calc_reorder_qty,
                    "status": "recalculated",
                })
            else:
                insufficient_data_count += 1
                reason = m.get("reason") or "Missing daily demand observations and average daily demand / lead time fields."
                details.append({
                    "sku": sku,
                    "name": name,
                    "method": "insufficient_data",
                    "reason": reason,
                    "status": "skipped",
                })

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to persist recalculated buffer thresholds: {str(e)}",
            )

        total_updated = statistical_count + parametric_count
        msg = f"Buffer recalculated for {total_updated} item(s): {statistical_count} via statistical observation modeling, {parametric_count} via lead-time/demand formulas. {insufficient_data_count} item(s) had insufficient data."

        return RecalculateBufferResponse(
            success=True,
            message=msg,
            total_items=len(items),
            recalculated_count=total_updated,
            statistical_count=statistical_count,
            parametric_count=parametric_count,
            insufficient_data_count=insufficient_data_count,
            details=details,
        )

    @staticmethod
    def get_warehouses(db: Session) -> List[WarehouseOption]:
        whs = db.query(Warehouse).order_by(Warehouse.name.asc()).all()
        return [WarehouseOption.model_validate(w) for w in whs]
