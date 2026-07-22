#!/usr/bin/env python
"""
tools/kokoro_server.py — sidecar TTS Kokoro do Vozen (kokoro-onnx, ONNX/CPU).

Protocolo JSON-lines em stdin/stdout (uma linha = um pedido):
  -> {"text":"...", "out":"C:/.../out.wav", "lang":"en-us", "voice":"af_heart", "speed":1.0}
  <- {"ok": true, "out": "C:/.../out.wav"}
  <- {"ok": false, "error": "..."}
Linha de warmup (carrega o modelo e responde ready):
  -> {"warmup": true}         <- {"ok": true, "ready": true}

Notas:
- Modelo/vozes em tools/kokoro-v1.0.onnx + tools/voices-v1.0.bin (ao lado deste script),
  descarregados por setup-kokoro.ps1.
- stderr e SO para logs; stdout e EXCLUSIVO do protocolo. Redirecionamos o stdout do
  PROCESSO para stderr, para que qualquer print/aviso de biblioteca (phonemizer,
  espeak, kokoro) nao corrompa as linhas JSON — so as respostas escrevem no stdout real.
"""
import json
import os
import sys
import traceback

# Blindagem do protocolo: guardamos o stdout REAL e desviamos o do processo para stderr.
_OUT = sys.stdout
sys.stdout = sys.stderr

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "kokoro-v1.0.onnx")
VOICES = os.path.join(HERE, "voices-v1.0.bin")


def log(msg: str) -> None:
    print(f"[kokoro] {msg}", file=sys.stderr, flush=True)


def reply(obj: dict) -> None:
    print(json.dumps(obj), file=_OUT, flush=True)


def load_model():
    from kokoro_onnx import Kokoro

    log(f"a carregar modelo: {MODEL}")
    return Kokoro(MODEL, VOICES)


def main() -> None:
    import soundfile as sf

    kokoro = None
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            reply({"ok": False, "error": f"json: {e}"})
            continue
        try:
            if kokoro is None:
                kokoro = load_model()
            if req.get("warmup"):
                reply({"ok": True, "ready": True})
                continue
            text = req["text"]
            out = req["out"]
            lang = req.get("lang") or "en-us"
            voice = req.get("voice") or "af_heart"
            speed = float(req.get("speed") or 1.0)
            samples, sr = kokoro.create(text, voice=voice, speed=speed, lang=lang)
            sf.write(out, samples, sr)
            reply({"ok": True, "out": out})
        except Exception as e:  # noqa: BLE001 — o processo NUNCA deve morrer por 1 pedido
            log(traceback.format_exc())
            reply({"ok": False, "error": str(e)})


if __name__ == "__main__":
    main()
