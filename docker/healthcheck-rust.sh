#!/bin/sh
set -eu

if [ "${RUST_CORE_VOICE_ENABLED:-false}" = "true" ] \
  || [ "${RUST_TTS_FILE_ENABLED:-false}" = "true" ]; then
  piper_path="${PIPER_PATH:-piper}"
  models_dir="${MODELS_DIR:-./models}"
  default_voice="${DEFAULT_VOICE:-en_US-amy-medium}"

  case "${piper_path}" in
    */*)
      test -f "${piper_path}"
      test -x "${piper_path}"
      ;;
    *)
      command -v "${piper_path}" >/dev/null
      ;;
  esac

  test -f "${models_dir}/${default_voice}.onnx"
  test -f "${models_dir}/${default_voice}.onnx.json"
fi

if [ -z "${HEALTH_PORT:-}" ]; then
  exit 0
fi

curl --fail --silent --show-error --max-time 5 \
  "http://127.0.0.1:${HEALTH_PORT}/health" >/dev/null
