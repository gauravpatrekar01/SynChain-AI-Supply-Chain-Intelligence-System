import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyHealth, healthFromOverview, healthStatusLabel } from '../src/services/healthScore.ts';

const overview = { overallHealthScore: 85.5, healthDataStatus: 'available', healthComponents: [], healthExplanation: 'Observed data', lastUpdated: '2026-10-15T10:00:00Z', activeDisruptions: 2 };

test('overall health follows successive backend results, including a real zero', () => {
  assert.equal(healthFromOverview(overview, 51).score, 85.5);
  const changed = healthFromOverview({ ...overview, overallHealthScore: 35 }, 52);
  assert.equal(changed.score, 35);
  assert.equal(changed.status, 'critical');
  assert.equal(healthFromOverview({ ...overview, overallHealthScore: 0 }, 12).score, 0);
});

test('initial, missing and invalid data never becomes a demo health score', () => {
  assert.equal(emptyHealth.score, null);
  for (const value of [null, undefined, NaN, '92']) {
    assert.equal(healthFromOverview({ ...overview, overallHealthScore: value }, 2).score, null);
  }
  assert.equal(healthFromOverview({ ...overview, healthDataStatus: 'insufficient_data' }, 2).score, null);
});

test('health status and boundaries reflect the observed score', () => {
  assert.equal(healthFromOverview({ ...overview, overallHealthScore: 105 }, 2).score, 100);
  assert.equal(healthStatusLabel(healthFromOverview({ ...overview, overallHealthScore: 70 }, 2)), 'Needs attention');
  assert.equal(healthStatusLabel({ ...emptyHealth, dataStatus: 'unavailable' }), 'Unavailable');
  assert.equal(healthStatusLabel({ ...emptyHealth, score: 81, dataStatus: 'unavailable' }), 'Last known');
});
