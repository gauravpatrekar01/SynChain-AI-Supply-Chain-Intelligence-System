import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  DollarSign,
  Layers,
  ChevronDown,
  Upload,
  UserPlus,
  Edit,
  Trash2,
  ArrowUpDown,
  RefreshCw,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { Supplier, HealthStatus } from '../../types';
import { NeonBadge } from '../common/NeonBadge';
import { Button } from '../common/Button';
import { soundFX } from '../../services/audioService';
import { SupplierImportModal } from './SupplierImportModal';
import { SupplierFormModal } from './SupplierFormModal';
import { SupplierDetailsModal } from './SupplierDetailsModal';
import { DeleteSupplierModal } from './DeleteSupplierModal';

export const SupplierRegistryView: React.FC = () => {
  const { suppliers, refreshData, isLoading } = useSupplyChain();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'Tier-1' | 'Tier-2'>('all');
  const [healthFilter, setHealthFilter] = useState<'all' | 'optimal' | 'warning' | 'critical'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'reliability' | 'spend' | 'risk'>('spend');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals & Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter and sort suppliers in memory
  const filteredSuppliers = suppliers.filter((s) => {
    const matchTier = tierFilter === 'all' || s.tier === tierFilter;
    const sHealth = (s.health_status || s.healthStatus || 'optimal').toLowerCase();
    const matchHealth = healthFilter === 'all' || sHealth === healthFilter;

    const isActive = s.is_active ?? s.isActive ?? true;
    const matchActive =
      activeFilter === 'all' ||
      (activeFilter === 'active' && isActive) ||
      (activeFilter === 'inactive' && !isActive);

    const q = searchQuery.toLowerCase().trim();
    const sCode = (s.supplier_code || s.supplierCode || '').toLowerCase();
    const sLocation = (s.location || '').toLowerCase();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q) ||
      sLocation.includes(q) ||
      sCode.includes(q);

    return matchTier && matchHealth && matchActive && matchSearch;
  });

  // Sort
  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    let aVal: any = 0;
    let bVal: any = 0;

    if (sortBy === 'name') {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else if (sortBy === 'reliability') {
      aVal = a.reliability_score ?? a.reliabilityScore ?? 0;
      bVal = b.reliability_score ?? b.reliabilityScore ?? 0;
    } else if (sortBy === 'spend') {
      aVal = a.spend_annual_usd ?? a.spendAnnualUsd ?? 0;
      bVal = b.spend_annual_usd ?? b.spendAnnualUsd ?? 0;
    } else if (sortBy === 'risk') {
      const riskOrder: Record<string, number> = { optimal: 1, warning: 2, critical: 3 };
      const aHealth = (a.health_status || a.healthStatus || 'optimal').toLowerCase();
      const bHealth = (b.health_status || b.healthStatus || 'optimal').toLowerCase();
      aVal = riskOrder[aHealth] || 0;
      bVal = riskOrder[bHealth] || 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const tier1Count = suppliers.filter((s) => s.tier === 'Tier-1').length;
  const tier2Count = suppliers.filter((s) => s.tier === 'Tier-2').length;

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Supplier & Multi-Tier Partner Registry
            </h2>
            <NeonBadge variant="blue" size="sm">
              {suppliers.length} REGISTERED
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Global repository of Tier-1 assemblers, Tier-2 wafer foundries, raw materials, and logistics partners.
          </p>
        </div>

        {/* Import Suppliers Dropdown Button */}
        <div className="flex items-center gap-3">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                soundFX.playClick();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex items-center gap-2 cursor-pointer border border-blue-400/30"
            >
              <Plus className="w-4 h-4" />
              <span>Import Suppliers</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Options */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl glass-dropdown border border-blue-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.6)] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => {
                    soundFX.playClick();
                    setIsDropdownOpen(false);
                    setIsImportModalOpen(true);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-blue-600/15 transition-colors flex items-start gap-3 cursor-pointer group"
                >
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:bg-blue-500/20 group-hover:text-blue-300 shrink-0">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white block group-hover:text-blue-200">
                      Import Suppliers from CSV
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block leading-tight">
                      Bulk upload with template generator, preview validation & duplicate detection.
                    </span>
                  </div>
                </button>

                <div className="my-1 border-t border-white/5" />

                <button
                  onClick={() => {
                    soundFX.playClick();
                    setIsDropdownOpen(false);
                    setSupplierToEdit(null);
                    setIsFormModalOpen(true);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-indigo-600/15 transition-colors flex items-start gap-3 cursor-pointer group"
                >
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white block group-hover:text-indigo-200">
                      Add Supplier Manually
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block leading-tight">
                      Register a single vendor with custom contact, tier, and resilience data.
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search partner name, code, category, location..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Quick Filter Groupings */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Tier Selector */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/10">
              {(['all', 'Tier-1', 'Tier-2'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    soundFX.playClick();
                    setTierFilter(t);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    tierFilter === t ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t === 'all' ? `All (${suppliers.length})` : t === 'Tier-1' ? `Tier-1 (${tier1Count})` : `Tier-2 (${tier2Count})`}
                </button>
              ))}
            </div>

            {/* Health Filter */}
            <select
              value={healthFilter}
              onChange={(e) => {
                soundFX.playClick();
                setHealthFilter(e.target.value as any);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            >
              <option value="all">All Health Ratings</option>
              <option value="optimal">Optimal Risk</option>
              <option value="warning">Warning Risk</option>
              <option value="critical">Critical Risk</option>
            </select>

            {/* Active Status */}
            <select
              value={activeFilter}
              onChange={(e) => {
                soundFX.playClick();
                setActiveFilter(e.target.value as any);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
              <select
                value={sortBy}
                onChange={(e) => {
                  soundFX.playClick();
                  setSortBy(e.target.value as any);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
              >
                <option value="spend">Sort by Spend</option>
                <option value="reliability">Sort by Reliability</option>
                <option value="risk">Sort by Risk</option>
                <option value="name">Sort by Name</option>
              </select>

              <button
                onClick={() => {
                  soundFX.playClick();
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                }}
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                className="p-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="rounded-2xl glass-panel border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-white/10 uppercase tracking-wider font-mono-telemetry text-[10px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Supplier Name & Code</th>
                <th className="py-3.5 px-4 font-semibold">Tier / Category</th>
                <th className="py-3.5 px-4 font-semibold">Location</th>
                <th className="py-3.5 px-4 font-semibold">Reliability</th>
                <th className="py-3.5 px-4 font-semibold">Annual Spend</th>
                <th className="py-3.5 px-4 font-semibold">Risk Rating</th>
                <th className="py-3.5 px-4 font-semibold">Single Source</th>
                <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-mono-telemetry">
                    <Building2 className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-white">No Suppliers Found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No suppliers matched the current filters, or no records have been imported yet.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Import CSV
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSupplierToEdit(null);
                          setIsFormModalOpen(true);
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Manually
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedSuppliers.map((supplier) => {
                  const reliability = supplier.reliability_score ?? supplier.reliabilityScore ?? 85;
                  const spend = supplier.spend_annual_usd ?? supplier.spendAnnualUsd ?? 0;
                  const health = (supplier.health_status || supplier.healthStatus || 'optimal') as HealthStatus;
                  const singleSource = supplier.single_source_risk ?? supplier.singleSourceRisk ?? false;
                  const supplierCode = supplier.supplier_code || supplier.supplierCode || supplier.id.slice(0, 8);

                  return (
                    <tr
                      key={supplier.id}
                      className="hover:bg-blue-600/10 transition-colors group cursor-pointer"
                      onClick={() => {
                        soundFX.playClick();
                        setSelectedSupplier(supplier);
                        setIsDetailsModalOpen(true);
                      }}
                    >
                      {/* Name & Code */}
                      <td className="py-4 px-4 font-semibold text-white group-hover:text-blue-300">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-slate-800/80 border border-white/5 text-blue-400 shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{supplier.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono-telemetry">{supplierCode}</p>
                          </div>
                        </div>
                      </td>

                      {/* Tier / Category */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono-telemetry font-bold ${
                            supplier.tier === 'Tier-1'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                          }`}
                        >
                          {supplier.tier}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">{supplier.category}</p>
                      </td>

                      {/* Location */}
                      <td className="py-4 px-4 font-medium text-slate-200">
                        <div>
                          <span>{supplier.country}</span>
                          {supplier.location && (
                            <span className="text-[10px] text-slate-400 block font-mono-telemetry truncate max-w-[140px]">
                              {supplier.location}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Reliability */}
                      <td className="py-4 px-4 font-mono-telemetry">
                        <span className="font-semibold text-emerald-400">{reliability}%</span>
                        <div className="w-16 h-1 rounded-full bg-slate-800 mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${Math.min(100, Math.max(0, reliability))}%` }}
                          />
                        </div>
                      </td>

                      {/* Annual Spend */}
                      <td className="py-4 px-4 font-mono-telemetry text-slate-200">
                        ${(spend / 1000000).toFixed(1)}M
                      </td>

                      {/* Health / Risk */}
                      <td className="py-4 px-4">
                        <NeonBadge variant={health} size="sm">
                          {health.toUpperCase()}
                        </NeonBadge>
                      </td>

                      {/* Single Source */}
                      <td className="py-4 px-4">
                        {singleSource ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> YES
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">No</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="Inspect Supplier Details"
                            onClick={() => {
                              soundFX.playClick();
                              setSelectedSupplier(supplier);
                              setIsDetailsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            title="Edit Supplier"
                            onClick={() => {
                              soundFX.playClick();
                              setSupplierToEdit(supplier);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            title="Delete Supplier"
                            onClick={() => {
                              soundFX.playClick();
                              setSupplierToDelete(supplier);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
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
      </div>

      {/* Modals */}

      {/* 1. Bulk CSV Import Modal */}
      <SupplierImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          refreshData();
        }}
      />

      {/* 2. Add / Edit Supplier Form Modal */}
      <SupplierFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSupplierToEdit(null);
        }}
        supplierToEdit={supplierToEdit}
        onSuccess={() => {
          refreshData();
        }}
      />

      {/* 3. Detailed Supplier Inspection Modal */}
      <SupplierDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedSupplier(null);
        }}
        supplier={selectedSupplier}
        onEdit={(s) => {
          setIsDetailsModalOpen(false);
          setSupplierToEdit(s);
          setIsFormModalOpen(true);
        }}
        onDelete={(s) => {
          setIsDetailsModalOpen(false);
          setSupplierToDelete(s);
          setIsDeleteModalOpen(true);
        }}
      />

      {/* 4. Safe Delete Confirmation Modal */}
      <DeleteSupplierModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSupplierToDelete(null);
        }}
        supplier={supplierToDelete}
        onDeleted={() => {
          refreshData();
        }}
      />
    </div>
  );
};
