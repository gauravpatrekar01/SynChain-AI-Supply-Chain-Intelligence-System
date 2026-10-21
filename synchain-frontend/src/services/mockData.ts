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
  {
    id: 'kpi-risk',
    title: 'Risk Score',
    value: 28,
    suffix: '/100',
    changePct: -3.2,
    isPositive: true,
    sparkline: [35, 33, 30, 29, 28],
    status: 'optimal',
    description: 'Composite vulnerability score combining likelihood and severity of problems across supply chain nodes.',
    iconName: 'ShieldCheck',
  },
  {
    id: 'kpi-disruptions',
    title: 'Active Disruptions',
    value: 2,
    suffix: ' Events',
    changePct: -15.0,
    isPositive: true,
    sparkline: [4, 3, 3, 2, 2],
    status: 'nominal',
    description: 'Active supplier delays, port blockages, or facility outages currently being monitored.',
    iconName: 'AlertTriangle',
  },
  {
    id: 'kpi-inventory',
    title: 'Inventory Value',
    value: 24.1,
    prefix: '$',
    suffix: 'M',
    changePct: 4.8,
    isPositive: true,
    sparkline: [21.5, 22.0, 23.4, 23.8, 24.1],
    status: 'optimal',
    description: 'Real-time dollar value of all finished goods and raw component inventory stored across warehouses.',
    iconName: 'Warehouse',
  },
  {
    id: 'kpi-suppliers',
    title: 'Supplier Reliability',
    value: 86.4,
    suffix: '%',
    changePct: 1.4,
    isPositive: true,
    sparkline: [82, 84, 83, 85, 86.4],
    status: 'optimal',
    description: 'Average rating of active suppliers based on delivery consistency and product quality.',
    iconName: 'Building2',
  },
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

/**
 * DEMO / SYNTHETIC HISTORICAL DEMAND SERIES
 * Validated 30-day consecutive daily observations for UI demonstrations and test runs.
 * Note: These values represent synthetic simulation data for SKU 'IC-3NM-A18'
 * and must not be treated as actual production figures.
 */
export const DEMO_SYNTHETIC_HISTORICAL_DEMAND: Array<{ date: string; demand: number }> = [
  { date: '2026-09-01', demand: 1240 },
  { date: '2026-09-02', demand: 1285 },
  { date: '2026-09-03', demand: 1310 },
  { date: '2026-09-04', demand: 1290 },
  { date: '2026-09-05', demand: 1150 },
  { date: '2026-09-06', demand: 1100 },
  { date: '2026-09-07', demand: 1260 },
  { date: '2026-09-08', demand: 1320 },
  { date: '2026-09-09', demand: 1350 },
  { date: '2026-09-10', demand: 1380 },
  { date: '2026-09-11', demand: 1340 },
  { date: '2026-09-12', demand: 1190 },
  { date: '2026-09-13', demand: 1120 },
  { date: '2026-09-14', demand: 1290 },
  { date: '2026-09-15', demand: 1360 },
  { date: '2026-09-16', demand: 1410 },
  { date: '2026-09-17', demand: 1390 },
  { date: '2026-09-18', demand: 1360 },
  { date: '2026-09-19', demand: 1210 },
  { date: '2026-09-20', demand: 1140 },
  { date: '2026-09-21', demand: 1310 },
  { date: '2026-09-22', demand: 1390 },
  { date: '2026-09-23', demand: 1430 },
  { date: '2026-09-24', demand: 1420 },
  { date: '2026-09-25', demand: 1380 },
  { date: '2026-09-26', demand: 1230 },
  { date: '2026-09-27', demand: 1160 },
  { date: '2026-09-28', demand: 1340 },
  { date: '2026-09-29', demand: 1420 },
  { date: '2026-09-30', demand: 1460 },
];

/**
 * DEMO / SYNTHETIC FORECAST FALLBACK
 * Used strictly when backend connection is unavailable.
 */
export const mockDemandForecast: DemandForecastPoint[] = DEMO_SYNTHETIC_HISTORICAL_DEMAND.map((pt) => ({
  date: pt.date,
  actualDemandUnits: pt.demand,
  predictedDemandUnits: pt.demand,
  confidenceLower: Math.round(pt.demand * 0.9),
  confidenceUpper: Math.round(pt.demand * 1.1),
  historicalBaseline: pt.demand,
}));

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
