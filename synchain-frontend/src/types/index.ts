// ==========================================
// SynChain AI — Core TypeScript Domain Types
// ==========================================

export type HealthStatus = 'optimal' | 'warning' | 'critical' | 'nominal';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TransportMode = 'air' | 'ocean' | 'road' | 'rail' | 'ground';
export type NodeType =
  | 'supplier_t2'
  | 'supplier_t1'
  | 'tier2_supplier'
  | 'tier1_supplier'
  | 'factory'
  | 'warehouse'
  | 'distribution_hub'
  | 'port'
  | 'customer';

export type DisruptionType =
  | 'port_shutdown'
  | 'supplier_bankruptcy'
  | 'semiconductor_shortage'
  | 'typhoon_disruption'
  | 'port_closure'
  | 'geopolitical_tariff'
  | 'raw_material_spike'
  | 'suez_reroute'
  | 'custom';

// --- Dashboard & Metrics ---
export interface KPIMetric {
  id: string;
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  changePct: number;
  isPositive: boolean;
  sparkline: number[];
  status: HealthStatus;
  description: string;
  iconName: string;
}

export interface AIHealthScore {
  score: number; // 0 - 100
  status: HealthStatus;
  resilienceRating: string;
  lastUpdated: string;
  activeDisruptionsCount: number;
  predictedRiskEventsCount: number;
  mitigationReadinessPct: number;
  latencyMs: number;
}

export interface LiveIncidentAlert {
  id: string;
  timestamp: string;
  title: string;
  severity: RiskSeverity;
  category: 'supplier' | 'weather' | 'logistics' | 'inventory' | 'geopolitical';
  source: string;
  impactSummary: string;
  confidencePct: number;
  isRead: boolean;
  actionRequired: boolean;
  recommendedActionTitle?: string;
}

// --- Digital Twin Topology ---
export interface DigitalTwinNodeData {
  label: string;
  nodeType: NodeType;
  tier?: 1 | 2;
  location: string;
  country: string;
  coordinates: [number, number];
  healthStatus: HealthStatus;
  riskScore: number; // 0-100
  failureProb: number; // percentage
  inventoryPct: number; // 0-100
  capacityUtilization: number; // percentage
  throughputUnitsPerDay: number;
  leadTimeDays: number;
  currentOrdersCount: number;
  annualSpendUsd: number;
  upstreamIds: string[];
  downstreamIds: string[];
  primaryProduct: string;
  recommendedMitigation?: string;
}

export interface DigitalTwinNode {
  id: string;
  label: string;
  type: string;
  tier?: number;
  country: string;
  status: HealthStatus;
  riskScore: number;
  failureProb: number;
  capacityUtilization: number;
  currentOrdersCount: number;
  leadTimeDays: number;
  primaryProduct: string;
  upstreamIds: string[];
  downstreamIds: string[];
}

export interface DigitalTwinEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  flowRateUnits: number;
  activeCargoValueUsd: number;
  transitHours: number;
  status: HealthStatus;
  isBottleneck?: boolean;
  transportMode: string;
}

export interface DigitalTwinEdgeData {
  flowRateUnits: number;
  activeCargoValueUsd: number;
  transitHours: number;
  transportMode: TransportMode;
  status: HealthStatus;
  isBottleneck: boolean;
}

// --- Geographic Logistics & Fleet ---
export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface LiveTransportVehicle {
  id: string;
  identifier: string; // e.g. "FLT-7729 (Boeing 777F)"
  mode: TransportMode;
  origin: string;
  originCoords: GeoCoordinate;
  destination: string;
  destCoords: GeoCoordinate;
  currentCoords: GeoCoordinate;
  progressPct: number;
  speedKnotsOrKmh: string;
  cargoDescription: string;
  cargoValueUsd: number;
  carrier: string;
  status: 'on_schedule' | 'minor_delay' | 'rerouted' | 'severe_delay';
  eta: string;
  delayHours: number;
}

export interface ShipmentRiskFactor {
  factor: string;
  score: number;
  weight: number;
  available: boolean;
  description?: string;
}

export interface ShipmentRiskData {
  shipment_id: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_factors: ShipmentRiskFactor[];
  data_completeness: 'PARTIAL' | 'COMPLETE';
  calculated_at: string;
}

export interface ShipmentTrackingEvent {
  event?: string;
  status?: string;
  location?: string;
  timestamp: string;
  description?: string;
}

export interface ShipmentSummary {
  total_shipments: number;
  in_transit: number;
  delivered: number;
  delayed: number;
  high_risk: number;
  critical_risk: number;
}

export interface ShipmentListResponse {
  items: Shipment[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ShipmentFormData {
  shipment_id?: string;
  shipment_name: string;
  supplier_id?: string | null;
  origin: string;
  destination: string;
  cargo_description: string;
  quantity: number;
  transport_mode: 'Ocean' | 'Air' | 'Ground' | 'Rail';
  departure_date: string;
  expected_delivery_date: string;
  actual_delivery_date?: string | null;
  carrier_name: string;
  tracking_number?: string;
  status: 'in_transit' | 'delivered' | 'delayed' | 'pending' | 'cancelled';
  initial_risk_score?: number;
}

export interface Shipment {
  id: string;
  shipment_id?: string;
  shipment_name?: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  origin: string;
  destination: string;
  cargo_description?: string;
  quantity?: number;
  transport_mode?: string;
  departure_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string | null;
  carrier_name?: string;
  tracking_number?: string | null;
  status: string;
  risk_score?: number;
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_factors?: ShipmentRiskFactor[];
  data_completeness?: 'PARTIAL' | 'COMPLETE';
  initial_risk_score?: number | null;
  tracking_history?: ShipmentTrackingEvent[];
  created_at?: string;
  updated_at?: string;

  // Legacy & GeoMap Compatibility
  carrier: string;
  mode: 'ocean' | 'air' | 'ground' | 'rail';
  cargoDescription: string;
  speedKnots?: number;
  eta: string;
  vesselName?: string;
  rerouteRecommendation?: string;
  originCoords?: GeoCoordinate;
  destCoords?: GeoCoordinate;
  currentCoords?: GeoCoordinate;
  routeWaypoints?: [number, number][];
}

export interface PortNode {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number];
  status: HealthStatus;
  congestionIndex: number;
  waitTimeDays: number;
}

export interface GeoRiskZone {
  id: string;
  name: string;
  type: 'typhoon' | 'port_strike' | 'geopolitical_strait' | 'blizzard' | 'customs_backlog';
  center: GeoCoordinate;
  radiusKm: number;
  severity: RiskSeverity;
  description: string;
  affectedVesselCount: number;
  estimatedDelayDays: number;
}

// --- Supplier ---
export interface Supplier {
  id: string;
  name: string;
  tier: 'Tier-1' | 'Tier-2';
  category: string;
  country: string;
  reliabilityScore: number;
  spendAnnualUsd: number;
  healthStatus: HealthStatus;
  singleSourceRisk: boolean;
}

// --- Scenario Simulation Engine ---
export type SimulationPhaseId =
  | 'idle'
  | 'collecting_erp'
  | 'scanning_suppliers'
  | 'analyzing_weather'
  | 'running_ai'
  | 'synthesizing_playbook'
  | 'completed';

export interface ScenarioInput {
  scenarioName: string;
  disruptionType: DisruptionType;
  targetEntityId: string;
  targetEntityName: string;
  targetType: string;
  durationDays: number;
  severityPct: number;
  includeSecondTierCascade: boolean;
  autoMitigate: boolean;
}

export interface MitigationStrategy {
  id: string;
  title: string;
  description: string;
  category: string;
  costEstimateUsd: number;
  savingsEstimateUsd: number;
  timeSavedDays: number;
  implementationTimeframe: string;
  status: 'pending' | 'executed';
}

export interface SimulationResultMetrics {
  scenarioId: string;
  scenarioName: string;
  createdAt: string;
  financialLossEstimateUsd: number;
  lostProductionUnits: number;
  estimatedDelayDays: number;
  riskScorePostSimulation: number;
  productionLossUnits?: number;
  productionLossPct?: number;
  estimatedRevenueLossUsd?: number;
  slaPenaltyCostUsd?: number;
  expeditedRecoveryCostUsd?: number;
  netFinancialExposureUsd?: number;
  daysToStockout?: number;
  averageShipmentDelayDays?: number;
  preRiskScore?: number;
  postRiskScore?: number;
  mitigatedRiskScore?: number;
  affectedProductLines?: string[];
  affectedCustomerOrdersCount?: number;
  dailyImpactTrend: Array<{
    day: number;
    lossWithoutMitigation: number;
    lossWithMitigation: number;
  }>;
  cascadingTimeline: Array<{
    day: number;
    affectedEntity: string;
    description: string;
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
  }>;
  timelineDays?: Array<{
    day: number;
    inventoryUnits: number;
    unfulfilledOrders: number;
    cumulativeLossUsd: number;
    mitigatedInventoryUnits: number;
  }>;
  mitigationStrategies: MitigationStrategy[];
}

// --- Strategy Option (Legacy & Unified) ---
export interface StrategyOption {
  id: string;
  title: string;
  category: 'dual_source' | 'air_freight' | 'inventory_reallocation' | 'production_shift' | string;
  confidenceScore: number; // 0-100%
  costUsd: number;
  timeSavedDays: number;
  riskReductionPct: number;
  businessRoiMultiplier: number;
  lossAvoidedUsd: number;
  isBestRecommendation: boolean;
  summary: string;
  actionChecklist: string[];
  affectedPartners: string[];
  status: 'ready' | 'deploying' | 'deployed';
}

// --- Predictive Forecasts ---
export interface DemandForecastPoint {
  date: string;
  actualDemandUnits?: number;
  predictedDemandUnits: number;
  confidenceLower: number;
  confidenceUpper: number;
  historicalBaseline: number;
  trend?: number;
}

export interface ForecastMetricsData {
  mae?: number | null;
  rmse?: number | null;
  wape?: number | null;
  mape?: number | null;
  mape_status?: string | null;
  sample_size?: number | null;
  evaluation_split?: string | null;
}

export interface DemandForecastRequestPayload {
  productId?: string;
  historicalData: Array<{ date: string; demand: number }>;
  horizonDays: number;
  intervalWidth?: number;
  evaluate?: boolean;
}

export interface DemandForecastResponsePayload {
  status: string;
  productId?: string;
  algorithm: string;
  modelVersion: string;
  horizon: number;
  metrics?: ForecastMetricsData;
  forecast: DemandForecastPoint[];
  historical: DemandForecastPoint[];
  all_points?: DemandForecastPoint[];
}

export interface InventoryPolicyRequestPayload {
  productId?: string;
  forecastPoints: Array<DemandForecastPoint | { predictedDemandUnits: number } | number>;
  leadTimeDays: number;
  targetServiceLevel?: number;
  leadTimeStdDays?: number;
  dailyForecastRmse?: number;
  cumulativeLeadTimeErrors?: number[];
  holdingCostPerUnit?: number;
  stockoutCostPerUnit?: number;
  currentStock?: number;
  standardReorderQuantity?: number;
}

export interface InventoryPolicyResponsePayload {
  status: string;
  productId?: string;
  leadTimeDays: number;
  targetServiceLevel: number;
  expectedLeadTimeDemand: number;
  safetyStock: number;
  reorderPoint: number;
  currentStock?: number | null;
  recommendedReorderQuantity?: number | null;
  reorderRequired?: boolean | null;
  dataSource?: string;
  leadTimeUncertaintySigma?: number;
  leadTimeDemandBounds?: {
    lower: number;
    upper: number;
    nominalCoveragePct: number;
  };
  methodUsed: string;
  criticalFractile?: number | null;
  leadTimeStdDays?: number;
  assumptions: string[];
  errorMessage?: string;
}

export interface InventoryItemDetail {
  sku: string;
  name: string;
  category: string;
  warehouse: string;
  warehouseLocation?: string;
  currentStock: number;
  safetyStock: number;
  reorderLevel: number;
  reorderQuantity: number;
  unitPrice: number;
  leadTimeDays: number;
  dataSource: 'postgresql_live' | 'retail_dataset_actual' | 'deterministic_demo' | string;
  hasHistoricalDemand: boolean;
  description?: string;
}

export interface DemandHistoryResponsePayload {
  sku: string;
  productName: string;
  dataSource: string;
  isSimulated: boolean;
  totalObservations: number;
  storeId?: string;
  historicalData: Array<{ date: string; demand: number }>;
}

export interface ForecastHealthResponsePayload {
  status: string;
  engine: string;
  prophetVersion: string;
  availableAlgorithms: string[];
  ready: boolean;
}

export interface InventoryForecastPoint {
  date: string;
  actualInventoryUnits?: number;
  projectedStock: number;
  safetyStockFloor: number;
  safetyStockLimit?: number;
  reorderTriggerPoint?: number;
  stockoutRiskPct?: number;
}

export interface CommodityPriceIndex {
  materialName: string;
  currentPriceUsd: number;
  forecastPriceUsd: number;
  changePct30d: number;
  unit: string;
  historicalDates: string[];
  historicalPrices: number[];
  symbol?: string;
  name?: string;
  category?: string;
  currentPrice?: number;
  change24hPct?: number;
  forecast30dPrice?: number;
  volatilityRating?: 'Low' | 'Moderate' | 'High' | 'Extreme';
  sparkline?: number[];
}

// --- Risk Analysis Matrix ---
export interface RiskItem {
  id: string;
  title: string;
  category: string;
  probability: number; // 1-5
  severityScore: number; // 1-5
  severity: RiskSeverity;
  compositeScore: number; // probability * severity
  affectedEntity: string;
  financialImpactUsd: number;
  mitigationAction: string;
}

export interface RiskMatrixItem {
  id: string;
  title: string;
  category: 'Supplier' | 'Geopolitical' | 'Logistics' | 'Weather' | 'Financial';
  probabilityPct: number;
  impactScore: number;
  financialExposureUsd: number;
  riskScore: number;
  severity: RiskSeverity;
  keyDrivers: string[];
  mitigationPlaybook: string;
}

// --- Reports & Exports ---
export interface ReportSummaryItem {
  id: string;
  title: string;
  category: string;
  generatedDate: string;
  generatedBy: string;
  fileFormat: 'PDF' | 'XLSX' | 'CSV';
  fileSize: string;
  summaryMetrics: {
    totalValueAudited: string;
    identifiedSavings: string;
    criticalAlertsResolved: number;
  };
}

// --- User Profile & Settings ---
export type AppTheme = 'space' | 'cyber' | 'matrix' | 'light';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'VP Supply Chain' | 'Risk Analyst' | 'Global Logistics Director' | 'Operations Lead';
  avatarUrl: string;
  department: string;
  accessTier: 'Enterprise Admin' | 'Standard Executive';
  onboarding_completed?: boolean;
}

export type IntegrationSystemType = 'ERP' | 'WMS' | 'CRM' | 'Custom API';

export interface EnterpriseIntegration {
  id: string;
  name: string;
  system_type: IntegrationSystemType;
  base_url: string;
  api_version?: string;
  status?: string;
  is_active: boolean;
  last_tested_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface SystemSettings {
  theme: AppTheme;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  liveTelemetryStream: boolean;
  soundVolume: number;
  realtimeRefreshIntervalSec: number;
  fastApiBackendUrl: string;
  useLiveBackend: boolean;
  enableNeuralBackground: boolean;
  autoRunAISimulation: boolean;
  riskAlertThresholdPct: number;
}

// --- Data Ingestion & Import Tracking ---
export interface CanonicalFieldMeta {
  label: string;
  description: string;
  aliases: string[];
}

export interface IngestionUploadResponse {
  success: boolean;
  import_id: string;
  filename: string;
  file_type: string;
  source_type: string;
  sheets: string[];
  selected_sheet?: string;
  columns_detected: string[];
  auto_mapping: Record<string, string | null>;
  canonical_schema: Record<string, CanonicalFieldMeta>;
  rows_detected: number;
  preview_rows: Record<string, any>[];
  status: string;
}

export interface IngestionPreviewResponse {
  import_id: string;
  filename: string;
  file_type: string;
  source_type: string;
  sheets: string[];
  selected_sheet?: string;
  columns_detected: string[];
  auto_mapping: Record<string, string | null>;
  canonical_schema: Record<string, CanonicalFieldMeta>;
  rows_detected: number;
  preview_rows: Record<string, any>[];
  status: string;
}

export interface IngestionValidationError {
  row: number;
  field: string;
  raw_value: any;
  message: string;
}

export interface IngestionValidationSummary {
  is_valid: boolean;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicates_count: number;
  summary: string;
  errors: IngestionValidationError[];
  warnings: IngestionValidationError[];
}

export interface IngestionValidationResponse {
  import_id: string;
  filename: string;
  validation: IngestionValidationSummary;
  column_mapping: Record<string, string | null>;
  preview_normalized: Record<string, any>[];
}

export interface IngestionExecuteResponse {
  success: boolean;
  import_id: string;
  filename: string;
  file_type: string;
  source_type: string;
  status: string;
  rows_total: number;
  rows_processed: number;
  rows_failed: number;
  entities_created: {
    products: number;
    suppliers: number;
    warehouses: number;
    inventory: number;
    orders: number;
  };
  columns_detected: string[];
  message: string;
}

export interface ImportHistoryItem {
  id: string;
  filename: string;
  file_type: string;
  source_type: string;
  status: string;
  rows_total: number;
  rows_processed: number;
  rows_failed: number;
  columns_detected: string[];
  created_at: string;
  completed_at?: string;
}

// --- Integration Health Monitoring ---
export type IntegrationConnectionStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type ConfigStatus = 'configured' | 'not_configured';

export interface IntegrationHealthItem {
  name: string;
  category: string;
  configuration_status: ConfigStatus;
  connection_status: IntegrationConnectionStatus;
  last_checked_at?: string;
  last_successful_check_at?: string;
  response_time_ms: number;
  last_sync_at?: string;
  error_category?: string;
  error_message?: string;
  is_enabled: boolean;
  data_freshness?: string;
  details?: Record<string, any>;
}

export interface AllIntegrationsHealthResponse {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  healthy_count: number;
  degraded_count: number;
  unhealthy_count: number;
  not_configured_count: number;
  total_count: number;
  timestamp: string;
  integrations: IntegrationHealthItem[];
}

export interface IntegrationHealthDetailResponse {
  integration: IntegrationHealthItem;
  history: Array<{
    id: string;
    integration_name: string;
    category: string;
    status: IntegrationConnectionStatus;
    latency_ms: number;
    error_category?: string;
    error_message?: string;
    checked_at?: string;
    details?: Record<string, any>;
  }>;
}

// --- Dynamic Dashboard Intelligence ---
export interface DashboardOverviewData {
  globalRiskIndex: number;
  activeDisruptions: number;
  onTimeDeliveryRate: number;
  totalInventoryValueUsd: number;
  supplierHealthScore: number;
  totalRecordsIngested: number;
  productsCount: number;
  suppliersCount: number;
  warehousesCount: number;
  inventoryUnitsTotal: number;
  ordersCount: number;
  activeIntegrationsHealthy: number;
  lastUpdated: string;
}

export interface DashboardTrendsData {
  ingestionTrend: Array<{ date: string; recordsIngested: number }>;
  inventoryVelocity: Array<{
    productName: string;
    warehouseName: string;
    stockQuantity: number;
    safetyStockLevel: number;
    reorderLevel: number;
    reorderQuantity: number;
    status: 'nominal' | 'warning' | 'critical';
  }>;
  demandForecast: Array<{
    date: string;
    actual?: number | null;
    predicted: number;
    confidenceUpper: number;
    confidenceLower: number;
  }>;
  riskSeverityDistribution: Record<string, number>;
}

export interface DashboardRiskData {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  tier?: string;
  country?: string;
  riskScore: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  explanation: string;
  contributingFactors: Array<{ feature: string; score: number }>;
  confidenceScore: number;
  downstreamImpact?: Record<string, any>;
  singleSourceRisk?: boolean;
  createdAt: string;
}

export interface DashboardAlertData {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'weather' | 'news' | 'inventory' | 'integration' | 'logistics';
  source: string;
  impactSummary: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface DashboardRecommendationData {
  id: string;
  action: string;
  reason: string;
  expectedBenefit?: string;
  estimatedCost?: number;
  confidence: number;
  affectedEntities?: string[];
  createdAt: string;
}

// ==========================================
// Decision Simulator Types
// ==========================================

export interface SupplierOption {
  supplier_id: string;
  supplier_name: string;
  location: string;
  average_lead_time_days: number;
  reliability_score: number;
  available_capacity_units: number | null;
  unit_cost_index: number | null;
  component_types: string[];
  is_active: boolean;
  data_provenance: string;
}

export interface SimulationSuppliersResponse {
  total: number;
  suppliers: SupplierOption[];
}

export interface DecisionSimulationPayload {
  sku: string;
  initialInventory: number;
  dailyDemand?: number;
  dailyDemandSeries?: number[];
  useForecastDemand?: boolean;
  simulationDays?: number;
  orderQuantity?: number;
  orderDay?: number;
  safetyStock?: number;
  primarySupplierId?: string;
  primarySupplierName?: string;
  primaryLeadTimeDays?: number;
  disruptionDelayDays?: number;
  disruptionType?: string;
  alternativeSupplierId?: string;
  alternativeSupplierName?: string;
  alternativeLeadTimeDays?: number;
  alternativeCapacity?: number;
  unitCostBaseline?: number;
  unitCostAlternative?: number;
  holdingCostPerUnitDay?: number;
  stockoutPenaltyPerUnit?: number;
  dataProvenance?: string;
}

export interface DailyTrajectoryPoint {
  day: number;
  startingInventory: number;
  incomingQuantity: number;
  demand: number;
  fulfilledDemand: number;
  unmetDemand: number;
  endingInventory: number;
  cumulativeUnmetDemand: number;
  isSafetyStockBreached: boolean;
  isStockout: boolean;
}

export interface ScenarioSummary {
  endingInventory: number;
  totalDemand: number;
  totalFulfilledDemand: number;
  totalUnmetDemand: number;
  serviceLevelPct: number;
  stockoutDaysCount: number;
  firstStockoutDay: number | null;
  safetyStockBreachDaysCount: number;
  firstSafetyStockBreachDay: number | null;
  supplierArrivalDay: number;
  estimatedPurchaseCostUsd: number | null;
  estimatedHoldingCostUsd: number | null;
  estimatedStockoutPenaltyUsd: number | null;
  estimatedTotalCostUsd: number | null;
}

export interface ScenarioDetail {
  scenarioName: string;
  scenarioType: 'baseline' | 'disrupted' | 'alternative';
  supplierName: string;
  leadTimeDays: number;
  arrivalDay: number;
  dailyTrajectory: DailyTrajectoryPoint[];
  summary: ScenarioSummary;
}

export interface ScenarioComparison {
  hasAlternativeScenario: boolean;
  daysSavedByAlternative: number | null;
  unmetDemandPreventedByAlternative: number | null;
  stockoutPrevented: boolean | null;
  costDifferenceUsd: number | null;
  costComparisonStatus: string;
}

export type DecisionAction =
  | 'SWITCH_TO_ALTERNATIVE'
  | 'MAINTAIN_PRIMARY'
  | 'EXPEDITE_AND_CONSERVE'
  | 'INSUFFICIENT_ALTERNATIVE_DATA'
  | 'BUFFER_ABSORBS_DELAY';

export interface DecisionAdvice {
  recommendedAction: DecisionAction;
  recommendationTitle: string;
  explanation: string;
  keyFactors: string[];
  advisoryDisclaimer: string;
}

export interface DecisionSimulationResult {
  scenarioId: string;
  sku: string;
  simulatedAt: string;
  simulationHorizonDays: number;
  dataProvenance: string;
  demandSource: string;
  demandType: string;
  dailyDemandRate: number;
  scenarios: Record<string, ScenarioDetail>;
  comparison: ScenarioComparison;
  decision: DecisionAdvice;
  assumptions: string[];
  limitations: string[];
}