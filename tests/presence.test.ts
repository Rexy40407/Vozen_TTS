import { describe, it, expect } from 'vitest';
import { ActivityType } from 'discord.js';
import { buildPresence } from '../src/bot/presence';
import type { AppConfig } from '../src/config/index';

// Helper: produz uma AppConfig minima para o teste. So `presenceText` interessa
// a buildPresence; os restantes campos existem so para satisfazer o tipo.
function cfg(presenceText?: string): AppConfig {
  return { presenceText } as unknown as AppConfig;
}

describe('buildPresence — presenca/atividade do bot (auto-marketing subtil)', () => {
  it('(a) sem PRESENCE_TEXT usa o default com a marca/CTA', () => {
    const p = buildPresence(cfg(undefined));
    const activity = p.activities?.[0];
    expect(activity).toBeDefined();
    // ActivityType.Listening renderiza o `name` no cliente ("Listening to …"),
    // por isso e o `name` que tem de carregar a marca + CTA. NAO comparamos com
    // uma constante importada (tautologia) — afirmamos os marcadores de marca.
    expect(activity?.name).toMatch(/type it, hear it/i);
    expect(activity?.name).toContain('/setup');
  });

  it('(a2) o tipo de atividade e Listening (renderiza o name no cliente)', () => {
    const p = buildPresence(cfg(undefined));
    expect(p.activities?.[0]?.type).toBe(ActivityType.Listening);
  });

  it('(b) com PRESENCE_TEXT definido o name e o override exato', () => {
    const override = 'algo personalizado • /help';
    const p = buildPresence(cfg(override));
    expect(p.activities?.[0]?.name).toBe(override);
  });

  it('(c) status e "online"', () => {
    expect(buildPresence(cfg(undefined)).status).toBe('online');
    expect(buildPresence(cfg('qualquer')).status).toBe('online');
  });
});
