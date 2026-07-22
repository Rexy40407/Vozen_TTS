# Spike — Viabilidade do clone de voz (Chatterbox) no VPS

**Data:** 2026-07-13 · **Veredito: NÃO VIÁVEL neste VPS.** O modelo nem carrega —
é morto pelo OOM killer antes de sintetizar a primeira frase.

## Contexto

O utilizador reportou "o clone não está a funcionar" em produção. A investigação
mostrou que o clone **nunca esteve instalado no VPS** (ver secção Diagnóstico) e
levantou a dúvida de fundo: o Chatterbox, pensado para GPU, corre de forma usável
num VPS CPU-only? Este spike responde com números, à imagem do `SPIKE-STT.md`.

## Máquina

| | |
|---|---|
| CPU | 2 vCPU Intel Xeon Skylake |
| RAM | 3.7 GB total, ~3.0 GB livre (bot usa ~0.7 GB), **sem swap** |
| Disco | 38 GB (28 GB livre) |
| GPU | nenhuma |
| Python | 3.12.3 |

## Método

- Venv isolado `tools/clone-venv-spike/` (fora do bot), `torch` CPU + `chatterbox-tts`.
- Amostra de referência gerada com gTTS→ffmpeg (WAV 24 kHz mono).
- Benchmark: carregar `ChatterboxMultilingualTTS` (device=cpu) e sintetizar 3 frases,
  medindo load, tempo por frase (RTF) e pico de RSS.
- **Proteção do bot:** o processo do spike escreve `1000` em `/proc/self/oom_score_adj`
  → em pressão de memória o kernel mata o spike, nunca o `vozen.service`.
- `torch.set_num_threads(2)` / `OMP_NUM_THREADS=2`.

## Resultado

| Métrica | Valor |
|---|---|
| Exit code | **137** (128 + SIGKILL) — morto pelo OOM killer |
| Pico de RSS antes de morrer | **3307 MB** |
| Frases sintetizadas | **0** (morreu durante o load do modelo) |
| Latência por frase | não medível (nem chegou lá) |
| Estado do bot durante o spike | `active`, `NRestarts=0` (intocado) |

O processo chegou a carregar parte do modelo (componentes diffusers) e foi morto ao
atingir ~3.3 GB de RSS. Com 3.7 GB totais e o bot a usar ~0.7 GB, não há folga: o
modelo não cabe em memória. Sem swap (não há sudo para o adicionar), o OOM killer
atua de imediato. A `oom_score_adj` garantiu que a vítima foi sempre o spike.

## Conclusão

O clone com Chatterbox **não corre neste VPS** — e o bloqueio é RAM, não velocidade.
Nem sequer se chega a discutir latência: o modelo precisa de >3.3 GB só para carregar.
Adicionar swap (se houvesse sudo) deixá-lo-ia talvez carregar, mas a sintetizar em
swap seria catastroficamente lento e ainda competiria com o bot pela pouca RAM.

Realisticamente, **qualquer motor neural de clonagem** (Chatterbox, XTTS, OpenVoice)
é pesado demais para partilhar 3.7 GB com o bot. O clone é uma feature de GPU/desktop.

## Diagnóstico do "não funciona" (independente do spike)

1. **Nunca instalado no VPS:** sem `clone-venv`, o `deploy-bot.yml` não instala nada
   de Python, e `CLONE_CMD` está vazio.
2. **Bug de deteção Windows-only:** `resolveCloneCmd` (`src/tts/cloneEngine.ts`) só
   procura `tools/clone-venv/Scripts/python.exe` (Windows), nunca o `bin/python` do
   Linux. Mesmo com o venv lá, o motor ficaria inerte. (O sidecar de STT já trata
   das duas plataformas — o do clone ficou por corrigir.)
3. **Efeito para o utilizador:** motor indisponível → `/voice clone use on` responde
   "clone ligado mas motor não instalado" e as mensagens saem na **voz normal**.

## Recomendação

**Tratar o clone como feature de GPU/desktop** e ser honesto em produção:
- Esconder/desativar o grupo `/voice clone` no bot alojado, para os utilizadores não
  verem uma feature que serve voz normal.
- Corrigir o bug de deteção Windows-only (`resolveCloneCmd` aceitar `bin/python`),
  por correção e para quem corra o bot numa máquina com RAM/GPU suficientes.
- Rever docs/marketing (PRIVACY, ARCHITECTURE, preços) para o clone não ser prometido
  no bot alojado.

Alternativa (custo): mover o sidecar de clone para uma máquina/serviço com GPU.

## Limpeza

Venv do spike (6.3 GB), cache HuggingFace (3.0 GB) e cache pip (3.5 GB) removidos;
disco de volta a 7.8 GB usados (= estado inicial). `vozen.service` intocado, `NRestarts=0`.
