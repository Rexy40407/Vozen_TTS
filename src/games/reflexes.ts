import type { Game, GameContext, GameDefinition, GameMessage } from './types';
import { bump, sendStandings, type Tally } from './finish';
import { makeRng } from './util';

const ROUNDS = 3;
const MIN_DELAY_MS = 2_000;
const MAX_EXTRA_MS = 4_000; // atraso aleatorio 2..6s antes do "JÁ!"
const OPEN_WINDOW_MS = 10_000; // tempo para reagir depois do "JÁ!"

/**
 * "Reflexos" — o Vozen conta "3, 2, 1…", espera um tempo ALEATORIO e grita "JÁ!"; o 1o
 * a escrever qualquer coisa depois disso ganha a ronda. Escrever ANTES do "JÁ!" e um
 * false-start (avisado, nao pontua). Best-of-3. Nao assenta no QuizGame (nao ha
 * "resposta certa" — e puro timing), mas reutiliza o placar partilhado (finish.ts).
 *
 * Cada ronda captura o seu numero em `my`: os dois timers da ronda (abrir a janela e
 * o "demasiado lento") so agem se `this.round === my`, evitando timers-fantasma numa
 * ronda ja avancada — o mesmo padrao do QuizGame.
 */
class ReflexesGame implements Game {
  readonly id = 'reflexes';
  private round = 0;
  private open = false;
  private done = false; // ronda ja resolvida (ganha ou expirada)
  private rng: () => number = () => 0;
  private readonly tally: Tally = new Map();

  async start(ctx: GameContext): Promise<void> {
    this.rng = makeRng(ctx.seed);
    await ctx.send(ctx.t('game.reflexes.intro', { rounds: ROUNDS }));
    this.nextRound(ctx);
  }

  private nextRound(ctx: GameContext): void {
    if (this.round >= ROUNDS) {
      void this.finish(ctx);
      return;
    }
    this.round++;
    this.open = false;
    this.done = false;
    const my = this.round;
    void ctx.send(ctx.t('game.reflexes.ready', { n: this.round, total: ROUNDS }));
    void ctx.say(ctx.t('game.reflexes.countdown'));
    const delay = MIN_DELAY_MS + (this.rng() % MAX_EXTRA_MS);
    ctx.after(delay, () => {
      if (this.round !== my || this.done) return;
      this.open = true;
      void ctx.send(ctx.t('game.reflexes.go'));
      void ctx.say(ctx.t('game.reflexes.goVoice'));
      ctx.after(OPEN_WINDOW_MS, () => {
        if (this.round === my && !this.done) {
          this.done = true;
          void ctx.send(ctx.t('game.reflexes.tooSlow'));
          this.nextRound(ctx);
        }
      });
    });
  }

  onMessage(ctx: GameContext, msg: GameMessage): void {
    if (this.done) return;
    if (!this.open) {
      // False-start: escreveu antes do "JÁ!". Avisa, mas nao resolve a ronda.
      void ctx.send(ctx.t('game.reflexes.tooSoon', { user: msg.authorName }));
      return;
    }
    this.done = true;
    ctx.award(msg.authorId, 1);
    bump(this.tally, msg.authorId, msg.authorName, 1);
    void ctx.send(ctx.t('game.reflexes.win', { user: msg.authorName }));
    this.nextRound(ctx);
  }

  private async finish(ctx: GameContext): Promise<void> {
    await sendStandings(ctx, this.tally);
    ctx.end();
  }
}

export const reflexesDef: GameDefinition = {
  id: 'reflexes',
  nameKey: 'game.reflexes.name',
  descKey: 'game.reflexes.desc',
  needsVoice: true,
  create: () => new ReflexesGame(),
};
