import { describe, expect, it } from 'vitest';
import { healthResponse } from '../src/health';
import { mapPublicStatus, sanitisePublicIncident } from '../src/health/publicStatus';

describe('public status mapping', () => {
  it('uses a fixed, non-identifying schema for healthy components', () => {
    const result = mapPublicStatus({
      botReady: true,
      databaseReady: true,
      providerStates: ['healthy'],
    });
    expect(result).toEqual({
      status: 'operational',
      components: { bot: 'operational', database: 'operational', providers: 'operational' },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /token|secret|error|guild|user|quota|message|audio/i,
    );
  });

  it('degrades providers, but fails closed if any health check is missing', () => {
    expect(
      mapPublicStatus({ botReady: true, databaseReady: true, providerStates: ['degraded'] }).status,
    ).toBe('degraded');
    expect(
      mapPublicStatus({ botReady: true, databaseReady: true, providerStates: [] }).status,
    ).toBe('unavailable');
    expect(
      mapPublicStatus({ botReady: false, databaseReady: true, providerStates: ['healthy'] }).status,
    ).toBe('unavailable');
  });

  it('bounds and flattens an operator incident without accepting raw multiline detail', () => {
    expect(sanitisePublicIncident('  Provider delay\nplease retry  ')).toBe(
      'Provider delay please retry',
    );
    expect(sanitisePublicIncident('x'.repeat(300))).toHaveLength(240);
  });

  it('does not expose /status unless a caller explicitly supplies the enabled resolver', () => {
    expect(healthResponse('/status').status).toBe(404);
    const result = healthResponse('/status', () =>
      mapPublicStatus({ botReady: true, databaseReady: true, providerStates: ['healthy'] }),
    );
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body).status).toBe('operational');
  });

  it('serves the versioned public API path and keeps the legacy alias compatible', () => {
    const resolver = () =>
      mapPublicStatus({ botReady: true, databaseReady: true, providerStates: ['healthy'] });
    expect(healthResponse('/api/public/status', resolver)).toEqual(
      healthResponse('/status', resolver),
    );
    expect(healthResponse('/api/public/status?source=site', resolver).status).toBe(200);
    expect(healthResponse('/api/public/status').status).toBe(404);
  });

  it('fails closed without exposing an exception when the status resolver fails', () => {
    expect(
      JSON.parse(
        healthResponse('/status', () => {
          throw new Error('db secret');
        }).body,
      ),
    ).toEqual({
      status: 'unavailable',
    });
  });
});
