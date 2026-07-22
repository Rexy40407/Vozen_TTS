import type { Game, GameContext, GameDefinition, GameMessage } from './types';
import { announceWinner } from './finish';
import { wordsForLocale } from './content/words';
import { normalizeAnswer, seededIndex } from './util';

const MAX_WRONG = 6;
const IDLE_MS = 180_000; // 3 min without valid moves -> ends (does not hang)
/** Accepted letters (a-z + Latin accented), over the already-normalized form. */
const LETTER = /^[a-zà-ſ]$/;

/**
 * "Forca" (Hangman) — collaborative: anyone types ONE letter; whoever reveals the
 * last letter (or guesses the whole word) wins the point. 6 wrong guesses loses. A TEXT
 * game (no voice), rendered in the channel. The word comes from the bank in the guild's
 * INTERFACE language. Normalized comparison (accent-free) to be friendly.
 *
 * The idle timeout re-arms on every valid move via a counter (`moves`):
 * the timer captures the value and only acts if `moves` did not change — the same guard
 * pattern as the voice games, here serving as "no moves for 3 min -> ends".
 */
class HangmanGame implements Game {
  readonly id = 'hangman';
  private word = '';
  private readonly revealed = new Set<string>();
  private readonly wrong = new Set<string>();
  private over = false;
  private moves = 0;

  async start(ctx: GameContext): Promise<void> {
    const { words } = wordsForLocale(ctx.locale);
    this.word = normalizeAnswer(words[seededIndex(ctx.seed, words.length)] ?? 'computer');
    await ctx.send(this.render(ctx, ctx.t('game.hangman.intro')));
    this.armIdle(ctx);
  }

  private armIdle(ctx: GameContext): void {
    const at = ++this.moves;
    ctx.after(IDLE_MS, () => {
      if (at === this.moves && !this.over) {
        this.over = true;
        void ctx.send(ctx.t('game.hangman.idle', { word: this.word.toUpperCase() }));
        ctx.end();
      }
    });
  }

  onMessage(ctx: GameContext, msg: GameMessage): void {
    if (this.over) return;
    const g = normalizeAnswer(msg.content);
    if (g.length === 0) return;

    // Guess of the whole WORD: only matters if correct (does not punish normal chat).
    if (g.length > 1) {
      if (g === this.word) this.win(ctx, msg);
      return;
    }
    // A single letter.
    if (!LETTER.test(g)) return;
    if (this.revealed.has(g) || this.wrong.has(g)) return; // already tried
    this.armIdle(ctx);
    if (this.word.includes(g)) {
      this.revealed.add(g);
      if ([...this.word].every((ch) => ch === ' ' || this.revealed.has(ch))) {
        this.win(ctx, msg);
        return;
      }
      void ctx.send(
        this.render(
          ctx,
          ctx.t('game.hangman.hit', { user: msg.authorName, letter: g.toUpperCase() }),
        ),
      );
    } else {
      this.wrong.add(g);
      if (this.wrong.size >= MAX_WRONG) {
        this.over = true;
        void ctx.send(
          this.render(ctx, ctx.t('game.hangman.lose', { word: this.word.toUpperCase() })),
        );
        ctx.end();
        return;
      }
      void ctx.send(
        this.render(
          ctx,
          ctx.t('game.hangman.miss', { user: msg.authorName, letter: g.toUpperCase() }),
        ),
      );
    }
  }

  private win(ctx: GameContext, msg: GameMessage): void {
    this.over = true;
    for (const ch of this.word) this.revealed.add(ch); // reveal everything in the summary
    ctx.award(msg.authorId, 1);
    void ctx.send(
      this.render(
        ctx,
        ctx.t('game.hangman.win', { user: msg.authorName, word: this.word.toUpperCase() }),
      ),
    );
    announceWinner(ctx, msg.authorName);
    ctx.end();
  }

  private render(ctx: GameContext, header: string): string {
    const masked = [...this.word]
      .map((ch) => (ch === ' ' ? '  ' : this.revealed.has(ch) ? ch.toUpperCase() : '_'))
      .join(' ');
    const lives = '❤️'.repeat(MAX_WRONG - this.wrong.size) + '🖤'.repeat(this.wrong.size);
    const wrong = [...this.wrong].join(' ').toUpperCase();
    const wrongLine = wrong ? `\n${ctx.t('game.hangman.wrongLetters', { letters: wrong })}` : '';
    // Staged hangman figure (h0..h6 = number of wrong guesses) when the tiles exist; the
    // hearts line ❤️/🖤 stays below. Without tiles, just the hearts (as before).
    const figure = ctx.emoji(`h${this.wrong.size}`);
    const figLine = figure ? `${figure}\n` : '';
    return `${header}\n${figLine}\`${masked}\`\n${lives}${wrongLine}`;
  }
}

export const hangmanDef: GameDefinition = {
  id: 'hangman',
  nameKey: 'game.hangman.name',
  descKey: 'game.hangman.desc',
  needsVoice: false,
  create: () => new HangmanGame(),
};
