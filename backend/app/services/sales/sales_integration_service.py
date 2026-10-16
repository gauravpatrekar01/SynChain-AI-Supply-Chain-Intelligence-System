"""
Sales & Supply-Chain Integration Service for SynChain AI.
Bridges sales forecasted unit demand with warehouse inventory buffers,
supplier lead times, and incoming shipments to evaluate replenishment gaps,
stockout risks, and procurement recommendations without mutating operational data.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.postgres.models import SalesTransaction, Inventory, Product, Shipment, Supplier
from app.schemas.sales import (
    SalesSupplyChainIntegrationItem,
    SalesSupplyChainIntegrationResponse,
)
from app.services.sales.sales_forecasting_service import SalesForecastingService


class SalesIntegrationService:

    @classmethod
    def evaluate_supply_chain_integration(cls, db: Session) -> SalesSupplyChainIntegrationResponse:
        """
        Translates sales forecasts (units sold) into inventory replenishment requirements,
        checks against on-hand stock and incoming shipments, and evaluates stockout risks.
        """
        # 1. Distinct products from sales transactions
        sales_prods = (
            db.query(
                SalesTransaction.product_id,
                SalesTransaction.product_name,
                SalesTransaction.product_category,
            )
            .distinct()
            .all()
        )

        if not sales_prods:
            return SalesSupplyChainIntegrationResponse(
                has_data=False,
                matched_products_count=0,
                unmatched_products_count=0,
                at_risk_stockout_count=0,
                total_shortfall_units=0.0,
                items=[],
                summary_insight="No sales products recorded yet. Import sales transactions to link forecasted demand to inventory buffers.",
            )

        # 2. Get operational DB products and inventory records
        db_products = db.query(Product).all()
        prod_sku_map = {p.sku.strip().upper(): p for p in db_products if p.sku}

        inventory_records = db.query(Inventory).all()
        inv_by_prod_id = {}
        for inv in inventory_records:
            inv_by_prod_id[str(inv.product_id)] = inv

        # 3. Incoming shipments
        active_shipments = (
            db.query(Shipment)
            .filter(Shipment.status.in_(["in_transit", "pending", "delayed"]))
            .all()
        )

        items: List[SalesSupplyChainIntegrationItem] = []
        matched_count = 0
        unmatched_count = 0
        stockout_count = 0
        total_shortfall = 0.0

        for s_pid, s_pname, s_pcat in sales_prods:
            clean_sku = s_pid.strip().upper()
            matched_prod = prod_sku_map.get(clean_sku)

            available_stock = 0
            safety_stock = 0
            reorder_point = 0
            incoming_units = 0
            mapping_status = "No Component Mapping Available"

            if matched_prod:
                matched_count += 1
                matched_db_id = str(matched_prod.id)
                inv = inv_by_prod_id.get(matched_db_id)
                if inv:
                    on_hand = inv.stock_quantity or 0
                    reserved = inv.reserved_quantity or 0
                    available_stock = max(0, on_hand - reserved)
                    safety_stock = inv.safety_stock_level or 0
                    reorder_point = inv.reorder_level or 0
                    incoming_units = inv.incoming_quantity or 0
                    mapping_status = "1:1 Direct Product"
                else:
                    mapping_status = "Product Exists; No Warehouse Inventory Buffer Configured"
            else:
                unmatched_count += 1
                matched_db_id = None

            # Calculate daily unit demand from recent sales
            daily_sales_avg = (
                db.query(
                    func.coalesce(
                        func.sum(SalesTransaction.quantity_sold - SalesTransaction.return_quantity), 0
                    )
                )
                .filter(SalesTransaction.product_id == s_pid)
                .scalar()
            )
            # Baseline daily rate (estimate over 30 days or available span)
            tx_count = db.query(SalesTransaction).filter(SalesTransaction.product_id == s_pid).count()
            daily_rate = max(1.0, float(daily_sales_avg) / max(1.0, float(tx_count)))

            demand_30d = round(daily_rate * 30.0, 1)
            demand_60d = round(daily_rate * 60.0, 1)
            demand_90d = round(daily_rate * 90.0, 1)

            net_available = available_stock + incoming_units
            stockout_30d = net_available < demand_30d

            days_to_stockout = None
            if daily_rate > 0:
                days_to_stockout = round(net_available / daily_rate, 1)

            shortfall = 0.0
            if stockout_30d:
                shortfall = round(demand_30d - net_available, 1)
                total_shortfall += shortfall
                stockout_count += 1
                action = f"Issue urgent purchase order for at least {int(shortfall + safety_stock):,} units to avert stockout."
            elif net_available <= safety_stock:
                action = f"Safety stock breach: buffer is below minimum floor ({safety_stock} units). Trigger replenishment."
            else:
                action = "Buffer healthy: available stock covers 30-day forecast horizon."

            items.append(
                SalesSupplyChainIntegrationItem(
                    sales_product_id=s_pid,
                    product_name=s_pname,
                    category=s_pcat,
                    matched_db_product_id=matched_db_id,
                    matched_sku=matched_prod.sku if matched_prod else None,
                    available_stock_units=available_stock,
                    safety_stock_units=safety_stock,
                    reorder_point=reorder_point,
                    incoming_shipment_units=incoming_units,
                    forecast_demand_units_30d=demand_30d,
                    forecast_demand_units_60d=demand_60d,
                    forecast_demand_units_90d=demand_90d,
                    stockout_predicted_30d=stockout_30d,
                    days_to_stockout=days_to_stockout,
                    replenishment_shortfall_units=shortfall,
                    component_mapping_status=mapping_status,
                    recommended_action=action,
                )
            )

        summary = (
            f"Evaluated {len(items)} sales products: {matched_count} mapped to operational SKUs. "
            f"{stockout_count} product(s) face projected stockout within 30 days (total shortfall {int(total_shortfall):,} units)."
            if stockout_count > 0
            else f"All {matched_count} mapped products have sufficient inventory buffer coverage for the next 30 days."
        )

        return SalesSupplyChainIntegrationResponse(
            has_data=True,
            matched_products_count=matched_count,
            unmatched_products_count=unmatched_count,
            at_risk_stockout_count=stockout_count,
            total_shortfall_units=round(total_shortfall, 1),
            items=items,
            summary_insight=summary,
        )
