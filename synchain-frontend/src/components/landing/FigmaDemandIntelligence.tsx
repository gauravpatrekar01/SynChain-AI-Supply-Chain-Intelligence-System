import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sliders, TrendingUp, ArrowUpRight, BarChart3, 
  Calendar, Layers, Sparkles, AlertCircle 
} from 'lucide-react';

export const FigmaDemandIntelligence: React.FC = () => {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const dataPoints = [
    { month: 'JUL', value: 1920, type: 'historical', range: null },
    { month: 'AUG', value: 1740, type: 'historical', range: null },
    { month: 'AUG 15', value: 2210, type: 'historical', range: null },
    { month: 'SEP', value: 2050, type: 'historical', range: null },
    { month: 'SEP 15', value: 2420, type: 'historical', range: null },
    { month: 'OCT', value: 2480, type: 'transition', range: [2300, 2600] },
    { month: 'NOV', value: 2680, type: 'forecast', range: [2240, 2760] },
    { month: 'DEC', value: 2820, type: 'forecast', range: [2180, 2820] },
  ];

  return (
    <section id="demand" className="py-24 bg-[#070C18] border-b border-cyan-500/10 relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        
        {/* 2-Column Section Layout matching Figma */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Demand Outlook Interactive Card */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-cyan-500/20 bg-[#0A101F] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
              
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-white/[0.06] gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Demand outlook
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    SAMPLE DATA / SKU PX-240
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  12-WEEK HORIZON
                </div>
              </div>

              {/* Product Title & Metrics Grid */}
              <div className="mb-6">
                <h3 className="text-xl font-extrabold text-white font-display">
                  Precision drive assembly
                </h3>
                <div className="text-[11px] font-mono text-slate-500 uppercase mt-0.5">
                  WESTERN EUROPE · MONTHLY UNITS
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 p-4 rounded-xl bg-[#060A14] border border-white/[0.04]">
                  <div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      Next period demand
                    </div>
                    <div className="text-2xl font-bold text-white font-mono mt-0.5">
                      2,480
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      Planning range
                    </div>
                    <div className="text-2xl font-bold text-cyan-300 font-mono mt-0.5">
                      2,180–2,820
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      Suggested review
                    </div>
                    <div className="text-sm font-bold text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
                      Replenishment
                    </div>
                    <div className="text-[10px] text-slate-500">2 open purchase orders</div>
                  </div>
                </div>
              </div>

              {/* SVG Spline Forecast Chart (Matching Figma Screenshot) */}
              <div className="relative w-full aspect-[2.2/1] bg-[#070D1B] rounded-xl border border-white/[0.04] p-4 flex flex-col justify-between">
                
                {/* SVG Graphics */}
                <div className="relative w-full h-full">
                  <svg viewBox="0 0 600 240" className="w-full h-full overflow-visible">
                    <defs>
                      {/* Gradient for Planning Range Confidence Envelope */}
                      <linearGradient id="forecastEnvelope" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.25" />
                      </linearGradient>
                      <linearGradient id="cyanLineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#38BDF8" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                    </defs>

                    {/* Y-Axis Horizontal Grid Lines */}
                    <g stroke="#1E293B" strokeWidth="0.8" strokeDasharray="3 3">
                      <line x1="40" y1="30" x2="580" y2="30" />
                      <line x1="40" y1="80" x2="580" y2="80" />
                      <line x1="40" y1="130" x2="580" y2="130" />
                      <line x1="40" y1="180" x2="580" y2="180" />
                    </g>

                    {/* Y-Axis Labels */}
                    <g fill="#64748B" fontSize="10" fontFamily="monospace" textAnchor="end">
                      <text x="35" y="34">3.5k</text>
                      <text x="35" y="84">2.5k</text>
                      <text x="35" y="134">2.0k</text>
                      <text x="35" y="184">1.5k</text>
                    </g>

                    {/* Forecast Shaded Uncertainty Envelope (from OCT x=350 to DEC x=560) */}
                    <polygon 
                      points="350,110  450,75  560,50  560,170  450,140  350,110" 
                      fill="url(#forecastEnvelope)" 
                    />

                    {/* Forecast Separation Vertical Line */}
                    <line x1="350" y1="15" x2="350" y2="195" stroke="#38BDF8" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
                    <text x="358" y="25" fill="#38BDF8" fontSize="9" fontFamily="monospace" fontWeight="bold">
                      FORECAST →
                    </text>

                    {/* Historical Actuals Spline (White / Grey curve) */}
                    <path 
                      d="M 50,165 Q 90,140 120,150 T 190,115 T 260,140 T 310,95 T 350,110" 
                      fill="none" 
                      stroke="#E2E8F0" 
                      strokeWidth="2" 
                    />

                    {/* Forecast Projection Spline (Glowing Cyan curve) */}
                    <path 
                      d="M 350,110 Q 400,125 450,90 T 510,105 T 560,75" 
                      fill="none" 
                      stroke="url(#cyanLineGlow)" 
                      strokeWidth="2.5" 
                    />

                    {/* Data Points on Curves */}
                    <circle cx="50" cy="165" r="3.5" fill="#E2E8F0" />
                    <circle cx="120" cy="150" r="3.5" fill="#E2E8F0" />
                    <circle cx="190" cy="115" r="3.5" fill="#E2E8F0" />
                    <circle cx="260" cy="140" r="3.5" fill="#E2E8F0" />
                    <circle cx="310" cy="95" r="3.5" fill="#E2E8F0" />
                    {/* Oct Junction Point */}
                    <circle cx="350" cy="110" r="5" fill="#070C18" stroke="#38BDF8" strokeWidth="2" />
                    <circle cx="450" cy="90" r="4" fill="#06B6D4" />
                    <circle cx="560" cy="75" r="4.5" fill="#38BDF8" />

                    {/* X-Axis Month Labels */}
                    <g fill="#94A3B8" fontSize="10" fontFamily="monospace" textAnchor="middle">
                      <text x="50" y="215">JUL</text>
                      <text x="190" y="215">AUG</text>
                      <text x="310" y="215">SEP</text>
                      <text x="350" y="215" fill="#38BDF8" fontWeight="bold">OCT</text>
                      <text x="450" y="215">NOV</text>
                      <text x="560" y="215">DEC</text>
                    </g>
                  </svg>
                </div>

                {/* Chart Legend (from Figma) */}
                <div className="flex items-center gap-6 pt-3 border-t border-white/[0.04] text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-[2px] bg-slate-300"></div>
                    <span className="text-slate-400">Historical demand</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-[2px] bg-cyan-400"></div>
                    <span className="text-cyan-300">Forecast</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-2.5 bg-cyan-500/20 border border-cyan-500/40 rounded-sm"></div>
                    <span className="text-slate-400">Planning range</span>
                  </div>
                </div>

              </div>

              {/* Bottom Driver Banner from Figma Screenshot */}
              <div className="mt-5 p-3.5 rounded-xl bg-[#060A14] border border-white/[0.04] flex items-center gap-3 text-xs text-slate-400">
                <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="leading-relaxed">
                  Primary drivers: recent order patterns, seasonality, and open order book. Range reflects modeled uncertainty, not a guarantee.
                </span>
              </div>

            </div>
          </div>

          {/* Right Column: Heading and Planner Feature */}
          <div className="lg:col-span-5">
            <div className="text-cyan-400 font-mono text-xs uppercase tracking-widest mb-3 font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              03 / DEMAND INTELLIGENCE
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display leading-tight mb-6">
              Plan for demand.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                Not for surprises.
              </span>
            </h2>

            <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-10">
              Bring demand signals and inventory decisions into the same conversation. Understand the forecast, its uncertainty, and what it means for your next order.
            </p>

            <div className="p-6 rounded-2xl bg-[#0A101F] border border-cyan-500/20 mb-8 group hover:border-cyan-500/40 transition-colors">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white font-sans mb-1.5">
                    Keep planners in control
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Review the drivers, adjust assumptions, and compare your plan before committing purchase orders into production.
                  </p>
                </div>
              </div>
            </div>

            <a 
              href="#demand" 
              className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase text-cyan-400 hover:text-cyan-300 group tracking-wider"
            >
              <span>Explore demand planning</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </div>

        </div>

      </div>
    </section>
  );
};
