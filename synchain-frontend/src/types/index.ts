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

export interface Shipment {
  id: string;
  carrier: string;
  mode: 'ocean' | 'air' | 'ground' | 'rail';
  origin: string;
  destination: string;
  cargoDescription: string;
  speedKnots?: number;
  eta: string;
  status: 'optimal' | 'delayed' | 'rerouted' | 'critical';
  vesselName?: string;
  rerouteRecommendation?: string;
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
