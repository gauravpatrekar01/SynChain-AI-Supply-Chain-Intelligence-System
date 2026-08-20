import React, { useState } from 'react';
import {
  Building2,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  DollarSign,
  Layers,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { Supplier } from '../../types';
import { NeonBadge } from '../common/NeonBadge';
import { Button } from '../common/Button';
import { soundFX } from '../../services/audioService';

export const SupplierRegistryView: React.FC = () => {
  const { suppliers } = useSupplyChain();
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'Tier-1' | 'Tier-2'>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const filteredSuppliers = suppliers.filter((s) => {
    const matchTier = tierFilter === 'all' || s.tier === tierFilter;
    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.country.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTier && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Supplier & Multi-Tier Partner Registry
            </h2>
            <NeonBadge variant="blue" size="sm">
              248 CONNECTED
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Global repository of Tier-1 assemblers, Tier-2 wafer foundries, and chemical vendors.
          </p>
        </div>

        {/* Search & Tier Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search supplier, category, country..."
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50"
            />
          </div>

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
                {t === 'all' ? 'All Tiers' : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="rounded-2xl glass-panel border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-white/10 uppercase tracking-wider font-mono-telemetry text-[10px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Supplier Name</th>
                <th className="py-3.5 px-4 font-semibold">Tier / Category</th>
                <th className="py-3.5 px-4 font-semibold">Location</th>
                <th className="py-3.5 px-4 font-semibold">Reliability</th>
                <th className="py-3.5 px-4 font-semibold">Annual Spend</th>
                <th className="py-3.5 px-4 font-semibold">Risk Rating</th>
                <th className="py-3.5 px-4 font-semibold">Single Source</th>
                <th className="py-3.5 px-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSuppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="hover:bg-blue-600/10 transition-colors group cursor-pointer"
                  onClick={() => {
                    soundFX.playClick();
                    setSelectedSupplier(supplier);
                  }}
                >
                  <td className="py-4 px-4 font-semibold text-white group-hover:text-blue-300">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-800/80 border border-white/5 text-blue-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{supplier.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono-telemetry">{supplier.id}</p>
                      </div>
                    </div>
                  </td>
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
                  <td className="py-4 px-4 font-medium text-slate-200">{supplier.country}</td>
                  <td className="py-4 px-4 font-mono-telemetry">
                    <span className="font-semibold text-emerald-400">{supplier.reliabilityScore}%</span>
                    <div className="w-16 h-1 rounded-full bg-slate-800 mt-1">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${supplier.reliabilityScore}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono-telemetry text-slate-200">
                    ${(supplier.spendAnnualUsd / 1000000).toFixed(1)}M
                  </td>
                  <td className="py-4 px-4">
                    <NeonBadge variant={supplier.healthStatus} size="sm">
                      {supplier.healthStatus.toUpperCase()}
                    </NeonBadge>
                  </td>
                  <td className="py-4 px-4">
                    {supplier.singleSourceRisk ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> YES
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">No</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button className="text-blue-400 hover:text-blue-300 font-semibold text-xs cursor-pointer">
                      Inspect &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
