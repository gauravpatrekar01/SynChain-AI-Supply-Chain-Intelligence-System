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
  MapPin,
  Factory,
  Navigation,
  ArrowRight,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import {
  DisruptionScenarioType,
  OptimizationObjective,
  DataReadinessCheck,
  ScenarioConfigOption,
  OrganizationOption,
  ScenarioSimulationRequest,
  ProductRecommendationSummary,
} from '../../types/scenario';
import { Button } from '../common/Button';
import { GlassCard } from '../common/GlassCard';
import { NeonBadge } from '../common/NeonBadge';
import { Tooltip } from '../common/Tooltip';
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

  // Organization & Product Selection (PostgreSQL Live)
  const [organizationsList, setOrganizationsList] = useState<OrganizationOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [selectedSku, setSelectedSku] = useState('SYN-TEST-101');

  // Inventory & Replenishment Parameters
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

  // Recommendations & Mitigation Strategy Intelligence for Active Product
  const [productRecs, setProductRecs] = useState<ProductRecommendationSummary | null>(null);
  const [isLoadingProductRecs, setIsLoadingProductRecs] = useState(false);
  const [productRecsError, setProductRecsError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Load Verified Database Readiness & Entities on Mount & Ingestion Events
  // -------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    const loadData = () => {
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
            setOrganizationsList(data.organizations || []);
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
    };

    loadData();

    const handleImported = () => {
      loadData();
    };

    window.addEventListener('synchain_data_imported', handleImported);

    return () => {
      mounted = false;
      window.removeEventListener('synchain_data_imported', handleImported);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Organization-filtered Products & Live Database Route Synchronization
  // -------------------------------------------------------------------------
  const filteredProducts = React.useMemo(() => {
    if (selectedOrgId === 'all') return productsList;
    const cleanOrgId = selectedOrgId.toLowerCase();
    const importIdMatch = selectedOrgId.startsWith('wms_') ? selectedOrgId.replace('wms_', '') : '';
    const buCategory = selectedOrgId.startsWith('bu_') ? selectedOrgId.replace('bu_', '').toLowerCase() : '';

    return productsList.filter((p) => {
      // 1. Direct match on organization_id
      if (p.organization_id === selectedOrgId) return true;
      // 2. Multi-organization membership list
      if (p.organization_ids && p.organization_ids.includes(selectedOrgId)) return true;
      // 3. WMS Import match
      if (importIdMatch && p.import_id && String(p.import_id) === importIdMatch) return true;
      if (p.import_id && `wms_${p.import_id}` === selectedOrgId) return true;
      // 4. Category / Business Unit match
      if (buCategory && p.category?.toLowerCase() === buCategory) return true;
      // 5. Case-insensitive name match
      if (p.organization_name && p.organization_name.toLowerCase() === cleanOrgId) return true;
      return false;
    });
  }, [productsList, selectedOrgId]);

  // When organization changes, ensure selected SKU is in the filtered list or cleared
  useEffect(() => {
    if (filteredProducts.length > 0) {
      const exists = filteredProducts.some((p) => p.value === selectedSku);
      if (!exists) {
        setSelectedSku(filteredProducts[0].value);
      }
    } else {
      setSelectedSku('');
    }
  }, [selectedOrgId, filteredProducts, selectedSku]);

  // Active product with verified DB values
  const currentProduct = React.useMemo(() => {
    if (!selectedSku || filteredProducts.length === 0) return null;
    return filteredProducts.find((p) => p.value === selectedSku) || productsList.find((p) => p.value === selectedSku) || filteredProducts[0] || null;
  }, [productsList, filteredProducts, selectedSku]);

  // Fetch real-time recommendation intelligence and mitigation strategy eligibility on product selection
  useEffect(() => {
    if (!selectedSku) {
      setProductRecs(null);
      setIsLoadingProductRecs(false);
      return;
    }

    let isMounted = true;
    setIsLoadingProductRecs(true);
    setProductRecsError(null);

    apiService
      .getProductRecommendations(selectedSku)
      .then((data) => {
        if (isMounted) {
          setProductRecs(data);
          setIsLoadingProductRecs(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setProductRecs(null);
          setProductRecsError(err?.response?.data?.detail || 'Failed to load recommendation intelligence');
          setIsLoadingProductRecs(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSku]);

  // Auto-sync initial stock, demand, safety stock, and supplier from live PostgreSQL records
  useEffect(() => {
    if (currentProduct) {
      if (currentProduct.on_hand_inventory !== undefined) {
        setInitialInventory(currentProduct.on_hand_inventory);
      }
      if (currentProduct.daily_demand !== undefined && currentProduct.daily_demand > 0) {
        setDailyDemand(currentProduct.daily_demand);
      }
      if (currentProduct.safety_stock !== undefined && currentProduct.safety_stock > 0) {
        setSafetyStock(currentProduct.safety_stock);
      }
      if (currentProduct.source_supplier_name) {
        setPrimarySupplierName(currentProduct.source_supplier_name);
        const match = suppliersList.find(
          (s) => s.label.includes(currentProduct.source_supplier_name!) || s.value === currentProduct.source_supplier_name
        );
        if (match) {
          setPrimarySupplierId(match.value);
          const alt = suppliersList.find((s) => s.value !== match.value);
          if (alt) {
            setAlternativeSupplierId(alt.value);
            setAlternativeSupplierName(alt.label);
          }
        }
      }
    }
  }, [currentProduct, suppliersList]);

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

    const activeOrg = organizationsList.find((o) => o.id === selectedOrgId);
    const orgName = activeOrg ? activeOrg.name : (currentProduct?.organization_name || 'Global Enterprise');

    const payload: ScenarioSimulationRequest = {
      scenario_name: scenarioName,
      disruption_type: disruptionType,
      organization_id: selectedOrgId !== 'all' ? selectedOrgId : undefined,
      organization_name: orgName,
      sku: selectedSku,
      target_product_id: currentProduct?.value,
      target_supplier_id: primarySupplierId || undefined,
      target_supplier_name: primarySupplierName,
      alternative_supplier_id: alternativeSupplierId || undefined,
      alternative_supplier_name: alternativeSupplierName,
      source_warehouse_name: currentProduct?.source_warehouse_name,
      source_address: currentProduct?.source_address || 'Address not available',
      destination_warehouse_name: currentProduct?.destination_warehouse_name,
      destination_address: currentProduct?.destination_address || 'Address not available',
      carrier_name: currentProduct?.carrier_name || 'DHL Express Freight',
      transport_mode: currentProduct?.transport_mode || 'Air',
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
              Supply Chain Scenario Simulator
            </h2>
            <NeonBadge variant="blue" size="sm">
              ENGINE V2.1
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Test what happens during supply chain disruptions and explore AI-recommended recovery actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileText className="w-4 h-4 text-slate-400" />}
            onClick={() => onNavigate('simulation-results')}
          >
            Past Simulation Reports
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
                <h4 className="text-sm font-bold text-white">System Data Readiness</h4>
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
                  ? `Connected to database: ${readiness.total_products} Products, ${readiness.total_suppliers} Suppliers, ${readiness.total_inventory_records} Inventory Records, ${readiness.total_shipments} Shipments.`
                  : 'Verifies whether products, suppliers, inventory, and shipment data are connected and ready for simulation.'}
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
          Quick Disruption Scenarios
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
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              <span>Disruption Details and Affected Locations</span>
            </h3>
            <Tooltip
              content={
                <div>
                  <p className="font-semibold text-white mb-1">Disruption Simulation Inputs</p>
                  <p className="mb-1"><span className="text-emerald-400 font-medium">Scenario:</span> Define the disruption type, affected product, and impact duration.</p>
                  <p><span className="text-blue-400 font-medium">AI Intelligence:</span> The system runs deterministic inventory simulations and evaluates mitigation options to find the lowest-cost recovery plan.</p>
                </div>
              }
            />
          </div>

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

          {/* STEP 2: Organization & Product Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Organization / Operating Entity</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {organizationsList.length} Units
                </span>
              </label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs focus:border-blue-500/60 focus:outline-none cursor-pointer"
              >
                {organizationsList.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} {org.product_count !== undefined ? `(${org.product_count} products)` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-purple-400" />
                  <span>Component / Product</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {isLoadingOptions ? 'Loading...' : `${filteredProducts.length} in Entity`}
                </span>
              </label>
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                disabled={isLoadingOptions || filteredProducts.length === 0}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs focus:border-blue-500/60 focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingOptions ? (
                  <option value="">Loading products from database...</option>
                ) : filteredProducts.length === 0 ? (
                  <option value="">No components found for this organization</option>
                ) : (
                  filteredProducts.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} {p.unit_cost_usd ? `[$${p.unit_cost_usd.toFixed(0)}]` : ''}
                    </option>
                  ))
                )}
              </select>
              {filteredProducts.length === 0 && !isLoadingOptions && (
                <p className="text-[11px] text-amber-400/90 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>No components registered for this organization. Select 'All Organizations' or another division.</span>
                </p>
              )}
            </div>
          </div>

          {/* Live PostgreSQL Product Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-900/50 border border-white/5 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">SKU Code</span>
              <span className="font-mono text-cyan-300 font-semibold">{currentProduct?.value || selectedSku}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Live Inventory</span>
              <span className="font-mono text-emerald-300 font-semibold">{initialInventory} units</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Unit Price / Cost</span>
              <span className="font-mono text-white font-semibold">${currentProduct?.unit_cost_usd?.toFixed(2) || '0.00'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Daily Demand</span>
              <span className="font-mono text-purple-300 font-semibold">{dailyDemand} units/day</span>
            </div>
          </div>

          {/* STEP 3: 5-Tier Supply Chain Route Architecture */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-blue-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Supply Chain Route (Verified Database Records)
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                5-Tier Traceability
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {/* Tier 1: Organization */}
              <div className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-semibold">
                  <Building2 className="w-3 h-3 text-blue-400" />
                  <span>1. Organization</span>
                </div>
                <p className="text-xs font-bold text-white truncate" title={currentProduct?.organization_name || 'Global Enterprise'}>
                  {currentProduct?.organization_name || organizationsList.find((o) => o.id === selectedOrgId)?.name || 'Global Enterprise'}
                </p>
                <p className="text-[10px] text-slate-400">
                  Operating Division
                </p>
              </div>

              {/* Tier 2: Product / Component */}
              <div className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-semibold">
                  <Package className="w-3 h-3 text-purple-400" />
                  <span>2. Component</span>
                </div>
                <p className="text-xs font-bold text-white truncate" title={currentProduct?.label || selectedSku}>
                  {currentProduct?.label || selectedSku}
                </p>
                <p className="text-[10px] text-emerald-400 font-mono">
                  ${currentProduct?.unit_cost_usd?.toFixed(0) || '0'} · {initialInventory} stock
                </p>
              </div>

              {/* Tier 3: Source Supplier & Location */}
              <div className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-semibold">
                  <Factory className="w-3 h-3 text-amber-400" />
                  <span>3. Source Hub</span>
                </div>
                <p className="text-xs font-bold text-white truncate" title={currentProduct?.source_warehouse_name || primarySupplierName}>
                  {currentProduct?.source_warehouse_name || primarySupplierName}
                </p>
                <p className="text-[10px] text-slate-400 truncate flex items-center gap-1" title={currentProduct?.source_address || 'Address not available'}>
                  <MapPin className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span>{currentProduct?.source_address || 'Address not available'}</span>
                </p>
              </div>

              {/* Tier 4: Shipment & Transport */}
              <div className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-semibold">
                  <Truck className="w-3 h-3 text-cyan-400" />
                  <span>4. Transport</span>
                </div>
                <p className="text-xs font-bold text-white truncate" title={currentProduct?.carrier_name || 'DHL Express'}>
                  {currentProduct?.carrier_name || 'DHL Express Freight'}
                </p>
                <p className="text-[10px] text-cyan-300 font-mono">
                  {currentProduct?.transport_mode || 'Air'} · {currentProduct?.lead_time_days || 5}d lead
                </p>
              </div>

              {/* Tier 5: Destination Facility */}
              <div className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-semibold">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>5. Destination</span>
                </div>
                <p className="text-xs font-bold text-white truncate" title={currentProduct?.destination_warehouse_name || 'Regional Distribution Center'}>
                  {currentProduct?.destination_warehouse_name || 'Regional Distribution Center'}
                </p>
                <p className="text-[10px] text-slate-400 truncate flex items-center gap-1" title={currentProduct?.destination_address || 'Address not available'}>
                  <MapPin className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                  <span>{currentProduct?.destination_address || 'Address not available'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* STEP 4: Define a Disruption Scenario */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Type of Disruption Scenario</label>
            <select
              value={disruptionType}
              onChange={(e) => setDisruptionType(e.target.value as DisruptionScenarioType)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs focus:border-blue-500/60 focus:outline-none cursor-pointer"
            >
              <option value="supplier_outage">Tier-1 Supplier Facility Outage / Contamination</option>
              <option value="port_closure">Port Bottleneck / Maritime Terminal Congestion</option>
              <option value="freight_delay">Trans-Pacific Freight Route Interruption</option>
              <option value="demand_surge">Customer Demand Surge (+40% Spike)</option>
              <option value="raw_material_spike">Upstream Raw Material Commodity Spike</option>
              <option value="geopolitical_embargo">Trade Sanction / Geopolitical Export Embargo</option>
            </select>
          </div>

          {/* Primary & Backup Suppliers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Supplier Affected</label>
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
              <label className="text-xs font-semibold text-slate-300">Backup Supplier</label>
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
                  <span>How Long the Problem Lasts: {durationDays} Days</span>
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
                  <span>Disruption Severity: {severityPct}%</span>
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
              Main Goal
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'balanced', label: 'Balanced', desc: 'Balances cost and delivery speed' },
                { id: 'minimize_cost', label: 'Lowest Cost', desc: 'Choose option with lowest total cost' },
                { id: 'minimize_delay', label: 'Fastest Delivery', desc: 'Choose option that reduces delivery delays' },
                { id: 'maximize_service_level', label: 'Fulfill All Orders', desc: 'Fulfill as many orders as possible' },
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
              <label className="text-[11px] font-semibold text-slate-400">Current Stock</label>
              <input
                type="number"
                value={initialInventory}
                onChange={(e) => setInitialInventory(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono-telemetry"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Standard Order Size</label>
              <input
                type="number"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono-telemetry"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Extra Safety Stock</label>
              <input
                type="number"
                value={safetyStock}
                onChange={(e) => setSafetyStock(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono-telemetry"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Expected Daily Demand</label>
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
                <span>Maximum Budget ($ USD)</span>
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
                <span>Maximum Acceptable Delay (Days)</span>
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
              <h3 className="text-base font-bold text-white font-display">Estimated Disruption Impact</h3>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-rose-500/20 space-y-1">
                <span className="text-[11px] text-rose-300 font-semibold uppercase tracking-wider">Estimated Cost Without Action:</span>
                <p className="text-2xl font-bold text-rose-400 font-mono-telemetry">
                  ~${estimatedRevenueRisk}
                </p>
                <p className="text-[11px] text-slate-400">Estimated financial loss from shortages and penalties</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/20 space-y-1">
                <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider">Expected Delivery Delay:</span>
                <p className="text-2xl font-bold text-amber-300 font-mono-telemetry">
                  +{estimatedDelayDays} Days
                </p>
                <p className="text-[11px] text-slate-400">Additional shipping delay from the primary supplier</p>
              </div>

              {/* Recommendations & Mitigation Strategies Intelligence */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Mitigation & Recovery Intelligence
                    </span>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {selectedSku ? selectedSku : 'No SKU'}
                  </span>
                </div>

                {isLoadingProductRecs ? (
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <span>Analyzing database records, supplier options & active recommendations...</span>
                  </div>
                ) : productRecsError ? (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{productRecsError}</span>
                  </div>
                ) : !currentProduct || filteredProducts.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-white/5 text-xs text-slate-400 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Select an organization and component to view recovery recommendations.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Missing Data Fields Alert */}
                    {productRecs && productRecs.missing_fields && productRecs.missing_fields.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block">Missing Business Data:</span>
                          <span>{productRecs.missing_fields.join(', ')}</span>
                        </div>
                      </div>
                    )}

                    {/* Active Recommendations from Connected Database */}
                    {productRecs && productRecs.active_recommendations && productRecs.active_recommendations.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block">
                          Active Recommendations ({productRecs.active_recommendations.length})
                        </span>
                        {productRecs.active_recommendations.map((rec) => (
                          <div
                            key={rec.id}
                            className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white line-clamp-1">{rec.title}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                                {rec.priority}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 line-clamp-2">{rec.action || rec.benefit}</p>
                            {rec.benefit && (
                              <p className="text-[10px] text-emerald-400 font-mono font-medium">
                                {rec.benefit}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Mitigation Strategies Eligibility */}
                    {productRecs && productRecs.eligible_strategies && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Mitigation Strategy Eligibility:
                        </span>
                        <div className="space-y-1.5">
                          {productRecs.eligible_strategies.map((strat) => (
                            <div
                              key={strat.strategy_id}
                              className={`p-2 rounded-lg border text-xs transition-colors ${
                                strat.is_eligible
                                  ? 'bg-slate-950/70 border-emerald-500/30 text-slate-200'
                                  : 'bg-slate-950/40 border-white/5 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold flex items-center gap-1.5 text-xs text-white">
                                  {strat.is_eligible ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  )}
                                  <span>{strat.strategy_name}</span>
                                </span>
                                <span
                                  className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                                    strat.is_eligible
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-slate-800 text-slate-400 border border-white/5'
                                  }`}
                                >
                                  {strat.is_eligible ? 'Eligible' : 'Ineligible'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                {strat.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Next Action Prompt */}
                    {productRecs && (
                      <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-white block">Next Required Action:</span>
                          <span>{productRecs.next_required_action}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
              disabled={isLaunching || isSimulating || !selectedSku || filteredProducts.length === 0}
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              onClick={handleStartSimulation}
            >
              {isLaunching
                ? 'Computing Scenario Telemetry...'
                : filteredProducts.length === 0
                ? 'Select Organization With Components'
                : 'Run Disruption Simulation'}
            </Button>
            <p className="text-center text-[11px] text-slate-400 font-mono-telemetry">
              Calculates exact cost impacts and generates AI-recommended recovery actions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
