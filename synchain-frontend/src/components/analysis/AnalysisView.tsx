import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Layers,
  Package,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { RiskDetailModal } from './RiskDetailModal';
import { SimulationModal } from './SimulationModal';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import { formatApiError } from '../../utils/errorFormatter';
import {
  AnalysisOverviewResponse,
  RiskRegisterListResponse,
  RiskDetailResponse,
  RiskFindingItem,
  RiskLevel,
  ShipmentAnalysisListResponse,
  SupplierAnalysisListResponse,
  InventoryAnalysisListResponse,
  ForecastAnalysisListResponse,
  AnalysisRecommendationsListResponse,
  AnalysisRecommendationItem,
  RecommendationStatus,
} from '../../types/analysis';

type AnalysisTab =
  | 'overview'
  | 'risks'
  | 'shipments'
  | 'suppliers'
  | 'inventory'
  | 'forecast'
  | 'recommendations';

export const AnalysisView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');
  const [overview, setOverview] = useState<AnalysisOverviewResponse | null>(null);
  const [riskRegister, setRiskRegister] = useState<RiskRegisterListResponse | null>(null);
  const [shipmentData, setShipmentData] = useState<ShipmentAnalysisListResponse | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierAnalysisListResponse | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryAnalysisListResponse | null>(null);
  const [forecastData, setForecastData] = useState<ForecastAnalysisListResponse | null>(null);
  const [recommendationsData, setRecommendationsData] = useState<AnalysisRecommendationsListResponse | null>(null);

  // Filters & Pagination for Risk Register
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [page, setPage] = useState(1);

  // Modals state
  const [selectedRiskDetail, setSelectedRiskDetail] = useState<RiskDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [simTargetSku, setSimTargetSku] = useState<string | undefined>(undefined);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status update message
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const fetchOverview = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiService.getAnalysisOverview();
      setOverview(data);
    } catch (err: any) {
      setErrorMessage(formatApiError(err, 'Failed to retrieve supply chain health overview.'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRisks = async () => {
    try {
      const data = await apiService.getRiskRegister({
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        severity: selectedSeverity !== 'All' ? selectedSeverity : undefined,
        search: searchQuery.trim() || undefined,
        page,
        page_size: 10,
      });
      setRiskRegister(data);
    } catch (err: any) {
      setErrorMessage(formatApiError(err, 'Failed to load risk register.'));
    }
  };

  const fetchTabContent = async (tab: AnalysisTab) => {
    try {
      if (tab === 'shipments' && !shipmentData) {
        const data = await apiService.getShipmentsAnalysis();
        setShipmentData(data);
      } else if (tab === 'suppliers' && !supplierData) {
        const data = await apiService.getSuppliersAnalysis();
        setSupplierData(data);
      } else if (tab === 'inventory' && !inventoryData) {
        const data = await apiService.getInventoryAnalysis();
        setInventoryData(data);
      } else if (tab === 'forecast' && !forecastData) {
        const data = await apiService.getForecastsAnalysis();
        setForecastData(data);
      } else if (tab === 'recommendations' && !recommendationsData) {
        const data = await apiService.getAnalysisRecommendations();
        setRecommendationsData(data);
      }
    } catch (err: any) {
      setErrorMessage(formatApiError(err, `Failed to load ${tab} analysis.`));
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'risks') {
      fetchRisks();
    } else {
      fetchTabContent(activeTab);
    }
  }, [activeTab, page, selectedCategory, selectedSeverity, searchQuery]);

  const handleInspectRisk = async (riskId: string) => {
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    soundFX.playClick();
    try {
      const detail = await apiService.getRiskDetail(riskId);
      setSelectedRiskDetail(detail);
      soundFX.playSuccess();
    } catch (err: any) {
      soundFX.playError();
      setErrorMessage(formatApiError(err, 'Failed to load risk detail calculation.'));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleUpdateRecStatus = async (recId: string, newStatus: string) => {
    soundFX.playClick();
    try {
      await apiService.updateRecommendationStatus(recId, newStatus);
      soundFX.playSuccess();
      setStatusFeedback(`Recommendation ${recId} updated to '${newStatus}'.`);
      setTimeout(() => setStatusFeedback(null), 3500);

      // Refresh recommendations
      const updated = await apiService.getAnalysisRecommendations();
      setRecommendationsData(updated);
    } catch (err: any) {
      soundFX.playError();
      setErrorMessage(formatApiError(err, 'Failed to update recommendation status.'));
    }
  };

  const getRiskBadgeColor = (level: RiskLevel): 'critical' | 'high' | 'medium' | 'low' => {
    switch (level) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
      default:
        return 'low';
    }
  };

  // ECharts Configurations
  const shipmentRiskPieOption = overview
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          textStyle: { color: '#f8fafc', fontSize: 12 },
        },
        legend: {
          bottom: '0%',
          left: 'center',
          textStyle: { color: '#94a3b8', fontSize: 11 },
        },
        series: [
          {
            name: 'Shipment Risk',
            type: 'pie',
            radius: ['45%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 6,
              borderColor: '#0f172a',
              borderWidth: 2,
            },
            label: { show: false },
            data: [
              { value: overview.shipment_risk_distribution.LOW || 0, name: 'Low (0-29)', itemStyle: { color: '#10b981' } },
              { value: overview.shipment_risk_distribution.MEDIUM || 0, name: 'Medium (30-59)', itemStyle: { color: '#06b6d4' } },
              { value: overview.shipment_risk_distribution.HIGH || 0, name: 'High (60-79)', itemStyle: { color: '#f59e0b' } },
              { value: overview.shipment_risk_distribution.CRITICAL || 0, name: 'Critical (80-100)', itemStyle: { color: '#f43f5e' } },
            ],
          },
        ],
      }
    : null;

  const categoryRiskBarOption = overview
    ? {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          textStyle: { color: '#f8fafc', fontSize: 12 },
        },
        grid: { top: 20, left: 20, right: 20, bottom: 25, containLabel: true },
        xAxis: {
          type: 'category',
          data: Object.keys(overview.risk_distribution_by_category),
          axisLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94a3b8', fontSize: 10, interval: 0, rotate: 12 },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#1e293b' } },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
        },
        series: [
          {
            type: 'bar',
            data: Object.values(overview.risk_distribution_by_category),
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#3b82f6' },
                  { offset: 1, color: '#1d4ed8' },
                ],
              },
              borderRadius: [4, 4, 0, 0],
            },
          },
        ],
      }
    : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Activity className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
              Supply Chain Intelligence Analysis
            </h1>
            <NeonBadge variant="blue" size="sm">Ground-Truth Live</NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Deterministic risk scoring, multi-tier impact assessments, disruption scenario simulations, and actionable recommendations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {overview?.kpis.data_freshness_timestamp && (
            <span className="text-xs text-slate-400 hidden lg:inline font-mono">
              Freshness: {overview.kpis.data_freshness_timestamp}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              soundFX.playClick();
              fetchOverview();
              if (activeTab === 'risks') fetchRisks();
              else fetchTabContent(activeTab);
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              soundFX.playClick();
              setSimTargetSku(undefined);
              setIsSimulationOpen(true);
            }}
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            Run Simulation
          </Button>
        </div>
      </div>

      {/* Global Status / Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Analysis Error</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => fetchOverview()}>
            Retry
          </Button>
        </div>
      )}

      {statusFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* TOP SECTION: SUPPLY CHAIN HEALTH KPIS (6 Metric Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Metric 1: Total Shipments */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Total Shipments</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {isLoading ? '...' : overview?.kpis.total_shipments ?? 0}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Live operational freight</span>
        </div>

        {/* Metric 2: Delayed Shipments */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Delayed Shipments</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-400 font-mono">
            {isLoading ? '...' : overview?.kpis.delayed_shipments ?? 0}
          </div>
          <span className="text-[10px] text-rose-300/80 mt-1 block">Past scheduled delivery</span>
        </div>

        {/* Metric 3: High-Risk Shipments */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">High-Risk Freight</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">
            {isLoading ? '...' : overview?.kpis.high_risk_shipments ?? 0}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Risk score &gt;= 60</span>
        </div>

        {/* Metric 4: Active Suppliers */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Active Suppliers</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {isLoading ? '...' : overview?.kpis.active_suppliers ?? 0}
          </div>
          <span className="text-[10px] text-emerald-400/80 mt-1 block">
            Avg Rel: {overview?.kpis.average_supplier_reliability ?? 0}%
          </span>
        </div>

        {/* Metric 5: Below Safety Stock */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Below Safety</span>
            <Package className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-purple-400 font-mono">
            {isLoading ? '...' : overview?.kpis.products_below_safety_stock ?? 0}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Buffer threshold breached</span>
        </div>

        {/* Metric 6: At Risk of Stockout */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Stockout Exposure</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-400 font-mono">
            {isLoading ? '...' : overview?.kpis.products_at_risk_of_stockout ?? 0}
          </div>
          <span className="text-[10px] text-rose-300/80 mt-1 block">&lt;= 5 days of inventory</span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/10 pb-2 text-xs font-medium">
        {[
          { id: 'overview', label: 'Executive Overview', icon: BarChart3 },
          { id: 'risks', label: 'Risk Register', icon: ShieldAlert },
          { id: 'shipments', label: 'Shipment Analysis', icon: Truck },
          { id: 'suppliers', label: 'Supplier Reliability', icon: Building2 },
          { id: 'inventory', label: 'Inventory Buffers', icon: Package },
          { id: 'forecast', label: 'Forecast & Demand', icon: TrendingUp },
          { id: 'recommendations', label: 'AI Recommendations', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                soundFX.playClick();
                setActiveTab(tab.id as AnalysisTab);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/20 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Shipment Risk Distribution Donut */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Shipment Risk Distribution</h3>
                  <p className="text-xs text-slate-400">Classified by delay and supplier SLA performance</p>
                </div>
                <NeonBadge variant="blue" size="sm">4-Tier Risk</NeonBadge>
              </div>
              <div className="h-64 w-full">
                {shipmentRiskPieOption ? (
                  <ReactECharts option={shipmentRiskPieOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500">No shipment telemetry available</div>
                )}
              </div>
            </div>

            {/* Risk by Category Bar Chart */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Risk Exposure by Category</h3>
                  <p className="text-xs text-slate-400">Concentration across shipments, suppliers, and buffers</p>
                </div>
                <NeonBadge variant="cyan" size="sm">Multi-Factor</NeonBadge>
              </div>
              <div className="h-64 w-full">
                {categoryRiskBarOption ? (
                  <ReactECharts option={categoryRiskBarOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500">No active risks recorded</div>
                )}
              </div>
            </div>
          </div>

          {/* Top Priority Risks Section */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Top Priority Risk Findings
                </h3>
                <p className="text-xs text-slate-400">Critical items requiring immediate supply chain mitigation</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  soundFX.playClick();
                  setActiveTab('risks');
                }}
              >
                View Full Register
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>

            {overview?.top_risks && overview.top_risks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {overview.top_risks.map((risk) => (
                  <div
                    key={risk.risk_id}
                    onClick={() => handleInspectRisk(risk.risk_id)}
                    className="p-4 rounded-xl bg-slate-800/40 border border-white/5 hover:border-blue-500/40 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">{risk.category}</span>
                        <NeonBadge variant={getRiskBadgeColor(risk.risk_level)} size="sm">
                          {risk.risk_level} ({risk.risk_score})
                        </NeonBadge>
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                        {risk.affected_entity_name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{risk.entity_identifier}</p>
                      <p className="text-xs text-slate-300 mt-2 line-clamp-2">{risk.potential_business_impact}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-blue-400 font-medium">
                      <span>Inspect Evidence</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">
                <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p>No critical risks detected in current supply chain state.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: UNIFIED RISK REGISTER */}
      {activeTab === 'risks' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by SKU, carrier, entity name, impact..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="All">All Categories</option>
                <option value="Shipment Delay">Shipment Delay</option>
                <option value="Supplier Risk">Supplier Risk</option>
                <option value="Inventory Shortage">Inventory Shortage</option>
              </select>

              {/* Severity Filter */}
              <select
                value={selectedSeverity}
                onChange={(e) => {
                  setSelectedSeverity(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="All">All Severities</option>
                <option value="CRITICAL">Critical (80-100)</option>
                <option value="HIGH">High (60-79)</option>
                <option value="MEDIUM">Medium (30-59)</option>
                <option value="LOW">Low (0-29)</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Total Risks: <span className="text-white font-bold">{riskRegister?.total ?? 0}</span>
            </div>
          </div>

          {/* Risk Table */}
          <div className="rounded-2xl bg-slate-900/60 border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">Risk ID</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Affected Entity</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Potential Business Impact</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {riskRegister?.risks && riskRegister.risks.length > 0 ? (
                    riskRegister.risks.map((risk) => (
                      <tr key={risk.risk_id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-cyan-400 whitespace-nowrap">
                          {risk.risk_id}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{risk.category}</td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-white">{risk.affected_entity_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{risk.entity_identifier}</p>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">{risk.risk_score}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <NeonBadge variant={getRiskBadgeColor(risk.risk_level)} size="sm">
                            {risk.risk_level}
                          </NeonBadge>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-300" title={risk.potential_business_impact}>
                          {risk.potential_business_impact}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleInspectRisk(risk.risk_id)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No risks matching the specified filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {riskRegister && riskRegister.total_pages > 1 && (
              <div className="p-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Page {riskRegister.page} of {riskRegister.total_pages} ({riskRegister.total} items)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= riskRegister.total_pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SHIPMENT ANALYSIS */}
      {activeTab === 'shipments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">Total Tracked</span>
              <p className="text-xl font-bold text-white font-mono mt-0.5">{shipmentData?.total ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">Active Delays</span>
              <p className="text-xl font-bold text-rose-400 font-mono mt-0.5">{shipmentData?.delayed_count ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">High Risk (&gt;=60)</span>
              <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">{shipmentData?.high_risk_count ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">Avg Delay Days</span>
              <p className="text-xl font-bold text-white font-mono mt-0.5">{shipmentData?.average_delay_days ?? 0} d</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-white/10 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Shipment ID</th>
                  <th className="py-3 px-4">Carrier & Mode</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Delay (Days)</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Explanation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {shipmentData?.items && shipmentData.items.length > 0 ? (
                  shipmentData.items.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-cyan-400">{s.shipment_id}</td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{s.carrier_name}</p>
                        <p className="text-[10px] text-slate-400">{s.transport_mode}</p>
                      </td>
                      <td className="py-3 px-4 text-[11px] max-w-xs truncate">
                        {s.origin} &rarr; {s.destination}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize">{s.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-400">{s.delay_days} d</td>
                      <td className="py-3 px-4 font-mono font-bold text-white">{s.risk_score}</td>
                      <td className="py-3 px-4">
                        <NeonBadge variant={getRiskBadgeColor(s.risk_level)} size="sm">
                          {s.risk_level}
                        </NeonBadge>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-300" title={s.explanation}>
                        {s.explanation}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No shipment records available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SUPPLIER RELIABILITY */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">Total Suppliers</span>
              <p className="text-xl font-bold text-white font-mono mt-0.5">{supplierData?.total ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">Avg Reliability</span>
              <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">{supplierData?.average_reliability ?? 0}%</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">High Risk</span>
              <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">{supplierData?.high_risk_count ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">Single Source</span>
              <p className="text-xl font-bold text-purple-400 font-mono mt-0.5">{supplierData?.single_source_count ?? 0}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-white/10 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Tier / Category</th>
                  <th className="py-3 px-4">Reliability</th>
                  <th className="py-3 px-4">On-Time Rate</th>
                  <th className="py-3 px-4">Single Source</th>
                  <th className="py-3 px-4">Risk Score</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Key Risk Factors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {supplierData?.items && supplierData.items.length > 0 ? (
                  supplierData.items.map((sup) => (
                    <tr key={sup.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{sup.supplier_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{sup.supplier_code}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-200">{sup.tier}</span> &bull; {sup.category}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">{sup.reliability_score}%</td>
                      <td className="py-3 px-4 font-mono">{(sup.on_time_delivery_rate * 100).toFixed(0)}%</td>
                      <td className="py-3 px-4">
                        {sup.single_source_risk ? (
                          <NeonBadge variant="critical" size="sm">Single Source</NeonBadge>
                        ) : (
                          <span className="text-slate-500">Dual Sourced</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">{sup.risk_score}</td>
                      <td className="py-3 px-4">
                        <NeonBadge variant={getRiskBadgeColor(sup.risk_level)} size="sm">
                          {sup.risk_level}
                        </NeonBadge>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                        {sup.key_risk_factors.join('; ')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No suppliers registered in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: INVENTORY BUFFERS */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">Total Products</span>
              <p className="text-xl font-bold text-white font-mono mt-0.5">{inventoryData?.total ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">Below Safety</span>
              <p className="text-xl font-bold text-purple-400 font-mono mt-0.5">{inventoryData?.below_safety_count ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">Stockout Risk</span>
              <p className="text-xl font-bold text-rose-400 font-mono mt-0.5">{inventoryData?.stockout_risk_count ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
              <span className="text-[10px] uppercase text-slate-400">Critical Status</span>
              <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">{inventoryData?.critical_status_count ?? 0}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-white/10 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">SKU / Product</th>
                  <th className="py-3 px-4">Facility</th>
                  <th className="py-3 px-4">Available</th>
                  <th className="py-3 px-4">Safety Stock</th>
                  <th className="py-3 px-4">Buffer Health</th>
                  <th className="py-3 px-4">Days of Supply</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Simulation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {inventoryData?.items && inventoryData.items.length > 0 ? (
                  inventoryData.items.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{inv.name}</p>
                        <p className="text-[10px] text-cyan-400 font-mono">{inv.sku}</p>
                      </td>
                      <td className="py-3 px-4">{inv.facility}</td>
                      <td className="py-3 px-4 font-mono font-bold text-white">{inv.available_units.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{inv.safety_stock_units.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={inv.buffer_health_percentage < 100 ? 'text-rose-400' : 'text-emerald-400'}>
                          {inv.buffer_health_percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {inv.days_of_supply !== null ? `${inv.days_of_supply} d` : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <NeonBadge
                          variant={inv.status === 'critical' ? 'critical' : inv.status === 'warning' ? 'warning' : 'optimal'}
                          size="sm"
                        >
                          {inv.status}
                        </NeonBadge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            soundFX.playClick();
                            setSimTargetSku(inv.sku);
                            setIsSimulationOpen(true);
                          }}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Simulate
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No inventory records available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: FORECAST & DEMAND */}
      {activeTab === 'forecast' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">14-Day Demand Projections vs Inventory Positions</h3>
              <p className="text-xs text-slate-400">Prophet and Parametric models identifying stockout dates</p>
            </div>
            <NeonBadge variant="cyan" size="sm">
              Stockout Predicted: {forecastData?.stockout_predicted_count ?? 0}
            </NeonBadge>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-white/10 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">SKU / Item</th>
                  <th className="py-3 px-4">Facility</th>
                  <th className="py-3 px-4">Current Stock</th>
                  <th className="py-3 px-4">14-Day Forecast</th>
                  <th className="py-3 px-4">Projected Balance</th>
                  <th className="py-3 px-4">Stockout Status</th>
                  <th className="py-3 px-4">Data Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {forecastData?.items && forecastData.items.length > 0 ? (
                  forecastData.items.map((f) => (
                    <tr key={f.sku} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{f.product_name}</p>
                        <p className="text-[10px] text-cyan-400 font-mono">{f.sku}</p>
                      </td>
                      <td className="py-3 px-4">{f.warehouse}</td>
                      <td className="py-3 px-4 font-mono font-bold text-white">{f.current_available_inventory.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono">{f.expected_total_demand.toLocaleString()} units</td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={f.expected_inventory_after_demand < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                          {f.expected_inventory_after_demand.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {f.stockout_predicted ? (
                          <NeonBadge variant="critical" size="sm">
                            Stockout Day {f.estimated_stockout_day ?? '?'}
                          </NeonBadge>
                        ) : (
                          <NeonBadge variant="optimal" size="sm">Sufficient Buffer</NeonBadge>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400">{f.data_source}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No forecast projections available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: AI RECOMMENDATIONS */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Actionable Supply Chain Recommendations
              </h3>
              <p className="text-xs text-slate-400">
                Derived directly from ground-truth shipment delays, buffer breaches, and single-source risks.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Open: <strong className="text-white">{recommendationsData?.open_count ?? 0}</strong></span>
              <span className="text-slate-400">Resolved: <strong className="text-emerald-400">{recommendationsData?.resolved_count ?? 0}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendationsData?.recommendations && recommendationsData.recommendations.length > 0 ? (
              recommendationsData.recommendations.map((rec) => (
                <div
                  key={rec.recommendation_id}
                  className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-purple-400 uppercase tracking-wider">{rec.category}</span>
                      <div className="flex items-center gap-2">
                        <NeonBadge variant={getRiskBadgeColor(rec.priority)} size="sm">
                          {rec.priority}
                        </NeonBadge>
                        <select
                          value={rec.status}
                          onChange={(e) => handleUpdateRecStatus(rec.recommendation_id, e.target.value)}
                          className="px-2 py-1 rounded bg-slate-800 border border-white/10 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                        >
                          <option value="Open">Open</option>
                          <option value="Reviewed">Reviewed</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Rejected">Rejected</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-white">{rec.title}</h4>
                    <p className="text-xs text-slate-300 font-medium">{rec.suggested_action}</p>

                    <div className="p-2.5 rounded-lg bg-slate-950/40 border border-white/5 space-y-1">
                      <p className="text-[10px] uppercase font-mono text-slate-400 font-semibold">Supporting Evidence:</p>
                      {rec.supporting_evidence.map((ev, i) => (
                        <p key={i} className="text-[11px] text-slate-300">&bull; {ev}</p>
                      ))}
                    </div>

                    <div className="text-xs space-y-1 pt-1">
                      <p className="text-emerald-300 text-[11px]">
                        <strong>Expected Benefit:</strong> {rec.expected_benefit}
                      </p>
                      <p className="text-amber-300 text-[11px]">
                        <strong>Trade-Off:</strong> {rec.important_trade_offs}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>ID: {rec.recommendation_id}</span>
                    <span>Status: <strong className="text-slate-200">{rec.status}</strong></span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 col-span-2 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p>All supply chain nodes nominal. No pending recommendations.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <RiskDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        detail={selectedRiskDetail}
        isLoading={isDetailLoading}
      />

      <SimulationModal
        isOpen={isSimulationOpen}
        onClose={() => setIsSimulationOpen(false)}
        defaultSku={simTargetSku}
      />
    </div>
  );
};
