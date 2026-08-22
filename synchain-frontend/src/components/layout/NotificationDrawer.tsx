import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  CheckCheck,
  AlertTriangle,
  CloudRain,
  Building2,
  Truck,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { soundFX } from '../../services/audioService';
import { NeonBadge } from '../common/NeonBadge';

interface NotificationDrawerProps {
  onNavigate: (pageId: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ onNavigate }) => {
  const {
    isNotificationDrawerOpen,
    setIsNotificationDrawerOpen,
    incidents,
    unreadAlertsCount,
    markAlertAsRead,
    markAllAlertsAsRead,
  } = useSupplyChain();

  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'supplier' | 'weather'>('all');

  const filteredIncidents = incidents.filter((item) => {
    if (activeFilter === 'critical') return item.severity === 'critical' || item.severity === 'high';
    if (activeFilter === 'supplier') return item.category === 'supplier';
    if (activeFilter === 'weather') return item.category === 'weather';
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'weather':
        return <CloudRain className="w-4 h-4 text-cyan-400" />;
      case 'supplier':
        return <Building2 className="w-4 h-4 text-purple-400" />;
      case 'logistics':
        return <Truck className="w-4 h-4 text-blue-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isNotificationDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              soundFX.playClick();
              setIsNotificationDrawerOpen(false);
            }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="w-screen max-w-md glass-dropdown border-l border-blue-500/30 flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white font-display">Live Incident Center</h2>
                    <p className="text-xs text-slate-400">
                      {unreadAlertsCount > 0 ? `${unreadAlertsCount} unread high-priority events` : 'All telemetry nominal'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {unreadAlertsCount > 0 && (
                    <button
                      onClick={markAllAlertsAsRead}
                      title="Mark all as read"
                      className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span className="hidden sm:inline">Mark read</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      soundFX.playClick();
                      setIsNotificationDrawerOpen(false);
                    }}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5 bg-slate-950/40">
                {(['all', 'critical', 'supplier', 'weather'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => {
                      soundFX.playClick();
                      setActiveFilter(filterKey);
                    }}
                    className={`text-xs px-3 py-1 rounded-lg font-medium capitalize transition-all cursor-pointer ${
                      activeFilter === filterKey
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-400/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    {filterKey}
                  </button>
                ))}
              </div>

              {/* Alerts List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredIncidents.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 space-y-2">
                    <ShieldAlert className="w-10 h-10 mx-auto text-slate-500 opacity-50" />
                    <p className="text-sm font-medium">No alerts in this category</p>
                    <p className="text-xs text-slate-500">Global supply chains are operating within normal parameters.</p>
                  </div>
                ) : (
                  filteredIncidents.map((incident) => (
                    <motion.div
                      key={incident.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-xl border transition-all ${
                        incident.isRead
                          ? 'bg-slate-900/40 border-white/5 text-slate-300'
                          : 'bg-blue-950/30 border-blue-500/40 shadow-lg shadow-blue-500/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-slate-800/80">
                            {getCategoryIcon(incident.category)}
                          </span>
                          <NeonBadge variant={incident.severity} size="sm">
                            {incident.severity.toUpperCase()}
                          </NeonBadge>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono-telemetry">
                          {incident.timestamp}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-100 mb-1 leading-snug">
                        {incident.title}
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed mb-3">
                        {incident.impactSummary}
                      </p>

                      <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-[11px]">
                        <span className="text-slate-400 truncate max-w-[170px]">
                          Src: {incident.source}
                        </span>
                        <div className="flex items-center gap-2">
                          {!incident.isRead && (
                            <button
                              onClick={() => markAlertAsRead(incident.id)}
                              className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                            >
                              Dismiss
                            </button>
                          )}
                          {incident.actionRequired && (
                            <button
                              onClick={() => {
                                soundFX.playClick();
                                setIsNotificationDrawerOpen(false);
                                onNavigate('recommendations');
                              }}
                              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                            >
                              Mitigate <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Bottom Quick Action */}
              <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono-telemetry">
                  AI Stream: 14,290 events/min
                </span>
                <button
                  onClick={() => {
                    soundFX.playClick();
                    setIsNotificationDrawerOpen(false);
                    onNavigate('risk');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  Open Full Risk Radar &rarr;
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
