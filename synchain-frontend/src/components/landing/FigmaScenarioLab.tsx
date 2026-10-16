import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitBranch, Play, CheckSquare, Square, 
  ArrowUpRight, Clock, DollarSign, AlertTriangle, 
  FileText, CheckCircle2, ChevronDown, Sliders, X, Download
} from 'lucide-react';

export const FigmaScenarioLab: React.FC = () => {
  const [dwellTime, setDwellTime] = useState(72);
  const [selectedDisruption, setSelectedDisruption] = useState('Port congestion');
  const [selectedAlternative, setSelectedAlternative] = useState<'hold' | 'antwerp' | 'expedite'>('antwerp');
  const [constraints, setConstraints] = useState({
    approvedCarriers: true,
    protectPriority: true,
    respectCapacity: true,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const toggleConstraint = (key: keyof typeof constraints) => {
    setConstraints(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
    }, 450);
  };

  const holdDelay = dwellTime;
  const antwerpDelay = Math.max(12, Math.round(dwellTime * 0.33));
  const antwerpCost = 8400;
  const expediteDelay = 12;
  const expediteCost = Math.round(24600 * (dwellTime / 72));

  return (
    <section id="scenarios" className="py-24 bg-[#070C18] border-b border-cyan-500/10 relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        
        {/* Section Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="text-cyan-400 font-mono text-xs uppercase tracking-widest mb-3 font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              SCENARIO LAB / PORT DISRUPTION
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display leading-tight">
              Test the disruption.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                Before it tests your operation.
              </span>
            </h2>
          </div>
          <div className="text-slate-400 max-w-md text-xs sm:text-sm font-mono uppercase tracking-wider md:text-right">
            ILLUSTRATIVE MODEL · NOT AN OPERATIONAL RECOMMENDATION
          </div>
        </div>

        {/* 3-Column Scenario Workbench (Strict alignment and sizing) */}
        <div className="rounded-2xl border border-cyan-500/20 bg-[#090F1E] shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden">
          <div className="flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-white/[0.08]">
            
            {/* Column 1: Disruption Event Controls (Fixed comfortable width) */}
            <div className="w-full lg:w-[290px] xl:w-[310px] shrink-0 p-6 lg:p-7 bg-[#070D1B] flex flex-col justify-between">
              <div>
                {/* Disruption Event */}
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Disruption event
                </div>
                <div className="relative mb-5">
                  <select 
                    value={selectedDisruption}
                    onChange={(e) => setSelectedDisruption(e.target.value)}
                    className="w-full bg-[#0D1527] text-white font-sans text-sm font-medium border border-white/10 rounded-lg px-3.5 py-2.5 appearance-none pr-9 cursor-pointer focus:outline-none focus:border-cyan-500 transition-colors"
                  >
                    <option>Port congestion</option>
                    <option>Berth labor strike</option>
                    <option>Severe typhoon warning</option>
                    <option>Canal traffic obstruction</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Affected Node */}
                <div className="mb-5">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    Affected node
                  </div>
                  <div className="text-base font-semibold text-white whitespace-nowrap">
                    Rotterdam · <span className="font-mono text-slate-300">NLRTM</span>
                  </div>
                </div>

                {/* Additional Dwell Time Slider */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="text-slate-400 uppercase text-[11px]">Additional dwell time</span>
                    <span className="text-amber-400 font-bold text-sm">+{dwellTime}h</span>
                  </div>
                  
                  {/* Slider track with orange progress */}
                  <div className="relative py-1">
                    <input 
                      type="range" 
                      min="0" 
                      max="120" 
                      step="6"
                      value={dwellTime}
                      onChange={(e) => setDwellTime(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer bg-slate-800 rounded-lg h-1.5"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                    <span>0h</span>
                    <span>120h</span>
                  </div>
                </div>

                {/* Constraints Applied */}
                <div className="space-y-3 mb-6">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                    Constraints applied
                  </div>

                  <div 
                    onClick={() => toggleConstraint('approvedCarriers')}
                    className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none group"
                  >
                    <div className="w-4 h-4 rounded border border-cyan-500/40 bg-cyan-950/40 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 shrink-0 transition-colors">
                      {constraints.approvedCarriers ? <CheckSquare className="w-3.5 h-3.5" /> : null}
                    </div>
                    <span className="whitespace-nowrap">Approved carriers only</span>
                  </div>

                  <div 
                    onClick={() => toggleConstraint('protectPriority')}
                    className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none group"
                  >
                    <div className="w-4 h-4 rounded border border-cyan-500/40 bg-cyan-950/40 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 shrink-0 transition-colors">
                      {constraints.protectPriority ? <CheckSquare className="w-3.5 h-3.5" /> : null}
                    </div>
                    <span className="whitespace-nowrap">Protect priority orders</span>
                  </div>

                  <div 
                    onClick={() => toggleConstraint('respectCapacity')}
                    className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none group"
                  >
                    <div className="w-4 h-4 rounded border border-cyan-500/40 bg-cyan-950/40 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 shrink-0 transition-colors">
                      {constraints.respectCapacity ? <CheckSquare className="w-3.5 h-3.5" /> : null}
                    </div>
                    <span className="whitespace-nowrap">Respect capacity limits</span>
                  </div>
                </div>
              </div>

              {/* Compare scenarios Button matching Figma cyan fill */}
              <button 
                onClick={handleRunSimulation}
                className="w-full mt-4 py-3 rounded-lg bg-[#38BDF8] hover:bg-[#0EA5E9] text-slate-950 font-bold font-mono text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.35)]"
              >
                <Play className={`w-3.5 h-3.5 fill-current ${isSimulating ? 'animate-spin' : ''}`} />
                <span>{isSimulating ? 'Recalculating...' : 'Compare scenarios'}</span>
              </button>
            </div>

            {/* Column 2: Trade-Off Matrix (Expands flexibly in the middle) */}
            <div className="flex-1 min-w-0 p-6 lg:p-8 bg-[#090F1E] flex flex-col justify-between">
              <div>
                {/* Header Strip */}
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/[0.08]">
                  <span className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                    02 / COMPARE THE TRADE-OFFS
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#0D2136] border border-cyan-500/30 text-cyan-400 text-[11px] font-mono font-semibold">
                    • 3 ALTERNATIVES
                  </span>
                </div>

                {/* 3 Metrics Counters (from Figma) */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div>
                    <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">12</div>
                    <div className="text-xs text-slate-400 mt-1 font-sans">shipments exposed</div>
                  </div>
                  <div>
                    <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">03</div>
                    <div className="text-xs text-slate-400 mt-1 font-sans">orders affected</div>
                  </div>
                  <div>
                    <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">2,400</div>
                    <div className="text-xs text-slate-400 mt-1 font-sans">units in scope</div>
                  </div>
                </div>

                {/* Alternative Strategy Comparison Table Header */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase px-4 pb-2 border-b border-white/[0.04]">
                  <span>ALTERNATIVE</span>
                  <div className="flex items-center gap-12 sm:gap-16">
                    <span>ADDED DELAY</span>
                    <span className="w-20 text-right">ADDED SPEND</span>
                  </div>
                </div>

                {/* Strategy Rows */}
                <div className="space-y-3 pt-3">
                  {/* Alternative 1: Hold current route */}
                  <div 
                    onClick={() => setSelectedAlternative('hold')}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedAlternative === 'hold'
                        ? 'bg-[#0D2338] border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                        : 'bg-[#070D1B] border-white/[0.04] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white font-sans">Hold current route</div>
                        <div className="text-xs text-slate-400 mt-0.5">Wait for berth availability</div>
                      </div>
                      <div className="flex items-center gap-12 sm:gap-16 font-mono">
                        <span className="text-amber-400 font-bold text-sm">+{holdDelay}h</span>
                        <span className="text-white font-bold text-sm w-20 text-right">$0</span>
                      </div>
                    </div>
                    {/* Orange indicator bar */}
                    <div className="mt-2.5 h-[2px] w-28 bg-amber-400 rounded-full" />
                  </div>

                  {/* Alternative 2: Reroute via Antwerp (Active in Figma with dark teal background and left cyan accent) */}
                  <div 
                    onClick={() => setSelectedAlternative('antwerp')}
                    className={`p-4 rounded-xl border-y border-r border-l-4 transition-all cursor-pointer ${
                      selectedAlternative === 'antwerp'
                        ? 'bg-[#0E2638] border-y-cyan-500/30 border-r-cyan-500/30 border-l-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.2)]'
                        : 'bg-[#070D1B] border-white/[0.04] border-l-cyan-400/40 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white font-sans">
                          Reroute via Antwerp
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">Ocean + ground transfer</div>
                      </div>
                      <div className="flex items-center gap-12 sm:gap-16 font-mono">
                        <span className="text-cyan-400 font-bold text-sm">+{antwerpDelay}h</span>
                        <span className="text-white font-bold text-sm w-20 text-right">${antwerpCost.toLocaleString()}</span>
                      </div>
                    </div>
                    {/* Cyan indicator bar */}
                    <div className="mt-2.5 h-[2px] w-36 bg-cyan-400 rounded-full" />
                  </div>

                  {/* Alternative 3: Expedite priority units */}
                  <div 
                    onClick={() => setSelectedAlternative('expedite')}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedAlternative === 'expedite'
                        ? 'bg-[#0D2338] border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                        : 'bg-[#070D1B] border-white/[0.04] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white font-sans">Expedite priority units</div>
                        <div className="text-xs text-slate-400 mt-0.5">Partial air freight allocation</div>
                      </div>
                      <div className="flex items-center gap-12 sm:gap-16 font-mono">
                        <span className="text-cyan-400 font-bold text-sm">+{expediteDelay}h</span>
                        <span className="text-white font-bold text-sm w-20 text-right">${expediteCost.toLocaleString()}</span>
                      </div>
                    </div>
                    {/* Indicator bar */}
                    <div className="mt-2.5 h-[2px] w-20 bg-emerald-400 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Subtext Footnote from Figma */}
              <div className="pt-6 mt-6 border-t border-white/[0.08] text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                SAMPLE ASSUMPTIONS · LEAD TIME MODEL V2.4
              </div>
            </div>

            {/* Column 3: Decision Brief (Right - Fixed comfortable width) */}
            <div className="w-full lg:w-[320px] xl:w-[350px] shrink-0 p-6 lg:p-7 bg-[#070D1B] flex flex-col justify-between">
              <div>
                {/* Branch Icon matching Figma */}
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5">
                  <GitBranch className="w-4 h-4" />
                </div>

                <h3 className="text-2xl font-bold text-white font-display leading-tight mb-4">
                  A clear trade-off.<br />
                  A human decision.
                </h3>

                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6 font-sans">
                  {selectedAlternative === 'antwerp' && (
                    "The Antwerp option balances modeled delay and added spend. Review ground capacity and customs requirements before choosing a route."
                  )}
                  {selectedAlternative === 'hold' && (
                    "Holding current berth incurs zero additional cash spend, but accumulates a modeled delay of 72 hours with inventory risk on 3 production orders."
                  )}
                  {selectedAlternative === 'expedite' && (
                    "Expediting via air freight protects line-stoppage risk with minimum delay (+12h), requiring an additional budget commitment of $24,600."
                  )}
                </p>

                {/* Review Owner & Status (Divider line above) */}
                <div className="pt-5 border-t border-white/[0.08] mb-6">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                    REVIEW OWNER
                  </div>
                  <div className="text-sm font-semibold text-white font-sans mb-3">
                    Regional logistics planner
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#2A1D0E] border border-amber-500/30 text-amber-300 text-[11px] font-mono font-semibold uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    AWAITING REVIEW
                  </span>
                </div>
              </div>

              {/* Action Button: Create decision brief */}
              <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full pt-4 flex items-center gap-1.5 text-xs font-mono font-semibold uppercase text-cyan-400 hover:text-cyan-300 group tracking-wider transition-colors"
              >
                <span>Create decision brief</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Decision Brief Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#0B1224] border border-cyan-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.9)] relative"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-5 right-5 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-2 text-cyan-400 font-mono text-xs uppercase font-semibold">
                <FileText className="w-4 h-4" />
                EXECUTIVE DECISION BRIEF · SC-2026-NLRTM
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white font-display mb-4">
                Operational Reroute Proposal: Antwerp Secondary Berth
              </h3>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
                <p>
                  <strong>Context:</strong> Severe gantry queue at Rotterdam (NLRTM) increases median dwell time to +{dwellTime}h. 12 shipments and 3 purchase orders for Precision Drive Assembly are exposed.
                </p>
                <p>
                  <strong>Recommended Action:</strong> Divert vessel rotation to Antwerp terminal with dedicated bonded ground transfer to Western Europe assembly plants.
                </p>
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#060A14] border border-white/[0.06] font-mono text-xs">
                  <div>
                    <span className="text-slate-500 block">NET DELAY MITIGATION:</span>
                    <span className="text-emerald-400 font-bold text-sm">Save {dwellTime - antwerpDelay} hours</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">AUTHORIZED BUDGET:</span>
                    <span className="text-white font-bold text-sm">${antwerpCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/[0.06]">
                <div className="text-[11px] font-mono text-slate-500">
                  READY FOR STAKEHOLDER SIGN-OFF
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-white/10 text-xs font-mono uppercase text-slate-300 hover:text-white"
                  >
                    Close
                  </button>
                  <a 
                    href="/dashboard"
                    className="px-5 py-2 rounded-lg bg-cyan-400 text-slate-950 font-bold text-xs font-mono uppercase flex items-center gap-1.5 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                  >
                    <span>Approve & Push to Operations</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
