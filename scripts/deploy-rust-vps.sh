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
DEPLOY_STATE_DIR="${VOZEN_DEPLOY_STATE_DIR:-/home/vozen/vozen-deploy-state}"
DEPLOY_STATE="$DEPLOY_STATE_DIR/deployed-sha"

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

if [ -L "$DEPLOY_STATE_DIR" ]; then
  echo "Refusing deploy: deployment state directory must not be a symlink." >&2
  exit 1
fi
install -d -m 700 "$DEPLOY_STATE_DIR"
chmod 700 "$DEPLOY_STATE_DIR"

resolve_rollback_source_sha() {
  local candidate="${VOZEN_ROLLBACK_SOURCE_SHA:-}"
  if [ -z "$candidate" ]; then
    candidate="$(
      docker container inspect \
        --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
        "$CONTAINER" 2>/dev/null || true
    )"
    [ "$candidate" = "<no value>" ] && candidate=""
  fi
  if [ -z "$candidate" ] && [ -f "$DEPLOY_STATE" ] && [ ! -L "$DEPLOY_STATE" ]; then
    candidate="$(tr -d '\r\n' < "$DEPLOY_STATE")"
  fi
  if [[ ! "$candidate" =~ ^[0-9a-f]{40}$ ]] \
    || ! git cat-file -e "$candidate^{commit}" \
    || ! git merge-base --is-ancestor "$candidate" HEAD; then
    echo "Refusing deploy: unable to identify a trusted rollback source commit." >&2
    return 1
  fi
  printf '%s\n' "$candidate"
}

build_rollback_from_source() (
  local source_sha="$1"
  local rollback_root rollback_checkout
  if ! rollback_root="$(mktemp -d "${TMPDIR:-/tmp}/vozen-rollback.XXXXXX")"; then
    return 1
  fi
  rollback_checkout="$rollback_root/source"
  cleanup_rollback_worktree() {
    local status=$?
    local cleanup_failed=false
    trap - EXIT INT TERM
    if [ -e "$rollback_checkout" ] \
      && ! git worktree remove --force "$rollback_checkout" >/dev/null 2>&1; then
      cleanup_failed=true
    fi
    if [ -d "$rollback_root" ] && ! rmdir "$rollback_root" >/dev/null 2>&1; then
      cleanup_failed=true
    fi
    if [ "$cleanup_failed" = "true" ]; then
      echo "Refusing deploy: rollback worktree cleanup failed." >&2
      status=1
    fi
    exit "$status"
  }
  trap cleanup_rollback_worktree EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  if ! git worktree add --detach "$rollback_checkout" "$source_sha" >/dev/null; then
    return 1
  fi
  if ! cd "$rollback_checkout"; then
    return 1
  fi
  docker build --build-arg "VOZEN_REVISION=$source_sha" \
    --file Dockerfile.rust --tag "$ROLLBACK_IMAGE" .
)

rollback_available=false
if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  previous_image="$(docker container inspect --format '{{.Image}}' "$CONTAINER")"
  if docker image tag "$previous_image" "$ROLLBACK_IMAGE"; then
    rollback_available=true
  else
    rollback_source_sha="$(resolve_rollback_source_sha)"
    rollback_revision="$(
      docker image inspect \
        --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
        "$ROLLBACK_IMAGE" 2>/dev/null || true
    )"
    if [ "$rollback_revision" = "$rollback_source_sha" ]; then
      echo "Using rollback image verified at trusted source ${rollback_source_sha:0:12}."
    else
      if ! build_rollback_from_source "$rollback_source_sha"; then
        echo "Refusing deploy: unable to rebuild the rollback image from trusted source." >&2
        exit 1
      fi
      echo "Rebuilt rollback image from trusted source ${rollback_source_sha:0:12}."
    fi
    rollback_available=true
  fi
fi

wait_until_healthy() {
  local container_health
  for _attempt in $(seq 1 48); do
    container_health="$(
      docker container inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' \
        "$CONTAINER" 2>/dev/null || true
    )"
    if [ "$container_health" = "healthy" ] \
      && curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" >/dev/null \
      && docker logs "$CONTAINER" 2>&1 | grep -q "healthy: Ready"; then
      return 0
    fi
    sleep 5
  done
  return 1
}

export VOZEN_BUILD_SHA="$(git rev-parse HEAD)"
compose_build_args=()
if [ -n "$PREBUILT_IMAGE" ]; then
  prebuilt_revision="$(
    docker image inspect \
      --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
      "$PREBUILT_IMAGE" 2>/dev/null || true
  )"
  if [ "$prebuilt_revision" != "$VOZEN_BUILD_SHA" ]; then
    echo "Refusing deploy: prebuilt image revision does not match the checked-out commit." >&2
    exit 1
  fi
  previous_prod_image="$(
    docker image inspect --format '{{.Id}}' vozen-rust:prod 2>/dev/null || true
  )"
  rollback_promoted=false
  cleanup_failed_candidate() {
    status=$?
    if [ "$status" -ne 0 ]; then
      if [ "$rollback_promoted" != "true" ]; then
        if [ -n "$previous_prod_image" ]; then
          if ! docker image tag "$previous_prod_image" vozen-rust:prod; then
            echo "Warning: failed to restore the previous production image tag." >&2
          fi
        else
          docker image rm vozen-rust:prod >/dev/null 2>&1 || true
        fi
      fi
      docker image rm "$PREBUILT_IMAGE" >/dev/null 2>&1 || true
    fi
    exit "$status"
  }
  trap cleanup_failed_candidate EXIT
  docker image tag "$PREBUILT_IMAGE" vozen-rust:prod
  compose_build_args=(--no-build)
  echo "Using CI-built production image for ${VOZEN_BUILD_SHA:0:12}."
else
  # Build while the current container remains online. Downtime starts only at the
  # force-recreate below.
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" build "$SERVICE"
fi

# SQLite's online backup API includes committed WAL data without stopping the bot.
python3 scripts/backup-rust-db.py \
  --source "$DATABASE" \
  --destination-dir "$BACKUP_DIR"

docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" \
  up -d --force-recreate "${compose_build_args[@]}" "$SERVICE"

if ! wait_until_healthy; then
  echo "New Rust container did not become healthy; collecting logs." >&2
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" logs \
    --tail 200 "$SERVICE" >&2 || true

  if [ "$rollback_available" = "true" ]; then
    echo "Rolling back to the previous Rust image." >&2
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" stop "$SERVICE" || true
    docker image tag "$ROLLBACK_IMAGE" vozen-rust:prod
    rollback_promoted=true
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" \
      up -d --force-recreate --no-build "$SERVICE"
    if wait_until_healthy; then
      echo "Rollback health verification: ok" >&2
    else
      echo "Rollback container did not become healthy." >&2
    fi
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

deploy_state_tmp="$(mktemp "$DEPLOY_STATE_DIR/deployed-sha.XXXXXX")"
chmod 600 "$deploy_state_tmp"
printf '%s\n' "$VOZEN_BUILD_SHA" > "$deploy_state_tmp"
mv "$deploy_state_tmp" "$DEPLOY_STATE"

docker image rm "$ROLLBACK_IMAGE" >/dev/null 2>&1 || true
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps "$SERVICE"
curl --fail --silent --show-error --max-time 5 "$HEALTH_URL"
echo
trap - EXIT
