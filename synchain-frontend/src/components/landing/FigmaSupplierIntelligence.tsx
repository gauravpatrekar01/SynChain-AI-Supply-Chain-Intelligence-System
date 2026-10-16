import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, Network, ArrowUpRight, ChevronDown, 
  AlertCircle, CheckCircle2, Shield, Eye, Layers
} from 'lucide-react';

export const FigmaSupplierIntelligence: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'flagged'>('all');
  const [selectedSupplier, setSelectedSupplier] = useState('S-104');

  const suppliers = [
    {
      id: 'S-104',
      name: 'Supplier S-104',
      category: 'Precision Components',
      score: 62,
      change: -8,
      status: 'Review',
      statusColor: 'amber',
      leadTimeDetail: 'Lead-time variability increased over the last 30 days. Two open orders share a constrained upstream material.',
      deliveryConsistency: 42,
      qualityHistory: 88,
      dependencyExposure: 68
    },
    {
      id: 'S-202',
      name: 'Supplier S-202',
      category: 'Electronic assemblies',
      score: 87,
      change: +2,
      status: 'Stable',
      statusColor: 'emerald',
      leadTimeDetail: 'Consistent delivery performance across all contracted corridors. Buffer stocks maintained at +15% above target.',
      deliveryConsistency: 92,
      qualityHistory: 94,
      dependencyExposure: 24
    },
    {
      id: 'S-318',
      name: 'Supplier S-318',
      category: 'Industrial packaging',
      score: 91,
      change: +1,
      status: 'Stable',
      statusColor: 'emerald',
      leadTimeDetail: 'High reliability record over previous 8 quarters. Low multi-tier concentration risk.',
      deliveryConsistency: 96,
      qualityHistory: 90,
      dependencyExposure: 18
    },
    {
      id: 'S-412',
      name: 'Supplier S-412',
      category: 'Raw materials',
      score: 74,
      change: -3,
      status: 'Watch',
      statusColor: 'amber',
      leadTimeDetail: 'Slight upstream bottleneck identified at port of origin. Minor delay potential for upcoming Q1 deliveries.',
      deliveryConsistency: 71,
      qualityHistory: 82,
      dependencyExposure: 52
    }
  ];

  const currentSupplier = suppliers.find(s => s.id === selectedSupplier) || suppliers[0];

  const filteredSuppliers = filter === 'flagged' 
    ? suppliers.filter(s => s.status !== 'Stable')
    : suppliers;

  return (
    <section id="suppliers" className="py-24 bg-[#080D1B] border-b border-cyan-500/10 relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        
        {/* 2-Column Section Layout matching Figma */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: Heading and 2 Core Capabilities */}
          <div className="lg:col-span-5">
            <div className="text-cyan-400 font-mono text-xs uppercase tracking-widest mb-3 font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              02 / SUPPLIER & RISK INTELLIGENCE
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display leading-tight mb-6">
              Know the risk<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                behind the relationship.
              </span>
            </h2>

            <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-10">
              A supplier score is only useful if you can explain it. Bring delivery history, quality signals, and network dependencies into every review.
            </p>

            <div className="space-y-8 mb-10">
              {/* Feature 1 */}
              <div className="flex gap-4 items-start group">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white font-sans mb-1">
                    Understand what changed
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Inspect the evidence and drivers behind a reliability signal before it causes an operational stoppage.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex gap-4 items-start group">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white font-sans mb-1">
                    See beyond tier one
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Map known dependencies and identify single-source concentration exposure deeper in your chain.
                  </p>
                </div>
              </div>
            </div>

            <a 
              href="#suppliers" 
              className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-cyan-400 hover:text-cyan-300 group tracking-wider"
            >
              <span>Explore supplier intelligence</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </div>

          {/* Right Column: Interactive Diagnostic Table & Inspection Card */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Main Supplier Reliability Table Card */}
            <div className="rounded-2xl border border-cyan-500/20 bg-[#0B1224] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
              {/* Table Card Header */}
              <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-white/[0.06] gap-3">
                <div>
                  <h3 className="text-base font-bold text-white font-display">Supplier reliability</h3>
                  <div className="text-[10px] font-mono text-slate-500 uppercase">
                    SAMPLE DATA / Q4 2026
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Filter Pills */}
                  <div className="flex items-center p-0.5 rounded-lg bg-[#070C18] border border-white/[0.06] text-xs font-mono">
                    <button 
                      onClick={() => setFilter('all')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        filter === 'all' 
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All suppliers
                    </button>
                    <button 
                      onClick={() => setFilter('flagged')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        filter === 'flagged' 
                          ? 'bg-amber-500/20 text-amber-300 font-bold' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Flagged for review
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-[#070C18] border border-white/[0.06] px-2.5 py-1 rounded-lg">
                    <span>LAST 90 DAYS</span>
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-slate-500 border-b border-white/[0.04]">
                      <th className="pb-3 font-normal uppercase tracking-wider">SUPPLIER / CATEGORY</th>
                      <th className="pb-3 font-normal uppercase tracking-wider text-right">SCORE</th>
                      <th className="pb-3 font-normal uppercase tracking-wider text-right">CHANGE</th>
                      <th className="pb-3 font-normal uppercase tracking-wider text-right">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {filteredSuppliers.map((s) => (
                      <tr 
                        key={s.id}
                        onClick={() => setSelectedSupplier(s.id)}
                        className={`cursor-pointer transition-colors group ${
                          selectedSupplier === s.id 
                            ? 'bg-cyan-950/30' 
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="py-3.5">
                          <div className={`font-bold transition-colors ${
                            selectedSupplier === s.id ? 'text-cyan-400' : 'text-white group-hover:text-cyan-300'
                          }`}>
                            {s.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-sans">{s.category}</div>
                        </td>
                        <td className="py-3.5 text-right font-bold text-white text-sm">
                          {s.score}
                        </td>
                        <td className={`py-3.5 text-right font-semibold ${
                          s.change > 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {s.change > 0 ? `+${s.change}` : s.change}
                        </td>
                        <td className="py-3.5 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            s.statusColor === 'emerald'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${
                              s.statusColor === 'emerald' ? 'bg-emerald-400' : 'bg-amber-400'
                            }`} />
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Diagnostic Deep-Dive Subcard (Matching Figma S-104 Breakdown) */}
            <div className="rounded-2xl border border-cyan-500/20 bg-[#070D1A] p-6 shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
                <h4 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                  <span>Why {currentSupplier.id} needs a closer look</span>
                  {currentSupplier.statusColor === 'amber' && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </h4>
                <a 
                  href="#scenarios" 
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold group"
                >
                  View evidence <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-5 font-sans">
                {currentSupplier.leadTimeDetail}
              </p>

              {/* 3 Metric Progress Bars (Direct Recreation from Figma) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
                {/* Delivery consistency */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                    <span>Delivery consistency</span>
                    <span className="text-slate-300 font-bold">{currentSupplier.deliveryConsistency}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-400 rounded-full transition-all duration-500" 
                      style={{ width: `${currentSupplier.deliveryConsistency}%` }}
                    />
                  </div>
                </div>

                {/* Quality history */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                    <span>Quality history</span>
                    <span className="text-slate-300 font-bold">{currentSupplier.qualityHistory}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-400 rounded-full transition-all duration-500" 
                      style={{ width: `${currentSupplier.qualityHistory}%` }}
                    />
                  </div>
                </div>

                {/* Dependency exposure */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                    <span>Dependency exposure</span>
                    <span className="text-slate-300 font-bold">{currentSupplier.dependencyExposure}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-400 rounded-full transition-all duration-500" 
                      style={{ width: `${currentSupplier.dependencyExposure}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Subtext Footnote from Figma */}
              <div className="mt-5 pt-3 border-t border-white/[0.04] text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                * ILLUSTRATIVE COMPOSITE SCORE, 0–100. NOT A CREDIT RATING.
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
