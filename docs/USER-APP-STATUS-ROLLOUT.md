# User App and public status rollout

This document is deliberately a **manual, post-approval rollout**. The source
changes in this repository are disabled by default and this document does not
authorize a Developer Portal, DNS, Pages, VPS, Discord OAuth or Top.gg change.

## Before any external change

1. Run `npm run check` and `npm run check:site` from the exact revision to be deployed.
2. Review `commandExposure()` in `src/commands/definitions.ts`. Guild-only commands
   must remain guild-only in the registered JSON, and handler-side Manage Guild,
   same-call and entitlement checks must remain in place.
3. Review `PRIVACY.md`: the status endpoint may expose only coarse component state;
   it must never include Discord IDs, guild/user/message/audio data, quotas, raw errors,
   tokens or provider endpoints.
4. Test on a non-production Discord application first. Do not use production users as
   a User App experiment.

## User App (manual Developer Portal work)

The registered command JSON now carries explicit Guild Install/User Install metadata;
the Developer Portal must still have User Install enabled before Discord distributes it.
Before changing that portal setting, verify the then-current Discord policy and portal UI.

Reviewed User App actions are `/help`, `/invite`, `/vote`, `/uptime`, `/bot-stats`,
`/tts-file`, `/translate text`, `/translate language`, the `Translate` message action,
and the `Transcribe voice message` action. The last four are explicit, ephemeral tools:
they never join a call, scan history, or act on another account. `/tts-file` generates a
private attachment; message transcription accepts only bounded Discord-hosted audio and
uses temporary local files. Other `/translate` subcommands fail closed outside a server.

`/redeem` remains DM-safe but is intentionally Guild-Install-only because it changes a
personal entitlement. Queue, live voice, moderation, server configuration, Premium-pass
and owner commands remain Guild-Install/Guild-context only.

Acceptance checks:

- In a DM/User App context, no candidate can look up a guild, read a guild config,
  join/speak in a voice channel, scan history or access another account.
- `/tts-file` uses only the global defaults and the caller's personal scope; message
  actions receive only the message explicitly selected through Discord.
- In a guild, candidate behavior stays unchanged.
- Attempting a guild-only command from an unsupported context is prevented by Discord
  command registration and still fails safely in the handler if forged.

Rollback: disable User Install/User App capability in the Developer Portal and wait
for Discord command propagation. Do not delete database data as part of rollback.

## Public status (manual proxy/DNS work)

`PUBLIC_STATUS_ENABLED=false` is the default. With it disabled, `/status` is a 404.
With `PUBLIC_STATUS_ENABLED=true`, the **existing loopback-only** health listener can
serve `GET /status`; it does not bind a public address. `HEALTH_PORT` must also be set.

The response is intentionally minimal:

```json
{
  "status": "operational",
  "components": {
    "bot": "operational",
    "database": "operational",
    "providers": "degraded"
  }
}
```

States are only `operational`, `degraded` and `unavailable`. Missing provider health
fails closed to `unavailable`; this is not an uptime monitor, historical dashboard or
service-level agreement. `PUBLIC_STATUS_INCIDENT` is optional, flattened to one line
and capped at 240 characters.

To publish it later, put an authenticated/reviewed reverse proxy in front of the
loopback service, limit methods to `GET`, retain the existing request timeouts and
verify that only `/status` is exposed. A static Pages page may link to that route only
after the proxy URL exists; do not claim a live URL before then.

Acceptance checks:

- `GET /health` remains `{"status":"ok"}`.
- `GET /status` is 404 when disabled, and returns only the documented schema when enabled.
- Stop the gateway, make a database check fail and simulate a degraded provider: each
  produces the relevant coarse state without returning the internal error.
- Load test the proxy route and verify rate limiting/cache policy there; the bot
  listener remains loopback-only and does not promise public availability.

Rollback: remove the reverse-proxy location or set `PUBLIC_STATUS_ENABLED=false`, then
restart through the normal approved deployment procedure. Do not erase operational
aggregate rows merely to roll back a public route.
