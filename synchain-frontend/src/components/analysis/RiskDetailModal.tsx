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
          {/* Header Summary Banner */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Category:</span>
                <span className="text-white font-semibold">{risk.category}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Affected Entity: <span className="text-slate-200 font-medium">{risk.affected_entity_name}</span> ({risk.entity_identifier})
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-slate-400">Normalized Score</p>
                <p className="text-lg font-bold text-white font-mono">{risk.risk_score}<span className="text-xs text-slate-400">/100</span></p>
              </div>
              <NeonBadge variant={getRiskBadgeColor(risk.risk_level)} size="md">
                {risk.risk_level}
              </NeonBadge>
            </div>
          </div>

          {/* Section 1: Observed Facts */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-300 flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-cyan-400" />
              1. Observed Ground-Truth Facts
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
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

          {/* Section 2: Calculated Metrics */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-300 flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-400" />
              2. Calculated Quantitative Metrics
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(detail.calculated_metrics || {}).map(([key, value]) => (
                <div key={key} className="p-3 rounded-lg bg-slate-800/40 border border-white/5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block truncate">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-semibold text-white font-mono mt-0.5 block truncate">
                    {value !== null && value !== undefined ? String(value) : 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Potential Consequences */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-rose-300 flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              3. Potential Business Consequences (If Unmitigated)
            </h4>
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
              {detail.potential_consequences.map((consequence, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-rose-200">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>{consequence}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Recommended Actions */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-emerald-300 flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              4. Recommended Mitigation Strategy
            </h4>
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              {detail.suggested_actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-emerald-200">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{action}</span>
                </div>
              ))}
            </div>
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
