#!/bin/sh
set -eu

if [ -z "${HEALTH_PORT:-}" ]; then
  exit 0
fi

curl --fail --silent --show-error --max-time 5 \
  "http://127.0.0.1:${HEALTH_PORT}/health" >/dev/null
