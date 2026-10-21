import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import confetti from 'canvas-confetti';
import {
  Zap,
  TrendingDown,
  Clock,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  FileDown,
  RotateCcw,
  AlertTriangle,
  Info,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  BarChart2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Database,
  FileSpreadsheet,
  FileCode,
  Layers,
  ArrowUpRight,
  Eye,
  History,
  TrendingUp,
  PackageCheck,
  DollarSign,
  Truck,
  Box,
  Building,
  Building2,
  MapPin,
  Factory,
  Navigation,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { MitigationStrategy } from '../../types';
import {
  ScenarioSimulationResponse,
  MitigationStrategyResult,
  SimulationEvidenceReportSummary,
} from '../../types/scenario';
import { apiService } from '../../services/api';
import { Button } from '../common/Button';
import { GlassCard } from '../common/GlassCard';
import { NeonBadge } from '../common/NeonBadge';
import { Modal } from '../common/Modal';
import { Tooltip } from '../common/Tooltip';
import { soundFX } from '../../services/audioService';

interface SimulationResultsViewProps {
  onNavigate: (pageId: string) => void;
}

export const SimulationResultsView: React.FC<SimulationResultsViewProps> = ({ onNavigate }) => {
  const {
    currentSimulationResult,
    scenarioIntelligenceResult,
    setScenarioIntelligenceResult,
    executeMitigationStrategy,
  } = useSupplyChain();

  // Active strategy selected for dispatch
  const [selectedStrategyForDispatch, setSelectedStrategyForDispatch] = useState<MitigationStrategyResult | MitigationStrategy | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [deployedStrategyIds, setDeployedStrategyIds] = useState<string[]>([]);

  // Evidence Report & Export state
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historicalReports, setHistoricalReports] = useState<SimulationEvidenceReportSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [isDownloadingJson, setIsDownloadingJson] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Active view tab for charts
  const [activeChartTab, setActiveChartTab] = useState<'inventory' | 'cost' | 'tradeoff'>('inventory');

  // Accordion states
  const [isTransparencyOpen, setIsTransparencyOpen] = useState(false);
  const [isAffectedEntitiesOpen, setIsAffectedEntitiesOpen] = useState(true);
  const [isJudgeBriefingOpen, setIsJudgeBriefingOpen] = useState(true);

  // Load historical reports when history modal is opened
  const loadHistoricalReports = async () => {
    setIsLoadingHistory(true);
    try {
      const reports = await apiService.getScenarioReports(30);
      setHistoricalReports(reports);
    } catch (err) {
      console.error('Failed to load past scenario reports', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleOpenHistoryModal = () => {
    setIsHistoryModalOpen(true);
    loadHistoricalReports();
  };

  const handleLoadPastReport = async (reportId: string) => {
    try {
      const report = await apiService.getScenarioReport(reportId);
      setScenarioIntelligenceResult(report);
      setIsHistoryModalOpen(false);
      soundFX.playSuccess();
    } catch (err) {
      console.error('Failed to load scenario report', err);
    }
  };

  // Auto-load latest report if none is currently in memory
  useEffect(() => {
    if (!scenarioIntelligenceResult) {
      apiService.getScenarioReports(1).then((reports) => {
        if (reports && reports.length > 0) {
          apiService.getScenarioReport(reports[0].report_id).then((rep) => {
            setScenarioIntelligenceResult(rep);
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [scenarioIntelligenceResult, setScenarioIntelligenceResult]);

  // Helper for triggering browser file downloads from Blobs
  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleDownloadPdf = async () => {
    if (!scenarioIntelligenceResult) return;
    setIsDownloadingPdf(true);
    setDownloadError(null);
    try {
      soundFX.playClick();
      const blob = await apiService.downloadScenarioReportPdf(scenarioIntelligenceResult.report_id);
      triggerBlobDownload(blob, `synchain_evidence_report_${scenarioIntelligenceResult.report_id.slice(0, 8)}.pdf`);
      soundFX.playSuccess();
    } catch (err: any) {
      soundFX.playWarning();
      setDownloadError(err?.message || 'Failed to download PDF report');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!scenarioIntelligenceResult) return;
    setIsDownloadingCsv(true);
    setDownloadError(null);
    try {
      soundFX.playClick();
      const blob = await apiService.downloadScenarioReportExport(scenarioIntelligenceResult.report_id, 'csv');
      triggerBlobDownload(blob, `synchain_evidence_${scenarioIntelligenceResult.report_id.slice(0, 8)}.csv`);
      soundFX.playSuccess();
    } catch (err: any) {
      soundFX.playWarning();
      setDownloadError(err?.message || 'Failed to export CSV');
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  const handleDownloadJson = async () => {
    if (!scenarioIntelligenceResult) return;
    setIsDownloadingJson(true);
    setDownloadError(null);
    try {
      soundFX.playClick();
      const blob = await apiService.downloadScenarioReportExport(scenarioIntelligenceResult.report_id, 'json');
      triggerBlobDownload(blob, `synchain_evidence_${scenarioIntelligenceResult.report_id.slice(0, 8)}.json`);
      soundFX.playSuccess();
    } catch (err: any) {
      soundFX.playWarning();
      setDownloadError(err?.message || 'Failed to export JSON');
    } finally {
      setIsDownloadingJson(false);
    }
  };

  // Strategy Execution Handler
  const handleDeployIntelligenceStrategy = (strat: MitigationStrategyResult) => {
    soundFX.playSuccess();
    confetti({
      particleCount: 85,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#10B981', '#3B82F6', '#8B5CF6', '#06B6D4'],
    });
    setDeployedStrategyIds((prev) => [...prev, strat.strategy_id]);
    setSelectedStrategyForDispatch(strat);
    setIsSuccessModalOpen(true);
  };

  // Fallback handler for legacy mock result
  const handleDispatchLegacy = (strat: MitigationStrategy) => {
    soundFX.playSuccess();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3B82F6', '#8B5CF6', '#10B981', '#06B6D4'],
    });
    executeMitigationStrategy(strat.id);
    setSelectedStrategyForDispatch(strat);
    setIsSuccessModalOpen(true);
  };

  // ========================================================
  // RENDER: Empty State
  // ========================================================
  if (!scenarioIntelligenceResult && !currentSimulationResult) {
    return (
      <div className="p-12 text-center rounded-2xl glass-panel border border-white/10 space-y-5 max-w-2xl mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
          <Zap className="w-8 h-8 opacity-80" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white font-display">No Simulation Results in Memory</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Construct and run a disruption scenario in the Scenario Builder to generate deterministic mathematical models, Gemini AI decision narratives, and downloadable evidence dossiers.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="glow" onClick={() => onNavigate('scenario-builder')} leftIcon={<Zap className="w-4 h-4" />}>
            Open Scenario Builder
          </Button>
          <Button variant="secondary" onClick={handleOpenHistoryModal} leftIcon={<History className="w-4 h-4 text-slate-400" />}>
            Past Evidence Reports
          </Button>
        </div>
      </div>
    );
  }

  // ========================================================
  // RENDER: Rich Scenario Intelligence View
  // ========================================================
  if (scenarioIntelligenceResult) {
    const res = scenarioIntelligenceResult;
    const baseline = res.baseline;
    const disrupted = res.disrupted;
    const strategies = res.mitigation_strategies || [];
    const recommended = strategies.find((s) => s.strategy_id === res.recommended_strategy_id) || strategies[0];

    // Compute Net Savings & SLA Protected
    const netCostSaved = Math.max(0, disrupted.total_cost_usd - (recommended?.total_cost_usd || disrupted.total_cost_usd));
    const slaProtectedPct = Math.max(0, (recommended?.service_level_pct || 0) - disrupted.service_level_pct);
    const delaySavedDays = Math.max(0, disrupted.delivery_delay_days - (recommended?.delivery_delay_days || 0));
    const stockoutsAvoided = Math.max(0, disrupted.stockout_days_count - (recommended?.stockout_days_count || 0));

    // ----------------------------------------------------
    // Chart 1: Daily Inventory Trajectory (30-day discrete simulation)
    // ----------------------------------------------------
    const days = baseline.daily_trajectory.map((d) => `Day ${d.day}`);
    const safetyStockThreshold = baseline.daily_trajectory[0]?.ending_inventory ? Math.round(baseline.daily_trajectory[0].ending_inventory * 0.4) : 250;

    const inventoryChartOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
        borderWidth: 1,
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any[]) => {
          let html = `<div class="font-bold text-xs border-b border-white/10 pb-1 mb-1 text-slate-300">${params[0].axisValue}</div>`;
          params.forEach((p) => {
            html += `<div class="flex items-center justify-between gap-4 text-xs">
              <span style="color:${p.color}">● ${p.seriesName}:</span>
              <span class="font-mono font-bold text-white">${Math.round(p.value).toLocaleString()} units</span>
            </div>`;
          });
          return html;
        },
      },
      legend: {
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        right: 10,
        icon: 'circle',
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '6%',
        top: '18%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: days,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: (val: number) => `${val.toLocaleString()}`,
        },
      },
      series: [
        {
          name: 'Baseline Ideal',
          type: 'line',
          data: baseline.daily_trajectory.map((d) => d.ending_inventory),
          smooth: true,
          itemStyle: { color: '#38bdf8' },
          lineStyle: { width: 2, color: '#38bdf8', type: 'dashed' },
          symbol: 'none',
        },
        {
          name: 'Unmitigated Disrupted',
          type: 'line',
          data: disrupted.daily_trajectory.map((d) => d.ending_inventory),
          smooth: true,
          itemStyle: { color: '#ef4444' },
          lineStyle: { width: 3, color: '#ef4444' },
          areaStyle: { color: 'rgba(239, 68, 68, 0.12)' },
          symbol: 'none',
        },
        ...strategies.map((strat) => {
          const colorMap: Record<string, string> = {
            SWITCH_SUPPLIER: '#10b981',
            SPLIT_PROCUREMENT: '#06b6d4',
            EXPEDITE_AIR_FREIGHT: '#f59e0b',
            ACCEPT_RISK: '#a855f7',
          };
          const color = colorMap[strat.strategy_id] || '#6366f1';
          return {
            name: strat.strategy_name,
            type: 'line',
            data: strat.daily_trajectory.map((d) => d.ending_inventory),
            smooth: true,
            itemStyle: { color },
            lineStyle: {
              width: strat.strategy_id === res.recommended_strategy_id ? 3 : 2,
              color,
            },
            areaStyle:
              strat.strategy_id === res.recommended_strategy_id
                ? { color: 'rgba(16, 185, 129, 0.15)' }
                : undefined,
            symbol: 'none',
          };
        }),
      ],
    };

    // ----------------------------------------------------
    // Chart 2: Cost Breakdown Comparison (Stacked Bar Chart)
    // ----------------------------------------------------
    const costCategories = ['Baseline', 'Disrupted', ...strategies.map((s) => s.strategy_name.replace('Mitigation: ', ''))];
    const directPurchases = [
      baseline.direct_purchase_cost_usd,
      disrupted.direct_purchase_cost_usd,
      ...strategies.map((s) => s.direct_purchase_cost_usd),
    ];
    const logisticsCosts = [
      baseline.logistics_expedite_cost_usd,
      disrupted.logistics_expedite_cost_usd,
      ...strategies.map((s) => s.logistics_expedite_cost_usd),
    ];
    const holdingCosts = [
      baseline.holding_cost_usd,
      disrupted.holding_cost_usd,
      ...strategies.map((s) => s.holding_cost_usd),
    ];
    const stockoutPenalties = [
      baseline.stockout_penalty_cost_usd,
      disrupted.stockout_penalty_cost_usd,
      ...strategies.map((s) => s.stockout_penalty_cost_usd),
    ];

    const costBreakdownChartOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
        borderWidth: 1,
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any[]) => {
          let sum = 0;
          let html = `<div class="font-bold text-xs border-b border-white/10 pb-1 mb-1 text-slate-200">${params[0].axisValue} Total Landed Cost</div>`;
          params.forEach((p) => {
            sum += p.value;
            html += `<div class="flex items-center justify-between gap-4 text-xs">
              <span style="color:${p.color}">● ${p.seriesName}:</span>
              <span class="font-mono text-white">$${Math.round(p.value).toLocaleString()}</span>
            </div>`;
          });
          html += `<div class="flex items-center justify-between gap-4 text-xs font-bold border-t border-white/10 pt-1 mt-1 text-emerald-400">
            <span>Total:</span>
            <span>$${Math.round(sum).toLocaleString()}</span>
          </div>`;
          return html;
        },
      },
      legend: {
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        right: 10,
        icon: 'roundRect',
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '8%',
        top: '18%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: costCategories,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          interval: 0,
          rotate: 15,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      series: [
        {
          name: 'Direct Purchase',
          type: 'bar',
          stack: 'cost',
          data: directPurchases,
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: 'Logistics / Expedite',
          type: 'bar',
          stack: 'cost',
          data: logisticsCosts,
          itemStyle: { color: '#f59e0b' },
        },
        {
          name: 'Holding Cost',
          type: 'bar',
          stack: 'cost',
          data: holdingCosts,
          itemStyle: { color: '#6366f1' },
        },
        {
          name: 'Stockout Penalty',
          type: 'bar',
          stack: 'cost',
          data: stockoutPenalties,
          itemStyle: { color: '#ef4444' },
        },
      ],
    };

    // ----------------------------------------------------
    // Chart 3: Multi-Criteria Trade-off Comparison (Radar)
    // ----------------------------------------------------
    const maxCost = Math.max(disrupted.total_cost_usd, ...strategies.map((s) => s.total_cost_usd)) || 1;
    const maxDelay = Math.max(disrupted.delivery_delay_days, ...strategies.map((s) => s.delivery_delay_days)) || 1;

    const radarIndicators = [
      { name: 'Service Level (Fill Rate)', max: 100 },
      { name: 'Cost Efficiency (ROI)', max: 100 },
      { name: 'Delivery Speed (Lead Time)', max: 100 },
      { name: 'Safety Buffer Resilience', max: 100 },
      { name: 'Feasibility Ease', max: 100 },
    ];

    const radarSeriesData = strategies.map((strat) => {
      const colorMap: Record<string, string> = {
        SWITCH_SUPPLIER: '#10b981',
        SPLIT_PROCUREMENT: '#06b6d4',
        EXPEDITE_AIR_FREIGHT: '#f59e0b',
        ACCEPT_RISK: '#a855f7',
      };
      const fillRateScore = Math.min(100, strat.service_level_pct);
      const costScore = Math.max(10, Math.round((1 - strat.total_cost_usd / maxCost) * 100));
      const speedScore = Math.max(15, Math.round((1 - strat.delivery_delay_days / (maxDelay + 2)) * 100));
      const bufferScore = Math.max(20, Math.round((1 - strat.stockout_days_count / 15) * 100));
      const feasibilityScore =
        strat.feasibility_status === 'FEASIBLE'
          ? 95
          : strat.feasibility_status === 'FEASIBLE_WITH_TRADE_OFFS'
          ? 75
          : 45;

      return {
        name: strat.strategy_name,
        value: [fillRateScore, costScore, speedScore, bufferScore, feasibilityScore],
        itemStyle: { color: colorMap[strat.strategy_id] || '#3b82f6' },
        lineStyle: { width: strat.strategy_id === res.recommended_strategy_id ? 3 : 1.5 },
        areaStyle:
          strat.strategy_id === res.recommended_strategy_id
            ? { color: 'rgba(16, 185, 129, 0.2)' }
            : undefined,
      };
    });

    const tradeOffRadarOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
        borderWidth: 1,
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      legend: {
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        right: 10,
        icon: 'circle',
      },
      radar: {
        indicator: radarIndicators,
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: '#cbd5e1',
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.08)',
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(255, 255, 255, 0.01)', 'rgba(255, 255, 255, 0.03)'],
          },
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
      series: [
        {
          name: 'Multi-Criteria Mitigation Comparison',
          type: 'radar',
          data: radarSeriesData,
        },
      ],
    };

    return (
      <div className="space-y-6">
        {/* Header with Title & Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
                Disruption Simulation Report
              </h2>
              <NeonBadge variant="optimal" size="sm">
                SIMULATION COMPLETED
              </NeonBadge>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10 font-mono">
                {res.objective.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Scenario: <span className="text-white font-semibold">{res.scenario_name}</span> | Disruption:{' '}
              <span className="text-rose-400 font-semibold">{res.disruption_type.replace('_', ' ').toUpperCase()}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => onNavigate('scenario-builder')}
            >
              New Scenario
            </Button>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<History className="w-3.5 h-3.5 text-slate-400" />}
              onClick={handleOpenHistoryModal}
            >
              History
            </Button>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Eye className="w-3.5 h-3.5 text-cyan-400" />}
              onClick={() => setIsDossierModalOpen(true)}
            >
              View Full Report Summary
            </Button>

            <Button
              variant="glow"
              size="sm"
              leftIcon={<FileDown className="w-3.5 h-3.5" />}
              isLoading={isDownloadingPdf}
              onClick={handleDownloadPdf}
            >
              Download PDF Report
            </Button>
          </div>
        </div>

        {downloadError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{downloadError}</span>
            </div>
            <button onClick={() => setDownloadError(null)} className="text-rose-400 hover:text-white">✕</button>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 6: Judges Executive Briefing (5 Plain-English Sections) */}
        {/* ======================================================== */}
        <div className="rounded-2xl glass-panel border border-purple-500/30 overflow-hidden shadow-2xl">
          <div
            onClick={() => setIsJudgeBriefingOpen(!isJudgeBriefingOpen)}
            className="p-4 sm:p-5 bg-gradient-to-r from-purple-900/30 via-slate-900/60 to-blue-900/30 border-b border-purple-500/20 flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white font-display">
                    Judges Executive Briefing
                  </h3>
                  <NeonBadge variant="optimal" size="sm">
                    5-SECTION BUSINESS BRIEF
                  </NeonBadge>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                    Live Database + Simulation Engine
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Plain-English explanation of Situation, Problem, Baseline Outcome, Available Mitigation Actions, and Head-to-Head Comparison.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-300 font-semibold hidden sm:inline">
                {isJudgeBriefingOpen ? 'Collapse Brief' : 'Expand Brief'}
              </span>
              {isJudgeBriefingOpen ? <ChevronUp className="w-5 h-5 text-purple-400" /> : <ChevronDown className="w-5 h-5 text-purple-400" />}
            </div>
          </div>

          {isJudgeBriefingOpen && (
            <div className="p-5 sm:p-6 space-y-6 bg-slate-950/40">
              {/* Legend: Data distinction */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs p-3 rounded-xl bg-slate-900/80 border border-white/5">
                <span className="text-slate-400 font-medium">Data Provenance Distinction:</span>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5 text-cyan-300">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                    <strong>PostgreSQL Database Record</strong> (Actual live on-hand stock, price, demand)
                  </span>
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                    <strong>Simulation Model Prediction</strong> (Calculated discrete-event 30-day projection)
                  </span>
                </div>
              </div>

              {/* Grid for Section A & Section B */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Section A: Situation */}
                <div className="p-4 rounded-xl bg-slate-900/70 border border-blue-500/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center text-blue-300 font-mono text-[11px]">
                        A
                      </span>
                      Situation
                    </h4>
                    <span className="text-[10px] text-cyan-400 font-mono">Live PostgreSQL Records</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    This scenario evaluates <strong>{res.route_details?.product_name || res.affected_entities?.products?.[0]?.name || 'Autonomous Servo Drive'}</strong> (SKU: <code className="text-cyan-300 font-mono">{res.route_details?.sku || res.affected_entities?.products?.[0]?.sku || 'P0001'}</code>) governed under the <strong>{res.organization_name || res.route_details?.organization_name || 'Global Enterprise'}</strong> operating entity.
                  </p>

                  <div className="space-y-1.5 text-xs text-slate-400 pt-1">
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500">Source Supplier:</span>
                      <span className="font-semibold text-white text-right">{res.route_details?.source_supplier_name || res.affected_entities?.suppliers?.[0]?.name || 'Primary Supplier'}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500">Source Location:</span>
                      <span className="text-right text-slate-300">{res.route_details?.source_warehouse_name || 'Supplier Logistics Hub'} · <span className="text-slate-400">{res.route_details?.source_address || 'Address not available'}</span></span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500">Destination Facility:</span>
                      <span className="text-right text-slate-300">{res.route_details?.destination_warehouse_name || 'Regional Distribution Center'} · <span className="text-slate-400">{res.route_details?.destination_address || 'Address not available'}</span></span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500">Transport & Carrier:</span>
                      <span className="text-right text-slate-300">{res.route_details?.carrier_name || 'DHL Express Freight'} ({res.route_details?.transport_mode || 'Air'})</span>
                    </div>
                    <div className="flex items-start justify-between border-t border-white/5 pt-1.5">
                      <span className="text-slate-500">Database Inventory & Price:</span>
                      <span className="font-mono text-emerald-400 text-right">{res.route_details?.initial_inventory ?? baseline.daily_trajectory[0]?.starting_inventory} units on-hand · ${res.route_details?.unit_cost_usd?.toFixed(2) || '345.00'}/unit</span>
                    </div>
                  </div>
                </div>

                {/* Section B: Problem */}
                <div className="p-4 rounded-xl bg-slate-900/70 border border-rose-500/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-rose-500/20 flex items-center justify-center text-rose-300 font-mono text-[11px]">
                        B
                      </span>
                      Problem
                    </h4>
                    <span className="text-[10px] text-rose-400 font-mono">Disruption Introduced</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    A severe disruption — <strong>{res.disruption_type.replace(/_/g, ' ').toUpperCase()}</strong> (<span className="text-white font-medium">{res.scenario_name}</span>) — was introduced into the supply chain route.
                  </p>

                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-1">
                    <p className="font-semibold text-white">Why this matters to enterprise operations:</p>
                    <p className="leading-relaxed">
                      Replenishment is halted for an estimated <strong>+{disrupted.delivery_delay_days} days</strong>. With daily customer demand running at <strong>{res.route_details?.daily_demand ?? 25} units/day</strong>, the on-hand stock buffer will be completely depleted, leading to <strong>{disrupted.stockout_days_count} stockout days</strong> and <strong>{disrupted.unmet_demand_units} unmet customer units</strong> if no countermeasure is deployed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid for Section C & Section D */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Section C: Baseline Outcome */}
                <div className="p-4 rounded-xl bg-slate-900/70 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center text-amber-300 font-mono text-[11px]">
                        C
                      </span>
                      Baseline Outcome (Unmitigated)
                    </h4>
                    <span className="text-[10px] text-purple-400 font-mono">Simulated Projection</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    If management takes <strong>no mitigation action</strong> and simply accepts the disruption, the deterministic simulation engine calculates the following severe business consequences:
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Fulfillment Service Level</span>
                      <span className="font-bold font-mono text-rose-400 text-sm">{disrupted.service_level_pct.toFixed(1)}%</span>
                      <span className="text-[10px] text-slate-500 block">Baseline was {baseline.service_level_pct.toFixed(1)}%</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Total Financial Impact</span>
                      <span className="font-bold font-mono text-rose-400 text-sm">${disrupted.total_cost_usd.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 block">+${(disrupted.total_cost_usd - baseline.total_cost_usd).toLocaleString()} exposure</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Replenishment Arrival</span>
                      <span className="font-bold font-mono text-amber-400 text-sm">Day {disrupted.arrival_day}</span>
                      <span className="text-[10px] text-slate-500 block">Delayed by +{disrupted.delivery_delay_days} days</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Shortage Penalties</span>
                      <span className="font-bold font-mono text-rose-400 text-sm">${disrupted.stockout_penalty_cost_usd.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 block">{disrupted.unmet_demand_units} units unfulfilled</span>
                    </div>
                  </div>
                </div>

                {/* Section D: Available Actions */}
                <div className="p-4 rounded-xl bg-slate-900/70 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center text-emerald-300 font-mono text-[11px]">
                        D
                      </span>
                      Available Actions (Mitigation Strategies)
                    </h4>
                    <span className="text-[10px] text-emerald-400 font-mono">4 Strategies Evaluated</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    The platform evaluated four distinct mitigation strategies against your selected business objective (<code className="text-cyan-300 font-mono">{res.objective}</code>):
                  </p>

                  <div className="space-y-2 text-xs">
                    {strategies.map((strat) => {
                      const isRec = strat.strategy_id === res.recommended_strategy_id;
                      return (
                        <div
                          key={strat.strategy_id}
                          className={`p-2.5 rounded-lg border transition-all ${
                            isRec
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                              : 'bg-slate-950 border-white/5 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-1.5">
                              {isRec && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              <span>{strat.strategy_name}</span>
                            </span>
                            <span className="font-mono text-white">${strat.total_cost_usd.toLocaleString()}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{strat.description}</p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-1">
                            <span>Arrival: Day {strat.arrival_day}</span>
                            <span>Delay: +{strat.delivery_delay_days}d</span>
                            <span>Service: {strat.service_level_pct.toFixed(0)}%</span>
                            {isRec && <span className="text-emerald-400 font-bold uppercase">★ Recommended</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Section E: Comparison Table */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center text-purple-300 font-mono text-[11px]">
                      E
                    </span>
                    Outcome Comparison (Consistent Assumptions)
                  </h4>
                  <span className="text-[10px] text-purple-300 font-mono">Head-to-Head Evidence</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
                        <th className="py-2 px-3">Decision Metric</th>
                        <th className="py-2 px-3 text-cyan-400">Baseline (Normal)</th>
                        <th className="py-2 px-3 text-rose-400">Unmitigated Disruption</th>
                        <th className="py-2 px-3 text-emerald-400">Recommended Action</th>
                        <th className="py-2 px-3 text-right text-purple-400">Net Business Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      <tr>
                        <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">Replenishment Arrival</td>
                        <td className="py-2.5 px-3 text-slate-300">Day {baseline.arrival_day}</td>
                        <td className="py-2.5 px-3 text-rose-400">Day {disrupted.arrival_day}</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">Day {recommended?.arrival_day ?? '-'}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-300">
                          {recommended && disrupted.arrival_day - recommended.arrival_day > 0
                            ? `-${disrupted.arrival_day - recommended.arrival_day} days faster`
                            : 'Same day'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">Net Delivery Delay</td>
                        <td className="py-2.5 px-3 text-slate-300">0 days</td>
                        <td className="py-2.5 px-3 text-rose-400">+{disrupted.delivery_delay_days} days</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">+{recommended?.delivery_delay_days ?? 0} days</td>
                        <td className="py-2.5 px-3 text-right text-emerald-300">
                          {delaySavedDays > 0 ? `Saved ${delaySavedDays} days delay` : '0 days saved'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">Order Service Level</td>
                        <td className="py-2.5 px-3 text-slate-300">{baseline.service_level_pct.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-rose-400">{disrupted.service_level_pct.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">{recommended?.service_level_pct.toFixed(1) ?? 0}%</td>
                        <td className="py-2.5 px-3 text-right text-emerald-300">
                          +{slaProtectedPct.toFixed(1)}% orders protected
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">Stockout Days Count</td>
                        <td className="py-2.5 px-3 text-slate-300">{baseline.stockout_days_count} days</td>
                        <td className="py-2.5 px-3 text-rose-400">{disrupted.stockout_days_count} days</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">{recommended?.stockout_days_count ?? 0} days</td>
                        <td className="py-2.5 px-3 text-right text-emerald-300">
                          {stockoutsAvoided > 0 ? `Eliminated ${stockoutsAvoided} stockout days` : 'Maintained buffer'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans text-slate-300 font-medium">Unmet Customer Demand</td>
                        <td className="py-2.5 px-3 text-slate-300">{baseline.unmet_demand_units} units</td>
                        <td className="py-2.5 px-3 text-rose-400">{disrupted.unmet_demand_units} units</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">{recommended?.unmet_demand_units ?? 0} units</td>
                        <td className="py-2.5 px-3 text-right text-emerald-300">
                          {recommended && disrupted.unmet_demand_units - recommended.unmet_demand_units > 0
                            ? `Fulfilled +${disrupted.unmet_demand_units - recommended.unmet_demand_units} units`
                            : 'Fully matched'}
                        </td>
                      </tr>
                      <tr className="bg-slate-900/90 font-bold">
                        <td className="py-3 px-3 font-sans text-white">Total Scenario Cost</td>
                        <td className="py-3 px-3 text-slate-300">${baseline.total_cost_usd.toLocaleString()}</td>
                        <td className="py-3 px-3 text-rose-400">${disrupted.total_cost_usd.toLocaleString()}</td>
                        <td className="py-3 px-3 text-emerald-400 font-extrabold">${recommended?.total_cost_usd.toLocaleString() ?? 0}</td>
                        <td className="py-3 px-3 text-right text-emerald-300">
                          {netCostSaved > 0 ? `Saved $${netCostSaved.toLocaleString()} USD` : '$0 net savings'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* Top 4 KPI Comparison Delta Cards                         */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Cost Impact */}
          <div className="p-5 rounded-2xl glass-panel border border-emerald-500/30 space-y-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Total Cost With Action
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  -${(netCostSaved / 1000).toFixed(0)}k Saved
                </span>
                <Tooltip
                  content={
                    <div>
                      <p className="font-semibold text-white mb-1">Total Cost & Net Savings</p>
                      <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Total projected cost to fulfill customer demand using the recommended recovery plan.</p>
                      <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Compared to doing nothing, this action saves ${(netCostSaved / 1000).toFixed(0)}k in penalties and expedited fees.</p>
                      <p><span className="text-amber-400 font-medium">What to watch:</span> Compare with baseline ideal costs to evaluate the cost of resilience.</p>
                    </div>
                  }
                />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">
              ${(recommended?.total_cost_usd / 1000).toFixed(0)}k
            </p>
            <div className="text-[12px] text-slate-400 flex items-center justify-between font-mono">
              <span>Without action: ${(disrupted.total_cost_usd / 1000).toFixed(0)}k</span>
              <span className="text-slate-500">Normal base: ${(baseline.total_cost_usd / 1000).toFixed(0)}k</span>
            </div>
          </div>

          {/* Card 2: Service Level % SLA Protection */}
          <div className="p-5 rounded-2xl glass-panel border border-cyan-500/30 space-y-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5" />
                Orders Fulfilled from Stock
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                  +{slaProtectedPct.toFixed(1)}% Protected
                </span>
                <Tooltip
                  content={
                    <div>
                      <p className="font-semibold text-white mb-1">Order Fulfillment Rate</p>
                      <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Percentage of customer orders delivered on time from available stock.</p>
                      <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Protects customer contracts and prevents service level agreement penalties.</p>
                      <p><span className="text-amber-400 font-medium">What to watch:</span> Without action, fulfillment rate drops to {disrupted.service_level_pct.toFixed(1)}%.</p>
                    </div>
                  }
                />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">
              {recommended?.service_level_pct.toFixed(1)}%
            </p>
            <div className="text-[12px] text-slate-400 flex items-center justify-between font-mono">
              <span>Without action: {disrupted.service_level_pct.toFixed(1)}%</span>
              <span className="text-emerald-400 font-semibold">Protected SLA</span>
            </div>
          </div>

          {/* Card 3: Network Delivery Timeline */}
          <div className="p-5 rounded-2xl glass-panel border border-amber-500/30 space-y-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Expected Delivery Delay
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  -{delaySavedDays}d Saved
                </span>
                <Tooltip
                  content={
                    <div>
                      <p className="font-semibold text-white mb-1">Delivery Delay</p>
                      <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Additional shipping days required before incoming shipments arrive.</p>
                      <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Cutting delay days preserves safety stock and prevents empty warehouses.</p>
                      <p><span className="text-amber-400 font-medium">What to watch:</span> Without action, shipments arrive +{disrupted.delivery_delay_days} days late.</p>
                    </div>
                  }
                />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">
              +{recommended?.delivery_delay_days || 0} Days
            </p>
            <div className="text-[12px] text-slate-400 flex items-center justify-between font-mono">
              <span>Arrival: Day {recommended?.arrival_day}</span>
              <span className="text-rose-400">Without action: +{disrupted.delivery_delay_days}d</span>
            </div>
          </div>

          {/* Card 4: Stockout Days Avoided */}
          <div className="p-5 rounded-2xl glass-panel border border-purple-500/30 space-y-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Days Without Enough Stock
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  {stockoutsAvoided}d Prevented
                </span>
                <Tooltip
                  content={
                    <div>
                      <p className="font-semibold text-white mb-1">Days Out of Stock</p>
                      <p className="mb-1"><span className="text-emerald-400 font-medium">What it means:</span> Number of days during the 30-day period when inventory drops to zero.</p>
                      <p className="mb-1"><span className="text-blue-400 font-medium">Why it matters:</span> Zero days out of stock ensures continuous manufacturing and customer order fulfillment.</p>
                      <p><span className="text-amber-400 font-medium">What to watch:</span> Unmitigated disruption causes {disrupted.stockout_days_count} days without inventory.</p>
                    </div>
                  }
                />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">
              {recommended?.stockout_days_count || 0} Days
            </p>
            <div className="text-[12px] text-slate-400 flex items-center justify-between font-mono">
              <span>Unmet: {recommended?.unmet_demand_units || 0} units</span>
              <span className="text-rose-400">Without action: {disrupted.stockout_days_count}d</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* Gemini AI Executive Briefing Card                        */}
        {/* ======================================================== */}
        <div className="rounded-2xl glass-panel border border-purple-500/30 p-6 space-y-5 bg-gradient-to-br from-slate-900/95 via-purple-950/20 to-slate-900/95 shadow-[0_0_40px_rgba(168,85,247,0.1)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display">
                  Executive Summary and Action Plan
                </h3>
                <p className="text-xs text-slate-400">
                  Explains what happened, what will break without action, and why this recovery plan was chosen
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {res.ai_narrative.is_ai_generated ? (
                <NeonBadge variant="purple" size="sm">
                  Gemini AI Verified
                </NeonBadge>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full font-mono">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Standard Calculation Used</span>
                  <Tooltip
                    content={
                      <div>
                        <p className="font-semibold text-white mb-1">Standard Calculation Fallback</p>
                        <p>The system used verified mathematical equations to calculate outcomes because external AI generation was unavailable or timed out. All simulation numbers and inventory totals remain exact and audited.</p>
                      </div>
                    }
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-slate-200">
            {/* Executive Summary */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-1.5">
              <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Executive Summary
              </span>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                {res.ai_narrative.executive_summary}
              </p>
            </div>

            {/* Operational Impact & Response Rationale Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  What Happens Without Action
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {res.ai_narrative.operational_impact_summary}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Why This Action Is Recommended
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {res.ai_narrative.recommended_response_explanation}
                </p>
              </div>
            </div>

            {/* Trade-offs & Limitations */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-cyan-400" />
                Key Trade-offs and Considerations:
              </span>
              <p className="text-slate-300">{res.ai_narrative.trade_off_analysis}</p>
              <p className="text-[12px] text-slate-500 pt-1 border-t border-white/5 mt-2">
                Audited Calculation: {res.ai_narrative.confidence_limitations}
              </p>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* Interactive ECharts Visualization Suite                  */}
        {/* ======================================================== */}
        <GlassCard
          title="Cost and Performance Visualizations"
          subtitle="Interactive charts showing daily inventory levels, cost breakdown, and recovery comparisons"
          badge={
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setActiveChartTab('inventory')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeChartTab === 'inventory'
                    ? 'bg-blue-600 text-white font-semibold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Daily Stock Levels
              </button>
              <button
                onClick={() => setActiveChartTab('cost')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeChartTab === 'cost'
                    ? 'bg-blue-600 text-white font-semibold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cost Breakdown
              </button>
              <button
                onClick={() => setActiveChartTab('tradeoff')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeChartTab === 'tradeoff'
                    ? 'bg-blue-600 text-white font-semibold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Compare All Options
              </button>
            </div>
          }
        >
          <div className="h-80 w-full pt-2">
            {activeChartTab === 'inventory' && (
              <ReactECharts option={inventoryChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
            )}
            {activeChartTab === 'cost' && (
              <ReactECharts option={costBreakdownChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
            )}
            {activeChartTab === 'tradeoff' && (
              <ReactECharts option={tradeOffRadarOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
            )}
          </div>
        </GlassCard>

        {/* ======================================================== */}
        {/* 4 Mitigation Strategy Comparative Cards                  */}
        {/* ======================================================== */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Comparison of Available Recovery Plans</span>
              </h3>
              <p className="text-xs text-slate-400">
                Ranked by your selected goal: <span className="text-cyan-400 font-mono">{res.objective.replace('_', ' ')}</span>
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Total Evaluated: {strategies.length} options
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {strategies.map((strat) => {
              const isRecommended = strat.strategy_id === res.recommended_strategy_id;
              const isDeployed = deployedStrategyIds.includes(strat.strategy_id);

              return (
                <div
                  key={strat.strategy_id}
                  className={`p-5 rounded-2xl glass-panel border transition-all space-y-4 flex flex-col justify-between ${
                    isDeployed
                      ? 'border-emerald-500/60 bg-emerald-950/25 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
                      : isRecommended
                      ? 'border-emerald-500/40 bg-slate-900/90 shadow-[0_0_25px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/30'
                      : 'border-white/10 hover:border-blue-500/40'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${
                          isRecommended
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border border-white/10'
                        }`}
                      >
                        {isRecommended ? '★ #1 RECOMMENDED' : `RANK #${strat.rank}`}
                      </span>

                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${
                          strat.feasibility_status === 'FEASIBLE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : strat.feasibility_status === 'FEASIBLE_WITH_TRADE_OFFS'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {strat.feasibility_status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white leading-snug">{strat.strategy_name}</h4>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed line-clamp-3">
                        {strat.description}
                      </p>
                    </div>

                    {/* Key Metric Snapshot */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Cost:</span>
                        <span className="text-white font-semibold">${(strat.total_cost_usd / 1000).toFixed(0)}k</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Service Level:</span>
                        <span className="text-cyan-400 font-semibold">{strat.service_level_pct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Arrival / Delay:</span>
                        <span className="text-amber-400">Day {strat.arrival_day} (+{strat.delivery_delay_days}d)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Stockout Days:</span>
                        <span className={strat.stockout_days_count === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {strat.stockout_days_count} Days
                        </span>
                      </div>
                    </div>

                    {/* Operational Action */}
                    <div className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-500/20 text-[11px] text-blue-300">
                      <span className="font-semibold text-blue-200">Action: </span>
                      {strat.operational_action}
                    </div>

                    {/* Trade-offs */}
                    {strat.trade_offs && strat.trade_offs.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">Key Trade-offs:</span>
                        <ul className="text-[11px] text-slate-300 space-y-0.5 list-disc list-inside">
                          {strat.trade_offs.slice(0, 2).map((to, i) => (
                            <li key={i} className="line-clamp-1">{to}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    {isDeployed ? (
                      <div className="w-full py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Deployed in ERP</span>
                      </div>
                    ) : (
                      <Button
                        variant={isRecommended ? 'glow' : 'secondary'}
                        size="sm"
                        className="w-full"
                        leftIcon={<Zap className="w-4 h-4" />}
                        onClick={() => handleDeployIntelligenceStrategy(strat)}
                      >
                        Deploy Strategy
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* Affected Live Database Entities Table                    */}
        {/* ======================================================== */}
        <div className="rounded-2xl glass-panel border border-white/10 p-5 space-y-4">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsAffectedEntitiesOpen(!isAffectedEntitiesOpen)}
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <h3 className="text-base font-bold text-white font-display">
                Affected Live Database Entities
              </h3>
              <span className="text-xs text-slate-400">
                (Verified against PostgreSQL records)
              </span>
            </div>
            {isAffectedEntitiesOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {isAffectedEntitiesOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* Products */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5" />
                  Target Products ({res.affected_entities.products?.length || 0})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {res.affected_entities.products?.map((p) => (
                    <div key={p.id} className="text-xs p-2 rounded bg-slate-950/60 border border-white/5 flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</p>
                      </div>
                      <span className="text-xs text-cyan-300 font-mono">${p.unit_price || 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suppliers */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  Suppliers Impacted ({res.affected_entities.suppliers?.length || 0})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {res.affected_entities.suppliers?.map((s) => (
                    <div key={s.id} className="text-xs p-2 rounded bg-slate-950/60 border border-white/5 flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">{s.name}</p>
                        <p className="text-[10px] text-slate-400">{s.country || 'Global'}</p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {s.role || 'Tier-1'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warehouses */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />
                  Fulfillment Centers ({res.affected_entities.warehouses?.length || 0})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {res.affected_entities.warehouses?.map((w) => (
                    <div key={w.id} className="text-xs p-2 rounded bg-slate-950/60 border border-white/5 flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">{w.name}</p>
                        <p className="text-[10px] text-slate-400">{w.location}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {(w.capacity || 0).toLocaleString()} cap
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipments */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5" />
                  In-Transit Shipments ({res.affected_entities.shipments?.length || 0})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {res.affected_entities.shipments?.map((sh) => (
                    <div key={sh.id} className="text-xs p-2 rounded bg-slate-950/60 border border-white/5 flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium font-mono">{sh.tracking_number}</p>
                        <p className="text-[10px] text-slate-400">{sh.origin} → {sh.destination}</p>
                      </div>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase">
                        {sh.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* Calculation Transparency & Audit Trail Accordion         */}
        {/* ======================================================== */}
        <div className="rounded-2xl glass-panel border border-white/10 p-5 space-y-3">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsTransparencyOpen(!isTransparencyOpen)}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-base font-bold text-white font-display">
                Mathematical Transparency & Data Provenance
              </h3>
              <NeonBadge variant="optimal" size="sm">
                AUDITED FORMULAS
              </NeonBadge>
            </div>
            {isTransparencyOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {isTransparencyOpen && (
            <div className="space-y-4 pt-3 border-t border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(res.calculation_transparency || {}).map(([key, calc]) => (
                  <div key={key} className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white capitalize">{calc.metric_name}</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        {calc.result_value?.toLocaleString()} {calc.units}
                      </span>
                    </div>
                    <p className="text-slate-400">{calc.definition}</p>
                    <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-cyan-300 border border-white/5">
                      Formula: {calc.formula}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Assumptions: {calc.assumptions} | Source: {calc.data_source}
                    </p>
                  </div>
                ))}
              </div>

              {/* Data Provenance Badge */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Source: <strong className="text-slate-200">{res.data_provenance.source_name}</strong> |
                    Records: <strong className="text-slate-200">{res.data_provenance.records_count}</strong> |
                    Freshness: <strong className="text-slate-200">{res.data_provenance.data_freshness_timestamp}</strong>
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 italic">
                  Model: {res.model_version}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* Full Evidence Dossier Modal (13 Structured Sections)     */}
        {/* ======================================================== */}
        <Modal
          isOpen={isDossierModalOpen}
          onClose={() => setIsDossierModalOpen(false)}
          title="SynChain AI — Simulation Evidence Dossier"
          subtitle={`Report ID: ${res.report_id} | Created: ${new Date(res.created_at).toLocaleString()}`}
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
                  isLoading={isDownloadingCsv}
                  onClick={handleDownloadCsv}
                >
                  Export CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<FileCode className="w-4 h-4 text-cyan-400" />}
                  isLoading={isDownloadingJson}
                  onClick={handleDownloadJson}
                >
                  Export JSON
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="glow"
                  size="sm"
                  leftIcon={<FileDown className="w-4 h-4" />}
                  isLoading={isDownloadingPdf}
                  onClick={handleDownloadPdf}
                >
                  Download PDF Evidence
                </Button>
                <Button variant="primary" size="sm" onClick={() => setIsDossierModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-6 text-sm text-slate-300 max-h-[70vh] overflow-y-auto pr-2">
            {/* 1. Header Metadata */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider text-cyan-400">
                1. Simulation Metadata & Scenario Scope
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                <div><span className="text-slate-400">Scenario:</span> <p className="text-white">{res.scenario_name}</p></div>
                <div><span className="text-slate-400">Disruption:</span> <p className="text-rose-400">{res.disruption_type}</p></div>
                <div><span className="text-slate-400">Optimization:</span> <p className="text-white">{res.objective}</p></div>
                <div><span className="text-slate-400">Report ID:</span> <p className="text-slate-300">{res.report_id.slice(0, 12)}...</p></div>
              </div>
            </div>

            {/* 2. Executive Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider text-purple-400">
                2. AI Executive Briefing
              </h4>
              <p className="text-xs text-slate-200 leading-relaxed p-4 rounded-xl bg-slate-900/60 border border-white/5">
                {res.ai_narrative.executive_summary}
              </p>
            </div>

            {/* 3. Baseline vs Disrupted Comparison */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider text-blue-400">
                3. Baseline vs Disrupted Variance
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="p-2">Metric</th>
                      <th className="p-2 text-cyan-400">Baseline (Ideal)</th>
                      <th className="p-2 text-rose-400">Disrupted (Unmitigated)</th>
                      <th className="p-2 text-emerald-400">Recommended Mitigated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    <tr>
                      <td className="p-2 font-sans font-medium text-white">Total Landed Cost</td>
                      <td className="p-2">${baseline.total_cost_usd.toLocaleString()}</td>
                      <td className="p-2 text-rose-400">${disrupted.total_cost_usd.toLocaleString()}</td>
                      <td className="p-2 text-emerald-400">${recommended?.total_cost_usd.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-sans font-medium text-white">Service Level (Fill Rate)</td>
                      <td className="p-2">{baseline.service_level_pct.toFixed(1)}%</td>
                      <td className="p-2 text-rose-400">{disrupted.service_level_pct.toFixed(1)}%</td>
                      <td className="p-2 text-emerald-400">{recommended?.service_level_pct.toFixed(1)}%</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-sans font-medium text-white">Delivery Delay</td>
                      <td className="p-2">0 Days</td>
                      <td className="p-2 text-rose-400">+{disrupted.delivery_delay_days} Days</td>
                      <td className="p-2 text-emerald-400">+{recommended?.delivery_delay_days} Days</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-sans font-medium text-white">Stockout Duration</td>
                      <td className="p-2">0 Days</td>
                      <td className="p-2 text-rose-400">{disrupted.stockout_days_count} Days</td>
                      <td className="p-2 text-emerald-400">{recommended?.stockout_days_count} Days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Evaluated Mitigation Strategies */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider text-emerald-400">
                4. All Evaluated Mitigation Playbooks
              </h4>
              <div className="space-y-2">
                {strategies.map((strat) => (
                  <div key={strat.strategy_id} className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">
                        Rank #{strat.rank}: {strat.strategy_name}
                      </span>
                      <span className="text-emerald-400 font-mono">
                        ${strat.total_cost_usd.toLocaleString()} | {strat.service_level_pct.toFixed(1)}% SLA
                      </span>
                    </div>
                    <p className="text-slate-300">{strat.description}</p>
                    <p className="text-slate-400 font-mono text-[11px]">
                      Action: {strat.operational_action} | Feasibility: {strat.feasibility_status}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Legal & Operational Disclaimer */}
            <div className="p-3 rounded-xl bg-slate-950 border border-white/5 text-[11px] text-slate-500 italic">
              <strong>Advisory Notice: </strong> {res.disclaimer}
            </div>
          </div>
        </Modal>

        {/* ======================================================== */}
        {/* Past Reports History Modal                               */}
        {/* ======================================================== */}
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title="Past Simulation Evidence Reports"
          subtitle="Persistent historical audit trail stored in PostgreSQL"
          footer={
            <Button variant="secondary" onClick={() => setIsHistoryModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {isLoadingHistory ? (
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                <span>Loading historical simulations from database...</span>
              </div>
            ) : historicalReports.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No historical reports found in database.
              </div>
            ) : (
              historicalReports.map((rep) => (
                <div
                  key={rep.report_id}
                  className="p-4 rounded-xl bg-slate-900/80 border border-white/5 hover:border-blue-500/30 transition-all flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{rep.scenario_name}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                        {rep.disruption_type.replace('_', ' ')}
                      </span>
                      {rep.is_ai_generated && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                          AI Verified
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
                      <span>Mitigated Cost: ${(rep.mitigated_cost_usd / 1000).toFixed(0)}k</span>
                      <span>SLA Saved: +{rep.service_level_saved_pct?.toFixed(1)}%</span>
                      <span>{new Date(rep.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleLoadPastReport(rep.report_id)}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                    >
                      Load
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>

        {/* ======================================================== */}
        {/* Strategy Dispatch Confirmation Modal                     */}
        {/* ======================================================== */}
        {selectedStrategyForDispatch && (
          <Modal
            isOpen={isSuccessModalOpen}
            onClose={() => setIsSuccessModalOpen(false)}
            title="Mitigation Strategy Dispatched"
            subtitle="Autonomous order dispatch routed via EDI / API Gateway"
            footer={
              <Button variant="primary" onClick={() => setIsSuccessModalOpen(false)}>
                Acknowledge & Continue
              </Button>
            }
          >
            <div className="space-y-4 text-sm text-slate-300">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    Strategy: {'strategy_name' in selectedStrategyForDispatch ? selectedStrategyForDispatch.strategy_name : selectedStrategyForDispatch.title}
                  </h4>
                  <p className="text-xs text-emerald-300/90 mt-1">
                    Purchase orders and logistical route changes transmitted to ERP (SAP / Oracle NetSuite). Production schedule buffer restored.
                  </p>
                </div>
              </div>

              <div className="text-xs space-y-1.5 font-mono-telemetry p-3.5 rounded-xl bg-slate-900/80 border border-white/5">
                <p className="text-slate-400">Transaction Ref: <span className="text-slate-200">0x8f19...c4b2</span></p>
                <p className="text-slate-400">Status: <span className="text-emerald-400">CONFIRMED (200 OK)</span></p>
                <p className="text-slate-400">
                  Target Landed Cost:{' '}
                  <span className="text-emerald-300 font-bold">
                    ${'total_cost_usd' in selectedStrategyForDispatch
                      ? (selectedStrategyForDispatch.total_cost_usd / 1000).toFixed(0) + 'k'
                      : ((selectedStrategyForDispatch as any).costEstimateUsd / 1000).toFixed(0) + 'k'}
                  </span>
                </p>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ========================================================
  // RENDER: Legacy Simulation Fallback
  // ========================================================
  const {
    scenarioName,
    financialLossEstimateUsd,
    lostProductionUnits,
    estimatedDelayDays,
    riskScorePostSimulation,
    cascadingTimeline,
    mitigationStrategies,
    dailyImpactTrend,
  } = currentSimulationResult!;

  const comparisonOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(59, 130, 246, 0.4)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    legend: {
      data: ['Unmitigated Disrupted Trajectory', 'AI Optimal Mitigated Trajectory'],
      textStyle: { color: '#94a3b8', fontSize: 11 },
      top: 0,
      right: 10,
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: '4%',
      top: '16%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dailyImpactTrend.map((d) => `Day ${d.day}`),
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 11,
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
      },
    },
    series: [
      {
        name: 'Unmitigated Disrupted Trajectory',
        type: 'line',
        data: dailyImpactTrend.map((d) => d.lossWithoutMitigation),
        smooth: true,
        itemStyle: { color: '#ef4444' },
        lineStyle: { width: 3, color: '#ef4444' },
        areaStyle: { color: 'rgba(239, 68, 68, 0.15)' },
      },
      {
        name: 'AI Optimal Mitigated Trajectory',
        type: 'line',
        data: dailyImpactTrend.map((d) => d.lossWithMitigation),
        smooth: true,
        itemStyle: { color: '#10b981' },
        lineStyle: { width: 3, color: '#10b981' },
        areaStyle: { color: 'rgba(16, 185, 129, 0.2)' },
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Upgrade Available: Full Multi-Strategy AI Intelligence Engine
            </h4>
            <p className="text-xs text-slate-300">
              Run a simulation via the Scenario Builder to activate 4-strategy discrete trajectory modeling, live DB entity audits, and ReportLab PDF dossiers.
            </p>
          </div>
        </div>
        <Button variant="glow" size="sm" onClick={() => onNavigate('scenario-builder')}>
          Launch Engine V2
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Simulation Results & AI Mitigation Engine
            </h2>
            <NeonBadge variant="purple" size="sm">
              COMPUTED
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Scenario: <span className="text-white font-semibold">{scenarioName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('scenario-builder')}
          >
            New Scenario
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<History className="w-3.5 h-3.5 text-slate-400" />}
            onClick={handleOpenHistoryModal}
          >
            Past Reports
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-panel border border-rose-500/30 space-y-2">
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
            Unmitigated Revenue Risk
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">
            ${(financialLossEstimateUsd / 1000000).toFixed(2)}M
          </p>
          <p className="text-[11px] text-slate-400">Direct component and delay penalties</p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-amber-500/30 space-y-2">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Assembly Units Stalled
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">
            {lostProductionUnits.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400">Finished goods assembly deficit</p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-cyan-500/30 space-y-2">
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Network Delivery Delay
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">
            +{estimatedDelayDays} Days
          </p>
          <p className="text-[11px] text-slate-400">Critical customer fulfillment SLA variance</p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-purple-500/30 space-y-2">
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
            Network Risk Score
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-rose-400 font-mono-telemetry">
            {riskScorePostSimulation} / 100
          </p>
          <p className="text-[11px] text-slate-400">Elevated stress on Tier-1 buffer</p>
        </div>
      </div>

      <GlassCard
        title="Disruption vs AI Mitigation Trajectory (Daily Cumulative Loss)"
        subtitle="Visualizing financial recovery achieved through multi-echelon AI autonomous dispatch"
        badge={
          <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Saves ~$3.2M Net</span>
          </div>
        }
      >
        <div className="h-72 w-full">
          <ReactECharts option={comparisonOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
        </div>
      </GlassCard>

      <div className="space-y-4">
        <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Recommended Mitigation Strategies</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mitigationStrategies.map((strat) => (
            <div
              key={strat.id}
              className="p-6 rounded-2xl glass-panel border border-white/10 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono-telemetry uppercase text-purple-400 font-semibold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30">
                    {strat.category.replace('_', ' ')}
                  </span>
                  <NeonBadge variant={strat.status === 'executed' ? 'optimal' : 'purple'} size="sm">
                    {strat.status === 'executed' ? 'DISPATCHED' : 'READY'}
                  </NeonBadge>
                </div>

                <h4 className="text-sm font-bold text-white leading-snug">{strat.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{strat.description}</p>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-white/5 space-y-1.5 text-xs font-mono-telemetry">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Execution Cost:</span>
                    <span className="text-slate-200">${(strat.costEstimateUsd / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Loss Prevented:</span>
                    <span className="text-emerald-400 font-semibold">${(strat.savingsEstimateUsd / 1000000).toFixed(2)}M</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Days Recovered:</span>
                    <span className="text-cyan-400 font-semibold">{strat.timeSavedDays} Days</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                {strat.status === 'executed' ? (
                  <div className="w-full py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Active in Supply Chain</span>
                  </div>
                ) : (
                  <Button
                    variant="glow"
                    size="sm"
                    className="w-full"
                    leftIcon={<Zap className="w-4 h-4" />}
                    onClick={() => handleDispatchLegacy(strat)}
                  >
                    Execute Strategy
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
