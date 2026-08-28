#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${VOZEN_DEPLOY_DIR:-/home/vozen/vozen-rust-prod}"
COMPOSE_PROJECT="${VOZEN_COMPOSE_PROJECT:-vozen-prod}"
COMPOSE_FILE="${VOZEN_COMPOSE_FILE:-docker-compose.rust.prod.yml}"
SERVICE="${VOZEN_COMPOSE_SERVICE:-vozen}"
CONTAINER="${COMPOSE_PROJECT}-${SERVICE}-1"
HEALTH_URL="${VOZEN_HEALTH_URL:-http://127.0.0.1:3001/health}"
BACKUP_DIR="${VOZEN_BACKUP_DIR:-/home/vozen/vozen-backups}"
DATABASE="${VOZEN_DATABASE:-rust-data/tts.db}"
ROLLBACK_IMAGE="${VOZEN_ROLLBACK_IMAGE:-vozen-rust:rollback}"
PREBUILT_IMAGE="${VOZEN_PREBUILT_IMAGE:-}"
EXPECTED_IMAGE_REVISION="${VOZEN_EXPECTED_IMAGE_REVISION:-}"
DEPLOY_STATE_DIR="${VOZEN_DEPLOY_STATE_DIR:-}"

cd "$DEPLOY_DIR"

if systemctl is-active --quiet vozen.service; then
  echo "Refusing deploy: legacy vozen.service is active." >&2
  exit 1
fi

if [ ! -f .env.rust.prod ]; then
  echo "Refusing deploy: .env.rust.prod is missing." >&2
  exit 1
fi

if [ ! -f "$DATABASE" ]; then
  echo "Refusing deploy: production database is missing at $DATABASE." >&2
  exit 1
fi

previous_image=""
if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  previous_image="$(docker container inspect --format '{{.Image}}' "$CONTAINER")"
  docker image tag "$previous_image" "$ROLLBACK_IMAGE"
fi

# CI can construct a small, label-verified runtime layer on top of the current
# healthy image. Rebuilding it here would need to unpack the Python/model layers
# a second time and can exhaust a constrained VPS disk. Direct/manual deploys
# still build normally when no prebuilt image was supplied.
if [ -n "$PREBUILT_IMAGE" ]; then
  [[ "$PREBUILT_IMAGE" =~ ^vozen-rust:[0-9a-f]{40}$ ]] || {
    echo "Refusing deploy: invalid prebuilt image reference." >&2
    exit 1
  }
  docker image inspect "$PREBUILT_IMAGE" >/dev/null
  if [ -n "$EXPECTED_IMAGE_REVISION" ]; then
    [[ "$EXPECTED_IMAGE_REVISION" =~ ^[0-9a-f]{40}$ ]] || {
      echo "Refusing deploy: invalid expected image revision." >&2
      exit 1
    }
    image_revision="$(docker image inspect \
      --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
      "$PREBUILT_IMAGE")"
    [ "$image_revision" = "$EXPECTED_IMAGE_REVISION" ] || {
      echo "Refusing deploy: prebuilt image revision does not match the CI-tested commit." >&2
      exit 1
    }
  fi
  docker image tag "$PREBUILT_IMAGE" vozen-rust:prod
  compose_build_mode="--no-build"
else
  # Build while the current container remains online. Downtime starts only at
  # the force-recreate below.
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" build "$SERVICE"
  compose_build_mode=""
fi

# SQLite's online backup API includes committed WAL data without stopping the bot.
python3 scripts/backup-rust-db.py \
  --source "$DATABASE" \
  --destination-dir "$BACKUP_DIR"

if [ "$compose_build_mode" = "--no-build" ]; then
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" \
    up -d --force-recreate --no-build "$SERVICE"
else
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" \
    up -d --force-recreate "$SERVICE"
fi

healthy=false
for _attempt in $(seq 1 48); do
  container_health="$(
    docker container inspect \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' \
      "$CONTAINER" 2>/dev/null || true
  )"
  if [ "$container_health" = "healthy" ] \
    && curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" >/dev/null \
    && docker logs "$CONTAINER" 2>&1 | grep -q "healthy: Ready"; then
    healthy=true
    break
  fi
  sleep 5
done

if [ "$healthy" != "true" ]; then
  echo "New Rust container did not become healthy; collecting logs." >&2
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" logs \
    --tail 200 "$SERVICE" >&2 || true

  if [ -n "$previous_image" ]; then
    echo "Rolling back to the previous Rust image." >&2
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" stop "$SERVICE" || true
    docker image tag "$ROLLBACK_IMAGE" vozen-rust:prod
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" \
      up -d --force-recreate --no-build "$SERVICE"
  fi
  exit 1
fi

python3 - "$DATABASE" <<'PY'
import sqlite3
import sys

database = sys.argv[1]
with sqlite3.connect(f"file:{database}?mode=ro", uri=True, timeout=30) as connection:
    integrity = connection.execute("PRAGMA integrity_check").fetchone()
    foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
if integrity is None or integrity[0] != "ok" or foreign_keys:
    raise SystemExit(
        f"post-deploy database verification failed: integrity={integrity}, "
        f"foreign_key_errors={len(foreign_keys)}"
    )
print("Post-deploy database verification: ok")
PY

# The immutable image label remains the primary release identity. Keep a private
# host-side copy only after the candidate is healthy and its SQLite data passes
# integrity checks, so a later Docker metadata cleanup can still be diagnosed
# without inventing a source revision.
if [ -n "$EXPECTED_IMAGE_REVISION" ] && [ -n "$DEPLOY_STATE_DIR" ]; then
  install -d -m 700 "$DEPLOY_STATE_DIR"
  state_file="$DEPLOY_STATE_DIR/deployed-sha"
  state_tmp="$DEPLOY_STATE_DIR/.deployed-sha.$$"
  umask 077
  printf '%s\n' "$EXPECTED_IMAGE_REVISION" > "$state_tmp"
  mv "$state_tmp" "$state_file"
fi

docker image rm "$ROLLBACK_IMAGE" >/dev/null 2>&1 || true
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps "$SERVICE"
curl --fail --silent --show-error --max-time 5 "$HEALTH_URL"
echo
