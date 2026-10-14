import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc, func
from fastapi import HTTPException, status

from app.models.postgres.models import Shipment, Supplier
from app.schemas.shipments import ShipmentCreate, ShipmentUpdate
from app.services.shipments.risk_scoring import ShipmentRiskScorer


class ShipmentService:

    @staticmethod
    def seed_initial_shipments_if_empty(db: Session) -> None:
        """Seeds realistic initial enterprise shipments if database table is empty."""
        count = db.query(Shipment).count()
        if count > 0:
            return

        now = datetime.now(timezone.utc)
        suppliers = db.query(Supplier).all()
        s1 = suppliers[0] if len(suppliers) > 0 else None
        s2 = suppliers[1] if len(suppliers) > 1 else None
        s3 = suppliers[2] if len(suppliers) > 2 else None

        initial_data = [
            {
                "shipment_id": "SHP-1001",
                "shipment_name": "Trans-Pacific Silicon Wafers Batch Alpha",
                "supplier_id": s1.id if s1 else None,
                "origin": "Taipei, Taiwan",
                "destination": "Austin Gigafactory Hub, TX",
                "cargo_description": "2,500x 300mm Monocrystalline Silicon Wafers",
                "quantity": 2500,
                "transport_mode": "Air",
                "departure_date": now - timedelta(days=2),
                "expected_delivery_date": now + timedelta(days=1),
                "carrier_name": "FedEx Express International Freight",
                "tracking_number": "FX-8849-2910-US",
                "status": "in_transit",
                "initial_risk_score": 18,
            },
            {
                "shipment_id": "SHP-1002",
                "shipment_name": "Rotterdam Chemical Precursors Vessel Line",
                "supplier_id": s2.id if s2 else None,
                "origin": "Rotterdam Terminal, Netherlands",
                "destination": "Memphis Logistics SuperHub, TN",
                "cargo_description": "1,800x Refined Battery-Grade Electrolyte Barrels",
                "quantity": 1800,
                "transport_mode": "Ocean",
                "departure_date": now - timedelta(days=12),
                "expected_delivery_date": now + timedelta(days=6),
                "carrier_name": "Maersk Maritime Logistics",
                "tracking_number": "MSK-7721-0043-NL",
                "status": "in_transit",
                "initial_risk_score": 42,
            },
            {
                "shipment_id": "SHP-1003",
                "shipment_name": "Shenzhen Microcontroller Intermodal Corridor",
                "supplier_id": s3.id if s3 else None,
                "origin": "Shenzhen Port, China",
                "destination": "Long Beach Terminal, CA",
                "cargo_description": "15,000x High-Frequency ARM Microcontrollers",
                "quantity": 15000,
                "transport_mode": "Ocean",
                "departure_date": now - timedelta(days=18),
                "expected_delivery_date": now - timedelta(days=2),
                "carrier_name": "COSCO Shipping Lines",
                "tracking_number": "COS-9912-3810-PAC",
                "status": "delayed",
                "initial_risk_score": 78,
            },
            {
                "shipment_id": "SHP-1004",
                "shipment_name": "Midwest Rail Intermodal Precision Assemblies",
                "supplier_id": s1.id if s1 else None,
                "origin": "Chicago Rail Hub, IL",
                "destination": "Austin Gigafactory Hub, TX",
                "cargo_description": "4,200x Precision Robotic Actuator Sub-assemblies",
                "quantity": 4200,
                "transport_mode": "Rail",
                "departure_date": now - timedelta(days=5),
                "expected_delivery_date": now - timedelta(days=1),
                "actual_delivery_date": now - timedelta(days=1),
                "carrier_name": "Union Pacific Intermodal",
                "tracking_number": "UP-3390-1120-TX",
                "status": "delivered",
                "initial_risk_score": 10,
            },
            {
                "shipment_id": "SHP-1005",
                "shipment_name": "Red Sea Coastal Bypass Medical Cargo",
                "supplier_id": s2.id if s2 else None,
                "origin": "Mumbai Gateway Port, India",
                "destination": "Hamburg Port, Germany",
                "cargo_description": "850x Cold-Chain Diagnostic Reagent Modules",
                "quantity": 850,
                "transport_mode": "Ocean",
                "departure_date": now - timedelta(days=8),
                "expected_delivery_date": now + timedelta(days=10),
                "carrier_name": "Hapag-Lloyd Express Cargo",
                "tracking_number": "HL-4421-9980-DE",
                "status": "in_transit",
                "initial_risk_score": 72,
            },
        ]

        for item in initial_data:
            sup = None
            if item["supplier_id"]:
                sup = db.query(Supplier).filter(Supplier.id == item["supplier_id"]).first()

            risk_eval = ShipmentRiskScorer.calculate_risk(
                shipment_id=item["shipment_id"],
                transport_mode=item["transport_mode"],
                departure_date=item["departure_date"],
                expected_delivery_date=item["expected_delivery_date"],
                status=item["status"],
                actual_delivery_date=item.get("actual_delivery_date"),
                origin=item["origin"],
                destination=item["destination"],
                supplier=sup,
                db=db,
            )

            hist = [
                {
                    "event": "Dispatch Registered",
                    "status": "in_transit",
                    "location": item["origin"],
                    "timestamp": item["departure_date"].isoformat(),
                    "description": f"Departed {item['origin']} via {item['carrier_name']}.",
                }
            ]
            if item["status"] == "delayed":
                hist.append({
                    "event": "Transit Delay Advisory",
                    "status": "delayed",
                    "location": "Pacific Transit Corridor",
                    "timestamp": (now - timedelta(days=2)).isoformat(),
                    "description": "Port congestion at entry checkpoint; estimated delay +48h.",
                })
            elif item["status"] == "delivered":
                hist.append({
                    "event": "Shipment Delivered",
                    "status": "delivered",
                    "location": item["destination"],
                    "timestamp": item["actual_delivery_date"].isoformat(),
                    "description": f"Delivered and signed at {item['destination']}.",
                })

            shipment = Shipment(
                id=uuid.uuid4(),
                shipment_id=item["shipment_id"],
                shipment_name=item["shipment_name"],
                supplier_id=item["supplier_id"],
                origin=item["origin"],
                destination=item["destination"],
                cargo_description=item["cargo_description"],
                quantity=item["quantity"],
                transport_mode=item["transport_mode"],
                departure_date=item["departure_date"],
                expected_delivery_date=item["expected_delivery_date"],
                actual_delivery_date=item.get("actual_delivery_date"),
                carrier_name=item["carrier_name"],
                tracking_number=item["tracking_number"],
                status=item["status"],
                risk_score=risk_eval["risk_score"],
                risk_level=risk_eval["risk_level"],
                risk_factors=risk_eval["risk_factors"],
                data_completeness=risk_eval["data_completeness"],
                initial_risk_score=item.get("initial_risk_score"),
                tracking_history=hist,
            )
            db.add(shipment)

        try:
            db.commit()
        except Exception:
            db.rollback()

    @staticmethod
    def get_shipments(
        db: Session,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        risk_level: Optional[str] = None,
        transport_mode: Optional[str] = None,
        sort_by: Optional[str] = "created_at",
        sort_order: Optional[str] = "desc",
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Shipment], int]:
        # Ensure initial seed if table is empty
        ShipmentService.seed_initial_shipments_if_empty(db)

        query = db.query(Shipment).outerjoin(Supplier, Shipment.supplier_id == Supplier.id)

        # Search filter
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Shipment.shipment_id.ilike(term),
                    Shipment.shipment_name.ilike(term),
                    Shipment.origin.ilike(term),
                    Shipment.destination.ilike(term),
                    Shipment.cargo_description.ilike(term),
                    Shipment.carrier_name.ilike(term),
                    Shipment.tracking_number.ilike(term),
                    Supplier.name.ilike(term),
                )
            )

        # Status filter
        if status_filter and status_filter.strip().lower() != "all":
            clean_st = status_filter.strip().lower().replace(" ", "_")
            query = query.filter(Shipment.status.ilike(clean_st))

        # Risk level filter
        if risk_level and risk_level.strip().upper() != "ALL":
            query = query.filter(Shipment.risk_level == risk_level.strip().upper())

        # Transport mode filter
        if transport_mode and transport_mode.strip().lower() != "all":
            clean_mode = transport_mode.strip().lower()
            query = query.filter(Shipment.transport_mode.ilike(clean_mode))

        # Sorting
        sort_field_map = {
            "eta": Shipment.expected_delivery_date,
            "expected_delivery_date": Shipment.expected_delivery_date,
            "departure_date": Shipment.departure_date,
            "risk_score": Shipment.risk_score,
            "status": Shipment.status,
            "shipment_id": Shipment.shipment_id,
            "shipment_name": Shipment.shipment_name,
            "created_at": Shipment.created_at,
        }
        order_col = sort_field_map.get((sort_by or "").lower(), Shipment.created_at)
        if (sort_order or "").lower() == "asc":
            query = query.order_by(asc(order_col))
        else:
            query = query.order_by(desc(order_col))

        total = query.count()
        offset = max(0, (page - 1) * page_size)
        items = query.offset(offset).limit(page_size).all()
        return items, total

    @staticmethod
    def get_summary(db: Session) -> Dict[str, int]:
        ShipmentService.seed_initial_shipments_if_empty(db)

        total = db.query(Shipment).count()
        in_transit = db.query(Shipment).filter(Shipment.status == "in_transit").count()
        delivered = db.query(Shipment).filter(Shipment.status == "delivered").count()
        delayed = db.query(Shipment).filter(Shipment.status == "delayed").count()
        high_risk = db.query(Shipment).filter(Shipment.risk_score >= 60).count()
        critical_risk = db.query(Shipment).filter(Shipment.risk_score >= 80).count()

        return {
            "total_shipments": total,
            "in_transit": in_transit,
            "delivered": delivered,
            "delayed": delayed,
            "high_risk": high_risk,
            "critical_risk": critical_risk,
        }

    @staticmethod
    def get_by_id(db: Session, identifier: str) -> Optional[Shipment]:
        """Looks up shipment by UUID or shipment_id string."""
        # Try UUID first
        try:
            val_uuid = uuid.UUID(identifier)
            s = db.query(Shipment).filter(Shipment.id == val_uuid).first()
            if s:
                return s
        except ValueError:
            pass

        # Try exact shipment_id string match (case-insensitive)
        return db.query(Shipment).filter(Shipment.shipment_id.ilike(identifier.strip())).first()

    @staticmethod
    def create_shipment(db: Session, data: ShipmentCreate) -> Shipment:
        # Generate shipment_id if omitted
        ship_id = (data.shipment_id or "").strip()
        if not ship_id:
            now_prefix = datetime.now(timezone.utc).strftime("%y%m")
            short_id = uuid.uuid4().hex[:6].upper()
            ship_id = f"SHP-{now_prefix}-{short_id}"

        # Prevent duplicate shipment_id
        existing = db.query(Shipment).filter(Shipment.shipment_id.ilike(ship_id)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Shipment ID '{ship_id}' already exists. Please choose a unique ID.",
            )

        # Validate supplier if provided
        supplier = None
        if data.supplier_id:
            supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
            if not supplier:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Supplier ID '{data.supplier_id}' does not exist in registry.",
                )

        # Calculate backend authoritative risk
        risk_result = ShipmentRiskScorer.calculate_risk(
            shipment_id=ship_id,
            transport_mode=data.transport_mode,
            departure_date=data.departure_date,
            expected_delivery_date=data.expected_delivery_date,
            status=data.status or "in_transit",
            actual_delivery_date=data.actual_delivery_date,
            origin=data.origin,
            destination=data.destination,
            supplier=supplier,
            db=db,
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        initial_history = [
            {
                "event": "Shipment Created",
                "status": data.status or "in_transit",
                "location": data.origin,
                "timestamp": now_iso,
                "description": f"Consignment registered in SynChain AI core by carrier {data.carrier_name}.",
            }
        ]

        shipment = Shipment(
            id=uuid.uuid4(),
            shipment_id=ship_id,
            shipment_name=data.shipment_name,
            supplier_id=data.supplier_id,
            origin=data.origin,
            destination=data.destination,
            cargo_description=data.cargo_description,
            quantity=data.quantity,
            transport_mode=data.transport_mode,
            departure_date=data.departure_date,
            expected_delivery_date=data.expected_delivery_date,
            actual_delivery_date=data.actual_delivery_date,
            carrier_name=data.carrier_name,
            tracking_number=data.tracking_number,
            status=data.status or "in_transit",
            risk_score=risk_result["risk_score"],
            risk_level=risk_result["risk_level"],
            risk_factors=risk_result["risk_factors"],
            data_completeness=risk_result["data_completeness"],
            initial_risk_score=data.initial_risk_score,
            tracking_history=initial_history,
        )

        try:
            db.add(shipment)
            db.commit()
            db.refresh(shipment)
            return shipment
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to persist shipment to PostgreSQL: {str(e)}",
            )

    @staticmethod
    def update_shipment(db: Session, shipment: Shipment, data: ShipmentUpdate) -> Shipment:
        # Check supplier if being updated
        supplier = shipment.supplier
        if data.supplier_id is not None:
            if data.supplier_id:
                supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
                if not supplier:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Supplier ID '{data.supplier_id}' does not exist in registry.",
                    )
                shipment.supplier_id = data.supplier_id
            else:
                shipment.supplier_id = None
                supplier = None

        # Check date chronology if updating one or both dates
        new_dep = data.departure_date or shipment.departure_date
        new_eta = data.expected_delivery_date or shipment.expected_delivery_date
        if new_eta < new_dep:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Expected delivery date cannot be earlier than departure date.",
            )

        # Status change logging in tracking history
        status_changed = data.status is not None and data.status != shipment.status
        old_status = shipment.status

        # Apply updates
        if data.shipment_name is not None:
            shipment.shipment_name = data.shipment_name
        if data.origin is not None:
            shipment.origin = data.origin
        if data.destination is not None:
            shipment.destination = data.destination
        if data.cargo_description is not None:
            shipment.cargo_description = data.cargo_description
        if data.quantity is not None:
            shipment.quantity = data.quantity
        if data.transport_mode is not None:
            shipment.transport_mode = data.transport_mode
        if data.departure_date is not None:
            shipment.departure_date = data.departure_date
        if data.expected_delivery_date is not None:
            shipment.expected_delivery_date = data.expected_delivery_date
        if data.actual_delivery_date is not None:
            shipment.actual_delivery_date = data.actual_delivery_date
        if data.carrier_name is not None:
            shipment.carrier_name = data.carrier_name
        if data.tracking_number is not None:
            shipment.tracking_number = data.tracking_number
        if data.status is not None:
            shipment.status = data.status
            if data.status == "delivered" and not shipment.actual_delivery_date:
                shipment.actual_delivery_date = datetime.now(timezone.utc)
        if data.initial_risk_score is not None:
            shipment.initial_risk_score = data.initial_risk_score

        # If status changed, record milestone in tracking history
        if status_changed:
            current_hist = list(shipment.tracking_history or [])
            loc = shipment.destination if shipment.status == "delivered" else shipment.origin
            current_hist.append({
                "event": f"Status Update: {shipment.status.upper()}",
                "status": shipment.status,
                "location": loc,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "description": f"Shipment status transitioned from {old_status} to {shipment.status}.",
            })
            shipment.tracking_history = current_hist

        # Recalculate risk automatically upon shipment updates
        risk_result = ShipmentRiskScorer.calculate_risk(
            shipment_id=shipment.shipment_id,
            transport_mode=shipment.transport_mode,
            departure_date=shipment.departure_date,
            expected_delivery_date=shipment.expected_delivery_date,
            status=shipment.status,
            actual_delivery_date=shipment.actual_delivery_date,
            origin=shipment.origin,
            destination=shipment.destination,
            supplier=supplier,
            db=db,
        )
        shipment.risk_score = risk_result["risk_score"]
        shipment.risk_level = risk_result["risk_level"]
        shipment.risk_factors = risk_result["risk_factors"]
        shipment.data_completeness = risk_result["data_completeness"]

        try:
            db.commit()
            db.refresh(shipment)
            return shipment
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update shipment: {str(e)}",
            )

    @staticmethod
    def delete_shipment(db: Session, shipment: Shipment) -> None:
        try:
            db.delete(shipment)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to safely delete shipment: {str(e)}",
            )

    @staticmethod
    def recalculate_risk(db: Session, shipment: Shipment) -> Dict[str, Any]:
        risk_result = ShipmentRiskScorer.calculate_risk(
            shipment_id=shipment.shipment_id,
            transport_mode=shipment.transport_mode,
            departure_date=shipment.departure_date,
            expected_delivery_date=shipment.expected_delivery_date,
            status=shipment.status,
            actual_delivery_date=shipment.actual_delivery_date,
            origin=shipment.origin,
            destination=shipment.destination,
            supplier=shipment.supplier,
            db=db,
        )
        shipment.risk_score = risk_result["risk_score"]
        shipment.risk_level = risk_result["risk_level"]
        shipment.risk_factors = risk_result["risk_factors"]
        shipment.data_completeness = risk_result["data_completeness"]

        try:
            db.commit()
            db.refresh(shipment)
            return risk_result
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to recalculate and persist risk: {str(e)}",
            )
