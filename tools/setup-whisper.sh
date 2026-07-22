#!/usr/bin/env bash
# Instala o sidecar de STT (faster-whisper) em tools/whisper-venv — auto-detetado por
# src/voice/whisperSidecar.ts::resolveWhisperCmd. OPT-IN: sem este venv o STT fica inerte.
# Sem PyTorch nem cmake (CTranslate2). Ver docs/SPIKE-STT.md para os números do VPS.
# Correr na raiz do projeto:  bash tools/setup-whisper.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[setup-whisper] a criar tools/whisper-venv…"
python3 -m venv tools/whisper-venv
# sec(031): versões PINADAS em requirements-whisper.txt (antes instalava faster-whisper
# sem versão — resolução não determinística). Espelha setup-kokoro (`-r`).
tools/whisper-venv/bin/pip install --disable-pip-version-check -q -r tools/requirements-whisper.txt

echo "[setup-whisper] pronto. O modelo (base ~140MB) descarrega no 1.º arranque do sidecar."
tools/whisper-venv/bin/python - <<'PY'
import faster_whisper, ctranslate2
print(f"  faster-whisper {faster_whisper.__version__} | ctranslate2 {ctranslate2.__version__}")
PY
