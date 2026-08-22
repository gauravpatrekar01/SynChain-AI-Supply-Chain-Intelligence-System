import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Filter,
  DollarSign,
  Clock,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { MitigationStrategy } from '../../types';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { Modal } from '../common/Modal';
import { soundFX } from '../../services/audioService';

export const RecommendationsView: React.FC = () => {
  const { currentSimulationResult, executeMitigationStrategy } = useSupplyChain();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedStrategy, setSelectedStrategy] = useState<MitigationStrategy | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const strategies = currentSimulationResult?.mitigationStrategies || [
    {
      id: 'mit-rec-1',
      title: 'Authorize SK Hynix Wuxi Fab Dual-Sourcing Allocation (65,000 Wafers)',
      description: 'Activate secondary supplier agreement to divert 35% of wafer fabrication volume, compensating for Taiwan port congestion.',
      category: 'dual_sourcing',
      costEstimateUsd: 420000,
      savingsEstimateUsd: 2800000,
      timeSavedDays: 12,
      implementationTimeframe: '24-48 Hours',
      status: 'pending',
    },
    {
      id: 'mit-rec-2',
      title: 'Charter Boeing 777F Air Cargo for Microcontroller Batch #892',
      description: 'Bypass maritime typhoon delay by dispatching high-density silicon microchips via direct Taipei &rarr; Austin air freight.',
      category: 'expedited_freight',
      costEstimateUsd: 260000,
      savingsEstimateUsd: 1950000,
      timeSavedDays: 9,
      implementationTimeframe: '12 Hours',
      status: 'pending',
    },
    {
      id: 'mit-rec-3',
      title: 'Release Memphis Tier-2 Strategic Safety Buffer (18,000 Units)',
      description: 'Drawdown reserved regional safety stock to maintain continuous assembly lines in Texas while maritime transit normalizes.',
      category: 'buffer_release',
      costEstimateUsd: 95000,
      savingsEstimateUsd: 1400000,
      timeSavedDays: 7,
      implementationTimeframe: 'Immediate',
      status: 'pending',
    },
    {
      id: 'mit-rec-4',
      title: 'Cross-Dock Reroute via Busan & Long Beach Maritime Corridor',
      description: 'Divert 4 container vessels away from congested Shanghai terminals into Busan transshipment hub.',
      category: 'rerouting',
      costEstimateUsd: 180000,
      savingsEstimateUsd: 1100000,
      timeSavedDays: 6,
      implementationTimeframe: '36 Hours',
      status: 'pending',
    },
  ];

  const handleExecute = (strat: MitigationStrategy) => {
    soundFX.playSuccess();
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 },
    });
    executeMitigationStrategy(strat.id);
    setSelectedStrategy(strat);
    setIsModalOpen(true);
  };

  const filtered = strategies.filter((s) => {
    if (activeCategory === 'all') return true;
    return s.category === activeCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              AI Mitigation & Autonomous Decision Engine
            </h2>
            <NeonBadge variant="purple" size="sm">
              SYNTHESIZED
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Prescriptive reinforcement learning recommendations ranked by risk reduction ROI and time-to-value.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All Strategies' },
              { id: 'dual_sourcing', label: 'Dual Sourcing' },
              { id: 'expedited_freight', label: 'Air Freight' },
              { id: 'buffer_release', label: 'Buffer Release' },
              { id: 'rerouting', label: 'Rerouting' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                soundFX.playClick();
                setActiveCategory(cat.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl glass-panel border border-purple-500/30 space-y-1">
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Total Value at Risk Saved</span>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono-telemetry">$7.25M</p>
          <p className="text-[11px] text-slate-400">Across 4 optimized AI mitigation playbooks</p>
        </div>
        <div className="p-5 rounded-2xl glass-panel border border-blue-500/30 space-y-1">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Average Activation SLA</span>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">&lt; 24.5 Hours</p>
          <p className="text-[11px] text-slate-400">Fast ERP webhook integration</p>
        </div>
        <div className="p-5 rounded-2xl glass-panel border border-cyan-500/30 space-y-1">
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Assembly Buffer Gain</span>
          <p className="text-2xl sm:text-3xl font-bold text-cyan-300 font-mono-telemetry">+34 Days</p>
          <p className="text-[11px] text-slate-400">Restores zero-downtime safety stock</p>
        </div>
      </div>

      {/* Strategies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((strat) => (
          <div
            key={strat.id}
            className={`p-6 rounded-2xl glass-panel border transition-all space-y-4 flex flex-col justify-between ${
              strat.status === 'executed'
                ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                : 'border-white/10 hover:border-purple-500/50'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono-telemetry uppercase text-purple-400 font-semibold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30">
                  {strat.category.replace('_', ' ')}
                </span>
                <NeonBadge variant={strat.status === 'executed' ? 'optimal' : 'purple'} size="sm">
                  {strat.status === 'executed' ? 'EXECUTED' : 'READY TO DISPATCH'}
                </NeonBadge>
              </div>

              <h3 className="text-base font-bold text-white leading-snug">{strat.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{strat.description}</p>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/90 border border-white/5 text-xs font-mono-telemetry">
                <div>
                  <span className="text-slate-400 block text-[10px]">Execution Cost:</span>
                  <span className="text-slate-200 font-semibold">${(strat.costEstimateUsd / 1000).toFixed(0)}k</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Net Risk Prevented:</span>
                  <span className="text-emerald-400 font-semibold">${(strat.savingsEstimateUsd / 1000000).toFixed(2)}M</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Schedule Gain:</span>
                  <span className="text-cyan-400 font-semibold">+{strat.timeSavedDays} Days</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Lead Time to Deploy:</span>
                  <span className="text-slate-300">{strat.implementationTimeframe}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
              {strat.status === 'executed' ? (
                <div className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Dispatched via Autonomous Supply Chain Gateway</span>
                </div>
              ) : (
                <Button
                  variant="glow"
                  size="md"
                  className="w-full"
                  leftIcon={<Zap className="w-4 h-4" />}
                  onClick={() => handleExecute(strat)}
                >
                  Approve & Dispatch Order
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {selectedStrategy && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Strategy Dispatched"
          subtitle="Electronic Data Interchange (EDI 850) Transmitted"
          footer={
            <Button variant="primary" onClick={() => setIsModalOpen(false)}>
              Done
            </Button>
          }
        >
          <div className="space-y-4 text-sm text-slate-300">
            <p>
              Your approval for <strong className="text-white">{selectedStrategy.title}</strong> has been logged in the audit ledger.
            </p>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 text-xs font-mono-telemetry space-y-1">
              <p>Routing Protocol: <span className="text-purple-400">AS2 / HTTPS Webhook</span></p>
              <p>ERP Destination: <span className="text-blue-400">SAP S/4HANA Supply Chain Core</span></p>
              <p>Estimated Recovery: <span className="text-emerald-400">+{selectedStrategy.timeSavedDays} Days Ahead of Schedule</span></p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
