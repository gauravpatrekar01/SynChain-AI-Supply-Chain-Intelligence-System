import React, { useCallback } from 'react';
import { FigmaNavbar } from './FigmaNavbar';
import { FigmaHero } from './FigmaHero';
import { FigmaNetworkIntelligence } from './FigmaNetworkIntelligence';
import { FigmaSupplierIntelligence } from './FigmaSupplierIntelligence';
import { FigmaDemandIntelligence } from './FigmaDemandIntelligence';
import { FigmaShipmentVisibility } from './FigmaShipmentVisibility';
import { FigmaScenarioLab } from './FigmaScenarioLab';
import { FigmaArchitecture } from './FigmaArchitecture';
import { FigmaEnterpriseCTA } from './FigmaEnterpriseCTA';
import { FigmaFooter } from './FigmaFooter';

export const LandingPage: React.FC = () => {
  const handleSelectStep = useCallback((stepIndex: number) => {
    const sectionIds = ['network', 'suppliers', 'scenarios', 'scenarios'];
    const targetId = sectionIds[stepIndex] || 'network';
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#070C18] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      {/* Top Fixed High-Tech Navbar */}
      <FigmaNavbar />

      {/* Main Page Flow Matching Figma Canvas */}
      <main>
        {/* Hero Section with Headline, Live Corridor Tracker, 4 Steps & 4 Metrics */}
        <FigmaHero onSelectStep={handleSelectStep} />

        {/* 01 / Control Tower & Network Intelligence Dashboard */}
        <FigmaNetworkIntelligence />

        {/* 02 / Supplier & Risk Intelligence Diagnostics */}
        <FigmaSupplierIntelligence />

        {/* 03 / Demand Intelligence & Forecast Planning Spline */}
        <FigmaDemandIntelligence />

        {/* 04 / Shipment Intelligence: Multimodal Ocean, Air, Ground Cards */}
        <FigmaShipmentVisibility />

        {/* Scenario Lab: Port Disruption Simulator & Trade-Off Matrix */}
        <FigmaScenarioLab />

        {/* 05 / System Architecture: Shared Intelligence Hub & Core Pillars */}
        <FigmaArchitecture />

        {/* Enterprise Call to Action */}
        <FigmaEnterpriseCTA />
      </main>

      {/* Comprehensive Enterprise Footer */}
      <FigmaFooter />
    </div>
  );
};

export default LandingPage;
