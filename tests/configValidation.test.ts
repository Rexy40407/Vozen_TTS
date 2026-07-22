import { describe, it, expect } from 'vitest';
import { validateConfigEnv } from '../src/config/index';

// Plano 024 (SECRET-01/SECRET-02): validateConfigEnv e um helper PURO — recebe
// um record de env e devolve findings { level, message }, sem ler process.env
// nem produzir side-effects. Isto cobre o caso "segredo presente mas vazio"
// (dotenv duplicate keys = last-wins; uma linha residual `CHAVE=` vazia a
// seguir a boa apaga o valor real em silencio) e o listener top.gg redundante.
describe('validateConfigEnv', () => {
  it('TOPGG_WEBHOOK_SECRET presente mas vazio -> um warning que nomeia a var', () => {
    const findings = validateConfigEnv({ TOPGG_WEBHOOK_SECRET: '' });
    expect(findings).toHaveLength(1);
    expect(findings[0].level).toBe('warn');
    expect(findings[0].message).toMatch(/TOPGG_WEBHOOK_SECRET/);
  });

  it('TOPGG_WEBHOOK_SECRET + segredo estavel preenchidos -> sem finding', () => {
    const findings = validateConfigEnv({
      TOPGG_WEBHOOK_SECRET: 'x',
      VOTE_REDEMPTION_SECRET: '0123456789abcdef0123456789abcdef',
    });
    expect(findings).toHaveLength(0);
  });

  it('endpoint de voto sem VOTE_REDEMPTION_SECRET forte -> erro', () => {
    const findings = validateConfigEnv({ TOPGG_WEBHOOK_SECRET: 'x' });
    expect(findings).toHaveLength(1);
    expect(findings[0].level).toBe('error');
    expect(findings[0].message).toMatch(/VOTE_REDEMPTION_SECRET/);
  });

  it('TOPGG_WEBHOOK_SECRET ausente -> sem finding (feature desligada e um estado legitimo)', () => {
    const findings = validateConfigEnv({});
    expect(findings).toHaveLength(0);
  });

  it('KOFI_WEBHOOK_TOKEN presente mas vazio -> um warning que nomeia a var', () => {
    const findings = validateConfigEnv({ KOFI_WEBHOOK_TOKEN: '' });
    expect(findings).toHaveLength(1);
    expect(findings[0].level).toBe('warn');
    expect(findings[0].message).toMatch(/KOFI_WEBHOOK_TOKEN/);
  });

  it('KOFI_WEBHOOK_TOKEN presente e preenchido -> sem finding', () => {
    expect(validateConfigEnv({ KOFI_WEBHOOK_TOKEN: 'tok-123' })).toHaveLength(0);
  });

  it('KOFI_WEBHOOK_TOKEN ausente -> sem finding', () => {
    expect(validateConfigEnv({})).toHaveLength(0);
  });

  it('GOOGLE_TTS_API_KEY presente mas vazio -> um warning (chave PAGA nao pode ser clobbered em silencio)', () => {
    const findings = validateConfigEnv({ GOOGLE_TTS_API_KEY: '' });
    expect(findings).toHaveLength(1);
    expect(findings[0].level).toBe('warn');
    expect(findings[0].message).toMatch(/GOOGLE_TTS_API_KEY/);
  });

  it('GOOGLE_TTS_API_KEY preenchido / ausente -> sem finding', () => {
    expect(validateConfigEnv({ GOOGLE_TTS_API_KEY: 'k' })).toHaveLength(0);
    expect(validateConfigEnv({})).toHaveLength(0);
  });

  it('OPENAI_API_KEY presente mas vazio -> um warning', () => {
    const findings = validateConfigEnv({ OPENAI_API_KEY: '' });
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/OPENAI_API_KEY/);
  });

  it('TOPGG_WEBHOOK_PORT definido + TOPGG_WEBHOOK_SECRET nao-vazio -> aviso de listener redundante', () => {
    const findings = validateConfigEnv({
      TOPGG_WEBHOOK_PORT: '3002',
      TOPGG_WEBHOOK_SECRET: 'x',
      VOTE_REDEMPTION_SECRET: '0123456789abcdef0123456789abcdef',
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].level).toBe('warn');
    expect(findings[0].message).toMatch(/TOPGG_WEBHOOK_PORT/);
    expect(findings[0].message).toMatch(/duplicates/i);
  });

  it('TOPGG_WEBHOOK_PORT sozinho (sem secret) -> sem aviso de redundancia', () => {
    expect(validateConfigEnv({ TOPGG_WEBHOOK_PORT: '3002' })).toHaveLength(0);
  });

  it('TOPGG_WEBHOOK_PORT + TOPGG_WEBHOOK_SECRET vazio -> so o warning de segredo vazio (nao o de redundancia)', () => {
    const findings = validateConfigEnv({ TOPGG_WEBHOOK_PORT: '3002', TOPGG_WEBHOOK_SECRET: '' });
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/TOPGG_WEBHOOK_SECRET/);
  });

  it('nenhum valor de segredo e reproduzido em nenhuma mensagem', () => {
    const secretValue = 'super-secret-token-abc123';
    const findings = validateConfigEnv({
      TOPGG_WEBHOOK_SECRET: secretValue,
      TOPGG_WEBHOOK_PORT: '3002',
      VOTE_REDEMPTION_SECRET: '0123456789abcdef0123456789abcdef',
      KOFI_WEBHOOK_TOKEN: secretValue,
    });
    for (const finding of findings) {
      expect(finding.message).not.toContain(secretValue);
    }
  });
});
