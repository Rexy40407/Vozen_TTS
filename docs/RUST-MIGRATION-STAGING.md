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

Copy `.env.rust.staging.example` to `.env.rust.staging`, fill in the staging application's
`DISCORD_TOKEN`, `CLIENT_ID` and test-guild IDs, and keep the copy uncommitted. The example is
deliberately shadow-only and does not contain a credential:

```powershell
Copy-Item .env.rust.staging.example .env.rust.staging
# edit DISCORD_TOKEN, CLIENT_ID, RUST_COMMANDS_GUILD_ID and OWNER_GUILD_ID locally
$env:RUST_ENV_FILE = (Resolve-Path .env.rust.staging).Path
npm run rust:staging:preflight
Remove-Item Env:RUST_ENV_FILE
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

`rust:staging:preflight` is read-only. When `RUST_ENV_FILE` is set, it loads that dotenv file
without overriding variables already exported by the shell. It checks the bot identity, staging guild and guild
command set against `contracts/discord-commands.json`, and reports the global command count for
awareness. It never calls a Discord PUT route and never prints the token or Discord response
bodies. Run it with `DISCORD_TOKEN`, `CLIENT_ID`, `RUST_COMMANDS_GUILD_ID` and `OWNER_GUILD_ID`
set in an uncommitted environment file. If the owner guild differs from the staging guild, the
preflight also checks that guild and its owner-only command set.

`RUST_ENV_FILE` is read by the preflight process only; it does not mutate the parent PowerShell
environment. For the direct `cargo run` smoke command above, either export the same variables in
the current shell or use the Docker Compose path, whose `env_file` loads them for the container.
Do not pass the production `.env` to a staging run.

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

## Abort and rollback

Abort the staging run immediately if the Rust process creates a second gateway session, a
command is registered outside the disposable guild, SQLite integrity is not `ok`, a voice
message is spoken by the wrong user/call, or a critical error repeats. Do not try to repair the
database while either runtime is still running.

### Staging rollback

The staging project has its own named volume and can be stopped without touching production:

```bash
RUST_ENV_FILE=.env.rust.staging docker compose -p vozen-staging \
  -f docker-compose.yml -f docker-compose.rust.yml down --remove-orphans
```

Do not add `-v`: the SQLite copy and its WAL/SHM files must remain available for inspection. If
the staging database is needed again, restart the known-good Node image with the same staging
environment and the base compose file, never with the production token.

### Production cutover rollback

The production rollback is a process switch, not a live database migration:

1. Stop Rust and verify that its process/container is gone before starting anything else.
2. Preserve the Rust logs and make a fresh copy of `tts.db`, `tts.db-wal` and `tts.db-shm` while
   the database is stopped. Keep the pre-cutover verified backup unchanged.
3. Restore the Node compose/service definition and start Node with the production `.env`; leave
   `RUST_RUNTIME_MODE=shadow` or unset and do not enable any Rust canary flags.
4. Verify one gateway `READY`, `/health`, `/uptime`, `/join` and a non-mutating `/config show`
   before allowing normal traffic. Confirm that no second process owns the production token.
5. If `PRAGMA integrity_check` or `PRAGMA foreign_key_check` fails, stop and restore the verified
   backup with every SQLite sidecar file together. Do not let Node open a suspect copy.

Never run Node and Rust concurrently with the same Discord token, and never delete the data
volume as part of rollback. A failed rollback remains an incident requiring the preserved logs,
database copies and an explicit operator decision; it is not a reason to keep retrying the
cutover automatically.
