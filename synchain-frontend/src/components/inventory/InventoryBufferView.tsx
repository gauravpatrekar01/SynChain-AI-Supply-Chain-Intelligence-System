import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Layers,
  ArrowUpRight,
  Plus,
  Upload,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  LayoutGrid,
  List,
  Activity,
  ShieldCheck,
  TrendingUp,
  X,
  FileCheck,
  Info,
} from 'lucide-react';
import { NeonBadge } from '../common/NeonBadge';
import { Button } from '../common/Button';
import { soundFX } from '../../services/audioService';
import { apiService } from '../../services/api';
import { InventoryItem, InventorySummaryStats, RecalculateBufferResult } from '../../types';
import { ProductFormModal } from './ProductFormModal';
import { ProductImportModal } from './ProductImportModal';
import { ProductDetailsModal } from './ProductDetailsModal';
import { DeleteProductModal } from './DeleteProductModal';
import { formatApiError } from '../../utils/errorFormatter';

const defaultFallbackItems: InventoryItem[] = [
  {
    id: 'sample-1',
    sku: 'IC-3NM-A18',
    name: '3nm Ultra AI Neural Processor',
    category: 'Logic Silicon',
    facility: 'Giga Austin Warehouse',
    on_hand_units: 45000,
    reserved_units: 0,
    available_units: 45000,
    safety_stock_units: 30000,
    reorder_trigger: 35000,
    reorder_quantity: 15000,
    days_of_supply: 42,
    buffer_health_percentage: 150,
    status: 'optimal',
    price: 1250,
    onHandUnits: 45000,
    safetyStockUnits: 30000,
    daysOfSupply: 42,
    reorderTrigger: 35000,
  },
  {
    id: 'sample-2',
    sku: 'HBM3E-24G',
    name: 'High Bandwidth Memory 24GB',
    category: 'Memory IC',
    facility: 'Memphis SuperHub',
    on_hand_units: 18500,
    reserved_units: 1200,
    available_units: 17300,
    safety_stock_units: 25000,
    reorder_trigger: 28000,
    reorder_quantity: 10000,
    days_of_supply: 14,
    buffer_health_percentage: 74,
    status: 'warning',
    price: 420,
    onHandUnits: 18500,
    safetyStockUnits: 25000,
    daysOfSupply: 14,
    reorderTrigger: 28000,
  },
  {
    id: 'sample-3',
    sku: 'BATT-LFP-82K',
    name: '82kWh LFP Battery Cell Modules',
    category: 'Energy Storage',
    facility: 'Munich Mega Assembly',
    on_hand_units: 8200,
    reserved_units: 400,
    available_units: 7800,
    safety_stock_units: 6000,
    reorder_trigger: 7500,
    reorder_quantity: 4000,
    days_of_supply: 38,
    buffer_health_percentage: 137,
    status: 'optimal',
    price: 8900,
    onHandUnits: 8200,
    safetyStockUnits: 6000,
    daysOfSupply: 38,
    reorderTrigger: 7500,
  },
];

export const InventoryBufferView: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summaryStats, setSummaryStats] = useState<InventorySummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<RecalculateBufferResult | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFacility, setSelectedFacility] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<InventoryItem | null>(null);
  const [productToEdit, setProductToEdit] = useState<InventoryItem | null>(null);
  const [productToDelete, setProductToDelete] = useState<InventoryItem | null>(null);

  const loadInventory = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const inventoryProducts = await apiService.getInventoryProducts();
      setItems(inventoryProducts);
    } catch (error: unknown) {
      console.error("Failed to load inventory from PostgreSQL:", error);
      const friendlyMessage = formatApiError(
        error,
        "Unable to retrieve inventory records from PostgreSQL database. Please try again."
      );
      setLoadError(friendlyMessage);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();

    const handleSync = () => {
      loadInventory();
    };
    window.addEventListener('synchain_data_imported', handleSync);
    return () => window.removeEventListener('synchain_data_imported', handleSync);
  }, []);

  // Recalculate Multi-Echelon Buffer
  const handleRecalculateBuffer = async () => {
    setIsRecalculating(true);
    setRecalcResult(null);
    try {
      soundFX.playClick();
      const res = await apiService.recalculateInventoryBuffer();
      setRecalcResult(res);
      soundFX.playSuccess();
      await loadInventory();
    } catch (err: any) {
      soundFX.playError();
      console.error('Recalculation error', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  // Distinct Categories and Facilities for Filter dropdowns
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  const availableFacilities = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.facility) set.add(i.facility);
    });
    return Array.from(set);
  }, [items]);

  // Client-side filtering when user searches or filters locally
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.facility.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (selectedFacility !== 'all' && item.facility !== selectedFacility) {
        return false;
      }
      if (selectedStatus !== 'all' && item.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [items, searchQuery, selectedCategory, selectedFacility, selectedStatus]);

  // Aggregate stats
  const totalOnHand = useMemo(
    () => filteredItems.reduce((acc, i) => acc + (i.on_hand_units ?? i.onHandUnits ?? 0), 0),
    [filteredItems]
  );
  const totalSafety = useMemo(
    () => filteredItems.reduce((acc, i) => acc + (i.safety_stock_units ?? i.safetyStockUnits ?? 0), 0),
    [filteredItems]
  );
  const criticalCount = useMemo(
    () => filteredItems.filter((i) => i.status === 'critical').length,
    [filteredItems]
  );
  const warningCount = useMemo(
    () => filteredItems.filter((i) => i.status === 'warning').length,
    [filteredItems]
  );
  const optimalCount = useMemo(
    () => filteredItems.filter((i) => i.status === 'optimal').length,
    [filteredItems]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Global Inventory & Safety Stock Buffer
            </h2>
            <NeonBadge variant="cyan" size="sm">
              MULTI-ECHELON
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time stock velocity, safety buffer floor monitoring, and automated ERP reorder triggers.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              soundFX.playClick();
              setIsImportModalOpen(true);
            }}
            leftIcon={<Upload className="w-3.5 h-3.5" />}
          >
            Import CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              soundFX.playClick();
              setProductToEdit(null);
              setIsAddModalOpen(true);
            }}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Product
          </Button>

          <Button
            variant="glow"
            size="sm"
            isLoading={isRecalculating || isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={handleRecalculateBuffer}
          >
            Re-Calculate Multi-Echelon Buffer
          </Button>
        </div>
      </div>

      {/* Recalculation Results Banner */}
      {recalcResult && (
        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-start justify-between gap-3 text-cyan-200 text-xs sm:text-sm font-mono-telemetry animate-fade-in">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Multi-Echelon Buffer Recalculation Complete</p>
              <p className="text-cyan-300/90 mt-0.5">{recalcResult.message}</p>
              <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-slate-300">
                <span>
                  Statistical Model: <strong className="text-emerald-400">{recalcResult.statistical_count}</strong>
                </span>
                <span>
                  Parametric Formulas: <strong className="text-cyan-400">{recalcResult.parametric_count}</strong>
                </span>
                <span>
                  Insufficient Data: <strong className="text-amber-400">{recalcResult.insufficient_data_count}</strong>
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setRecalcResult(null)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Database Loading Error Alert */}
      {loadError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start justify-between gap-3 text-rose-200 text-xs sm:text-sm font-mono-telemetry animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Database Synchronization Error</p>
              <p className="text-rose-300/90 mt-0.5">{loadError}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="glow"
              size="sm"
              isLoading={isLoading}
              onClick={() => {
                soundFX.playClick();
                loadInventory();
              }}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
            <button
              onClick={() => setLoadError(null)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KPI Summary Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl glass-panel border border-white/10 font-mono-telemetry">
          <span className="text-[10px] uppercase text-slate-400 block tracking-wider">Tracked Products</span>
          <span className="text-lg sm:text-xl font-bold text-white mt-1 block">
            {filteredItems.length}
          </span>
          <span className="text-[10px] text-slate-500">PostgreSQL active records</span>
        </div>

        <div className="p-3.5 rounded-2xl glass-panel border border-white/10 font-mono-telemetry">
          <span className="text-[10px] uppercase text-slate-400 block tracking-wider">Gross On-Hand</span>
          <span className="text-lg sm:text-xl font-bold text-cyan-300 mt-1 block">
            {totalOnHand.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-500">Units in physical storage</span>
        </div>

        <div className="p-3.5 rounded-2xl glass-panel border border-white/10 font-mono-telemetry">
          <span className="text-[10px] uppercase text-slate-400 block tracking-wider">Safety Floor Floor</span>
          <span className="text-lg sm:text-xl font-bold text-blue-300 mt-1 block">
            {totalSafety.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-500">Aggregate reserve threshold</span>
        </div>

        <div className="p-3.5 rounded-2xl glass-panel border border-white/10 font-mono-telemetry">
          <span className="text-[10px] uppercase text-slate-400 block tracking-wider">Critical Depletion</span>
          <span className="text-lg sm:text-xl font-bold text-rose-400 mt-1 block">
            {criticalCount}
          </span>
          <span className="text-[10px] text-rose-500/80">Below safety stock floor</span>
        </div>

        <div className="col-span-2 md:col-span-1 p-3.5 rounded-2xl glass-panel border border-white/10 font-mono-telemetry">
          <span className="text-[10px] uppercase text-slate-400 block tracking-wider">Health Status</span>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs font-bold text-emerald-400">{optimalCount} Optimal</span>
            <span className="text-slate-600">•</span>
            <span className="text-xs font-bold text-amber-400">{warningCount} Low</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Multi-echelon distribution</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl glass-panel border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name, SKU, warehouse, category..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 text-white placeholder-slate-500 text-xs font-mono-telemetry focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 text-slate-300 text-xs font-mono-telemetry focus:border-cyan-500/60 focus:outline-none transition-all"
          >
            <option value="all">All Categories</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Facility Filter */}
          <select
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 text-slate-300 text-xs font-mono-telemetry focus:border-cyan-500/60 focus:outline-none transition-all"
          >
            <option value="all">All Facilities</option>
            {availableFacilities.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 text-slate-300 text-xs font-mono-telemetry focus:border-cyan-500/60 focus:outline-none transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="optimal">Optimal</option>
            <option value="warning">Warning / Low</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/10 self-end md:self-center">
          <button
            onClick={() => {
              soundFX.playClick();
              setViewMode('cards');
            }}
            className={`p-1.5 rounded-lg text-xs font-mono-telemetry flex items-center gap-1.5 transition-all ${viewMode === 'cards'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white'
              }`}
            title="Card Grid View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            onClick={() => {
              soundFX.playClick();
              setViewMode('table');
            }}
            className={`p-1.5 rounded-lg text-xs font-mono-telemetry flex items-center gap-1.5 transition-all ${viewMode === 'table'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white'
              }`}
            title="Enterprise Table View"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      {isLoading && items.length === 0 ? (
        <div className="p-16 text-center rounded-2xl glass-panel border border-white/10 space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <h4 className="text-base font-bold text-white">Loading Inventory Records...</h4>
          <p className="text-xs text-slate-400 font-mono-telemetry max-w-sm mx-auto">
            Synchronizing live inventory quantities, buffer thresholds, and warehouse allocations from PostgreSQL.
          </p>
        </div>
      ) : !isLoading && loadError && items.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-rose-500/20 bg-rose-500/5 space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">Unable to Load Inventory Data</h4>
          <p className="text-xs text-slate-300 font-mono-telemetry max-w-md mx-auto">
            {loadError}
          </p>
          <div className="pt-2">
            <Button
              variant="glow"
              size="sm"
              onClick={() => {
                soundFX.playClick();
                loadInventory();
              }}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry Database Request
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">No Inventory Records Found</h4>
          <p className="text-xs text-slate-400 font-mono-telemetry max-w-sm mx-auto">
            Your database currently contains no inventory records. Add your first product manually or bulk import via CSV.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                soundFX.playClick();
                setIsImportModalOpen(true);
              }}
              leftIcon={<Upload className="w-3.5 h-3.5" />}
            >
              Import CSV
            </Button>
            <Button
              variant="glow"
              size="sm"
              onClick={() => {
                soundFX.playClick();
                setProductToEdit(null);
                setIsAddModalOpen(true);
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Product
            </Button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <Filter className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">No Matching Inventory Products</h4>
          <p className="text-xs text-slate-400 font-mono-telemetry max-w-sm mx-auto">
            No products match the selected search or filter criteria. Try clearing filters or searching for a different keyword.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedFacility('all');
                setSelectedStatus('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* Inventory Cards Grid (Preserving exact layout and aesthetics) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const onHand = item.on_hand_units ?? item.onHandUnits ?? 0;
            const reserved = item.reserved_units ?? item.reservedUnits ?? 0;
            const available = item.available_units ?? item.availableUnits ?? Math.max(0, onHand - reserved);
            const safety = item.safety_stock_units ?? item.safetyStockUnits ?? 100;
            const daysSupply = item.days_of_supply ?? item.daysOfSupply ?? 30;
            const bufferPct =
              item.buffer_health_percentage ??
              item.bufferPct ??
              (safety > 0 ? Math.round((available / safety) * 100) : 100);

            return (
              <div
                key={item.sku + '-' + (item.id || item.facility)}
                className="p-5 rounded-2xl glass-panel border border-white/10 hover:border-blue-500/40 space-y-4 transition-all group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono-telemetry uppercase text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                        {item.category}
                      </span>
                      <h4
                        onClick={() => {
                          soundFX.playClick();
                          setSelectedProductForDetails(item);
                        }}
                        className="text-sm font-bold text-white mt-1.5 group-hover:text-cyan-300 transition-colors cursor-pointer"
                      >
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono-telemetry">
                        {item.sku} • {item.facility}
                      </p>
                    </div>
                    <NeonBadge variant={item.status} size="sm">
                      {item.status.toUpperCase()}
                    </NeonBadge>
                  </div>

                  {/* Buffer Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono-telemetry">
                      <span className="text-slate-400">Buffer Health:</span>
                      <span className="font-semibold text-white">
                        {bufferPct}% ({daysSupply} Days)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.status === 'critical'
                          ? 'bg-rose-500'
                          : item.status === 'warning'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                          }`}
                        style={{ width: `${Math.min(bufferPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics Box */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/80 border border-white/5 text-xs font-mono-telemetry">
                    <div>
                      <span className="text-slate-400 block text-[10px]">On Hand:</span>
                      <span className="font-bold text-white">{onHand.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Safety Floor:</span>
                      <span className="text-slate-300">{safety.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono-telemetry">
                  <button
                    onClick={() => {
                      soundFX.playClick();
                      setSelectedProductForDetails(item);
                    }}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        soundFX.playClick();
                        setProductToEdit(item);
                        setIsAddModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
                      title="Edit Product"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        soundFX.playClick();
                        setProductToDelete(item);
                      }}
                      className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Enterprise Table Ledger */
        <div className="rounded-2xl border border-white/10 glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-telemetry">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-4 py-3">Product Name & SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3 text-right">On Hand</th>
                  <th className="px-4 py-3 text-right">Reserved</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-right">Safety Floor</th>
                  <th className="px-4 py-3 text-right">Reorder Pt</th>
                  <th className="px-4 py-3 text-right">Coverage</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {filteredItems.map((item) => {
                  const onHand = item.on_hand_units ?? item.onHandUnits ?? 0;
                  const reserved = item.reserved_units ?? item.reservedUnits ?? 0;
                  const available = item.available_units ?? item.availableUnits ?? Math.max(0, onHand - reserved);
                  const safety = item.safety_stock_units ?? item.safetyStockUnits ?? 0;
                  const reorder = item.reorder_trigger ?? item.reorderTrigger ?? 0;
                  const daysSupply = item.days_of_supply ?? item.daysOfSupply ?? 30;
                  const bufferPct =
                    item.buffer_health_percentage ??
                    item.bufferPct ??
                    (safety > 0 ? Math.round((available / safety) * 100) : 100);

                  return (
                    <tr key={item.id || item.sku} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            soundFX.playClick();
                            setSelectedProductForDetails(item);
                          }}
                          className="text-left font-bold text-white hover:text-cyan-400 transition-colors block"
                        >
                          {item.name}
                        </button>
                        <span className="text-[11px] text-slate-400">{item.sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{item.facility}</td>
                      <td className="px-4 py-3 text-right font-bold text-white">{onHand.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-amber-300">{reserved.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-emerald-300">{available.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{safety.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{reorder.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-white font-semibold">
                        {bufferPct}% ({daysSupply}d)
                      </td>
                      <td className="px-4 py-3 text-center">
                        <NeonBadge variant={item.status} size="sm">
                          {item.status.toUpperCase()}
                        </NeonBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              soundFX.playClick();
                              setSelectedProductForDetails(item);
                            }}
                            className="p-1 rounded text-cyan-400 hover:text-cyan-300 hover:bg-white/5 transition-colors"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              soundFX.playClick();
                              setProductToEdit(item);
                              setIsAddModalOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                            title="Edit Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              soundFX.playClick();
                              setProductToDelete(item);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <ProductFormModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setProductToEdit(null);
        }}
        onSuccess={() => {
          loadInventory();
        }}
        productToEdit={productToEdit}
      />

      {/* Import CSV Modal */}
      <ProductImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          loadInventory();
        }}
      />

      {/* Product Details Dossier Modal */}
      <ProductDetailsModal
        isOpen={Boolean(selectedProductForDetails)}
        onClose={() => setSelectedProductForDetails(null)}
        product={selectedProductForDetails}
        onEdit={(prod) => {
          setSelectedProductForDetails(null);
          setProductToEdit(prod);
          setIsAddModalOpen(true);
        }}
        onDelete={(prod) => {
          setSelectedProductForDetails(null);
          setProductToDelete(prod);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteProductModal
        isOpen={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        product={productToDelete}
        onSuccess={() => {
          loadInventory();
        }}
      />
    </div>
  );
};