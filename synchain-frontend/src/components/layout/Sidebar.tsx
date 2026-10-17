import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Network,
  Globe2,
  Cpu,
  Sparkles,
  TrendingUp,
  ShieldAlert,
  Building2,
  Package,
  Truck,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  BarChart3,
  Activity,
  FileCheck,
  DollarSign,
} from 'lucide-react';
import { soundFX } from '../../services/audioService';
import { useSupplyChain } from '../../context/SupplyChainContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (pageId: string) => void;
}

interface NavSection {
  title?: string;
  items: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeColor?: string;
  }>;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const [manuallyCollapsed, setCollapsed] = useState(false);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const collapsed = compact || manuallyCollapsed;
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const onChange = () => setCompact(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const { unreadAlertsCount, isRealDataConnected, digitalTwinNodes } = useSupplyChain();

  const navSections: NavSection[] = [
    {
      title: 'Command & Twin',
      items: [
        { id: 'dashboard', label: 'AI Command Center', icon: LayoutDashboard },
        { id: 'analysis', label: 'Supply Chain Analysis', icon: BarChart3, badge: 'Live', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' },
        { id: 'geomap', label: 'Fleet & Geo Logistics', icon: Globe2 },
      ],
    },
    {
      title: 'Disruption & Decision',
      items: [
        { id: 'scenario-builder', label: 'Scenario Builder', icon: Cpu },
        { id: 'simulation-results', label: 'Simulation Evidence', icon: FileCheck, badge: 'AI Report', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' },
        { id: 'recommendations', label: 'AI Recommendations', icon: Sparkles, badge: '3 Ready', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/40' },
      ],
    },
    {
      title: 'Predictive Intelligence',
      items: [
        { id: 'forecast', label: 'Forecast Engine', icon: TrendingUp },
        { id: 'sales-forecasting', label: 'Sales Forecasting', icon: DollarSign, badge: 'New', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' },
        { id: 'risk', label: '5x5 Risk Matrix', icon: ShieldAlert, badge: unreadAlertsCount > 0 ? `${unreadAlertsCount}` : undefined, badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-400/40' },
        { id: 'suppliers', label: 'Supplier Registry', icon: Building2 },
        { id: 'inventory', label: 'Inventory Buffer', icon: Package },
        { id: 'shipments', label: 'Live Shipments', icon: Truck },
      ],
    },
    {
      title: 'Enterprise Management',
      items: [
        { id: 'data-sources', label: 'Data Ingestion Hub', icon: UploadCloud, badge: 'CSV / Excel', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' },
        { id: 'intelligence', label: 'Supply Chain Intelligence', icon: ShieldAlert, badge: 'Risk', badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-400/40' },
        { id: 'reports', label: 'Reports & Exports', icon: FileText },
        { id: 'settings', label: 'System Settings', icon: Settings },
      ],
    },
  ];

  const handleItemClick = (id: string) => {
    soundFX.playClick();
    onNavigate(id);
  };

  return (
    <aside
      className={`relative z-20 shrink-0 h-screen glass-panel border-r border-white/10 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className={`h-16 px-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} border-b border-white/10`}>
        <div className={`${manuallyCollapsed && !compact ? 'hidden' : 'flex'} items-center gap-3 min-w-0 overflow-hidden cursor-pointer`} onClick={() => handleItemClick('dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0 border border-white/20">
            <Network className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white tracking-tight font-display flex items-center gap-1.5">
                SynChain<span className="text-blue-400">AI</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono-telemetry truncate">
                ENTERPRISE v4.2
              </p>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button */}
        <button
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={() => {
            soundFX.playClick();
            setCollapsed(!collapsed);
          }}
          className={`${compact ? 'hidden' : ''} p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer`}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {!collapsed && section.title && (
              <h4 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono-telemetry">
                {section.title}
              </h4>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600/30 to-indigo-600/10 text-white border border-blue-500/50 shadow-md shadow-blue-500/10'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!collapsed && item.badge && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        item.badgeColor || 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Live System Telemetry */}
      {!collapsed && (
        <div className="p-3 m-3 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] space-y-1 font-mono-telemetry">
          <div className="flex items-center justify-between text-slate-400">
            <span>FastAPI Link</span>
            <span className={`font-semibold flex items-center gap-1.5 ${isRealDataConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isRealDataConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isRealDataConnected ? 'PostgreSQL Live' : 'Connecting...'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Digital Twin</span>
            <span className="text-cyan-400 font-semibold">{digitalTwinNodes.length} Nodes Synced</span>
          </div>
        </div>
      )}
    </aside>
  );
};
