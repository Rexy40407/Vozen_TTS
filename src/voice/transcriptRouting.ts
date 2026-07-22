// src/voice/transcriptRouting.ts
//
// PURE STT routing (Phase 4): from the raw text the Whisper sidecar returns to the message
// that goes to the channel. No IO, no network — testable in isolation. The decision to POST is
// separate from the FORMATTING so the caller can skip empty utterances without building anything.

/** Trims and collapses internal spaces/breaks into a single space. */
export function cleanTranscriptText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Worth posting? Whisper returns "" (or just space) for silence/noise that the
 * vad_filter let through — we don't pollute the channel with that.
 */
export function isTranscribable(raw: string): boolean {
  return cleanTranscriptText(raw).length > 0;
}

/**
 * Neutralizes MASS pings (@everyone/@here) by inserting a zero-width space after the @.
 * Defense in depth: the send should already use allowedMentions:{parse:[]}, but a
 * transcription must never be able to reach everyone even if that config fails.
 */
function defuseMentions(s: string): string {
  return s.replace(/@(everyone|here)/gi, '@​$1');
}

/** Channel message: "**Name:** text". Trims the text and defuses mass pings. */
export function formatTranscript(displayName: string, text: string): string {
  return `**${defuseMentions(displayName)}:** ${defuseMentions(cleanTranscriptText(text))}`;
}
