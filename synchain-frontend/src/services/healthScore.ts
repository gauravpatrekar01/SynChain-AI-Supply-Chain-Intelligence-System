import type { AIHealthScore, DashboardOverviewData } from '../types';

export const emptyHealth: AIHealthScore = {
  score: null, status: 'nominal', resilienceRating: 'Not scored', lastUpdated: '',
  activeDisruptionsCount: 0, predictedRiskEventsCount: 0, mitigationReadinessPct: 0,
  latencyMs: 0, dataStatus: 'insufficient_data', components: [],
  explanation: 'Add supply chain data or check configured integrations to calculate overall health.',
};

export function healthFromOverview(overview: DashboardOverviewData, latencyMs: number): AIHealthScore {
  const value = overview.overallHealthScore;
  const score = overview.healthDataStatus === 'available' && typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value)) : null;
  return {
    ...emptyHealth, score,
    status: score == null ? 'nominal' : score >= 80 ? 'optimal' : score >= 60 ? 'warning' : 'critical',
    resilienceRating: score == null ? 'Not scored' : score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F',
    lastUpdated: overview.lastUpdated,
    activeDisruptionsCount: overview.activeDisruptions,
    latencyMs: Math.round(latencyMs),
    dataStatus: score == null ? 'insufficient_data' : 'available',
    components: overview.healthComponents ?? [],
    explanation: overview.healthExplanation || emptyHealth.explanation,
  };
}

export function healthStatusLabel(health: AIHealthScore): string {
  if (health.dataStatus === 'unavailable') return health.score == null ? 'Unavailable' : 'Last known';
  if (health.score == null) return 'Not scored';
  return health.status === 'optimal' ? 'Healthy' : health.status === 'warning' ? 'Needs attention' : 'At risk';
}
