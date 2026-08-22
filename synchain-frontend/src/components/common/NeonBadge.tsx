import React from 'react';
import { HealthStatus, RiskSeverity } from '../../types';

interface NeonBadgeProps {
  variant?: HealthStatus | RiskSeverity | 'blue' | 'purple' | 'cyan' | 'neutral';
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  className?: string;
  glow?: boolean;
}

export const NeonBadge: React.FC<NeonBadgeProps> = ({
  variant = 'blue',
  children,
  size = 'md',
  dot = true,
  className = '',
  glow = false,
}) => {
  const getStyles = () => {
    switch (variant) {
      case 'optimal':
      case 'low':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400',
          glow: glow ? 'shadow-[0_0_12px_rgba(34,197,94,0.4)]' : '',
        };
      case 'warning':
      case 'medium':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
          dot: 'bg-amber-400 animate-pulse',
          glow: glow ? 'shadow-[0_0_12px_rgba(245,158,11,0.4)]' : '',
        };
      case 'critical':
      case 'high':
        return {
          bg: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
          dot: 'bg-rose-500 animate-ping',
          glow: glow ? 'shadow-[0_0_15px_rgba(239,68,68,0.5)]' : '',
        };
      case 'purple':
        return {
          bg: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
          dot: 'bg-purple-400',
          glow: glow ? 'shadow-[0_0_12px_rgba(139,92,246,0.4)]' : '',
        };
      case 'cyan':
        return {
          bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
          dot: 'bg-cyan-400',
          glow: glow ? 'shadow-[0_0_12px_rgba(6,182,212,0.4)]' : '',
        };
      case 'neutral':
        return {
          bg: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
          dot: 'bg-slate-400',
          glow: '',
        };
      case 'blue':
      case 'nominal':
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
          dot: 'bg-blue-400',
          glow: glow ? 'shadow-[0_0_12px_rgba(59,130,246,0.4)]' : '',
        };
    }
  };

  const current = getStyles();
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 space-x-1.5',
    md: 'text-xs px-2.5 py-1 space-x-2',
    lg: 'text-sm px-3.5 py-1.5 space-x-2.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border backdrop-blur-md transition-all ${current.bg} ${current.glow} ${sizeClasses} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />}
      <span>{children}</span>
    </span>
  );
};
