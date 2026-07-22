import { Chess } from 'chess.js';
import type { Game, GameContext, GameDefinition, GameMessage } from './types';
import { announceWinner } from './finish';

const IDLE_MS = 300_000; // 5 min — chess is thought through more slowly than Tic-Tac-Toe (180s)

/** Loose move (SAN "e4"/"Nf3"/"O-O") or by-coordinates ("e2e4", with optional promotion "e7e8q"). */
const RE_COORD = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;
const RE_SAN = /^(o-o-o|o-o|[kqrbn]?[a-h]?[1-8]?x?[a-h][1-8](=[qrbn])?)[+#]?$/i;
const RE_RESIGN = /^(resign|resigns|i resign|desisto|desistir)$/i;

/** Board letter: uppercase = white, lowercase = black; dot = empty square. */
function pieceLetter(p: { type: string; color: 'w' | 'b' } | null): string {
  if (!p) return '.';
  return p.color === 'w' ? p.type.toUpperCase() : p.type;
}

/**
 * Chess — 2 players: the FIRST 2 to attempt a move take white/black (white starts, as in
 * Tic-Tac-Toe). You play by typing the move in algebraic notation ("e4", "Nf3", "O-O") or
 * by-coordinates ("e2e4"); "resign"/"desisto" resigns. All legality (check, checkmate, draw,
 * castling, en passant, promotion) is validated by chess.js — we do not reinvent chess rules
 * here. 💎 Premium.
 */
class ChessGame implements Game {
  readonly id = 'chess';
  private readonly chess = new Chess();
  private whiteId?: string;
  private blackId?: string;
  private readonly names: Record<string, string> = {};
  private over = false;
  private moves = 0;

  async start(ctx: GameContext): Promise<void> {
    await this.sendBoard(ctx, this.render(ctx), ctx.t('game.chess.intro'), true);
    this.armIdle(ctx);
  }

  private armIdle(ctx: GameContext): void {
    const at = ++this.moves;
    ctx.after(IDLE_MS, () => {
      if (at === this.moves && !this.over) {
        this.over = true;
        void ctx.send(ctx.t('game.chess.idle'));
        ctx.end();
      }
    });
  }

  /** Seat color of `uid`, or null if it does not have one yet (spectator or unassigned). */
  private colorOf(uid: string): 'w' | 'b' | null {
    if (this.whiteId === uid) return 'w';
    if (this.blackId === uid) return 'b';
    return null;
  }

  onMessage(ctx: GameContext, msg: GameMessage): void {
    if (this.over) return;
    const content = msg.content.trim();
    const isResign = RE_RESIGN.test(content);
    const looksLikeMove = isResign || RE_COORD.test(content) || RE_SAN.test(content);
    if (!looksLikeMove) return; // normal chat in the channel -> ignore, it is not a move

    // Resign concedes to the OPPONENT, so it only makes sense from a player who is already
    // seated in a game that has both seats filled. Crucially it must NOT itself seat anyone:
    // otherwise typing "resign" as the very first message takes White and then ends the game
    // with no opponent to award and no announcement (silent teardown). Handle it before seat
    // assignment and ignore it until there is a real game to concede.
    if (isResign) {
      const seat = this.colorOf(msg.authorId);
      if (!seat || !this.whiteId || !this.blackId) return;
      this.over = true;
      const winnerId = seat === 'w' ? this.blackId : this.whiteId;
      ctx.award(winnerId, 3);
      void ctx.send(
        ctx.t('game.chess.resigned', { user: msg.authorName, winner: this.names[winnerId] }),
      );
      announceWinner(ctx, this.names[winnerId]);
      ctx.end();
      return;
    }

    this.names[msg.authorId] = msg.authorName;

    // Seat assignment: 1st to try -> white; 2nd DISTINCT -> black; the rest = spectator.
    let color = this.colorOf(msg.authorId);
    if (!color) {
      if (!this.whiteId) {
        this.whiteId = msg.authorId;
        color = 'w';
      } else if (!this.blackId && msg.authorId !== this.whiteId) {
        this.blackId = msg.authorId;
        color = 'b';
      } else {
        return; // seats full -> spectator, ignore
      }
    }

    if (color !== this.chess.turn()) {
      void ctx.send(
        ctx.t('game.chess.notYourTurn', {
          user: msg.authorName,
          color: this.colorName(ctx, this.chess.turn()),
        }),
      );
      return;
    }

    let result: ReturnType<Chess['move']>;
    try {
      result = this.chess.move(content, { strict: false });
    } catch {
      void ctx.send(ctx.t('game.chess.illegalMove', { move: content }));
      return;
    }

    this.armIdle(ctx);

    if (this.chess.isCheckmate()) {
      this.over = true;
      const winnerId = color === 'w' ? this.whiteId! : this.blackId!;
      ctx.award(winnerId, 3);
      void this.sendBoard(
        ctx,
        this.render(ctx),
        ctx.t('game.chess.checkmate', { move: result.san, user: this.names[winnerId] }),
        true,
      );
      announceWinner(ctx, this.names[winnerId]);
      ctx.end();
      return;
    }
    if (this.chess.isDraw()) {
      this.over = true;
      if (this.whiteId) ctx.award(this.whiteId, 1);
      if (this.blackId) ctx.award(this.blackId, 1);
      void this.sendBoard(
        ctx,
        this.render(ctx),
        ctx.t('game.chess.draw', { move: result.san }),
        true,
      );
      ctx.end();
      return;
    }

    const nextColor = this.chess.turn();
    const checkNote = this.chess.inCheck() ? ` ${ctx.t('game.chess.check')}` : '';
    const turnNote = `${ctx.t('game.chess.turn', {
      move: result.san,
      color: this.colorName(ctx, nextColor),
    })}${checkNote}`;
    void this.sendBoard(ctx, this.render(ctx), turnNote, false);
  }

  private colorName(ctx: GameContext, color: 'w' | 'b'): string {
    return color === 'w' ? ctx.t('game.chess.white') : ctx.t('game.chess.black');
  }

  /** Are the board emojis loaded? (it is enough for the light empty square to exist.) */
  private hasEmojis(ctx: GameContext): boolean {
    return ctx.emoji('el') !== undefined;
  }

  private render(ctx: GameContext): string {
    const seats = ctx.t('game.chess.seats', {
      white: this.whiteId ? this.names[this.whiteId] : '?',
      black: this.blackId ? this.names[this.blackId] : '?',
    });
    const board = this.hasEmojis(ctx) ? this.renderEmoji(ctx) : this.renderAscii();
    return `${seats}\n${board}`;
  }

  /** Board in emojis: cburnett piece over a light/dark square; file letters on top
   *  (tiles-emoji fa..fh — NOT regional indicators, which combine into flags),
   *  rank numbers on the right. */
  private renderEmoji(ctx: GameContext): string {
    const b = this.chess.board();
    // A–H labels as their own tiles-emoji (they align with the columns and never turn into flags).
    const fileRow = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      .map((f) => ctx.emoji(`f${f}`) ?? '')
      .join('');
    const lines: string[] = [fileRow];
    for (let r = 0; r < 8; r++) {
      let row = '';
      for (let f = 0; f < 8; f++) {
        const sq = (r + f) % 2 === 0 ? 'l' : 'd'; // a8 (r0,f0) is a LIGHT square
        const p = b[r][f];
        const name = p ? `${p.color}${p.type}${sq}` : `e${sq}`;
        row += ctx.emoji(name) ?? '';
      }
      lines.push(`${row} ${8 - r}`); // rank number on the right (plain text, no need to align)
    }
    return lines.join('\n');
  }

  /** ASCII fallback (no emojis installed): letters in a code block, as before. */
  private renderAscii(): string {
    const board = this.chess.board();
    const files = 'abcdefgh';
    const lines: string[] = [`  ${files.split('').join(' ')}`];
    for (let rank = 0; rank < 8; rank++) {
      const rankLabel = 8 - rank;
      const row = board[rank].map((p) => pieceLetter(p)).join(' ');
      lines.push(`${rankLabel} ${row} ${rankLabel}`);
    }
    lines.push(`  ${files.split('').join(' ')}`);
    return `\`\`\`\n${lines.join('\n')}\n\`\`\``;
  }

  /**
   * Sends the board + a note (intro/move/end). In emojis the board is ~1700 chars; if the
   * combination exceeds Discord's practical limit, it splits into 2 messages. `noteFirst` =
   * the note comes before the board (intro, checkmate) or after (move).
   */
  private async sendBoard(
    ctx: GameContext,
    board: string,
    note: string,
    noteFirst: boolean,
  ): Promise<void> {
    const combined = noteFirst ? `${note}\n${board}` : `${board}\n${note}`;
    if (combined.length <= 1990) {
      await ctx.send(combined);
      return;
    }
    if (noteFirst) {
      await ctx.send(note);
      await ctx.send(board);
    } else {
      await ctx.send(board);
      await ctx.send(note);
    }
  }
}

export const chessDef: GameDefinition = {
  id: 'chess',
  nameKey: 'game.chess.name',
  descKey: 'game.chess.desc',
  needsVoice: false,
  premium: true,
  create: () => new ChessGame(),
};
