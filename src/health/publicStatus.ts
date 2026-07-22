/**
 * Coarse public status mapping. This module intentionally accepts booleans and
 * coarse provider states only: raw errors, identifiers, counts, quotas and text
 * never cross this boundary.
 */

export type PublicStatusState = 'operational' | 'degraded' | 'unavailable';
export type PublicStatusComponent = 'bot' | 'database' | 'providers';

export interface PublicStatusInput {
  botReady: boolean;
  databaseReady: boolean;
  providerStates: readonly ('healthy' | 'degraded')[];
  incidentMessage?: string;
}

export interface PublicStatusResponse {
  status: PublicStatusState;
  components: Record<PublicStatusComponent, PublicStatusState>;
  incident?: string;
}

const INCIDENT_MAX_CHARS = 240;

function componentState(ready: boolean): PublicStatusState {
  return ready ? 'operational' : 'unavailable';
}

function providerState(states: readonly ('healthy' | 'degraded')[]): PublicStatusState {
  // No observed provider health is deliberately not treated as proof of availability.
  if (states.length === 0) return 'unavailable';
  return states.some((state) => state === 'degraded') ? 'degraded' : 'operational';
}

/** Sanitises an operator-supplied incident to a short single-line public notice. */
export function sanitisePublicIncident(value: string | undefined): string | undefined {
  const incident = value
    ?.replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!incident) return undefined;
  return incident.slice(0, INCIDENT_MAX_CHARS);
}

/** Maps health checks to a stable, minimal schema and fails closed on missing health. */
export function mapPublicStatus(input: PublicStatusInput): PublicStatusResponse {
  const components = {
    bot: componentState(input.botReady),
    database: componentState(input.databaseReady),
    providers: providerState(input.providerStates),
  } as const;
  const values = Object.values(components);
  const status: PublicStatusState = values.includes('unavailable')
    ? 'unavailable'
    : values.includes('degraded')
      ? 'degraded'
      : 'operational';
  const incident = sanitisePublicIncident(input.incidentMessage);
  return incident ? { status, components, incident } : { status, components };
}
