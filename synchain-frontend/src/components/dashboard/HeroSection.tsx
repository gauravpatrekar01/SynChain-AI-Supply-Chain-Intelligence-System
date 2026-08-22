import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, AlertCircle, Play, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { Button } from '../common/Button';
import { AnimatedCounter } from '../common/AnimatedCounter';

interface HeroSectionProps {
  onNavigate: (pageId: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { health } = useSupplyChain();

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
            <span>AI OPERATIONAL DIGITAL TWIN • REALTIME REINFORCEMENT LEARNING</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white font-display tracking-tight">
            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300">{user.name}</span>
          </h1>

          <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
            SynChain AI is continuously analyzing <span className="text-white font-semibold">248 global supplier nodes</span>, <span className="text-white font-semibold">1,280 active shipments</span>, and multi-modal meteorological telemetry. Global network operations are <span className="text-emerald-400 font-semibold">96.8% Nominal</span>.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              variant="glow"
              size="md"
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              onClick={() => onNavigate('scenario-builder')}
            >
              Run AI Disruption Simulation
            </Button>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Sparkles className="w-4 h-4 text-purple-400" />}
              rightIcon={<ArrowUpRight className="w-4 h-4" />}
              onClick={() => onNavigate('recommendations')}
            >
              Review 3 Mitigation Strategies
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
                className="text-emerald-400"
                strokeDasharray={`${health.score}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <AnimatedCounter
                value={health.score}
                decimals={1}
                suffix="%"
                className="text-xl font-bold text-white tracking-tight"
              />
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Health</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>{health.resilienceRating}</span>
            </div>
            <p className="text-xs text-slate-400">
              Readiness Index:{' '}
              <span className="text-slate-200 font-semibold font-mono-telemetry">
                {health.mitigationReadinessPct}%
              </span>
            </p>
            <p className="text-xs text-slate-400">
              Active Disruptions:{' '}
              <span className="text-amber-400 font-semibold font-mono-telemetry">
                {health.activeDisruptionsCount} Tracked
              </span>
            </p>
            <div className="pt-1 flex items-center gap-1 text-[10px] text-slate-500 font-mono-telemetry">
              <AlertCircle className="w-3 h-3 text-cyan-400" />
              <span>Synced with FastAPI Core</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
