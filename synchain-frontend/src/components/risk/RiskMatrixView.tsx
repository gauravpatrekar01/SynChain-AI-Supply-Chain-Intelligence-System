import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  AlertTriangle,
  Sparkles,
  Search,
  Filter,
  CheckCircle,
  ArrowRight,
  Radio,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { RiskItem, RiskSeverity } from '../../types';
import { NeonBadge } from '../common/NeonBadge';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { soundFX } from '../../services/audioService';

interface RiskMatrixViewProps {
  onNavigate: (pageId: string) => void;
}

export const RiskMatrixView: React.FC<RiskMatrixViewProps> = ({ onNavigate }) => {
  const { risks, incidents, digitalTwinNodes } = useSupplyChain();
  const [selectedRisk, setSelectedRisk] = useState<RiskItem | null>(risks[0] || null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!selectedRisk && risks.length > 0) {
      setSelectedRisk(risks[0]);
    }
  }, [risks, selectedRisk]);

  // 5x5 Matrix coordinates (Prob: 5 to 1, Sev: 1 to 5)
  const probabilityDescriptions: Record<number, string> = {
    5: '5 - Almost Certain',
    4: '4 - Likely',
    3: '3 - Possible',
    2: '2 - Unlikely',
    1: '1 - Rare',
  };

  const severityLabels = [
    '1 - Minor Impact',
    '2 - Low Impact',
    '3 - Moderate',
    '4 - High Impact',
    '5 - Critical Impact',
  ];

  // Matrix cell background color based on score (prob * sev)
  const getCellColor = (prob: number, sev: number) => {
    const score = prob * sev;
    if (score >= 16) return 'bg-rose-500/25 border-rose-500/40 text-rose-300';
    if (score >= 10) return 'bg-amber-500/20 border-amber-500/35 text-amber-300';
    if (score >= 5) return 'bg-blue-500/15 border-blue-500/30 text-blue-300';
    return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
  };

  const filteredRisks = risks.filter((r) => {
    const matchCat = categoryFilter === 'all' || r.category === categoryFilter;
    const matchSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.affectedEntity.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Supply Chain Risk Matrix
            </h2>
            <NeonBadge variant="high" size="sm">
              {risks.length} RISKS MONITORED
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Identify problems based on how likely they are to happen and how serious their impact could be across {digitalTwinNodes.length} supply locations.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search risk or location..."
            className="pl-9 pr-4 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* 5x5 Matrix & Selected Risk Detail (2 Col Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 5x5 Matrix Grid (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl glass-panel border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-display">
                Risk Level by Likelihood and Impact
              </h3>
              <Tooltip
                content={
                  <div>
                    <p className="font-semibold text-white mb-1">5x5 Risk Grid</p>
                    <p className="mb-1"><span className="text-emerald-400 font-medium">Vertical Axis:</span> Likelihood (how likely a disruption is to occur, 1 to 5).</p>
                    <p className="mb-1"><span className="text-blue-400 font-medium">Horizontal Axis:</span> Impact Severity (the operational and financial damage if it occurs, 1 to 5).</p>
                    <p><span className="text-amber-400 font-medium">Cell Score:</span> Likelihood multiplied by Impact. Higher numbers (red) need immediate preventive action.</p>
                  </div>
                }
              />
            </div>
            <span className="text-xs text-slate-400">
              Standard 5x5 Risk Evaluation
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[540px]">
              {/* Matrix Layout */}
              <div className="grid grid-cols-6 gap-2 text-xs">
                {/* Top Corner Blank */}
                <div className="p-2 font-mono text-[11px] text-slate-400 font-semibold flex items-center justify-center text-center">
                  Likelihood \ Impact
                </div>

                {/* Severity Columns Header */}
                {severityLabels.map((sev, idx) => (
                  <div
                    key={idx}
                    className="p-2 text-center font-semibold text-slate-300 bg-white/5 rounded-lg text-[11px] flex items-center justify-center"
                  >
                    {sev}
                  </div>
                ))}

                {/* 5 Probability Rows */}
                {[5, 4, 3, 2, 1].map((prob) => (
                  <React.Fragment key={`row-${prob}`}>
                    {/* Probability Row Label */}
                    <div className="p-2 font-semibold text-slate-300 bg-white/5 rounded-lg text-[11px] flex items-center justify-center text-center leading-tight">
                      {probabilityDescriptions[prob]}
                    </div>

                    {/* 5 Severity Cells */}
                    {[1, 2, 3, 4, 5].map((sev) => {
                      const matchingRisks = risks.filter(
                        (r) => r.probability === prob && r.severityScore === sev
                      );

                      return (
                        <div
                          key={`cell-${prob}-${sev}`}
                          className={`min-h-[72px] p-1.5 rounded-xl border flex flex-col gap-1 transition-all ${getCellColor(
                            prob,
                            sev
                          )}`}
                        >
                          <div className="text-[10px] font-mono opacity-60 text-right font-semibold">
                            {prob * sev}
                          </div>
                          {matchingRisks.map((risk) => (
                            <motion.button
                              key={risk.id}
                              whileHover={{ scale: 1.04 }}
                              onClick={() => {
                                soundFX.playClick();
                                setSelectedRisk(risk);
                              }}
                              className={`p-1.5 rounded-lg text-[11px] font-semibold text-left leading-tight truncate border cursor-pointer ${
                                selectedRisk?.id === risk.id
                                  ? 'ring-2 ring-white bg-slate-900 text-white shadow-lg'
                                  : 'bg-black/40 text-slate-100 hover:bg-black/60 border-white/10'
                              }`}
                            >
                              {risk.title}
                            </motion.button>
                          ))}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Selected Risk Inspector (1 Col) */}
        <div className="rounded-2xl glass-panel border border-blue-500/30 p-6 flex flex-col justify-between space-y-4 shadow-xl">
          {selectedRisk ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <NeonBadge variant={selectedRisk.severity} size="sm">
                  {selectedRisk.severity.toUpperCase()} RISK
                </NeonBadge>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">
                    Risk Score: <strong className="text-rose-400 font-mono">{selectedRisk.compositeScore} / 25</strong>
                  </span>
                  <Tooltip
                    content={
                      <div>
                        <p className="font-semibold text-white mb-1">Risk Composite Score</p>
                        <p><span className="text-emerald-400 font-medium">Formula:</span> Chance of Happening ({selectedRisk.probability}) × Impact Severity ({selectedRisk.severityScore}) = {selectedRisk.compositeScore}. Scores 16+ represent high-priority vulnerabilities.</p>
                      </div>
                    }
                  />
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{selectedRisk.title}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Affected Node or Product: <span className="text-slate-200 font-semibold">{selectedRisk.affectedEntity}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/5 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Risk Category:</span>
                  <span className="capitalize text-slate-200 font-semibold">{selectedRisk.category}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Chance of Happening:</span>
                  <span className="text-white font-mono font-semibold">{selectedRisk.probability} / 5 ({probabilityDescriptions[selectedRisk.probability]})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Impact Severity:</span>
                  <span className="text-rose-400 font-mono font-semibold">{selectedRisk.severityScore} / 5</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Potential Financial Loss:</span>
                  <span className="text-amber-300 font-mono font-semibold">${(selectedRisk.financialImpactUsd / 1000000).toFixed(2)}M</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-purple-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Recommended Action</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {selectedRisk.mitigationAction}
                </p>
              </div>

              <Button
                variant="glow"
                size="sm"
                className="w-full"
                onClick={() => onNavigate('recommendations')}
              >
                Apply Recommended Action &rarr;
              </Button>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <ShieldAlert className="w-8 h-8 mx-auto text-slate-500" />
              <p className="text-xs">Click any risk in the matrix to inspect its full details and recommendations.</p>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Incident Audit Log */}
      <div className="rounded-2xl glass-panel border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>Risk and Incident Log</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live history of disruption events and alerts across suppliers and transport lanes.
            </p>
          </div>
          <span className="text-xs text-slate-400">{incidents.length} System Events Recorded</span>
        </div>

        <div className="space-y-2">
          {incidents.map((inc) => (
            <div
              key={inc.id}
              className="p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <NeonBadge variant={inc.severity} size="sm">
                  {inc.severity.toUpperCase()}
                </NeonBadge>
                <div>
                  <h4 className="font-semibold text-white">{inc.title}</h4>
                  <p className="text-[12px] text-slate-400">{inc.impactSummary}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 font-mono-telemetry text-[12px] text-slate-400">
                <span>{inc.source}</span>
                <span className="text-slate-300">{inc.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
