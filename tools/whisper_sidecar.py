#!/usr/bin/env python3
"""Sidecar de STT persistente para o Vozen (Fase 4).

Carrega o modelo faster-whisper UMA vez e transcreve N pedidos — como o sidecar
kokoro (evita pagar o cold-load por utterance). Protocolo simples de linhas:

  entrada (stdin):  1 LINHA = caminho de um ficheiro WAV a transcrever
  saida (stdout):   1 LINHA JSON por pedido -> {"text": "...", "lang": "en"}  ou  {"error": "..."}
  arranque:         emite {"ready": true, "model": "..."} depois de carregar o modelo

faster-whisper reamostra o audio internamente (via av/ffmpeg), por isso aceita WAV a
qualquer taxa (o recorder do bot da 48kHz). vad_filter corta silencio (melhor precisao +
menos tokens). beam_size=1 (greedy) para latencia baixa (STT ao vivo). Ver docs/SPIKE-STT.md.

--lang FORCA a lingua (ex. 'pt'): a auto-detecao do Whisper em fala real e curta de
Discord falha muito (transcreve PT como checo/sueco). O bot passa o locale do servidor.
Se a lingua for invalida/nao suportada, cai na auto-detecao (fallback seguro).
"""
import sys
import json
import argparse

# Limiares ANTI-ALUCINACAO (ver o filtro no loop). O Whisper inventa frases sobre
# silencio/ruido; estes cortes usam a confianca do proprio modelo para as descartar.
#  - no_speech_prob > 0.6  => o segmento e provavelmente NAO-fala (silencio/ruido).
#  - avg_logprob   < -1.0  => transcricao de baixa confianca (tipicamente alucinada).
NO_SPEECH_MAX = 0.6
AVG_LOGPROB_MIN = -1.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="base")
    ap.add_argument("--compute", default="int8")
    ap.add_argument("--threads", type=int, default=2)
    ap.add_argument("--lang", default="")  # lingua FORCADA; "" => auto-detecao
    args = ap.parse_args()

    from faster_whisper import WhisperModel

    model = WhisperModel(
        args.model, device="cpu", compute_type=args.compute, cpu_threads=args.threads
    )
    forced = args.lang.strip().lower() or None
    print(json.dumps({"ready": True, "model": args.model, "lang": forced or "auto"}), flush=True)

    for line in sys.stdin:
        path = line.strip()
        if not path:
            continue
        try:
            kwargs = dict(
                beam_size=1,
                vad_filter=True,
                # Sem isto, o Whisper repete/arrasta texto de segmentos anteriores (loops).
                condition_on_previous_text=False,
            )
            try:
                segments, info = model.transcribe(path, language=forced, **kwargs)
            except ValueError:
                # Lingua forcada nao suportada pelo modelo -> cai na auto-detecao.
                segments, info = model.transcribe(path, **kwargs)
            # ANTI-ALUCINACAO: o Whisper INVENTA frases sobre silencio/ruido. Filtra por
            # confianca do proprio modelo — descarta segmentos provavelmente-nao-fala
            # (no_speech_prob alto) ou de baixa confianca (avg_logprob baixo). Isto e o que
            # mata o "manda texto aleatorio quando ninguem fala".
            kept = []
            for s in segments:
                if getattr(s, "no_speech_prob", 0.0) > NO_SPEECH_MAX:
                    continue
                if getattr(s, "avg_logprob", 0.0) < AVG_LOGPROB_MIN:
                    continue
                txt = s.text.strip()
                if txt:
                    kept.append(txt)
            print(json.dumps({"text": " ".join(kept).strip(), "lang": info.language}), flush=True)
        except Exception as e:  # noqa: BLE001 — devolve o erro ao chamador, nunca crasha o sidecar
            print(json.dumps({"error": str(e)[:200]}), flush=True)


if __name__ == "__main__":
    main()
