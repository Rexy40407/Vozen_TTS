// src/commands/voteUpsell.ts
//
// Invitation to VOTE as a Plus upsell (growth loop). A localized line that offers
// 48h of free Plus for a first vote claim on top.gg — attached at the moments when an eligible FREE user
// is already being upsold (serverstats, pronunciation limit, /premium). It is NOT a
// new gate nor a DM: it only enriches responses that already exist. Without a configured
// clientId it returns null (the link would be broken, top.gg/bot//vote) and the caller attaches nothing.
import { t } from '../i18n/index';

/** URL of the top.gg vote page (the clientId is the bot's id in the listing, = /invite). */
function voteUrl(clientId: string): string {
  return `https://top.gg/bot/${clientId}/vote`;
}

/** Invitation line to vote → one-time 48h of free Plus (or null without clientId). */
export function voteUpsellLine(locale: string, clientId: string | undefined): string | null {
  if (!clientId) return null;
  return t('vote.upsell', locale, { url: voteUrl(clientId) });
}
