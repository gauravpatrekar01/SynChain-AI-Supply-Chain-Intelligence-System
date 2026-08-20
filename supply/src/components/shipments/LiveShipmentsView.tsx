import React, { useState } from 'react';
import { Truck, Ship, Plane, Search, Filter, AlertTriangle, ExternalLink, MapPin } from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { Shipment } from '../../types';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';

interface LiveShipmentsViewProps {
  onNavigate: (pageId: string) => void;
}

export const LiveShipmentsView: React.FC<LiveShipmentsViewProps> = ({ onNavigate }) => {
  const { shipments } = useSupplyChain();
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('all');

  const filtered = shipments.filter((s) => {
    const matchMode = modeFilter === 'all' || s.mode === modeFilter;
    const matchSearch =
      s.carrier.toLowerCase().includes(search.toLowerCase()) ||
      (s.vesselName && s.vesselName.toLowerCase().includes(search.toLowerCase())) ||
      s.cargoDescription.toLowerCase().includes(search.toLowerCase());
    return matchMode && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Live Fleet Transit & Shipments Ledger
            </h2>
            <NeonBadge variant="cyan" size="sm">
              1,280 IN TRANSIT
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Global container vessels, air cargo freighters, and intermodal transport corridors.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vessel, carrier, cargo..."
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/10">
            {(['all', 'ocean', 'air', 'ground'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  soundFX.playClick();
                  setModeFilter(m);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  modeFilter === m ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shipments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="p-5 rounded-2xl glass-panel border border-white/10 hover:border-blue-500/40 space-y-3 transition-all cursor-pointer"
            onClick={() => {
              soundFX.playClick();
              onNavigate('geomap');
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-800 border border-white/10 text-blue-400">
                  {s.mode === 'ocean' ? <Ship className="w-5 h-5" /> : s.mode === 'air' ? <Plane className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{s.carrier}</h4>
                  <p className="text-xs text-slate-400 font-mono-telemetry">{s.vesselName || s.id}</p>
                </div>
              </div>

              <NeonBadge variant={s.status === 'delayed' ? 'warning' : 'optimal'} size="sm">
                {s.status.toUpperCase()}
              </NeonBadge>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Origin &rarr; Destination:</span>
                <span className="font-semibold text-white">{s.origin} &rarr; {s.destination}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cargo Payload:</span>
                <span className="text-cyan-300">{s.cargoDescription}</span>
              </div>
              <div className="flex justify-between font-mono-telemetry">
                <span className="text-slate-400">Telemetry:</span>
                <span className="text-emerald-400">{s.speedKnots} kn | ETA {s.eta}</span>
              </div>
            </div>

            {s.rerouteRecommendation && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{s.rerouteRecommendation}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
