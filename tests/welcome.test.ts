import { describe, it, expect } from 'vitest';
import { PermissionFlagsBits, ChannelType } from 'discord.js';
import { pickWelcomeChannel, buildWelcomeEmbed, welcomeLocaleFor } from '../src/bot/welcome';

// Testes das pecas PURAS/testaveis do welcome embed (guildCreate). NAO simulamos
// o evento real do gateway — o handler em client.ts so liga estas funcoes.

// Canal de texto fake com o mesmo padrao `permissionsFor: () => ({ has })` dos
// testes de /setup. `granted` sao as flags que o bot tem nesse canal.
function makeChannel(id: string, type: number, granted: bigint[]): unknown {
  return {
    id,
    type,
    permissionsFor: () => ({ has: (flag: bigint) => granted.includes(flag) }),
  };
}

// Guild fake: `me` e a referencia do bot; systemChannel e a cache (Collection-like
// via array de canais) sao configuraveis.
function makeGuild(opts: { systemChannel?: unknown; channels?: unknown[]; me?: unknown }): unknown {
  // Distingue "me nao fornecido" (default = bot fake) de "me explicitamente null"
  // (bot ausente): usamos 'me' in opts em vez de ?? para nao colapsar o null.
  const me = 'me' in opts ? opts.me : { id: 'bot-1' };
  return {
    members: { me },
    systemChannel: opts.systemChannel ?? null,
    channels: { cache: opts.channels ?? [] },
  };
}

const POST = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];

describe('pickWelcomeChannel', () => {
  it('escolhe o systemChannel quando o bot pode la enviar', () => {
    const sys = makeChannel('sys', ChannelType.GuildText, POST);
    const other = makeChannel('other', ChannelType.GuildText, POST);
    const guild = makeGuild({ systemChannel: sys, channels: [other] });
    const picked = pickWelcomeChannel(guild as any);
    expect((picked as { id: string })?.id).toBe('sys');
  });

  it('cai no 1.º canal de texto enviavel quando falta perm no systemChannel', () => {
    // systemChannel existe mas o bot nao tem SendMessages la -> nao serve.
    const sys = makeChannel('sys', ChannelType.GuildText, [PermissionFlagsBits.ViewChannel]);
    const bad = makeChannel('bad', ChannelType.GuildText, []); // sem perms
    const good = makeChannel('good', ChannelType.GuildText, POST);
    const guild = makeGuild({ systemChannel: sys, channels: [bad, good] });
    const picked = pickWelcomeChannel(guild as any);
    expect((picked as { id: string })?.id).toBe('good');
  });

  it('ignora canais que nao sao de texto no fallback', () => {
    const voice = makeChannel('voice', ChannelType.GuildVoice, POST); // voz, nao serve
    const text = makeChannel('text', ChannelType.GuildText, POST);
    const guild = makeGuild({ systemChannel: null, channels: [voice, text] });
    const picked = pickWelcomeChannel(guild as any);
    expect((picked as { id: string })?.id).toBe('text');
  });

  it('devolve null quando nenhum canal serve', () => {
    const bad = makeChannel('bad', ChannelType.GuildText, []); // sem SendMessages
    const voice = makeChannel('voice', ChannelType.GuildVoice, POST);
    const guild = makeGuild({ systemChannel: null, channels: [bad, voice] });
    expect(pickWelcomeChannel(guild as any)).toBeNull();
  });

  it('devolve null quando nao ha referencia do bot (members.me ausente)', () => {
    const text = makeChannel('text', ChannelType.GuildText, POST);
    const guild = makeGuild({ systemChannel: text, channels: [text], me: null });
    expect(pickWelcomeChannel(guild as any)).toBeNull();
  });

  it('aceita a cache como Collection (iteravel de pares [id, ch])', () => {
    const text = makeChannel('text', ChannelType.GuildText, POST);
    // Simula uma Collection do discord.js: iteravel de [id, ch].
    const cache = new Map<string, unknown>([['text', text]]);
    const guild = {
      members: { me: { id: 'bot-1' } },
      systemChannel: null,
      channels: { cache },
    };
    const picked = pickWelcomeChannel(guild as any);
    expect((picked as { id: string })?.id).toBe('text');
  });
});

describe('buildWelcomeEmbed', () => {
  it('constroi um embed com titulo, descricao e mencao a /setup e /help', () => {
    const embed = buildWelcomeEmbed('en');
    const json = embed.toJSON();
    expect(json.title).toBeTruthy();
    expect(json.description).toBeTruthy();
    expect(json.description).toContain('/setup');
    expect(json.description).toContain('/help');
  });

  it('serializa sem violar os limites do Discord', () => {
    const embed = buildWelcomeEmbed('en');
    expect(() => embed.toJSON()).not.toThrow();
  });

  it('usa o default (en) quando o locale e omitido e menciona a marca Vozen', () => {
    const embed = buildWelcomeEmbed();
    const json = embed.toJSON();
    const text = `${json.title}\n${json.description}\n${json.footer?.text ?? ''}`;
    expect(text).toContain('Vozen');
    expect(text).toContain('/setup');
  });

  it('explains the free Piper / paid Kokoro boundary (en)', () => {
    const json = buildWelcomeEmbed('en').toJSON();
    const desc = json.description ?? '';
    expect(desc).toContain('Piper');
    expect(desc).toContain('Kokoro');
    expect(desc).toContain('Premium');
  });

  it('explains the free Piper / paid Kokoro boundary in pt', () => {
    const json = buildWelcomeEmbed('pt').toJSON();
    const desc = json.description ?? '';
    expect(desc).toContain('Piper');
    expect(desc).toContain('Kokoro');
    expect(desc).toContain('Premium');
  });

  // Onboarding beginner-friendly: alem de /setup+/help, o welcome tem de mostrar o
  // FLUXO em 3 passos para os membros (join voz -> /join -> escrever/tts) num FIELD
  // (a descricao continua a ser o posicionamento). Field mantem-nos dentro do cap
  // de 1024 e nao mexe nos asserts da descricao.
  it('inclui um field com o fluxo em 3 passos (join voz -> /join -> escrever) em en', () => {
    const json = buildWelcomeEmbed('en').toJSON();
    const fields = json.fields ?? [];
    expect(fields.length).toBeGreaterThan(0);
    const body = fields.map((f) => `${f.name}\n${f.value}`).join('\n');
    expect(body).toMatch(/\/join/);
    expect(body).toMatch(/voice/i); // passo 1: entrar num canal de voz
    expect(body).toMatch(/type|\/tts/i); // passo 3: escrever ou /tts
    // cada field respeita os limites do Discord (name<=256, value<=1024)
    for (const f of fields) {
      expect(f.name.length).toBeLessThanOrEqual(256);
      expect(f.value.length).toBeLessThanOrEqual(1024);
    }
  });

  it('o field do fluxo em 3 passos tambem existe em pt', () => {
    const json = buildWelcomeEmbed('pt').toJSON();
    const fields = json.fields ?? [];
    const body = fields.map((f) => `${f.name}\n${f.value}`).join('\n');
    expect(body).toMatch(/\/join/);
    expect(body).toMatch(/voz/i); // passo 1 em pt
  });
});

// The welcome is sent on guildCreate, where there is NO user interaction (no i.locale).
// The best signal is the SERVER's own Discord language (guild.preferredLocale). So a
// Portuguese/Russian server should get its welcome in its language, not always English.
describe('welcomeLocaleFor (guild.preferredLocale -> welcome language)', () => {
  it('maps the server Discord language to a supported base code', () => {
    expect(welcomeLocaleFor('pt-BR')).toBe('pt');
    expect(welcomeLocaleFor('ru')).toBe('ru');
    expect(welcomeLocaleFor('fr')).toBe('fr');
    expect(welcomeLocaleFor('zh-CN')).toBe('zh');
  });

  it('falls back to English for an unsupported language or when absent', () => {
    expect(welcomeLocaleFor('ko')).toBe('en'); // Korean: not translated yet
    expect(welcomeLocaleFor(null)).toBe('en');
    expect(welcomeLocaleFor(undefined)).toBe('en');
  });

  it('actually renders the welcome in that language (pt server -> pt copy)', () => {
    const en = buildWelcomeEmbed(welcomeLocaleFor('en-US')).toJSON().description ?? '';
    const pt = buildWelcomeEmbed(welcomeLocaleFor('pt-BR')).toJSON().description ?? '';
    expect(pt).not.toBe(en); // the Portuguese server does NOT get the English description
  });
});
