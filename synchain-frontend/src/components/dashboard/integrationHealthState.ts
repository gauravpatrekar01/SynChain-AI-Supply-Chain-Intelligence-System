import type { AllIntegrationsHealthResponse } from '../../types';

/** A single-service check returns a partial snapshot; retain the other services. */
export function mergeIntegrationHealth(
  previous: AllIntegrationsHealthResponse | null,
  update: AllIntegrationsHealthResponse,
): AllIntegrationsHealthResponse {
  if (!previous) return update;

  const replacements = new Map(update.integrations.map((item) => [item.name.toLowerCase(), item]));
  const integrations = previous.integrations.map((item) => {
    const key = item.name.toLowerCase();
    const replacement = replacements.get(key);
    replacements.delete(key);
    return replacement ?? item;
  });
  integrations.push(...replacements.values());

  const configured = integrations.filter((item) => item.configuration_status === 'configured' && item.is_enabled);
  const healthy_count = configured.filter((item) => item.connection_status === 'healthy').length;
  const degraded_count = configured.filter((item) => item.connection_status === 'degraded').length;
  const unhealthy_count = configured.filter((item) => item.connection_status === 'unhealthy').length;
  const overall_status = unhealthy_count > 0 ? 'unhealthy'
    : degraded_count > 0 ? 'degraded'
    : configured.length === 0 || configured.every((item) => item.connection_status === 'unknown') ? 'unknown'
    : configured.some((item) => item.connection_status === 'unknown') ? 'degraded'
    : 'healthy';

  return {
    ...previous,
    integrations,
    overall_status,
    healthy_count,
    degraded_count,
    unhealthy_count,
    not_configured_count: integrations.filter((item) => item.configuration_status === 'not_configured').length,
    total_count: integrations.length,
    timestamp: update.timestamp,
  };
}
