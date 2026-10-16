import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Play,
  CloudRain,
  Building2,
  Anchor,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Layers,
  Clock,
  Gauge,
  CheckCircle2,
  Database,
  FileText,
  DollarSign,
  ShieldCheck,
  Package,
  Truck,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { DisruptionScenarioType, OptimizationObjective, DataReadinessCheck, ScenarioConfigOption } from '../../types/scenario';
import { Button } from '../common/Button';
import { GlassCard } from '../common/GlassCard';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';
import { apiService } from '../../services/api';

interface ScenarioBuilderProps {
  onNavigate: (pageId: string) => void;
}

export const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({ onNavigate }) => {
  const { runSimulation, setScenarioIntelligenceResult, isSimulating } = useSupplyChain();

  // -------------------------------------------------------------------------
  // State: Form Inputs
  // -------------------------------------------------------------------------
  const [scenarioName, setScenarioName] = useState('East China Sea Port Typhoon Surge');
  const [disruptionType, setDisruptionType] = useState<DisruptionScenarioType>('port_closure');
  const [durationDays, setDurationDays] = useState(14);
  const [severityPct, setSeverityPct] = useState(75);
  const [objective, setObjective] = useState<OptimizationObjective>('balanced');

  // Inventory & Replenishment Parameters
  const [selectedSku, setSelectedSku] = useState('SYN-TEST-101');
  const [initialInventory, setInitialInventory] = useState(400);
  const [orderQuantity, setOrderQuantity] = useState(500);
  const [safetyStock, setSafetyStock] = useState(80);
  const [dailyDemand, setDailyDemand] = useState(25.0);

  // Supplier Selection (from real DB)
  const [primarySupplierId, setPrimarySupplierId] = useState<string>('');
  const [primarySupplierName, setPrimarySupplierName] = useState<string>('AeroMaterials Prime');
  const [alternativeSupplierId, setAlternativeSupplierId] = useState<string>('');
  const [alternativeSupplierName, setAlternativeSupplierName] = useState<string>('Western Components Ltd');

  // Operational Constraints (Optional)
  const [budgetLimitUsd, setBudgetLimitUsd] = useState<number | ''>('');
  const [maxDelayDays, setMaxDelayDays] = useState<number | ''>('');

  // -------------------------------------------------------------------------
  // State: Data Readiness & DB Configuration Options
  // -------------------------------------------------------------------------
  const [readiness, setReadiness] = useState<DataReadinessCheck | null>(null);
  const [isReadinessLoading, setIsReadinessLoading] = useState(true);
  const [showReadinessDetails, setShowReadinessDetails] = useState(false);
  const [productsList, setProductsList] = useState<ScenarioConfigOption[]>([]);
  const [suppliersList, setSuppliersList] = useState<ScenarioConfigOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [simError, setSimError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  // -------------------------------------------------------------------------
  // Load Verified Database Readiness & Entities on Mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    // 1. Check Data Readiness
    apiService
      .getScenarioReadiness()
      .then((data) => {
        if (mounted) {
          setReadiness(data);
          setIsReadinessLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setIsReadinessLoading(false);
      });

    // 2. Load DB Config Options
    apiService
      .getScenarioConfigOptions()
      .then((data) => {
        if (mounted) {
          setProductsList(data.products || []);
          setSuppliersList(data.suppliers || []);

          if (data.products && data.products.length > 0) {
            setSelectedSku(data.products[0].value);
          }
          if (data.suppliers && data.suppliers.length > 0) {
            setPrimarySupplierId(data.suppliers[0].value);
            setPrimarySupplierName(data.suppliers[0].label);
            if (data.suppliers.length > 1) {
              setAlternativeSupplierId(data.suppliers[1].value);
              setAlternativeSupplierName(data.suppliers[1].label);
            }
          }
          setIsLoadingOptions(false);
        }
      })
      .catch(() => {
        if (mounted) setIsLoadingOptions(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Presets
  // -------------------------------------------------------------------------
  const presets = [
    {
      name: 'Typhoon Gaemi (Port Terminal Choke)',
      type: 'port_closure' as DisruptionScenarioType,
      days: 14,
      severity: 85,
      objective: 'balanced' as OptimizationObjective,
      icon: CloudRain,
      desc: 'Berths shuttered for 14 days; inbound maritime shipments delayed, testing buffer limits.',
    },
    {
      name: 'TSMC Wafer Fab Contamination Halt',
      type: 'supplier_outage' as DisruptionScenarioType,
      days: 21,
      severity: 80,
      objective: 'minimize_delay' as OptimizationObjective,
      icon: Building2,
      desc: 'Critical semiconductor foundry offline for 3 weeks; requires expedited secondary sourcing.',
    },
    {
      name: 'Rotterdam Maritime Strike & Canal Delay',
      type: 'freight_delay' as DisruptionScenarioType,
      days: 10,
      severity: 90,
      objective: 'maximize_service_level' as OptimizationObjective,
      icon: Anchor,
      desc: 'European container transit gridlocked; urgent air cargo charter required to prevent stockout.',
    },
    {
      name: 'Lithium & Copper Upstream Surge (+40%)',
      type: 'raw_material_spike' as DisruptionScenarioType,
      days: 30,
      severity: 60,
      objective: 'minimize_cost' as OptimizationObjective,
      icon: TrendingUp,
      desc: 'Commodity price inflation pressures purchasing budget; demand rationing evaluated.',
    },
  ];

  const handleApplyPreset = (p: typeof presets[0]) => {
    soundFX.playClick();
    setScenarioName(p.name);
    setDisruptionType(p.type);
    setDurationDays(p.days);
    setSeverityPct(p.severity);
    setObjective(p.objective);
  };

  // -------------------------------------------------------------------------
  // Launch Simulation
  // -------------------------------------------------------------------------
  const handleStartSimulation = async () => {
    soundFX.playClick();
    setIsLaunching(true);
    setSimError(null);

    const payload = {
      scenario_name: scenarioName,
      disruption_type: disruptionType,
      sku: selectedSku,
      target_supplier_id: primarySupplierId || undefined,
      target_supplier_name: primarySupplierName,
      alternative_supplier_id: alternativeSupplierId || undefined,
      alternative_supplier_name: alternativeSupplierName,
      duration_days: durationDays,
      severity_pct: severityPct,
      simulation_horizon_days: 30,
      initial_inventory: initialInventory,
      order_quantity: orderQuantity,
      safety_stock: safetyStock,
      daily_demand: dailyDemand,
      objective,
      budget_limit_usd: budgetLimitUsd !== '' ? Number(budgetLimitUsd) : undefined,
      max_acceptable_delay_days: maxDelayDays !== '' ? Number(maxDelayDays) : undefined,
    };

    try {
      // 1. Run deterministic backend scenario simulation
      const result = await apiService.runScenarioSimulation(payload);
      setScenarioIntelligenceResult(result);

      // 2. Trigger audio feedback and navigate
      soundFX.playSuccess();
      onNavigate('simulation-results');
    } catch (err: any) {
      soundFX.playWarning();
      setSimError(err?.response?.data?.detail || err.message || 'Simulation execution failed');
      setIsLaunching(false);
    }
  };

  // Real-time calculated estimates based on sliders
  const estimatedRevenueRisk = (durationDays * severityPct * 185).toLocaleString();
  const estimatedDelayDays = Math.round(durationDays * (severityPct / 100) * 0.85);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Scenario Builder & AI Mitigation Intelligence
            </h2>
            <NeonBadge variant="blue" size="sm">
              ENGINE V2.1
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Stress-test your supply chain with deterministic disruption modeling and Gemini-powered decision intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileText className="w-4 h-4 text-slate-400" />}
            onClick={() => onNavigate('simulation-results')}
          >
            Past Evidence Reports
          </Button>
        </div>
      </div>

      {/* 1. Data Readiness Assessment Banner */}
      <div className="rounded-2xl glass-panel border border-white/10 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">Database Readiness Assessment</h4>
                {readiness && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      readiness.status === 'ready'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : readiness.status === 'partial'
                        ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {readiness.status === 'ready'
                      ? 'Optimal Readiness'
                      : readiness.status === 'partial'
                      ? 'Simulation-Ready (Verified DB Data)'
                      : 'Insufficient Data'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {readiness
                  ? `Connected to PostgreSQL: ${readiness.total_products} Products, ${readiness.total_suppliers} Suppliers, ${readiness.total_inventory_records} Inventory Records, ${readiness.total_shipments} Shipments.`
                  : 'Inspecting live PostgreSQL enterprise records...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Data Score</span>
              <span className="text-lg font-bold font-mono-telemetry text-blue-400">
                {readiness ? `${readiness.readiness_score_pct}%` : '...'}
              </span>
            </div>
            {readiness && readiness.recommendations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReadinessDetails(!showReadinessDetails)}
                rightIcon={showReadinessDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              >
                Tips
              </Button>
            )}
          </div>
        </div>

        {/* Expandable recommendations */}
        <AnimatePresence>
          {showReadinessDetails && readiness && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-3 border-t border-white/5 space-y-2 overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {readiness.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Preset Scenarios Grid */}
      <div>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
          Fast-Track Incident Presets
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {presets.map((preset, idx) => {
            const Icon = preset.icon;
            return (
              <div
                key={idx}
                onClick={() => handleApplyPreset(preset)}
                className="p-4 rounded-xl glass-panel border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-white/5 group-hover:bg-blue-500/20 text-blue-400 transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono-telemetry text-slate-400">
                    +{preset.days}d / {preset.severity}%
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-slate-100 group-hover:text-white line-clamp-1">
                  {preset.name}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {preset.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Main Form & Pre-Computation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Configuration Form */}
        <div className="lg:col-span-2 space-y-5 rounded-2xl glass-panel border border-white/10 p-6">
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>Disruption Parameters & Target Entities</span>
          </h3>

          {/* Scenario Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Scenario Title</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 focus:border-blue-500/60 text-white text-sm focus:outline-none transition-colors"
            />
          </div>

          {/* Disruption Type & Target Product / SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Disruption Vector</label>
              <select
                value={disruptionType}
                onChange={(e) => setDisruptionType(e.target.value as DisruptionScenarioType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs focus:border-blue-500/60 focus:outline-none cursor-pointer"
              >
                <option value="port_closure">Port Bottleneck / Maritime Terminal Congestion</option>
                <option value="supplier_outage">Tier-1 Supplier Facility Outage / Contamination</option>
                <option value="freight_delay">Trans-Pacific Freight Route Interruption</option>
                <option value="demand_surge">Customer Demand Surge (+40% Spike)</option>
                <option value="raw_material_spike">Upstream Raw Material Commodity Spike</option>
                <option value="geopolitical_embargo">Trade Sanction / Geopolitical Export Embargo</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Target Product / SKU</span>
                <span className="text-[10px] text-blue-400">PostgreSQL Live</span>
              </label>
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs focus:border-blue-500/60 focus:outline-none cursor-pointer"
              >
                {productsList.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} {p.unit_cost_usd ? `[$${p.unit_cost_usd.toFixed(0)}]` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary & Backup Suppliers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Primary Impacted Supplier</label>
              <select
                value={primarySupplierId}
                onChange={(e) => {
                  setPrimarySupplierId(e.target.value);
                  const found = suppliersList.find((s) => s.value === e.target.value);
                  if (found) setPrimarySupplierName(found.label);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs focus:border-blue-500/60 focus:outline-none cursor-pointer"
              >
                {suppliersList.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} ({s.lead_time_days}d lead time)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Alternative Qualified Supplier (Backup)</label>
              <select
                value={alternativeSupplierId}
                onChange={(e) => {
                  setAlternativeSupplierId(e.target.value);
                  const found = suppliersList.find((s) => s.value === e.target.value);
                  if (found) setAlternativeSupplierName(found.label);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs focus:border-blue-500/60 focus:outline-none cursor-pointer"
              >
                {suppliersList.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} ({s.lead_time_days}d lead time)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sliders: Duration & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Disruption Duration: {durationDays} Days</span>
                </span>
                <span className="text-slate-400 font-mono-telemetry">1 - 60 Days</span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-rose-400" />
                  <span>Severity Level: {severityPct}%</span>
                </span>
                <span className="text-slate-400 font-mono-telemetry">10% - 100%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={severityPct}
                onChange={(e) => setSeverityPct(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          {/* Optimization Objective Selector */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <label className="text-xs font-semibold text-slate-300 block">
              Decision Optimization Objective
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'balanced', label: 'Balanced', desc: 'Trade-off optimal' },
                { id: 'minimize_cost', label: 'Minimize Cost', desc: 'Preserves budget' },
                { id: 'minimize_delay', label: 'Minimize Delay', desc: 'Rapid fulfillment' },
                { id: 'maximize_service_level', label: 'Max Fill Rate', desc: 'Zero stockouts' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setObjective(item.id as OptimizationObjective)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    objective === item.id
                      ? 'bg-blue-500/20 border-blue-500/60 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-900/60 border-white/5 hover:border-white/20'
                  }`}
                >
                  <p className={`text-xs font-bold ${objective === item.id ? 'text-white' : 'text-slate-300'}`}>
                    {item.label}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Operational Parameters & Constraints */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">On-Hand Inventory</label>
              <input
                type="number"
                value={initialInventory}
                onChange={(e) => setInitialInventory(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono-telemetry"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Order Quantity</label>
              <input
                type="number"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono-telemetry"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Safety Buffer</label>
              <input
                type="number"
                value={safetyStock}
                onChange={(e) => setSafetyStock(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono-telemetry"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Daily Demand</label>
              <input
                type="number"
                value={dailyDemand}
                onChange={(e) => setDailyDemand(Math.max(0.1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono-telemetry"
              />
            </div>
          </div>

          {/* Optional Constraints */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>Budget Cap Cap ($ USD)</span>
                <span className="text-[10px] text-slate-500">Optional</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 50000"
                value={budgetLimitUsd}
                onChange={(e) => setBudgetLimitUsd(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono-telemetry"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>Max Acceptable Delay (Days)</span>
                <span className="text-[10px] text-slate-500">Optional</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 5"
                value={maxDelayDays}
                onChange={(e) => setMaxDelayDays(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono-telemetry"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Pre-Computation Preview & Launch Card */}
        <div className="rounded-2xl glass-panel border border-blue-500/30 p-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white font-display">Simulated Disruption Impact</h3>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-rose-500/20 space-y-1">
                <span className="text-[11px] text-rose-300 font-semibold uppercase tracking-wider">Unmitigated Exposure:</span>
                <p className="text-2xl font-bold text-rose-400 font-mono-telemetry">
                  ~${estimatedRevenueRisk}
                </p>
                <p className="text-[10px] text-slate-400">Direct shortage penalty + holding costs</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/20 space-y-1">
                <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider">Delivery Delay:</span>
                <p className="text-2xl font-bold text-amber-300 font-mono-telemetry">
                  +{estimatedDelayDays} Days
                </p>
                <p className="text-[10px] text-slate-400">Primary supplier delivery variance</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                <span className="text-[11px] text-slate-400 font-semibold block">Mitigation Strategies Evaluated:</span>
                <ul className="text-xs text-slate-300 space-y-1 font-mono-telemetry">
                  <li className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 1. Switch Supplier
                  </li>
                  <li className="flex items-center gap-1.5 text-cyan-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 2. Split Procurement (Dual-Sourcing)
                  </li>
                  <li className="flex items-center gap-1.5 text-purple-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 3. Expedited Air Freight
                  </li>
                  <li className="flex items-center gap-1.5 text-amber-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 4. Accept Risk & Buffer Rationing
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {simError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {simError}
              </div>
            )}

            {isLaunching && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs flex items-center justify-center gap-2 animate-pulse">
                <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
                <span>Simulating 30-day horizon & synthesizing Gemini AI decision intelligence...</span>
              </div>
            )}

            <Button
              variant="glow"
              size="lg"
              className="w-full"
              isLoading={isLaunching || isSimulating}
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              onClick={handleStartSimulation}
            >
              {isLaunching ? 'Computing Scenario Telemetry...' : 'Launch AI Disruption Simulation'}
            </Button>
            <p className="text-center text-[10px] text-slate-400 font-mono-telemetry">
              Generates deterministic KPIs, Gemini insights & downloadable evidence report
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
