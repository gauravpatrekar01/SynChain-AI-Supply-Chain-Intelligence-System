"""Observed inputs, distinct from sales revenue and model predictions."""
import uuid
from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class DemandObservation(Base):
    __tablename__ = "demand_observations"
    __table_args__ = (UniqueConstraint("product_id", "warehouse_id", "observation_date", name="uq_demand_day"), CheckConstraint("quantity >= 0", name="ck_demand_nonnegative"))
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=False)
    observation_date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LeadTimeObservation(Base):
    __tablename__ = "lead_time_observations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    receipt_id = Column(String(100), nullable=False, unique=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    order_date = Column(Date, nullable=False)
    actual_delivery = Column(Date, nullable=False)
    expected_delivery = Column(Date, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (CheckConstraint("actual_delivery >= order_date", name="ck_lead_chronology"),)
