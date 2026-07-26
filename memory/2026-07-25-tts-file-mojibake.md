# TTS file Portuguese mojibake — 2026-07-25

## Symptom

Rust `/tts-file` responses displayed Portuguese accents as `Ã¡`, `Ã£`, `Ã§`, and similar sequences.

## Root cause

The authoritative TypeScript catalog contained already-corrupted UTF-8 text for the four `ttsFile.*` Portuguese keys. The Rust voice-response contract generator copied those literals into `contracts/voice-response-i18n.json`, so Rust rendered the corruption faithfully.

## Evidence

- `src/i18n/catalog.ts` contained values such as `O teu ficheiro de Ã¡udio ...`.
- The generated contract contained the same mojibake under `messages.pt`.
- Rust `VoiceResponseLocalizer` embeds that generated contract at compile time.

## Fix

- Restored the four Portuguese catalog values with real Unicode accents.
- Regenerated `contracts/voice-response-i18n.json`.
- Added a regression test asserting the exact ready message and rejecting `Ã` in the Portuguese catalog values.

## Verification

- `npm run check:rust-voice-i18n` passed.
- Focused TypeScript contract test passed (2 tests).
- Focused Rust voice localization tests passed (4 tests).
- Rust staging image rebuilt and `vozen-staging-vozen-1` is healthy with the corrected contract.

## Status

Awaiting manual Discord confirmation with `/tts-file`.
