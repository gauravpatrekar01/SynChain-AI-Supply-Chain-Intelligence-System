import {
  AIHealthScore,
  KPIMetric,
  LiveIncidentAlert,
  SimulationResultMetrics,
  DemandForecastPoint,
  InventoryForecastPoint,
  CommodityPriceIndex,
  RiskItem,
  ReportSummaryItem,
  UserProfile,
  DigitalTwinNode,
  DigitalTwinEdge,
  Shipment,
  PortNode,
  Supplier
} from '../types';

export const mockAIHealth: AIHealthScore = {
  score: 92,
  status: 'optimal',
  resilienceRating: 'A+',
  lastUpdated: new Date().toISOString(),
  activeDisruptionsCount: 2,
  predictedRiskEventsCount: 5,
  mitigationReadinessPct: 88,
  latencyMs: 142
};

export const mockKPIMetrics: KPIMetric[] = [
  { id: '1', title: 'On-Time Delivery', value: 94.2, suffix: '%', changePct: 2.1, isPositive: true, sparkline: [90, 92, 91, 94, 94.2], status: 'optimal', description: 'OTD Rate', iconName: 'truck' }
];

export const mockIncidentAlerts: LiveIncidentAlert[] = [
  { id: '1', timestamp: new Date().toISOString(), title: 'Port Congestion', severity: 'high', category: 'logistics', source: 'Port Authority', impactSummary: '3 days delay expected', confidencePct: 85, isRead: false, actionRequired: true }
];

export const mockDigitalTwinNodes: { nodes: DigitalTwinNode[], edges: DigitalTwinEdge[] } = {
  nodes: [
    { id: 'n1', label: 'Supplier A', type: 'tier1_supplier', country: 'US', status: 'optimal', riskScore: 12, failureProb: 1, capacityUtilization: 80, currentOrdersCount: 50, leadTimeDays: 5, primaryProduct: 'Components', upstreamIds: [], downstreamIds: ['n2'] }
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2', flowRateUnits: 1000, activeCargoValueUsd: 500000, transitHours: 48, status: 'optimal', transportMode: 'road' }
  ]
};

export const mockDefaultSimulationResult: SimulationResultMetrics = {
  scenarioId: 'sim1',
  scenarioName: 'Default Sim',
  createdAt: new Date().toISOString(),
  financialLossEstimateUsd: 1000000,
  lostProductionUnits: 5000,
  estimatedDelayDays: 7,
  riskScorePostSimulation: 45,
  dailyImpactTrend: [],
  cascadingTimeline: [],
  mitigationStrategies: []
};

export const mockDemandForecast: DemandForecastPoint[] = [
  { date: '2026-10-01', predictedDemandUnits: 1000, confidenceLower: 900, confidenceUpper: 1100, historicalBaseline: 950 }
];

export const mockInventoryForecast: InventoryForecastPoint[] = [
  { date: '2026-10-01', projectedStock: 5000, safetyStockFloor: 2000 }
];

export const mockCommodityIndices: CommodityPriceIndex[] = [
  { materialName: 'Steel', currentPriceUsd: 1200, forecastPriceUsd: 1250, changePct30d: 4.2, unit: 'ton', historicalDates: [], historicalPrices: [] }
];

export const mockCommodityPrices = mockCommodityIndices;

export const mockNodesFlat: DigitalTwinNode[] = [
  { id: 'n1', label: 'Supplier A', type: 'tier1_supplier', country: 'US', status: 'optimal', riskScore: 12, failureProb: 1, capacityUtilization: 80, currentOrdersCount: 50, leadTimeDays: 5, primaryProduct: 'Components', upstreamIds: [], downstreamIds: ['n2'] }
];

export const mockEdgesFlat: DigitalTwinEdge[] = [
  { id: 'e1', source: 'n1', target: 'n2', flowRateUnits: 1000, activeCargoValueUsd: 500000, transitHours: 48, status: 'optimal', transportMode: 'road' }
];

export const mockShipments: Shipment[] = [
  { id: 's1', carrier: 'Oceanic Express', mode: 'ocean', origin: 'Shanghai', destination: 'Los Angeles', cargoDescription: 'Electronics', eta: new Date().toISOString(), status: 'optimal' }
];

export const mockPorts: PortNode[] = [
  { id: 'p1', name: 'Port of Los Angeles', country: 'US', coordinates: [33.72, -118.26], status: 'warning', congestionIndex: 75, waitTimeDays: 3 }
];

export const mockSuppliers: Supplier[] = [
  { id: 'sup1', name: 'Supplier A', tier: 'Tier-1', category: 'Electronics', country: 'China', reliabilityScore: 95, spendAnnualUsd: 1000000, healthStatus: 'optimal', singleSourceRisk: false }
];

export const mockRisks: RiskItem[] = [
  { id: 'r1', title: 'Supplier Default Risk', category: 'Financial', probability: 2, severityScore: 4, severity: 'high', compositeScore: 8, affectedEntity: 'Supplier B', financialImpactUsd: 2000000, mitigationAction: 'Dual source immediately' }
];

export const mockReports: ReportSummaryItem[] = [
  { id: 'rep1', title: 'Q3 Supply Chain Audit', category: 'Executive', generatedDate: '2026-10-01', generatedBy: 'System', fileFormat: 'PDF', fileSize: '2.4 MB', summaryMetrics: { totalValueAudited: '$1.2B', identifiedSavings: '$4.5M', criticalAlertsResolved: 12 } }
];

export const mockUserProfiles: UserProfile[] = [
  { id: 'u1', name: 'Admin User', email: 'admin@synchain.ai', role: 'VP Supply Chain', avatarUrl: '', department: 'Operations', accessTier: 'Enterprise Admin', onboarding_completed: true }
];
