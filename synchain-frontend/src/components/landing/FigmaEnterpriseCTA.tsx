import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Zap, Server, Lock } from 'lucide-react';

export const FigmaEnterpriseCTA: React.FC = () => {
  return (
    <section className="py-24 bg-[#070C18] relative overflow-hidden">
      {/* Background neon ambient aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-cyan-500/15 via-blue-600/10 to-transparent blur-[120px] pointer-events-none" />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-10">
        <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-[#0C152B] to-[#070C18] p-10 sm:p-16 text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
          
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold uppercase tracking-wider mb-6">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              DEPLOY IN 14 DAYS OR LESS
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display leading-tight mb-6">
              Ready to synchronize<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                your supply chain?
              </span>
            </h2>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-10 max-w-2xl mx-auto font-sans">
              Connect your global logistics and procurement data into SynChain AI. Test simulations, detect bottleneck risks early, and coordinate decisions with clarity.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_30px_rgba(6,182,212,0.45)] hover:shadow-[0_0_40px_rgba(6,182,212,0.65)] flex items-center justify-center gap-2 font-mono"
              >
                <span>Launch Enterprise Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] border border-cyan-500/30 text-slate-200 font-mono text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:border-cyan-400/50"
              >
                Access Existing Account
              </Link>
            </div>

            {/* Enterprise Trust Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-white/[0.08] text-xs font-mono text-slate-400">
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>SOC2 TYPE II CERTIFIED</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>ENTERPRISE AES-256 VAULT</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>MULTI-REGION REDUNDANCY</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
