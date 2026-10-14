import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Truck,
  Ship,
  Plane,
  Train,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  MapPin,
  Package,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { Shipment, ShipmentSummary } from '../../types';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';
import { apiService } from '../../services/api';
import { ShipmentSummaryCards } from './ShipmentSummaryCards';
import { ShipmentFormModal } from './ShipmentFormModal';
import { ShipmentDetailsModal } from './ShipmentDetailsModal';
import { DeleteShipmentModal } from './DeleteShipmentModal';

interface LiveShipmentsViewProps {
  onNavigate: (pageId: string) => void;
}

export const LiveShipmentsView: React.FC<LiveShipmentsViewProps> = ({ onNavigate }) => {
  const { setShipments: updateGlobalShipments } = useSupplyChain();

  // State
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [summary, setSummary] = useState<ShipmentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [shipmentToEdit, setShipmentToEdit] = useState<Shipment | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);

  // Auto-dismiss notification after 4s
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  // Load shipments and summary from backend
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [listRes, summaryRes] = await Promise.all([
        apiService.getShipmentsList({
          search: search.trim() || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          risk_level: riskFilter !== 'all' ? riskFilter : undefined,
          transport_mode: modeFilter !== 'all' ? modeFilter : undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
          page: currentPage,
          page_size: pageSize,
        }),
        apiService.getShipmentSummary(),
      ]);

      setShipments(listRes.items || []);
      setTotalCount(listRes.total || 0);
      setTotalPages(listRes.pages || 1);
      setSummary(summaryRes);

      // Keep global SupplyChainContext updated for geomap & topbar
      if (listRes.items && listRes.items.length > 0) {
        updateGlobalShipments(listRes.items);
      }
    } catch (err: any) {
      console.error('Failed to load shipments from FastAPI backend:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to retrieve shipments from database.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search, statusFilter, riskFilter, modeFilter, sortBy, sortOrder, currentPage, pageSize, updateGlobalShipments]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    soundFX.playClick();
    loadData(true);
  };

  const handleOpenAdd = () => {
    soundFX.playClick();
    setShipmentToEdit(null);
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (s: Shipment, e: React.MouseEvent) => {
    e.stopPropagation();
    soundFX.playClick();
    setShipmentToEdit(s);
    setIsAddEditOpen(true);
  };

  const handleOpenDetails = (s: Shipment) => {
    soundFX.playClick();
    setSelectedShipment(s);
    setIsDetailsOpen(true);
  };

  const handleOpenDelete = (s: Shipment, e: React.MouseEvent) => {
    e.stopPropagation();
    soundFX.playClick();
    setShipmentToDelete(s);
    setIsDeleteOpen(true);
  };

  const handleRecalculateRiskDirect = async (s: Shipment, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetId = s.shipment_id || s.id;
    setRecalculatingId(targetId);
    soundFX.playClick();

    try {
      await apiService.recalculateShipmentRisk(targetId);
      setNotification({
        type: 'success',
        message: `Risk score successfully recalculated for ${targetId}.`,
      });
      loadData(true);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to recalculate risk.',
      });
    } finally {
      setRecalculatingId(null);
    }
  };

  const handleSavedShipment = (saved: Shipment) => {
    setNotification({
      type: 'success',
      message: `Shipment ${saved.shipment_id || saved.id} successfully saved to PostgreSQL ledger.`,
    });
    loadData(true);
  };

  const handleDeletedShipment = (deletedId: string) => {
    setNotification({
      type: 'success',
      message: `Shipment ${deletedId} successfully removed from PostgreSQL ledger.`,
    });
    loadData(true);
  };

  const handleShipmentUpdatedFromModal = (updated: Shipment) => {
    setSelectedShipment(updated);
    loadData(true);
  };

  const toggleSort = (colKey: string) => {
    soundFX.playClick();
    if (sortBy === colKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(colKey);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const getModeIcon = (modeStr?: string) => {
    const clean = (modeStr || 'ocean').toLowerCase();
    if (clean === 'air') return <Plane className="w-4 h-4 text-cyan-400" />;
    if (clean === 'rail') return <Train className="w-4 h-4 text-purple-400" />;
    if (clean === 'ground' || clean === 'road') return <Truck className="w-4 h-4 text-blue-400" />;
    return <Ship className="w-4 h-4 text-blue-400" />;
  };

  const getRiskBadgeProps = (level?: string) => {
    const lvl = (level || 'LOW').toUpperCase();
    switch (lvl) {
      case 'CRITICAL':
        return { variant: 'critical' as const, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
      case 'HIGH':
        return { variant: 'high' as const, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
      case 'MEDIUM':
        return { variant: 'medium' as const, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
      case 'LOW':
      default:
        return { variant: 'optimal' as const, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    }
  };

  const getStatusBadgeProps = (statusStr: string) => {
    const st = (statusStr || '').toLowerCase();
    switch (st) {
      case 'delayed':
        return { variant: 'warning' as const, label: 'DELAYED' };
      case 'delivered':
        return { variant: 'optimal' as const, label: 'DELIVERED' };
      case 'cancelled':
        return { variant: 'critical' as const, label: 'CANCELLED' };
      case 'pending':
        return { variant: 'neutral' as const, label: 'PENDING' };
      case 'in_transit':
      default:
        return { variant: 'cyan' as const, label: 'IN TRANSIT' };
    }
  };

  const formatDate = (val?: string) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return val;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all shadow-lg backdrop-blur-md ${
            notification.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-emerald-500/10'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-rose-500/10'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium font-mono-telemetry">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white px-1.5 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* A. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Live Fleet Transit & Shipments Ledger
            </h2>
            <NeonBadge variant="cyan" size="sm">
              {summary ? `${summary.in_transit} IN TRANSIT` : 'OPERATIONAL'}
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Monitor shipments, delivery risks, and transportation status.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Shipments from PostgreSQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Shipments</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:opacity-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Shipment</span>
          </button>
        </div>
      </div>

      {/* B. Summary Cards */}
      <ShipmentSummaryCards summary={summary} isLoading={isLoading && !summary} />

      {/* C. Shipment Table & Search / Filter Controls */}
      <div className="p-5 rounded-2xl glass-panel border border-white/10 space-y-4">
        {/* Filter Controls Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by ID, name, supplier, cargo, origin, destination..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                soundFX.playClick();
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer"
            >
              <option value="all">Status: All</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="delayed">Delayed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Risk Level Filter */}
            <select
              value={riskFilter}
              onChange={(e) => {
                soundFX.playClick();
                setRiskFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer"
            >
              <option value="all">Risk: All</option>
              <option value="LOW">Low (0-29)</option>
              <option value="MEDIUM">Medium (30-59)</option>
              <option value="HIGH">High (60-79)</option>
              <option value="CRITICAL">Critical (80-100)</option>
            </select>

            {/* Transport Mode Pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-white/10">
              {(['all', 'Ocean', 'Air', 'Ground', 'Rail'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    soundFX.playClick();
                    setModeFilter(m);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    modeFilter === m ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadData()}
              className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table Content */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/90 border-b border-white/10 text-slate-400 font-medium">
                <th
                  onClick={() => toggleSort('shipment_id')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Shipment ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('shipment_name')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Shipment Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3">Origin &rarr; Destination</th>
                <th className="py-3 px-3">Cargo / Product</th>
                <th className="py-3 px-3">Mode</th>
                <th
                  onClick={() => toggleSort('departure_date')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Departure</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('eta')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Expected ETA</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('status')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('risk_score')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Risk Score</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3">Risk Level</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5 font-normal text-slate-200">
              {isLoading && shipments.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                      <span className="font-mono-telemetry">Querying PostgreSQL live fleet ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <Package className="w-8 h-8 text-slate-600" />
                      <p className="font-semibold text-white">No shipments found</p>
                      <p className="text-[11px] text-slate-500">
                        No consignments match your current filters. Clear the search parameters or add a new shipment to start tracking.
                      </p>
                      <button
                        onClick={handleOpenAdd}
                        className="mt-2 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
                      >
                        + Add First Shipment
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                shipments.map((s) => {
                  const statusProps = getStatusBadgeProps(s.status);
                  const riskProps = getRiskBadgeProps(s.risk_level);
                  const isRecalc = recalculatingId === (s.shipment_id || s.id);

                  return (
                    <tr
                      key={s.id}
                      onClick={() => handleOpenDetails(s)}
                      className="hover:bg-blue-600/5 transition-colors cursor-pointer group"
                    >
                      {/* Shipment ID */}
                      <td className="py-3 px-3 font-mono-telemetry font-bold text-blue-400 whitespace-nowrap">
                        {s.shipment_id || s.id}
                      </td>

                      {/* Shipment Name */}
                      <td className="py-3 px-3 font-medium text-white max-w-[180px] truncate" title={s.shipment_name || s.vesselName}>
                        {s.shipment_name || s.vesselName || 'Fleet Transit'}
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-3 text-cyan-300 max-w-[140px] truncate">
                        {s.supplier_name || 'Direct / Internal'}
                      </td>

                      {/* Origin -> Destination */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[90px]" title={s.origin}>{s.origin}</span>
                          <span className="text-slate-500">&rarr;</span>
                          <span className="truncate max-w-[90px] font-semibold text-white" title={s.destination}>{s.destination}</span>
                        </div>
                      </td>

                      {/* Cargo & Quantity */}
                      <td className="py-3 px-3 text-slate-300 max-w-[160px] truncate" title={s.cargo_description || s.cargoDescription}>
                        <span className="font-mono-telemetry text-slate-400">{(s.quantity || 1).toLocaleString()}x </span>
                        <span>{s.cargo_description || s.cargoDescription}</span>
                      </td>

                      {/* Transport Mode */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 capitalize">
                          {getModeIcon(s.transport_mode || s.mode)}
                          <span>{s.transport_mode || s.mode}</span>
                        </div>
                      </td>

                      {/* Departure Date */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono-telemetry text-slate-400">
                        {formatDate(s.departure_date)}
                      </td>

                      {/* Expected Delivery / ETA */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono-telemetry text-amber-300 font-semibold">
                        {formatDate(s.expected_delivery_date) || s.eta}
                      </td>

                      {/* Shipment Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <NeonBadge variant={statusProps.variant} size="sm">
                          {statusProps.label}
                        </NeonBadge>
                      </td>

                      {/* Risk Score */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono-telemetry font-bold">
                        <span className={`text-sm ${riskProps.color}`}>{s.risk_score ?? 0}</span>
                        <span className="text-slate-500 text-[10px]">/100</span>
                      </td>

                      {/* Risk Level */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider font-mono-telemetry border ${riskProps.bg} ${riskProps.color}`}
                        >
                          {s.risk_level || 'LOW'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetails(s);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                            title="View Full Consignment Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleRecalculateRiskDirect(s, e)}
                            disabled={isRecalc}
                            className="p-1.5 rounded-lg bg-purple-500/10 text-purple-300 hover:text-white hover:bg-purple-500/25 transition-colors cursor-pointer disabled:opacity-50"
                            title="Recalculate Backend Risk"
                          >
                            <Zap className={`w-3.5 h-3.5 ${isRecalc ? 'animate-spin' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => handleOpenEdit(s, e)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-blue-400 hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Edit Shipment"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleOpenDelete(s, e)}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:text-rose-200 hover:bg-rose-500/25 transition-colors cursor-pointer"
                            title="Delete Shipment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-slate-400 font-mono-telemetry">
            <div>
              Showing {Math.min(totalCount, (currentPage - 1) * pageSize + 1)} -{' '}
              {Math.min(totalCount, currentPage * pageSize)} of {totalCount} shipments
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  soundFX.playClick();
                  setCurrentPage(Math.max(1, currentPage - 1));
                }}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg bg-slate-900 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-white font-semibold">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => {
                  soundFX.playClick();
                  setCurrentPage(Math.min(totalPages, currentPage + 1));
                }}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg bg-slate-900 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ShipmentFormModal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        onSaved={handleSavedShipment}
        shipmentToEdit={shipmentToEdit}
      />

      <ShipmentDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        shipment={selectedShipment}
        onShipmentUpdated={handleShipmentUpdatedFromModal}
      />

      <DeleteShipmentModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        shipment={shipmentToDelete}
        onDeleted={handleDeletedShipment}
      />
    </div>
  );
};
