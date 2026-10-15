# Cloudflare API proxy operations

This is an operator-only renderer and runbook, not a bot startup migration.
It does not load Caddy configuration, change DNS, restart services or delete data.

## Preserve the effective configuration

Read the running Caddy admin API configuration through an authorized local connection.
Compare it with disk configuration before any reload: a stale Caddyfile may omit
routes installed through the API. Save a private, access-restricted backup of the
effective configuration. Never commit effective configs, archives, credentials,
databases or account exports to this public repository.

Fetch and review the complete official network lists from
[Cloudflare IPv4](https://www.cloudflare.com/ips-v4) and
[Cloudflare IPv6](https://www.cloudflare.com/ips-v6), saving their CIDRs as a JSON array.
Generate a NEW candidate file with:

```sh
python3 deploy/cloudflare/api_proxy.py LIVE.json CF-RANGES.json CANDIDATE.json
caddy validate --config CANDIDATE.json
```

Compare the candidate against the backup. Only reverse-proxy handlers in routes
exclusively matching `api.vozen.org` should change; preserve other hosts, upstreams,
path rewrites, TLS and server-wide trust settings. Test in isolation first.

Direct peers use their socket IP. Only a peer inside the reviewed Cloudflare CIDRs
with a CF-Connecting-IP header may supply the normalized upstream client address.
Forward X-Forwarded-For, X-Real-IP and CF-Connecting-IP consistently and remove
Forwarded. Do not replace this with unconditional trust in incoming headers.

After operator approval, gracefully load the validated candidate. Verify that the
effective and autosaved configurations match. If the service uses API-managed
routes, ensure startup resumes that autosaved configuration and reload does not
replace it with an obsolete Caddyfile. Review the actual systemd service paths;
do not install a host-specific override blindly.

## Edge protections and checks

Only after origin validation, change the existing API DNS record to Proxied,
preserving its origin address and TTL. Preserve existing WAF rules; do not replace
the entire ruleset. The reviewed baseline adds narrowly scoped blocks for root
`.env`, `.git`, `.svn`, `.hg`, unused WordPress/phpMyAdmin probes and TRACE/CONNECT
on the website/API hosts. Admin login burst limiting is scoped to the exact API
host and `/api/admin/login` path (20 requests/10 seconds, 10-second mitigation).
Verify current plan entitlements before configuring those values.

Keep payment webhooks outside custom login rate limits and interactive challenges.
Do not enable global Bot Fight Mode without reviewing API compatibility:
[Cloudflare limitations](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/).
Proxying alone does not block direct origin access or enable Full (strict) TLS.

Verify public health/status, Helper routes, unauthenticated authorization failures,
CORS credentials/origin and no-store headers. Use unsigned synthetic webhook probes
to verify transport rejection, not real payments. Any burst test should be bounded,
credential-free and followed by a cooldown check. Do not claim audible Discord TTS
or authenticated checkout success from HTTP health alone.

Run regression tests with:

```sh
python3 -m unittest discover -s deploy/cloudflare -p 'test_api_proxy.py' -v
```

For rollback, first restore the API's prior proxy state if edge transport is broken.
Validate the captured effective configuration and check for intervening changes
before reloading it. Never roll back unrelated routes, working databases or runtime
images as part of a Caddy-only change.

## Disk capacity

Before a release, recheck free space, active image, latest rollback, encrypted data
guard and consistent database backup. Do not delete important data to pass a gate.
Old restore-verification copies are removable only after confirming identical
preserved originals, absence of open users/nonempty WALs, a verified private
recovery archive, and post-cleanup hashes. Keep private cleanup manifests and
archives outside Git. Do not automate a general prune from this runbook.
