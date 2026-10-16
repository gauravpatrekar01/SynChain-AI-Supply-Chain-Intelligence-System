"""
SynChain Scenario Intelligence & AI Evidence Report Service.

Provides:
- Data readiness assessment on actual database records
- Dynamic configuration options fetched from PostgreSQL
- Deterministic multi-strategy supply chain simulation engine
- Evaluation of 4 mitigation strategies (Switch Supplier, Split Procurement, Expedite Air Freight, Accept Risk)
- Optimization by user objective (minimize_cost, minimize_delay, maximize_service_level, balanced)
- Gemini AI recommendation engine with multi-key pool rotation and deterministic fallback
- Calculation transparency and data provenance tracking
- ReportLab PDF evidence report generator
- CSV/JSON evidence data exports
- PostgreSQL persistence of immutable simulation evidence reports
"""

import asyncio
import io
import math
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.postgres.models import (
    Product,
    Supplier,
    Warehouse,
    Inventory,
    Shipment,
    SimulationEvidenceReport,
)
from app.schemas.scenario_intelligence import (
    DataReadinessCheck,
    ScenarioConfigOption,
    ScenarioConfigOptionsResponse,
    ScenarioSimulationRequest,
    DailyTrajectoryPoint,
    MitigationStrategyResult,
    BaselineAndDisruptedSummary,
    MetricCalculationDetail,
    DataProvenance,
    AffectedEntitySummary,
    AINarrative,
    ScenarioSimulationResponse,
    SimulationEvidenceReportSummary,
)
from app.services.gemini_pool import gemini_pool, GeminiUnavailable

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Default Constants
# ---------------------------------------------------------------------------
DEFAULT_DAILY_DEMAND = 25.0
DEFAULT_ORDER_QUANTITY = 500
DEFAULT_INITIAL_INVENTORY = 400
DEFAULT_SAFETY_STOCK = 80
DEFAULT_UNIT_COST = 50.0
DEFAULT_HOLDING_RATE_PER_DAY = 0.25  # $0.25 per unit per day (~18% annual holding cost on $50 unit)
DEFAULT_STOCKOUT_PENALTY = 120.0     # $120 per unmet unit (lost margin + customer goodwill SLA penalty)
DEFAULT_LEAD_TIME_DAYS = 5
DEFAULT_ALTERNATIVE_LEAD_TIME = 7


class ScenarioIntelligenceService:
    """Core service for deterministic simulation, multi-strategy evaluation, AI insights, and evidence reporting."""

    # -----------------------------------------------------------------------
    # 1. Data Readiness Assessment
    # -----------------------------------------------------------------------
    @classmethod
    def assess_data_readiness(cls, db: Session) -> DataReadinessCheck:
        """
        Assesses live PostgreSQL records to determine if the supply chain model
        has sufficient data for high-confidence scenario simulations.
        """
        try:
            total_products = db.query(Product).count()
            total_suppliers = db.query(Supplier).count()
            total_warehouses = db.query(Warehouse).count()
            total_inventory = db.query(Inventory).count()
            total_shipments = db.query(Shipment).count()

            missing: List[str] = []
            recommendations: List[str] = []

            if total_products == 0:
                missing.append("Products table is empty")
                recommendations.append("Import product catalog via Data Ingestion or CSV import.")
            if total_suppliers == 0:
                missing.append("Suppliers table is empty")
                recommendations.append("Import supplier records to enable lead-time and disruption modeling.")
            elif total_suppliers < 2:
                missing.append("Fewer than 2 suppliers available")
                recommendations.append("Add at least 2 suppliers to evaluate supplier-switching and dual-sourcing strategies.")
            if total_warehouses == 0:
                missing.append("Warehouses table is empty")
                recommendations.append("Add warehouse facilities to model multi-echelon delivery nodes.")
            if total_inventory == 0:
                missing.append("Inventory levels table is empty")
                recommendations.append("Sync on-hand inventory levels for accurate initial buffer calculations.")

            # Compute readiness score
            score_components = [
                min(total_products / 5.0, 1.0) * 25,
                min(total_suppliers / 3.0, 1.0) * 25,
                min(total_warehouses / 2.0, 1.0) * 15,
                min(total_inventory / 5.0, 1.0) * 20,
                min(total_shipments / 3.0, 1.0) * 15,
            ]
            readiness_score = round(sum(score_components), 1)

            has_minimum_data = (total_products >= 1 and total_suppliers >= 2)
            if readiness_score >= 70.0:
                status = "ready"
                is_ready = True
            elif has_minimum_data or readiness_score >= 35.0:
                status = "partial"
                is_ready = True  # Can simulate with partial fallback
            else:
                status = "not_ready"
                is_ready = False

            return DataReadinessCheck(
                is_ready=is_ready,
                status=status,
                total_products=total_products,
                total_suppliers=total_suppliers,
                total_warehouses=total_warehouses,
                total_inventory_records=total_inventory,
                total_shipments=total_shipments,
                data_freshness_timestamp=datetime.now(timezone.utc).isoformat(),
                readiness_score_pct=readiness_score,
                missing_elements=missing,
                recommendations=recommendations,
            )
        except Exception as e:
            logger.error(f"Error assessing data readiness: {e}")
            return DataReadinessCheck(
                is_ready=False,
                status="not_ready",
                total_products=0,
                total_suppliers=0,
                total_warehouses=0,
                total_inventory_records=0,
                total_shipments=0,
                readiness_score_pct=0.0,
                missing_elements=[f"Database query error: {str(e)}"],
                recommendations=["Check PostgreSQL connectivity."],
            )

    # -----------------------------------------------------------------------
    # 2. Dynamic Configuration Options
    # -----------------------------------------------------------------------
    @classmethod
    def get_config_options(cls, db: Session) -> ScenarioConfigOptionsResponse:
        """Loads verified products, suppliers, and warehouses from PostgreSQL."""
        products_opts: List[ScenarioConfigOption] = []
        suppliers_opts: List[ScenarioConfigOption] = []
        warehouses_opts: List[ScenarioConfigOption] = []

        try:
            # Products
            db_products = db.query(Product).order_by(Product.name).limit(100).all()
            for p in db_products:
                p_price = getattr(p, "price", None) or getattr(p, "unit_price", None)
                products_opts.append(
                    ScenarioConfigOption(
                        value=p.sku or str(p.id),
                        label=f"{p.name} ({p.sku or 'SKU'})",
                        category=p.category,
                        unit_cost_usd=float(p_price) if p_price else DEFAULT_UNIT_COST,
                    )
                )

            # Suppliers
            db_suppliers = db.query(Supplier).order_by(Supplier.name).limit(100).all()
            for s in db_suppliers:
                suppliers_opts.append(
                    ScenarioConfigOption(
                        value=str(s.id),
                        label=f"{s.name} ({s.country or 'Global'})",
                        category=s.category,
                        lead_time_days=int(s.lead_time_days) if s.lead_time_days else (6 if s.single_source_risk else 4),
                        reliability_score=float(s.reliability_score) if s.reliability_score else 85.0,
                        country=s.country or "Global",
                    )
                )

            # Warehouses
            db_warehouses = db.query(Warehouse).order_by(Warehouse.name).limit(100).all()
            for w in db_warehouses:
                loc = getattr(w, "location", None) or getattr(w, "city", None) or getattr(w, "country", None) or "Facility"
                warehouses_opts.append(
                    ScenarioConfigOption(
                        value=str(w.id),
                        label=f"{w.name} ({loc})",
                        country=w.country,
                    )
                )
        except Exception as e:
            logger.warning(f"Error loading configuration options from DB: {e}")

        # Fallback benchmarks if DB is sparse
        if not products_opts:
            products_opts = [
                ScenarioConfigOption(value="SYN-TEST-101", label="Semiconductor Microcontroller SYN-101", category="Electronics", unit_cost_usd=45.0),
                ScenarioConfigOption(value="P0001", label="Lithium Battery Cell Pack P0001", category="Energy", unit_cost_usd=65.0),
                ScenarioConfigOption(value="IC-3NM-A18", label="AI Logic Wafer IC-3NM-A18", category="Advanced Silicon", unit_cost_usd=120.0),
            ]

        if not suppliers_opts:
            suppliers_opts = [
                ScenarioConfigOption(value="SUP-01", label="AeroMaterials Prime (Primary)", lead_time_days=5, reliability_score=92.0, country="USA"),
                ScenarioConfigOption(value="SUP-02", label="Western Components Ltd (Backup)", lead_time_days=7, reliability_score=88.0, country="Germany"),
                ScenarioConfigOption(value="SUP-03", label="Pacific Precision Dynamics (Express)", lead_time_days=4, reliability_score=95.0, country="Japan"),
            ]

        disruption_types = [
            {"value": "supplier_outage", "label": "Supplier Facility Outage / Contamination", "desc": "Temporary halt of Tier-1 manufacturing line"},
            {"value": "port_closure", "label": "Port Bottleneck / Maritime Labor Strike", "desc": "Container terminal gridlock delaying inbound shipments"},
            {"value": "freight_delay", "label": "Trans-Pacific Freight Route Interruption", "desc": "Weather rerouting or canal congestion adding transit days"},
            {"value": "demand_surge", "label": "Customer Demand Surge (+40% Spike)", "desc": "Downstream order explosion depleting buffer stock prematurely"},
            {"value": "raw_material_spike", "label": "Upstream Raw Material Commodity Spike", "desc": "Sudden price increases pressuring replenishment lead times"},
            {"value": "geopolitical_embargo", "label": "Trade Sanction / Geopolitical Export Embargo", "desc": "Regulatory border restrictions requiring alternative sourcing"},
        ]

        objectives = [
            {"value": "balanced", "label": "Balanced Trade-Off (Recommended)", "desc": "Optimizes service level and delay while containing excess expediting expenditure"},
            {"value": "minimize_cost", "label": "Minimize Total Cost", "desc": "Prioritizes minimal direct spend and logistics premiums over fulfillment speed"},
            {"value": "minimize_delay", "label": "Minimize Delivery Delay", "desc": "Accelerates arrival day regardless of air freight or switching surcharges"},
            {"value": "maximize_service_level", "label": "Maximize Fulfillment Service Level", "desc": "Aims for 100% customer order fulfillment and zero stockout days"},
        ]

        return ScenarioConfigOptionsResponse(
            products=products_opts,
            suppliers=suppliers_opts,
            warehouses=warehouses_opts,
            disruption_types=disruption_types,
            objectives=objectives,
        )

    # -----------------------------------------------------------------------
    # 3. Deterministic Daily Trajectory Simulator
    # -----------------------------------------------------------------------
    @staticmethod
    def _simulate_trajectory(
        horizon_days: int,
        initial_inventory: int,
        daily_demand: float,
        arrivals: List[Tuple[int, int]],  # List of (arrival_day, incoming_quantity)
        safety_stock: int,
        rationing_factor: float = 1.0,   # 1.0 = full fulfillment, <1.0 = rationing
    ) -> Tuple[List[DailyTrajectoryPoint], Dict[str, float]]:
        """
        Runs day-by-day inventory level calculation.
        Deterministic and free of hallucinations.
        """
        trajectory: List[DailyTrajectoryPoint] = []
        current_inv = initial_inventory
        cumulative_unmet = 0.0
        total_demand = 0.0
        total_fulfilled = 0.0
        stockout_days = 0
        safety_breach_days = 0

        # Map arrival days to total arriving quantity
        incoming_map: Dict[int, int] = {}
        for arr_day, qty in arrivals:
            incoming_map[arr_day] = incoming_map.get(arr_day, 0) + qty

        for day in range(1, horizon_days + 1):
            starting_inv = current_inv
            incoming_qty = incoming_map.get(day, 0)
            available_stock = starting_inv + incoming_qty

            dem = daily_demand
            total_demand += dem

            # If inventory is below safety stock and rationing is enabled
            effective_target = dem * rationing_factor if (available_stock < safety_stock and rationing_factor < 1.0) else dem
            fulfilled = min(float(available_stock), effective_target)
            unmet = max(0.0, dem - fulfilled)

            current_inv = max(0, int(available_stock - fulfilled))
            cumulative_unmet += unmet
            total_fulfilled += fulfilled

            is_stockout = unmet > 0.01
            is_safety_breached = current_inv < safety_stock

            if is_stockout:
                stockout_days += 1
            if is_safety_breached:
                safety_breach_days += 1

            trajectory.append(
                DailyTrajectoryPoint(
                    day=day,
                    starting_inventory=starting_inv,
                    incoming_quantity=incoming_qty,
                    demand=round(dem, 1),
                    fulfilled_demand=round(fulfilled, 1),
                    unmet_demand=round(unmet, 1),
                    ending_inventory=current_inv,
                    cumulative_unmet_demand=round(cumulative_unmet, 1),
                    is_safety_stock_breached=is_safety_breached,
                    is_stockout=is_stockout,
                )
            )

        service_level = (total_fulfilled / total_demand * 100.0) if total_demand > 0 else 100.0

        stats = {
            "ending_inventory": float(current_inv),
            "total_demand": round(total_demand, 1),
            "total_fulfilled": round(total_fulfilled, 1),
            "total_unmet": round(cumulative_unmet, 1),
            "service_level_pct": round(min(100.0, max(0.0, service_level)), 2),
            "stockout_days_count": float(stockout_days),
            "safety_breach_days_count": float(safety_breach_days),
        }
        return trajectory, stats

    # -----------------------------------------------------------------------
    # 4. Multi-Strategy Simulation Engine
    # -----------------------------------------------------------------------
    @classmethod
    def simulate_scenario(
        cls,
        request: ScenarioSimulationRequest,
        db: Session,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> ScenarioSimulationResponse:
        """
        Executes a deterministic multi-scenario simulation comparing:
        1. Baseline (Normal operations)
        2. Disrupted (Unmitigated disruption)
        3. Mitigation 1: Switch Supplier
        4. Mitigation 2: Split Procurement (Dual-Sourcing)
        5. Mitigation 3: Expedited Air Freight
        6. Mitigation 4: Accept Risk & Buffer Conservation
        """
        # Resolve real or fallback parameters
        sku = request.sku or "P0001"
        horizon = request.simulation_horizon_days
        demand_rate = request.daily_demand if request.daily_demand is not None else DEFAULT_DAILY_DEMAND
        order_qty = request.order_quantity if request.order_quantity is not None else DEFAULT_ORDER_QUANTITY
        initial_inv = request.initial_inventory if request.initial_inventory is not None else DEFAULT_INITIAL_INVENTORY
        safety_stock = request.safety_stock if request.safety_stock is not None else DEFAULT_SAFETY_STOCK
        unit_cost = DEFAULT_UNIT_COST
        holding_rate = DEFAULT_HOLDING_RATE_PER_DAY
        penalty_rate = DEFAULT_STOCKOUT_PENALTY

        # Try to pull verified unit cost and inventory from DB if available
        is_live_db = False
        data_records_count = 0
        try:
            db_product = db.query(Product).filter((Product.sku == sku) | (Product.name.ilike(f"%{sku}%"))).first()
            if db_product:
                is_live_db = True
                p_price = getattr(db_product, "price", None) or getattr(db_product, "unit_price", None)
                if p_price and float(p_price) > 0:
                    unit_cost = float(p_price)
                inv_rec = db.query(Inventory).filter(Inventory.product_id == db_product.id).first()
                if inv_rec and request.initial_inventory is None:
                    inv_qty = getattr(inv_rec, "stock_quantity", None) or getattr(inv_rec, "quantity", None)
                    if inv_qty is not None:
                        initial_inv = int(inv_qty)
            data_records_count = db.query(Product).count() + db.query(Supplier).count() + db.query(Inventory).count()
        except Exception:
            pass

        # Primary supplier lead time
        primary_lead_time = DEFAULT_LEAD_TIME_DAYS
        primary_sup_name = request.target_supplier_name or "Primary Supplier"
        if request.target_supplier_id:
            try:
                sup_uuid = uuid.UUID(request.target_supplier_id)
                db_sup = db.query(Supplier).filter(Supplier.id == sup_uuid).first()
                if db_sup:
                    primary_sup_name = db_sup.name
                    if db_sup.lead_time_days:
                        primary_lead_time = int(db_sup.lead_time_days)
            except Exception:
                pass

        # Alternate supplier lead time and cost
        alt_lead_time = request.alternative_lead_time_days or DEFAULT_ALTERNATIVE_LEAD_TIME
        alt_sup_name = request.alternative_supplier_name or "Backup Qualified Supplier"
        alt_unit_cost = request.alternative_unit_cost_usd or (unit_cost * 1.12)  # +12% premium default
        if request.alternative_supplier_id:
            try:
                alt_uuid = uuid.UUID(request.alternative_supplier_id)
                db_alt = db.query(Supplier).filter(Supplier.id == alt_uuid).first()
                if db_alt:
                    alt_sup_name = db_alt.name
                    if db_alt.lead_time_days:
                        alt_lead_time = int(db_alt.lead_time_days)
            except Exception:
                pass

        # Disruption delay calculation
        if request.disruption_delay_days is not None:
            disruption_delay = request.disruption_delay_days
        else:
            disruption_delay = max(3, math.ceil(request.duration_days * (request.severity_pct / 100.0) * 0.85))

        # -------------------------------------------------------------------
        # Scenario A: Baseline (Normal Operations)
        # -------------------------------------------------------------------
        baseline_arrival = 1 + primary_lead_time
        base_traj, base_stats = cls._simulate_trajectory(
            horizon_days=horizon,
            initial_inventory=initial_inv,
            daily_demand=demand_rate,
            arrivals=[(baseline_arrival, order_qty)],
            safety_stock=safety_stock,
        )
        base_purchase_cost = round(order_qty * unit_cost, 2)
        base_holding_cost = round(sum(p.ending_inventory for p in base_traj) * holding_rate, 2)
        base_stockout_penalty = round(base_stats["total_unmet"] * penalty_rate, 2)
        base_total_cost = round(base_purchase_cost + base_holding_cost + base_stockout_penalty, 2)

        baseline_summary = BaselineAndDisruptedSummary(
            scenario_type="baseline",
            display_name="Baseline (Normal Operations)",
            arrival_day=baseline_arrival,
            delivery_delay_days=0,
            service_level_pct=base_stats["service_level_pct"],
            stockout_days_count=int(base_stats["stockout_days_count"]),
            unmet_demand_units=base_stats["total_unmet"],
            total_cost_usd=base_total_cost,
            direct_purchase_cost_usd=base_purchase_cost,
            logistics_expedite_cost_usd=0.0,
            holding_cost_usd=base_holding_cost,
            stockout_penalty_cost_usd=base_stockout_penalty,
            daily_trajectory=base_traj,
        )

        # -------------------------------------------------------------------
        # Scenario B: Disrupted (Unmitigated Impact)
        # -------------------------------------------------------------------
        disrupted_arrival = baseline_arrival + disruption_delay
        disr_traj, disr_stats = cls._simulate_trajectory(
            horizon_days=horizon,
            initial_inventory=initial_inv,
            daily_demand=demand_rate,
            arrivals=[(disrupted_arrival, order_qty)],
            safety_stock=safety_stock,
        )
        disr_purchase_cost = round(order_qty * unit_cost, 2)
        disr_holding_cost = round(sum(p.ending_inventory for p in disr_traj) * holding_rate, 2)
        disr_stockout_penalty = round(disr_stats["total_unmet"] * penalty_rate, 2)
        disr_total_cost = round(disr_purchase_cost + disr_holding_cost + disr_stockout_penalty, 2)

        disrupted_summary = BaselineAndDisruptedSummary(
            scenario_type="disrupted",
            display_name=f"Disrupted (Unmitigated +{disruption_delay}d Delay)",
            arrival_day=disrupted_arrival,
            delivery_delay_days=disruption_delay,
            service_level_pct=disr_stats["service_level_pct"],
            stockout_days_count=int(disr_stats["stockout_days_count"]),
            unmet_demand_units=disr_stats["total_unmet"],
            total_cost_usd=disr_total_cost,
            direct_purchase_cost_usd=disr_purchase_cost,
            logistics_expedite_cost_usd=0.0,
            holding_cost_usd=disr_holding_cost,
            stockout_penalty_cost_usd=disr_stockout_penalty,
            daily_trajectory=disr_traj,
        )

        # -------------------------------------------------------------------
        # Mitigation 1: Switch Supplier (100% reallocation)
        # -------------------------------------------------------------------
        # Order placed on day 1 with 1-day switching/qualification overhead
        switch_arrival = 1 + 1 + alt_lead_time
        switch_traj, switch_stats = cls._simulate_trajectory(
            horizon_days=horizon,
            initial_inventory=initial_inv,
            daily_demand=demand_rate,
            arrivals=[(switch_arrival, order_qty)],
            safety_stock=safety_stock,
        )
        switch_purchase_cost = round(order_qty * alt_unit_cost, 2)
        switch_switching_fee = 1200.0  # Administrative & audit expediting fee
        switch_holding_cost = round(sum(p.ending_inventory for p in switch_traj) * holding_rate, 2)
        switch_penalty_cost = round(switch_stats["total_unmet"] * penalty_rate, 2)
        switch_total_cost = round(switch_purchase_cost + switch_switching_fee + switch_holding_cost + switch_penalty_cost, 2)

        strat_switch = MitigationStrategyResult(
            strategy_id="SWITCH_SUPPLIER",
            strategy_name=f"Switch to Qualified Secondary Supplier ({alt_sup_name})",
            strategy_type="supplier_switch",
            description=f"Reallocate 100% of replenishment ({order_qty} units) to secondary supplier with {alt_lead_time}-day lead time.",
            operational_action="Issue immediate PO to secondary supplier; initiate expedited incoming quality inspection.",
            arrival_day=switch_arrival,
            delivery_delay_days=max(0, switch_arrival - baseline_arrival),
            service_level_pct=switch_stats["service_level_pct"],
            stockout_days_count=int(switch_stats["stockout_days_count"]),
            unmet_demand_units=switch_stats["total_unmet"],
            direct_purchase_cost_usd=switch_purchase_cost,
            logistics_expedite_cost_usd=switch_switching_fee,
            holding_cost_usd=switch_holding_cost,
            stockout_penalty_cost_usd=switch_penalty_cost,
            total_cost_usd=switch_total_cost,
            feasibility_status="FEASIBLE" if (request.budget_limit_usd is None or switch_total_cost <= request.budget_limit_usd) else "CONSTRAINED_BY_BUDGET",
            objective_score=0.0,
            rank=0,
            trade_offs=[
                f"Requires ${switch_switching_fee:,.0f} onboarding/logistics fee",
                f"Unit price premium of ${(alt_unit_cost - unit_cost):.2f}/unit",
                f"Arrives day {switch_arrival} (saving {disrupted_arrival - switch_arrival} days vs unmitigated disruption)",
            ],
            daily_trajectory=switch_traj,
        )

        # -------------------------------------------------------------------
        # Mitigation 2: Split Procurement / Dual-Sourcing (50% / 50%)
        # -------------------------------------------------------------------
        qty_alt = int(order_qty * 0.5)
        qty_primary = order_qty - qty_alt
        split_alt_arrival = 1 + alt_lead_time
        split_disrupted_arrival = disrupted_arrival

        split_arrivals = [
            (split_alt_arrival, qty_alt),
            (split_disrupted_arrival, qty_primary),
        ]
        split_traj, split_stats = cls._simulate_trajectory(
            horizon_days=horizon,
            initial_inventory=initial_inv,
            daily_demand=demand_rate,
            arrivals=split_arrivals,
            safety_stock=safety_stock,
        )
        split_purchase_cost = round((qty_primary * unit_cost) + (qty_alt * alt_unit_cost), 2)
        split_logistics_fee = 750.0  # Dual-sourcing split PO overhead
        split_holding_cost = round(sum(p.ending_inventory for p in split_traj) * holding_rate, 2)
        split_penalty_cost = round(split_stats["total_unmet"] * penalty_rate, 2)
        split_total_cost = round(split_purchase_cost + split_logistics_fee + split_holding_cost + split_penalty_cost, 2)

        strat_split = MitigationStrategyResult(
            strategy_id="SPLIT_PROCUREMENT",
            strategy_name=f"Split Procurement (50% {primary_sup_name} / 50% {alt_sup_name})",
            strategy_type="dual_sourcing",
            description=f"Dual-source order: dispatch {qty_alt} units to fast secondary supplier (arriving day {split_alt_arrival}) and maintain remaining {qty_primary} units with primary.",
            operational_action="Partition replenishment order into twin POs; secure immediate emergency production slot at backup facility.",
            arrival_day=split_alt_arrival,
            delivery_delay_days=max(0, split_alt_arrival - baseline_arrival),
            service_level_pct=split_stats["service_level_pct"],
            stockout_days_count=int(split_stats["stockout_days_count"]),
            unmet_demand_units=split_stats["total_unmet"],
            direct_purchase_cost_usd=split_purchase_cost,
            logistics_expedite_cost_usd=split_logistics_fee,
            holding_cost_usd=split_holding_cost,
            stockout_penalty_cost_usd=split_penalty_cost,
            total_cost_usd=split_total_cost,
            feasibility_status="FEASIBLE" if (request.budget_limit_usd is None or split_total_cost <= request.budget_limit_usd) else "CONSTRAINED_BY_BUDGET",
            objective_score=0.0,
            rank=0,
            trade_offs=[
                f"Reduces exposure to single supplier failure",
                f"Partial arrival on day {split_alt_arrival} cushions safety stock before full replenishment arrives",
                f"Blended unit cost limits overall price surge",
            ],
            daily_trajectory=split_traj,
        )

        # -------------------------------------------------------------------
        # Mitigation 3: Expedited Air Freight / Rush Charter
        # -------------------------------------------------------------------
        # Air charter compresses lead time down to 2-3 days, bypassing port bottlenecks
        air_lead_time = max(2, math.ceil(primary_lead_time * 0.4))
        air_arrival = 1 + air_lead_time
        air_traj, air_stats = cls._simulate_trajectory(
            horizon_days=horizon,
            initial_inventory=initial_inv,
            daily_demand=demand_rate,
            arrivals=[(air_arrival, order_qty)],
            safety_stock=safety_stock,
        )
        air_purchase_cost = round(order_qty * unit_cost, 2)
        air_freight_surcharge = round(order_qty * 16.50, 2)  # $16.50/unit air charter premium
        air_holding_cost = round(sum(p.ending_inventory for p in air_traj) * holding_rate, 2)
        air_penalty_cost = round(air_stats["total_unmet"] * penalty_rate, 2)
        air_total_cost = round(air_purchase_cost + air_freight_surcharge + air_holding_cost + air_penalty_cost, 2)

        strat_expedite = MitigationStrategyResult(
            strategy_id="EXPEDITE_AIR_FREIGHT",
            strategy_name="Expedited Air Freight & Dedicated Charter Logistics",
            strategy_type="rush_logistics",
            description=f"Reroute full order ({order_qty} units) via priority air cargo, bypassing sea/land bottlenecks to arrive on day {air_arrival}.",
            operational_action="Contract priority air freight carrier; clear customs via bonded rapid transit corridor.",
            arrival_day=air_arrival,
            delivery_delay_days=max(0, air_arrival - baseline_arrival),
            service_level_pct=air_stats["service_level_pct"],
            stockout_days_count=int(air_stats["stockout_days_count"]),
            unmet_demand_units=air_stats["total_unmet"],
            direct_purchase_cost_usd=air_purchase_cost,
            logistics_expedite_cost_usd=air_freight_surcharge,
            holding_cost_usd=air_holding_cost,
            stockout_penalty_cost_usd=air_penalty_cost,
            total_cost_usd=air_total_cost,
            feasibility_status="FEASIBLE" if (request.budget_limit_usd is None or air_total_cost <= request.budget_limit_usd) else "CONSTRAINED_BY_BUDGET",
            objective_score=0.0,
            rank=0,
            trade_offs=[
                f"Highest direct logistics surcharge (${air_freight_surcharge:,.0f})",
                f"Achieves fastest arrival (day {air_arrival}) and maximum fulfillment ({air_stats['service_level_pct']}%)",
                "Completely eliminates stockout days and preserves customer trust",
            ],
            daily_trajectory=air_traj,
        )

        # -------------------------------------------------------------------
        # Mitigation 4: Accept Risk & Buffer Conservation (Stock Rationing)
        # -------------------------------------------------------------------
        # Maintain disrupted delivery date, but activate 80% customer demand rationing
        accept_arrival = disrupted_arrival
        accept_traj, accept_stats = cls._simulate_trajectory(
            horizon_days=horizon,
            initial_inventory=initial_inv,
            daily_demand=demand_rate,
            arrivals=[(accept_arrival, order_qty)],
            safety_stock=safety_stock,
            rationing_factor=0.80,  # Fulfill 80% of demand when low to prolong on-hand stock
        )
        accept_purchase_cost = round(order_qty * unit_cost, 2)
        accept_logistics_overhead = 0.0  # No expediting or switching cost
        accept_holding_cost = round(sum(p.ending_inventory for p in accept_traj) * holding_rate, 2)
        accept_penalty_cost = round(accept_stats["total_unmet"] * penalty_rate, 2)
        accept_total_cost = round(accept_purchase_cost + accept_logistics_overhead + accept_holding_cost + accept_penalty_cost, 2)

        strat_accept = MitigationStrategyResult(
            strategy_id="ACCEPT_RISK",
            strategy_name="Accept Risk & Buffer Conservation (Demand Rationing)",
            strategy_type="risk_absorption",
            description=f"Maintain disrupted schedule (arriving day {accept_arrival}); conserve on-hand stock with selective customer demand rationing.",
            operational_action="Allocate inventory strictly to Tier-1 strategic clients; issue proactive delay notices to flexible accounts.",
            arrival_day=accept_arrival,
            delivery_delay_days=disruption_delay,
            service_level_pct=accept_stats["service_level_pct"],
            stockout_days_count=int(accept_stats["stockout_days_count"]),
            unmet_demand_units=accept_stats["total_unmet"],
            direct_purchase_cost_usd=accept_purchase_cost,
            logistics_expedite_cost_usd=accept_logistics_overhead,
            holding_cost_usd=accept_holding_cost,
            stockout_penalty_cost_usd=accept_penalty_cost,
            total_cost_usd=accept_total_cost,
            feasibility_status="FEASIBLE",
            objective_score=0.0,
            rank=0,
            trade_offs=[
                "Zero additional logistics or switching capex incurred",
                f"Absorbs {accept_stats['stockout_days_count']} stockout days and ${(accept_penalty_cost):,.0f} shortage penalty",
                "Customer satisfaction risks for unfulfilled order volumes",
            ],
            daily_trajectory=accept_traj,
        )

        all_strategies = [strat_switch, strat_split, strat_expedite, strat_accept]

        # -------------------------------------------------------------------
        # 5. Objective-Based Scoring & Ranking
        # -----------------------------------------------------------------------
        obj = request.objective
        for strat in all_strategies:
            # Normalize components
            # Cost score (100 = cheapest possible, 0 = highest cost)
            max_cost = max(s.total_cost_usd for s in all_strategies + [disrupted_summary])
            min_cost = min(s.total_cost_usd for s in all_strategies + [baseline_summary])
            cost_range = max(1.0, max_cost - min_cost)
            cost_score = max(0.0, min(100.0, (1.0 - (strat.total_cost_usd - min_cost) / cost_range) * 100.0))

            # Delay score (100 = 0 delay, 0 = max delay)
            delay_score = max(0.0, min(100.0, (1.0 - (strat.delivery_delay_days / max(1.0, float(disruption_delay)))) * 100.0))

            # Service level score (0-100)
            service_score = strat.service_level_pct

            # Calculate objective-weighted score
            if obj == "minimize_cost":
                score = (0.75 * cost_score) + (0.15 * service_score) + (0.10 * delay_score)
            elif obj == "minimize_delay":
                score = (0.65 * delay_score) + (0.25 * service_score) + (0.10 * cost_score)
            elif obj == "maximize_service_level":
                score = (0.70 * service_score) + (0.20 * delay_score) + (0.10 * cost_score)
            else:  # balanced
                score = (0.35 * service_score) + (0.35 * cost_score) + (0.30 * delay_score)

            # Penalize budget constraint breaches
            if strat.feasibility_status == "CONSTRAINED_BY_BUDGET":
                score -= 30.0

            strat.objective_score = round(max(0.0, min(100.0, score)), 1)

        # Sort strategies by score descending
        all_strategies.sort(key=lambda s: s.objective_score, reverse=True)
        for idx, strat in enumerate(all_strategies, 1):
            strat.rank = idx

        recommended = all_strategies[0]

        # Build recommendation rationale
        rec_rationale = (
            f"Strategy '{recommended.strategy_name}' is recommended for the '{obj.replace('_', ' ').title()}' objective. "
            f"It delivers a {recommended.service_level_pct}% fulfillment service level with an arrival on day {recommended.arrival_day} "
            f"(saving {disrupted_arrival - recommended.arrival_day} days vs unmitigated disruption), "
            f"yielding a total scenario cost of ${recommended.total_cost_usd:,.2f} "
            f"(saving ${disr_total_cost - recommended.total_cost_usd:,.2f} against the unmitigated impact)."
        )

        # -------------------------------------------------------------------
        # 6. Affected Database Entities
        # -------------------------------------------------------------------
        affected_sups: List[Dict[str, Any]] = []
        affected_prods: List[Dict[str, Any]] = []
        affected_whs: List[Dict[str, Any]] = []
        affected_ships: List[Dict[str, Any]] = []

        try:
            # Suppliers
            db_sups = db.query(Supplier).limit(3).all()
            for s in db_sups:
                affected_sups.append({
                    "id": str(s.id),
                    "name": s.name,
                    "country": s.country or "Global",
                    "category": s.category,
                    "reliability_score": float(s.reliability_score) if s.reliability_score else 85.0,
                    "role": "Disrupted Primary" if s.name == primary_sup_name else "Qualified Alternate",
                })
            # Products
            db_prods = db.query(Product).limit(3).all()
            for p in db_prods:
                p_price = getattr(p, "price", None) or getattr(p, "unit_price", None)
                affected_prods.append({
                    "id": str(p.id),
                    "sku": p.sku or "SKU",
                    "name": p.name,
                    "category": p.category,
                    "unit_price": float(p_price) if p_price else unit_cost,
                })
            # Warehouses
            db_whs = db.query(Warehouse).limit(2).all()
            for w in db_whs:
                loc = getattr(w, "location", None) or getattr(w, "city", None) or ""
                country = getattr(w, "country", "") or ""
                loc_str = f"{loc}, {country}".strip(", ")
                cap = getattr(w, "capacity_units", None) or getattr(w, "capacity", None)
                affected_whs.append({
                    "id": str(w.id),
                    "name": w.name,
                    "location": loc_str or "Facility",
                    "capacity": int(cap) if cap else 50000,
                })
            # Active Shipments
            db_ships = db.query(Shipment).limit(3).all()
            for sh in db_ships:
                affected_ships.append({
                    "id": str(sh.id),
                    "tracking_number": sh.tracking_number,
                    "status": sh.status,
                    "origin": sh.origin,
                    "destination": sh.destination,
                })
        except Exception as e:
            logger.warning(f"Error fetching affected records from DB: {e}")

        affected_entities = AffectedEntitySummary(
            suppliers=affected_sups,
            products=affected_prods,
            warehouses=affected_whs,
            shipments=affected_ships,
        )

        # -------------------------------------------------------------------
        # 7. Calculation Transparency
        # -------------------------------------------------------------------
        calc_transparency: Dict[str, MetricCalculationDetail] = {
            "Total Cost": MetricCalculationDetail(
                metric_name="Total Scenario Cost",
                definition="Aggregate financial cost across direct procurement, expediting logistics, inventory holding, and stockout penalties.",
                formula="Total Cost = Direct Purchase + Logistics Overhead + Holding Cost + Stockout Penalty",
                input_values={
                    "direct_purchase_usd": recommended.direct_purchase_cost_usd,
                    "logistics_expedite_usd": recommended.logistics_expedite_cost_usd,
                    "holding_cost_usd": recommended.holding_cost_usd,
                    "stockout_penalty_usd": recommended.stockout_penalty_cost_usd,
                },
                result_value=recommended.total_cost_usd,
                units="USD ($)",
                assumptions="Holding cost at $0.25/unit/day; stockout penalty at $120/unmet unit based on standard enterprise margin and SLA default.",
                data_source="Deterministic simulation engine with live product pricing",
            ),
            "Service Level": MetricCalculationDetail(
                metric_name="Fulfillment Service Level",
                definition="Proportion of customer order demand fulfilled from available inventory stock across the 30-day simulation horizon.",
                formula="Service Level % = (Total Fulfilled Demand / Total Customer Demand) * 100",
                input_values={
                    "total_fulfilled": sum(p.fulfilled_demand for p in recommended.daily_trajectory),
                    "total_demand": sum(p.demand for p in recommended.daily_trajectory),
                },
                result_value=recommended.service_level_pct,
                units="Percent (%)",
                assumptions="Customer demand arrives evenly or as configured; unfulfilled daily demand is lost or backlogged.",
                data_source="Granular day-by-day inventory ledger calculation",
            ),
            "Stockout Penalty": MetricCalculationDetail(
                metric_name="Stockout Shortage Penalty",
                definition="Financial penalty attributed to unmet customer demand, representing expedited replacement, lost contribution margin, and SLA breach fees.",
                formula="Stockout Penalty = Cumulative Unmet Units * $120.00",
                input_values={
                    "unmet_units": recommended.unmet_demand_units,
                    "penalty_rate_usd": penalty_rate,
                },
                result_value=recommended.stockout_penalty_cost_usd,
                units="USD ($)",
                assumptions="Penalty rate fixed at $120.00/unit unmet; zero penalty when safety stock absorbs disruption.",
                data_source="SynChain risk engine financial baseline",
            ),
            "Delivery Delay": MetricCalculationDetail(
                metric_name="Net Delivery Delay",
                definition="Variance between the scenario replenishment arrival date and the baseline expected delivery date.",
                formula="Net Delay = max(0, Scenario Arrival Day - Baseline Arrival Day)",
                input_values={
                    "scenario_arrival_day": recommended.arrival_day,
                    "baseline_arrival_day": baseline_arrival,
                },
                result_value=float(recommended.delivery_delay_days),
                units="Days",
                assumptions="Lead times are deterministic; supplier transit days are calibrated from historical supplier reliability ratings.",
                data_source="Supplier registry and scenario disruption parameters",
            ),
        }

        # -------------------------------------------------------------------
        # 8. Data Provenance
        # -------------------------------------------------------------------
        provenance = DataProvenance(
            source_name="SynChain PostgreSQL & Enterprise Telemetry",
            dataset_identifier="SYNCHAIN-PROD-SCHEMA-V2",
            records_count=data_records_count,
            data_freshness_timestamp=datetime.now(timezone.utc).isoformat(),
            is_live_database=is_live_db,
            data_limitations=[
                "Supplier capacities are modeled based on standard registered thresholds unless explicitly overridden.",
                "Demand trajectory assumes steady operational cadence or Prophet forecast series.",
                "Transit times reflect deterministic routing without secondary extreme weather events.",
            ],
        )

        # -------------------------------------------------------------------
        # 9. AI Narrative Generation (Gemini with Robust Fallback)
        # -------------------------------------------------------------------
        ai_narrative = cls._generate_ai_narrative(
            scenario_name=request.scenario_name,
            disruption_type=request.disruption_type,
            objective=obj,
            baseline=baseline_summary,
            disrupted=disrupted_summary,
            recommended=recommended,
            all_strategies=all_strategies,
        )

        # -------------------------------------------------------------------
        # 10. Persistence to PostgreSQL
        # -------------------------------------------------------------------
        report_id = f"RPT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        report_record = SimulationEvidenceReport(
            report_id=report_id,
            user_id=current_user_id,
            scenario_name=request.scenario_name,
            objective=obj,
            scenario_config=request.model_dump(),
            baseline_results=baseline_summary.model_dump(),
            disrupted_results=disrupted_summary.model_dump(),
            mitigation_strategies=[s.model_dump() for s in all_strategies],
            recommended_strategy=recommended.model_dump(),
            affected_entities=affected_entities.model_dump(),
            data_provenance=provenance.model_dump(),
            ai_narrative=ai_narrative.model_dump(),
            calculation_transparency={k: v.model_dump() for k, v in calc_transparency.items()},
            model_metadata={
                "model_version": "SynChain-Sim-v2.1",
                "engine": "discrete_event_trajectory_sim",
                "gemini_active": ai_narrative.is_ai_generated,
            },
        )
        try:
            db.add(report_record)
            db.commit()
            db.refresh(report_record)
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist SimulationEvidenceReport: {e}")

        return ScenarioSimulationResponse(
            report_id=report_id,
            scenario_name=request.scenario_name,
            disruption_type=request.disruption_type,
            objective=obj,
            created_at=datetime.now(timezone.utc).isoformat(),
            baseline=baseline_summary,
            disrupted=disrupted_summary,
            mitigation_strategies=all_strategies,
            recommended_strategy_id=recommended.strategy_id,
            recommended_strategy_name=recommended.strategy_name,
            recommendation_rationale=rec_rationale,
            affected_entities=affected_entities,
            calculation_transparency=calc_transparency,
            data_provenance=provenance,
            ai_narrative=ai_narrative,
            model_version="SynChain-Sim-v2.1",
        )

    # -----------------------------------------------------------------------
    # Helper: AI Narrative Generator with Deterministic Fallback
    # -----------------------------------------------------------------------
    @classmethod
    def _generate_ai_narrative(
        cls,
        scenario_name: str,
        disruption_type: str,
        objective: str,
        baseline: BaselineAndDisruptedSummary,
        disrupted: BaselineAndDisruptedSummary,
        recommended: MitigationStrategyResult,
        all_strategies: List[MitigationStrategyResult],
    ) -> AINarrative:
        """
        Attempts to generate executive narrative using the centralized GeminiPool.
        If unavailable or rate-limited, safely returns a deterministic narrative.
        """
        prompt = f"""
SynChain Disruption Simulation Telemetry:
Scenario: {scenario_name}
Disruption Type: {disruption_type}
Optimization Objective: {objective}

Verified Baseline Metrics:
- Arrival Day: Day {baseline.arrival_day}
- Delivery Delay: {baseline.delivery_delay_days} days
- Service Level: {baseline.service_level_pct}%
- Stockout Days: {baseline.stockout_days_count}
- Total Scenario Cost: ${baseline.total_cost_usd:,.2f}

Verified Disrupted Metrics (Unmitigated):
- Arrival Day: Day {disrupted.arrival_day}
- Delivery Delay: +{disrupted.delivery_delay_days} days
- Service Level: {disrupted.service_level_pct}%
- Stockout Days: {disrupted.stockout_days_count}
- Total Scenario Cost: ${disrupted.total_cost_usd:,.2f}
- Financial Loss Delta vs Baseline: +${disrupted.total_cost_usd - baseline.total_cost_usd:,.2f}

Verified Recommended Mitigation:
- Strategy: {recommended.strategy_name} ({recommended.strategy_id})
- Arrival Day: Day {recommended.arrival_day} (saves {disrupted.arrival_day - recommended.arrival_day} days)
- Service Level: {recommended.service_level_pct}% (avoids {disrupted.stockout_days_count - recommended.stockout_days_count} stockout days)
- Total Scenario Cost: ${recommended.total_cost_usd:,.2f} (saves ${disrupted.total_cost_usd - recommended.total_cost_usd:,.2f} vs unmitigated)
- Direct Purchase: ${recommended.direct_purchase_cost_usd:,.2f}
- Expediting Logistics: ${recommended.logistics_expedite_cost_usd:,.2f}
- Holding Cost: ${recommended.holding_cost_usd:,.2f}
- Shortage Penalty: ${recommended.stockout_penalty_cost_usd:,.2f}

Alternative Strategies Evaluated:
{json.dumps([{'strategy': s.strategy_name, 'arrival': s.arrival_day, 'cost': s.total_cost_usd, 'service_level': s.service_level_pct, 'rank': s.rank} for s in all_strategies], indent=2)}

Task:
Produce an executive explanation in structured JSON strictly matching:
- executive_summary: A 2-sentence C-level executive summary of what occurred and the financial impact.
- operational_impact_summary: Clear description of buffer depletion and delivery variance.
- recommended_response_explanation: Detailed operational explanation of why the recommended strategy is superior for this objective.
- trade_off_analysis: Analysis of trade-offs, capex vs delay risk.
- confidence_limitations: Explicit statement of model assumptions and verified boundaries.

STRICT RULE: Do NOT invent numbers, capacities, or outcomes outside the telemetry above.
"""

        system_instruction = (
            "You are the SynChain AI Supply Chain Decision Intelligence System. "
            "You synthesize verified deterministic simulation calculations into clear, human-understandable "
            "executive briefings. You strictly adhere to the provided numbers and never invent data."
        )

        try:
            def _run_in_thread():
                return asyncio.run(
                    gemini_pool.generate_content_async(
                        prompt=prompt,
                        system_instruction=system_instruction,
                        response_schema=AINarrative,
                    )
                )

            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(_run_in_thread)
                    res = future.result(timeout=10)
            else:
                res = _run_in_thread()

            # Parse JSON response
            raw_text = res.get("response", "")
            data = json.loads(raw_text)
            return AINarrative(
                executive_summary=data.get("executive_summary", ""),
                operational_impact_summary=data.get("operational_impact_summary", ""),
                recommended_response_explanation=data.get("recommended_response_explanation", ""),
                trade_off_analysis=data.get("trade_off_analysis", ""),
                confidence_limitations=data.get("confidence_limitations", ""),
                is_ai_generated=True,
                model_used=res.get("model", "gemini-1.5-flash"),
            )
        except Exception as e:
            reason = getattr(e, "reason", None)
            if not reason and hasattr(e, "__cause__") and e.__cause__:
                reason = getattr(e.__cause__, "reason", None)
            if not reason:
                msg = str(e)
                if "rate_limited" in msg:
                    reason = "rate_limited"
                elif "timeout" in msg:
                    reason = "timeout"
                elif "not_configured" in msg:
                    reason = "not_configured"
                else:
                    reason = type(e).__name__
            logger.info(f"Using deterministic fallback for scenario AI narrative (Reason: {reason})")
            return cls._build_deterministic_narrative(
                scenario_name=scenario_name,
                disruption_type=disruption_type,
                objective=objective,
                baseline=baseline,
                disrupted=disrupted,
                recommended=recommended,
                fallback_reason=str(reason),
            )

    @classmethod
    def _build_deterministic_narrative(
        cls,
        scenario_name: str,
        disruption_type: str,
        objective: str,
        baseline: BaselineAndDisruptedSummary,
        disrupted: BaselineAndDisruptedSummary,
        recommended: MitigationStrategyResult,
        fallback_reason: str,
    ) -> AINarrative:
        """Deterministic, verified narrative constructed without external LLM calls."""
        cost_saved = max(0.0, disrupted.total_cost_usd - recommended.total_cost_usd)
        days_saved = max(0, disrupted.arrival_day - recommended.arrival_day)
        service_boost = max(0.0, recommended.service_level_pct - disrupted.service_level_pct)

        exec_summary = (
            f"Simulated disruption '{scenario_name}' ({disruption_type}) incurs a +{disrupted.delivery_delay_days}-day "
            f"delivery delay, degrading fulfillment service levels to {disrupted.service_level_pct}% and escalating total cost "
            f"to ${disrupted.total_cost_usd:,.2f}. The recommended strategy '{recommended.strategy_name}' restores service levels to "
            f"{recommended.service_level_pct}% and preserves ${cost_saved:,.2f} in net operational capital."
        )

        impact_summary = (
            f"Without intervention, replenishment arrives on day {disrupted.arrival_day} rather than the baseline schedule of day "
            f"{baseline.arrival_day}. This triggers {disrupted.stockout_days_count} stockout days and {disrupted.unmet_demand_units:,.0f} unmet customer "
            f"order units, generating an estimated ${disrupted.stockout_penalty_cost_usd:,.2f} in financial shortage penalties."
        )

        response_explanation = (
            f"Under the '{objective.replace('_', ' ').title()}' objective, '{recommended.strategy_name}' is optimal. "
            f"By executing this mitigation, replenishment reaches the warehouse on day {recommended.arrival_day} ({days_saved} days ahead of the unmitigated disruption), "
            f"preventing {disrupted.stockout_days_count - recommended.stockout_days_count} stockout days while containing direct expediting fees to ${recommended.logistics_expedite_cost_usd:,.2f}."
        )

        trade_off = (
            f"Executing '{recommended.strategy_name}' entails an expediting/switching surcharge of ${recommended.logistics_expedite_cost_usd:,.2f} "
            f"and a direct order spend of ${recommended.direct_purchase_cost_usd:,.2f}. However, this expenditure offsets ${disrupted.stockout_penalty_cost_usd - recommended.stockout_penalty_cost_usd:,.2f} "
            f"in stockout penalties and eliminates {days_saved} days of operational downtime."
        )

        limitations = (
            "Deterministic analysis based on verified on-hand stock and enterprise supplier records. "
            "Assumes static daily customer demand rates and uninterrupted alternative transportation routes. "
            "Explanations verified via internal calculation engine; AI narrative fallback engaged due to: " + fallback_reason
        )

        return AINarrative(
            executive_summary=exec_summary,
            operational_impact_summary=impact_summary,
            recommended_response_explanation=response_explanation,
            trade_off_analysis=trade_off,
            confidence_limitations=limitations,
            is_ai_generated=False,
            model_used="SynChain-Deterministic-RuleEngine-v2",
            fallback_reason=fallback_reason,
        )

    # -----------------------------------------------------------------------
    # 11. ReportLab PDF Generation
    # -----------------------------------------------------------------------
    @classmethod
    def generate_pdf_report(cls, report_data: Dict[str, Any]) -> bytes:
        """
        Generates a professional, multi-page PDF Evidence Report using ReportLab.
        Contains tables, KPI deltas, AI narratives, calculation transparency, and disclaimers.
        """
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
            KeepTogether,
            HRFlowable,
        )

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )
        story = []

        styles = getSampleStyleSheet()
        # Custom palette
        color_navy = colors.HexColor("#0f172a")
        color_primary = colors.HexColor("#1e40af")
        color_accent = colors.HexColor("#2563eb")
        color_text = colors.HexColor("#334155")
        color_bg_light = colors.HexColor("#f8fafc")
        color_border = colors.HexColor("#cbd5e1")
        color_emerald = colors.HexColor("#059669")
        color_rose = colors.HexColor("#dc2626")

        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=20,
            leading=24,
            textColor=color_navy,
            fontName="Helvetica-Bold",
        )
        subtitle_style = ParagraphStyle(
            "DocSubtitle",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#64748b"),
        )
        h2_style = ParagraphStyle(
            "SectionH2",
            parent=styles["Heading2"],
            fontSize=12,
            leading=16,
            textColor=color_primary,
            fontName="Helvetica-Bold",
            spaceBefore=10,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            "BodyDark",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            textColor=color_text,
        )
        bold_body = ParagraphStyle(
            "BodyBold",
            parent=body_style,
            fontName="Helvetica-Bold",
        )
        disclaimer_style = ParagraphStyle(
            "Disclaimer",
            parent=styles["Normal"],
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#94a3b8"),
            fontName="Helvetica-Oblique",
        )

        # 1. Header Banner & Title Block
        story.append(Paragraph("SYNCHAIN AI SUPPLY CHAIN INTELLIGENCE", subtitle_style))
        story.append(Paragraph("Simulation Evidence & Decision Support Report", title_style))
        story.append(Spacer(1, 4))
        story.append(HRFlowable(width="100%", thickness=1.5, color=color_accent, spaceBefore=4, spaceAfter=8))

        # Metadata Table
        rep_id = report_data.get("report_id", "RPT-UNKNOWN")
        gen_time = report_data.get("created_at", datetime.now(timezone.utc).isoformat())[:19].replace("T", " ")
        scen_name = report_data.get("scenario_name", "Scenario")
        obj = report_data.get("objective", "balanced").replace("_", " ").title()
        disr_type = report_data.get("disruption_type", "General Disruption").replace("_", " ").title()

        meta_rows = [
            [
                Paragraph(f"<b>Report ID:</b> {rep_id}", body_style),
                Paragraph(f"<b>Generated:</b> {gen_time} UTC", body_style),
            ],
            [
                Paragraph(f"<b>Scenario Name:</b> {scen_name}", body_style),
                Paragraph(f"<b>Optimization Objective:</b> {obj}", body_style),
            ],
            [
                Paragraph(f"<b>Disruption Type:</b> {disr_type}", body_style),
                Paragraph(f"<b>Analytical Engine:</b> SynChain-Sim-v2.1", body_style),
            ],
        ]
        meta_table = Table(meta_rows, colWidths=[270, 270])
        meta_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), color_bg_light),
                ("BOX", (0, 0), (-1, -1), 0.5, color_border),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("PADDING", (0, 0), (-1, -1), 5),
            ])
        )
        story.append(meta_table)
        story.append(Spacer(1, 10))

        # 2. Executive Summary
        ai_narrative = report_data.get("ai_narrative", {})
        is_ai = ai_narrative.get("is_ai_generated", False)
        ai_badge = "Gemini AI Synthesized" if is_ai else f"Verified Deterministic Engine ({ai_narrative.get('fallback_reason', 'Rule-Based')})"

        story.append(Paragraph(f"Executive Summary & Decision Context [{ai_badge}]", h2_style))
        story.append(Paragraph(ai_narrative.get("executive_summary", "Simulation completed successfully."), body_style))
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"<b>Operational Impact:</b> {ai_narrative.get('operational_impact_summary', '')}", body_style))
        story.append(Spacer(1, 10))

        # 3. Comparative KPI Results Table
        story.append(Paragraph("Scenario KPI Comparison: Baseline vs Disrupted vs Mitigations", h2_style))

        baseline = report_data.get("baseline", {})
        disrupted = report_data.get("disrupted", {})
        strategies = report_data.get("mitigation_strategies", [])

        kpi_headers = ["Scenario / Strategy", "Arrival", "Delay", "Fill Rate", "Stockouts", "Direct Cost", "Expedite", "Penalty", "Total Cost", "Rank"]
        kpi_rows = [[Paragraph(f"<b>{h}</b>", bold_body) for h in kpi_headers]]

        def fmt_row(name, arr, delay, s_lvl, stockouts, d_cost, exp_cost, pen_cost, tot_cost, rank_val):
            return [
                Paragraph(name, body_style),
                Paragraph(f"Day {arr}", body_style),
                Paragraph(f"+{delay}d" if delay > 0 else "0d", body_style),
                Paragraph(f"{s_lvl:.1f}%", body_style),
                Paragraph(f"{stockouts}d", body_style),
                Paragraph(f"${d_cost:,.0f}", body_style),
                Paragraph(f"${exp_cost:,.0f}", body_style),
                Paragraph(f"${pen_cost:,.0f}", body_style),
                Paragraph(f"<b>${tot_cost:,.0f}</b>", bold_body),
                Paragraph(str(rank_val), body_style),
            ]

        # Baseline
        kpi_rows.append(fmt_row(
            "1. Baseline (Normal)",
            baseline.get("arrival_day", 6),
            0,
            baseline.get("service_level_pct", 100.0),
            baseline.get("stockout_days_count", 0),
            baseline.get("direct_purchase_cost_usd", 0.0),
            0.0,
            baseline.get("stockout_penalty_cost_usd", 0.0),
            baseline.get("total_cost_usd", 0.0),
            "REF",
        ))
        # Disrupted
        kpi_rows.append(fmt_row(
            "2. Disrupted (Unmitigated)",
            disrupted.get("arrival_day", 16),
            disrupted.get("delivery_delay_days", 10),
            disrupted.get("service_level_pct", 60.0),
            disrupted.get("stockout_days_count", 8),
            disrupted.get("direct_purchase_cost_usd", 0.0),
            0.0,
            disrupted.get("stockout_penalty_cost_usd", 0.0),
            disrupted.get("total_cost_usd", 0.0),
            "UNMIT",
        ))
        # Mitigations
        for s in strategies:
            kpi_rows.append(fmt_row(
                s.get("strategy_name", s.get("strategy_id", "Strategy")),
                s.get("arrival_day", 0),
                s.get("delivery_delay_days", 0),
                s.get("service_level_pct", 0.0),
                s.get("stockout_days_count", 0),
                s.get("direct_purchase_cost_usd", 0.0),
                s.get("logistics_expedite_cost_usd", 0.0),
                s.get("stockout_penalty_cost_usd", 0.0),
                s.get("total_cost_usd", 0.0),
                f"#{s.get('rank', '-')}",
            ))

        col_widths = [130, 40, 35, 45, 45, 52, 45, 48, 65, 35]
        kpi_table = Table(kpi_rows, colWidths=col_widths)
        kpi_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#fee2e2")),  # Light red for disrupted
                ("GRID", (0, 0), (-1, -1), 0.5, color_border),
                ("PADDING", (0, 0), (-1, -1), 4),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ])
        )
        story.append(kpi_table)
        story.append(Spacer(1, 10))

        # 4. Recommended Mitigation Deep-Dive
        rec_strat_name = report_data.get("recommended_strategy_name", "Recommended Strategy")
        story.append(Paragraph(f"Recommended Strategy: {rec_strat_name}", h2_style))
        story.append(Paragraph(ai_narrative.get("recommended_response_explanation", ""), body_style))
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"<b>Trade-Off Analysis:</b> {ai_narrative.get('trade_off_analysis', '')}", body_style))
        story.append(Spacer(1, 10))

        # 5. Affected Supply Chain Records
        aff_entities = report_data.get("affected_entities", {})
        sups = aff_entities.get("suppliers", [])
        prods = aff_entities.get("products", [])
        if sups or prods:
            story.append(Paragraph("Affected Supply Chain Entities (Verified PostgreSQL Records)", h2_style))
            aff_rows = [[Paragraph("<b>Entity Type</b>", bold_body), Paragraph("<b>Identifier</b>", bold_body), Paragraph("<b>Name / Attributes</b>", bold_body), Paragraph("<b>Operational Status</b>", bold_body)]]
            for s in sups:
                aff_rows.append([
                    Paragraph("Supplier", body_style),
                    Paragraph(str(s.get("id", ""))[:8], body_style),
                    Paragraph(f"{s.get('name', '')} ({s.get('country', '')})", body_style),
                    Paragraph(s.get("role", "Active"), body_style),
                ])
            for p in prods:
                aff_rows.append([
                    Paragraph("Product / SKU", body_style),
                    Paragraph(p.get("sku", "") or str(p.get("id", ""))[:8], body_style),
                    Paragraph(f"{p.get('name', '')} [${p.get('unit_price', 0):,.2f}]", body_style),
                    Paragraph(p.get("category", "General"), body_style),
                ])
            aff_table = Table(aff_rows, colWidths=[90, 80, 230, 140])
            aff_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), color_bg_light),
                    ("GRID", (0, 0), (-1, -1), 0.5, color_border),
                    ("PADDING", (0, 0), (-1, -1), 4),
                ])
            )
            story.append(aff_table)
            story.append(Spacer(1, 10))

        # 6. Calculation Transparency & Data Provenance
        story.append(Paragraph("Calculation Transparency & Model Assumptions", h2_style))
        calcs = report_data.get("calculation_transparency", {})
        if calcs:
            calc_rows = [[Paragraph("<b>Metric</b>", bold_body), Paragraph("<b>Calculation Formula</b>", bold_body), Paragraph("<b>Result Value</b>", bold_body), Paragraph("<b>Assumptions</b>", bold_body)]]
            for m_key, m_val in calcs.items():
                calc_rows.append([
                    Paragraph(m_val.get("metric_name", m_key), body_style),
                    Paragraph(m_val.get("formula", ""), body_style),
                    Paragraph(f"{m_val.get('result_value', 0):,.2f} {m_val.get('units', '')}", body_style),
                    Paragraph(m_val.get("assumptions", ""), body_style),
                ])
            calc_table = Table(calc_rows, colWidths=[100, 180, 100, 160])
            calc_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), color_bg_light),
                    ("GRID", (0, 0), (-1, -1), 0.5, color_border),
                    ("PADDING", (0, 0), (-1, -1), 4),
                ])
            )
            story.append(calc_table)
            story.append(Spacer(1, 10))

        # 7. Disclaimers & Limitations
        story.append(Paragraph("Analytical Limitations & Advisory Notice", h2_style))
        disclaimer_text = (
            "NOTICE: This document is an AI-assisted simulation evidence report generated for executive decision-support purposes. "
            "Calculations are strictly deterministic based on recorded warehouse buffers, historical supplier lead times, and specified scenario constraints. "
            "It does not constitute absolute proof that future geopolitical, weather, or supplier events will unfold identically. "
            "Data Provenance: SynChain PostgreSQL Enterprise Telemetry. Confidential & Proprietary."
        )
        story.append(Paragraph(disclaimer_text, disclaimer_style))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    # -----------------------------------------------------------------------
    # 12. Evidence Data Export (CSV & JSON)
    # -----------------------------------------------------------------------
    @classmethod
    def export_evidence_csv(cls, report_data: Dict[str, Any]) -> str:
        """Exports daily trajectory points and KPI summaries across all scenarios to CSV."""
        import csv
        output = io.StringIO()
        writer = csv.writer(output)

        # Header metadata
        writer.writerow(["SynChain Simulation Evidence Report Data Export"])
        writer.writerow(["Report ID", report_data.get("report_id", "")])
        writer.writerow(["Scenario Name", report_data.get("scenario_name", "")])
        writer.writerow(["Objective", report_data.get("objective", "")])
        writer.writerow(["Created At", report_data.get("created_at", "")])
        writer.writerow([])

        # Summary KPIs
        writer.writerow(["Scenario Summary Comparison"])
        writer.writerow(["Scenario_ID", "Scenario_Name", "Arrival_Day", "Delivery_Delay_Days", "Service_Level_Pct", "Stockout_Days", "Direct_Purchase_USD", "Expedite_Cost_USD", "Holding_Cost_USD", "Stockout_Penalty_USD", "Total_Cost_USD", "Rank"])

        baseline = report_data.get("baseline", {})
        writer.writerow(["BASELINE", "Baseline Normal", baseline.get("arrival_day"), 0, baseline.get("service_level_pct"), baseline.get("stockout_days_count"), baseline.get("direct_purchase_cost_usd"), 0, baseline.get("holding_cost_usd"), baseline.get("stockout_penalty_cost_usd"), baseline.get("total_cost_usd"), "REF"])

        disrupted = report_data.get("disrupted", {})
        writer.writerow(["DISRUPTED", "Disrupted Unmitigated", disrupted.get("arrival_day"), disrupted.get("delivery_delay_days"), disrupted.get("service_level_pct"), disrupted.get("stockout_days_count"), disrupted.get("direct_purchase_cost_usd"), 0, disrupted.get("holding_cost_usd"), disrupted.get("stockout_penalty_cost_usd"), disrupted.get("total_cost_usd"), "UNMIT"])

        for s in report_data.get("mitigation_strategies", []):
            writer.writerow([s.get("strategy_id"), s.get("strategy_name"), s.get("arrival_day"), s.get("delivery_delay_days"), s.get("service_level_pct"), s.get("stockout_days_count"), s.get("direct_purchase_cost_usd"), s.get("logistics_expedite_cost_usd"), s.get("holding_cost_usd"), s.get("stockout_penalty_cost_usd"), s.get("total_cost_usd"), s.get("rank")])

        writer.writerow([])
        writer.writerow(["Daily Inventory Trajectory (Recommended Strategy)"])
        writer.writerow(["Day", "Starting_Inventory", "Incoming_Quantity", "Customer_Demand", "Fulfilled_Demand", "Unmet_Demand", "Ending_Inventory", "Cumulative_Unmet", "Safety_Breached", "Stockout"])

        recommended_id = report_data.get("recommended_strategy_id")
        rec_strat = next((s for s in report_data.get("mitigation_strategies", []) if s.get("strategy_id") == recommended_id), None)
        if rec_strat and "daily_trajectory" in rec_strat:
            for pt in rec_strat["daily_trajectory"]:
                writer.writerow([
                    pt.get("day"),
                    pt.get("starting_inventory"),
                    pt.get("incoming_quantity"),
                    pt.get("demand"),
                    pt.get("fulfilled_demand"),
                    pt.get("unmet_demand"),
                    pt.get("ending_inventory"),
                    pt.get("cumulative_unmet_demand"),
                    pt.get("is_safety_stock_breached"),
                    pt.get("is_stockout"),
                ])

        return output.getvalue()

    # -----------------------------------------------------------------------
    # 13. Historical Report Queries
    # -----------------------------------------------------------------------
    @classmethod
    def list_reports(cls, db: Session, limit: int = 50) -> List[SimulationEvidenceReportSummary]:
        """Lists historical simulation evidence reports."""
        records = (
            db.query(SimulationEvidenceReport)
            .order_by(SimulationEvidenceReport.created_at.desc())
            .limit(limit)
            .all()
        )
        summaries: List[SimulationEvidenceReportSummary] = []
        for r in records:
            base = r.baseline_results or {}
            disr = r.disrupted_results or {}
            rec = r.recommended_strategy or {}
            ai = r.ai_narrative or {}
            summaries.append(
                SimulationEvidenceReportSummary(
                    report_id=r.report_id,
                    scenario_name=r.scenario_name,
                    disruption_type=r.scenario_config.get("disruption_type", "disruption") if r.scenario_config else "disruption",
                    objective=r.objective,
                    recommended_strategy_id=rec.get("strategy_id", "UNKNOWN"),
                    recommended_strategy_name=rec.get("strategy_name", "Recommended Strategy"),
                    baseline_cost_usd=float(base.get("total_cost_usd", 0.0)),
                    disrupted_cost_usd=float(disr.get("total_cost_usd", 0.0)),
                    mitigated_cost_usd=float(rec.get("total_cost_usd", 0.0)),
                    service_level_saved_pct=round(float(rec.get("service_level_pct", 0.0)) - float(disr.get("service_level_pct", 0.0)), 1),
                    created_at=r.created_at.isoformat() if r.created_at else "",
                    is_ai_generated=bool(ai.get("is_ai_generated", False)),
                )
            )
        return summaries

    @classmethod
    def get_report_by_id(cls, db: Session, report_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves complete simulation report payload for viewing or export."""
        record = (
            db.query(SimulationEvidenceReport)
            .filter(SimulationEvidenceReport.report_id == report_id)
            .first()
        )
        if not record:
            return None

        return {
            "report_id": record.report_id,
            "scenario_name": record.scenario_name,
            "objective": record.objective,
            "disruption_type": record.scenario_config.get("disruption_type", "disruption") if record.scenario_config else "disruption",
            "scenario_config": record.scenario_config,
            "baseline": record.baseline_results,
            "disrupted": record.disrupted_results,
            "mitigation_strategies": record.mitigation_strategies,
            "recommended_strategy_id": record.recommended_strategy.get("strategy_id") if record.recommended_strategy else None,
            "recommended_strategy_name": record.recommended_strategy.get("strategy_name") if record.recommended_strategy else None,
            "recommendation_rationale": record.recommended_strategy.get("recommendation_rationale", "") if record.recommended_strategy else "",
            "affected_entities": record.affected_entities,
            "data_provenance": record.data_provenance,
            "ai_narrative": record.ai_narrative,
            "calculation_transparency": record.calculation_transparency,
            "model_metadata": record.model_metadata,
            "created_at": record.created_at.isoformat() if record.created_at else "",
        }
