/**
 * TypeScript interfaces and types for the SynChain AI Sales Forecasting module.
 */

export interface SalesTransaction {
  id: string;
  transaction_id: string;
  transaction_date: string;
  product_id: string;
  product_name: string;
  product_category: string;
  quantity_sold: number;
  unit_selling_price: number;
  discount_amount: number;
  gross_revenue: number;
  net_revenue: number;
  region: string;
  customer_id?: string | null;
  order_id?: string | null;
  tax_amount: number;
  return_quantity: number;
  currency: string;
  import_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesTransactionListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: SalesTransaction[];
  summary: {
    filtered_total_revenue: number;
    filtered_units_sold: number;
    filtered_asp: number;
  };
}

export interface SalesCSVRowValidationError {
  row_number: number;
  field: string;
  value: any;
  message: string;
}

export interface SalesUploadPreviewResponse {
  import_id: string;
  filename: string;
  total_rows_detected: number;
  columns_detected: string[];
  missing_required_columns: string[];
  mapped_columns: Record<string, string>;
  preview_rows: Array<Record<string, any>>;
  validation_errors: SalesCSVRowValidationError[];
  valid_rows_count: number;
  invalid_rows_count: number;
  duplicate_in_file_count: number;
  existing_in_db_count: number;
  is_importable: boolean;
  summary: {
    total_records_detected: number;
    valid_records_to_import: number;
    invalid_or_rejected_records: number;
    duplicate_in_file: number;
    already_in_database: number;
    missing_required_columns_count: number;
    revenue_definition: string;
  };
}

export interface SalesImportSummaryResponse {
  import_id: string;
  status: string;
  total_records_processed: number;
  imported_count: number;
  duplicate_count: number;
  rejected_count: number;
  total_net_revenue: number;
  total_units_sold: number;
  date_min?: string | null;
  date_max?: string | null;
  error_samples: string[];
}

export interface SalesOverviewKPIs {
  total_revenue: number;
  total_units_sold: number;
  revenue_growth_mom?: number | null;
  revenue_growth_yoy?: number | null;
  average_selling_price: number;
  forecasted_revenue?: number | null;
  forecast_accuracy?: number | null;
  forecast_accuracy_metric: string;
  forecast_metric_wape?: number | null;
  forecast_metric_rmse?: number | null;
  forecast_metric_mae?: number | null;
  total_transactions: number;
  active_products_count: number;
  active_regions_count: number;
  data_freshness_timestamp: string;
  has_data: boolean;
}

export interface MonthlyTrendPoint {
  year_month: string;
  year: number;
  month: number;
  revenue: number;
  gross_revenue: number;
  units_sold: number;
  asp: number;
  transaction_count: number;
  mom_growth_pct?: number | null;
}

export interface QuarterlyTrendPoint {
  year_quarter: string;
  year: number;
  quarter: number;
  revenue: number;
  units_sold: number;
  asp: number;
  qoq_growth_pct?: number | null;
}

export interface YoYComparisonPoint {
  period: string;
  current_year: number;
  previous_year: number;
  current_year_revenue: number;
  previous_year_revenue: number;
  growth_pct?: number | null;
  is_equivalent_period: boolean;
}

export interface ProductSalesContribution {
  product_id: string;
  product_name: string;
  category: string;
  units_sold: number;
  total_revenue: number;
  asp: number;
  revenue_share_pct: number;
  trend_direction: 'growing' | 'declining' | 'stable';
  growth_pct?: number | null;
}

export interface CategorySalesPerformance {
  category: string;
  revenue: number;
  units_sold: number;
  revenue_share_pct: number;
  product_count: number;
  asp: number;
}

export interface RegionalSalesPerformance {
  region: string;
  revenue: number;
  units_sold: number;
  revenue_share_pct: number;
  transaction_count: number;
  asp: number;
}

export interface HistoricalSalesAnalysisResponse {
  has_data: boolean;
  kpis: SalesOverviewKPIs;
  monthly_trends: MonthlyTrendPoint[];
  quarterly_trends: QuarterlyTrendPoint[];
  yoy_comparison: YoYComparisonPoint[];
  product_contributions: ProductSalesContribution[];
  top_selling_products: ProductSalesContribution[];
  declining_products: ProductSalesContribution[];
  category_performance: CategorySalesPerformance[];
  regional_performance: RegionalSalesPerformance[];
  available_years: number[];
  available_categories: string[];
  available_regions: string[];
  date_range_applied: {
    year?: number | null;
    start_date?: string | null;
    end_date?: string | null;
  };
}

export interface SalesForecastPoint {
  date: string;
  predicted_revenue: number;
  confidence_lower: number;
  confidence_upper: number;
  predicted_units: number;
  is_forecast: boolean;
}

export interface SalesForecastEvaluationMetrics {
  mae: number;
  rmse: number;
  wape?: number | null;
  mape?: number | null;
  accuracy_pct?: number | null;
  sample_size: number;
  evaluation_type: string;
}

export interface RevenueForecastResponse {
  has_data: boolean;
  has_sufficient_history: boolean;
  explanation: string;
  product_id?: string | null;
  product_name?: string | null;
  category?: string | null;
  forecast_horizon_days: number;
  forecast_start_date?: string | null;
  forecast_end_date?: string | null;
  historical_points: SalesForecastPoint[];
  forecast_points: SalesForecastPoint[];
  total_historical_revenue: number;
  total_forecasted_revenue: number;
  total_forecasted_units: number;
  expected_revenue_growth_pct?: number | null;
  model_name: string;
  model_version: string;
  interval_confidence_pct: number;
  metrics?: SalesForecastEvaluationMetrics | null;
  data_freshness_timestamp: string;
  limitations: string[];
}

export interface SalesScenarioRequest {
  scenario_name: string;
  horizon_days: number;
  volume_change_pct: number;
  price_change_pct: number;
  demand_shock_pct: number;
  apply_fulfillment_constraints: boolean;
  product_id?: string | null;
  product_category?: string | null;
}

export interface SalesScenarioResponse {
  scenario_name: string;
  horizon_days: number;
  assumptions: Record<string, any>;
  baseline_projected_units: number;
  baseline_projected_revenue: number;
  scenario_projected_units: number;
  scenario_projected_revenue: number;
  fulfilled_units: number;
  unmet_units: number;
  revenue_variance_usd: number;
  revenue_variance_pct: number;
  fulfillment_constrained: boolean;
  bottlenecks: string[];
  formula_breakdown: Record<string, string>;
  daily_trajectory: Array<{
    date: string;
    baseline_units: number;
    baseline_revenue: number;
    scenario_demand_units: number;
    fulfilled_units: number;
    unmet_units: number;
    scenario_revenue: number;
    is_stockout_capped: boolean;
  }>;
}

export interface SalesSupplyChainIntegrationItem {
  sales_product_id: string;
  product_name: string;
  category: string;
  matched_db_product_id?: string | null;
  matched_sku?: string | null;
  available_stock_units: number;
  safety_stock_units: number;
  reorder_point: number;
  incoming_shipment_units: number;
  forecast_demand_units_30d: number;
  forecast_demand_units_60d: number;
  forecast_demand_units_90d: number;
  stockout_predicted_30d: boolean;
  days_to_stockout?: number | null;
  replenishment_shortfall_units: number;
  component_mapping_status: string;
  recommended_action: string;
}

export interface SalesSupplyChainIntegrationResponse {
  has_data: boolean;
  matched_products_count: number;
  unmatched_products_count: number;
  at_risk_stockout_count: number;
  total_shortfall_units: number;
  items: SalesSupplyChainIntegrationItem[];
  summary_insight: string;
}
