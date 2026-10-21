import React from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  TrendingDown,
  Info,
  Layers,
  ArrowRight,
  Activity,
  FileText,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { RiskDetailResponse, RiskLevel } from '../../types/analysis';

interface RiskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: RiskDetailResponse | null;
  isLoading: boolean;
}

export const RiskDetailModal: React.FC<RiskDetailModalProps> = ({
  isOpen,
  onClose,
  detail,
  isLoading,
}) => {
  if (!isOpen) return null;

  const getRiskBadgeColor = (level: RiskLevel): 'critical' | 'high' | 'medium' | 'low' => {
    switch (level) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
      default:
        return 'low';
    }
  };

  const risk = detail?.risk;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={risk ? `Risk Evidence: ${risk.risk_id} — ${risk.affected_entity_name}` : 'Risk Calculation Details'}
      size="xl"
    >
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading ground-truth risk calculation and evidence...</p>
        </div>
      ) : !risk ? (
        <div className="py-12 text-center text-slate-400">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p>No detailed calculation data available for this risk finding.</p>
        </div>
      ) : (
        <div className="space-y-6 text-sm">
          {/* Section 1: What is happening? */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                1. What is happening?
              </h4>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                Operational Status
              </span>
            </div>
            <div className="text-slate-200 text-xs sm:text-sm leading-relaxed">
              <p className="font-semibold text-white">
                {risk.affected_entity_name} <span className="text-slate-400 font-normal">({risk.entity_identifier})</span>
              </p>
              <p className="text-slate-300 mt-1">
                Category: <strong className="text-white">{risk.category}</strong> • Entity Type: <strong className="text-white">{risk.affected_entity_type}</strong>
              </p>
            </div>
          </div>

          {/* Section 2: Why was this risk identified? */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                2. Why was this risk identified?
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-300">
                  Risk Score: {risk.risk_score}/100
                </span>
                <NeonBadge variant={getRiskBadgeColor(risk.risk_level)} size="sm">
                  {risk.risk_level} SEVERITY
                </NeonBadge>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {risk.risk_score >= 80
                ? 'Critical risk rating: Multiple operational buffers have failed or high-probability delivery disruptions will directly halt assembly lines.'
                : risk.risk_score >= 60
                ? 'High risk rating: The metric threshold exceeds tolerance and requires active mitigation to avoid order delays.'
                : risk.risk_score >= 30
                ? 'Moderate risk rating: Minor variance from operational SLA, monitor buffer progression.'
                : 'Low risk rating: Within acceptable operating limits.'}
            </p>
            {risk.primary_risk_factors && risk.primary_risk_factors.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Primary Trigger Factors:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {risk.primary_risk_factors.map((factor, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs"
                    >
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: What could be affected? */}
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-wider font-bold text-rose-300 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                3. What could be affected?
              </h4>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Business & Downstream Impact
              </span>
            </div>
            {risk.potential_business_impact && (
              <p className="text-xs sm:text-sm font-medium text-rose-200">
                {risk.potential_business_impact}
              </p>
            )}
            {detail.potential_consequences && detail.potential_consequences.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {detail.potential_consequences.map((consequence, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-rose-200/90">
                    <span className="text-rose-400 font-bold">•</span>
                    <span>{consequence}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: What evidence supports the assessment? */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                4. What evidence supports the assessment?
              </h4>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
                Facts & Quantitative Metrics
              </span>
            </div>

            {/* Observed Facts */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Observed Facts (Ground Truth)
              </span>
              <div className="p-3 rounded-lg bg-slate-800/50 border border-white/5 space-y-2">
                {detail.observed_facts && detail.observed_facts.length > 0 ? (
                  detail.observed_facts.map((fact, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                      <span>{fact}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No historical observations linked.</p>
                )}
              </div>
            </div>

            {/* Calculated Metrics */}
            {detail.calculated_metrics && Object.keys(detail.calculated_metrics).length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Calculated Risk Indicators
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.entries(detail.calculated_metrics).map(([key, value]) => (
                    <div key={key} className="p-2.5 rounded-lg bg-slate-800/40 border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 block truncate">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-semibold text-white font-mono mt-0.5 block truncate">
                        {value !== null && value !== undefined ? String(value) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Model Predictions (if available) */}
            {detail.model_predictions && Object.keys(detail.model_predictions).length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Model Predictions (Estimated)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.entries(detail.model_predictions).map(([key, value]) => (
                    <div key={key} className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <span className="text-[10px] uppercase tracking-wider text-purple-300 block truncate">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-semibold text-white font-mono mt-0.5 block truncate">
                        {value !== null && value !== undefined ? String(value) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: What action is recommended? */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-wider font-bold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                5. What action is recommended?
              </h4>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Actionable Next Steps
              </span>
            </div>
            {risk.recommended_action && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs sm:text-sm font-medium text-emerald-100">
                {risk.recommended_action}
              </div>
            )}
            {detail.suggested_actions && detail.suggested_actions.length > 0 && (
              <div className="space-y-2">
                {detail.suggested_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-emerald-200">
                    <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close Risk Inspection
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
