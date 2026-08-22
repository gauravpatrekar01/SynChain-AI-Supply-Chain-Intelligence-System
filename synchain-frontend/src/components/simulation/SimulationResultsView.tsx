import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import confetti from 'canvas-confetti';
import {
  Zap,
  TrendingDown,
  Clock,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Share2,
  FileDown,
  RotateCcw,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { MitigationStrategy } from '../../types';
import { Button } from '../common/Button';
import { GlassCard } from '../common/GlassCard';
import { NeonBadge } from '../common/NeonBadge';
import { Modal } from '../common/Modal';
import { soundFX } from '../../services/audioService';

interface SimulationResultsViewProps {
  onNavigate: (pageId: string) => void;
}

export const SimulationResultsView: React.FC<SimulationResultsViewProps> = ({ onNavigate }) => {
  const { currentSimulationResult, executeMitigationStrategy, isSimulating } = useSupplyChain();
  const [selectedStrategyForDispatch, setSelectedStrategyForDispatch] = useState<MitigationStrategy | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  if (!currentSimulationResult) {
    return (
      <div className="p-12 text-center rounded-2xl glass-panel border border-white/10 space-y-4">
        <Zap className="w-12 h-12 text-blue-400 mx-auto opacity-50" />
        <h3 className="text-lg font-bold text-white">No Simulation Results in Memory</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Please construct and run a disruption scenario in the Scenario Builder to generate synthetic impact telemetry.
        </p>
        <Button variant="glow" onClick={() => onNavigate('scenario-builder')}>
          Open Scenario Builder
        </Button>
      </div>
    );
  }

  const {
    scenarioName,
    financialLossEstimateUsd,
    lostProductionUnits,
    estimatedDelayDays,
    riskScorePostSimulation,
    cascadingTimeline,
    mitigationStrategies,
    dailyImpactTrend,
  } = currentSimulationResult;

  const handleDispatch = (strat: MitigationStrategy) => {
    soundFX.playSuccess();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3B82F6', '#8B5CF6', '#10B981', '#06B6D4'],
    });
    executeMitigationStrategy(strat.id);
    setSelectedStrategyForDispatch(strat);
    setIsSuccessModalOpen(true);
  };

  // ECharts Comparison: Unmitigated vs Mitigated
  const comparisonOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(59, 130, 246, 0.4)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    legend: {
      data: ['Unmitigated Disrupted Trajectory', 'AI Optimal Mitigated Trajectory'],
      textStyle: { color: '#94a3b8', fontSize: 11 },
      top: 0,
      right: 10,
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: '4%',
      top: '16%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dailyImpactTrend.map((d) => `Day ${d.day}`),
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 11,
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
      },
    },
    series: [
      {
        name: 'Unmitigated Disrupted Trajectory',
        type: 'line',
        data: dailyImpactTrend.map((d) => d.lossWithoutMitigation),
        smooth: true,
        itemStyle: { color: '#ef4444' },
        lineStyle: { width: 3, color: '#ef4444' },
        areaStyle: { color: 'rgba(239, 68, 68, 0.15)' },
      },
      {
        name: 'AI Optimal Mitigated Trajectory',
        type: 'line',
        data: dailyImpactTrend.map((d) => d.lossWithMitigation),
        smooth: true,
        itemStyle: { color: '#10b981' },
        lineStyle: { width: 3, color: '#10b981' },
        areaStyle: { color: 'rgba(16, 185, 129, 0.2)' },
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Simulation Results & AI Mitigation Engine
            </h2>
            <NeonBadge variant="purple" size="sm">
              COMPUTED
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Scenario: <span className="text-white font-semibold">{scenarioName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('scenario-builder')}
          >
            New Scenario
          </Button>
          <Button
            variant="glow"
            size="sm"
            leftIcon={<FileDown className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('reports')}
          >
            Export Executive Brief
          </Button>
        </div>
      </div>

      {/* 4 Primary Impact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-panel border border-rose-500/30 space-y-2">
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
            Unmitigated Revenue Risk
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">
            ${(financialLossEstimateUsd / 1000000).toFixed(2)}M
          </p>
          <p className="text-[11px] text-slate-400">Direct component and delay penalties</p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-amber-500/30 space-y-2">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Assembly Units Stalled
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">
            {lostProductionUnits.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400">Finished goods assembly deficit</p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-cyan-500/30 space-y-2">
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Network Delivery Delay
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-white font-mono-telemetry">
            +{estimatedDelayDays} Days
          </p>
          <p className="text-[11px] text-slate-400">Critical customer fulfillment SLA variance</p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-purple-500/30 space-y-2">
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
            Network Risk Score
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-rose-400 font-mono-telemetry">
            {riskScorePostSimulation} / 100
          </p>
          <p className="text-[11px] text-slate-400">Elevated stress on Tier-1 buffer</p>
        </div>
      </div>

      {/* Comparison Chart */}
      <GlassCard
        title="Disruption vs AI Mitigation Trajectory (Daily Cumulative Loss)"
        subtitle="Visualizing financial recovery achieved through multi-echelon AI autonomous dispatch"
        badge={
          <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Saves ~$3.2M Net</span>
          </div>
        }
      >
        <div className="h-72 w-full">
          <ReactECharts option={comparisonOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
        </div>
      </GlassCard>

      {/* Cascading Impact Timeline */}
      <div className="rounded-2xl glass-panel border border-white/10 p-6 space-y-4">
        <h3 className="text-base font-bold text-white font-display">Cascading Multi-Tier Ripple Timeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {cascadingTimeline.map((step, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2 relative">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-cyan-400">Day {step.day}</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    step.impactLevel === 'critical'
                      ? 'bg-rose-500/20 text-rose-300'
                      : step.impactLevel === 'high'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {step.impactLevel.toUpperCase()}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-white">{step.affectedEntity}</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Mitigation Action Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Recommended AI Mitigation Strategies</span>
          </h3>
          <span className="text-xs text-slate-400">Ranked by Net Financial ROI</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mitigationStrategies.map((strat) => (
            <div
              key={strat.id}
              className={`p-6 rounded-2xl glass-panel border transition-all space-y-4 flex flex-col justify-between ${
                strat.status === 'executed'
                  ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                  : 'border-white/10 hover:border-blue-500/50'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono-telemetry uppercase text-purple-400 font-semibold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30">
                    {strat.category.replace('_', ' ')}
                  </span>
                  <NeonBadge variant={strat.status === 'executed' ? 'optimal' : 'purple'} size="sm">
                    {strat.status === 'executed' ? 'DISPATCHED' : 'READY'}
                  </NeonBadge>
                </div>

                <h4 className="text-sm font-bold text-white leading-snug">{strat.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{strat.description}</p>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-white/5 space-y-1.5 text-xs font-mono-telemetry">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Execution Cost:</span>
                    <span className="text-slate-200">${(strat.costEstimateUsd / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Financial Loss Prevented:</span>
                    <span className="text-emerald-400 font-semibold">
                      ${(strat.savingsEstimateUsd / 1000000).toFixed(2)}M
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Days Recovered:</span>
                    <span className="text-cyan-400 font-semibold">{strat.timeSavedDays} Days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lead Time to Activate:</span>
                    <span className="text-slate-300">{strat.implementationTimeframe}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                {strat.status === 'executed' ? (
                  <div className="w-full py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Active in Supply Chain</span>
                  </div>
                ) : (
                  <Button
                    variant="glow"
                    size="sm"
                    className="w-full"
                    leftIcon={<Zap className="w-4 h-4" />}
                    onClick={() => handleDispatch(strat)}
                  >
                    Execute Strategy
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dispatch Confirmation Modal */}
      {selectedStrategyForDispatch && (
        <Modal
          isOpen={isSuccessModalOpen}
          onClose={() => setIsSuccessModalOpen(false)}
          title="Mitigation Action Dispatched"
          subtitle="Autonomous order dispatch routed via EDI / API Gateway"
          footer={
            <Button variant="primary" onClick={() => setIsSuccessModalOpen(false)}>
              Acknowledge & Continue
            </Button>
          }
        >
          <div className="space-y-4 text-sm text-slate-300">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-white">
                  Strategy: {selectedStrategyForDispatch.title}
                </h4>
                <p className="text-xs text-emerald-300/90 mt-1">
                  Purchase orders & route changes transmitted to ERP (SAP / Oracle NetSuite). Production schedule buffer restored by {selectedStrategyForDispatch.timeSavedDays} days.
                </p>
              </div>
            </div>

            <div className="text-xs space-y-1.5 font-mono-telemetry p-3 rounded-xl bg-slate-900/60">
              <p className="text-slate-400">Transaction Hash: <span className="text-slate-200">0x8f19...c4b2</span></p>
              <p className="text-slate-400">Status: <span className="text-emerald-400">CONFIRMED (200 OK)</span></p>
              <p className="text-slate-400">Net Value Saved: <span className="text-emerald-300">${(selectedStrategyForDispatch.savingsEstimateUsd / 1000000).toFixed(2)}M</span></p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
