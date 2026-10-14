import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeIntegrationHealth } from '../src/components/dashboard/integrationHealthState.ts';

function item(name, connection_status, configuration_status = 'configured') {
  return { name, connection_status, configuration_status, is_enabled: true, category: 'erp', response_time_ms: 12 };
}

function snapshot(integrations, timestamp = '2026-10-15T01:00:00Z') {
  return {
    integrations, timestamp, total_count: integrations.length,
    overall_status: 'unhealthy', healthy_count: 0, degraded_count: 0,
    unhealthy_count: 1, not_configured_count: 1,
  };
}

test('single-service recovery preserves other cards and refreshes all summary fields', () => {
  const prior = snapshot([item('ERPNext', 'unhealthy'), item('Weather', 'unknown', 'not_configured')]);
  const update = snapshot([item('erpnext', 'healthy')], '2026-10-15T01:10:00Z');
  const result = mergeIntegrationHealth(prior, update);
  assert.equal(result.integrations.length, 2);
  assert.equal(result.integrations[1].name, 'Weather');
  assert.equal(result.overall_status, 'healthy');
  assert.equal(result.healthy_count, 1);
  assert.equal(result.unhealthy_count, 0);
  assert.equal(result.not_configured_count, 1);
  assert.equal(result.total_count, 2);
  assert.equal(result.timestamp, update.timestamp);
  assert.equal(prior.integrations[0].connection_status, 'unhealthy');
});

test('newly configured service updates configuration count and inserts newly discovered cards', () => {
  const prior = snapshot([item('Weather', 'unknown', 'not_configured')]);
  const result = mergeIntegrationHealth(prior, snapshot([item('Weather', 'healthy'), item('Database', 'degraded')]));
  assert.equal(result.not_configured_count, 0);
  assert.equal(result.total_count, 2);
  assert.equal(result.degraded_count, 1);
  assert.equal(result.overall_status, 'degraded');
});

test('unverified or unconfigured integrations do not claim a healthy overall status', () => {
  const prior = snapshot([item('Weather', 'unknown', 'not_configured')]);
  const result = mergeIntegrationHealth(prior, snapshot([item('ERPNext', 'unknown')]));
  assert.equal(result.overall_status, 'unknown');
  assert.equal(result.healthy_count, 0);
  const mixed = mergeIntegrationHealth(result, snapshot([item('Database', 'healthy')]));
  assert.equal(mixed.overall_status, 'degraded');
});

test('the first response is preserved when no earlier snapshot exists', () => {
  const update = snapshot([item('ERPNext', 'healthy')]);
  assert.equal(mergeIntegrationHealth(null, update), update);
});

test('stale statuses from disabled or unconfigured services do not affect current health counts', () => {
  const prior = snapshot([
    { ...item('Disabled ERP', 'unhealthy'), is_enabled: false },
    { ...item('Disabled DB', 'healthy'), is_enabled: false },
    item('Unconfigured API', 'degraded', 'not_configured'),
    item('Unconfigured Weather', 'healthy', 'not_configured'),
  ]);
  const result = mergeIntegrationHealth(prior, snapshot([item('Active ERP', 'healthy')]));
  assert.equal(result.healthy_count, 1);
  assert.equal(result.degraded_count, 0);
  assert.equal(result.unhealthy_count, 0);
  assert.equal(result.not_configured_count, 2);
  assert.equal(result.total_count, 5);
  assert.equal(result.overall_status, 'healthy');
});
