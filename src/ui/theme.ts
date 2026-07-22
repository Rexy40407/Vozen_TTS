// src/ui/theme.ts
//
// Vozen's visual theme: brand palette + embed factory. A SINGLE place for the
// colors, so that all surfaces (commands, games, leaderboards) have the same look
// instead of loose hex scattered around. Kept deliberately small.

import { EmbedBuilder } from 'discord.js';

/**
 * Brand palette. `brand` (blurple) was already the intended color of /help and /welcome;
 * the rest follow Discord's official colors (familiar semantics) + Premium's
 * gold. Hex numbers (ColorResolvable) — what EmbedBuilder.setColor expects.
 */
export const COLORS = {
  brand: 0x5865f2, // blurple — primary
  success: 0x57f287, // green
  warning: 0xfee75c, // yellow
  danger: 0xed4245, // red
  premium: 0xf1c40f, // gold — active Premium states
} as const;

export type BrandColor = keyof typeof COLORS;

/**
 * A new embed already with the brand color (or the requested variant). Common base of ALL
 * embed surfaces — changing the color here changes the whole bot.
 */
export function brandEmbed(color: BrandColor = 'brand'): EmbedBuilder {
  return new EmbedBuilder().setColor(COLORS[color]);
}

/** Position label: a medal for the top 3, `#n` for the rest. Used in leaderboards. */
export function rankMedal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
}
