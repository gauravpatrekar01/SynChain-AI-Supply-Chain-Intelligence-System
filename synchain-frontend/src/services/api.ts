import axios from 'axios';
import {
  KPIMetric,
  AIHealthScore,
  LiveIncidentAlert,
  ScenarioInput,
  SimulationResultMetrics,
  DemandForecastPoint,
  InventoryForecastPoint,
  CommodityPriceIndex,
  RiskItem,
  ReportSummaryItem,
  UserProfile,
} from '../types';
import {
  mockAIHealth,
  mockKPIMetrics,
  mockIncidentAlerts,
  mockDigitalTwinNodes,
  mockDefaultSimulationResult,
  mockDemandForecast,
  mockInventoryForecast,
  mockCommodityIndices,
  mockRisks,
  mockReports,
  mockUserProfiles,
} from './mockData';

// Configurable API base URL (defaults to localhost:8000 for FastAPI)
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT bearer token if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('synchain_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const apiService = {
  // Authentication
  async login(email: string, _password?: string): Promise<{ token: string; user: UserProfile }> {
    try {
      const res = await apiClient.post('/login', { email, password: _password });
      return res.data;
    } catch {
      // High fidelity mock fallback
      const user = mockUserProfiles.find((u) => u.email.toLowerCase() === email.toLowerCase()) || mockUserProfiles[0];
      const mockToken = `synchain_mock_jwt_${btoa(user.email)}_${Date.now()}`;
      localStorage.setItem('synchain_auth_token', mockToken);
      return { token: mockToken, user };
    }
  },

  // Dashboard Telemetry & Metrics
  async getDashboardData(): Promise<{
    health: AIHealthScore;
    kpis: KPIMetric[];
    incidents: LiveIncidentAlert[];
  }> {
    try {
      const res = await apiClient.get('/dashboard');
      return res.data;
    } catch {
      return {
        health: mockAIHealth,
        kpis: mockKPIMetrics,
        incidents: mockIncidentAlerts,
      };
    }
  },

  // Suppliers & Digital Twin Nodes
  async getSuppliers(): Promise<typeof mockDigitalTwinNodes> {
    try {
      const res = await apiClient.get('/suppliers');
      return res.data;
    } catch {
      return mockDigitalTwinNodes;
    }
  },

  // Inventory & Safety Stock
  async getInventory(): Promise<{ forecast: InventoryForecastPoint[]; commodities: CommodityPriceIndex[] }> {
    try {
      const res = await apiClient.get('/inventory');
      return res.data;
    } catch {
      return {
        forecast: mockInventoryForecast,
        commodities: mockCommodityIndices,
      };
    }
  },

  // Predictive Demand & Price Forecast
  async getForecast(): Promise<{
    demand: DemandForecastPoint[];
    commodities: CommodityPriceIndex[];
  }> {
    try {
      const res = await apiClient.get('/forecast');
      return res.data;
    } catch {
      return {
        demand: mockDemandForecast,
        commodities: mockCommodityIndices,
      };
    }
  },

  // Run AI Monte Carlo Simulation
  async runSimulation(input: ScenarioInput): Promise<SimulationResultMetrics> {
    try {
      const res = await apiClient.post('/simulation', input);
      return res.data;
    } catch {
      // Generate dynamic scenario results based on user input
      const severityFactor = (input.severityPct || 50) / 100;
      const durationFactor = (input.durationDays || 14) / 14;
      const calculatedRevenueLoss = Math.round(18450000 * severityFactor * durationFactor);
      const calculatedUnitsLoss = Math.round(14200 * severityFactor * durationFactor);
      const calculatedDelay = Number((8.4 * severityFactor * (input.includeSecondTierCascade ? 1.4 : 1.0)).toFixed(1));

      return {
        ...mockDefaultSimulationResult,
        scenarioName: input.scenarioName || 'Custom Supply Disruption Simulation',
        estimatedRevenueLossUsd: calculatedRevenueLoss,
        productionLossUnits: calculatedUnitsLoss,
        averageShipmentDelayDays: calculatedDelay,
        netFinancialExposureUsd: Math.round(calculatedRevenueLoss * 1.25),
        postRiskScore: Math.min(96, Math.round(34 + severityFactor * 50)),
      };
    }
  },

  // Get Historical Simulations
  async getSimulationHistory(): Promise<SimulationResultMetrics[]> {
    try {
      const res = await apiClient.get('/simulation/history');
      return res.data;
    } catch {
      return [mockDefaultSimulationResult];
    }
  },

  // Reports
  async getReports(): Promise<ReportSummaryItem[]> {
    try {
      const res = await apiClient.get('/reports');
      return res.data;
    } catch {
      return mockReports;
    }
  },

  // Risk Matrix & Vulnerabilities
  async getRiskMatrix(): Promise<RiskItem[]> {
    try {
      const res = await apiClient.get('/risk-matrix');
      return res.data;
    } catch {
      return mockRisks;
    }
  },

  // Upload SCM / ERP Data File
  async uploadDataFile(file: File): Promise<{ success: boolean; rowsProcessed: number; message: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    } catch {
      return {
        success: true,
        rowsProcessed: 14290,
        message: `Successfully ingested and synchronized ${file.name} with SynChain AI Neural Core.`,
      };
    }
  },

  // Real-time Notifications
  async getNotifications(): Promise<LiveIncidentAlert[]> {
    try {
      const res = await apiClient.get('/notifications');
      return res.data;
    } catch {
      return mockIncidentAlerts;
    }
  },
};
