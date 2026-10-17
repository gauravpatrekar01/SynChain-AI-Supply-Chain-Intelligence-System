import React from 'react';
import { Link } from 'react-router-dom';
import { Layers, ShieldCheck, Activity, ArrowUpRight } from 'lucide-react';

export const FigmaFooter: React.FC = () => {
  return (
    <footer className="bg-[#050812] border-t border-cyan-500/10 text-slate-400 py-16 text-xs font-sans">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-16">
          
          {/* Brand & Description */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center p-0.5">
                <div className="w-full h-full bg-[#070C18] rounded-[6px] flex items-center justify-center">
                  <Layers className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <span className="font-extrabold text-lg tracking-tight text-white font-display">
                SynChain <span className="text-cyan-400 font-mono text-xs uppercase px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">AI</span>
              </span>
            </Link>
            <p className="text-slate-400 text-xs sm:text-sm max-w-sm leading-relaxed font-sans">
              Autonomous supply chain intelligence. Bridging multi-tier suppliers, multimodal shipments, and dynamic disruption simulation.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ALL SYSTEMS OPERATIONAL · 99.98% SLA
            </div>
          </div>

          {/* Solutions Column */}
          <div className="space-y-3 font-mono text-xs">
            <div className="text-white font-bold uppercase tracking-wider mb-2">Platform</div>
            <div><a href="#network" className="hover:text-cyan-400 transition-colors">01 Network Intelligence</a></div>
            <div><a href="#suppliers" className="hover:text-cyan-400 transition-colors">02 Supplier Diagnostics</a></div>
            <div><a href="#demand" className="hover:text-cyan-400 transition-colors">03 Demand Planning</a></div>
            <div><a href="#shipments" className="hover:text-cyan-400 transition-colors">04 Multimodal Visibility</a></div>
            <div><a href="#scenarios" className="hover:text-cyan-400 transition-colors">05 Disruption Lab</a></div>
            <div><a href="#architecture" className="hover:text-cyan-400 transition-colors">06 Architecture Graph</a></div>
          </div>

          {/* Navigation Column */}
          <div className="space-y-3 font-mono text-xs">
            <div className="text-white font-bold uppercase tracking-wider mb-2">Workspace</div>
            <div><Link to="/login" className="hover:text-cyan-400 transition-colors">Log In</Link></div>
            <div><Link to="/register" className="hover:text-cyan-400 transition-colors">Create Workspace</Link></div>
            <div><Link to="/dashboard" className="hover:text-cyan-400 transition-colors">Control Tower Dashboard</Link></div>
            <div><Link to="/forgot-password" className="hover:text-cyan-400 transition-colors">Password Recovery</Link></div>
            <div><Link to="/onboarding" className="hover:text-cyan-400 transition-colors">Workspace Setup</Link></div>
          </div>

          {/* Enterprise & Security */}
          <div className="space-y-3 font-mono text-xs">
            <div className="text-white font-bold uppercase tracking-wider mb-2">Compliance</div>
            <div className="text-slate-400">ISO 27001 Certified</div>
            <div className="text-slate-400">SOC 2 Type II Audited</div>
            <div className="text-slate-400">GDPR & CCPA Aligned</div>
            <div className="text-slate-400">End-to-End Encryption</div>
            <div className="text-slate-400">API Telemetry SLA</div>
          </div>

        </div>

        {/* Bottom Line */}
        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>
            © {new Date().getFullYear()} SynChain AI Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-slate-400 transition-colors">Terms of Service</a>
            <a href="#security" className="hover:text-slate-400 transition-colors">Security Overview</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
