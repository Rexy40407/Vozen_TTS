import type { GameContext } from './types';
import { rankMedal } from '../ui/theme';

/** Local scoreboard of a match: userId -> name + points. */
export type Tally = Map<string, { name: string; points: number }>;

/** Adds `points` (default 1) to `userId` in the local scoreboard, updating the displayed name. */
export function bump(tally: Tally, userId: string, name: string, points = 1): void {
  const entry = tally.get(userId) ?? { name, points: 0 };
  entry.points += points;
  entry.name = name;
  tally.set(userId, entry);
}

/**
 * Vozen ANNOUNCES the winner OUT LOUD (on-brand — it's a voice bot). Best-effort:
 * `ctx.say` is a no-op if the bot is not in a call (board games without voice), so
 * it is safe to call in any game. A short line, only at the END (never per round).
 */
export function announceWinner(ctx: GameContext, name: string): void {
  void ctx.say(ctx.t('game.finish.winnerVoice', { user: name }));
}

/**
 * Sends the shared final summary (game.finish.*) sorted by points desc. Used
 * by the games that do NOT build on QuizGame (Reflexes, Vozen Says). No points ->
 * "nobody scored" message.
 */
export async function sendStandings(ctx: GameContext, tally: Tally): Promise<void> {
  const ranked = [...tally.values()].sort((a, b) => b.points - a.points);
  if (ranked.length === 0) {
    await ctx.send(ctx.t('game.finish.noScores'));
    return;
  }
  const lines = ranked.map((r, i) =>
    ctx.t('game.finish.line', { rank: rankMedal(i + 1), user: r.name, points: r.points }),
  );
  await ctx.send(`${ctx.t('game.finish.title')}\n${lines.join('\n')}`);
  // The 1st on the scoreboard (if they scored) is announced out loud.
  if (ranked[0].points > 0) announceWinner(ctx, ranked[0].name);
}
