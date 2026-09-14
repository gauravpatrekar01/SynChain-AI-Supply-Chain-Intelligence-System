import uuid
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.postgres.models import Product, Supplier, Warehouse, Inventory
from decimal import Decimal

class NormalizationService:
    @staticmethod
    def _safe_decimal(value, default=0.0):
        try:
            return Decimal(str(value))
        except:
            return Decimal(str(default))

    @staticmethod
    def _safe_str(value, default="Unknown"):
        return str(value) if value else default

    @classmethod
    def normalize_items(cls, db: Session, raw_items: List[Dict[str, Any]], field_map: Dict[str, str] = None) -> int:
        field_map = field_map or {}
        count = 0
        for item in raw_items:
            sku = str(item.get(field_map.get("sku", "item_code")) or item.get("id", uuid.uuid4()))
            name = cls._safe_str(item.get(field_map.get("name", "item_name")) or sku)
            category = cls._safe_str(item.get(field_map.get("category", "item_group")))
            price = cls._safe_decimal(item.get(field_map.get("price", "standard_rate")))

            product = db.query(Product).filter(Product.sku == sku).first()
            if not product:
                product = Product(sku=sku, name=name, category=category, price=price)
                db.add(product)
            else:
                product.name = name
                product.category = category
                product.price = price
            count += 1
        db.commit()
        return count

    @classmethod
    def normalize_suppliers(cls, db: Session, raw_suppliers: List[Dict[str, Any]], field_map: Dict[str, str] = None) -> int:
        field_map = field_map or {}
        count = 0
        for sup in raw_suppliers:
            name = cls._safe_str(sup.get(field_map.get("name", "supplier_name")) or sup.get("name"))
            
            supplier = db.query(Supplier).filter(Supplier.name == name).first()
            tier = cls._safe_str(sup.get(field_map.get("tier", "supplier_group")), "Tier 1")
            country = cls._safe_str(sup.get(field_map.get("country", "country")), "Unknown")
            
            if not supplier:
                supplier = Supplier(
                    name=name,
                    tier=tier,
                    category="General",
                    country=country,
                    reliability_score=Decimal("80.0"),
                    spend_annual_usd=Decimal("0.0"),
                    health_status="Good"
                )
                db.add(supplier)
            else:
                supplier.tier = tier
                supplier.country = country
            count += 1
        db.commit()
        return count

    @classmethod
    def normalize_warehouses(cls, db: Session, raw_warehouses: List[Dict[str, Any]], field_map: Dict[str, str] = None) -> int:
        field_map = field_map or {}
        count = 0
        for wh in raw_warehouses:
            name = cls._safe_str(wh.get(field_map.get("name", "warehouse_name")) or wh.get("name"))
            
            warehouse = db.query(Warehouse).filter(Warehouse.name == name).first()
            if not warehouse:
                warehouse = Warehouse(
                    name=name,
                    location="Unknown",
                    country="Unknown",
                    capacity_units=10000
                )
                db.add(warehouse)
            count += 1
        db.commit()
        return count

    @classmethod
    def normalize_inventory(cls, db: Session, raw_inventory: List[Dict[str, Any]], field_map: Dict[str, str] = None) -> int:
        field_map = field_map or {}
        count = 0
        for inv in raw_inventory:
            sku = str(inv.get(field_map.get("product_sku", "item_code")))
            wh_name = str(inv.get(field_map.get("warehouse_name", "warehouse")))
            qty = int(float(inv.get(field_map.get("quantity", "actual_qty")) or 0))

            product = db.query(Product).filter(Product.sku == sku).first()
            warehouse = db.query(Warehouse).filter(Warehouse.name == wh_name).first()
            
            if product and warehouse:
                inventory = db.query(Inventory).filter(
                    Inventory.warehouse_id == warehouse.id,
                    Inventory.product_id == product.id
                ).first()
                if not inventory:
                    inventory = Inventory(
                        warehouse_id=warehouse.id,
                        product_id=product.id,
                        stock_quantity=qty
                    )
                    db.add(inventory)
                else:
                    inventory.stock_quantity = qty
                count += 1
        db.commit()
        return count
