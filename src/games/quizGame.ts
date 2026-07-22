import type { Game, GameContext, GameMessage, SayOpts } from './types';
import { bump, sendStandings, type Tally } from './finish';

/**
 * A round of a voice quiz game: what to SPEAK/SEND and how to recognize the correct
 * answer. All texts already come LOCALIZED (the game calls ctx.t before putting them here).
 */
export interface QuizRound {
  /** Spoken aloud (optional): the round's "riddle". */
  speak?: { text: string; opts?: SayOpts };
  /** Message to send to the channel when the round opens (e.g. "Round 2/5 — listen…"). */
  announce?: string;
  /** Is the `raw` answer correct? */
  accept: (raw: string) => boolean;
  /** Channel message when someone gets it right (receives the name of who got it). */
  onCorrect: (userName: string) => string;
  /** Channel message when the round expires without an answer. */
  onTimeout: () => string;
}

/**
 * SHARED base for the "voice -> first to answer" games (Guess the Language,
 * Speed, Dictation, Math, …). Handles ALL the common machinery:
 *  - loop of N rounds with an optional intro;
 *  - speaks/announces each round and arms the timeout;
 *  - accepts the FIRST correct guess (award 1 point), ignores the following ones in the round;
 *  - the timeout captures the round number so it does not fire on an already-advanced round
 *    (avoids the ghost timer without cancelling the timer — same pattern as guessLanguage);
 *  - local scoreboard + shared final summary (game.finish.*).
 *
 * Each concrete game only implements the CONTENT: prepare (number of rounds + one-time prep),
 * makeRound (round i) and emptyMessage (no content). This way a new game fits in
 * ~40 lines instead of repeating this machinery.
 */
export abstract class QuizGame implements Game {
  abstract readonly id: string;
  /** Time limit of each round (ms). Overridable per game. */
  protected roundMs = 25_000;

  private idx = 0;
  private total = 0;
  private answered = true; // true between rounds — does not accept guesses outside a round
  private cur: QuizRound | null = null;
  private readonly tally: Tally = new Map();

  /** One-time prep; returns the number of rounds. <=0 => no content (sends emptyMessage). */
  protected abstract prepare(ctx: GameContext): number;
  /** Builds round `index` (0-based). Called once per round. */
  protected abstract makeRound(ctx: GameContext, index: number): QuizRound;
  /** Message when there is no content to play (prepare returned 0). */
  protected abstract emptyMessage(ctx: GameContext): string;
  /** Intro text (already localized). null => no intro. */
  protected intro(_ctx: GameContext, _rounds: number): string | null {
    return null;
  }

  async start(ctx: GameContext): Promise<void> {
    this.total = this.prepare(ctx);
    if (this.total <= 0) {
      await ctx.send(this.emptyMessage(ctx));
      ctx.end();
      return;
    }
    const intro = this.intro(ctx, this.total);
    if (intro) await ctx.send(intro);
    this.next(ctx);
  }

  private next(ctx: GameContext): void {
    if (this.idx >= this.total) {
      void this.finish(ctx);
      return;
    }
    this.cur = this.makeRound(ctx, this.idx);
    this.idx++;
    this.answered = false;
    const myRound = this.idx;
    if (this.cur.announce) void ctx.send(this.cur.announce);
    if (this.cur.speak) void ctx.say(this.cur.speak.text, this.cur.speak.opts);
    ctx.after(this.roundMs, () => {
      if (this.idx === myRound && !this.answered) this.onTimeout(ctx);
    });
  }

  private onTimeout(ctx: GameContext): void {
    this.answered = true;
    if (this.cur) void ctx.send(this.cur.onTimeout());
    this.next(ctx);
  }

  onMessage(ctx: GameContext, msg: GameMessage): void {
    if (this.answered || !this.cur) return;
    if (!this.cur.accept(msg.content)) return;
    this.answered = true;
    ctx.award(msg.authorId, 1);
    bump(this.tally, msg.authorId, msg.authorName, 1);
    void ctx.send(this.cur.onCorrect(msg.authorName));
    this.next(ctx);
  }

  private async finish(ctx: GameContext): Promise<void> {
    await sendStandings(ctx, this.tally); // scoreboard + winner announcement in voice
    ctx.end();
  }
}
