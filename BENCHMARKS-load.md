# BENCHMARKS — carga + soak (T4.1/T4.2)

- Cap concorrência: **15** · WARM_VOICES: 3 (default) · persistente: ON

## T4.1 — carga concorrente

| N concorrentes | wall-time (ms) |  ok/N | throughput (síntese/s) |
| -------------: | -------------: | ----: | ---------------------: |
|              5 |           1398 |   5/5 |                    3.6 |
|             10 |           1898 | 10/10 |                    5.3 |
|             20 |           4157 | 20/20 |                    4.8 |

## T4.2 — soak (leak-check)

- 192/200 sínteses ok.
- RSS: 73MB → 68MB (Δ -4.5MB).
- piper.exe vivos no fim: **2** (esperado ≤ WARM_VOICES=3; -1 = não-Windows).
- Fuga de processos: ✅ não .

---

_Após shutdownPiperPool() os processos quentes são fechados (o supervisor de produção fá-lo no shutdown central)._
