import type { Game, GameContext, GameDefinition, GameMessage } from './types';
import { announceWinner } from './finish';
import { firstInteger } from './util';

const IDLE_MS = 180_000;
type Mark = 'X' | 'O';
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // columns
  [0, 4, 8],
  [2, 4, 6], // diagonals
];

/**
 * Tic-tac-toe — 2 players: the FIRST 2 to play become X and O (X starts).
 * You play by typing the cell number (1-9). The winner earns 1 point; a draw does
 * not score. TEXT game, board rendered in a code block. Only numbers 1-9 from
 * whoever is in the game, on their turn, count.
 */
class TicTacToeGame implements Game {
  readonly id = 'tictactoe';
  private readonly cells: ('' | Mark)[] = ['', '', '', '', '', '', '', '', ''];
  private xId?: string;
  private oId?: string;
  private readonly names: Record<string, string> = {};
  private turn: Mark = 'X';
  private over = false;
  private moves = 0;

  async start(ctx: GameContext): Promise<void> {
    await ctx.send(`${ctx.t('game.tictactoe.intro')}\n${this.render(ctx)}`);
    this.armIdle(ctx);
  }

  private armIdle(ctx: GameContext): void {
    const at = ++this.moves;
    ctx.after(IDLE_MS, () => {
      if (at === this.moves && !this.over) {
        this.over = true;
        void ctx.send(ctx.t('game.tictactoe.idle'));
        ctx.end();
      }
    });
  }

  private markOf(uid: string): Mark | null {
    if (this.xId === uid) return 'X';
    if (this.oId === uid) return 'O';
    return null;
  }

  onMessage(ctx: GameContext, msg: GameMessage): void {
    if (this.over) return;
    const n = firstInteger(msg.content);
    if (n === null || n < 1 || n > 9) return; // only moves 1-9 count
    this.names[msg.authorId] = msg.authorName;

    // Seat assignment: 1st player -> X; 2nd DISTINCT player -> O; the rest = spectators.
    let mark = this.markOf(msg.authorId);
    if (!mark) {
      if (!this.xId) {
        this.xId = msg.authorId;
        mark = 'X';
      } else if (!this.oId && msg.authorId !== this.xId) {
        this.oId = msg.authorId;
        mark = 'O';
      } else {
        return; // seats full -> spectator, ignore
      }
    }

    if (mark !== this.turn) {
      void ctx.send(ctx.t('game.tictactoe.notYourTurn', { user: msg.authorName, mark: this.turn }));
      return;
    }
    const idx = n - 1;
    if (this.cells[idx] !== '') {
      void ctx.send(ctx.t('game.tictactoe.taken', { cell: n }));
      return;
    }
    this.armIdle(ctx);
    this.cells[idx] = mark;

    const winLine = LINES.find((l) => l.every((i) => this.cells[i] === mark));
    if (winLine) {
      this.over = true;
      const uid = mark === 'X' ? this.xId! : this.oId!;
      ctx.award(uid, 1);
      void ctx.send(
        `${ctx.t('game.tictactoe.win', { user: this.names[uid], mark })}\n${this.render(ctx)}`,
      );
      announceWinner(ctx, this.names[uid]);
      ctx.end();
      return;
    }
    if (this.cells.every((c) => c !== '')) {
      this.over = true;
      void ctx.send(`${ctx.t('game.tictactoe.draw')}\n${this.render(ctx)}`);
      ctx.end();
      return;
    }
    this.turn = mark === 'X' ? 'O' : 'X';
    void ctx.send(`${this.render(ctx)}\n${ctx.t('game.tictactoe.turn', { mark: this.turn })}`);
  }

  private render(ctx: GameContext): string {
    // Emoji tiles (tx/to/t1..t9) when installed; otherwise the usual ASCII grid.
    if (ctx.emoji('t1')) {
      const cell = (i: number): string => {
        const m = this.cells[i];
        const name = m === 'X' ? 'tx' : m === 'O' ? 'to' : `t${i + 1}`;
        return ctx.emoji(name) ?? '';
      };
      const row = (a: number): string => `${cell(a)}${cell(a + 1)}${cell(a + 2)}`;
      return `${row(0)}\n${row(3)}\n${row(6)}`;
    }
    const c = (i: number): string => this.cells[i] || String(i + 1);
    return (
      '```\n' +
      ` ${c(0)} │ ${c(1)} │ ${c(2)}\n` +
      '───┼───┼───\n' +
      ` ${c(3)} │ ${c(4)} │ ${c(5)}\n` +
      '───┼───┼───\n' +
      ` ${c(6)} │ ${c(7)} │ ${c(8)}\n` +
      '```'
    );
  }
}

export const tictactoeDef: GameDefinition = {
  id: 'tictactoe',
  nameKey: 'game.tictactoe.name',
  descKey: 'game.tictactoe.desc',
  needsVoice: false,
  create: () => new TicTacToeGame(),
};
