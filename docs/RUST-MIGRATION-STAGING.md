# Rust migration staging runbook

This runbook covers the Discord staging gate (R4). It is deliberately separate from the
production VPS and must use a second Discord application, token and test guild.

## Isolation requirements

- Create a staging application in the Discord Developer Portal and invite only that bot to a
  disposable test guild.
- Use the staging application's `CLIENT_ID` and `DISCORD_TOKEN`. Never reuse the production
  token while testing registration or gateway ownership.
- Keep the staging SQLite copy outside the production checkout and restore it from a verified
  backup. Do not point staging at the live database.

## Guild-scoped command registration

Set these values in a local, uncommitted environment file:

```dotenv
RUST_RUNTIME_MODE=shadow
RUST_REGISTER_COMMANDS_ENABLED=true
RUST_AUTOCOMPLETE_ENABLED=true
RUST_COMMANDS_GUILD_ID=<staging-guild-id>
OWNER_GUILD_ID=<staging-guild-id>
RUST_COMMANDS_STATE_PATH=./.staging/commands-state-rust.json
SINGLE_INSTANCE_PORT=59595
```

`RUST_COMMANDS_GUILD_ID` makes the public command PUT guild-scoped instead of global. When the
owner guild is the same guild, Rust sends one merged PUT containing the public and owner commands;
Discord replaces a guild's complete command list, so two separate PUTs would otherwise erase the
first list. Leaving the variable empty is the production global-registration path.

`SINGLE_INSTANCE_PORT` is shared with the Node supervisor. The Rust process binds it on loopback
before opening SQLite or the Discord gateway, so starting Rust while the old Node process is still
alive fails closed instead of creating two sessions with the same token.

`RUST_AUTOCOMPLETE_ENABLED` is a separate interaction canary. Rust only answers autocomplete for
the command leaf whose matching Rust canary is active; Node keeps answering all other suggestions.
Enable it in staging only after checking model, language, locale, game and pronunciation choices.

## Preflight and smoke sequence

```powershell
$env:Path = 'C:\Users\diogo\.cargo\bin;' + $env:Path
npm run rust:staging:preflight
cargo test -p vozen-discord command_registration --lib
cargo build --release -p vozen-runtime --features voice-driver
cargo run --release -p vozen-runtime --features voice-driver
```

`rust:staging:preflight` is read-only. It checks the bot identity, staging guild and guild
command set against `contracts/discord-commands.json`, and reports the global command count for
awareness. It never calls a Discord PUT route and never prints the token or Discord response
bodies. Run it with `DISCORD_TOKEN`, `CLIENT_ID`, `RUST_COMMANDS_GUILD_ID` and `OWNER_GUILD_ID`
set in an uncommitted environment file. If the owner guild differs from the staging guild, the
preflight also checks that guild and its owner-only command set.

With the staging bot online, verify in the test guild:

1. The slash-command list appears in the staging guild and no production guild receives a command
   update.
2. The gateway becomes ready and `/uptime` responds when its canary is enabled.
3. A restart leaves the guild command list intact and does not create a second gateway session.
4. Invalid or missing staging identifiers fail before any REST registration request.

## Optional Linux container smoke

The default `docker compose up` remains the Node runtime. The Rust image is an explicit override
so a normal update cannot silently switch production ownership:

```bash
RUST_ENV_FILE=.env.rust.staging docker compose -p vozen-staging \
  -f docker-compose.yml -f docker-compose.rust.yml build vozen
RUST_ENV_FILE=.env.rust.staging docker compose -p vozen-staging \
  -f docker-compose.yml -f docker-compose.rust.yml run --rm vozen
```

For a real staging run, use `.env.rust.staging` containing a second Discord application/token;
the `vozen-staging` project name creates a separate named SQLite volume. The override keeps the existing
`/data`, `/models` and `/opt/piper` mounts, and the Rust image is built with Songbird's
`voice-driver` feature plus Linux Opus support. Do not point this command at the production
token while Node is running; the shared single-instance lock protects only processes on the same
host and cannot protect two different machines.

Only after these checks, the voice-driver build, API contract checks and the remaining R5 module
canaries pass may the private cutover gate be considered. A control-plane-only build without
`voice-driver` is useful for portable CI, but it is not evidence that live TTS or Songbird works.
This document does not authorize a production deployment or a push.
