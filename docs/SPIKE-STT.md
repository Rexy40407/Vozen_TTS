# Spike STT — veredito (Vaga 5 · Fase 4)

> Objetivo (Fase 0 do `PLAN-VAGA5-FEATURES.md`): saber se o STT com Whisper **local** é
> viável no VPS de produção, contra os limiares **p95 ≤ 5 s por utterance de ≤10 s** e
> **TTS não degrada > 25 %** sob carga. Feito a 2026-07-13 por SSH ao VPS (bot a correr).

## VPS (Hetzner)

- **2 vCPU** (Intel Xeon Skylake), **3.7 GB RAM** (3.1 livre), 28 GB disco livre.
- Carga típica **~0.08** (o bot usa ~600 MB / quase nada de CPU em repouso).
- `gcc`/`g++`/`make`/`git` + Python 3.12 + pip. Sem `cmake` (→ evitámos whisper.cpp).

## Método

- Motor: **faster-whisper 1.2.1** (CTranslate2 4.8.1) num venv isolado — pip, sem compilar,
  sem PyTorch, sem cmake. (Whisper.cpp precisaria de cmake, ausente.)
- Áudio de teste: **13.6 s de fala inglesa gerada pelo Piper do próprio VPS** (voz amy) —
  sem descarregar nada de fora.
- `compute_type=int8`, `cpu_threads=2`, `beam_size=1` (greedy, realista para STT ao vivo),
  3 corridas quentes por modelo.

## Resultados

| Modelo | Transcrição (13.6 s áudio) min/med/max | RTF (med) | Precisão |
|---|---|---|---|
| `tiny` | 1.29 / **1.41** / 1.48 s | 0.10 | boa (erros: "Hack"/"Pack", "zebras") |
| `base` | 2.13 / **2.16** / 2.21 s | 0.16 | quase perfeita |

## Veredito: **VIÁVEL** ✅

- `base` transcreve 13.6 s de fala em **~2.2 s** no VPS idle — **56 % de folga** face ao
  limiar de 5 s. Uma utterance típica de ≤10 s ficaria em **~1.6 s**.
- A contenção com o TTS (Piper usa 1 core) tem margem: mesmo 2× de degradação sob carga
  ainda passa os 5 s. STT será **Premium-gated** (poucos servidores) → concorrência real baixa.

## Arquitetura recomendada para a Fase 4

- **Modelo `base`** (melhor precisão; latência sobra). `tiny` como fallback de baixo custo.
- **Sidecar Whisper persistente** (carrega o modelo 1×, transcreve N) — espelha o padrão dos
  sidecars clone/kokoro (`tools/setup-*.ps1` → `tools/whisper-venv`). Evita o custo de load
  por utterance.
- **Cap de 1 transcrição concorrente** (semáforo) para limitar a contenção de CPU com o Piper.
- **Consent-first por-locutor** (reutilizar o padrão do voice-clone) + **zero persistência de
  áudio** + as transcrições vão como mensagens de canal (disclosed na PRIVACY — ver o portão
  da Fase 4 no plano).

> Nota: o spike foi feito num venv scratch (`~/whisper-spike`) já **removido**; a Fase 4 fará
> um setup próprio (`tools/setup-whisper.*` → `tools/whisper-venv`). O `vozen.service` manteve-se
> `active` durante todo o spike.
