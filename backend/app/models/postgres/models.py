import uuid
from sqlalchemy import Column, String, Numeric, Boolean, Integer, DateTime, ForeignKey, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    role = Column(String(100), nullable=False)
    avatar_url = Column(String, nullable=True)
    department = Column(String(255), nullable=True)
    access_tier = Column(String(100), default="Standard Executive")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    tier = Column(String(50), nullable=False)
    category = Column(String(255), nullable=False)
    country = Column(String(100), nullable=False)
    reliability_score = Column(Numeric(5, 2), nullable=False)
    spend_annual_usd = Column(Numeric(15, 2), nullable=False)
    health_status = Column(String(50), nullable=False)
    single_source_risk = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(255), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    country = Column(String(100), nullable=False)
    latitude = Column(Numeric(9, 6), nullable=True)
    longitude = Column(Numeric(9, 6), nullable=True)
    capacity_units = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    stock_quantity = Column(Integer, nullable=False, default=0)
    safety_stock_level = Column(Integer, nullable=False, default=0)
    reorder_level = Column(Integer, nullable=False, default=0)
    reorder_quantity = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Order(Base):
    __tablename__ = "orders"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    order_status = Column(String(50), nullable=False)
    shipping_mode = Column(String(100), nullable=True)
    order_date = Column(DateTime(timezone=True), nullable=False)
    shipping_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), default=0)
    profit = Column(Numeric(12, 2), nullable=True)

class Sales(Base):
    __tablename__ = "sales"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity_sold = Column(Integer, nullable=False)
    revenue = Column(Numeric(15, 2), nullable=False)
    sale_date = Column(DateTime(timezone=True), nullable=False)

class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    cost = Column(Numeric(15, 2), nullable=False)
    purchase_date = Column(DateTime(timezone=True), nullable=False)

class DemandForecast(Base):
    __tablename__ = "demand_forecasts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    forecast_date = Column(Date, nullable=False)
    predicted_demand = Column(Numeric(12, 2), nullable=False)
    confidence_lower = Column(Numeric(12, 2), nullable=False)
    confidence_upper = Column(Numeric(12, 2), nullable=False)
    historical_baseline = Column(Numeric(12, 2), nullable=True)
    model_version = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class RiskPrediction(Base):
    __tablename__ = "risk_predictions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(100), nullable=False) # 'product', 'supplier', 'warehouse'
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    risk_probability = Column(Numeric(5, 4), nullable=False)
    risk_category = Column(String(50), nullable=False) # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    confidence_score = Column(Numeric(5, 4), nullable=False)
    explanation = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RiskFactor(Base):
    __tablename__ = "risk_factors"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    risk_prediction_id = Column(UUID(as_uuid=True), ForeignKey("risk_predictions.id", ondelete="CASCADE"), nullable=False)
    feature_name = Column(String(255), nullable=False)
    contribution_score = Column(Numeric(10, 6), nullable=False)
    description = Column(String, nullable=True)

class Scenario(Base):
    __tablename__ = "scenarios"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    disruption_type = Column(String(100), nullable=False)
    target_entity_type = Column(String(100), nullable=False)
    target_entity_id = Column(String(100), nullable=False)
    duration_days = Column(Integer, nullable=False)
    severity_pct = Column(Numeric(5, 2), nullable=False)
    include_second_tier_cascade = Column(Boolean, default=True)
    auto_mitigate = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ScenarioResult(Base):
    __tablename__ = "scenario_results"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id = Column(UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    financial_loss_estimate_usd = Column(Numeric(15, 2), nullable=False)
    lost_production_units = Column(Integer, nullable=False)
    estimated_delay_days = Column(Numeric(5, 2), nullable=False)
    risk_score_post_simulation = Column(Integer, nullable=False)
    pre_risk_score = Column(Integer, nullable=True)
    net_financial_exposure_usd = Column(Numeric(15, 2), nullable=True)
    days_to_stockout = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    risk_prediction_id = Column(UUID(as_uuid=True), ForeignKey("risk_predictions.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(255), nullable=False)
    reason = Column(String, nullable=False)
    expected_benefit = Column(String(255), nullable=True)
    estimated_cost = Column(Numeric(12, 2), nullable=True)
    affected_entities = Column(ARRAY(String), nullable=True)
    confidence = Column(Numeric(5, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ExternalData(Base):
    __tablename__ = "external_data"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_name = Column(String(255), nullable=False)
    data_type = Column(String(100), nullable=False)
    payload = Column(JSONB, nullable=False)
    retrieved_at = Column(DateTime(timezone=True), server_default=func.now())

class ModelRun(Base):
    __tablename__ = "model_runs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String(255), nullable=False)
    run_type = Column(String(50), nullable=False)
    metrics = Column(JSONB, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
