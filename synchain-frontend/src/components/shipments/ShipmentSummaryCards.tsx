import React from 'react';
import { Package, Truck, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { ShipmentSummary } from '../../types';
import { Tooltip } from '../common/Tooltip';

interface ShipmentSummaryCardsProps {
  summary: ShipmentSummary | null;
  isLoading: boolean;
}

export const ShipmentSummaryCards: React.FC<ShipmentSummaryCardsProps> = ({ summary, isLoading }) => {
  const cards = [
    {
      title: 'Total Shipments',
      value: summary?.total_shipments,
      icon: Package,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
      description: 'Active freight consignments',
      tooltip: 'All recorded shipments currently tracked across ocean, air, rail, and ground logistics networks.',
    },
    {
      title: 'In Transit',
      value: summary?.in_transit,
      icon: Truck,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]',
      description: 'Under active carrier movement',
      tooltip: 'Consignments currently in motion with assigned logistics carriers.',
    },
    {
      title: 'Delivered',
      value: summary?.delivered,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
      description: 'Successfully fulfilled',
      tooltip: 'Shipments that have completed transport and safely arrived at destination receiving facilities.',
    },
    {
      title: 'Delayed',
      value: summary?.delayed,
      icon: AlertTriangle,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
      description: 'Exceeded schedule buffer',
      tooltip: 'Shipments whose current expected arrival date has slipped past their original scheduled delivery date.',
    },
    {
      title: 'High-Risk Shipments',
      value: summary?.high_risk,
      icon: ShieldAlert,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
      glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',
      description: 'Risk score ≥ 60/100',
      tooltip: 'Shipments whose calculated multi-factor risk score is 60 or higher out of 100, requiring active monitoring.',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-4 rounded-2xl glass-panel border ${card.borderColor} ${card.glow} relative overflow-hidden transition-all duration-300 hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300 truncate">{card.title}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={`p-1.5 rounded-xl ${card.bgColor} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <Tooltip content={card.tooltip} />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              {isLoading ? (
                <div className="h-7 w-16 bg-slate-800 animate-pulse rounded-lg" />
              ) : (
                <span className="text-2xl font-bold text-white font-display tracking-tight">
                  {card.value !== undefined && card.value !== null ? card.value.toLocaleString() : '—'}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-1 font-mono-telemetry truncate">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
};
