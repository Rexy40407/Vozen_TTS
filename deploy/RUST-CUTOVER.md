# Rust runtime cutover

The Node `vozen.service` remains the rollback target until the Rust runtime passes the
staging checks and the agreed soak. Never run both processes with the same Discord token.

## Preflight

```bash
sudo cp -a /etc/systemd/system/vozen.service /home/vozen/vozen-rust/shared/vozen-node.service
sudo install -m 0644 /home/vozen/vozen-rust/current/deploy/vozen-rust.service /etc/systemd/system/vozen.service
sudo systemctl daemon-reload
sudo systemctl stop vozen.service
sudo systemctl start vozen.service
systemctl is-active vozen.service
curl --fail http://127.0.0.1:3001/health
```

The Rust environment must contain the existing `DISCORD_TOKEN`, `CLIENT_ID`, and database path,
plus a long random `VOZEN_ENTITLEMENTS_SERVICE_SECRET`. Keep that same secret in the Helper
shared environment as `VOZEN_ENTITLEMENT_SECRET`; the Helper URL is the loopback endpoint
(`http://127.0.0.1:3001/internal/v1/entitlements/resolve`) unless a private network endpoint is
provisioned.

The entitlement read path can be staged independently of the Discord gateway with
`vozen-entitlementd.service`. It reads the same SQLite database in WAL mode and listens on
`VOZEN_ENTITLEMENT_BIND_ADDR` (default `127.0.0.1:3011`), exposing only the signed resolve route.
Set `VOZEN_ENTITLEMENTS_DATABASE_PATH=/home/vozen/discord-bot-Vozen/tts.db`, configure the same
random secret in both services, and point the Helper at
`http://127.0.0.1:3011/internal/v1/entitlements/resolve`. This daemon is read-only at the HTTP
boundary and does not open a Discord gateway, so it can run while the Node gateway remains the
rollback target.

## Rollback

```bash
sudo systemctl stop vozen.service
sudo install -m 0644 /home/vozen/vozen-rust/shared/vozen-node.service /etc/systemd/system/vozen.service
sudo systemctl daemon-reload
sudo systemctl start vozen.service
```

The Node unit must be backed up before replacing it; restoring the original unit is mandatory
if Discord readiness, API health, memory, or command parity gates fail.
