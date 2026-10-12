import React, { useState } from 'react';
import { X, Play, Zap, ShieldAlert, CheckCircle2, TrendingDown, Clock, DollarSign, Layers } from 'lucide-react';
import { apiService } from '../../services/api';
import { soundFX } from '../../services/audioService';

interface ScenarioSimulateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEntity?: { id: string; name: string } | null;
}

export const ScenarioSimulateModal: React.FC<ScenarioSimulateModalProps> = ({
  isOpen,
  onClose,
  initialEntity,
}) => {
  const [scenarioName, setScenarioName] = useState('Severe Corridors Weather Disruption');
  const [disruptionType, setDisruptionType] = useState('weather_disruption');
  const [targetEntityName, setTargetEntityName] = useState(initialEntity?.name || 'Memphis SuperHub');
  const [durationDays, setDurationDays] = useState(14);
  const [severityPct, setSeverityPct] = useState(55);
  const [includeCascade, setIncludeCascade] = useState(true);
  const [autoMitigate, setAutoMitigate] = useState(true);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleRunSimulation = async () => {
    soundFX.playClick();
    setIsSimulating(true);
    try {
      const payload = {
        scenarioName,
        disruptionType,
        targetEntityId: initialEntity?.id || 'hub-memphis',
        targetEntityName,
        durationDays,
        severityPct,
        includeSecondTierCascade: includeCascade,
        autoMitigate,
      };
      const result = await apiService.simulateDashboardScenario(payload);
      setSimResult(result);
      soundFX.playSuccess();
    } catch (err) {
      soundFX.playError();
      console.error('Simulation failed', err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/10 border border-amber-500/30 text-amber-400">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white">What-If Stochastic Scenario Simulator</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Non-destructive Monte Carlo simulation using validated baseline data and analytical graph logic
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Scenario Name</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Disruption Target Entity</label>
            <input
              type="text"
              value={targetEntityName}
              onChange={(e) => setTargetEntityName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">Duration (Days)</label>
              <span className="text-xs font-mono text-blue-400 font-bold">{durationDays} Days</span>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">Severity Constraint (%)</label>
              <span className="text-xs font-mono text-amber-400 font-bold">{severityPct}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={severityPct}
              onChange={(e) => setSeverityPct(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCascade}
                onChange={(e) => setIncludeCascade(e.target.checked)}
                className="rounded accent-blue-500"
              />
              Include Tier-2 Network Cascade Propagation
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoMitigate}
                onChange={(e) => setAutoMitigate(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              Synthesize Autonomous AI Mitigation Playbook
            </label>
          </div>
        </div>

        {/* Trigger Button */}
        <div className="flex justify-end">
          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isSimulating ? 'animate-pulse' : ''}`} />
            {isSimulating ? 'Executing Monte Carlo Iterations...' : 'Run Simulation'}
          </button>
        </div>

        {/* Simulation Results Display */}
        {simResult && (
          <div className="space-y-5 pt-4 border-t border-slate-800 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Simulation Outcome: {simResult.scenarioName}
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                Baseline: {simResult.preRiskScore || 26} &rarr; Post-Risk:{' '}
                <span className="text-rose-400 font-bold">{simResult.riskScorePostSimulation || 68}</span>
              </span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Estimated Revenue Loss</span>
                <span className="font-mono text-base font-bold text-rose-400 mt-1 block">
                  ${((simResult.financialLossEstimateUsd || 0) / 1000000).toFixed(2)}M
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Production Unit Loss</span>
                <span className="font-mono text-base font-bold text-amber-400 mt-1 block">
                  {(simResult.lostProductionUnits || 0).toLocaleString()} Units
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Average Shipment Delay</span>
                <span className="font-mono text-base font-bold text-yellow-400 mt-1 block">
                  +{simResult.estimatedDelayDays || 8.4} Days
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Net Exposure</span>
                <span className="font-mono text-base font-bold text-indigo-400 mt-1 block">
                  ${((simResult.netFinancialExposureUsd || 0) / 1000000).toFixed(2)}M
                </span>
              </div>
            </div>

            {/* Mitigation Strategies if Available */}
            {simResult.mitigationStrategies && simResult.mitigationStrategies.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Synthesized Autonomous Mitigation Playbook
                </h5>
                <div className="space-y-2">
                  {simResult.mitigationStrategies.map((strat: any) => (
                    <div
                      key={strat.id}
                      className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-emerald-300 block">{strat.title}</span>
                        <p className="text-slate-400 text-[11px] mt-0.5">{strat.description}</p>
                      </div>
                      <div className="shrink-0 text-right font-mono text-[11px]">
                        <span className="text-emerald-400 font-bold block">
                          Savings: +${((strat.savingsEstimateUsd || 0) / 1000000).toFixed(1)}M
                        </span>
                        <span className="text-slate-400 block">Cost: ${strat.costEstimateUsd?.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
