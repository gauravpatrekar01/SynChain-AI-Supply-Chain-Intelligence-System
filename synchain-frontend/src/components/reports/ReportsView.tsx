import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Share2,
  FileSpreadsheet,
} from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';

export const ReportsView: React.FC = () => {
  const { health, currentSimulationResult, risks } = useSupplyChain();
  const [reportType, setReportType] = useState<'executive' | 'risk_audit' | 'supplier_esg'>('executive');
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = () => {
    soundFX.playSuccess();
    setIsExporting(true);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });
    setTimeout(() => {
      setIsExporting(false);
      window.print();
    }, 800);
  };

  const handleExportCSV = () => {
    soundFX.playSuccess();
    // Generate simple mock CSV download
    const csvContent =
      'data:text/csv;charset=utf-8,Risk_ID,Title,Probability,Severity,Exposure_USD\n' +
      risks.map((r) => `"${r.id}","${r.title}",${r.probability},${r.severityScore},${r.financialImpactUsd}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SynChain_AI_Risk_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Executive AI Reports & Audit Export Center
            </h2>
            <NeonBadge variant="blue" size="sm">
              COMPLIANT
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Generate board-ready risk intelligence briefs, SEC supply chain disclosures, and ERP audit logs.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
            onClick={handleExportCSV}
          >
            Export CSV Dataset
          </Button>
          <Button
            variant="glow"
            size="sm"
            isLoading={isExporting}
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handleExportPDF}
          >
            Print / Save Executive PDF
          </Button>
        </div>
      </div>

      {/* Printable Executive Document Preview */}
      <div className="rounded-2xl glass-panel border border-white/10 p-8 space-y-6 bg-slate-950/60 print:bg-white print:text-black print:p-0">
        {/* Document Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10 print:border-black/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white font-display print:text-black">
                SynChain<span className="text-blue-400">AI</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono-telemetry print:text-black">
                CONFIDENTIAL
              </span>
            </div>
            <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
              Supply Chain Resilience & Black Swan Risk Assessment Briefing
            </p>
          </div>
          <div className="text-right text-xs font-mono-telemetry text-slate-400 print:text-slate-700">
            <p>Generated: {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
            <p>Audit Ref: SC-2026-X99</p>
          </div>
        </div>

        {/* Executive Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 print:border-black/10 print:bg-slate-50">
            <span className="text-[10px] text-slate-400 print:text-slate-600 uppercase font-bold">Health Score</span>
            <p className="text-xl font-bold text-emerald-400 print:text-emerald-700 font-mono-telemetry">{health.score}% Nominal</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 print:border-black/10 print:bg-slate-50">
            <span className="text-[10px] text-slate-400 print:text-slate-600 uppercase font-bold">Tier-1 Entities</span>
            <p className="text-xl font-bold text-white print:text-black font-mono-telemetry">248 Monitored</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 print:border-black/10 print:bg-slate-50">
            <span className="text-[10px] text-slate-400 print:text-slate-600 uppercase font-bold">Active Disruptions</span>
            <p className="text-xl font-bold text-amber-400 print:text-amber-700 font-mono-telemetry">{health.activeDisruptionsCount} Tracked</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 print:border-black/10 print:bg-slate-50">
            <span className="text-[10px] text-slate-400 print:text-slate-600 uppercase font-bold">Mitigated Value</span>
            <p className="text-xl font-bold text-cyan-300 print:text-cyan-700 font-mono-telemetry">$7.25M Saved</p>
          </div>
        </div>

        {/* Section 1: Executive Commentary */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white print:text-black font-display uppercase tracking-wider">
            1. Autonomous AI Operations Narrative
          </h3>
          <p className="text-xs text-slate-300 print:text-slate-800 leading-relaxed">
            During the trailing 30-day operating cycle, SynChain AI continuously evaluated multi-echelon network nodes across East Asia, North America, and Western Europe. With Category 4 Typhoon Gaemi causing severe berth congestion in the Taiwan Strait, autonomous decision workflows preemptively dual-sourced 65,000 wafer units to SK Hynix (Wuxi) and chartered dedicated air cargo freighters, preventing an estimated $4.8M in lost finished goods production.
          </p>
        </div>

        {/* Section 2: Critical Risk Register */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white print:text-black font-display uppercase tracking-wider">
            2. High Priority Risk Heatmap Register
          </h3>
          <table className="w-full text-left text-xs print:text-black">
            <thead className="border-b border-white/10 print:border-black/20 text-[10px] text-slate-400 font-mono-telemetry">
              <tr>
                <th className="py-2">Risk Description</th>
                <th className="py-2">Entity</th>
                <th className="py-2">Probability</th>
                <th className="py-2">Severity</th>
                <th className="py-2">Exposure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 print:divide-black/10">
              {risks.slice(0, 4).map((r) => (
                <tr key={r.id} className="py-2">
                  <td className="py-2.5 font-semibold text-white print:text-black">{r.title}</td>
                  <td className="py-2.5 text-slate-400 print:text-slate-600">{r.affectedEntity}</td>
                  <td className="py-2.5 font-mono">{r.probability}/5</td>
                  <td className="py-2.5 font-mono text-rose-400 print:text-rose-700">{r.severityScore}/5</td>
                  <td className="py-2.5 font-mono text-slate-200 print:text-black">${(r.financialImpactUsd / 1000000).toFixed(2)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
