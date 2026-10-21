import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, AlertCircle, Play, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { healthStatusLabel } from '../../services/healthScore';

interface HeroSectionProps {
  onNavigate: (pageId: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { health, healthLoading, healthError, refreshData } = useSupplyChain();
  const hasScore = health.score != null;
  const healthLabel = healthStatusLabel(health);
  const healthColor = health.dataStatus === 'unavailable' || !hasScore ? 'text-slate-400'
    : health.status === 'optimal' ? 'text-emerald-400' : health.status === 'warning' ? 'text-amber-400' : 'text-rose-400';
  const availableComponents = health.components?.filter((component) => component.score != null) ?? [];
  const availableWeight = availableComponents.reduce((sum, component) => sum + component.weight, 0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="relative rounded-2xl glass-panel border border-blue-500/30 p-6 md:p-8 overflow-hidden">
      {/* Background cyber accent glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left Welcome Details */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            <span>DATA-DRIVEN SUPPLY CHAIN HEALTH</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white font-display tracking-tight">
            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300">{user?.name || 'Supply Chain Leader'}</span>
          </h1>

          <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
            An overall indicator of how well the supply chain is performing. It combines supplier reliability, inventory coverage, order fulfillment, and connected service checks.
            {' '}<span className={`${healthColor} font-semibold`}>{healthLoading && !hasScore ? 'Calculating health…' : hasScore ? `${health.score.toFixed(1)}% · ${healthLabel}` : healthLabel}</span>.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              variant="glow"
              size="md"
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              onClick={() => onNavigate('scenario-builder')}
            >
              Run Disruption Simulation
            </Button>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Sparkles className="w-4 h-4 text-purple-400" />}
              rightIcon={<ArrowUpRight className="w-4 h-4" />}
              onClick={() => onNavigate('recommendations')}
            >
              Ways to Reduce Impact
            </Button>
          </div>
        </div>

        {/* Right Radial AI Health Score Gauge */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="shrink-0 flex items-center gap-5 p-5 rounded-2xl bg-slate-900/80 border border-white/10 shadow-2xl backdrop-blur-xl"
        >
          {/* Radial Progress Ring */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              {/* Background Track */}
              <path
                className="text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Animated Progress Path */}
              <path
                className={healthColor}
                strokeDasharray={`${health.score ?? 0}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <output aria-label="Overall health score" className="text-xl font-bold text-white tracking-tight font-mono-telemetry">{hasScore ? `${health.score.toFixed(1)}%` : '—'}</output>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Health</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${healthColor}`}>
              <ShieldCheck className="w-4 h-4" />
              <span>{healthLabel}{hasScore ? ` · Grade ${health.resilienceRating}` : ''}</span>
            </div>
            <p className="text-xs text-slate-400">
              Data Sources Available:{' '}
              <span className="text-slate-200 font-semibold font-mono-telemetry">
                {availableComponents.length} / {health.components?.length || 4}
              </span>
            </p>
            <p className="text-xs text-slate-400">
              Current Supply Chain Problems:{' '}
              <span className="text-amber-400 font-semibold font-mono-telemetry">
                {health.lastUpdated ? `${health.activeDisruptionsCount} tracked` : 'Awaiting data'}
              </span>
            </p>
            <div className="pt-1 flex items-center gap-1 text-[11px] text-slate-400 font-mono-telemetry">
              <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{healthLoading ? 'Refreshing…' : health.lastUpdated ? `Updated ${new Date(health.lastUpdated).toLocaleTimeString()}` : 'Awaiting first check'}</span>
            </div>
          </div>
        </motion.div>
      </div>
      <div className="relative z-10 mt-5 border-t border-white/10 pt-4 space-y-3">
        {healthError && <div role="alert" className="flex flex-wrap items-center gap-3 text-xs text-amber-300">
          <span>{healthError}{hasScore ? ' The last known score is shown.' : ''}</span>
          <button onClick={() => void refreshData()} disabled={healthLoading} className="underline disabled:opacity-50">Retry health refresh</button>
        </div>}
        <p className="text-xs text-slate-400">{health.explanation}</p>
        {!!health.components?.length && <dl aria-label="Health score breakdown" className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {health.components.map((component) => {
            const friendlyLabel =
              component.key === 'suppliers'
                ? 'Supplier Reliability'
                : component.key === 'inventory'
                ? 'Inventory Coverage'
                : component.key === 'orders' || component.key === 'fulfillment'
                ? 'Order Fulfillment'
                : component.key === 'integrations'
                ? 'Connected Services Status'
                : component.label;

            const friendlyDesc =
              component.key === 'suppliers'
                ? 'How consistently suppliers deliver on time and meet quality expectations.'
                : component.key === 'inventory'
                ? 'How well current stock meets expected demand.'
                : component.key === 'orders' || component.key === 'fulfillment'
                ? 'How successfully customer orders are completed.'
                : component.key === 'integrations'
                ? 'Checks whether external services are working correctly.'
                : `${component.sampleSize} records`;

            return (
              <div key={component.key} className="rounded-xl bg-slate-900/60 border border-white/5 px-3 py-2.5">
                <dt className="text-xs font-medium text-slate-400 flex items-center justify-between" title={friendlyDesc}>
                  <span>{friendlyLabel}</span>
                  <Tooltip content={friendlyDesc} iconSize={12} />
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-100">{component.score == null ? 'No observed data' : `${component.score.toFixed(1)}%`}</dd>
                <p className="mt-1 text-[11px] text-slate-400 leading-tight">{component.sampleSize} records{component.score != null && availableWeight > 0 ? ` · ${Math.round(component.weight / availableWeight * 100)}% of score` : ' · Excluded'}</p>
              </div>
            );
          })}
        </dl>}
      </div>
    </div>
  );
};
