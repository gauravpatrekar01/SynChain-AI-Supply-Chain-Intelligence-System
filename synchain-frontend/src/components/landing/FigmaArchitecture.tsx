import React from 'react';
import { motion } from 'framer-motion';
import { 
  Truck, Building2, GitCompare, ClipboardCheck, 
  Network, Cpu, ShieldCheck, ArrowRight, Layers, Sparkles 
} from 'lucide-react';

export const FigmaArchitecture: React.FC = () => {
  return (
    <section id="architecture" className="py-24 bg-[#060A15] border-b border-cyan-500/10 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10">
        
        {/* Section Header */}
        <div className="mb-16 text-center max-w-3xl mx-auto">
          <div className="text-cyan-400 font-mono text-xs uppercase tracking-widest mb-3 font-semibold flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            05 / SYSTEM ARCHITECTURE
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display leading-tight mb-4">
            One connected<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
              intelligence layer.
            </span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Synchronize enterprise operational silos into an active graph model designed for transparent, explainable decisions.
          </p>
        </div>

        {/* Central Architecture Flow Diagram (Direct match to Figma screenshot) */}
        <div className="relative mb-20 p-8 sm:p-12 rounded-2xl bg-[#090F20]/60 border border-cyan-500/20 backdrop-blur-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Inputs (Data Sources) */}
            <div className="lg:col-span-4 space-y-5">
              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-2">
                OPERATIONAL INPUTS
              </div>

              {/* Card 1: Shipments & milestones */}
              <div className="p-5 rounded-xl bg-[#0B1329] border border-cyan-500/20 shadow-lg relative group hover:border-cyan-400/50 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Truck className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white font-sans">
                    Shipments & milestones
                  </h4>
                </div>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Transport and warehouse events, AIS telemetry, and terminal arrivals.
                </p>
                {/* Connector dot */}
                <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
              </div>

              {/* Card 2: Suppliers & dependencies */}
              <div className="p-5 rounded-xl bg-[#0B1329] border border-cyan-500/20 shadow-lg relative group hover:border-cyan-400/50 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white font-sans">
                    Suppliers & dependencies
                  </h4>
                </div>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Procurement and supplier records, tier-N BOM dependencies, and quality logs.
                </p>
                {/* Connector dot */}
                <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
              </div>
            </div>

            {/* Center Core: SynChain Intelligence Hub */}
            <div className="lg:col-span-4 p-8 rounded-2xl bg-gradient-to-b from-[#0E1A38] to-[#0A1329] border border-cyan-400/60 shadow-[0_0_50px_rgba(6,182,212,0.25)] relative text-center">
              {/* Glowing Icon */}
              <div className="w-14 h-14 rounded-2xl bg-cyan-950/80 border border-cyan-400/60 flex items-center justify-center text-cyan-300 mx-auto mb-5 shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                <Network className="w-7 h-7" />
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-white font-display mb-3 tracking-tight">
                SynChain intelligence
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed mb-6">
                A shared model of entities, relationships, signals, and operating constraints.
              </p>

              {/* Pipeline Tags from Figma Screenshot */}
              <div className="inline-flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest text-cyan-300 bg-cyan-950/90 border border-cyan-500/40 px-3 py-1.5 rounded-full uppercase">
                <span>CONNECT</span>
                <span className="text-cyan-500/40">/</span>
                <span>CONTEXTUALIZE</span>
                <span className="text-cyan-500/40">/</span>
                <span>MODEL</span>
              </div>
            </div>

            {/* Right Outputs (Decision Systems) */}
            <div className="lg:col-span-4 space-y-5">
              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-2">
                EXECUTIVE OUTCOMES
              </div>

              {/* Card 1: Scenario & planning review */}
              <div className="p-5 rounded-xl bg-[#0B1329] border border-cyan-500/20 shadow-lg relative group hover:border-cyan-400/50 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <GitCompare className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white font-sans">
                    Scenario & planning review
                  </h4>
                </div>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Compare operational mitigation options with calibrated, shared assumptions.
                </p>
                {/* Connector dot */}
                <div className="hidden lg:block absolute -left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
              </div>

              {/* Card 2: Decision brief & follow-through */}
              <div className="p-5 rounded-xl bg-[#0B1329] border border-cyan-500/20 shadow-lg relative group hover:border-cyan-400/50 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white font-sans">
                    Decision brief & follow-through
                  </h4>
                </div>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Keep empirical evidence and designated stakeholder ownership together.
                </p>
                {/* Connector dot */}
                <div className="hidden lg:block absolute -left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
              </div>
            </div>

          </div>
        </div>

        {/* 3 Core Principles from Figma Bottom */}
        <div className="grid md:grid-cols-3 gap-8 pb-12 border-b border-white/[0.06]">
          <div>
            <h4 className="text-base font-bold text-white font-sans mb-2">
              Start with a focused use case
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
              Agree on the decisions and data that matter first, unlocking immediate operational resilience.
            </p>
          </div>

          <div>
            <h4 className="text-base font-bold text-white font-sans mb-2">
              Make the evidence accessible
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
              Keep source context, real-time assumptions, and predictive drivers visible to every operator.
            </p>
          </div>

          <div>
            <h4 className="text-base font-bold text-white font-sans mb-2">
              Keep people accountable
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
              Assign review and sign-off authority directly to your cross-functional operating team.
            </p>
          </div>
        </div>

        {/* Footnote Disclaimer from Figma Bottom */}
        <div className="pt-8 text-center text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          DATA SOURCES SHOWN ARE CATEGORIES, NOT CLAIMED PRODUCT INTEGRATIONS. CONNECTIVITY IS SCOPED DURING DISCOVERY.
        </div>

      </div>
    </section>
  );
};
