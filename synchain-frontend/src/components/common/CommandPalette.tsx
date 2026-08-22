import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  Network,
  Globe2,
  Cpu,
  Sparkles,
  TrendingUp,
  ShieldAlert,
  Building2,
  Package,
  FileText,
  Settings,
  Truck,
  ArrowRight,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { soundFX } from '../../services/audioService';

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'Suppliers' | 'Shipments';
  icon: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  onNavigate: (pageId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onNavigate }) => {
  const { isCommandPaletteOpen, setIsCommandPaletteOpen, runSimulation } = useSupplyChain();
  const [query, setQuery] = useState('');

  const items: CommandItem[] = useMemo(
    () => [
      // Navigation
      {
        id: 'nav-dash',
        title: 'Executive AI Command Center',
        category: 'Navigation',
        icon: <LayoutDashboard className="w-4 h-4 text-blue-400" />,
        onSelect: () => onNavigate('dashboard'),
      },
      {
        id: 'nav-twin',
        title: 'Digital Twin Interactive Graph',
        category: 'Navigation',
        icon: <Network className="w-4 h-4 text-purple-400" />,
        onSelect: () => onNavigate('digital-twin'),
      },
      {
        id: 'nav-geomap',
        title: 'Live Fleet & Geo Logistics Map',
        category: 'Navigation',
        icon: <Globe2 className="w-4 h-4 text-cyan-400" />,
        onSelect: () => onNavigate('geomap'),
      },
      {
        id: 'nav-builder',
        title: 'Disruption Scenario Builder',
        category: 'Navigation',
        icon: <Cpu className="w-4 h-4 text-rose-400" />,
        onSelect: () => onNavigate('scenario-builder'),
      },
      {
        id: 'nav-recs',
        title: 'AI Recommendations & Mitigation',
        category: 'Navigation',
        icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
        onSelect: () => onNavigate('recommendations'),
      },
      {
        id: 'nav-forecast',
        title: 'Predictive Demand & Price Forecast',
        category: 'Navigation',
        icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
        onSelect: () => onNavigate('forecast'),
      },
      {
        id: 'nav-risk',
        title: '5x5 Risk Matrix & Vulnerability Hub',
        category: 'Navigation',
        icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
        onSelect: () => onNavigate('risk'),
      },
      {
        id: 'nav-suppliers',
        title: 'Suppliers & Tier Network Registry',
        category: 'Navigation',
        icon: <Building2 className="w-4 h-4 text-blue-400" />,
        onSelect: () => onNavigate('suppliers'),
      },
      {
        id: 'nav-inventory',
        title: 'Inventory & Safety Stock Buffer',
        category: 'Navigation',
        icon: <Package className="w-4 h-4 text-indigo-400" />,
        onSelect: () => onNavigate('inventory'),
      },
      {
        id: 'nav-reports',
        title: 'Executive Reports & Export Center',
        category: 'Navigation',
        icon: <FileText className="w-4 h-4 text-teal-400" />,
        onSelect: () => onNavigate('reports'),
      },
      {
        id: 'nav-settings',
        title: 'System Settings & API Gateway',
        category: 'Navigation',
        icon: <Settings className="w-4 h-4 text-slate-400" />,
        onSelect: () => onNavigate('settings'),
      },
      // Actions
      {
        id: 'act-typhoon',
        title: 'Run AI Simulation: Typhoon Gaemi (East China Sea)',
        category: 'Actions',
        icon: <Cpu className="w-4 h-4 text-rose-400" />,
        onSelect: () => {
          onNavigate('simulation-results');
          runSimulation({
            scenarioName: 'Typhoon Gaemi East China Sea Surge',
            disruptionType: 'typhoon_disruption',
            targetEntityId: 'port-shanghai',
            targetEntityName: 'Shanghai & Ningbo Port Hub',
            targetType: 'port',
            durationDays: 14,
            severityPct: 85,
            includeSecondTierCascade: true,
            autoMitigate: true,
          });
        },
      },
      // Shipments
      {
        id: 'ship-cma',
        title: 'Track Ultra Container Ship CMA CGM Palais Royal',
        category: 'Shipments',
        icon: <Truck className="w-4 h-4 text-cyan-400" />,
        onSelect: () => onNavigate('geomap'),
      },
    ],
    [onNavigate, runSimulation]
  );

  const filtered = useMemo(() => {
    if (!query) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
    );
  }, [items, query]);

  if (!isCommandPaletteOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsCommandPaletteOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl rounded-2xl glass-dropdown border border-blue-500/40 shadow-[0_0_60px_rgba(59,130,246,0.3)] overflow-hidden z-10"
        >
          {/* Search Header */}
          <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3">
            <Search className="w-5 h-5 text-blue-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command, search modules, or simulate risks... (Esc to close)"
              className="w-full bg-transparent text-white placeholder-slate-400 text-sm focus:outline-none"
            />
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono-telemetry bg-white/10 text-slate-300 rounded border border-white/10">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No matching supply chain modules or commands found.
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    soundFX.playClick();
                    item.onSelect();
                    setIsCommandPaletteOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-sm text-slate-200 hover:text-white hover:bg-blue-600/20 hover:border-blue-500/30 border border-transparent transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-800/80 group-hover:bg-blue-500/20 text-slate-300 group-hover:text-blue-400 transition-colors">
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <p className="font-medium text-slate-100 group-hover:text-white">{item.title}</p>
                      <p className="text-[11px] text-slate-400 group-hover:text-blue-200/70">{item.category}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
