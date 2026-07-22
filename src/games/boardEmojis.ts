// src/games/boardEmojis.ts
//
// Loads the chess board's APPLICATION EMOJIS (26: 12 pieces × 2 square colors
// + 2 empty squares) once at startup, so the chess render draws real pieces
// instead of ASCII letters. App emojis work on ANY server without Nitro or guild
// slots. Best-effort: if the fetch fails (or the emoji setup hasn't run), the
// map stays empty and the game falls back to the ASCII board — it never crashes.
//
// Upload the assets with: node tools/upload-chess-emojis.mjs

import type { Client } from 'discord.js';
import { log } from '../logging/logger';

/**
 * The 34 expected names: {color}{type}{square} (e.g. wpl, bkd) + empty squares (el, ed) +
 * file labels fa..fh (letters A–H as tiles, so we don't depend on regional
 * indicators — those combine into FLAGS in pairs, e.g. 🇨🇩=Congo, 🇬🇭=Ghana).
 */
export const CHESS_EMOJI_NAMES: readonly string[] = (() => {
  const names: string[] = ['el', 'ed'];
  for (const color of ['w', 'b']) {
    for (const type of ['p', 'n', 'b', 'r', 'q', 'k']) {
      for (const sq of ['l', 'd']) names.push(`${color}${type}${sq}`);
    }
  }
  for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) names.push(`f${file}`);
  return names;
})();

/**
 * Fills `target` (by reference) with name->markup (`<:wpl:123>`) of ALL the bot's
 * application emojis (chess tiles, wordle, …). Call once on ClientReady (when
 * `client.application` is already populated). Best-effort: failure => map stays as-is and
 * the games fall back to text/ASCII rendering. Loads everything (we only have our own
 * tiles), so adding new tile groups doesn't require touching this.
 */
export async function loadBoardEmojis(
  client: Client,
  target: Record<string, string>,
): Promise<void> {
  try {
    if (!client.application) return;
    const coll = await client.application.emojis.fetch();
    let n = 0;
    for (const e of coll.values()) {
      if (e.name) {
        target[e.name] = e.toString();
        n++;
      }
    }
    const chess = CHESS_EMOJI_NAMES.filter((name) => target[name]).length;
    log.info(
      `[emojis] ${n} tiles loaded (chess ${chess}/${CHESS_EMOJI_NAMES.length})${n === 0 ? '; using ASCII' : ''}`,
    );
  } catch (err) {
    log.warn('[emojis] failed to load tiles; games will use ASCII', err);
  }
}
