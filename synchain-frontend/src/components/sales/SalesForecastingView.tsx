import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  TrendingUp,
  DollarSign,
  Package,
  Percent,
  Calendar,
  Layers,
  Sparkles,
  BarChart3,
  Sliders,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  UploadCloud,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  HelpCircle,
  Cpu,
  Truck,
  Building2,
  PieChart as PieIcon,
} from 'lucide-react';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { Tooltip } from '../common/Tooltip';
import { SalesImportModal } from './SalesImportModal';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';
import { formatApiError } from '../../utils/errorFormatter';
import {
  SalesOverviewKPIs,
  HistoricalSalesAnalysisResponse,
  RevenueForecastResponse,
  SalesScenarioResponse,
  SalesSupplyChainIntegrationResponse,
  SalesTransactionListResponse,
  SalesTransaction,
} from '../../types/sales';

type SalesTab =
  | 'overview'
  | 'historical'
  | 'forecasting'
  | 'products'
  | 'scenarios'
  | 'integration'
  | 'transactions';

export const SalesForecastingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SalesTab>('overview');

  // Core Data States
  const [kpis, setKpis] = useState<SalesOverviewKPIs | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalSalesAnalysisResponse | null>(null);
  const [forecastData, setForecastData] = useState<RevenueForecastResponse | null>(null);
  const [scenarioData, setScenarioData] = useState<SalesScenarioResponse | null>(null);
  const [integrationData, setIntegrationData] = useState<SalesSupplyChainIntegrationResponse | null>(null);
  const [transactionsData, setTransactionsData] = useState<SalesTransactionListResponse | null>(null);

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [forecastHorizon, setForecastHorizon] = useState<number>(30);
  const [forecastProductFilter, setForecastProductFilter] = useState<string>('');

  // Scenario Simulator Inputs
  const [scenarioVolumeChange, setScenarioVolumeChange] = useState<number>(0);
  const [scenarioPriceChange, setScenarioPriceChange] = useState<number>(0);
  const [scenarioDemandShock, setScenarioDemandShock] = useState<number>(0);
  const [scenarioFulfillmentCap, setScenarioFulfillmentCap] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Transactions Search & Pagination
  const [txSearch, setTxSearch] = useState<string>('');
  const [txPage, setTxPage] = useState<number>(1);

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // Reliable State Management for Forecast Card
  type ForecastCardState =
    | 'idle'
    | 'loading'
    | 'forecast_available'
    | 'insufficient_data'
    | 'no_sales_data'
    | 'forecast_unavailable'
    | 'error';
  const [forecastState, setForecastState] = useState<ForecastCardState>('idle');
  const [forecastErrorMsg, setForecastErrorMsg] = useState<string | null>(null);
  const forecastRequestIdRef = React.useRef(0);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  const fetchOverviewAndHistorical = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const yearParam = selectedYear !== 'All' ? parseInt(selectedYear, 10) : undefined;
      const catParam = selectedCategory !== 'All' ? selectedCategory : undefined;
      const regParam = selectedRegion !== 'All' ? selectedRegion : undefined;

      const [kpiRes, histRes] = await Promise.all([
        apiService.getSalesOverview({ year: yearParam, category: catParam, region: regParam }),
        apiService.getHistoricalSalesAnalysis({ year: yearParam, category: catParam, region: regParam }),
      ]);

      setKpis(kpiRes);
      setHistoricalData(histRes);
    } catch (err: any) {
      setErrorMessage(formatApiError(err, 'Failed to retrieve sales overview data.'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchForecast = async (horizon: number = forecastHorizon, prodId?: string) => {
    const reqId = ++forecastRequestIdRef.current;
    setForecastState('loading');
    setForecastErrorMsg(null);

    // Timeout safety: Ensure loading indicator cannot stay stuck indefinitely
    const timeoutId = window.setTimeout(() => {
      if (reqId === forecastRequestIdRef.current) {
        setForecastState((curr) => (curr === 'loading' ? 'forecast_unavailable' : curr));
        setForecastErrorMsg('Forecast calculation timed out. Please retry.');
      }
    }, 15000);

    try {
      const res = await apiService.getRevenueForecast({
        horizon_days: horizon,
        product_id: prodId || (forecastProductFilter || undefined),
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
      });

      window.clearTimeout(timeoutId);

      // Avoid race conditions: only update if this is the newest pending request
      if (reqId === forecastRequestIdRef.current) {
        setForecastData(res);
        if (!res.has_data) {
          setForecastState('no_sales_data');
        } else if (!res.has_sufficient_history) {
          setForecastState('insufficient_data');
        } else if (res.total_forecasted_revenue === null || res.total_forecasted_revenue === undefined) {
          setForecastState('forecast_unavailable');
        } else {
          setForecastState('forecast_available');
        }
      }
    } catch (err: any) {
      window.clearTimeout(timeoutId);
      if (reqId === forecastRequestIdRef.current) {
        setForecastState('error');
        const formattedErr = formatApiError(err, 'Failed to generate revenue forecast.');
        setForecastErrorMsg(formattedErr);
      }
    }
  };

  const runScenarioSimulation = async () => {
    setIsSimulating(true);
    try {
      soundFX.playClick();
      const res = await apiService.simulateSalesScenario({
        scenario_name: 'Custom User Scenario',
        horizon_days: forecastHorizon,
        volume_change_pct: scenarioVolumeChange,
        price_change_pct: scenarioPriceChange,
        demand_shock_pct: scenarioDemandShock,
        apply_fulfillment_constraints: scenarioFulfillmentCap,
        product_id: forecastProductFilter || undefined,
        product_category: selectedCategory !== 'All' ? selectedCategory : undefined,
      });
      setScenarioData(res);
    } catch (err: any) {
      setErrorMessage(formatApiError(err, 'Simulation calculation failed.'));
    } finally {
      setIsSimulating(false);
    }
  };

  const fetchIntegration = async () => {
    try {
      const res = await apiService.getSalesSupplyChainIntegration();
      setIntegrationData(res);
    } catch (err: any) {
      setErrorMessage(formatApiError(err, 'Failed to load supply-chain integration analytics.'));
    }
  };

  const fetchTransactions = async (page: number = txPage, search: string = txSearch) => {
    try {
      const res = await apiService.getSalesTransactions({
        page,
        page_size: 15,
        search: search.trim() || undefined,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        region: selectedRegion !== 'All' ? selectedRegion : undefined,
      });
      setTransactionsData(res);
    } catch (err: any) {
      setErrorMessage(formatApiError(err, 'Failed to load sales transactions.'));
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!window.confirm('Are you sure you want to remove this sales transaction record?')) return;
    try {
      soundFX.playClick();
      await apiService.deleteSalesTransaction(txId);
      soundFX.playSuccess();
      fetchTransactions(txPage, txSearch);
      fetchOverviewAndHistorical();
    } catch (err: any) {
      alert(formatApiError(err, 'Failed to delete transaction.'));
    }
  };

  useEffect(() => {
    fetchOverviewAndHistorical();
    fetchForecast(30);

    const handleImported = () => {
      fetchOverviewAndHistorical();
      fetchForecast(forecastHorizon);
      fetchTransactions(txPage, txSearch);
    };

    window.addEventListener('synchain_data_imported', handleImported);
    return () => {
      window.removeEventListener('synchain_data_imported', handleImported);
    };
  }, [selectedYear, selectedCategory, selectedRegion, forecastHorizon, txPage, txSearch]);

  useEffect(() => {
    if (activeTab === 'forecasting') {
      fetchForecast(forecastHorizon, forecastProductFilter);
    } else if (activeTab === 'scenarios' && !scenarioData) {
      runScenarioSimulation();
    } else if (activeTab === 'integration' && !integrationData) {
      fetchIntegration();
    } else if (activeTab === 'transactions') {
      fetchTransactions(txPage, txSearch);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'forecasting') {
      fetchForecast(forecastHorizon, forecastProductFilter);
    }
  }, [forecastHorizon, forecastProductFilter]);

  // Download Sample CSV Helper
  const handleDownloadSampleCSV = () => {
    soundFX.playClick();
    const headers = [
      'transaction_id',
      'transaction_date',
      'product_id',
      'product_name',
      'product_category',
      'quantity_sold',
      'unit_selling_price',
      'discount_amount',
      'return_quantity',
      'tax_amount',
      'region',
      'customer_id',
      'order_id',
      'currency',
    ];
    const rows = [
      'TX-2026-001,2026-01-10,IC-3NM-A18,Neural Processor 3nm,Logic Silicon,25,150.00,50.00,0,15.00,North America,CUST-001,ORD-1001,USD',
      'TX-2026-002,2026-01-18,HBM3E-24G,High Bandwidth Memory 24GB,Memory IC,40,80.00,0.00,1,0.00,Asia Pacific,CUST-002,ORD-1002,USD',
      'TX-2026-003,2026-02-05,IC-3NM-A18,Neural Processor 3nm,Logic Silicon,30,150.00,100.00,0,20.00,Europe,CUST-003,ORD-1003,USD',
      'TX-2026-004,2026-02-20,HBM3E-24G,High Bandwidth Memory 24GB,Memory IC,35,80.00,20.00,0,5.00,North America,CUST-004,ORD-1004,USD',
      'TX-2026-005,2026-03-04,IC-3NM-A18,Neural Processor 3nm,Logic Silicon,45,150.00,0.00,0,0.00,Asia Pacific,CUST-005,ORD-1005,USD',
      'TX-2026-006,2026-03-19,HBM3E-24G,High Bandwidth Memory 24GB,Memory IC,50,80.00,50.00,2,0.00,Europe,CUST-006,ORD-1006,USD',
      'TX-2026-007,2026-04-02,IC-3NM-A18,Neural Processor 3nm,Logic Silicon,40,150.00,0.00,0,0.00,North America,CUST-007,ORD-1007,USD',
      'TX-2026-008,2026-04-18,HBM3E-24G,High Bandwidth Memory 24GB,Memory IC,60,80.00,100.00,0,0.00,Asia Pacific,CUST-008,ORD-1008,USD',
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'synchain_sample_sales.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---------------------------------------------------------------------------
  // ECharts Options
  // ---------------------------------------------------------------------------

  // 1. Monthly Revenue & ASP Combo Chart
  const monthlyRevenueChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: '#999' } },
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 13 },
    },
    legend: {
      data: ['Revenue After Returns ($)', 'Gross Billed Sales ($)', 'Average Price per Unit ($)'],
      textStyle: { color: '#94a3b8', fontSize: 12 },
      top: 0,
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: [
      {
        type: 'category',
        data: historicalData?.monthly_trends.map((m) => m.year_month) || [],
        axisPointer: { type: 'shadow' },
        axisLabel: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: 'Revenue ($)',
        axisLabel: {
          color: '#94a3b8',
          fontSize: 12,
          formatter: (v: number) => `$${(v / 1000).toFixed(0)}k`,
        },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      {
        type: 'value',
        name: 'Average Price ($)',
        axisLabel: {
          color: '#38bdf8',
          fontSize: 12,
          formatter: (v: number) => `$${v}`,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Revenue After Returns ($)',
        type: 'bar',
        data: historicalData?.monthly_trends.map((m) => m.revenue) || [],
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: 'Gross Billed Sales ($)',
        type: 'bar',
        data: historicalData?.monthly_trends.map((m) => m.gross_revenue) || [],
        itemStyle: {
          color: '#1d4ed8',
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: 'Average Price per Unit ($)',
        type: 'line',
        yAxisIndex: 1,
        data: historicalData?.monthly_trends.map((m) => m.asp) || [],
        itemStyle: { color: '#38bdf8' },
        lineStyle: { width: 3 },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  };

  // 2. Forecasting Interactive Chart (Historical + Projections + 95% Confidence Band)
  const forecastChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#10b981',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 13 },
    },
    legend: {
      data: ['Past Recorded Sales', 'Future Projected Revenue', 'Upper Forecast Range', 'Lower Forecast Range'],
      textStyle: { color: '#94a3b8', fontSize: 12 },
      top: 0,
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: [
        ...(forecastData?.historical_points.map((p) => p.date) || []),
        ...(forecastData?.forecast_points.map((p) => p.date) || []),
      ],
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#94a3b8',
        fontSize: 12,
        formatter: (v: number) => `$${v.toLocaleString()}`,
      },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'Past Recorded Sales',
        type: 'line',
        data: [
          ...(forecastData?.historical_points.map((p) => p.predicted_revenue) || []),
          ...Array(forecastData?.forecast_points.length || 0).fill(null),
        ],
        itemStyle: { color: '#38bdf8' },
        lineStyle: { width: 2.5 },
        symbol: 'none',
      },
      {
        name: 'Future Projected Revenue',
        type: 'line',
        data: [
          ...Array(forecastData?.historical_points.length || 0).fill(null),
          ...(forecastData?.forecast_points.map((p) => p.predicted_revenue) || []),
        ],
        itemStyle: { color: '#10b981' },
        lineStyle: { width: 3, type: 'dashed' },
        symbol: 'circle',
        symbolSize: 4,
      },
      {
        name: 'Upper Forecast Range',
        type: 'line',
        data: [
          ...Array(forecastData?.historical_points.length || 0).fill(null),
          ...(forecastData?.forecast_points.map((p) => p.confidence_upper) || []),
        ],
        lineStyle: { opacity: 0 },
        stack: 'confidence-band',
        symbol: 'none',
      },
      {
        name: 'Lower Forecast Range',
        type: 'line',
        data: [
          ...Array(forecastData?.historical_points.length || 0).fill(null),
          ...(forecastData?.forecast_points.map((p) => p.confidence_lower) || []),
        ],
        lineStyle: { opacity: 0 },
        areaStyle: {
          color: 'rgba(16, 185, 129, 0.15)',
        },
        stack: 'confidence-band',
        symbol: 'none',
      },
    ],
  };

  // 3. Category Sales Donut Option
  const categoryDonutOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ${c} ({d}%)',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#6366f1',
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#94a3b8' },
    },
    series: [
      {
        name: 'Category Revenue',
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#0f172a',
          borderWidth: 2,
        },
        label: { show: false },
        data:
          historicalData?.category_performance.map((c, i) => ({
            name: c.category,
            value: c.revenue,
            itemStyle: {
              color: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5],
            },
          })) || [],
      },
    ],
  };

  // 4. Regional Performance Bar Option
  const regionalBarOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#8b5cf6',
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: {
        color: '#94a3b8',
        formatter: (v: number) => `$${(v / 1000).toFixed(0)}k`,
      },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'category',
      data: historicalData?.regional_performance.map((r) => r.region) || [],
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    series: [
      {
        type: 'bar',
        data: historicalData?.regional_performance.map((r) => r.revenue) || [],
        itemStyle: {
          color: '#8b5cf6',
          borderRadius: [0, 6, 6, 0],
        },
      },
    ],
  };

  // ---------------------------------------------------------------------------
  // Empty State Component
  // ---------------------------------------------------------------------------
  if (!isLoading && kpis && !kpis.has_data) {
    return (
      <div className="space-y-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Sales & Revenue Forecast
              </h1>
              <NeonBadge variant="cyan">Predictive ML</NeonBadge>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Tracks past customer sales, projects future revenue, and connects sales trends to supply chain replenishment.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleDownloadSampleCSV} className="gap-2">
              <Download className="w-4 h-4 text-blue-400" />
              Download CSV Template
            </Button>
            <Button variant="primary" onClick={() => setIsImportModalOpen(true)} className="gap-2">
              <UploadCloud className="w-4 h-4" />
              Import Sales Data
            </Button>
          </div>
        </div>

        {/* Empty State Hero Card */}
        <div className="p-12 rounded-2xl glass-panel border border-dashed border-white/20 text-center max-w-3xl mx-auto space-y-6 my-12">
          <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto">
            <DollarSign className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">No Sales Transactions Recorded Yet</h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Your supply chain currently lacks customer sales records. To unlock predictive revenue forecasting,
              ASP trends, and inventory replenishment planning, please import a sales transaction CSV.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Button variant="primary" onClick={() => setIsImportModalOpen(true)} className="gap-2">
              <UploadCloud className="w-4 h-4" />
              Import Sales CSV Now
            </Button>
            <Button variant="secondary" onClick={handleDownloadSampleCSV} className="gap-2">
              <Download className="w-4 h-4 text-cyan-400" />
              Download Sample CSV
            </Button>
          </div>

          <div className="pt-6 border-t border-white/10 text-left max-w-md mx-auto">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
              Accepted CSV Format Requirements:
            </p>
            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
              <li>transaction_id (Unique transaction string)</li>
              <li>transaction_date (e.g. 2026-01-15)</li>
              <li>product_id (Matching your component or product SKU)</li>
              <li>quantity_sold, unit_selling_price, discount_amount</li>
              <li>region, product_category</li>
            </ul>
          </div>
        </div>

        {/* Sales Import Modal */}
        <SalesImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            fetchOverviewAndHistorical();
          }}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main Dashboard View with Real Data
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Sales & Revenue Forecast
            </h1>
            <NeonBadge variant="optimal">Live Transactions</NeonBadge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Tracks past customer sales, projects future revenue, and connects sales trends to supply chain replenishment.
          </p>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900 text-white">All Years</option>
              {historicalData?.available_years.map((y) => (
                <option key={y} value={y.toString()} className="bg-slate-900 text-white">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900 text-white">All Categories</option>
              {historicalData?.available_categories.map((c) => (
                <option key={c} value={c} className="bg-slate-900 text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          <Button variant="secondary" onClick={handleDownloadSampleCSV} className="gap-2 text-xs">
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Template
          </Button>

          <Button variant="primary" onClick={() => setIsImportModalOpen(true)} className="gap-2 text-xs">
            <UploadCloud className="w-3.5 h-3.5" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {[
          { id: 'overview', label: 'Sales Overview', icon: BarChart3 },
          { id: 'historical', label: 'Past Sales', icon: Clock },
          { id: 'forecasting', label: 'Future Revenue', icon: TrendingUp },
          { id: 'products', label: 'Best- and Worst-Selling Products', icon: Package },
          { id: 'scenarios', label: 'Scenario Simulator', icon: Sliders },
          { id: 'integration', label: 'Supply Chain Sync', icon: Truck },
          { id: 'transactions', label: 'Sales Records', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                soundFX.playClick();
                setActiveTab(tab.id as SalesTab);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: OVERVIEW */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards Row (6 Cards) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Total Revenue */}
            <div className="p-4 rounded-2xl glass-panel border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium text-slate-300">Total Net Revenue</span>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <Tooltip
                    content={
                      <div>
                        <p className="font-semibold text-white mb-1">Total Net Revenue</p>
                        <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Total net money earned from customer orders after subtracting returns and discounts.</p>
                        <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Shows the actual money collected by the business from customer purchases.</p>
                        <p><span className="text-amber-400 font-medium">What to watch:</span> Compare against gross sales to make sure returns are not eating into revenue.</p>
                      </div>
                    }
                  />
                </div>
              </div>
              <p className="text-xl lg:text-2xl font-bold text-white">
                ${(kpis?.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">Excludes returns & discounts</p>
            </div>

            {/* 2. Total Units Sold */}
            <div className="p-4 rounded-2xl glass-panel border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium text-slate-300">Units Sold</span>
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4 text-blue-400" />
                  <Tooltip
                    content={
                      <div>
                        <p className="font-semibold text-white mb-1">Units Sold</p>
                        <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Total number of physical product units delivered across all customer transactions.</p>
                        <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Directly drives warehouse inventory consumption and restocking schedules.</p>
                        <p><span className="text-amber-400 font-medium">What to watch:</span> Rising units with flat revenue may indicate heavy price discounting.</p>
                      </div>
                    }
                  />
                </div>
              </div>
              <p className="text-xl lg:text-2xl font-bold text-white">
                {(kpis?.total_units_sold || 0).toLocaleString()}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">From {kpis?.total_transactions || 0} customer orders</p>
            </div>

            {/* 3. Revenue Growth (MoM / YoY) */}
            <div className="p-4 rounded-2xl glass-panel border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium text-slate-300">Revenue Change</span>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <Tooltip
                    content={
                      <div>
                        <p className="font-semibold text-white mb-1">Revenue Change</p>
                        <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Percentage increase or decrease in sales revenue over the comparison period.</p>
                        <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Shows whether customer demand is growing, steady, or slowing down.</p>
                        <p><span className="text-amber-400 font-medium">What to watch:</span> Sharp drops signal softening demand or missed fulfillment opportunities.</p>
                      </div>
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-xl lg:text-2xl font-bold text-white">
                  {kpis?.revenue_growth_mom !== null && kpis?.revenue_growth_mom !== undefined
                    ? `${kpis.revenue_growth_mom > 0 ? '+' : ''}${kpis.revenue_growth_mom}%`
                    : kpis?.revenue_growth_yoy !== null && kpis?.revenue_growth_yoy !== undefined
                    ? `${kpis.revenue_growth_yoy > 0 ? '+' : ''}${kpis.revenue_growth_yoy}%`
                    : 'N/A'}
                </p>
                {kpis?.revenue_growth_mom && kpis.revenue_growth_mom > 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <p className="text-[12px] text-slate-400 mt-1">
                {kpis?.revenue_growth_mom !== null ? 'Compared to previous month' : 'Compared to previous year'}
              </p>
            </div>

            {/* 4. Average Selling Price (ASP) */}
            <div className="p-4 rounded-2xl glass-panel border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium text-slate-300">Average Price / Unit</span>
                <div className="flex items-center gap-1">
                  <Percent className="w-4 h-4 text-indigo-400" />
                  <Tooltip
                    content={
                      <div>
                        <p className="font-semibold text-white mb-1">Average Price per Unit (ASP)</p>
                        <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Net revenue divided by total units sold.</p>
                        <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Reveals product mix shifts and whether revenue is coming from premium or budget items.</p>
                        <p><span className="text-amber-400 font-medium">What to watch:</span> Declining unit prices without volume growth may erode profit margins.</p>
                      </div>
                    }
                  />
                </div>
              </div>
              <p className="text-xl lg:text-2xl font-bold text-white">
                ${(kpis?.average_selling_price || 0).toFixed(2)}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">Average price per unit sold</p>
            </div>

            {/* 5. Forecasted Revenue (30d) */}
            <div className="p-4 rounded-2xl glass-panel border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium text-slate-300">Forecasted 30d Revenue</span>
                <div className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <Tooltip
                    content={
                      <div>
                        <p className="font-semibold text-white mb-1">Forecasted 30d Revenue</p>
                        <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Estimated revenue over the next 30 days based on recent demand patterns and order trends.</p>
                        <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Helps finance and supply chain teams align procurement budgets and cash flow.</p>
                        <p><span className="text-amber-400 font-medium">What to watch:</span> Compare with supplier purchase commitments to ensure adequate working capital.</p>
                      </div>
                    }
                  />
                </div>
              </div>
              {forecastState === 'loading' ? (
                <div className="flex items-center gap-2 py-1">
                  <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-sm font-medium text-purple-300">Generating forecast...</span>
                </div>
              ) : forecastState === 'error' ? (
                <div>
                  <p className="text-sm font-semibold text-rose-400">Forecast unavailable</p>
                  <button
                    onClick={() => fetchForecast(30)}
                    className="text-[11px] text-cyan-400 hover:underline mt-1 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry Forecast
                  </button>
                </div>
              ) : forecastState === 'no_sales_data' ? (
                <div>
                  <p className="text-sm font-semibold text-slate-400">No sales data</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Import transactions to model</p>
                </div>
              ) : forecastState === 'insufficient_data' ? (
                <div>
                  <p className="text-sm font-semibold text-amber-400">Insufficient historical data</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                    {forecastData?.explanation || 'Min 5 transaction dates required'}
                  </p>
                </div>
              ) : forecastState === 'forecast_unavailable' ? (
                <div>
                  <p className="text-sm font-semibold text-slate-400">Forecast unavailable</p>
                  <button
                    onClick={() => fetchForecast(30)}
                    className="text-[11px] text-cyan-400 hover:underline mt-1 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry Forecast
                  </button>
                </div>
              ) : forecastData?.total_forecasted_revenue !== undefined ? (
                <>
                  <p className="text-xl lg:text-2xl font-bold text-purple-300 font-mono">
                    ${forecastData.total_forecasted_revenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-[12px] text-slate-400 mt-1">Projected 30-day run rate</p>
                </>
              ) : (
                <p className="text-sm text-slate-500">Forecast unavailable</p>
              )}
            </div>

            {/* 6. Forecast Accuracy */}
            <div className="p-4 rounded-2xl glass-panel border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium text-slate-300">Forecast Quality</span>
                <div className="flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4 text-teal-400" />
                  <Tooltip
                    content={
                      <div>
                        <p className="font-semibold text-white mb-1">Forecast Quality (Backtest Score)</p>
                        <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Measures how closely past predictions matched actual customer sales (using Weighted Absolute Percentage Error).</p>
                        <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Higher accuracy gives confidence when setting safety stock and purchasing schedules.</p>
                        <p><span className="text-amber-400 font-medium">What to watch:</span> High-variance or sparse sales histories show lower scores until more transaction records are added.</p>
                      </div>
                    }
                  />
                </div>
              </div>
              <p className="text-xl lg:text-2xl font-bold text-teal-300">
                {forecastState === 'loading'
                  ? 'Evaluating...'
                  : forecastData?.metrics?.accuracy_pct !== null && forecastData?.metrics?.accuracy_pct !== undefined
                  ? forecastData.metrics.accuracy_pct === 0 && (forecastData.metrics.wape || 0) > 100
                    ? 'High Variance'
                    : `${forecastData.metrics.accuracy_pct}%`
                  : forecastState === 'insufficient_data'
                  ? 'N/A'
                  : '80/20 Holdout'}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                {forecastData?.metrics?.wape
                  ? (forecastData.metrics.wape > 100
                    ? `WAPE: ${forecastData.metrics.wape}% (Volatile)`
                    : `WAPE: ${forecastData.metrics.wape}% error`)
                  : 'Statistical Backtest'}
              </p>
            </div>
          </div>

          {/* Main Trend Chart */}
          <div className="p-6 rounded-2xl glass-panel border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Monthly Revenue and Average Price Trends</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Compares actual customer sales revenue against gross billing and average price per unit across months.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Data Last Updated:</span>
                <span className="text-xs text-cyan-300 font-mono">{kpis?.data_freshness_timestamp}</span>
              </div>
            </div>
            <div className="h-80 w-full">
              <ReactECharts option={monthlyRevenueChartOption} style={{ height: '100%', width: '100%' }} notMerge />
            </div>
          </div>

          {/* Breakdown Cards Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Performance Card */}
            <div className="p-6 rounded-2xl glass-panel border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-blue-400" />
                  Category Revenue Performance
                </h3>
                <span className="text-xs text-slate-400">
                  {historicalData?.category_performance.length || 0} categories
                </span>
              </div>
              <div className="h-64 w-full">
                <ReactECharts option={categoryDonutOption} style={{ height: '100%', width: '100%' }} notMerge />
              </div>
            </div>

            {/* Regional Sales Card */}
            <div className="p-6 rounded-2xl glass-panel border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  Regional Market Breakdown
                </h3>
                <span className="text-xs text-slate-400">
                  {historicalData?.regional_performance.length || 0} regions
                </span>
              </div>
              <div className="h-64 w-full">
                <ReactECharts option={regionalBarOption} style={{ height: '100%', width: '100%' }} notMerge />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: HISTORICAL ANALYSIS */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'historical' && (
        <div className="space-y-6">
          {/* YoY Equivalent Period Table */}
          <div className="p-6 rounded-2xl glass-panel border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">Year-over-Year Equivalent Period Comparison</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Compares identical calendar months between adjacent years to eliminate seasonality distortion.
                </p>
              </div>
              <NeonBadge variant="blue">Normalized Comparison</NeonBadge>
            </div>

            {historicalData?.yoy_comparison.length ? (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Period</th>
                      <th className="p-3 text-right">Current Year ({historicalData.yoy_comparison[0]?.current_year})</th>
                      <th className="p-3 text-right">Previous Year ({historicalData.yoy_comparison[0]?.previous_year})</th>
                      <th className="p-3 text-right">Growth (%)</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-slate-900/40">
                    {historicalData.yoy_comparison.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="p-3 font-semibold text-white">{row.period}</td>
                        <td className="p-3 text-right font-medium text-emerald-400">
                          ${row.current_year_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-slate-400">
                          ${row.previous_year_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right">
                          {row.growth_pct !== null ? (
                            <span
                              className={`font-semibold ${
                                row.growth_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {row.growth_pct > 0 ? '+' : ''}
                              {row.growth_pct}%
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <NeonBadge
                            variant={row.growth_pct && row.growth_pct >= 0 ? 'optimal' : 'critical'}
                          >
                            {row.growth_pct && row.growth_pct >= 0 ? 'Expanding' : 'Contracting'}
                          </NeonBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 italic">
                Multi-year sales history required for Year-over-Year equivalent period comparisons.
              </p>
            )}
          </div>

          {/* Top Selling & Declining Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="p-6 rounded-2xl glass-panel border border-white/10">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                Top Revenue Contributors
              </h3>
              <div className="space-y-3">
                {historicalData?.top_selling_products.map((p, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">{p.product_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {p.product_id} • {p.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">${p.total_revenue.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">{p.revenue_share_pct}% share</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Declining Products */}
            <div className="p-6 rounded-2xl glass-panel border border-white/10">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-rose-400" />
                Products with Declining Trajectory
              </h3>
              <div className="space-y-3">
                {historicalData?.declining_products.length ? (
                  historicalData.declining_products.map((p, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">{p.product_name}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {p.product_id} • {p.category}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-rose-400">{p.growth_pct}%</p>
                        <p className="text-[10px] text-slate-400">${p.total_revenue.toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    No products experiencing significant sales contraction in the selected window.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 3: REVENUE FORECASTING */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'forecasting' && (
        <div className="space-y-6">
          {/* Horizon & Product Selector */}
          <div className="p-4 rounded-2xl glass-panel border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">Forecast Horizon:</span>
              {[30, 60, 90, 180, 365].map((days) => {
                const label =
                  days === 30
                    ? 'Next 30 days'
                    : days === 60
                    ? 'Next 60 days'
                    : days === 90
                    ? 'Next 90 days'
                    : days === 180
                    ? 'Next 6 months'
                    : 'Next 12 months';
                return (
                  <button
                    key={days}
                    onClick={() => {
                      soundFX.playClick();
                      setForecastHorizon(days);
                      fetchForecast(days, forecastProductFilter);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      forecastHorizon === days
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                        : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">SKU Filter:</span>
              <select
                value={forecastProductFilter}
                onChange={(e) => {
                  setForecastProductFilter(e.target.value);
                  fetchForecast(forecastHorizon, e.target.value);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value="">All Products (Aggregate)</option>
                {historicalData?.product_contributions.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name} ({p.product_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Forecasting Interactive Chart */}
          <div className="p-6 rounded-2xl glass-panel border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Statistical Revenue & Volume Projection
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fitted with {forecastData?.model_name || 'AR Baseline'} • 95% Confidence Bounds
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    Projected {forecastHorizon < 180 ? `${forecastHorizon}-day` : forecastHorizon === 180 ? '6-month' : '12-month'} Revenue
                  </p>
                  <p className="text-lg font-bold text-emerald-400 font-mono">
                    {forecastData?.total_forecasted_revenue !== undefined && forecastData.has_data && forecastData.has_sufficient_history
                      ? `$${forecastData.total_forecasted_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : 'Unavailable'}
                  </p>
                </div>
              </div>
            </div>

            <div className="h-96 w-full">
              <ReactECharts option={forecastChartOption} style={{ height: '100%', width: '100%' }} notMerge />
            </div>
          </div>

          {/* Model Evaluation & Backtest Metrics Card */}
          {forecastData?.metrics && (
            <div className="p-6 rounded-2xl glass-panel border border-white/10">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Forecast Quality Test (Chronological 80/20 Holdout)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  The model was trained on the first 80% of sales transactions and tested against the remaining 20% to check real-world accuracy.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-300">Model Accuracy</p>
                    <Tooltip
                      content={
                        <div>
                          <p className="font-semibold text-white mb-1">Model Accuracy</p>
                          <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Calculated as 100% minus Weighted Absolute Percentage Error (WAPE).</p>
                          <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Shows overall confidence in future sales volume predictions.</p>
                          <p><span className="text-amber-400 font-medium">What to watch:</span> If demand has high day-to-day variance, scores will be lower until more historical patterns accumulate.</p>
                        </div>
                      }
                    />
                  </div>
                  <p className="text-xl font-bold text-emerald-400 mt-1">
                    {forecastData.metrics.accuracy_pct === 0 && (forecastData.metrics.wape || 0) > 100
                      ? 'High Variance'
                      : `${forecastData.metrics.accuracy_pct}%`}
                  </p>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    {forecastData.metrics.accuracy_pct === 0 && (forecastData.metrics.wape || 0) > 100
                      ? 'Volatile historical sales'
                      : '100 - WAPE'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-300">Weighted Error (WAPE)</p>
                    <Tooltip
                      content={
                        <div>
                          <p className="font-semibold text-white mb-1">Weighted Absolute Percentage Error</p>
                          <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Total prediction error divided by total volume, avoiding skew on low-volume days.</p>
                          <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Standard retail & supply chain metric for forecast precision.</p>
                          <p><span className="text-amber-400 font-medium">What to watch:</span> Lower is better. Under 25% is excellent; over 50% indicates irregular purchases.</p>
                        </div>
                      }
                    />
                  </div>
                  <p className="text-xl font-bold text-cyan-400 mt-1">
                    {forecastData.metrics.wape}%
                  </p>
                  <p className="text-[12px] text-slate-400 mt-0.5">Lower is better</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-300">Root Mean Sq Error (RMSE)</p>
                    <Tooltip
                      content={
                        <div>
                          <p className="font-semibold text-white mb-1">Root Mean Squared Error</p>
                          <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Average dollar error magnitude, with heavier penalties for large forecast misses.</p>
                          <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Warns you if the model occasionally makes huge prediction blunders.</p>
                          <p><span className="text-amber-400 font-medium">What to watch:</span> A large gap between RMSE and MAE indicates occasional extreme outlier sales spikes.</p>
                        </div>
                      }
                    />
                  </div>
                  <p className="text-xl font-bold text-white mt-1">
                    ${forecastData.metrics.rmse.toLocaleString()}
                  </p>
                  <p className="text-[12px] text-slate-400 mt-0.5">Penalizes large misses</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-300">Mean Absolute Error (MAE)</p>
                    <Tooltip
                      content={
                        <div>
                          <p className="font-semibold text-white mb-1">Mean Absolute Error</p>
                          <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Average dollar amount that predictions deviated from actual sales.</p>
                          <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Direct dollar intuition for typical daily forecast variance.</p>
                          <p><span className="text-amber-400 font-medium">What to watch:</span> Should represent a small percentage of your average daily sales revenue.</p>
                        </div>
                      }
                    />
                  </div>
                  <p className="text-xl font-bold text-white mt-1">
                    ${forecastData.metrics.mae.toLocaleString()}
                  </p>
                  <p className="text-[12px] text-slate-400 mt-0.5">Average dollar miss</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 4: PRODUCT-WISE PERFORMANCE */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-panel border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">Product Catalog Sales & Unit Economics</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Detailed breakdown of units sold, average selling prices, and revenue share by product SKU.
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {historicalData?.product_contributions.length || 0} products active
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">SKU / ID</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Units Sold</th>
                    <th className="p-3 text-right">Avg Selling Price</th>
                    <th className="p-3 text-right">Total Net Revenue</th>
                    <th className="p-3 text-right">Revenue Share</th>
                    <th className="p-3 text-center">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-slate-900/40">
                  {historicalData?.product_contributions.map((p, idx) => (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="p-3 font-mono text-cyan-400 font-semibold">{p.product_id}</td>
                      <td className="p-3 font-medium text-white">{p.product_name}</td>
                      <td className="p-3 text-slate-400">{p.category}</td>
                      <td className="p-3 text-right font-medium">{p.units_sold.toLocaleString()}</td>
                      <td className="p-3 text-right text-cyan-300 font-mono">${p.asp.toFixed(2)}</td>
                      <td className="p-3 text-right font-semibold text-emerald-400">
                        ${p.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono">{p.revenue_share_pct}%</td>
                      <td className="p-3 text-center">
                        <NeonBadge
                          variant={
                            p.trend_direction === 'growing'
                              ? 'optimal'
                              : p.trend_direction === 'declining'
                              ? 'critical'
                              : 'cyan'
                          }
                        >
                          {p.trend_direction.toUpperCase()}
                        </NeonBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 5: SCENARIO SIMULATOR */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls Panel */}
            <div className="p-6 rounded-2xl glass-panel border border-white/10 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  Scenario Parameters
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Adjust elasticity and operational assumptions to stress-test revenue.
                </p>
              </div>

              {/* Presets */}
              <div>
                <p className="text-xs text-slate-400 mb-2 font-mono uppercase">Quick Presets:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setScenarioVolumeChange(0);
                      setScenarioPriceChange(0);
                      setScenarioDemandShock(0);
                      setScenarioFulfillmentCap(false);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                  >
                    Base Case
                  </button>
                  <button
                    onClick={() => {
                      setScenarioVolumeChange(10);
                      setScenarioPriceChange(0);
                      setScenarioDemandShock(0);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  >
                    Volume +10%
                  </button>
                  <button
                    onClick={() => {
                      setScenarioVolumeChange(-15);
                      setScenarioPriceChange(0);
                      setScenarioDemandShock(0);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  >
                    Volume -15%
                  </button>
                  <button
                    onClick={() => {
                      setScenarioPriceChange(-5);
                      setScenarioVolumeChange(8);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  >
                    Price -5% (Promo)
                  </button>
                  <button
                    onClick={() => {
                      setScenarioFulfillmentCap(true);
                      setScenarioVolumeChange(25);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  >
                    Disruption Capped
                  </button>
                </div>
              </div>

              {/* Slider 1: Volume */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Sales Volume Adjustment:</span>
                  <span className={`font-mono font-semibold ${scenarioVolumeChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {scenarioVolumeChange > 0 ? '+' : ''}{scenarioVolumeChange}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="100"
                  step="5"
                  value={scenarioVolumeChange}
                  onChange={(e) => setScenarioVolumeChange(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Slider 2: Selling Price */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Selling Price Adjustment:</span>
                  <span className={`font-mono font-semibold ${scenarioPriceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {scenarioPriceChange > 0 ? '+' : ''}{scenarioPriceChange}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="50"
                  step="1"
                  value={scenarioPriceChange}
                  onChange={(e) => setScenarioPriceChange(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Slider 3: Demand Shock */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Market Demand Shock:</span>
                  <span className={`font-mono font-semibold ${scenarioDemandShock >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {scenarioDemandShock > 0 ? '+' : ''}{scenarioDemandShock}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="100"
                  step="5"
                  value={scenarioDemandShock}
                  onChange={(e) => setScenarioDemandShock(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              {/* Toggle: Inventory Constraints */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Cap by Real Warehouse Buffer</p>
                  <p className="text-[11px] text-slate-400">Limits revenue to on-hand + incoming stock</p>
                </div>
                <input
                  type="checkbox"
                  checked={scenarioFulfillmentCap}
                  onChange={(e) => setScenarioFulfillmentCap(e.target.checked)}
                  className="w-4 h-4 accent-blue-500 cursor-pointer"
                />
              </div>

              <Button
                variant="primary"
                onClick={runScenarioSimulation}
                disabled={isSimulating}
                className="w-full justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isSimulating ? 'Simulating...' : 'Recalculate Scenario'}
              </Button>
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-2 p-6 rounded-2xl glass-panel border border-white/10 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white">Scenario Projection Impact</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparison between baseline run rate and scenario simulated outcomes.
                </p>
              </div>

              {scenarioData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-slate-400">Baseline Revenue</p>
                      <p className="text-lg font-bold text-white mt-1">
                        ${scenarioData.baseline_projected_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {scenarioData.baseline_projected_units.toLocaleString()} units
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-slate-400">Scenario Revenue</p>
                      <p className="text-lg font-bold text-emerald-400 mt-1">
                        ${scenarioData.scenario_projected_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {scenarioData.fulfilled_units.toLocaleString()} units fulfilled
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-slate-400">Revenue Variance</p>
                      <p
                        className={`text-lg font-bold mt-1 ${
                          scenarioData.revenue_variance_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {scenarioData.revenue_variance_usd >= 0 ? '+' : ''}$
                        {scenarioData.revenue_variance_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {scenarioData.revenue_variance_pct > 0 ? '+' : ''}
                        {scenarioData.revenue_variance_pct}%
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-slate-400">Unmet Demand</p>
                      <p className="text-lg font-bold text-amber-400 mt-1">
                        {scenarioData.unmet_units.toLocaleString()} units
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {scenarioData.fulfillment_constrained ? 'Stockout restricted' : 'Unconstrained'}
                      </p>
                    </div>
                  </div>

                  {/* Formula Breakdown Card */}
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs font-semibold text-blue-300 font-mono uppercase mb-2">
                      Transparent Formula Breakdown:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                      {Object.entries(scenarioData.formula_breakdown).map(([k, v]) => (
                        <div key={k} className="flex flex-col">
                          <span className="text-slate-400 text-[10px] uppercase font-mono">{k.replace(/_/g, ' ')}:</span>
                          <span className="font-mono text-cyan-300">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Operational Notes / Bottlenecks */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-300">Operational Observations:</p>
                    {scenarioData.bottlenecks.map((b, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 6: SUPPLY CHAIN SYNC */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'integration' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-panel border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  Sales Demand vs Inventory Buffer & Inbound Replenishment
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Translates sales unit run-rates into warehouse buffer drawdown to identify imminent stockouts.
                </p>
              </div>
              <Button variant="secondary" onClick={fetchIntegration} className="gap-2 text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Sync
              </Button>
            </div>

            {integrationData?.items.length ? (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Product SKU</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-right">Available Stock</th>
                      <th className="p-3 text-right">Inbound Units</th>
                      <th className="p-3 text-right">30d Demand</th>
                      <th className="p-3 text-center">Days to Stockout</th>
                      <th className="p-3">Mapping Status</th>
                      <th className="p-3">Procurement Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-slate-900/40">
                    {integrationData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="p-3 font-mono font-semibold text-cyan-400">{item.sales_product_id}</td>
                        <td className="p-3 text-white font-medium">{item.product_name}</td>
                        <td className="p-3 text-right font-medium">{item.available_stock_units.toLocaleString()}</td>
                        <td className="p-3 text-right text-slate-400">{item.incoming_shipment_units.toLocaleString()}</td>
                        <td className="p-3 text-right text-emerald-400 font-semibold">
                          {item.forecast_demand_units_30d.toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          {item.days_to_stockout !== null && item.days_to_stockout !== undefined ? (
                            <span
                              className={`font-semibold ${
                                item.days_to_stockout <= 15 ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {item.days_to_stockout} days
                            </span>
                          ) : (
                            <span className="text-slate-500">Buffer Ok</span>
                          )}
                        </td>
                        <td className="p-3">
                          <NeonBadge
                            variant={item.component_mapping_status.includes('Direct') ? 'optimal' : 'cyan'}
                          >
                            {item.component_mapping_status}
                          </NeonBadge>
                        </td>
                        <td className="p-3 text-slate-300 max-w-xs">{item.recommended_action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center italic">
                No inventory integration data available.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 7: TRANSACTION LEDGER */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-panel border border-white/10">
            {/* Table Search & Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search transaction, SKU, or region..."
                  value={txSearch}
                  onChange={(e) => {
                    setTxSearch(e.target.value);
                    setTxPage(1);
                    fetchTransactions(1, e.target.value);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={() => setIsImportModalOpen(true)} className="gap-2 text-xs">
                  <UploadCloud className="w-3.5 h-3.5" />
                  Import CSV
                </Button>
              </div>
            </div>

            {/* Table */}
            {transactionsData?.items.length ? (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">TX ID</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Discount</th>
                      <th className="p-3 text-right">Net Rev</th>
                      <th className="p-3">Region</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-slate-900/40">
                    {transactionsData.items.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5">
                        <td className="p-3 font-mono font-semibold text-cyan-400">{tx.transaction_id}</td>
                        <td className="p-3">{tx.transaction_date.slice(0, 10)}</td>
                        <td className="p-3 font-medium text-white">{tx.product_id}</td>
                        <td className="p-3 truncate max-w-[140px]">{tx.product_name}</td>
                        <td className="p-3 text-right">{tx.quantity_sold}</td>
                        <td className="p-3 text-right">${tx.unit_selling_price.toFixed(2)}</td>
                        <td className="p-3 text-right text-slate-400">${tx.discount_amount.toFixed(2)}</td>
                        <td className="p-3 text-right font-semibold text-emerald-400">
                          ${tx.net_revenue.toFixed(2)}
                        </td>
                        <td className="p-3">{tx.region}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
                            title="Delete Transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center italic">
                No transactions found matching the filter criteria.
              </p>
            )}

            {/* Pagination */}
            {transactionsData && transactionsData.total_pages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-400">
                <span>
                  Showing page {transactionsData.page} of {transactionsData.total_pages} ({transactionsData.total} total)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={txPage <= 1}
                    onClick={() => {
                      setTxPage(txPage - 1);
                      fetchTransactions(txPage - 1, txSearch);
                    }}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={txPage >= transactionsData.total_pages}
                    onClick={() => {
                      setTxPage(txPage + 1);
                      fetchTransactions(txPage + 1, txSearch);
                    }}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-40"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sales Import Modal */}
      <SalesImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setIsImportModalOpen(false);
          fetchOverviewAndHistorical();
          if (activeTab === 'transactions') {
            fetchTransactions(1, txSearch);
          }
        }}
      />
    </div>
  );
};
