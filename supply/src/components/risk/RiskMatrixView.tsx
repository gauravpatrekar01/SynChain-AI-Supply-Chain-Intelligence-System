import React, { useState } from 'react';
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
import { soundFX } from '../../services/audioService';

interface RiskMatrixViewProps {
  onNavigate: (pageId: string) => void;
}

export const RiskMatrixView: React.FC<RiskMatrixViewProps> = ({ onNavigate }) => {
  const { risks, incidents } = useSupplyChain();
  const [selectedRisk, setSelectedRisk] = useState<RiskItem | null>(risks[0] || null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 5x5 Matrix coordinates (Prob: 5 to 1, Sev: 1 to 5)
  const probabilityLabels = ['5 - Almost Certain', '4 - Likely', '3 - Possible', '2 - Unlikely', '1 - Rare'];
  const severityLabels = ['1 - Insignificant', '2 - Minor', '3 - Moderate', '4 - Major', '5 - Catastrophic'];

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
              5x5 Supply Chain Risk Matrix & Vulnerability Radar
            </h2>
            <NeonBadge variant="high" size="sm">
              ACTIVE RADAR
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Dynamic probability vs impact assessment mapped across 248 global supply nodes.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search risk or entity..."
            className="pl-9 pr-4 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* 5x5 Matrix & Selected Risk Detail (2 Col Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 5x5 Matrix Grid (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl glass-panel border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-display">
              Enterprise Risk Probability vs Impact Grid
            </h3>
            <span className="text-xs text-slate-400 font-mono-telemetry">
              ISO 31000 Standard
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              {/* Matrix Layout */}
              <div className="grid grid-cols-6 gap-2 text-xs">
                {/* Top Corner Blank */}
                <div className="p-2 font-mono text-[10px] text-slate-400 font-bold flex items-center justify-center">
                  PROB \ SEV
                </div>

                {/* Severity Columns Header */}
                {severityLabels.map((sev, idx) => (
                  <div
                    key={idx}
                    className="p-2 text-center font-semibold text-slate-300 bg-white/5 rounded-lg text-[10px]"
                  >
                    {sev}
                  </div>
                ))}

                {/* 5 Probability Rows */}
                {[5, 4, 3, 2, 1].map((prob) => (
                  <React.Fragment key={`row-${prob}`}>
                    {/* Probability Row Label */}
                    <div className="p-2 font-semibold text-slate-300 bg-white/5 rounded-lg text-[10px] flex items-center justify-center text-center">
                      P{prob}
                    </div>

                    {/* 5 Severity Cells */}
                    {[1, 2, 3, 4, 5].map((sev) => {
                      const matchingRisks = risks.filter(
                        (r) => r.probability === prob && r.severityScore === sev
                      );

                      return (
                        <div
                          key={`cell-${prob}-${sev}`}
                          className={`min-h-[70px] p-1.5 rounded-xl border flex flex-col gap-1 transition-all ${getCellColor(
                            prob,
                            sev
                          )}`}
                        >
                          <div className="text-[9px] font-mono opacity-50 text-right">
                            {prob * sev}
                          </div>
                          {matchingRisks.map((risk) => (
                            <motion.button
                              key={risk.id}
                              whileHover={{ scale: 1.05 }}
                              onClick={() => {
                                soundFX.playClick();
                                setSelectedRisk(risk);
                              }}
                              className={`p-1.5 rounded-lg text-[10px] font-bold text-left leading-tight truncate border cursor-pointer ${
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
                <span className="text-xs font-mono-telemetry text-slate-400">
                  Score: <strong className="text-rose-400">{selectedRisk.compositeScore} / 25</strong>
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{selectedRisk.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Affected Entity: <span className="text-slate-200 font-semibold">{selectedRisk.affectedEntity}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Category:</span>
                  <span className="capitalize text-slate-200 font-semibold">{selectedRisk.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Probability Level:</span>
                  <span className="text-white font-mono font-semibold">{selectedRisk.probability} / 5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Severity Impact:</span>
                  <span className="text-rose-400 font-mono font-semibold">{selectedRisk.severityScore} / 5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Financial Exposure:</span>
                  <span className="text-amber-300 font-mono font-semibold">${(selectedRisk.financialImpactUsd / 1000000).toFixed(2)}M</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-purple-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>AI Mitigation Action</span>
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
                Execute Mitigation Strategy &rarr;
              </Button>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <ShieldAlert className="w-8 h-8 mx-auto text-slate-500" />
              <p className="text-xs">Click any risk in the matrix to inspect full vulnerability telemetry.</p>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Incident Audit Log */}
      <div className="rounded-2xl glass-panel border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>Incident Stream & Vulnerability Audit Ledger</span>
          </h3>
          <span className="text-xs text-slate-400">{incidents.length} Telemetry Events Logged</span>
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
                  <p className="text-[11px] text-slate-400">{inc.impactSummary}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 font-mono-telemetry text-[11px] text-slate-400">
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
