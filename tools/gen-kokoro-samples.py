#!/usr/bin/env python
"""
tools/gen-kokoro-samples.py — gera os clips de amostra Kokoro para o player "Hear it"
do site (site/assets/samples/<code>-kokoro.wav). Usa as MESMAS frases do site e as
vozes/langs de KOKORO_VOICES. Só as línguas que o Kokoro serve E que o player tem:
en, es, fr, pt, ja (o alemão não tem voz Kokoro, fica só Google/Piper).

Correr com o python do venv: tools/kokoro-venv/Scripts/python.exe tools/gen-kokoro-samples.py
Depois converter os WAV -> mp3 com ffmpeg (ver o comando no README/commit).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_DIR = os.path.join(ROOT, "site", "assets", "samples")
MODEL = os.path.join(HERE, "kokoro-v1.0.onnx")
VOICES = os.path.join(HERE, "voices-v1.0.bin")

# code -> (frase igual à do site, lang espeak do Kokoro, voz Kokoro)
SAMPLES = {
    "en": ("Hey! Welcome to the server. Type anything and I'll read it out loud.", "en-us", "af_heart"),
    "pt": ("Olá! Escreva qualquer coisa e eu leio em voz alta.", "pt-br", "pf_dora"),
    "es": ("¡Hola! Escribe lo que quieras y lo leeré en voz alta.", "es", "ef_dora"),
    "fr": ("Salut ! Écris ce que tu veux, je le lis à voix haute.", "fr-fr", "ff_siwis"),
    "it": ("Ciao! Scrivi quello che vuoi e lo leggerò ad alta voce.", "it", "if_sara"),
}


def main() -> None:
    import soundfile as sf
    from kokoro_onnx import Kokoro

    print(f"[gen] a carregar modelo {MODEL}", file=sys.stderr)
    kokoro = Kokoro(MODEL, VOICES)
    os.makedirs(OUT_DIR, exist_ok=True)
    for code, (text, lang, voice) in SAMPLES.items():
        samples, sr = kokoro.create(text, voice=voice, speed=1.0, lang=lang)
        out = os.path.join(OUT_DIR, f"{code}-kokoro.wav")
        sf.write(out, samples, sr)
        print(f"[gen] {code}: {out} ({len(samples)/sr:.1f}s @ {sr}Hz)", file=sys.stderr)
    print("[gen] feito.", file=sys.stderr)


if __name__ == "__main__":
    main()
