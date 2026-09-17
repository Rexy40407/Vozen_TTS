# Randomizer voice selection and voice-channel chat

Base: `efb36fa`, isolated checkout `vozen-task`, 2026-09-17.

## Changes

- `/randomizer` requires language and engine, with language autocomplete and the same Google/Piper/Kokoro choices as the other fun commands. Direct CSV and modal sessions retain both choices. Narration is localized to the selected language. A saved compatible voice is preferred; a different-language default cannot override the selection. Piper does not select synthetic Google models. Kokoro retains its Premium requirement.
- Missing or invalid arguments receive an ephemeral response. Speech failures use the ordinary localized voice outcome instead of always claiming the bot is absent.
- Voice-channel chat reading defaults on for new configurations and legacy databases missing the setting. Existing saved settings are preserved; an existing disabled setting can be enabled with `/config voice-channel-reading active:true`, and disabled with `active:false`.
- Passive reading still requires the author and bot to share the voice channel and respects opt-out and role policy. Auto-join is restricted to the configured setup text channel. `/join` is unchanged.

## Verification

| Check | Result |
| --- | --- |
| Rust formatting | Passed |
| Discord/schema/localization contracts | Passed |
| Postgres replica contract | Passed |
| Site checks | Passed: 61 tests, translations, copy checks, site build |
| Rust unit tests and runtime compilation | Blocked: Windows Application Control error 4551 prevents dependency build scripts from executing, including outside the sandbox |
| Discord command registration and audible playback | Not run; production unchanged |

Added Rust regressions cover mandatory voice selection, CSV/modal selection retention, language/model selection, default-on voice chat, disabling it, same-call admission, opt-out, and setup-only auto-join. These tests have not executed due to the build restriction; they are not claimed as passed.

Before release, run `cargo test -p vozen-discord --lib`, `cargo test -p vozen-store --lib`, and `cargo check -p vozen-runtime` in a working Rust build environment, register the updated command contract, then verify direct and modal randomizer speech and both message channels in an authorized Discord test guild.
