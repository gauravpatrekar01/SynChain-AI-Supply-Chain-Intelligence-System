import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu,
  Play,
  CloudRain,
  Building2,
  Anchor,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Layers,
  Clock,
  Gauge,
  CheckCircle2,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { DisruptionType, NodeType } from '../../types';
import { Button } from '../common/Button';
import { GlassCard } from '../common/GlassCard';
import { soundFX } from '../../services/audioService';

interface ScenarioBuilderProps {
  onNavigate: (pageId: string) => void;
}

export const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({ onNavigate }) => {
  const { runSimulation, digitalTwinNodes, isSimulating } = useSupplyChain();

  const [scenarioName, setScenarioName] = useState('East China Sea Port Typhoon Surge');
  const [disruptionType, setDisruptionType] = useState<DisruptionType>('typhoon_disruption');
  const [targetEntityId, setTargetEntityId] = useState('port-shanghai');
  const [durationDays, setDurationDays] = useState(14);
  const [severityPct, setSeverityPct] = useState(85);
  const [includeCascade, setIncludeCascade] = useState(true);
  const [autoMitigate, setAutoMitigate] = useState(true);

  // Quick Preset Scenarios
  const presets = [
    {
      name: 'Typhoon Gaemi (Shanghai & Ningbo Closure)',
      type: 'typhoon_disruption' as DisruptionType,
      targetId: 'port-shanghai',
      targetType: 'port' as NodeType,
      targetName: 'Shanghai & Ningbo Port Hub',
      days: 14,
      severity: 85,
      icon: CloudRain,
      desc: 'Category 4 storm shuts berths for 14 days, stranding 45,000 TEU microelectronics.',
    },
    {
      name: 'TSMC Wafer Fab 18 Power Outage',
      type: 'supplier_bankruptcy' as DisruptionType,
      targetId: 'tsmc-hsinchu',
      targetType: 'tier2_supplier' as NodeType,
      targetName: 'TSMC Semiconductor Foundry',
      days: 21,
      severity: 75,
      icon: Building2,
      desc: 'Critical fab contamination triggers 3-week suspension of 3nm AI logic wafer output.',
    },
    {
      name: 'Rotterdam Port Labor Strike',
      type: 'port_closure' as DisruptionType,
      targetId: 'port-rotterdam',
      targetType: 'port' as NodeType,
      targetName: 'Port of Rotterdam EuroGate',
      days: 10,
      severity: 90,
      icon: Anchor,
      desc: 'European container handling halted, cascading into automotive assembly parts delay.',
    },
    {
      name: 'Lithium & Copper Price Spike (+40%)',
      type: 'raw_material_spike' as DisruptionType,
      targetId: 'basf-ludwigshafen',
      targetType: 'tier2_supplier' as NodeType,
      targetName: 'Global Chemical & Polymer Network',
      days: 30,
      severity: 60,
      icon: TrendingUp,
      desc: 'Global commodity surge increases BOM costs and pressures battery pack margins.',
    },
  ];

  const handleApplyPreset = (p: typeof presets[0]) => {
    soundFX.playClick();
    setScenarioName(p.name);
    setDisruptionType(p.type);
    setTargetEntityId(p.targetId);
    setDurationDays(p.days);
    setSeverityPct(p.severity);
  };

  const handleStartSimulation = () => {
    const selectedNode = digitalTwinNodes.find((n) => n.id === targetEntityId);
    runSimulation({
      scenarioName,
      disruptionType,
      targetEntityId,
      targetEntityName: selectedNode ? selectedNode.label : 'Selected Entity',
      targetType: selectedNode ? selectedNode.type : 'tier1_supplier',
      durationDays,
      severityPct,
      includeSecondTierCascade: includeCascade,
      autoMitigate,
    });
    onNavigate('simulation-results');
  };

  // Real-time calculated estimates based on sliders
  const estimatedRevenueRisk = (durationDays * severityPct * 18500).toLocaleString();
  const estimatedDelayDays = Math.round(durationDays * (severityPct / 100) * 0.85);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
            AI Disruption Scenario Builder & Digital Twin Stress Test
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure synthetic black swan events, simulate multi-tier ripple effects, and synthesize AI mitigation plans.
        </p>
      </div>

      {/* Preset Scenarios Carousel / Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {presets.map((preset, idx) => {
          const Icon = preset.icon;
          return (
            <div
              key={idx}
              onClick={() => handleApplyPreset(preset)}
              className="p-4 rounded-xl glass-panel border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all cursor-pointer space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-blue-500/20 text-blue-400">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono-telemetry text-slate-400">
                  {preset.days}d / {preset.severity}%
                </span>
              </div>
              <h4 className="text-xs font-semibold text-slate-100 group-hover:text-white line-clamp-1">
                {preset.name}
              </h4>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {preset.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Builder Main Form & Live Impact Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Parameters (2 Cols) */}
        <div className="lg:col-span-2 space-y-5 rounded-2xl glass-panel border border-white/10 p-6">
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>Scenario Parameters</span>
          </h3>

          {/* Scenario Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Scenario Title</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 focus:border-blue-500/60 text-white text-sm focus:outline-none transition-colors"
            />
          </div>

          {/* Disruption Type & Target Entity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Disruption Vector</label>
              <select
                value={disruptionType}
                onChange={(e) => setDisruptionType(e.target.value as DisruptionType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs focus:border-blue-500/60 focus:outline-none cursor-pointer"
              >
                <option value="typhoon_disruption">Severe Weather / Typhoon (Port Choke)</option>
                <option value="port_closure">Port Closure / Maritime Congestion</option>
                <option value="supplier_bankruptcy">Tier-1/2 Factory Outage / Yield Drop</option>
                <option value="geopolitical_tariff">Geopolitical Embargo / Tariff Shock</option>
                <option value="raw_material_spike">Critical Raw Material Price Spike</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Digital Twin Entity</label>
              <select
                value={targetEntityId}
                onChange={(e) => setTargetEntityId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs focus:border-blue-500/60 focus:outline-none cursor-pointer"
              >
                {digitalTwinNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} ({n.country} - {n.type.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sliders: Duration & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Duration Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Duration: {durationDays} Days</span>
                </span>
                <span className="text-slate-400 font-mono-telemetry">1 - 60 Days</span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Severity Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-rose-400" />
                  <span>Disruption Severity: {severityPct}%</span>
                </span>
                <span className="text-slate-400 font-mono-telemetry">10% - 100%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={severityPct}
                onChange={(e) => setSeverityPct(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5 cursor-pointer hover:bg-slate-900">
              <input
                type="checkbox"
                checked={includeCascade}
                onChange={(e) => setIncludeCascade(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <div>
                <p className="text-xs font-semibold text-white">Tier-2 Ripple Cascade</p>
                <p className="text-[10px] text-slate-400">Simulate secondary impact on downstream plants</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5 cursor-pointer hover:bg-slate-900">
              <input
                type="checkbox"
                checked={autoMitigate}
                onChange={(e) => setAutoMitigate(e.target.checked)}
                className="w-4 h-4 rounded accent-purple-500"
              />
              <div>
                <p className="text-xs font-semibold text-white">Auto-Generate AI Mitigations</p>
                <p className="text-[10px] text-slate-400">Synthesize dual-sourcing and buffer routing</p>
              </div>
            </label>
          </div>
        </div>

        {/* Right Panel: Pre-Simulation Live Impact Card (1 Col) */}
        <div className="rounded-2xl glass-panel border border-blue-500/30 p-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white font-display">Pre-Computation Live Estimate</h3>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400">Estimated Revenue at Risk:</span>
                <p className="text-xl font-bold text-rose-400 font-mono-telemetry">
                  ${estimatedRevenueRisk}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400">Projected Delivery Delay:</span>
                <p className="text-xl font-bold text-amber-300 font-mono-telemetry">
                  +{estimatedDelayDays} Days
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400">Impacted Production Volume:</span>
                <p className="text-lg font-bold text-slate-200 font-mono-telemetry">
                  ~{(durationDays * 3200).toLocaleString()} Assembly Units
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="glow"
              size="lg"
              className="w-full"
              isLoading={isSimulating}
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              onClick={handleStartSimulation}
            >
              Run AI Monte Carlo Simulation
            </Button>
            <p className="text-center text-[10px] text-slate-500 font-mono-telemetry">
              Executes 10,000 stochastic supply chain runs in ~1.2s
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
