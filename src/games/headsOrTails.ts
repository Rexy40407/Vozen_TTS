import type { Game, GameContext, GameDefinition, GameMessage } from './types';
import { bump, sendStandings, type Tally } from './finish';
import { makeRng } from './util';

const ROUNDS = 5;
const GUESS_WINDOW_MS = 8_000; // time to type heads/tails after the announcement

// Words accepted as a guess (lowercase). Proper multilingual support would be via i18n,
// but the base synonyms cover the real servers without complicating the parsing.
const HEADS_WORDS = new Set(['heads', 'head', 'h', 'cara', 'cabeça', 'cabeca']);
const TAILS_WORDS = new Set(['tails', 'tail', 't', 'coroa', 'cruz']);

type Side = 'heads' | 'tails';

/**
 * "Heads or Tails" — Vozen announces the round, each player types `heads` or `tails`
 * (1 guess per round; the first counts), and at the end of the window Vozen flips the
 * coin and SAYS the result out loud. Whoever got it right earns 1 point. 5 rounds,
 * standings at the end. Follows the Reflexes pattern: `my` captures the round number
 * so the timers do not act on an already-advanced round.
 */
class HeadsOrTailsGame implements Game {
  readonly id = 'headsOrTails';
  private round = 0;
  private open = false;
  private guesses = new Map<string, { side: Side; name: string }>();
  private rng: () => number = () => 0;
  private readonly tally: Tally = new Map();

  async start(ctx: GameContext): Promise<void> {
    this.rng = makeRng(ctx.seed);
    await ctx.send(ctx.t('game.headsOrTails.intro', { rounds: ROUNDS }));
    void ctx.say(ctx.t('game.headsOrTails.introVoice'));
    this.nextRound(ctx);
  }

  private nextRound(ctx: GameContext): void {
    if (this.round >= ROUNDS) {
      void this.finish(ctx);
      return;
    }
    this.round++;
    this.open = true;
    this.guesses = new Map();
    const my = this.round;
    void ctx.send(ctx.t('game.headsOrTails.round', { n: this.round, total: ROUNDS }));
    void ctx.say(ctx.t('game.headsOrTails.roundVoice'));
    ctx.after(GUESS_WINDOW_MS, () => {
      if (this.round !== my || !this.open) return;
      this.open = false;
      this.reveal(ctx);
    });
  }

  private reveal(ctx: GameContext): void {
    const flip: Side = this.rng() % 2 === 0 ? 'heads' : 'tails';
    const flipName = ctx.t(`game.headsOrTails.${flip}`);
    void ctx.say(ctx.t('game.headsOrTails.resultVoice', { side: flipName }));
    const winners: string[] = [];
    for (const [userId, g] of this.guesses) {
      if (g.side === flip) {
        ctx.award(userId, 1);
        bump(this.tally, userId, g.name, 1);
        winners.push(g.name);
      }
    }
    const line =
      winners.length > 0
        ? ctx.t('game.headsOrTails.winners', { side: flipName, users: winners.join(', ') })
        : ctx.t('game.headsOrTails.noWinners', { side: flipName });
    void ctx.send(`🪙 ${line}`);
    // Short pause between rounds so the speech does not run over the next announcement.
    ctx.after(2_500, () => this.nextRound(ctx));
  }

  onMessage(_ctx: GameContext, msg: GameMessage): void {
    if (!this.open) return;
    const w = msg.content.trim().toLowerCase();
    const side: Side | null = HEADS_WORDS.has(w) ? 'heads' : TAILS_WORDS.has(w) ? 'tails' : null;
    if (!side) return; // normal channel chatter — ignore
    if (this.guesses.has(msg.authorId)) return; // 1 guess per round (the first counts)
    this.guesses.set(msg.authorId, { side, name: msg.authorName });
  }

  private async finish(ctx: GameContext): Promise<void> {
    await sendStandings(ctx, this.tally);
    ctx.end();
  }
}

export const headsOrTailsDef: GameDefinition = {
  id: 'headsOrTails',
  nameKey: 'game.headsOrTails.name',
  descKey: 'game.headsOrTails.desc',
  needsVoice: true,
  create: () => new HeadsOrTailsGame(),
};
