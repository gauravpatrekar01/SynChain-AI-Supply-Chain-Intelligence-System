import io
import csv
import uuid
import time
from math import ceil
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc, func
from fastapi import HTTPException, status

from app.models.postgres.models import Supplier, Shipment, Purchase
from app.models.postgres.observations import LeadTimeObservation
from app.schemas.suppliers import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierImportRowError,
    SupplierImportPreviewResponse,
    SupplierImportConfirmResponse,
    normalize_tier,
    normalize_health_status,
)

# In-memory preview token cache with 30-minute expiration
_PREVIEW_CACHE: Dict[str, Dict[str, Any]] = {}
PREVIEW_TTL_SECONDS = 1800


def _clean_token_cache():
    now = time.time()
    expired = [k for k, v in _PREVIEW_CACHE.items() if now - v.get("created_at", 0) > PREVIEW_TTL_SECONDS]
    for k in expired:
        _PREVIEW_CACHE.pop(k, None)


HEADER_ALIAS_MAP: Dict[str, str] = {
    # Name
    "supplier": "name",
    "supplier_name": "name",
    "name": "name",
    "vendor": "name",
    "vendor_name": "name",
    "company_name": "name",
    # Code
    "supplier_code": "supplier_code",
    "code": "supplier_code",
    "supplier_id": "supplier_code",
    "vendor_id": "supplier_code",
    "vendor_code": "supplier_code",
    # Tier
    "tier": "tier",
    "supplier_tier": "tier",
    # Category
    "category": "category",
    "product_category": "category",
    "industry": "category",
    # Location
    "location": "location",
    "city": "location",
    "address": "location",
    "facility": "location",
    # Country
    "country": "country",
    "nation": "country",
    # Contact
    "contact_person": "contact_person",
    "contact": "contact_person",
    "contact_name": "contact_person",
    "representative": "contact_person",
    "email": "email",
    "contact_email": "email",
    "phone": "phone",
    "telephone": "phone",
    "phone_number": "phone",
    # Scores
    "reliability": "reliability_score",
    "reliability_score": "reliability_score",
    "reliability_percentage": "reliability_score",
    "quality_rating": "quality_rating",
    "quality": "quality_rating",
    "quality_score": "quality_rating",
    # Business
    "annual_spend": "spend_annual_usd",
    "spend_annual_usd": "spend_annual_usd",
    "spend": "spend_annual_usd",
    "spend_usd": "spend_annual_usd",
    "annual_spend_usd": "spend_annual_usd",
    "spend_amount": "spend_annual_usd",
    "total_spend": "spend_annual_usd",
    # Risk
    "risk_rating": "health_status",
    "health_status": "health_status",
    "risk": "health_status",
    "status": "health_status",
    "single_source": "single_source_risk",
    "single_source_risk": "single_source_risk",
    "is_single_source": "single_source_risk",
    # Lead time & capacity
    "lead_time_days": "lead_time_days",
    "lead_time": "lead_time_days",
    "lead_days": "lead_time_days",
    "capacity": "capacity",
    "capacity_units": "capacity",
    # Status
    "is_active": "is_active",
    "active": "is_active",
}


def sanitize_csv_cell(value: Any) -> str:
    """Strip formula injection triggers (=, +, -, @) and trim whitespace."""
    if value is None:
        return ""
    text = str(value).strip()
    if text.startswith(("=", "+", "-", "@")):
        text = text.lstrip("=+-@").strip()
    return text


class SupplierService:

    @staticmethod
    def serialize_supplier(s: Supplier, db: Optional[Session] = None) -> SupplierResponse:
        active_shipments = 0
        if db is not None:
            active_shipments = db.query(Shipment).filter(
                Shipment.supplier_id == s.id,
                Shipment.status.in_(["in_transit", "delayed", "pending"]),
            ).count()

        rel = float(s.reliability_score) if s.reliability_score is not None else 85.0
        spend = float(s.spend_annual_usd) if s.spend_annual_usd is not None else 0.0
        qual = float(s.quality_rating) if s.quality_rating is not None else None

        return SupplierResponse(
            id=s.id,
            supplier_code=s.supplier_code or f"SUP-{str(s.id)[:6].upper()}",
            name=s.name,
            tier=s.tier or "Tier-1",
            category=s.category or "Component Supplier",
            location=s.location or s.country or "Global Facility",
            country=s.country or "Global",
            contact_person=s.contact_person,
            email=s.email,
            phone=s.phone,
            reliability_score=rel,
            quality_rating=qual,
            spend_annual_usd=spend,
            health_status=s.health_status or "optimal",
            single_source_risk=bool(s.single_source_risk),
            lead_time_days=s.lead_time_days,
            capacity=s.capacity,
            is_active=bool(s.is_active),
            created_at=s.created_at,
            updated_at=s.updated_at,
            active_shipments_count=active_shipments,
            # Legacy frontend compatibility
            reliabilityScore=rel,
            spendAnnualUsd=spend,
            healthStatus=s.health_status or "optimal",
            singleSourceRisk=bool(s.single_source_risk),
        )

    @staticmethod
    def get_suppliers(
        db: Session,
        search: Optional[str] = None,
        tier: Optional[str] = None,
        health_status: Optional[str] = None,
        is_active: Optional[str] = None,
        sort_by: Optional[str] = "name",
        sort_order: Optional[str] = "asc",
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Supplier], int]:
        query = db.query(Supplier)

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Supplier.name.ilike(term),
                    Supplier.supplier_code.ilike(term),
                    Supplier.category.ilike(term),
                    Supplier.country.ilike(term),
                    Supplier.location.ilike(term),
                    Supplier.contact_person.ilike(term),
                )
            )

        if tier and tier.strip().lower() != "all":
            clean_tier = normalize_tier(tier)
            query = query.filter(Supplier.tier.ilike(clean_tier))

        if health_status and health_status.strip().lower() != "all":
            clean_status = normalize_health_status(health_status)
            query = query.filter(Supplier.health_status.ilike(clean_status))

        if is_active and is_active.strip().lower() != "all":
            val = is_active.strip().lower() in ("true", "1", "yes", "active")
            query = query.filter(Supplier.is_active == val)

        sort_field_map = {
            "name": Supplier.name,
            "reliability": Supplier.reliability_score,
            "reliability_score": Supplier.reliability_score,
            "spend": Supplier.spend_annual_usd,
            "annual_spend": Supplier.spend_annual_usd,
            "spend_annual_usd": Supplier.spend_annual_usd,
            "health_status": Supplier.health_status,
            "risk_rating": Supplier.health_status,
            "created_at": Supplier.created_at,
            "tier": Supplier.tier,
        }
        order_col = sort_field_map.get((sort_by or "").lower(), Supplier.name)
        if (sort_order or "").lower() == "desc":
            query = query.order_by(desc(order_col))
        else:
            query = query.order_by(asc(order_col))

        total = query.count()
        offset = max(0, (page - 1) * page_size)
        items = query.offset(offset).limit(page_size).all()
        return items, total

    @staticmethod
    def get_by_id(db: Session, identifier: str) -> Optional[Supplier]:
        try:
            val_uuid = uuid.UUID(identifier)
            s = db.query(Supplier).filter(Supplier.id == val_uuid).first()
            if s:
                return s
        except ValueError:
            pass

        return db.query(Supplier).filter(
            or_(
                Supplier.supplier_code.ilike(identifier.strip()),
                Supplier.name.ilike(identifier.strip()),
            )
        ).first()

    @staticmethod
    def create_supplier(db: Session, data: SupplierCreate) -> Supplier:
        name_clean = data.name.strip()
        # Check duplicate name
        existing_name = db.query(Supplier).filter(Supplier.name.ilike(name_clean)).first()
        if existing_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplier with name '{name_clean}' already exists in registry.",
            )

        # Check duplicate supplier_code if provided, else auto-generate
        code = (data.supplier_code or "").strip()
        if code:
            existing_code = db.query(Supplier).filter(Supplier.supplier_code.ilike(code)).first()
            if existing_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Supplier Code '{code}' already exists. Please choose a unique code.",
                )
        else:
            prefix = "SUP"
            short = uuid.uuid4().hex[:6].upper()
            code = f"{prefix}-{short}"

        supplier = Supplier(
            id=uuid.uuid4(),
            supplier_code=code,
            name=name_clean,
            tier=normalize_tier(data.tier),
            category=data.category.strip(),
            location=(data.location or data.country).strip(),
            country=data.country.strip(),
            contact_person=(data.contact_person or "").strip() or None,
            email=(data.email or "").strip() or None,
            phone=(data.phone or "").strip() or None,
            reliability_score=data.reliability_score,
            quality_rating=data.quality_rating,
            spend_annual_usd=data.spend_annual_usd,
            health_status=normalize_health_status(data.health_status),
            single_source_risk=data.single_source_risk,
            lead_time_days=data.lead_time_days,
            capacity=data.capacity,
            is_active=data.is_active,
        )

        try:
            db.add(supplier)
            db.commit()
            db.refresh(supplier)
            return supplier
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to persist supplier to database: {str(e)}",
            )

    @staticmethod
    def update_supplier(db: Session, supplier: Supplier, data: SupplierUpdate) -> Supplier:
        # Check duplicate name if changing
        if data.name is not None:
            name_clean = data.name.strip()
            existing = db.query(Supplier).filter(
                Supplier.name.ilike(name_clean),
                Supplier.id != supplier.id,
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Another supplier with name '{name_clean}' already exists.",
                )
            supplier.name = name_clean

        # Check duplicate supplier_code if changing
        if data.supplier_code is not None:
            code_clean = data.supplier_code.strip()
            if code_clean:
                existing = db.query(Supplier).filter(
                    Supplier.supplier_code.ilike(code_clean),
                    Supplier.id != supplier.id,
                ).first()
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Supplier Code '{code_clean}' is already assigned to another supplier.",
                    )
            supplier.supplier_code = code_clean or None

        if data.tier is not None:
            supplier.tier = normalize_tier(data.tier)
        if data.category is not None:
            supplier.category = data.category.strip()
        if data.location is not None:
            supplier.location = data.location.strip()
        if data.country is not None:
            supplier.country = data.country.strip()
        if data.contact_person is not None:
            supplier.contact_person = data.contact_person.strip() or None
        if data.email is not None:
            supplier.email = data.email.strip() or None
        if data.phone is not None:
            supplier.phone = data.phone.strip() or None
        if data.reliability_score is not None:
            supplier.reliability_score = data.reliability_score
        if data.quality_rating is not None:
            supplier.quality_rating = data.quality_rating
        if data.spend_annual_usd is not None:
            supplier.spend_annual_usd = data.spend_annual_usd
        if data.health_status is not None:
            supplier.health_status = normalize_health_status(data.health_status)
        if data.single_source_risk is not None:
            supplier.single_source_risk = data.single_source_risk
        if data.lead_time_days is not None:
            supplier.lead_time_days = data.lead_time_days
        if data.capacity is not None:
            supplier.capacity = data.capacity
        if data.is_active is not None:
            supplier.is_active = data.is_active

        try:
            db.commit()
            db.refresh(supplier)
            return supplier
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update supplier: {str(e)}",
            )

    @staticmethod
    def delete_supplier(db: Session, supplier: Supplier) -> None:
        """Safely delete supplier, ensuring no conflicting non-null foreign keys exist."""
        # Check active or historical shipments
        shipment_count = db.query(Shipment).filter(Shipment.supplier_id == supplier.id).count()
        # Check purchase records
        purchase_count = db.query(Purchase).filter(Purchase.supplier_id == supplier.id).count()
        # Check lead time observations
        lead_count = db.query(LeadTimeObservation).filter(LeadTimeObservation.supplier_id == supplier.id).count()

        conflicts = []
        if shipment_count > 0:
            conflicts.append(f"{shipment_count} shipment(s)")
        if purchase_count > 0:
            conflicts.append(f"{purchase_count} purchase order(s)")
        if lead_count > 0:
            conflicts.append(f"{lead_count} lead time observation(s)")

        if conflicts:
            conflict_msg = " and ".join(conflicts)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete supplier '{supplier.name}': referenced by {conflict_msg}. Reassign or remove dependent records before deletion.",
            )

        try:
            db.delete(supplier)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete supplier: {str(e)}",
            )

    # -------------------------------------------------------------------------
    # CSV Import Engine
    # -------------------------------------------------------------------------

    @staticmethod
    def generate_csv_template() -> str:
        output = io.StringIO()
        fieldnames = [
            "supplier_code",
            "name",
            "tier",
            "category",
            "location",
            "country",
            "contact_person",
            "email",
            "phone",
            "reliability",
            "quality_rating",
            "annual_spend",
            "risk_rating",
            "single_source",
            "lead_time_days",
            "capacity",
            "status",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerow({
            "supplier_code": "SUP-1010",
            "name": "Global Semiconductor Foundry Ltd",
            "tier": "Tier-1",
            "category": "Logic Silicon & Wafer Fabrication",
            "location": "Hsinchu Science Park",
            "country": "Taiwan",
            "contact_person": "Eileen Chang",
            "email": "procurement@globalsemi.tw",
            "phone": "+886-3-578-0221",
            "reliability": "96.5",
            "quality_rating": "98.0",
            "annual_spend": "12500000",
            "risk_rating": "optimal",
            "single_source": "No",
            "lead_time_days": "14",
            "capacity": "50000",
            "status": "Active",
        })
        writer.writerow({
            "supplier_code": "SUP-1020",
            "name": "Rheinland Precision Optics GmbH",
            "tier": "Tier-2",
            "category": "Photolithography Lenses & Lasers",
            "location": "Jena",
            "country": "Germany",
            "contact_person": "Klaus Richter",
            "email": "klaus.richter@rheinlandoptics.de",
            "phone": "+49-3641-65-0",
            "reliability": "89.0",
            "quality_rating": "94.5",
            "annual_spend": "4200000",
            "risk_rating": "warning",
            "single_source": "Yes",
            "lead_time_days": "28",
            "capacity": "12000",
            "status": "Active",
        })
        return output.getvalue()

    @staticmethod
    def preview_csv_import(
        file_bytes: bytes,
        filename: str,
        db: Session,
    ) -> SupplierImportPreviewResponse:
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

        if "name" not in col_map.values():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required column 'name' (or 'supplier' / 'supplier_name') in CSV headers.",
            )

        # Fetch existing suppliers from DB for duplicate checking
        existing_names = {s.name.lower(): s for s in db.query(Supplier).all()}
        existing_codes = {s.supplier_code.lower(): s for s in db.query(Supplier).filter(Supplier.supplier_code != None).all()}

        seen_names_in_file: Dict[str, int] = {}
        seen_codes_in_file: Dict[str, int] = {}

        valid_records: List[Dict[str, Any]] = []
        errors: List[SupplierImportRowError] = []
        duplicate_count = 0

        row_num = 1
        for row in reader:
            row_num += 1
            if not row or not any(c.strip() for c in row):
                continue  # skip completely blank lines

            raw_dict: Dict[str, Any] = {}
            row_data: Dict[str, Any] = {}
            for idx, cell in enumerate(row):
                val = sanitize_csv_cell(cell)
                header_name = raw_headers[idx] if idx < len(raw_headers) else f"col_{idx}"
                raw_dict[header_name] = val
                target_field = col_map.get(idx)
                if target_field:
                    row_data[target_field] = val

            # Check Name
            sup_name = (row_data.get("name") or "").strip()
            if not sup_name:
                errors.append(SupplierImportRowError(
                    row=row_num,
                    field="name",
                    message="Supplier name is required and cannot be empty.",
                    raw_data=raw_dict,
                ))
                continue

            # Check intra-file duplicate name
            sup_name_lower = sup_name.lower()
            if sup_name_lower in seen_names_in_file:
                first_row = seen_names_in_file[sup_name_lower]
                errors.append(SupplierImportRowError(
                    row=row_num,
                    field="name",
                    message=f"Duplicate supplier name '{sup_name}' already appeared in row {first_row}.",
                    raw_data=raw_dict,
                ))
                duplicate_count += 1
                continue
            seen_names_in_file[sup_name_lower] = row_num

            # Check DB duplicate name
            if sup_name_lower in existing_names:
                errors.append(SupplierImportRowError(
                    row=row_num,
                    field="name",
                    message=f"Supplier '{sup_name}' already exists in PostgreSQL database.",
                    raw_data=raw_dict,
                ))
                duplicate_count += 1
                continue

            # Check Supplier Code
            sup_code = (row_data.get("supplier_code") or "").strip()
            if sup_code:
                code_lower = sup_code.lower()
                if code_lower in seen_codes_in_file:
                    first_row = seen_codes_in_file[code_lower]
                    errors.append(SupplierImportRowError(
                        row=row_num,
                        field="supplier_code",
                        message=f"Duplicate supplier code '{sup_code}' already used in row {first_row}.",
                        raw_data=raw_dict,
                    ))
                    duplicate_count += 1
                    continue
                seen_codes_in_file[code_lower] = row_num

                if code_lower in existing_codes:
                    errors.append(SupplierImportRowError(
                        row=row_num,
                        field="supplier_code",
                        message=f"Supplier Code '{sup_code}' is already assigned in database.",
                        raw_data=raw_dict,
                    ))
                    duplicate_count += 1
                    continue
            else:
                sup_code = f"SUP-{uuid.uuid4().hex[:6].upper()}"

            # Numeric & Field Parsing
            # Reliability
            rel_str = row_data.get("reliability_score", "85.0")
            try:
                rel_val = float(rel_str) if rel_str else 85.0
                if not (0.0 <= rel_val <= 100.0):
                    raise ValueError()
            except ValueError:
                errors.append(SupplierImportRowError(
                    row=row_num,
                    field="reliability",
                    message=f"Reliability must be a number between 0 and 100, got: {rel_str}",
                    raw_data=raw_dict,
                ))
                continue

            # Quality Rating
            qual_str = row_data.get("quality_rating")
            qual_val = None
            if qual_str:
                try:
                    qual_val = float(qual_str)
                    if not (0.0 <= qual_val <= 100.0):
                        raise ValueError()
                except ValueError:
                    errors.append(SupplierImportRowError(
                        row=row_num,
                        field="quality_rating",
                        message=f"Quality rating must be a number between 0 and 100, got: {qual_str}",
                        raw_data=raw_dict,
                    ))
                    continue

            # Annual Spend
            spend_str = row_data.get("spend_annual_usd", "0")
            try:
                spend_val = float(spend_str) if spend_str else 0.0
                if spend_val < 0:
                    raise ValueError()
            except ValueError:
                errors.append(SupplierImportRowError(
                    row=row_num,
                    field="annual_spend",
                    message=f"Annual spend must be a non-negative number, got: {spend_str}",
                    raw_data=raw_dict,
                ))
                continue

            # Email
            email_val = row_data.get("email")
            if email_val:
                email_val = email_val.strip()
                import re
                if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", email_val):
                    errors.append(SupplierImportRowError(
                        row=row_num,
                        field="email",
                        message=f"Invalid email address syntax: {email_val}",
                        raw_data=raw_dict,
                    ))
                    continue

            # Lead time days
            lead_str = row_data.get("lead_time_days")
            lead_val = None
            if lead_str:
                try:
                    lead_val = int(float(lead_str))
                    if lead_val < 0:
                        raise ValueError()
                except ValueError:
                    errors.append(SupplierImportRowError(
                        row=row_num,
                        field="lead_time_days",
                        message=f"Lead time days must be a non-negative integer, got: {lead_str}",
                        raw_data=raw_dict,
                    ))
                    continue

            # Capacity
            cap_str = row_data.get("capacity")
            cap_val = None
            if cap_str:
                try:
                    cap_val = int(float(cap_str))
                    if cap_val < 0:
                        raise ValueError()
                except ValueError:
                    errors.append(SupplierImportRowError(
                        row=row_num,
                        field="capacity",
                        message=f"Capacity must be a non-negative integer, got: {cap_str}",
                        raw_data=raw_dict,
                    ))
                    continue

            # Single source boolean
            single_str = str(row_data.get("single_source_risk", "false")).lower()
            single_source_val = single_str in ("true", "1", "yes", "y")

            # Active status
            act_str = str(row_data.get("is_active", "true")).lower()
            active_val = act_str not in ("false", "0", "no", "inactive")

            tier_val = normalize_tier(row_data.get("tier"))
            category_val = (row_data.get("category") or "Component Supplier").strip()
            country_val = (row_data.get("country") or "Global").strip()
            location_val = (row_data.get("location") or country_val).strip()
            health_val = normalize_health_status(row_data.get("health_status"))

            valid_records.append({
                "row_number": row_num,
                "supplier_code": sup_code,
                "name": sup_name,
                "tier": tier_val,
                "category": category_val,
                "location": location_val,
                "country": country_val,
                "contact_person": (row_data.get("contact_person") or "").strip() or None,
                "email": email_val or None,
                "phone": (row_data.get("phone") or "").strip() or None,
                "reliability_score": rel_val,
                "quality_rating": qual_val,
                "spend_annual_usd": spend_val,
                "health_status": health_val,
                "single_source_risk": single_source_val,
                "lead_time_days": lead_val,
                "capacity": cap_val,
                "is_active": active_val,
            })

        preview_token = f"tok-{uuid.uuid4().hex}"
        _PREVIEW_CACHE[preview_token] = {
            "created_at": time.time(),
            "filename": filename,
            "valid_records": valid_records,
            "errors": [e.model_dump() for e in errors],
        }

        total_rows = len(valid_records) + len(errors)
        return SupplierImportPreviewResponse(
            preview_token=preview_token,
            total_rows=total_rows,
            valid_rows=len(valid_records),
            invalid_rows=len(errors) - duplicate_count,
            duplicate_rows=duplicate_count,
            errors=errors,
            preview_records=valid_records[:20],
        )

    @staticmethod
    def confirm_csv_import(
        preview_token: str,
        mode: str,
        db: Session,
    ) -> SupplierImportConfirmResponse:
        _clean_token_cache()

        cached = _PREVIEW_CACHE.get(preview_token)
        if not cached:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired preview session token. Please re-upload CSV to preview again.",
            )

        records_to_insert = cached.get("valid_records", [])
        initial_errors = [SupplierImportRowError(**e) for e in cached.get("errors", [])]

        if not records_to_insert:
            return SupplierImportConfirmResponse(
                success=True,
                imported_count=0,
                skipped_count=0,
                invalid_count=len(initial_errors),
                imported_suppliers=[],
                errors=initial_errors,
            )

        # Re-validate against current PostgreSQL state to avoid race conditions!
        existing_names = {s.name.lower() for s in db.query(Supplier).all()}
        existing_codes = {s.supplier_code.lower() for s in db.query(Supplier).filter(Supplier.supplier_code != None).all()}

        inserted_models: List[Supplier] = []
        skipped_count = 0
        final_errors: List[SupplierImportRowError] = list(initial_errors)

        try:
            for rec in records_to_insert:
                name_low = rec["name"].lower()
                code_low = rec["supplier_code"].lower()

                if name_low in existing_names or code_low in existing_codes:
                    if mode == "fail_on_duplicates":
                        db.rollback()
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Import aborted: duplicate supplier '{rec['name']}' ({rec['supplier_code']}) detected.",
                        )
                    skipped_count += 1
                    final_errors.append(SupplierImportRowError(
                        row=rec["row_number"],
                        field="name",
                        message=f"Skipped duplicate supplier '{rec['name']}' already present in database.",
                    ))
                    continue

                sup = Supplier(
                    id=uuid.uuid4(),
                    supplier_code=rec["supplier_code"],
                    name=rec["name"],
                    tier=rec["tier"],
                    category=rec["category"],
                    location=rec["location"],
                    country=rec["country"],
                    contact_person=rec["contact_person"],
                    email=rec["email"],
                    phone=rec["phone"],
                    reliability_score=rec["reliability_score"],
                    quality_rating=rec["quality_rating"],
                    spend_annual_usd=rec["spend_annual_usd"],
                    health_status=rec["health_status"],
                    single_source_risk=rec["single_source_risk"],
                    lead_time_days=rec["lead_time_days"],
                    capacity=rec["capacity"],
                    is_active=rec["is_active"],
                )
                db.add(sup)
                existing_names.add(name_low)
                existing_codes.add(code_low)
                inserted_models.append(sup)

            db.commit()

            # Refresh inserted
            for s in inserted_models:
                db.refresh(s)

            # Invalidate preview token after successful confirmation
            _PREVIEW_CACHE.pop(preview_token, None)

            serialized_suppliers = [SupplierService.serialize_supplier(s, db) for s in inserted_models]

            return SupplierImportConfirmResponse(
                success=True,
                imported_count=len(inserted_models),
                skipped_count=skipped_count,
                invalid_count=len(initial_errors),
                imported_suppliers=serialized_suppliers,
                errors=final_errors,
            )
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database transaction failed during supplier import: {str(e)}",
            )
