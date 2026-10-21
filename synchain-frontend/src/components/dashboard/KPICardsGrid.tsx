import React from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Factory,
  Warehouse,
  PackageCheck,
  AlertTriangle,
  Truck,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { KPIMetric } from '../../types';
import { AnimatedCounter } from '../common/AnimatedCounter';
import { Tooltip } from '../common/Tooltip';
import { soundFX } from '../../services/audioService';

interface KPICardsGridProps {
  metrics: KPIMetric[];
  onCardClick?: (metricId: string) => void;
}

export const KPICardsGrid: React.FC<KPICardsGridProps> = ({ metrics, onCardClick }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2':
        return <Building2 className="w-5 h-5 text-blue-400" />;
      case 'Factory':
        return <Factory className="w-5 h-5 text-purple-400" />;
      case 'Warehouse':
        return <Warehouse className="w-5 h-5 text-cyan-400" />;
      case 'PackageCheck':
        return <PackageCheck className="w-5 h-5 text-emerald-400" />;
      case 'AlertTriangle':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'Truck':
        return <Truck className="w-5 h-5 text-indigo-400" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case 'TrendingUp':
      default:
        return <TrendingUp className="w-5 h-5 text-cyan-400" />;
    }
  };

  // Mini sparkline SVG renderer
  const renderSparkline = (points: number[], isPositive: boolean) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 64;
    const height = 24;

    const pathData = points
      .map((p, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height - ((p - min) / range) * (height - 4) - 2;
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    const strokeColor = isPositive ? '#22C55E' : '#EF4444';

    return (
      <svg width={width} height={height} className="overflow-visible">
        <path d={pathData} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const getKpiTooltip = (kpiId: string) => {
    switch (kpiId) {
      case 'kpi-risk':
        return 'What it means: A composite score (0-100) combining likelihood and severity of problems across nodes. Why it matters: Higher scores indicate greater vulnerability. What to watch: Scores above 50 require mitigation.';
      case 'kpi-disruptions':
        return 'What it means: Count of active supplier delays, port blockages, or facility outages. Why it matters: Directly impacts order fulfillment timelines. What to watch: Problems exceeding safety stock buffers.';
      case 'kpi-inventory':
        return 'What it means: Real-time dollar value of all finished goods and components in warehouses. Why it matters: Balances order fulfillment against holding costs. What to watch: Unsold inventory accumulation.';
      case 'kpi-suppliers':
        return 'What it means: Rating of suppliers based on delivery consistency and product quality. Why it matters: Reliable suppliers prevent unexpected line shutdowns. What to watch: Ratings below 80%.';
      case 'kpi-otd':
      default:
        return 'What it means: Percentage of customer orders delivered on or before the promised date. Why it matters: Core service level and customer satisfaction metric. What to watch: Any dip below the 90% SLA target.';
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((kpi, idx) => {
        const numericVal = typeof kpi.value === 'number' ? kpi.value : parseFloat(String(kpi.value));

        return (
          <motion.div
            key={kpi.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            whileHover={{ y: -3, scale: 1.01 }}
            onClick={() => {
              soundFX.playClick();
              if (onCardClick) onCardClick(kpi.id);
            }}
            className="group relative p-5 rounded-2xl glass-panel border border-white/10 hover:border-blue-500/50 hover:shadow-[0_10px_30px_rgba(59,130,246,0.15)] transition-all cursor-pointer overflow-hidden"
          >
            {/* Top Row: Icon + Change Badge */}
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:bg-blue-500/20 group-hover:border-blue-400/30 transition-colors">
                {getIcon(kpi.iconName)}
              </div>
              <div className="flex items-center gap-2">
                {renderSparkline(kpi.sparkline, kpi.isPositive)}
                <div
                  className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
                    kpi.isPositive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {kpi.isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                  {Math.abs(kpi.changePct)}%
                </div>
              </div>
            </div>

            {/* Value Counter */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs sm:text-sm font-semibold text-slate-300 group-hover:text-white transition-colors truncate">
                  {kpi.title}
                </p>
                <div onClick={(e) => e.stopPropagation()}>
                  <Tooltip content={getKpiTooltip(kpi.id)} iconSize={13} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-baseline">
                <AnimatedCounter
                  value={numericVal}
                  prefix={kpi.prefix}
                  suffix={kpi.suffix}
                  decimals={kpi.prefix === '$' ? 1 : 0}
                  className="font-display font-bold"
                />
              </div>
            </div>

            {/* Subtext description */}
            <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed group-hover:text-slate-300 transition-colors">
              {kpi.description}
            </p>

            {/* Subtle bottom glow bar on hover */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        );
      })}
    </div>
  );
};
