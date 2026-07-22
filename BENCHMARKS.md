# BENCHMARKS — Vozen (baseline)

Gerado por `npx tsx tools/bench.ts`. Piper real; cache temporária isolada.
Hoje NÃO há streaming: tempo-até-1.ª-palavra == tempo total de síntese abaixo.

- Piper: `C:\Users\diogo\piper_pkg\piper\piper.exe`
- Modelos: 38 em `C:\Users\diogo\piper_pkg\piper\models`
- Cap de concorrência (PIPER_MAX_CONCURRENCY / max(1,núcleos-1)): **15**

- Voz PT: `pt_PT-tugao-medium` · Voz EN: `en_US-amy-medium`

## Latência de síntese FRIO (cache miss)

| Tamanho              | Voz | corridas | p50 (ms) | p95 (ms) |  min |  max |
| -------------------- | --- | -------: | -------: | -------: | ---: | ---: |
| curto (~6 palavras)  | PT  |        8 |      408 |      571 |  401 |  571 |
| curto (~6 palavras)  | EN  |        8 |      430 |      550 |  421 |  550 |
| médio (~30 palavras) | PT  |        8 |      812 |      842 |  764 |  842 |
| médio (~30 palavras) | EN  |        8 |      859 |      975 |  830 |  975 |
| longo (~90 palavras) | PT  |        5 |     1850 |     1874 | 1791 | 1874 |
| longo (~90 palavras) | EN  |        5 |     2109 |     2211 | 2066 | 2211 |

## Latência QUENTE (cache hit)

| Amostra                 |   ms |
| ----------------------- | ---: |
| curto (~6 palavras) PT  | 0.23 |
| curto (~6 palavras) EN  | 0.09 |
| médio (~30 palavras) PT | 0.08 |
| médio (~30 palavras) EN | 0.08 |
| longo (~90 palavras) PT | 0.07 |
| longo (~90 palavras) EN | 0.07 |

## Overhead do spawn (síntese de 1 palavra)

- p50 **372 ms**, p95 506 ms (piso ≈ spawn + síntese mínima).

## Hit-rate da cache (replay sintético)

- 20/30 hits = **67%** neste replay (repetições típicas de chat).

> Se baixo em produção real (mensagens quase sempre únicas), a cache dá pouco — T2.3 decide com números.

## Recursos

- RSS antes: 74 MB · depois: 69 MB

---

## T5.1 — ANTES vs DEPOIS (pool persistente, T2.1)

Latência de síntese FRIO, p50 (a mediana = o caso QUENTE típico; o p95 mantém o custo
único do 1.º processo por voz). Máquina: 16 núcleos.

| Tamanho              | Voz | ANTES p50 (spawn/síntese) | DEPOIS p50 (pool ON) |    ganho |
| -------------------- | --- | ------------------------: | -------------------: | -------: |
| curto (~6 palavras)  | PT  |                    408 ms |            **99 ms** | **4.1×** |
| curto (~6 palavras)  | EN  |                    430 ms |           **120 ms** |     3.6× |
| médio (~30 palavras) | PT  |                    812 ms |               456 ms |     1.8× |
| médio (~30 palavras) | EN  |                    859 ms |               544 ms |     1.6× |
| longo (~90 palavras) | PT  |                   1850 ms |              1489 ms |    1.24× |
| longo (~90 palavras) | EN  |                   2109 ms |              1758 ms |     1.2× |

O overhead de arranque+carregamento (~372 ms) desaparece na 2.ª+ síntese de cada voz
(reutiliza o processo quente). Mensagens curtas — o caso comum de chat — ficam ~4×
mais rápidas. Áudio byte-idêntico. Ver carga/soak em `BENCHMARKS-load.md`.

## Decisões da Fase 2/3 (com números)

- **T2.3 — Cache:** o replay sintético dá 67% de hits, mas mensagens reais de chat são
  quase sempre ÚNICAS → hit-rate real baixo. O custo do miss já caiu ~4× com o pool
  (T2.1). **Decisão: NÃO investir mais na cache** (evict O(n) só corre acima de 500
  ficheiros e nunca apareceu no perfil). YAGNI.
- **T2.2 — Streaming (`--output-raw`):** existe e funciona, mas o ganho MUDOU depois do
  T2.1: o overhead dominante (~372 ms de spawn) já foi eliminado; o streaming só
  ajudaria o tempo-até-1.ª-palavra de textos MUITO longos (>~90 palavras, já ~1.5 s),
  ao custo de reescrever o caminho crítico do player (consumir PCM ao vivo + tee para a
  cache + fallback) — alto risco para ganho marginal, e precisa do ouvido do mantenedor. **
  Decisão: DIFERIDO.** O knob fica documentado; revisita-se se a latência de mensagens
  longas se tornar queixa real. (`PIPER_STREAMING` reservado, não implementado.)
- **T3.3 — Léxico de saudações:** sem misses reais reportados; a memória de língua
  (T3.2) já cobre o grosso dos fragmentos curtos. **Ongoing:** acrescentar tokens à
  medida que o mantenedor reportar palavras que saiam na língua errada.

_Gerar de novo: `npx tsx tools/bench.ts` (latência) e `npx tsx tools/loadbench.ts` (carga/soak)._
