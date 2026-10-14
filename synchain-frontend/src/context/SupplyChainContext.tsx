import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../types';
import {
  mockAIHealth,
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

export interface SupplyChainContextType {
  health: AIHealthScore;
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
  const [health, setHealth] = useState<AIHealthScore>(mockAIHealth);
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

  // Refresh and load real data from PostgreSQL / Ingestion Core
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [
        overviewRes,
        suppliersRes,
        topologyRes,
        shipmentsRes,
        invRes,
        forecastRes,
        riskRes,
        notifRes,
      ] = await Promise.allSettled([
        apiService.getDashboardOverview(),
        apiService.getSuppliers(),
        apiService.getDigitalTwinTopology(),
        apiService.getShipments(),
        apiService.getInventory(),
        apiService.getForecast(),
        apiService.getRiskMatrix(),
        apiService.getNotifications(),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        const ov = overviewRes.value;
        setHealth({
          score: Math.max(15, 100 - ov.globalRiskIndex),
          status: ov.globalRiskIndex > 50 ? 'warning' : 'optimal',
          resilienceRating: ov.globalRiskIndex < 35 ? 'A+' : (ov.globalRiskIndex < 55 ? 'B+' : 'C'),
          lastUpdated: new Date().toISOString(),
          activeDisruptionsCount: ov.activeDisruptions,
          predictedRiskEventsCount: Math.max(1, ov.activeDisruptions * 2),
          mitigationReadinessPct: Math.min(98, Math.max(65, Math.round(ov.supplierHealthScore * 0.95))),
          latencyMs: 118,
        });

        setKpis([
          {
            id: 'kpi-risk',
            title: 'Global Risk Index',
            value: ov.globalRiskIndex,
            suffix: '/100',
            changePct: -3.2,
            isPositive: ov.globalRiskIndex <= 40,
            sparkline: [38, 35, 34, 30, ov.globalRiskIndex],
            status: ov.globalRiskIndex > 50 ? 'warning' : 'optimal',
            description: 'Composite vulnerability exposure',
            iconName: 'shield',
          },
          {
            id: 'kpi-disruptions',
            title: 'Active Disruptions',
            value: ov.activeDisruptions,
            suffix: ' Events',
            changePct: ov.activeDisruptions > 2 ? 15 : -8,
            isPositive: ov.activeDisruptions <= 2,
            sparkline: [2, 3, 2, 4, ov.activeDisruptions],
            status: ov.activeDisruptions > 2 ? 'critical' : 'nominal',
            description: 'Monitored bottlenecks & route deviations',
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
            description: 'Real-time valuation across all hubs',
            iconName: 'package',
          },
          {
            id: 'kpi-suppliers',
            title: 'Supplier Health Score',
            value: `${ov.supplierHealthScore}%`,
            changePct: 1.4,
            isPositive: ov.supplierHealthScore >= 80,
            sparkline: [82, 84, 83, 85, ov.supplierHealthScore],
            status: ov.supplierHealthScore >= 80 ? 'optimal' : 'warning',
            description: 'Aggregate reliability and quality rating',
            iconName: 'building',
          },
          {
            id: 'kpi-otd',
            title: 'On-Time Delivery Rate',
            value: `${ov.onTimeDeliveryRate}%`,
            changePct: 0.8,
            isPositive: ov.onTimeDeliveryRate >= 90,
            sparkline: [92, 93, 91, 94, ov.onTimeDeliveryRate],
            status: ov.onTimeDeliveryRate >= 90 ? 'optimal' : 'warning',
            description: 'Order fulfillment SLA compliance',
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

      setIsRealDataConnected(true);
      setLastRefreshedAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn("Failed to refresh live supply chain data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically refresh data on initial load and listen for ingestion completion
  useEffect(() => {
    refreshData();

    const handleDataImported = () => {
      refreshData();
    };
    window.addEventListener('synchain_data_imported', handleDataImported);
    return () => window.removeEventListener('synchain_data_imported', handleDataImported);
  }, []);

  // Simulation State
  const [simulationState, setSimulationState] = useState<'idle' | 'scanning' | 'completed'>('completed');
  const [simulationPhase, setSimulationPhase] = useState<SimulationPhaseId>('completed');
  const [simulationProgress, setSimulationProgress] = useState<number>(100);
  const [simulationPhaseText, setSimulationPhaseText] = useState<string>('Simulation complete. Optimal mitigation ready.');
  const [activeResult, setActiveResult] = useState<SimulationResultMetrics | null>(mockDefaultSimulationResult);

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
