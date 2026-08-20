import React, { useState } from 'react';
import {
  Settings,
  Volume2,
  Sparkles,
  Cpu,
  Key,
  Database,
  CheckCircle2,
  RotateCcw,
  Radio,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, theme, setTheme } = useTheme();
  const { resetState } = useSupplyChain();

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success'>('idle');

  const handleTestAPI = () => {
    soundFX.playClick();
    setTestStatus('testing');
    setTimeout(() => {
      soundFX.playSuccess();
      setTestStatus('success');
    }, 1000);
  };

  const handleReset = () => {
    soundFX.playClick();
    resetState();
    alert('System State & Simulation Telemetry Reset to Default.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              System Settings & Integration Gateway
            </h2>
            <NeonBadge variant="blue" size="sm">
              ENTERPRISE v4.2
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure reinforcement learning hyperparameters, UI audio synthesis, and enterprise ERP API connectors.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audio & Visual Preferences */}
        <div className="rounded-2xl glass-panel border border-white/10 p-6 space-y-4">
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Audio & Visual Aesthetics</span>
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <div>
                <p className="text-xs font-semibold text-white">Synthesized Audio Effects</p>
                <p className="text-[11px] text-slate-400">Tactile sci-fi sound design on interactions and dispatches</p>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <div>
                <p className="text-xs font-semibold text-white">Active Neural Background Particles</p>
                <p className="text-[11px] text-slate-400">Render dynamic constellation canvas</p>
              </div>
              <input
                type="checkbox"
                checked={settings.animationsEnabled}
                onChange={(e) => updateSettings({ animationsEnabled: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <div>
                <p className="text-xs font-semibold text-white">Live Stream Ticker Updates</p>
                <p className="text-[11px] text-slate-400">Stream incoming AIS maritime and factory incident events</p>
              </div>
              <input
                type="checkbox"
                checked={settings.liveTelemetryStream}
                onChange={(e) => updateSettings({ liveTelemetryStream: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* AI Engine Hyperparameters */}
        <div className="rounded-2xl glass-panel border border-white/10 p-6 space-y-4">
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>AI Neural Core Configuration</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Monte Carlo Stochastic Iterations</label>
              <select className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white focus:outline-none focus:border-blue-500/50">
                <option value="10000">10,000 Iterations (Recommended - 1.2s)</option>
                <option value="50000">50,000 Iterations (Deep Simulation - 4.8s)</option>
                <option value="100000">100,000 Iterations (Exhaustive Black Swan)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Forecast Confidence Interval Target</label>
              <select className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-white focus:outline-none focus:border-blue-500/50">
                <option value="95">95% Confidence Band (Standard)</option>
                <option value="99">99% High-Certainty Band</option>
                <option value="90">90% Aggressive Optimization</option>
              </select>
            </div>
          </div>
        </div>

        {/* ERP & API Connectors */}
        <div className="lg:col-span-2 rounded-2xl glass-panel border border-white/10 p-6 space-y-4">
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Enterprise Gateway Connectors</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">SAP S/4HANA Cloud</h4>
                <NeonBadge variant="optimal" size="sm">
                  CONNECTED
                </NeonBadge>
              </div>
              <p className="text-[11px] text-slate-400">EDI 850 / Purchase Orders</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">Oracle NetSuite ERP</h4>
                <NeonBadge variant="optimal" size="sm">
                  CONNECTED
                </NeonBadge>
              </div>
              <p className="text-[11px] text-slate-400">Inventory & Bill of Materials</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">Spire AIS Satellite</h4>
                <NeonBadge variant="cyan" size="sm">
                  14ms STREAM
                </NeonBadge>
              </div>
              <p className="text-[11px] text-slate-400">Live Global Maritime Telemetry</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={handleReset}
            >
              Reset Demo State
            </Button>

            <Button
              variant="glow"
              size="sm"
              isLoading={testStatus === 'testing'}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              onClick={handleTestAPI}
            >
              {testStatus === 'success' ? 'All Endpoints Nominal (200 OK)' : 'Ping All Enterprise Gateways'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
