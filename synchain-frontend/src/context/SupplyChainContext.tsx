import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  AIHealthScore,
  KPIMetric,
  LiveIncidentAlert,
  SimulationResultMetrics,
  SimulationPhaseId,
  ScenarioInput,
  DigitalTwinNodeData,
  StrategyOption,
  DemandForecastPoint,
  InventoryForecastPoint,
  CommodityPriceIndex,
  DigitalTwinNode,
  DigitalTwinEdge,
  Shipment,
  PortNode,
  Supplier,
  RiskItem,
  MitigationStrategy,
  DashboardOverviewData,
} from '../types';
import type { ScenarioSimulationResponse } from '../types/scenario';
import {
  mockKPIMetrics,
  mockIncidentAlerts,
  mockDefaultSimulationResult,
  mockDemandForecast,
  mockInventoryForecast,
  mockCommodityPrices,
  mockNodesFlat,
  mockEdgesFlat,
  mockShipments,
  mockPorts,
  mockSuppliers,
  mockRisks,
} from '../services/mockData';
import { apiService } from '../services/api';
import { soundFX } from '../services/audioService';
import { useAuth } from './AuthContext';
import { emptyHealth, healthFromOverview } from '../services/healthScore';

export interface SupplyChainContextType {
  health: AIHealthScore;
  healthLoading: boolean;
  healthError: string | null;
  kpis: KPIMetric[];
  kpiMetrics: KPIMetric[];
  incidents: LiveIncidentAlert[];
  unreadAlertsCount: number;
  markAlertAsRead: (id: string) => void;
  markAllAlertsAsRead: () => void;

  // Real-Time System Status & Sync
  isLoading: boolean;
  isRealDataConnected: boolean;
  lastRefreshedAt: string | null;
  refreshData: () => Promise<void>;

  // Forecast & Commodity
  demandForecast: DemandForecastPoint[];
  inventoryForecast: InventoryForecastPoint[];
  commodityPrices: CommodityPriceIndex[];
  setDemandForecast: React.Dispatch<React.SetStateAction<DemandForecastPoint[]>>;
  setInventoryForecast: React.Dispatch<React.SetStateAction<InventoryForecastPoint[]>>;
  setCommodityPrices: React.Dispatch<React.SetStateAction<CommodityPriceIndex[]>>;

  // Digital Twin & Topology
  digitalTwinNodes: DigitalTwinNode[];
  digitalTwinEdges: DigitalTwinEdge[];
  setDigitalTwinNodes: React.Dispatch<React.SetStateAction<DigitalTwinNode[]>>;
  setDigitalTwinEdges: React.Dispatch<React.SetStateAction<DigitalTwinEdge[]>>;
  selectedNode: { id: string; data: DigitalTwinNodeData } | null;
  setSelectedNode: (node: { id: string; data: DigitalTwinNodeData } | null) => void;

  // Logistics & Registry
  shipments: Shipment[];
  setShipments: React.Dispatch<React.SetStateAction<Shipment[]>>;
  ports: PortNode[];
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  risks: RiskItem[];
  setRisks: React.Dispatch<React.SetStateAction<RiskItem[]>>;

  // Simulation
  simulationState: 'idle' | 'scanning' | 'completed';
  simulationPhase: SimulationPhaseId;
  simulationProgress: number;
  simulationPhaseText: string;
  activeResult: SimulationResultMetrics | null;
  currentSimulationResult: SimulationResultMetrics | null;
  isSimulating: boolean;
  runSimulation: (input: ScenarioInput) => Promise<void>;
  resetSimulation: () => void;
  resetState: () => void;
  scenarioIntelligenceResult: ScenarioSimulationResponse | null;
  setScenarioIntelligenceResult: React.Dispatch<React.SetStateAction<ScenarioSimulationResponse | null>>;

  // Strategy Execution
  deployedStrategies: string[];
  deployStrategy: (strategy: StrategyOption) => Promise<void>;
  executeMitigationStrategy: (strategyId: string) => Promise<void>;

  // UI Drawers & Modals
  isNotificationDrawerOpen: boolean;
  setIsNotificationDrawerOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
}

const SupplyChainContext = createContext<SupplyChainContextType | undefined>(undefined);

export const SupplyChainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [health, setHealth] = useState<AIHealthScore>(emptyHealth);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const overviewRef = useRef<DashboardOverviewData | null>(null);
  const healthRequestId = useRef(0);
  const healthFlight = useRef<Promise<void> | null>(null);
  const dataRequestId = useRef(0);
  const [kpis, setKpis] = useState<KPIMetric[]>(mockKPIMetrics);
  const [incidents, setIncidents] = useState<LiveIncidentAlert[]>(mockIncidentAlerts);
  const [selectedNode, setSelectedNode] = useState<{ id: string; data: DigitalTwinNodeData } | null>(null);

  // Core Data Stores (Initialized with fallbacks, replaced with live DB data)
  const [demandForecast, setDemandForecast] = useState<DemandForecastPoint[]>(mockDemandForecast);
  const [inventoryForecast, setInventoryForecast] = useState<InventoryForecastPoint[]>(mockInventoryForecast);
  const [commodityPrices, setCommodityPrices] = useState<CommodityPriceIndex[]>(mockCommodityPrices);
  const [digitalTwinNodes, setDigitalTwinNodes] = useState<DigitalTwinNode[]>(mockNodesFlat);
  const [digitalTwinEdges, setDigitalTwinEdges] = useState<DigitalTwinEdge[]>(mockEdgesFlat);
  const [shipments, setShipments] = useState<Shipment[]>(mockShipments);
  const [ports, setPorts] = useState<PortNode[]>(mockPorts);
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  const [risks, setRisks] = useState<RiskItem[]>(mockRisks);

  // Live Sync State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRealDataConnected, setIsRealDataConnected] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  // Fetch the score independently: slow forecasting or external feeds cannot hold up the gauge.
  const refreshHealth = useCallback((): Promise<void> => {
    if (!isAuthenticated) return Promise.resolve();
    if (healthFlight.current) return healthFlight.current;
    const requestId = ++healthRequestId.current;
    const started = performance.now();
    setHealthLoading(true);
    const pending = apiService.getDashboardOverview().then((overview) => {
      if (requestId !== healthRequestId.current) return;
      overviewRef.current = overview;
      setHealth(healthFromOverview(overview, performance.now() - started));
      setHealthError(null);
      setIsRealDataConnected(true);
      setLastRefreshedAt(new Date().toISOString());
    }).catch(() => {
      if (requestId !== healthRequestId.current) return;
      setHealthError('Health data could not be refreshed. Retry when the backend is available.');
      setHealth((previous) => ({ ...previous, dataStatus: 'unavailable' }));
      setIsRealDataConnected(false);
    }).finally(() => {
      if (requestId !== healthRequestId.current) return;
      setHealthLoading(false);
      healthFlight.current = null;
    });
    healthFlight.current = pending;
    return pending;
  }, [isAuthenticated, user?.id]);

  // Refresh and load real data from PostgreSQL / Ingestion Core.
  const refreshData = useCallback(async () => {
    if (!isAuthenticated) return;
    const requestId = ++dataRequestId.current;
    setIsLoading(true);
    try {
      const [
        ,
        suppliersRes,
        topologyRes,
        shipmentsRes,
        invRes,
        forecastRes,
        riskRes,
        notifRes,
      ] = await Promise.allSettled([
        refreshHealth(),
        apiService.getSuppliers(),
        apiService.getDigitalTwinTopology(),
        apiService.getShipments(),
        apiService.getInventory(),
        apiService.getForecast(),
        apiService.getRiskMatrix(),
        apiService.getNotifications(),
      ]);

      if (requestId !== dataRequestId.current) return;
      if (overviewRef.current) {
        const ov = overviewRef.current;

        setKpis([
          {
            id: 'kpi-risk',
            title: 'Global Risk Score',
            value: ov.globalRiskIndex,
            suffix: '/100',
            changePct: -3.2,
            isPositive: ov.globalRiskIndex <= 40,
            sparkline: [38, 35, 34, 30, ov.globalRiskIndex],
            status: ov.globalRiskIndex > 50 ? 'warning' : 'optimal',
            description: 'Combines the chance of a problem with its financial and operational impact.',
            iconName: 'shield',
          },
          {
            id: 'kpi-disruptions',
            title: 'Current Supply Chain Problems',
            value: ov.activeDisruptions,
            suffix: ' Events',
            changePct: ov.activeDisruptions > 2 ? 15 : -8,
            isPositive: ov.activeDisruptions <= 2,
            sparkline: [2, 3, 2, 4, ov.activeDisruptions],
            status: ov.activeDisruptions > 2 ? 'critical' : 'nominal',
            description: 'Active supplier bottlenecks, carrier delays, and facility issues being resolved.',
            iconName: 'alert',
          },
          {
            id: 'kpi-inventory',
            title: 'Inventory Value',
            value: `$${(ov.totalInventoryValueUsd / 1000000).toFixed(1)}M`,
            changePct: 4.8,
            isPositive: true,
            sparkline: [21.5, 22.0, 23.4, 24.1, ov.totalInventoryValueUsd / 1000000],
            status: 'optimal',
            description: 'Total real-time valuation of all finished goods and component stock.',
            iconName: 'package',
          },
          {
            id: 'kpi-suppliers',
            title: 'Supplier Reliability',
            value: `${ov.supplierHealthScore}%`,
            changePct: 1.4,
            isPositive: ov.supplierHealthScore >= 80,
            sparkline: [82, 84, 83, 85, ov.supplierHealthScore],
            status: ov.supplierHealthScore >= 80 ? 'optimal' : 'warning',
            description: 'How consistently suppliers deliver on time and meet quality expectations.',
            iconName: 'building',
          },
          {
            id: 'kpi-otd',
            title: 'Order Fulfillment (On-Time)',
            value: `${ov.onTimeDeliveryRate}%`,
            changePct: 0.8,
            isPositive: ov.onTimeDeliveryRate >= 90,
            sparkline: [92, 93, 91, 94, ov.onTimeDeliveryRate],
            status: ov.onTimeDeliveryRate >= 90 ? 'optimal' : 'warning',
            description: 'Percentage of customer shipments arriving on or before the committed date.',
            iconName: 'truck',
          },
        ]);
      }

      if (suppliersRes.status === 'fulfilled' && suppliersRes.value?.length > 0) {
        setSuppliers(suppliersRes.value);
      }

      if (topologyRes.status === 'fulfilled' && topologyRes.value?.nodes?.length > 0) {
        setDigitalTwinNodes(topologyRes.value.nodes);
        if (topologyRes.value.edges?.length > 0) {
          setDigitalTwinEdges(topologyRes.value.edges);
        }
      }

      if (shipmentsRes.status === 'fulfilled' && shipmentsRes.value?.length > 0) {
        setShipments(shipmentsRes.value);
      }

      if (invRes.status === 'fulfilled' && invRes.value) {
        if (invRes.value.forecast?.length > 0) {
          setInventoryForecast(invRes.value.forecast);
        }
        if (invRes.value.commodities?.length > 0) {
          setCommodityPrices(invRes.value.commodities);
        }
      }

      if (forecastRes.status === 'fulfilled' && forecastRes.value?.demand?.length > 0) {
        setDemandForecast(forecastRes.value.demand);
      }

      if (riskRes.status === 'fulfilled' && riskRes.value?.length > 0) {
        setRisks(riskRes.value);
      }

      if (notifRes.status === 'fulfilled' && notifRes.value?.length > 0) {
        setIncidents(notifRes.value);
      }

    } catch (err) {
      console.warn("Failed to refresh live supply chain data:", err);
    } finally {
      if (requestId === dataRequestId.current) setIsLoading(false);
    }
  }, [isAuthenticated, refreshHealth]);

  // Automatically refresh data on initial load and listen for ingestion completion
  useEffect(() => {
    if (!isAuthenticated) {
      setHealth(emptyHealth);
      setHealthError(null);
      setHealthLoading(false);
      setIsLoading(false);
      setIsRealDataConnected(false);
      setLastRefreshedAt(null);
      overviewRef.current = null;
      return;
    }
    refreshData();

    const handleDataImported = () => {
      refreshData();
    };
    const refreshVisibleHealth = () => {
      if (document.visibilityState === 'visible') void refreshHealth();
    };
    const timer = window.setInterval(refreshVisibleHealth, 30000);
    window.addEventListener('synchain_data_imported', handleDataImported);
    window.addEventListener('synchain_integration_health_updated', refreshVisibleHealth);
    document.addEventListener('visibilitychange', refreshVisibleHealth);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('synchain_data_imported', handleDataImported);
      window.removeEventListener('synchain_integration_health_updated', refreshVisibleHealth);
      document.removeEventListener('visibilitychange', refreshVisibleHealth);
      ++healthRequestId.current;
      ++dataRequestId.current;
      healthFlight.current = null;
    };
  }, [isAuthenticated, refreshData, refreshHealth]);

  // Simulation State
  const [simulationState, setSimulationState] = useState<'idle' | 'scanning' | 'completed'>('completed');
  const [simulationPhase, setSimulationPhase] = useState<SimulationPhaseId>('completed');
  const [simulationProgress, setSimulationProgress] = useState<number>(100);
  const [simulationPhaseText, setSimulationPhaseText] = useState<string>('Simulation complete. Optimal mitigation ready.');
  const [activeResult, setActiveResult] = useState<SimulationResultMetrics | null>(mockDefaultSimulationResult);
  const [scenarioIntelligenceResult, setScenarioIntelligenceResult] = useState<ScenarioSimulationResponse | null>(null);

  // Deployed strategies
  const [deployedStrategies, setDeployedStrategies] = useState<string[]>([]);

  // Drawers
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const unreadAlertsCount = incidents.filter((i) => !i.isRead).length;

  const markAlertAsRead = (id: string) => {
    setIncidents((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  const markAllAlertsAsRead = () => {
    soundFX.playClick();
    setIncidents((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  // Keyboard shortcut for Command Palette (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        soundFX.playClick();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Multi-stage realistic AI simulation runner
  const runSimulation = async (input: ScenarioInput) => {
    soundFX.playClick();
    setSimulationState('scanning');
    setSimulationProgress(5);
    setSimulationPhase('collecting_erp');
    setSimulationPhaseText('Connecting to Global SAP / ERP Telemetry Streams...');

    const phases: Array<{ phase: SimulationPhaseId; text: string; durationMs: number; progress: number }> = [
      { phase: 'collecting_erp', text: 'Collecting ERP Data & Live Sensor Streams...', durationMs: 600, progress: 20 },
      { phase: 'scanning_suppliers', text: 'Scanning Tier-1 & Tier-2 Network Nodes...', durationMs: 700, progress: 45 },
      { phase: 'analyzing_weather', text: 'Analyzing Satellite Weather & Port Congestion Telemetry...', durationMs: 600, progress: 70 },
      { phase: 'running_ai', text: 'Executing Monte Carlo Disruption Algorithms...', durationMs: 800, progress: 90 },
      { phase: 'synthesizing_playbook', text: 'Synthesizing Optimal AI Mitigation Playbook...', durationMs: 500, progress: 100 },
    ];

    for (const step of phases) {
      soundFX.playScanPulse();
      setSimulationPhase(step.phase);
      setSimulationPhaseText(step.text);
      setSimulationProgress(step.progress);
      await new Promise((resolve) => setTimeout(resolve, step.durationMs));
    }

    const result = await apiService.runSimulation(input);
    setActiveResult(result);
    setSimulationState('completed');
    setSimulationPhase('completed');
    setSimulationPhaseText('AI Disruption Simulation Complete');
    soundFX.playSuccess();
  };

  const resetSimulation = () => {
    soundFX.playClick();
    setSimulationState('idle');
    setSimulationPhase('idle');
    setSimulationProgress(0);
    setActiveResult(null);
  };

  const resetState = () => {
    resetSimulation();
    setDeployedStrategies([]);
    setIncidents(mockIncidentAlerts);
  };

  const deployStrategy = async (strategy: StrategyOption) => {
    soundFX.playClick();
    await new Promise((resolve) => setTimeout(resolve, 600));
    setDeployedStrategies((prev) => [...prev, strategy.id]);
    soundFX.playSuccess();

    const newAlert: LiveIncidentAlert = {
      id: `alert-deploy-${Date.now()}`,
      timestamp: 'Just now',
      title: `Mitigation Playbook Activated: ${strategy.title}`,
      severity: 'low',
      category: 'logistics',
      source: 'SynChain Autonomous Action Dispatcher',
      impactSummary: `Automated POs issued and route rerouting initiated for ${strategy.affectedPartners.join(', ')}. Estimated savings: $${(strategy.lossAvoidedUsd / 1000000).toFixed(1)}M.`,
      confidencePct: strategy.confidenceScore,
      isRead: false,
      actionRequired: false,
    };
    setIncidents((prev) => [newAlert, ...prev]);
  };

  const executeMitigationStrategy = async (strategyId: string) => {
    soundFX.playClick();
    await new Promise((resolve) => setTimeout(resolve, 500));
    setDeployedStrategies((prev) => [...prev, strategyId]);

    if (activeResult) {
      setActiveResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          mitigationStrategies: prev.mitigationStrategies.map((s) =>
            s.id === strategyId ? { ...s, status: 'executed' as const } : s
          ),
        };
      });
    }
    soundFX.playSuccess();
  };

  return (
    <SupplyChainContext.Provider
      value={{
        isLoading,
        isRealDataConnected,
        lastRefreshedAt,
        refreshData,
        health,
        healthLoading,
        healthError,
        kpis,
        kpiMetrics: kpis,
        incidents,
        unreadAlertsCount,
        markAlertAsRead,
        markAllAlertsAsRead,
        demandForecast,
        inventoryForecast,
        commodityPrices,
        setDemandForecast,
        setInventoryForecast,
        setCommodityPrices,
        digitalTwinNodes,
        digitalTwinEdges,
        setDigitalTwinNodes,
        setDigitalTwinEdges,
        selectedNode,
        setSelectedNode,
        shipments,
        setShipments,
        ports,
        suppliers,
        setSuppliers,
        risks,
        setRisks,
        simulationState,
        simulationPhase,
        simulationProgress,
        simulationPhaseText,
        activeResult,
        currentSimulationResult: activeResult,
        isSimulating: simulationState === 'scanning',
        runSimulation,
        resetSimulation,
        resetState,
        deployedStrategies,
        deployStrategy,
        executeMitigationStrategy,
        scenarioIntelligenceResult,
        setScenarioIntelligenceResult,
        isNotificationDrawerOpen,
        setIsNotificationDrawerOpen,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
      }}
    >
      {children}
    </SupplyChainContext.Provider>
  );
};

export const useSupplyChain = () => {
  const context = useContext(SupplyChainContext);
  if (!context) throw new Error('useSupplyChain must be used within a SupplyChainProvider');
  return context;
};
