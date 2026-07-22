import type { Game, GameContext, GameDefinition, GameMessage } from './types';
import { announceWinner } from './finish';
import { pickWordleWords } from './content/wordleWords';
import { normalizeAnswer, seededIndex } from './util';

const MAX_GUESSES = 8;
const IDLE_MS = 180_000;
// ANSI ESC byte (built, not a literal in source, so there are no raw control
// bytes in the file). Discord BACKGROUND codes: 42=green, 43=yellow/gold,
// 40=dark-gray; black/white text (30/37) and bold (1). This is how the guess
// becomes colored LETTERS (like the real Wordle), instead of emoji squares + separate letters.
const ESC = String.fromCharCode(27);
const SGR = { g: '1;30;42', y: '1;30;43', x: '1;37;40' } as const;

/** State of each cell: green (correct), yellow (present), gray (absent). */
type CellState = 'g' | 'y' | 'x';

/**
 * "Termo/Wordle" — collaborative: anyone types a 5-letter word; Vozen
 * replies with the COLORED LETTERS (green=right spot, yellow=present/wrong spot,
 * gray=not in word) in a ```ansi block. Whoever guesses the word wins the point; {MAX}
 * shared attempts. TEXT game. Only messages with EXACTLY 5 letters count.
 */
class WordleGame implements Game {
  readonly id = 'wordle';
  private target = '';
  private guesses = 0;
  private over = false;
  private moves = 0;
  /** Letters ALREADY KNOWN: `present` are in the word; `absent` were ruled out. */
  private readonly present = new Set<string>();
  private readonly absent = new Set<string>();
  /** Guess history (letters + states) — to draw the full grid. */
  private readonly rows: { letters: string; states: CellState[] }[] = [];

  async start(ctx: GameContext): Promise<void> {
    const { words } = pickWordleWords(ctx.locale);
    this.target = normalizeAnswer(words[seededIndex(ctx.seed, words.length)] ?? 'apple');
    await ctx.send(ctx.t('game.wordle.intro', { max: MAX_GUESSES }));
    this.armIdle(ctx);
  }

  private armIdle(ctx: GameContext): void {
    const at = ++this.moves;
    ctx.after(IDLE_MS, () => {
      if (at === this.moves && !this.over) {
        this.over = true;
        void ctx.send(ctx.t('game.wordle.idle', { word: this.target.toUpperCase() }));
        ctx.end();
      }
    });
  }

  /**
   * State of each guess cell (Wordle rules, aware of repeated-letter counts):
   * green=right spot, yellow=present/wrong spot, gray=absent.
   */
  private computeStates(guess: string): CellState[] {
    const state: CellState[] = ['x', 'x', 'x', 'x', 'x'];
    const counts = new Map<string, number>();
    for (const ch of this.target) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    for (let i = 0; i < 5; i++) {
      if (guess[i] === this.target[i]) {
        state[i] = 'g';
        counts.set(guess[i], (counts.get(guess[i]) ?? 0) - 1);
      }
    }
    for (let i = 0; i < 5; i++) {
      if (state[i] === 'g') continue;
      const left = counts.get(guess[i]) ?? 0;
      if (left > 0) {
        state[i] = 'y';
        counts.set(guess[i], left - 1);
      }
    }
    return state;
  }

  /** Are the wordle tiles loaded? (the gray 'a' existing is enough.) */
  private hasEmojis(ctx: GameContext): boolean {
    return ctx.emoji('wxa') !== undefined;
  }

  /**
   * FULL grid (all guesses made), each letter a colored emoji-tile — the
   * true Wordle look, and it works on MOBILE (ANSI has no color there). Returns
   * null if any tile is missing (e.g. letter outside a–z) so the caller falls back to ANSI.
   */
  private renderGridEmoji(ctx: GameContext): string | null {
    const lines: string[] = [];
    for (const r of this.rows) {
      let line = '';
      for (let i = 0; i < r.states.length; i++) {
        const e = ctx.emoji(`w${r.states[i]}${r.letters[i].toLowerCase()}`);
        if (!e) return null;
        line += e;
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  /** Full grid in ANSI (fallback without tiles): colored cells in a code block. */
  private renderGridAnsi(): string {
    const rows = this.rows.map((r) =>
      [...r.letters.toUpperCase()]
        .map((ch, i) => `${ESC}[${SGR[r.states[i]]}m ${ch} ${ESC}[0m`)
        .join(''),
    );
    return '```ansi\n' + rows.join('\n') + '\n```';
  }

  private renderGrid(ctx: GameContext): string {
    return (this.hasEmojis(ctx) ? this.renderGridEmoji(ctx) : null) ?? this.renderGridAnsi();
  }

  /** Records this guess's letters: in the word (present) or ruled out (absent). */
  private trackLetters(guess: string): void {
    for (const l of new Set(guess)) {
      if (this.target.includes(l)) this.present.add(l);
      else this.absent.add(l);
    }
  }

  /**
   * Status "keyboard" under the guess: letters ALREADY IN the word (green) and
   * RULED-OUT letters (struck through). Empty line ('') while nothing is known. Sorted.
   */
  private keyboard(ctx: GameContext): string {
    const up = (set: Set<string>): string =>
      [...set]
        .sort()
        .map((c) => c.toUpperCase())
        .join(' ');
    const parts: string[] = [];
    if (this.present.size) parts.push(ctx.t('game.wordle.inWord', { letters: up(this.present) }));
    if (this.absent.size) parts.push(ctx.t('game.wordle.out', { letters: up(this.absent) }));
    return parts.length ? '\n' + parts.join('   ') : '';
  }

  onMessage(ctx: GameContext, msg: GameMessage): void {
    if (this.over) return;
    const g = normalizeAnswer(msg.content).replace(/[^a-zà-ſ]/g, '');
    if (g.length !== 5) return; // only 5-letter guesses count
    this.armIdle(ctx);
    this.guesses++;
    this.rows.push({ letters: g, states: this.computeStates(g) });
    this.trackLetters(g);
    const grid = this.renderGrid(ctx);
    if (g === this.target) {
      this.over = true;
      ctx.award(msg.authorId, 1);
      void ctx.send(
        `${grid}\n${ctx.t('game.wordle.win', { user: msg.authorName, word: this.target.toUpperCase(), n: this.guesses })}`,
      );
      announceWinner(ctx, msg.authorName);
      ctx.end();
      return;
    }
    if (this.guesses >= MAX_GUESSES) {
      this.over = true;
      void ctx.send(`${grid}\n${ctx.t('game.wordle.lose', { word: this.target.toUpperCase() })}`);
      ctx.end();
      return;
    }
    void ctx.send(
      `${grid}\n${ctx.t('game.wordle.guess', { user: msg.authorName, left: MAX_GUESSES - this.guesses })}${this.keyboard(ctx)}`,
    );
  }
}

export const wordleDef: GameDefinition = {
  id: 'wordle',
  nameKey: 'game.wordle.name',
  descKey: 'game.wordle.desc',
  needsVoice: false,
  premium: true, // 💎 Premium (user's own Plus OR server Premium) — gated in handleGame
  create: () => new WordleGame(),
};
