# Hospedar o Vozen (produção)

## Arranque num comando

```
npm run start:prod
```

Isto:

1. Faz `npm run build` (compila TypeScript → `dist/`).
2. **Pré-aquece a voz** (`@snazzah/davey`) — ver Smart App Control abaixo.
3. Arranca `node dist/index.js` com **auto-restart** (backoff 2s→60s) se o bot crashar.

Pára com **Ctrl-C** (SIGINT).

> Requer `.env` configurado (`DISCORD_TOKEN`, `PIPER_PATH`, `MODELS_DIR`, …). O
> `npm run dev` (`tsx watch`) é só para **desenvolvimento** — recarrega a cada
> alteração de ficheiro e pode crashar em edições a meio; NÃO usar para hospedar.

## Smart App Control (Windows) — o bloqueio do davey

Sintoma no arranque:

```
Error: Cannot find native binding … davey.win32-x64-msvc.node
Uma política de Controlo de Aplicações bloqueou este ficheiro. (ERR_DLOPEN_FAILED)
```

**Causa:** o Smart App Control do Windows 11 avalia binários nativos por *reputação
na cloud da Microsoft*. O `@snazzah/davey` (módulo de encriptação de voz DAVE) é
recente/raro; no **primeiro** load, enquanto a reputação não resolve, o SAC **bloqueia
por precaução**. Não é bug do bot — módulos populares (sodium, sqlite) passam por já
terem reputação.

**Solução (automática):** o `start:prod` já faz o pré-aquecimento com **até 5
tentativas** — normalmente à 1.ª/2.ª a reputação resolve e passa. Só volta a acontecer
se reinstalares `node_modules` ou atualizares o Node (binário novo → reputação
"desconhecida" outra vez).

**Se persistir** (bloqueia sempre, mesmo com internet): último recurso é **desligar o
Smart App Control** (Segurança do Windows → Controlo de aplicações e navegador →
Smart App Control → Desligado). ⚠️ É porta de sentido único — depois de OFF só se
volta a ligar reinstalando o Windows. Como o bot funciona com o SAC ligado (via
pré-aquecimento), **não é recomendado**.

## Síntese: pool persistente + concorrência

**Pool persistente (ON por defeito).** Em vez de arrancar um `piper.exe` novo por
síntese (~372ms de overhead de arranque+carregamento de modelo), o Vozen mantém
processos piper QUENTES e reutiliza-os — a 2.ª síntese de uma voz passa de ~410ms para
~110ms (~4× mais rápido), com áudio idêntico. Qualquer falha do pool cai
automaticamente no arranque one-shot (nunca se perde uma síntese).
- Desligar: **`PIPER_PERSISTENT=0`**.
- Nº de vozes mantidas quentes (RAM): **`PIPER_WARM_VOICES`** (default 3). Mantém-no
  ≥ nº de vozes que costumam falar ao mesmo tempo, para evitar reciclagem de processos.

**Concorrência.** O nº de sínteses em simultâneo é limitado (default `max(1,
núcleos-1)`); ajusta com **`PIPER_MAX_CONCURRENCY`** (inteiro positivo) para baixar
(máquina fraca) ou subir.

## Medir performance

```
npx tsx tools/bench.ts   # escreve/atualiza BENCHMARKS.md
```
