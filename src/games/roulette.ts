import type { Game, GameContext, GameDefinition } from './types';
import { pickPrompts } from './content/roulettePrompts';
import { seededIndex } from './util';

/**
 * "Roulette" (Truth or Dare) — Vozen reads ONE random challenge out loud and
 * posts it in the channel. ONE-shot game: no scoring, no rounds or timers — it opens
 * and closes right away (so it releases the lock immediately). Run it again for another
 * challenge. onMessage is never called (the match ends in start).
 */
class RouletteGame implements Game {
  readonly id = 'roulette';

  async start(ctx: GameContext): Promise<void> {
    const prompts = pickPrompts(ctx.locale);
    const prompt = prompts[seededIndex(ctx.seed, prompts.length)];
    await ctx.send(`${ctx.t('game.roulette.header')}\n> ${prompt}`);
    await ctx.say(prompt);
    ctx.end();
  }

  onMessage(): void {
    /* one-shot: the match already ended in start */
  }
}

export const rouletteDef: GameDefinition = {
  id: 'roulette',
  nameKey: 'game.roulette.name',
  descKey: 'game.roulette.desc',
  needsVoice: true,
  create: () => new RouletteGame(),
};
