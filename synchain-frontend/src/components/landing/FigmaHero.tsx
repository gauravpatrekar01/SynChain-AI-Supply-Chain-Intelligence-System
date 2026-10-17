import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, AlertTriangle, ShieldCheck, 
  Layers, Clock, Compass, TrendingUp, Sparkles, Database, Network, Cpu, CheckCircle2
} from 'lucide-react';

interface FigmaHeroProps {
  onSelectStep?: (stepIndex: number) => void;
}

export const FigmaHero: React.FC<FigmaHeroProps> = ({ onSelectStep }) => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { num: '01', label: 'CONNECT YOUR DATA', desc: 'ERP, WMS, IoT sensors, and supplier APIs unified into one live graph.' },
    { num: '02', label: 'UNDERSTAND THE RISK', desc: 'Autonomous discovery of lead-time variability, port jams, and multi-tier single points of failure.' },
    { num: '03', label: 'MODEL WHAT’S NEXT', desc: 'Monte Carlo simulation of alternative corridors, dwell times, and freight modes.' },
    { num: '04', label: 'ACT WITH CONTEXT', desc: 'Collaborative decision briefs with pre-calculated trade-offs between speed and cost.' },
  ];

  const handleStepClick = (idx: number) => {
    setActiveStep(idx);
    if (onSelectStep) {
      onSelectStep(idx);
    }
  };

  return (
    <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-24 overflow-hidden bg-[#070C18] border-b border-cyan-500/10">
      {/* Background Ambience & Grid Lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-cyan-500/10 via-blue-600/5 to-transparent blur-[140px]" />
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
        {/* Subtle horizontal baseline guides */}
        <div className="absolute top-1/3 left-0 right-0 h-px bg-cyan-500/[0.04]" />
        <div className="absolute top-2/3 left-0 right-0 h-px bg-cyan-500/[0.04]" />
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10">
        {/* Hero Top Grid: Headline on Left, Interactive Card on Right */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center mb-16 lg:mb-24">
          
          {/* Left Column: Big Bold Typography */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Tech Eyebrow */}
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase font-semibold">
                AI-POWERED SUPPLY CHAIN INTELLIGENCE
              </span>
            </motion.div>

            {/* Massive All-Caps Headline from Figma */}
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-6xl xl:text-7xl font-extrabold tracking-tight text-white leading-[1.04] mb-6 font-display uppercase"
            >
              INTELLIGENCE THAT<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                KEEPS YOUR
              </span><br />
              SUPPLY CHAIN<br />
              <span className="relative inline-block text-white">
                AHEAD.
                <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-60"></span>
              </span>
            </motion.h1>

            {/* Sub-Brand Headline from Figma */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-8"
            >
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-300 flex items-center gap-3 font-display">
                <span className="text-cyan-400">SynChain AI</span>
                <span className="text-sm font-mono font-normal text-slate-500 px-2 py-0.5 rounded border border-slate-700/60 bg-slate-900/60">
                  DECISION ENGINE V2.4
                </span>
              </h2>
              <p className="mt-3 text-base sm:text-lg text-slate-400 max-w-xl font-sans leading-relaxed">
                Connect suppliers, shipments, and inventory into one operational picture. Model disruption scenarios before they occur and guide decisive executive action.
              </p>
            </motion.div>

            {/* Action Buttons */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4"
            >
              <Link 
                to="/register" 
                className="px-6 py-3.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_35px_rgba(6,182,212,0.55)] flex items-center gap-2"
              >
                Start Exploring Free <ArrowRight className="w-4 h-4" />
              </Link>
              <a 
                href="#network" 
                className="px-6 py-3.5 rounded-lg bg-[#0F172A]/80 hover:bg-[#1E293B] border border-cyan-500/20 text-slate-200 font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-2 hover:border-cyan-400/50"
              >
                View Live Demo Canvas
              </a>
            </motion.div>
          </div>

          {/* Right Column: Hero Visual Card with Container Port & Live Telemetry Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5 relative"
          >
            {/* Ambient Card Frame */}
            <div className="relative rounded-2xl overflow-hidden border border-cyan-500/20 bg-[#0B1222] shadow-[0_20px_50px_rgba(0,0,0,0.8)] group">
              {/* Container Port Photograph Background */}
              <div className="relative h-72 sm:h-80 w-full overflow-hidden">
                <img 
                  src="/images/ocean_port.jpg" 
                  alt="Deep Sea Container Terminal at Night" 
                  className="w-full h-full object-cover object-center filter brightness-90 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1222] via-[#0B1222]/50 to-transparent" />
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-[#070C18]/80 backdrop-blur-md border border-cyan-500/30 text-[10px] font-mono text-cyan-300 font-semibold uppercase">
                    CORRIDOR INTEL
                  </span>
                </div>
              </div>

              {/* Floating Glass Shipment Telemetry Card (Direct Match to Figma) */}
              <div className="p-6 pt-0 -mt-16 relative z-10">
                <div className="rounded-xl bg-[#070C18]/90 backdrop-blur-xl border border-cyan-500/30 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-cyan-400" />
                      SHIPMENT INTELLIGENCE
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                      DEMO
                    </span>
                  </div>

                  {/* Port Code Display */}
                  <div className="flex items-center justify-between my-3">
                    <div>
                      <div className="text-3xl font-extrabold text-white font-mono tracking-tight">SHA</div>
                      <div className="text-xs text-slate-400 font-sans">Shanghai</div>
                    </div>

                    {/* Animated Route Flow Arrow */}
                    <div className="flex-1 px-4 flex flex-col items-center">
                      <div className="relative w-full flex items-center">
                        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500/30 via-cyan-400 to-cyan-500/30"></div>
                        <motion.div 
                          animate={{ x: [0, 80, 0] }}
                          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                          className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#38bdf8]"
                        />
                        <div className="absolute right-0 w-0 h-0 border-y-4 border-y-transparent border-l-[8px] border-l-cyan-400"></div>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-400/80 mt-1.5 uppercase tracking-wider">
                        TRANS-PACIFIC / ROTTERDAM
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-extrabold text-white font-mono tracking-tight">RTM</div>
                      <div className="text-xs text-slate-400 font-sans">Rotterdam</div>
                    </div>
                  </div>

                  {/* Alert Highlight Banner */}
                  <div className="mt-4 p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-center justify-between text-xs font-mono text-amber-300">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                      <span>Port congestion · ETA +18h</span>
                    </div>
                    <span className="text-[10px] text-amber-400/70 uppercase">BERTH HOLD</span>
                  </div>

                  {/* Footnote */}
                  <div className="mt-3 text-[10px] font-mono text-slate-500 text-center tracking-wider uppercase">
                    ILLUSTRATIVE SCENARIO / NOT LIVE TRACKING
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 4-Step Process Strip from Figma */}
        <div className="border-t border-cyan-500/10 pt-8 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {steps.map((st, i) => (
              <div 
                key={i}
                onClick={() => handleStepClick(i)}
                className={`group cursor-pointer rounded-xl p-4 transition-all border ${
                  activeStep === i 
                    ? 'bg-cyan-950/30 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)]' 
                    : 'bg-[#0B1120]/40 border-white/[0.04] hover:border-cyan-500/20 hover:bg-[#0B1120]'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`font-mono text-xs font-bold transition-colors ${
                    activeStep === i ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'
                  }`}>
                    {st.num}
                  </span>
                  <span className="text-slate-600 font-mono text-xs">/</span>
                  <span className={`font-mono text-xs tracking-wider font-semibold transition-colors ${
                    activeStep === i ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    {st.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {st.desc}
                </p>
                <div className={`mt-3 h-[2px] w-full rounded-full transition-all ${
                  activeStep === i ? 'bg-cyan-400 shadow-[0_0_8px_#38bdf8]' : 'bg-slate-800 group-hover:bg-slate-700'
                }`} />
              </div>
            ))}
          </div>
        </div>

        {/* 4 Top KPI Metrics Strip (from Figma artboard overview) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 pt-4">
          <div className="p-5 rounded-xl bg-[#0A101D] border border-white/[0.05] relative overflow-hidden">
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight mb-1">
              248
            </div>
            <div className="text-xs font-semibold text-slate-300 font-sans">
              Suppliers Monitored
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Tier 1 & mapped dependencies
            </div>
            <div className="absolute top-3 right-3 text-cyan-400/20">
              <Database className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#0A101D] border border-white/[0.05] relative overflow-hidden">
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight mb-1">
              1,842
            </div>
            <div className="text-xs font-semibold text-slate-300 font-sans">
              Active Shipments
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Across 38 global trade lanes
            </div>
            <div className="absolute top-3 right-3 text-cyan-400/20">
              <Network className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#0A101D] border border-amber-500/20 relative overflow-hidden bg-gradient-to-br from-[#0A101D] to-amber-950/20">
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-mono tracking-tight mb-1 flex items-baseline gap-2">
              18
              <span className="text-xs font-mono text-amber-400/80 uppercase font-semibold">Exceptions</span>
            </div>
            <div className="text-xs font-semibold text-slate-300 font-sans">
              Network Status
            </div>
            <div className="text-[11px] font-mono text-amber-400/80 mt-1">
              4 need an operational decision
            </div>
            <div className="absolute top-3 right-3 text-amber-400/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#0A101D] border border-white/[0.05] relative overflow-hidden">
            <div className="text-3xl sm:text-4xl font-extrabold text-cyan-400 font-mono tracking-tight mb-1">
              04
            </div>
            <div className="text-xs font-semibold text-slate-300 font-sans">
              Decisions Pending
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Cross-functional trade-off briefs
            </div>
            <div className="absolute top-3 right-3 text-cyan-400/20">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
