import type { SynthRequest } from '../tts/engine';

/**
 * Relogio + timers INJETAVEIS. Os minijogos sao muito dependentes de tempo (rondas
 * com limite, contagens decrescentes, atrasos aleatorios). Injetar o relogio segue o
 * padrao do codebase (sleepImpl/fetchImpl no gtts) e torna os testes DETERMINISTAS e
 * rapidos: um relogio falso avanca o tempo a mao em vez de o teste esperar segundos
 * reais. O `systemClock` e a implementacao de producao (setTimeout do Node).
 */
export type TimerHandle = unknown;

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** Conteudo enviavel ao canal de texto do jogo: texto simples ou um embed. */
export type Sendable = string | { embeds: unknown[] };

/** Uma mensagem recebida no canal do jogo (subconjunto testavel de Message). */
export interface GameMessage {
  authorId: string;
  authorName: string;
  content: string;
}

/** Opcoes de uma fala de jogo. */
export interface SayOpts {
  /** Voz (id de modelo) a usar. Default: a voz default da guild / .env. */
  model?: string;
  /** Velocidade. Default: a velocidade default do bot. */
  speed?: number;
}

/**
 * O que um jogo pode fazer com o mundo. Fornecido pelo GameManager, ligado a sessao
 * ATIVA (guild + canal). Um jogo NUNCA toca em discord.js diretamente — so neste
 * contexto — o que o torna testavel com um contexto falso. Todos os efeitos que
 * podem lancar (say/send) engolem+logam o erro em vez de o propagar: um jogo nunca
 * deve crashar o handler de mensagens.
 */
export interface GameContext {
  readonly guildId: string;
  readonly channelId: string;
  /** Locale da INTERFACE da guild — os jogos sao de grupo, falam a lingua do servidor. */
  readonly locale: string;
  /** Semente determinista para escolher conteudo (testavel; em runtime = clock.now()). */
  readonly seed: number;
  /** Modelos de voz instalados (para escolher a voz por lingua). */
  readonly availableModels: string[];
  /** Voz default desta guild (id de modelo) — a lingua-base dela decide o conteudo. */
  readonly defaultVoice: string;

  /** Fala em voz alta (se houver player/call). Devolve false se nao deu para falar. */
  say(text: string, opts?: SayOpts): Promise<boolean>;
  /** Envia texto/embed ao canal do jogo. Nunca lanca. */
  send(content: Sendable): Promise<void>;
  /** Traducao no locale da guild. */
  t(key: string, params?: Record<string, string | number>): string;
  /** Agenda `fn` daqui a `ms`. O timer e CANCELADO automaticamente no fim do jogo. */
  after(ms: number, fn: () => void): void;
  /**
   * Markup de um emoji da aplicacao pelo nome (ex. 'wpl' -> '<:wpl:123>'), ou undefined
   * se nao existir/ainda nao carregou. Usado pelo tabuleiro de xadrez para desenhar as
   * pecas; ausente => o jogo cai no render ASCII.
   */
  emoji(name: string): string | undefined;
  /** Regista `points` para `userId` (acumulado; persistido no fim do jogo). */
  award(userId: string, points: number): void;
  /** Termina o jogo JA: cancela timers, persiste pontos, liberta o lock da guild. */
  end(): void;
}

/**
 * Um minijogo. Uma INSTANCIA = UMA partida (pode ter varias rondas geridas
 * internamente). `start` anuncia a 1a ronda; `onMessage` recebe cada mensagem do
 * canal do jogo. Qualquer um pode chamar ctx.end() para terminar. Todo o estado da
 * partida vive na instancia criada por GameDefinition.create() — sem estado global.
 */
export interface Game {
  readonly id: string;
  start(ctx: GameContext): void | Promise<void>;
  onMessage(ctx: GameContext, msg: GameMessage): void | Promise<void>;
}

/**
 * Opcoes escolhidas no /game play e passadas ao create() do jogo. Bag OPCIONAL: os 14
 * jogos existentes ignoram-no (create() sem parametros continua a satisfazer a
 * interface). So o word-chain usa `language` (a lingua da partida).
 */
export interface GameStartOptions {
  /** Codigo de lingua base ('pt'|'en'|'es'|'fr') para jogos multilingues (word-chain). */
  language?: string;
}

/** Metadados + fabrica de um jogo, para o registo e o autocomplete do /game. */
export interface GameDefinition {
  readonly id: string;
  /** Chave i18n do nome legivel (ex. 'game.guessLanguage.name'). */
  readonly nameKey: string;
  /** Chave i18n de uma descricao curta (mostrada no /game list). */
  readonly descKey: string;
  /** Precisa do bot numa call (jogos de voz) ? */
  readonly needsVoice: boolean;
  /** Exige Premium (Plus do proprio OU Premium do servidor) para iniciar? Ausente/false = gratis. */
  readonly premium?: boolean;
  /** Usa a opcao `language` do /game play? So o word-chain — mostra/filtra o autocomplete. */
  readonly usesLanguage?: boolean;
  /** Cria uma instancia NOVA da partida. `opts` vem do /game play (ignorado por quase todos). */
  create(opts?: GameStartOptions): Game;
}

/**
 * Capacidades que o GameManager precisa do mundo exterior. Injetadas no bootstrap
 * (backed por BotDeps). Mantem o manager DESACOPLADO de discord.js/SQLite: os testes
 * fornecem um env falso e verificam o comportamento sem rede nem base de dados.
 */
export interface GameEnv {
  clock: Clock;
  availableModels: string[];
  defaultSpeed: number;
  /** Voz default a usar nos anuncios desta guild (config da guild / .env). */
  defaultVoiceOf(guildId: string): string;
  /** Player da guild (para say). undefined = o bot nao esta numa call. */
  getPlayer(guildId: string): { say(req: SynthRequest): Promise<boolean> } | undefined;
  /** Envia conteudo ao canal de texto. */
  sendToChannel(channelId: string, content: Sendable): Promise<void>;
  /**
   * Apaga um canal (a THREAD descartavel de um jogo). OPCIONAL: sem ele (ou em envs
   * de teste antigos), o jogo em thread nao apaga a thread no fim (degradacao: a thread
   * auto-arquiva). Best-effort — nunca lanca.
   */
  deleteChannel?(channelId: string): Promise<void>;
  /** Locale da interface da guild. */
  localeOf(guildId: string): string;
  /** Traducao. */
  translate(key: string, locale: string, params?: Record<string, string | number>): string;
  /** Persiste os pontos acumulados de uma partida (userId -> pontos) + marca o vencedor. */
  persistScores(guildId: string, points: Map<string, number>): void;
  /** Log de erro (para nunca deixar um throw de jogo escapar). */
  logError(msg: string, err: unknown): void;
  /**
   * Mapa nome->markup dos application emojis (ex. { wpl: '<:wpl:123>' }). Preenchido no
   * arranque (ClientReady) por referencia, por isso pode comecar vazio. Opcional: sem
   * ele (ou vazio) o xadrez usa o tabuleiro ASCII.
   */
  boardEmojis?: Record<string, string>;
}
