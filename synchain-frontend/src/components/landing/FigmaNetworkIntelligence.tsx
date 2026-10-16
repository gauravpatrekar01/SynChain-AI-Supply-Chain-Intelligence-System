import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, AlertTriangle, ArrowRight, Layers, Filter, Clock, 
  MapPin, CheckCircle2, ChevronDown, ExternalLink, ShieldAlert, Sparkles
} from 'lucide-react';

export const FigmaNetworkIntelligence: React.FC = () => {
  const [selectedSignal, setSelectedSignal] = useState<'rotterdam' | 'demand' | 'singapore'>('rotterdam');
  const [selectedRegion, setSelectedRegion] = useState('All regions');
  const [selectedTransport, setSelectedTransport] = useState('All transport');
  const [selectedTimeframe, setSelectedTimeframe] = useState('Last 24 hours');

  return (
    <section id="network" className="py-24 bg-[#070C18] border-b border-cyan-500/10 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-blue-600/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="text-cyan-400 font-mono text-xs uppercase tracking-widest mb-3 font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              01 / CONTROL TOWER
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display leading-tight">
              Your entire network.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                One shared source of context.
              </span>
            </h2>
          </div>
          <p className="text-slate-400 max-w-md text-sm sm:text-base leading-relaxed">
            See suppliers, inventory, and shipments together. Follow an exception from its first signal to the orders and teams it affects.
          </p>
        </div>

        {/* Main Dashboard Frame (Direct recreation of Figma Screenshot) */}
        <div className="rounded-2xl border border-cyan-500/20 bg-[#0A101F] shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden">
          
          {/* Top Bar: Workspace & Telemetry */}
          <div className="px-6 py-4 border-b border-white/[0.06] bg-[#070C18]/90 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <div className="w-2.5 h-2.5 border border-cyan-400 rotate-45" />
              </div>
              <span className="text-xs font-mono text-slate-400">
                Workspace <span className="text-slate-600">/</span> <span className="text-white font-medium">Global operations</span>
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                SAMPLE WORKSPACE
              </span>
              <span className="text-slate-500 hidden sm:inline">16 OCT 2026 · 09:41 UTC</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">OP</span>
            </div>
          </div>

          {/* Secondary Sub-Bar: Headline + Interactive Filters */}
          <div className="px-6 py-5 border-b border-white/[0.04] bg-[#090E1D] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white font-display">Network intelligence</h3>
              <p className="text-xs text-slate-400 font-sans mt-0.5">A connected view of your operating network</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
              {/* Region Filter */}
              <div className="relative">
                <select 
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="bg-[#0E172B] hover:bg-[#121D36] text-slate-300 border border-white/10 rounded-lg px-3 py-1.5 appearance-none pr-8 cursor-pointer focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option>All regions</option>
                  <option>Asia-Pacific</option>
                  <option>North America</option>
                  <option>Western Europe</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Transport Filter */}
              <div className="relative">
                <select 
                  value={selectedTransport}
                  onChange={(e) => setSelectedTransport(e.target.value)}
                  className="bg-[#0E172B] hover:bg-[#121D36] text-slate-300 border border-white/10 rounded-lg px-3 py-1.5 appearance-none pr-8 cursor-pointer focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option>All transport</option>
                  <option>Ocean freight</option>
                  <option>Air express</option>
                  <option>Overland trucking</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Timeframe Filter */}
              <div className="relative">
                <select 
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  className="bg-[#0E172B] hover:bg-[#121D36] text-slate-300 border border-white/10 rounded-lg px-3 py-1.5 appearance-none pr-8 cursor-pointer focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option>Last 24 hours</option>
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 3 Metric Summary Cards Inside Dashboard (from Figma screenshot) */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-white/[0.04] bg-[#070C18]/60">
            {/* Metric 1 */}
            <div className="p-5 border-b md:border-b-0 md:border-r border-white/[0.04]">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Active shipments
              </div>
              <div className="text-3xl font-extrabold text-white font-mono">1,842</div>
              <div className="text-xs text-slate-500 mt-1">Across 38 trade lanes</div>
            </div>

            {/* Metric 2: Network Status (Amber highlight) */}
            <div className="p-5 border-b md:border-b-0 md:border-r border-white/[0.04] bg-amber-950/10">
              <div className="text-[11px] font-mono text-amber-400/80 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Network status</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              </div>
              <div className="text-3xl font-extrabold text-amber-400 font-mono">18 exceptions</div>
              <div className="text-xs text-amber-300/80 mt-1 font-medium">4 need an operational decision</div>
            </div>

            {/* Metric 3 */}
            <div className="p-5">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Supplier coverage
              </div>
              <div className="text-3xl font-extrabold text-white font-mono">248 suppliers</div>
              <div className="text-xs text-slate-500 mt-1">Tier 1 & mapped dependencies</div>
            </div>
          </div>

          {/* Interactive World Map & Priority Signals Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
            
            {/* World Vector Map Canvas */}
            <div className="lg:col-span-8 p-6 relative flex flex-col justify-between bg-[#060A14] border-b lg:border-b-0 lg:border-r border-white/[0.04] overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase font-semibold">
                  GLOBAL MOVEMENTS
                </span>
                <span className="text-[10px] font-mono text-cyan-400/80 uppercase">
                  ACTIVE NETWORK VIEW
                </span>
              </div>

              {/* SVG Vector World Map with Trade Corridors */}
              <div className="relative w-full aspect-[2/1] my-auto flex items-center justify-center">
                <svg viewBox="0 0 1000 500" className="w-full h-full">
                  <defs>
                    <radialGradient id="oceanGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#0a1936" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#060A14" stopOpacity="0" />
                    </radialGradient>
                    <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="amberGlow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Ocean backdrop glow */}
                  <rect width="1000" height="500" fill="url(#oceanGlow)" />

                  {/* Stylized Geometric Continents */}
                  <g fill="#0E1B33" stroke="#172A4F" strokeWidth="0.75" opacity="0.85">
                    {/* North America */}
                    <path d="M 140 90 L 260 70 L 320 110 L 290 190 L 240 240 L 190 280 L 170 210 L 110 160 Z" />
                    {/* South America */}
                    <path d="M 270 290 L 350 310 L 360 410 L 310 470 L 270 380 Z" />
                    {/* Europe */}
                    <path d="M 470 90 L 580 80 L 590 150 L 520 180 L 460 140 Z" />
                    {/* Africa */}
                    <path d="M 480 190 L 590 180 L 620 280 L 570 390 L 500 340 L 470 240 Z" />
                    {/* Asia */}
                    <path d="M 600 70 L 860 80 L 880 180 L 780 260 L 670 210 L 610 140 Z" />
                    {/* Australia */}
                    <path d="M 770 340 L 870 330 L 890 410 L 800 420 Z" />
                  </g>

                  {/* Dynamic Trade Route Arcs */}
                  {/* Shanghai -> Rotterdam (Ocean Route) */}
                  <path 
                    d="M 780 190 Q 640 100 515 135" 
                    fill="none" 
                    stroke={selectedSignal === 'rotterdam' ? '#F59E0B' : '#06B6D4'} 
                    strokeWidth={selectedSignal === 'rotterdam' ? '2.5' : '1.5'}
                    strokeDasharray={selectedSignal === 'rotterdam' ? '6 4' : 'none'}
                    filter="url(#cyanGlow)"
                    className="cursor-pointer transition-all"
                    onClick={() => setSelectedSignal('rotterdam')}
                  />
                  {/* Singapore -> Frankfurt (Air Route) */}
                  <path 
                    d="M 740 260 Q 620 190 510 125" 
                    fill="none" 
                    stroke="#06B6D4" 
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                  {/* Monterrey -> Austin (Ground Route) */}
                  <path 
                    d="M 215 225 L 225 205" 
                    fill="none" 
                    stroke="#06B6D4" 
                    strokeWidth="2"
                  />
                  {/* Trans-Pacific Route (Shanghai -> Los Angeles) */}
                  <path 
                    d="M 780 190 Q 920 160 990 170" 
                    fill="none" 
                    stroke="#06B6D4" 
                    strokeWidth="1"
                    opacity="0.5"
                  />
                  <path 
                    d="M 10 170 Q 90 180 180 185" 
                    fill="none" 
                    stroke="#06B6D4" 
                    strokeWidth="1"
                    opacity="0.5"
                  />

                  {/* Hub Pins & Callouts */}
                  {/* Shanghai (SHA) */}
                  <g transform="translate(780, 190)">
                    <circle r="4" fill="#06B6D4" />
                    <text x="8" y="4" fill="#94A3B8" fontSize="10" fontFamily="monospace">Shanghai</text>
                  </g>

                  {/* Rotterdam (RTM) - Active Exception Pin */}
                  <g transform="translate(515, 135)" className="cursor-pointer" onClick={() => setSelectedSignal('rotterdam')}>
                    <circle r="12" fill="#F59E0B" opacity="0.2" className="animate-ping" />
                    <circle r="6" fill="#F59E0B" filter="url(#amberGlow)" />
                    <circle r="2.5" fill="#FFFFFF" />
                    <text x="-60" y="-12" fill="#F59E0B" fontSize="11" fontFamily="monospace" fontWeight="bold">
                      Rotterdam (NLRTM)
                    </text>
                    <rect x="-65" y="-28" width="130" height="15" rx="3" fill="#1C1405" stroke="#F59E0B" strokeWidth="0.8" />
                    <text x="-60" y="-17" fill="#FDE68A" fontSize="8.5" fontFamily="monospace">
                      • Port congestion +18h
                    </text>
                  </g>

                  {/* Singapore (SIN) */}
                  <g transform="translate(740, 260)" className="cursor-pointer" onClick={() => setSelectedSignal('singapore')}>
                    <circle r="8" fill="#F59E0B" opacity="0.15" />
                    <circle r="4" fill="#F59E0B" />
                    <text x="-60" y="15" fill="#94A3B8" fontSize="10" fontFamily="monospace">Singapore</text>
                  </g>

                  {/* Frankfurt (FRA) */}
                  <g transform="translate(510, 125)">
                    <circle r="3.5" fill="#06B6D4" />
                    <text x="8" y="-4" fill="#94A3B8" fontSize="9" fontFamily="monospace">Frankfurt</text>
                  </g>

                  {/* Austin / Monterrey */}
                  <g transform="translate(225, 205)">
                    <circle r="3" fill="#06B6D4" />
                    <text x="6" y="3" fill="#94A3B8" fontSize="9" fontFamily="monospace">Austin</text>
                  </g>
                </svg>
              </div>

              {/* Map Legend (from Figma) */}
              <div className="flex items-center gap-6 pt-4 border-t border-white/[0.04] text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-[2px] bg-cyan-400"></div>
                  <span className="text-slate-400 uppercase">ACTIVE LANE</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-[2px] bg-amber-400"></div>
                  <span className="text-amber-300 uppercase">EXCEPTION</span>
                </div>
              </div>
            </div>

            {/* Right Priority Signals Stream (from Figma screenshot) */}
            <div className="lg:col-span-4 p-6 bg-[#080D1A] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.06]">
                  <span className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase">
                    Priority signals
                  </span>
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    04
                  </span>
                </div>

                {/* Signal Card 1: Rotterdam Logistics */}
                <div 
                  onClick={() => setSelectedSignal('rotterdam')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer mb-4 ${
                    selectedSignal === 'rotterdam'
                      ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
                      : 'bg-[#0B1224] border-white/[0.04] hover:border-amber-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                    <span className="text-amber-400 uppercase font-semibold">LOGISTICS</span>
                    <span className="text-slate-500">22m ago</span>
                  </div>
                  <h4 className="text-sm font-bold text-white font-sans mb-1">
                    Congestion at Rotterdam
                  </h4>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    Lead-time variability detected. 3 shipments affected. Upstream berth congestion extends average dwell by 18 hours.
                  </p>
                  <a 
                    href="#scenarios" 
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 group font-semibold"
                  >
                    Compare delivery history <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>

                {/* Signal Card 2: Demand Replenishment Review */}
                <div 
                  onClick={() => setSelectedSignal('demand')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedSignal === 'demand'
                      ? 'bg-cyan-950/20 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.12)]'
                      : 'bg-[#0B1224] border-white/[0.04] hover:border-cyan-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                    <span className="text-cyan-400 uppercase font-semibold">DEMAND</span>
                    <span className="text-slate-500">1h ago</span>
                  </div>
                  <h4 className="text-sm font-bold text-white font-sans mb-1">
                    Replenishment review
                  </h4>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    SKU PX-240 · Western Europe. Surge in monthly unit consumption pushes stock below safe buffer threshold.
                  </p>
                  <a 
                    href="#demand" 
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 group font-semibold"
                  >
                    View forecast drivers <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>

              {/* Sidebar Action Button */}
              <div className="pt-6 border-t border-white/[0.06]">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
                  DEMO DATA / ILLUSTRATIVE INTERFACE
                </div>
                <a 
                  href="#scenarios"
                  className="w-full py-2.5 px-4 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold uppercase flex items-center justify-between group transition-colors"
                >
                  <span>Select a signal to trace its impact</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* 3 Core Capability Bullets from Figma Screenshot */}
        <div className="grid md:grid-cols-3 gap-8 mt-12 pt-8 border-t border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2 mb-2 font-mono text-xs font-bold text-cyan-400">
              <span>01</span>
              <span className="text-slate-600">/</span>
              <span className="text-white text-sm font-sans font-bold">Trace the dependency</span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Connect a disrupted lane to its suppliers, SKUs, and open orders across all enterprise tiers.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 font-mono text-xs font-bold text-cyan-400">
              <span>02</span>
              <span className="text-slate-600">/</span>
              <span className="text-white text-sm font-sans font-bold">Put signals in context</span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Separate routine minor variation from critical exceptions worth investigating and escalating.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 font-mono text-xs font-bold text-cyan-400">
              <span>03</span>
              <span className="text-slate-600">/</span>
              <span className="text-white text-sm font-sans font-bold">Give every team the same view</span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Keep planning, procurement, and execution aligned around verified, shared operational evidence.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
