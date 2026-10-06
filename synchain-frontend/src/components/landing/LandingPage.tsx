import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, ValidationError } from '@formspree/react';
import { 
  ArrowRight, Activity, AlertTriangle, Bell, Box, Brain, 
  Check, CheckCircle2, ChevronRight, Globe, 
  Layers, LineChart, Link as LinkIcon, Lock, 
  Map, MessageSquare, Network, PieChart, 
  Search, Shield, Target, Truck, Zap 
} from 'lucide-react';
import { HolographicEarth } from './HolographicEarth';

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0F19]/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">SynChain AI</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#product" className="hover:text-white transition-colors">Product</a>
          <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
          <a href="#documentation" className="hover:text-white transition-colors">Documentation</a>
          <a href="#contact" className="hover:text-white transition-colors">Contact</a>
        </div>
        
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link to="/login" className="text-slate-300 hover:text-white transition-colors">
            Login
          </Link>
          <Link 
            to="/register" 
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
};

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" /> AI predictive supply chain intelligence
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6 text-white">
            Intelligence for a <span className="text-blue-500">Smarter</span> Supply Chain.
          </h1>
          <p className="text-lg text-slate-400 mb-8 leading-relaxed">
            SynChain AI blends business intelligence with AI to detect risks, identify opportunities, and uncover insights buried across your global operations network.
          </p>
          <div className="flex items-center gap-4">
            <Link 
              to="/register" 
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
            >
              Start for free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              to="/login" 
              className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 transition-all"
            >
              Login
            </Link>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative"
        >
          <div className="aspect-[4/3] relative flex items-center justify-center pointer-events-none">
            <HolographicEarth />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const TrustedBy = () => {
  return (
    <div className="border-y border-white/5 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="text-xs font-semibold tracking-wider text-slate-500 whitespace-nowrap">TRUSTED BY INDUSTRY LEADERS</div>
        <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="flex items-center gap-2 font-bold text-lg"><Layers className="w-5 h-5"/> DataCorp</div>
          <div className="flex items-center gap-2 font-bold text-lg"><Globe className="w-5 h-5"/> GlobalTech</div>
          <div className="flex items-center gap-2 font-bold text-lg"><Box className="w-5 h-5"/> LogisX</div>
          <div className="flex items-center gap-2 font-bold text-lg"><Network className="w-5 h-5"/> NexusSupply</div>
        </div>
      </div>
    </div>
  );
};

const About = () => {
  return (
    <section id="product" className="py-24">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16">
        <div>
          <div className="text-blue-500 text-sm font-semibold tracking-wider mb-4 uppercase">About</div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Built to Make Supply Chains Smarter</h2>
        </div>
        <div>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            SynChain AI uses advanced machine learning and real-time data ingestion to predict disruptions, optimize routes, and provide intelligent alerts before delays impact your bottom line.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="px-4 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-slate-300 font-medium">Predictive Analytics</div>
            <div className="px-4 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-slate-300 font-medium">Digital Twin Simulation</div>
            <div className="px-4 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-slate-300 font-medium">Automated Alerts</div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Features = () => {
  const features = [
    {
      icon: <LineChart className="w-5 h-5 text-blue-400" />,
      title: "Supply chain network analytics",
      desc: "Gain deep visibility into material flows, inventory levels, and logistics costs across your global network."
    },
    {
      icon: <Bell className="w-5 h-5 text-purple-400" />,
      title: "Intelligent notifications",
      desc: "Receive actionable alerts when weather, political unrest, or supplier delays threaten your operations."
    },
    {
      icon: <Target className="w-5 h-5 text-emerald-400" />,
      title: "Disruption prediction",
      desc: "AI models constantly evaluate signals to foresee supplier failures and port congestions weeks in advance."
    },
    {
      icon: <Brain className="w-5 h-5 text-rose-400" />,
      title: "Scenario modeling",
      desc: "Test different supply chain configurations and stress-test them against simulated disruptions to build resilience."
    },
    {
      icon: <LinkIcon className="w-5 h-5 text-amber-400" />,
      title: "Always on connections",
      desc: "Connect securely with ERP systems, IoT trackers, and data providers through our pre-built integrations."
    }
  ];

  return (
    <section className="py-24 bg-[#0F1423]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <div className="text-blue-500 text-sm font-semibold tracking-wider mb-4 uppercase">Features</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white max-w-lg">Complex operations.<br/>Clear intelligence.</h2>
          </div>
          <p className="text-slate-400 max-w-md">
            From raw data signals to actionable insights, SynChain handles the complexity so you can focus on making the right move.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {features.slice(0, 3).map((f, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -5 }}
              className="bg-[#111827] border border-white/10 p-8 rounded-2xl hover:border-blue-500/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
              <p className="text-slate-400 mb-6 flex-1 text-sm leading-relaxed">{f.desc}</p>
              <a href="#" className="text-blue-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                Explore feature <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {features.slice(3, 5).map((f, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -5 }}
              className="bg-[#111827] border border-white/10 p-8 rounded-2xl hover:border-blue-500/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
              <p className="text-slate-400 mb-6 flex-1 text-sm leading-relaxed">{f.desc}</p>
              <a href="#" className="text-blue-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                Explore feature <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  return (
    <section id="solutions" className="py-24">
      <div className="max-w-5xl mx-auto px-6 text-center mb-16">
        <div className="text-blue-500 text-sm font-semibold tracking-wider mb-4 uppercase">How it works</div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">From data to decisions, in three steps.</h2>
        <p className="text-slate-400">A simple, yet powerful workflow to untangle supply chain complexity.</p>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="relative">
          {/* Connector Line */}
          <div className="absolute top-6 left-12 right-12 h-[1px] bg-white/10 hidden md:block" />
          
          <div className="grid md:grid-cols-3 gap-12 relative z-10">
            {[
              { num: "01", icon: <Layers />, title: "Bring your data together", desc: "Connect external APIs, internal databases, and supplier portals into one unified source of truth." },
              { num: "02", icon: <Brain />, title: "Let AI connect the signals", desc: "Our engine processes millions of data points to model your network and identify unseen risks." },
              { num: "03", icon: <Target />, title: "Make your next move", desc: "Receive automated recommendations to reroute shipments, buffer inventory, or find alternative suppliers." }
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="w-12 h-12 rounded-full bg-[#111827] border-2 border-[#0B0F19] text-blue-500 flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                  {step.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-3 text-center md:text-left">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed text-center md:text-left">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-4">
          <div className="bg-[#111827] p-6 rounded-xl border border-white/5">
            <div className="text-xs text-blue-400 font-semibold mb-2 uppercase">Step 1</div>
            <div className="text-sm text-white">Integration layer</div>
          </div>
          <div className="bg-[#111827] p-6 rounded-xl border border-blue-500/20 shadow-[0_0_20px_rgba(37,99,235,0.05)] relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/5" />
            <div className="relative z-10">
              <div className="text-xs text-blue-400 font-semibold mb-2 uppercase">Step 2</div>
              <div className="text-sm text-white">Analysis & Prediction</div>
            </div>
          </div>
          <div className="bg-[#111827] p-6 rounded-xl border border-white/5">
            <div className="text-xs text-blue-400 font-semibold mb-2 uppercase">Step 3</div>
            <div className="text-sm text-white">Actionable Next Steps</div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Benefit = () => {
  return (
    <section className="py-24 bg-[#0F1423]">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-2xl opacity-50 rounded-full" />
          <div className="relative bg-[#0B0F19] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2 bg-[#111827]">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Global Incident Monitor</div>
                  <div className="text-sm font-medium text-white">High-Severity Alerts: Southeast Asia</div>
                </div>
                <div className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">Action Req</div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#111827] border border-white/5 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white mb-1">21</div>
                  <div className="text-xs text-slate-400">Delayed Shipments</div>
                </div>
                <div className="bg-[#111827] border border-white/5 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white mb-1">$4.2M</div>
                  <div className="text-xs text-slate-400">Value at Risk</div>
                </div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="text-xs font-semibold text-blue-400 mb-2">AI RECOMMENDATION</div>
                <div className="text-sm text-white">Reroute shipments via alternative carrier to avoid expected port strike. ETA impact reduced by 4 days.</div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 bg-white text-slate-900 p-6 rounded-2xl shadow-xl max-w-xs">
            <div className="text-lg font-bold mb-1">A wider perspective.</div>
            <div className="text-slate-600 text-sm">A more informed next move.</div>
          </div>
        </motion.div>
        
        <div>
          <div className="text-blue-500 text-sm font-semibold tracking-wider mb-4 uppercase">The Advantage</div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">Less uncertainty.<br/>More perspective.</h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            Move past static spreadsheets to a dynamic, real-time picture of your global network. Answer complex questions in seconds.
          </p>
          
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="mt-1"><CheckCircle2 className="w-5 h-5 text-blue-500" /></div>
              <div>
                <h4 className="text-white font-semibold mb-1">End-to-end visibility</h4>
                <p className="text-sm text-slate-400">See everything from raw materials to last-mile delivery.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="mt-1"><CheckCircle2 className="w-5 h-5 text-blue-500" /></div>
              <div>
                <h4 className="text-white font-semibold mb-1">Proactive issue resolution</h4>
                <p className="text-sm text-slate-400">Solve problems before they manifest into delays or extra costs.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="mt-1"><CheckCircle2 className="w-5 h-5 text-blue-500" /></div>
              <div>
                <h4 className="text-white font-semibold mb-1">Integrated decision making</h4>
                <p className="text-sm text-slate-400">Connect teams with a single, un-siloed ground truth.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Capabilities = () => {
  return (
    <section className="py-24 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="text-blue-500 text-sm font-semibold tracking-wider mb-4 uppercase">Capabilities</div>
          <h2 className="text-3xl md:text-4xl font-bold text-white">One network. Shared understanding.</h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-3 text-white font-bold text-xl mb-4">
              <Globe className="w-6 h-6 text-blue-400" /> Scope & comprehensive
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Expand your visibility to include multi-tier suppliers and complex global distribution networks.
            </p>
            <a href="#" className="text-blue-400 text-sm hover:underline">Learn more</a>
          </div>
          <div>
            <div className="flex items-center gap-3 text-white font-bold text-xl mb-4">
              <Truck className="w-6 h-6 text-emerald-400" /> Logistics & operations
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Optimize transportation costs, monitor shipment delays, and improve on-time delivery rates.
            </p>
            <a href="#" className="text-blue-400 text-sm hover:underline">Learn more</a>
          </div>
          <div>
            <div className="flex items-center gap-3 text-white font-bold text-xl mb-4">
              <Box className="w-6 h-6 text-purple-400" /> Procurement & sourcing
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Identify supplier concentration risks and find alternatives fast during disruptions.
            </p>
            <a href="#" className="text-blue-400 text-sm hover:underline">Learn more</a>
          </div>
        </div>
      </div>
    </section>
  );
};

const Contact = () => {
  const [state, handleSubmit] = useForm("xaeqnebw");

  return (
    <section id="contact" className="py-24 bg-[#0F1423]">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16">
        <div>
          <div className="text-blue-500 text-sm font-semibold tracking-wider mb-4 uppercase">Contact</div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Let's talk about your supply chain.</h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Have a question about our capabilities? Want to see how SynChain AI can fit into your technical stack? Our team is ready to help.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Check className="w-4 h-4 text-blue-500" /> Schedule a personalized demo
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Check className="w-4 h-4 text-blue-500" /> Discuss integrations and security
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Check className="w-4 h-4 text-blue-500" /> Get pricing and sizing details
            </div>
          </div>
        </div>
        
        <div className="bg-[#111827] border border-white/10 rounded-2xl p-8 shadow-xl">
          {state.succeeded ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-2">
                <Check className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-white">Message Received</h3>
              <p className="text-slate-400">Thank you for reaching out. Our team will get back to you shortly.</p>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-xs font-medium text-slate-300 uppercase tracking-wider">Name</label>
                  <input id="name" name="name" type="text" required className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Your name" />
                  <ValidationError prefix="Name" field="name" errors={state.errors} className="text-xs text-red-400" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-xs font-medium text-slate-300 uppercase tracking-wider">Work Email</label>
                  <input id="email" name="email" type="email" required className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="you@company.com" />
                  <ValidationError prefix="Email" field="email" errors={state.errors} className="text-xs text-red-400" />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="company" className="text-xs font-medium text-slate-300 uppercase tracking-wider">Company</label>
                <input id="company" name="company" type="text" className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Your company" />
                <ValidationError prefix="Company" field="company" errors={state.errors} className="text-xs text-red-400" />
              </div>
              <div className="space-y-2">
                <label htmlFor="message" className="text-xs font-medium text-slate-300 uppercase tracking-wider">How can we help?</label>
                <textarea id="message" name="message" rows={4} required className="w-full bg-[#0B0F19] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none" placeholder="Tell us about your goals and current challenges..." />
                <ValidationError prefix="Message" field="message" errors={state.errors} className="text-xs text-red-400" />
              </div>
              <div className="flex items-center justify-between pt-4">
                <div className="text-xs text-slate-500 max-w-[200px]">By submitting, you agree to our Privacy Policy.</div>
                <button type="submit" disabled={state.submitting} className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] disabled:opacity-50 disabled:cursor-not-allowed">
                  {state.submitting ? 'Sending...' : 'Send message'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

const CTA = () => {
  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-gradient-to-r from-[#111827] to-[#1a2333] border border-white/10 rounded-3xl p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]" />
          <div className="relative z-10">
            <div className="text-blue-400 text-sm font-semibold tracking-wider mb-4 uppercase">Start Now</div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Build a smarter supply chain.</h2>
            <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
              Join leading global enterprises in making supply chain disruptions a thing of the past. Start your free trial today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                to="/register" 
                className="w-full sm:w-auto px-8 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center justify-center gap-2"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="text-sm text-slate-500">No credit card required. 14-day free trial.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-[#0B0F19] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-16">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-white">SynChain AI</span>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-medium text-slate-400">
            <a href="#product" className="hover:text-white transition-colors">Product</a>
            <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
            <a href="#documentation" className="hover:text-white transition-colors">Documentation</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
            <Link to="/login" className="hover:text-white transition-colors">Login</Link>
            <Link to="/register" className="text-blue-400 hover:text-blue-300 transition-colors">Get Started</Link>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div>© {new Date().getFullYear()} SynChain AI. All rights reserved.</div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-300 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <TrustedBy />
        <About />
        <Features />
        <HowItWorks />
        <Benefit />
        <Capabilities />
        <Contact />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};
