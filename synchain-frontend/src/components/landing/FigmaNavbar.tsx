import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ArrowRight, Menu, X, ShieldCheck, Activity } from 'lucide-react';

export const FigmaNavbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-[#070C18]/90 backdrop-blur-xl border-b border-cyan-500/10 shadow-[0_4px_30px_rgba(0,0,0,0.8)]' 
          : 'bg-transparent border-b border-white/[0.04]'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center p-0.5 shadow-[0_0_20px_rgba(6,182,212,0.35)] group-hover:shadow-[0_0_28px_rgba(6,182,212,0.6)] transition-all">
            <div className="w-full h-full bg-[#070C18] rounded-[7px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5 font-display">
              SynChain <span className="text-cyan-400 font-mono text-sm uppercase px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">AI</span>
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-8 text-xs font-mono tracking-wider text-slate-300 uppercase">
          <a href="#network" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
            <span className="text-cyan-500/50">01</span> Network
          </a>
          <a href="#suppliers" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
            <span className="text-cyan-500/50">02</span> Suppliers
          </a>
          <a href="#demand" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
            <span className="text-cyan-500/50">03</span> Demand
          </a>
          <a href="#shipments" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
            <span className="text-cyan-500/50">04</span> Shipments
          </a>
          <a href="#scenarios" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
            <span className="text-cyan-500/50">05</span> Scenario Lab
          </a>
          <a href="#architecture" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
            <span className="text-cyan-500/50">06</span> Architecture
          </a>
        </div>

        {/* Right CTA Actions */}
        <div className="hidden md:flex items-center gap-5">
          <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono text-emerald-400/90 bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            SYS OPERATIONAL
          </div>
          
          <Link 
            to="/login" 
            className="text-xs font-mono text-slate-300 hover:text-white transition-colors uppercase tracking-wider px-3 py-2"
          >
            Login
          </Link>

          <Link 
            to="/register" 
            className="relative group overflow-hidden px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-[0_0_25px_rgba(6,182,212,0.3)] hover:shadow-[0_0_35px_rgba(6,182,212,0.5)]"
          >
            <span>Launch Platform</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-slate-300 hover:text-white focus:outline-none"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#070C18]/98 border-b border-cyan-500/20 px-6 py-6 space-y-4 backdrop-blur-2xl">
          <div className="flex flex-col space-y-3 font-mono text-xs uppercase tracking-wider text-slate-300">
            <a 
              href="#network" 
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 hover:text-cyan-400 border-b border-white/5"
            >
              01 Network Intelligence
            </a>
            <a 
              href="#suppliers" 
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 hover:text-cyan-400 border-b border-white/5"
            >
              02 Supplier Risk
            </a>
            <a 
              href="#demand" 
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 hover:text-cyan-400 border-b border-white/5"
            >
              03 Demand Outlook
            </a>
            <a 
              href="#shipments" 
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 hover:text-cyan-400 border-b border-white/5"
            >
              04 Shipment Visibility
            </a>
            <a 
              href="#scenarios" 
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 hover:text-cyan-400 border-b border-white/5"
            >
              05 Scenario Lab
            </a>
            <a 
              href="#architecture" 
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 hover:text-cyan-400"
            >
              06 System Architecture
            </a>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <Link 
              to="/login"
              className="w-full text-center py-2.5 rounded-lg border border-white/10 text-white font-mono text-xs uppercase"
            >
              Login
            </Link>
            <Link 
              to="/register"
              className="w-full text-center py-2.5 rounded-lg bg-cyan-500 text-slate-950 font-bold font-mono text-xs uppercase shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            >
              Launch Platform
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};
