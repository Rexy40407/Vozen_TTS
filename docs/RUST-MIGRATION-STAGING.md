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
RUST_COMMANDS_GUILD_ID=<staging-guild-id>
OWNER_GUILD_ID=<staging-guild-id>
RUST_COMMANDS_STATE_PATH=./.staging/commands-state-rust.json
```

`RUST_COMMANDS_GUILD_ID` makes the public command PUT guild-scoped instead of global. When the
owner guild is the same guild, Rust sends one merged PUT containing the public and owner commands;
Discord replaces a guild's complete command list, so two separate PUTs would otherwise erase the
first list. Leaving the variable empty is the production global-registration path.

## Preflight and smoke sequence

```powershell
$env:Path = 'C:\Users\diogo\.cargo\bin;' + $env:Path
cargo test -p vozen-discord command_registration --lib
cargo build --release -p vozen-runtime
cargo run --release -p vozen-runtime
```

With the staging bot online, verify in the test guild:

1. The slash-command list appears in the staging guild and no production guild receives a command
   update.
2. The gateway becomes ready and `/uptime` responds when its canary is enabled.
3. A restart leaves the guild command list intact and does not create a second gateway session.
4. Invalid or missing staging identifiers fail before any REST registration request.

Only after these checks, the voice-driver build, API contract checks and the remaining R5 module
canaries pass may the private cutover gate be considered. This document does not authorize a
production deployment or a push.
