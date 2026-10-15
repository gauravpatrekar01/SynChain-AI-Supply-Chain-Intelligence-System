/**
 * TypeScript definitions for the SynChain AI Analysis Module.
 */

export interface SupplyChainHealthKPIs {
  total_shipments: number;
  delayed_shipments: number;
  high_risk_shipments: number;
  active_suppliers: number;
  products_below_safety_stock: number;
  products_at_risk_of_stockout: number;
  total_inventory_items: number;
  average_supplier_reliability: number;
  data_freshness_timestamp: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFindingItem {
  risk_id: string;
  category: string;
  affected_entity_type: string;
  affected_entity_name: string;
  entity_identifier: string;
  risk_score: number;
  risk_level: RiskLevel;
  primary_risk_factors: string[];
  potential_business_impact: string;
  recommended_action: string;
  analysis_timestamp: string;
  calculation_details?: {
    observed_facts?: string[];
    metrics?: Record<string, any>;
    predictions?: Record<string, any>;
  };
}

export interface AnalysisOverviewResponse {
  kpis: SupplyChainHealthKPIs;
  shipment_risk_distribution: Record<string, number>;
  supplier_risk_distribution: Record<string, number>;
  inventory_status_distribution: Record<string, number>;
  risk_distribution_by_category: Record<string, number>;
  top_risks: RiskFindingItem[];
  analysis_timestamp: string;
  system_status: string;
}

export interface RiskRegisterListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  risks: RiskFindingItem[];
  available_categories: string[];
  available_severities: string[];
}

export interface RiskDetailResponse {
  risk: RiskFindingItem;
  observed_facts: string[];
  calculated_metrics: Record<string, any>;
  model_predictions?: Record<string, any>;
  potential_consequences: string[];
  suggested_actions: string[];
}

export interface ShipmentAnalysisItem {
  id: string;
  shipment_id: string;
  shipment_name: string;
  supplier_name?: string | null;
  supplier_id?: string | null;
  origin: string;
  destination: string;
  transport_mode: string;
  carrier_name: string;
  status: string;
  delay_days: number;
  departure_date?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  risk_factors: Array<{ factor: string; score: number; weight: number; detail: string }>;
  impact: string;
  explanation: string;
}

export interface ShipmentAnalysisListResponse {
  total: number;
  delayed_count: number;
  high_risk_count: number;
  average_delay_days: number;
  items: ShipmentAnalysisItem[];
}

export interface SupplierAnalysisItem {
  id: string;
  supplier_code: string;
  supplier_name: string;
  tier: string;
  category: string;
  location?: string | null;
  country: string;
  reliability_score: number;
  quality_rate?: number | null;
  on_time_delivery_rate: number;
  average_delay_days: number;
  capacity_utilization?: number | null;
  active_shipments_count: number;
  single_source_risk: boolean;
  spend_annual_usd: number;
  health_status: string;
  risk_score: number;
  risk_level: RiskLevel;
  key_risk_factors: string[];
  explanation: string;
  alternative_sourcing_profile?: {
    qualifies_as_alternative: boolean;
    lead_time_days: number;
    category: string;
    location: string;
    capacity: number;
  };
}

export interface SupplierAnalysisListResponse {
  total: number;
  high_risk_count: number;
  single_source_count: number;
  average_reliability: number;
  items: SupplierAnalysisItem[];
}

export interface InventoryAnalysisItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  sku: string;
  name: string;
  category: string;
  facility: string;
  location?: string | null;
  on_hand_units: number;
  reserved_units: number;
  available_units: number;
  safety_stock_units: number;
  reorder_point: number;
  reorder_quantity: number;
  average_daily_demand?: number | null;
  days_of_supply?: number | null;
  buffer_health_percentage: number;
  status: 'optimal' | 'warning' | 'critical';
  risk_score: number;
  risk_level: RiskLevel;
  stockout_risk: boolean;
  estimated_stockout_date?: string | null;
  explanation: string;
  evidence: string[];
}

export interface InventoryAnalysisListResponse {
  total: number;
  below_safety_count: number;
  stockout_risk_count: number;
  critical_status_count: number;
  items: InventoryAnalysisItem[];
}

export interface ForecastAnalysisItem {
  sku: string;
  product_name: string;
  category: string;
  warehouse: string;
  forecast_horizon_days: number;
  expected_total_demand: number;
  current_available_inventory: number;
  expected_inventory_after_demand: number;
  stockout_predicted: boolean;
  estimated_stockout_day?: number | null;
  estimated_stockout_date?: string | null;
  historical_baseline_daily_avg?: number | null;
  confidence_lower_total?: number | null;
  confidence_upper_total?: number | null;
  model_version: string;
  data_source: string;
  limitations: string[];
}

export interface ForecastAnalysisListResponse {
  total: number;
  stockout_predicted_count: number;
  items: ForecastAnalysisItem[];
}

export interface AnalysisSimulationRequest {
  current_inventory: number;
  daily_demand: number;
  shipment_delay_days: number;
  original_lead_time_days?: number;
  replenishment_quantity?: number;
  alternative_supplier_lead_time_days?: number;
  alternative_procurement_cost_premium_pct?: number;
  expedite_transit_reduction_days?: number;
  expedite_cost_usd?: number;
  unit_stockout_penalty_usd?: number;
  unit_cost_usd?: number;
  product_sku?: string;
}

export interface DailyTrajectoryPoint {
  day: number;
  date: string;
  scenario_a_wait_stock: number;
  scenario_b_alt_stock: number;
  scenario_c_expedite_stock: number;
}

export interface ScenarioOutcome {
  name: string;
  description: string;
  replenishment_day: number;
  stockout_day?: number | null;
  days_in_stockout: number;
  total_unmet_demand: number;
  stockout_penalty_cost: number;
  logistics_extra_cost: number;
  procurement_premium_cost: number;
  total_financial_impact_usd: number;
  minimum_inventory_reached: number;
}

export interface AnalysisSimulationResponse {
  product_sku?: string | null;
  parameters: Record<string, any>;
  trajectories: DailyTrajectoryPoint[];
  scenario_a_wait: ScenarioOutcome;
  scenario_b_alternative: ScenarioOutcome;
  scenario_c_expedite: ScenarioOutcome;
  comparison_summary: {
    lowest_cost_scenario: string;
    cost_difference_vs_wait: {
      scenario_b_diff: number;
      scenario_c_diff: number;
    };
    unmet_demand_prevention: {
      scenario_b_units_saved: number;
      scenario_c_units_saved: number;
    };
  };
  advisory_recommendation: string;
  assumptions: string[];
}

export type RecommendationStatus = 'Open' | 'Reviewed' | 'Accepted' | 'Rejected' | 'Resolved';

export interface AnalysisRecommendationItem {
  recommendation_id: string;
  related_risk_id?: string | null;
  title: string;
  category: string;
  suggested_action: string;
  supporting_evidence: string[];
  expected_benefit: string;
  important_trade_offs: string;
  required_user_decision: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: RecommendationStatus;
  created_at: string;
  updated_at?: string | null;
}

export interface AnalysisRecommendationsListResponse {
  total: number;
  open_count: number;
  resolved_count: number;
  recommendations: AnalysisRecommendationItem[];
}
