import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { messageText } from './messagePayload';

// Mock minimo de @discordjs/voice — nao e usado neste caminho, mas o import de
// commands/index precisa de resolver.
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { localeForUser, filterLocaleChoices, handleInteraction } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import type Database from 'better-sqlite3';

const GUILD = 'g-locale-user';

function makeDeps(db: Database.Database): BotDeps {
  return {
    client: { user: { id: 'bot-1' }, users: { cache: new Map() } },
    players: new Map(),
    db,
    config: { defaultSpeed: 1.0, defaultVoice: '' },
    availableModels: ['en_US-amy-medium'],
    limiters: new Map(),
  } as unknown as BotDeps;
}

// ── localeForUser: Discord locale -> nosso locale ─────────────────────────────

describe('localeForUser — mapeia interaction.locale para o nosso locale', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  function iWith(locale: string | undefined) {
    return { locale, guildId: GUILD } as any;
  }

  it('pt-BR -> pt (locale suportado)', () => {
    expect(localeForUser(makeDeps(db), iWith('pt-BR'))).toBe('pt');
  });

  it('en-US -> en', () => {
    expect(localeForUser(makeDeps(db), iWith('en-US'))).toBe('en');
  });

  it('es-ES -> es (es agora e suportado)', () => {
    expect(localeForUser(makeDeps(db), iWith('es-ES'))).toBe('es');
  });

  it('es-419 -> es (variante regional colapsa para a base)', () => {
    expect(localeForUser(makeDeps(db), iWith('es-419'))).toBe('es');
  });

  it('zh-CN e zh-TW -> zh', () => {
    expect(localeForUser(makeDeps(db), iWith('zh-CN'))).toBe('zh');
    expect(localeForUser(makeDeps(db), iWith('zh-TW'))).toBe('zh');
  });

  it('codigo ja base (fr) -> fr', () => {
    expect(localeForUser(makeDeps(db), iWith('fr'))).toBe('fr');
  });

  it('locale Discord NAO suportado (ko) cai no locale da GUILD', () => {
    // Guild configurada em pt; um utilizador com Discord em coreano (nao suportado)
    // ve a interface no locale da guild. (NB: 'ja'/japones passou a ser SUPORTADO com
    // a adicao do locale ja, por isso o exemplo de "nao suportado" mudou para 'ko'.)
    setGuildConfig(db, GUILD, { locale: 'pt' });
    expect(localeForUser(makeDeps(db), iWith('ko'))).toBe('pt');
  });

  it('ja (japones) e um locale SUPORTADO -> ja', () => {
    // Regressao: o japones foi adicionado a SUPPORTED_LOCALES; um utilizador com o
    // Discord em japones ve a interface em japones, nao o fallback da guild.
    setGuildConfig(db, GUILD, { locale: 'pt' });
    expect(localeForUser(makeDeps(db), iWith('ja'))).toBe('ja');
  });

  it('locale Discord NAO suportado + guild no default -> en', () => {
    // Sem config de guild: guild locale = default 'en'.
    expect(localeForUser(makeDeps(db), iWith('ko'))).toBe('en');
    expect(localeForUser(makeDeps(db), iWith('th'))).toBe('en');
  });

  it('interaction.locale ausente/vazio -> cai na guild (en por defeito)', () => {
    expect(localeForUser(makeDeps(db), iWith(undefined))).toBe('en');
    expect(localeForUser(makeDeps(db), iWith(''))).toBe('en');
  });

  it('interaction.locale ausente com guild em pt -> pt (guild)', () => {
    setGuildConfig(db, GUILD, { locale: 'pt' });
    expect(localeForUser(makeDeps(db), iWith(undefined))).toBe('pt');
  });

  it('nunca lanca (interaction sem guildId nem locale)', () => {
    expect(() => localeForUser(makeDeps(db), {} as any)).not.toThrow();
    expect(localeForUser(makeDeps(db), {} as any)).toBe('en');
  });
});

// ── filterLocaleChoices: autocomplete do /config language ─────────────────────

describe('filterLocaleChoices — autocomplete de /config language', () => {
  it('query vazia devolve <=25 (34 locales > 25, tem de cortar)', () => {
    const out = filterLocaleChoices('');
    expect(out.length).toBeLessThanOrEqual(25);
    expect(out.length).toBe(25);
  });

  it('cada choice e { name: endonimo, value: code }', () => {
    const out = filterLocaleChoices('portu');
    expect(out).toContainEqual({ name: 'Português', value: 'pt' });
  });

  it('filtra pelo nome legivel (endonimo) — "deuts" -> de', () => {
    expect(filterLocaleChoices('deuts').map((c) => c.value)).toContain('de');
  });

  it('filtra pelo CODIGO do locale — "fr" -> fr', () => {
    expect(filterLocaleChoices('fr').map((c) => c.value)).toContain('fr');
  });

  it('e case-insensitive e ignora espacos', () => {
    expect(filterLocaleChoices('  ENGLISH ').map((c) => c.value)).toContain('en');
  });

  it('query que nao bate em nada devolve []', () => {
    expect(filterLocaleChoices('zzzz-nao-existe')).toEqual([]);
  });
});

// ── wiring: uma resposta EPHEMERAL usa o Discord locale do UTILIZADOR ──────────

describe('/leave — usa o Discord locale do utilizador (nao o da guild)', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  function makeLeaveInteraction(locale: string | undefined) {
    const replies: string[] = [];
    return {
      commandName: 'leave',
      guildId: GUILD,
      locale,
      replies,
      replied: false,
      deferred: false,
      isRepliable: () => true,
      reply: async (o: unknown) => {
        replies.push(messageText(o));
      },
    };
  }

  it('guild em EN mas o utilizador em pt-BR -> a resposta sai em PT', async () => {
    // Guild fica no default 'en'. Se o handler usasse o locale da GUILD, a resposta
    // sairia em ingles. Como usa o locale do UTILIZADOR (pt-BR -> pt), sai em PT.
    // 'leave.left' tem valor `pt` distinto do `en`, por isso o fallback NAO mascara.
    const i = makeLeaveInteraction('pt-BR');
    await handleInteraction(i as any, makeDeps(db));
    // t('leave.left','pt') = "Sai do canal de voz. Ate a proxima!"
    expect(i.replies.join('\n')).toMatch(/Sai do canal de voz/i);
    // e NAO a versao inglesa ("Left the voice channel.")
    expect(i.replies.join('\n')).not.toMatch(/Left the voice channel/i);
  });

  it('sem locale do utilizador -> usa o da guild (en por defeito)', async () => {
    const i = makeLeaveInteraction(undefined);
    await handleInteraction(i as any, makeDeps(db));
    // t('leave.left','en') = "Left the voice channel. See you next time!"
    expect(i.replies.join('\n')).toMatch(/Left the voice channel/i);
  });
});
