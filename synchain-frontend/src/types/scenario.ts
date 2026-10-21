// ========================================================
// SynChain Scenario Intelligence & Evidence Report Types
// ========================================================

export type DisruptionScenarioType =
  | 'supplier_outage'
  | 'port_closure'
  | 'freight_delay'
  | 'demand_surge'
  | 'raw_material_spike'
  | 'geopolitical_embargo';

export type OptimizationObjective =
  | 'balanced'
  | 'minimize_cost'
  | 'minimize_delay'
  | 'maximize_service_level';

export type MitigationStrategyId =
  | 'SWITCH_SUPPLIER'
  | 'SPLIT_PROCUREMENT'
  | 'EXPEDITE_AIR_FREIGHT'
  | 'ACCEPT_RISK';

export type FeasibilityStatus =
  | 'FEASIBLE'
  | 'FEASIBLE_WITH_TRADE_OFFS'
  | 'CONSTRAINED_BY_BUDGET'
  | 'CONSTRAINED_BY_CAPACITY';

export interface DataReadinessCheck {
  is_ready: boolean;
  status: 'ready' | 'partial' | 'not_ready';
  total_products: number;
  total_suppliers: number;
  total_warehouses: number;
  total_inventory_records: number;
  total_shipments: number;
  data_freshness_timestamp?: string;
  readiness_score_pct: number;
  missing_elements: string[];
  recommendations: string[];
}

export interface OrganizationOption {
  id: string;
  name: string;
  type: string;
  category?: string;
  import_id?: string;
  description?: string;
  product_count?: number;
}

export interface ScenarioConfigOption {
  value: string;
  label: string;
  category?: string;
  lead_time_days?: number;
  reliability_score?: number;
  country?: string;
  unit_cost_usd?: number;
  stock_on_hand?: number;
  on_hand_inventory?: number;
  daily_demand?: number;
  safety_stock?: number;
  source_supplier_id?: string;
  source_supplier_name?: string;
  source_warehouse_name?: string;
  source_address?: string;
  destination_warehouse_name?: string;
  destination_address?: string;
  carrier_name?: string;
  transport_mode?: string;
  shipment_id?: string;
  shipment_status?: string;
  organization_id?: string;
  organization_name?: string;
  import_id?: string;
  organization_ids?: string[];
  has_alternative_supplier?: boolean;
}

export interface ProductStrategyEligibility {
  strategy_id: string;
  strategy_name: string;
  is_eligible: boolean;
  reason: string;
  prerequisites?: string;
}

export interface ProductRecommendationSummary {
  sku: string;
  product_name: string;
  organization_id?: string;
  organization_name?: string;
  is_data_complete: boolean;
  missing_fields: string[];
  eligible_strategies: ProductStrategyEligibility[];
  active_recommendations: Array<{
    id: string;
    title: string;
    category: string;
    action: string;
    priority: string;
    benefit?: string;
    trade_off?: string;
  }>;
  next_required_action: string;
}

export interface ScenarioConfigOptionsResponse {
  organizations?: OrganizationOption[];
  products: ScenarioConfigOption[];
  suppliers: ScenarioConfigOption[];
  warehouses: ScenarioConfigOption[];
  disruption_types: Array<{ value: string; label: string; desc: string }>;
  objectives: Array<{ value: string; label: string; desc: string }>;
}

export interface ScenarioSimulationRequest {
  scenario_name: string;
  disruption_type: DisruptionScenarioType;
  organization_id?: string;
  organization_name?: string;
  target_product_id?: string;
  sku?: string;
  target_supplier_id?: string;
  target_supplier_name?: string;
  target_warehouse_id?: string;
  source_warehouse_name?: string;
  source_address?: string;
  destination_warehouse_name?: string;
  destination_address?: string;
  carrier_name?: string;
  transport_mode?: string;
  duration_days: number;
  severity_pct: number;
  disruption_delay_days?: number;
  simulation_horizon_days?: number;
  initial_inventory?: number;
  order_quantity?: number;
  safety_stock?: number;
  daily_demand?: number;
  use_forecast_demand?: boolean;
  objective: OptimizationObjective;
  budget_limit_usd?: number;
  max_acceptable_delay_days?: number;
  alternative_supplier_id?: string;
  alternative_supplier_name?: string;
  alternative_lead_time_days?: number;
  alternative_unit_cost_usd?: number;
}

export interface DailyTrajectoryPoint {
  day: number;
  starting_inventory: number;
  incoming_quantity: number;
  demand: number;
  fulfilled_demand: number;
  unmet_demand: number;
  ending_inventory: number;
  cumulative_unmet_demand: number;
  is_safety_stock_breached: boolean;
  is_stockout: boolean;
}

export interface MitigationStrategyResult {
  strategy_id: MitigationStrategyId;
  strategy_name: string;
  strategy_type: string;
  description: string;
  operational_action: string;
  arrival_day: number;
  delivery_delay_days: number;
  service_level_pct: number;
  stockout_days_count: number;
  unmet_demand_units: number;
  direct_purchase_cost_usd: number;
  logistics_expedite_cost_usd: number;
  holding_cost_usd: number;
  stockout_penalty_cost_usd: number;
  total_cost_usd: number;
  feasibility_status: FeasibilityStatus;
  objective_score: number;
  rank: number;
  trade_offs: string[];
  daily_trajectory: DailyTrajectoryPoint[];
}

export interface BaselineAndDisruptedSummary {
  scenario_type: 'baseline' | 'disrupted';
  display_name: string;
  arrival_day: number;
  delivery_delay_days: number;
  service_level_pct: number;
  stockout_days_count: number;
  unmet_demand_units: number;
  total_cost_usd: number;
  direct_purchase_cost_usd: number;
  logistics_expedite_cost_usd: number;
  holding_cost_usd: number;
  stockout_penalty_cost_usd: number;
  daily_trajectory: DailyTrajectoryPoint[];
}

export interface MetricCalculationDetail {
  metric_name: string;
  definition: string;
  formula: string;
  input_values: Record<string, any>;
  result_value: number;
  units: string;
  assumptions: string;
  data_source: string;
}

export interface DataProvenance {
  source_name: string;
  dataset_identifier: string;
  records_count: number;
  data_freshness_timestamp: string;
  is_live_database: boolean;
  data_limitations: string[];
}

export interface AffectedEntitySummary {
  suppliers: Array<{
    id: string;
    name: string;
    country: string;
    category?: string;
    reliability_score?: number;
    role?: string;
  }>;
  products: Array<{
    id: string;
    sku: string;
    name: string;
    category?: string;
    unit_price?: number;
  }>;
  warehouses: Array<{
    id: string;
    name: string;
    location: string;
    capacity?: number;
  }>;
  shipments: Array<{
    id: string;
    tracking_number: string;
    status: string;
    origin: string;
    destination: string;
  }>;
}

export interface AINarrative {
  executive_summary: string;
  operational_impact_summary: string;
  recommended_response_explanation: string;
  trade_off_analysis: string;
  confidence_limitations: string;
  is_ai_generated: boolean;
  model_used?: string;
  fallback_reason?: string;
}

export interface ScenarioSimulationResponse {
  report_id: string;
  scenario_id?: string;
  scenario_name: string;
  disruption_type: string;
  objective: string;
  organization_name?: string;
  route_details?: {
    organization_name?: string;
    product_name?: string;
    sku?: string;
    source_supplier_name?: string;
    source_warehouse_name?: string;
    source_address?: string;
    destination_warehouse_name?: string;
    destination_address?: string;
    carrier_name?: string;
    transport_mode?: string;
    lead_time_days?: number;
    initial_inventory?: number;
    daily_demand?: number;
    unit_cost_usd?: number;
  };
  created_at: string;
  baseline: BaselineAndDisruptedSummary;
  disrupted: BaselineAndDisruptedSummary;
  mitigation_strategies: MitigationStrategyResult[];
  recommended_strategy_id: string;
  recommended_strategy_name: string;
  recommendation_rationale: string;
  affected_entities: AffectedEntitySummary;
  calculation_transparency: Record<string, MetricCalculationDetail>;
  data_provenance: DataProvenance;
  ai_narrative: AINarrative;
  model_version: string;
  disclaimer?: string;
}

export interface SimulationEvidenceReportSummary {
  report_id: string;
  scenario_name: string;
  disruption_type: string;
  objective: string;
  recommended_strategy_id: string;
  recommended_strategy_name: string;
  baseline_cost_usd: number;
  disrupted_cost_usd: number;
  mitigated_cost_usd: number;
  service_level_saved_pct: number;
  created_at: string;
  is_ai_generated: boolean;
}
