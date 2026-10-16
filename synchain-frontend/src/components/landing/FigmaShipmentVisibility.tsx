import React from 'react';
import { motion } from 'framer-motion';
import { 
  Anchor, Plane, Truck, ArrowUpRight, 
  Clock, Package, AlertTriangle, CheckCircle2, ChevronRight 
} from 'lucide-react';

import oceanPortImg from '../../assets/images/ocean_port.jpg';
import airCargoImg from '../../assets/images/air_cargo.jpg';
import groundTruckImg from '../../assets/images/ground_truck.jpg';

export const FigmaShipmentVisibility: React.FC = () => {
  const shipments = [
    {
      id: 'SC-08421',
      mode: 'OCEAN',
      modeIcon: <Anchor className="w-3.5 h-3.5" />,
      origin: 'SHANGHAI',
      destination: 'Rotterdam',
      image: oceanPortImg,
      status: 'Arrival at risk',
      statusColor: 'amber',
      progress: 62,
      eta: '19 Oct · 14:00 UTC',
      cargo: '24 TEU · Industrial components',
    },
    {
      id: 'SC-09107',
      mode: 'AIR',
      modeIcon: <Plane className="w-3.5 h-3.5" />,
      origin: 'SINGAPORE',
      destination: 'Frankfurt',
      image: airCargoImg,
      status: 'On schedule',
      statusColor: 'emerald',
      progress: 40,
      eta: '17 Oct · 06:45 UTC',
      cargo: '8 pallets · Electronic assemblies',
    },
    {
      id: 'SC-07263',
      mode: 'GROUND',
      modeIcon: <Truck className="w-3.5 h-3.5" />,
      origin: 'MONTERREY',
      destination: 'Austin',
      image: groundTruckImg,
      status: 'In transit',
      statusColor: 'cyan',
      progress: 25,
      eta: '17 Oct · 18:20 UTC',
      cargo: '1 FTL · Production materials',
    },
  ];

  return (
    <section id="shipments" className="py-24 bg-[#080D1A] border-b border-cyan-500/10 relative overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        
        {/* Section Header */}
        <div className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="text-cyan-400 font-mono text-xs uppercase tracking-widest mb-3 font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              04 / SHIPMENT INTELLIGENCE
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display leading-tight">
              Every movement.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                A single operational view.
              </span>
            </h2>
          </div>
          <p className="text-slate-400 max-w-md text-sm sm:text-base leading-relaxed">
            Follow critical containers and manifests through ocean berths, air freight hubs, and overland corridors with automated milestone predictions.
          </p>
        </div>

        {/* 3 Shipment Mode Cards (Direct match to Figma screenshot) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-10">
          {shipments.map((ship, idx) => (
            <motion.div
              key={ship.id}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-cyan-500/20 bg-[#0A1020] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] group flex flex-col justify-between"
            >
              {/* Photo Background & Header Overlay */}
              <div className="relative h-48 w-full overflow-hidden">
                <img 
                  src={ship.image} 
                  alt={ship.destination} 
                  className="w-full h-full object-cover object-center filter brightness-85 group-hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1020] via-[#0A1020]/40 to-black/60" />

                {/* Top Badge & ID */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs font-mono">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#070C18]/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300 font-bold uppercase tracking-wider text-[11px]">
                    {ship.modeIcon}
                    {ship.mode}
                  </span>
                  <span className="text-slate-300 font-mono text-[11px] bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded border border-white/10">
                    {ship.id}
                  </span>
                </div>

                {/* Route Headline at Bottom of Photo */}
                <div className="absolute bottom-3 left-5 right-5">
                  <div className="text-[11px] font-mono text-cyan-400/90 tracking-wider flex items-center gap-1 uppercase">
                    <span>{ship.origin}</span>
                    <span className="text-cyan-500">→</span>
                  </div>
                  <div className="text-2xl font-extrabold text-white font-sans tracking-tight">
                    {ship.destination}
                  </div>
                </div>
              </div>

              {/* Card Body & Live Status */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                
                {/* Status Alert Badge */}
                <div className="flex items-center justify-between mb-5">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                    ship.statusColor === 'amber'
                      ? 'bg-amber-950/70 border border-amber-500/40 text-amber-300'
                      : ship.statusColor === 'emerald'
                      ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                      : 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      ship.statusColor === 'amber' ? 'bg-amber-400 animate-ping' :
                      ship.statusColor === 'emerald' ? 'bg-emerald-400' : 'bg-cyan-400'
                    }`} />
                    {ship.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    DEMO SHIPMENT
                  </span>
                </div>

                {/* Milestone Progress Bar */}
                <div className="mb-5">
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full rounded-full ${
                        ship.statusColor === 'amber' ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' :
                        ship.statusColor === 'emerald' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 
                        'bg-cyan-400 shadow-[0_0_8px_#38bdf8]'
                      }`}
                      style={{ width: `${ship.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase">
                    <span className="text-slate-400">Departed</span>
                    <span className={ship.progress > 30 ? 'text-cyan-400 font-bold' : ''}>In transit</span>
                    <span>Arriving</span>
                  </div>
                </div>

                {/* ETA & Cargo Summary */}
                <div className="pt-4 border-t border-white/[0.04] space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Estimated arrival</span>
                    <span className="text-white font-bold">{ship.eta}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-sans text-slate-400 pt-1">
                    <span className="text-[11px] font-mono text-slate-400">{ship.cargo}</span>
                    <ArrowUpRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>

              </div>
            </motion.div>
          ))}
        </div>

        {/* Section Bottom Strip (from Figma screenshot) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/[0.06] text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-500 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            ILLUSTRATIVE ROUTES, CARGO & ARRIVAL ESTIMATES
          </div>
          <a 
            href="#shipments" 
            className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 group uppercase tracking-wider"
          >
            Explore shipment visibility <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </div>

      </div>
    </section>
  );
};
