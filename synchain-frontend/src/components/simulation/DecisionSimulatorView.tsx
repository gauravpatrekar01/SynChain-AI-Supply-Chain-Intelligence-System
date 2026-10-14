import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Cpu,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  TrendingDown,
  Zap,
  Info,
  Building2,
  Loader2,
  PackageCheck,
  Clock,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { NeonBadge } from '../common/NeonBadge';
import { Button } from '../common/Button';
import { soundFX } from '../../services/audioService';
import { apiService } from '../../services/api';
import {
  SupplierOption,
  DecisionSimulationResult,
  ScenarioDetail,
  DecisionAction,
} from '../../types';

// ----------------------------------------------------------------
// Provenance label helpers
// ----------------------------------------------------------------
const provenanceLabel = (p: string): { text: string; color: string } => {
  if (p === 'retail_dataset_actual') return { text: 'Retail Dataset (Actual)', color: 'text-emerald-400' };
  if (p === 'postgresql_live') return { text: 'PostgreSQL Live', color: 'text-blue-400' };
  if (p === 'deterministic_demo') return { text: 'Deterministic Demo', color: 'text-amber-400' };
  return { text: 'User Custom', color: 'text-slate-300' };
};

const actionConfig: Record<DecisionAction, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  SWITCH_TO_ALTERNATIVE: {
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: <CheckCircle2 className="w-5 h-5" />,
    label: 'Switch to Alternative',
  },
  MAINTAIN_PRIMARY: {
    color: 'text-blue-300',
    bg: 'bg-blue-500/10 border-blue-500/30',
    icon: <CheckCircle2 className="w-5 h-5" />,
    label: 'Maintain Primary',
  },
  EXPEDITE_AND_CONSERVE: {
    color: 'text-amber-300',
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: <AlertTriangle className="w-5 h-5" />,
    label: 'Expedite & Conserve',
  },
  INSUFFICIENT_ALTERNATIVE_DATA: {
    color: 'text-rose-300',
    bg: 'bg-rose-500/10 border-rose-500/30',
    icon: <XCircle className="w-5 h-5" />,
    label: 'Insufficient Data',
  },
  BUFFER_ABSORBS_DELAY: {
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/10 border-cyan-500/30',
    icon: <ShieldAlert className="w-5 h-5" />,
    label: 'Buffer Absorbs Delay',
  },
};

// ----------------------------------------------------------------
// Scenario colour config
// ----------------------------------------------------------------
const scenarioColors = {
  baseline: '#3b82f6',
  disrupted: '#ef4444',
  alternative: '#10b981',
};

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export const DecisionSimulatorView: React.FC = () => {
  // --- Available Suppliers ---
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  // --- Form State ---
  const [sku, setSku] = useState('P0001');
  const [initialInventory, setInitialInventory] = useState(400);
  const [dailyDemand, setDailyDemand] = useState<number | ''>('');
  const [useForecastDemand, setUseForecastDemand] = useState(true);
  const [simulationDays, setSimulationDays] = useState(30);
  const [orderQuantity, setOrderQuantity] = useState(500);
  const [safetyStock, setSafetyStock] = useState(80);

  const [primarySupplierId, setPrimarySupplierId] = useState('');
  const [primaryLeadTimeDays, setPrimaryLeadTimeDays] = useState(7);
  const [disruptionDelayDays, setDisruptionDelayDays] = useState(10);

  const [altSupplierId, setAltSupplierId] = useState('');
  const [altLeadTimeDays, setAltLeadTimeDays] = useState<number | ''>('');

  // --- Simulation State ---
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DecisionSimulationResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  // --- Chart tab ---
  const [chartMode, setChartMode] = useState<'inventory' | 'cumulative_unmet'>('inventory');
  const [expandedAssumptions, setExpandedAssumptions] = useState(false);

  // ----------------------------------------------------------------
  // Load Suppliers on Mount
  // ----------------------------------------------------------------
  useEffect(() => {
    apiService.getSimulationSuppliers().then((data) => {
      setSuppliers(data.suppliers);
      if (data.suppliers.length > 0) {
        const primary = data.suppliers[0];
        setPrimarySupplierId(primary.supplier_id);
        setPrimaryLeadTimeDays(primary.average_lead_time_days);
        if (data.suppliers.length > 1) {
          const alt = data.suppliers[1];
          setAltSupplierId(alt.supplier_id);
          setAltLeadTimeDays(alt.average_lead_time_days);
        }
      }
    }).catch(() => setSupplierError('Could not load supplier list'));
  }, []);

  const selectedPrimary = useMemo(() => suppliers.find(s => s.supplier_id === primarySupplierId), [suppliers, primarySupplierId]);
  const selectedAlt = useMemo(() => suppliers.find(s => s.supplier_id === altSupplierId), [suppliers, altSupplierId]);

  // ----------------------------------------------------------------
  // Run Simulation
  // ----------------------------------------------------------------
  const handleRunSimulation = useCallback(async () => {
    soundFX.playClick();
    setIsRunning(true);
    setSimError(null);
    setResult(null);

    try {
      const payload = {
        sku,
        initialInventory,
        ...(useForecastDemand ? { useForecastDemand: true } : dailyDemand !== '' ? { dailyDemand: Number(dailyDemand) } : {}),
        simulationDays,
        orderQuantity,
        safetyStock,
        primarySupplierId: primarySupplierId || undefined,
        primarySupplierName: selectedPrimary?.supplier_name || 'Primary Supplier',
        primaryLeadTimeDays,
        disruptionDelayDays,
        disruptionType: 'supplier_outage',
        ...(altSupplierId && altLeadTimeDays !== '' ? {
          alternativeSupplierId: altSupplierId,
          alternativeSupplierName: selectedAlt?.supplier_name || 'Alternative Supplier',
          alternativeLeadTimeDays: Number(altLeadTimeDays),
          alternativeCapacity: selectedAlt?.available_capacity_units ?? undefined,
        } : {}),
      };

      const res = await apiService.runDecisionSimulation(payload);
      setResult(res);
      soundFX.playSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Simulation failed';
      setSimError(msg);
      soundFX.playError();
    } finally {
      setIsRunning(false);
    }
  }, [sku, initialInventory, useForecastDemand, dailyDemand, simulationDays, orderQuantity, safetyStock, primarySupplierId, primaryLeadTimeDays, disruptionDelayDays, altSupplierId, altLeadTimeDays, selectedPrimary, selectedAlt]);

  // ----------------------------------------------------------------
  // Chart options
  // ----------------------------------------------------------------
  const chartOption = useMemo(() => {
    if (!result) return {};
    const scenarioEntries = Object.entries(result.scenarios);

    const days = Array.from({ length: result.simulationHorizonDays }, (_, i) => `Day ${i + 1}`);

    const series = scenarioEntries.map(([key, scen]) => {
      const color = scenarioColors[key as keyof typeof scenarioColors] || '#94a3b8';
      const yField = chartMode === 'inventory' ? 'endingInventory' : 'cumulativeUnmetDemand';
      const values = scen.dailyTrajectory.map(d => chartMode === 'inventory' ? d.endingInventory : d.cumulativeUnmetDemand);

      return {
        name: scen.scenarioName,
        type: 'line',
        data: values,
        smooth: true,
        itemStyle: { color },
        lineStyle: { width: 2.5, color },
        areaStyle: chartMode === 'inventory' ? { color: `${color}20` } : undefined,
        markLine: chartMode === 'inventory' ? {
          silent: true,
          data: [{ yAxis: result.scenarios['baseline']?.summary.endingInventory ? undefined : undefined }],
        } : undefined,
      };
    });

    // Safety stock reference line (only on inventory view)
    const safetyStockLine = chartMode === 'inventory' ? {
      name: 'Safety Stock',
      type: 'line',
      data: new Array(result.simulationHorizonDays).fill(result.scenarios['baseline']?.dailyTrajectory[0]
        ? undefined : undefined),
      lineStyle: { type: 'dashed', color: '#f59e0b', width: 1.5 },
      itemStyle: { color: '#f59e0b' },
      showSymbol: false,
      tooltip: { show: false },
    } : null;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(59, 130, 246, 0.3)',
        borderWidth: 1,
        textStyle: { color: '#f8fafc', fontSize: 11 },
      },
      legend: {
        data: scenarioEntries.map(([, s]) => s.scenarioName),
        textStyle: { color: '#94a3b8', fontSize: 10 },
        top: 0,
      },
      grid: { left: '3%', right: '3%', bottom: '4%', top: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        data: days,
        axisLabel: { color: '#64748b', fontSize: 10, interval: Math.floor(result.simulationHorizonDays / 8) },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
        axisLine: { show: false },
      },
      series,
    };
  }, [result, chartMode]);

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
            Supply Chain Decision Simulator
          </h2>
          <NeonBadge variant="purple" size="sm">Advisory</NeonBadge>
        </div>
        <p className="text-xs sm:text-sm text-slate-400">
          Compare baseline, disrupted, and alternative supplier outcomes. Deterministic simulation — not a probabilistic model.
          Does not modify inventory, create orders, or switch suppliers automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* === Configuration Panel === */}
        <div className="xl:col-span-1 space-y-4">
          <GlassCard className="p-5 space-y-5">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-blue-400" /> Product & Inventory
            </h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">SKU Identifier</label>
              <input
                id="sim-sku"
                value={sku}
                onChange={e => setSku(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="e.g. P0001, IC-3NM-A18"
              />
              <p className="text-xs text-slate-500 mt-1">Retail: P0001–P0020 · Demo: IC-3NM-A18, HBM3E-24G</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Initial Inventory (units)</label>
                <input
                  id="sim-init-inv"
                  type="number"
                  min={0}
                  value={initialInventory}
                  onChange={e => setInitialInventory(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Safety Stock (units)</label>
                <input
                  id="sim-safety-stock"
                  type="number"
                  min={0}
                  value={safetyStock}
                  onChange={e => setSafetyStock(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Order Quantity (units)</label>
                <input
                  id="sim-order-qty"
                  type="number"
                  min={1}
                  value={orderQuantity}
                  onChange={e => setOrderQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Horizon (days)</label>
                <select
                  id="sim-days"
                  value={simulationDays}
                  onChange={e => setSimulationDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {[14, 21, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
                </select>
              </div>
            </div>

            {/* Demand Source */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Daily Demand Source</label>
              <div className="flex gap-2 mb-2">
                <button
                  id="sim-demand-forecast"
                  onClick={() => setUseForecastDemand(true)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${useForecastDemand ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}
                >
                  Auto (from history)
                </button>
                <button
                  id="sim-demand-manual"
                  onClick={() => setUseForecastDemand(false)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${!useForecastDemand ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}
                >
                  Manual
                </button>
              </div>
              {!useForecastDemand && (
                <input
                  id="sim-daily-demand"
                  type="number"
                  min={0}
                  step={0.5}
                  value={dailyDemand}
                  onChange={e => setDailyDemand(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 45.0 units/day"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          </GlassCard>

          {/* Suppliers */}
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-400" /> Suppliers & Disruption
            </h3>

            {supplierError && (
              <p className="text-xs text-rose-400">{supplierError}</p>
            )}

            <div>
              <label className="text-xs text-slate-400 block mb-1">Primary Supplier</label>
              <select
                id="sim-primary-supplier"
                value={primarySupplierId}
                onChange={e => {
                  setPrimarySupplierId(e.target.value);
                  const sup = suppliers.find(s => s.supplier_id === e.target.value);
                  if (sup) setPrimaryLeadTimeDays(sup.average_lead_time_days);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {suppliers.filter(s => s.is_active).map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name} ({s.location}) · {s.average_lead_time_days}d
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Lead Time (days)</label>
                <input
                  id="sim-lead-time"
                  type="number"
                  min={1}
                  value={primaryLeadTimeDays}
                  onChange={e => setPrimaryLeadTimeDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1 text-rose-300">Disruption Delay (days)</label>
                <input
                  id="sim-disruption-delay"
                  type="number"
                  min={0}
                  value={disruptionDelayDays}
                  onChange={e => setDisruptionDelayDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-rose-700/50 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="pt-1 border-t border-white/5">
              <label className="text-xs text-slate-400 block mb-1">Alternative Supplier (optional)</label>
              <select
                id="sim-alt-supplier"
                value={altSupplierId}
                onChange={e => {
                  setAltSupplierId(e.target.value);
                  const sup = suppliers.find(s => s.supplier_id === e.target.value);
                  if (sup) setAltLeadTimeDays(sup.average_lead_time_days);
                  else setAltLeadTimeDays('');
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">— No alternative —</option>
                {suppliers.filter(s => s.supplier_id !== primarySupplierId).map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name} ({s.location}) · {s.average_lead_time_days}d
                  </option>
                ))}
              </select>

              {altSupplierId && (
                <div className="mt-2">
                  <label className="text-xs text-slate-400 block mb-1">Alt. Lead Time (days)</label>
                  <input
                    id="sim-alt-lead-time"
                    type="number"
                    min={1}
                    value={altLeadTimeDays}
                    onChange={e => setAltLeadTimeDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  {selectedAlt?.available_capacity_units && (
                    <p className="text-xs text-slate-500 mt-1">Capacity: {selectedAlt.available_capacity_units.toLocaleString()} units · Reliability: {selectedAlt.reliability_score.toFixed(1)}%</p>
                  )}
                  {!selectedAlt?.available_capacity_units && (
                    <p className="text-xs text-amber-500/80 mt-1">⚠ Capacity unknown — assumed adequate.</p>
                  )}
                </div>
              )}
            </div>

            <Button
              id="sim-run-btn"
              variant="glow"
              className="w-full"
              onClick={handleRunSimulation}
              disabled={isRunning}
            >
              {isRunning ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Simulating…</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Run Simulation</>
              )}
            </Button>
          </GlassCard>
        </div>

        {/* === Results Panel === */}
        <div className="xl:col-span-2 space-y-4">
          {/* Error state */}
          {simError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Simulation Error</p>
                <p className="text-xs text-rose-400/80">{simError}</p>
              </div>
            </div>
          )}

          {/* No result yet */}
          {!result && !simError && !isRunning && (
            <GlassCard className="p-12 text-center space-y-4">
              <Zap className="w-12 h-12 text-violet-400 mx-auto opacity-40" />
              <h3 className="text-base font-semibold text-slate-300">Configure & Run the Simulator</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Set your SKU, inventory, supplier lead times, and disruption delay, then click
                <span className="text-violet-300"> Run Simulation</span> to compare scenarios.
              </p>
            </GlassCard>
          )}

          {/* Loading */}
          {isRunning && (
            <GlassCard className="p-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-violet-400 mx-auto animate-spin" />
              <p className="text-sm text-slate-400">Running deterministic scenario analysis…</p>
            </GlassCard>
          )}

          {result && (
            <>
              {/* Advisory Banner */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3 ${actionConfig[result.decision.recommendedAction].bg}`}>
                <span className={`${actionConfig[result.decision.recommendedAction].color} shrink-0 mt-0.5`}>
                  {actionConfig[result.decision.recommendedAction].icon}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-bold ${actionConfig[result.decision.recommendedAction].color}`}>
                      {result.decision.recommendationTitle}
                    </p>
                    <NeonBadge variant="warning" size="sm">Advisory Only</NeonBadge>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{result.decision.explanation}</p>
                  <ul className="mt-2 space-y-0.5">
                    {result.decision.keyFactors.map((f, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                        <span className="text-slate-500 mt-0.5">→</span>{f}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500 italic">{result.decision.advisoryDisclaimer}</p>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(result.scenarios).map(([key, scen]) => {
                  const color = key === 'baseline' ? 'text-blue-300' : key === 'disrupted' ? 'text-rose-300' : 'text-emerald-300';
                  const border = key === 'baseline' ? 'border-blue-500/20' : key === 'disrupted' ? 'border-rose-500/20' : 'border-emerald-500/20';
                  const hasStockout = scen.summary.stockoutDaysCount > 0;
                  return (
                    <GlassCard key={key} className={`p-3 border ${border}`}>
                      <p className={`text-xs font-semibold ${color} truncate`}>{scen.scenarioName.split('(')[0].trim()}</p>
                      <p className="text-lg font-bold text-white mt-0.5">{scen.summary.serviceLevelPct.toFixed(1)}%</p>
                      <p className="text-xs text-slate-400">Service Level</p>
                      {hasStockout ? (
                        <p className="text-xs text-rose-400 mt-1">Stockout Day {scen.summary.firstStockoutDay}</p>
                      ) : (
                        <p className="text-xs text-emerald-400 mt-1">No stockout</p>
                      )}
                      <p className="text-xs text-slate-500">Arrival: Day {scen.summary.supplierArrivalDay}</p>
                    </GlassCard>
                  );
                })}

                {/* Comparison KPI */}
                {result.comparison.hasAlternativeScenario && result.comparison.daysSavedByAlternative !== null && (
                  <GlassCard className="p-3 border border-violet-500/20">
                    <p className="text-xs font-semibold text-violet-300">Days Saved</p>
                    <p className="text-lg font-bold text-white mt-0.5">{result.comparison.daysSavedByAlternative}</p>
                    <p className="text-xs text-slate-400">vs Disrupted</p>
                    {result.comparison.stockoutPrevented && (
                      <p className="text-xs text-emerald-400 mt-1">Stockout prevented ✓</p>
                    )}
                  </GlassCard>
                )}
              </div>

              {/* Inventory Trajectory Chart */}
              <GlassCard className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-200">Inventory Trajectory</h3>
                  <div className="flex gap-1">
                    <button
                      id="sim-chart-inventory"
                      onClick={() => setChartMode('inventory')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${chartMode === 'inventory' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}
                    >
                      Inventory
                    </button>
                    <button
                      id="sim-chart-unmet"
                      onClick={() => setChartMode('cumulative_unmet')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${chartMode === 'cumulative_unmet' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}
                    >
                      Unmet Demand
                    </button>
                  </div>
                </div>
                <ReactECharts
                  option={chartOption}
                  style={{ height: 260 }}
                  opts={{ renderer: 'svg' }}
                />
              </GlassCard>

              {/* Scenario Summary Table */}
              <GlassCard className="p-4 overflow-x-auto">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Scenario Comparison</h3>
                <table className="w-full text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="pb-2 text-left font-medium">Metric</th>
                      {Object.values(result.scenarios).map(s => (
                        <th key={s.scenarioType} className="pb-2 text-right font-medium">{s.scenarioName.split('(')[0].trim()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      { label: 'Service Level', key: (s: ScenarioDetail) => `${s.summary.serviceLevelPct.toFixed(1)}%` },
                      { label: 'Stockout Days', key: (s: ScenarioDetail) => s.summary.stockoutDaysCount },
                      { label: 'First Stockout', key: (s: ScenarioDetail) => s.summary.firstStockoutDay ? `Day ${s.summary.firstStockoutDay}` : '—' },
                      { label: 'Unmet Demand', key: (s: ScenarioDetail) => s.summary.totalUnmetDemand.toFixed(0) },
                      { label: 'Supplier Arrival', key: (s: ScenarioDetail) => `Day ${s.summary.supplierArrivalDay}` },
                      { label: 'Ending Inventory', key: (s: ScenarioDetail) => s.summary.endingInventory.toLocaleString() },
                      { label: 'Safety Breach Days', key: (s: ScenarioDetail) => s.summary.safetyStockBreachDaysCount },
                      { label: 'Total Cost (est.)', key: (s: ScenarioDetail) => s.summary.estimatedTotalCostUsd != null ? `$${s.summary.estimatedTotalCostUsd.toLocaleString()}` : '—' },
                    ].map(row => (
                      <tr key={row.label}>
                        <td className="py-1.5 text-slate-400">{row.label}</td>
                        {Object.values(result.scenarios).map(s => (
                          <td key={s.scenarioType} className="py-1.5 text-right">{row.key(s)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GlassCard>

              {/* Provenance & Assumptions */}
              <GlassCard className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" /> Data Provenance & Assumptions
                  </h3>
                  <button
                    id="sim-toggle-assumptions"
                    onClick={() => setExpandedAssumptions(!expandedAssumptions)}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${expandedAssumptions ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const prov = provenanceLabel(result.dataProvenance);
                    return (
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${prov.color}`}>
                        {prov.text}
                      </span>
                    );
                  })()}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                    Demand: {result.demandType} · {result.dailyDemandRate} units/day avg
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                    {result.simulationHorizonDays}-day horizon
                  </span>
                </div>

                {expandedAssumptions && (
                  <div className="space-y-2 pt-2">
                    {result.assumptions.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 font-semibold mb-1">Assumptions</p>
                        <ul className="space-y-0.5">
                          {result.assumptions.map((a, i) => (
                            <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                              <span className="text-slate-600">·</span>{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.limitations.length > 0 && (
                      <div>
                        <p className="text-xs text-amber-400/80 font-semibold mb-1">Known Limitations</p>
                        <ul className="space-y-0.5">
                          {result.limitations.map((l, i) => (
                            <li key={i} className="text-xs text-amber-500/70 flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{l}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
