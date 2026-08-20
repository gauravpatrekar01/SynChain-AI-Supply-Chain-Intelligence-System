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

  // Forecast & Commodity
  demandForecast: DemandForecastPoint[];
  inventoryForecast: InventoryForecastPoint[];
  commodityPrices: CommodityPriceIndex[];

  // Digital Twin & Topology
  digitalTwinNodes: DigitalTwinNode[];
  digitalTwinEdges: DigitalTwinEdge[];
  selectedNode: { id: string; data: DigitalTwinNodeData } | null;
  setSelectedNode: (node: { id: string; data: DigitalTwinNodeData } | null) => void;

  // Logistics & Registry
  shipments: Shipment[];
  ports: PortNode[];
  suppliers: Supplier[];
  risks: RiskItem[];

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

  // Core Data Stores
  const [demandForecast] = useState<DemandForecastPoint[]>(mockDemandForecast);
  const [inventoryForecast] = useState<InventoryForecastPoint[]>(mockInventoryForecast);
  const [commodityPrices] = useState<CommodityPriceIndex[]>(mockCommodityPrices);
  const [digitalTwinNodes, setDigitalTwinNodes] = useState<DigitalTwinNode[]>(mockNodesFlat);
  const [digitalTwinEdges, setDigitalTwinEdges] = useState<DigitalTwinEdge[]>(mockEdgesFlat);
  const [shipments, setShipments] = useState<Shipment[]>(mockShipments);
  const [ports, setPorts] = useState<PortNode[]>(mockPorts);
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  const [risks, setRisks] = useState<RiskItem[]>(mockRisks);

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
        digitalTwinNodes,
        digitalTwinEdges,
        selectedNode,
        setSelectedNode,
        shipments,
        ports,
        suppliers,
        risks,
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
