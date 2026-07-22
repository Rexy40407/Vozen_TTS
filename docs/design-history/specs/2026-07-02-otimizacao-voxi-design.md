# Plano de Otimização do Vozen — Design (2026-07-02)

**Estado:** aprovado pelo Diogo (abordagem "Medir → Otimizar", com T3.2 incluído).
**Âmbito:** velocidade, qualidade (voz+deteção), escala/recursos, robustez de hosting — plano completo priorizado.

## Contexto (estado no arranque do plano)

- 842 testes verdes, CI verde, build 0 erros; review adversarial (P19/P20) fechado.
- Deteção automática de língua ON por defeito (léxico de saudações + franc); vozes mistas
  para gírias EN dentro de frase noutra língua (`prepareSpeech` + `SynthRequest.segments`)
  acabadas de entrar (`c52f600`).
- Dores observadas ao vivo nesta sessão:
  - Texto longo esperou **14.7s** de síntese antes de começar a tocar (sem streaming).
  - Cada síntese faz **spawn de um piper.exe novo** (overhead nunca medido).
  - Hosting em `tsx watch` é frágil (reload em edições, crash em estados intermédios) e o
    Smart App Control do Windows bloqueou o binário `@snazzah/davey` no primeiro load
    (bloqueio transitório de reputação — precisa de pré-aquecimento com retry).
  - Sem cap global de processos Piper entre guilds (nota residual do P20).
  - franc não distingue PT curto de ES (`isto ta a funcionar` → spa 1.00 / por 0.99).

## Objetivo e critérios de sucesso (mensuráveis)

"Otimizado" = provado com números antes/depois em `BENCHMARKS.md`:

1. **Tempo-até-primeira-palavra** (mensagem → bot começa a falar): p95 reduzido de forma
   significativa para textos longos (alvo: quase constante, independente do tamanho do texto).
2. **Overhead por síntese** (spawn Piper): medido; eliminado/reduzido se justificar (T2.1).
3. **Sob carga** (N guilds a falar): CPU limitado pelo cap (sem stampede), RAM estável, zero
   crashes/leaks num soak test.
4. **Qualidade**: fragmentos curtos ambíguos resolvem para a língua recente do utilizador
   (T3.2); pausas de voz fixadas pelo ouvido do Diogo (T3.1).
5. **Hosting**: arranque de produção em 1 comando, sobrevive ao bloqueio SAC e reinicia
   sozinho em crash.

## Princípios de execução (herdados do loop)

- TDD; 1 commit verde por task; push após verificação; NUNCA `--force`.
- **Bot OFF durante edições** (tsx watch recarrega em mid-edit); restart só em checkpoints limpos.
- Cada task de performance inclui medição antes/depois (a régua da Fase 0).
- Não tocar em `docs/analise-aquisicao.md` / `docs/analise-concorrentes.md` (ficheiros do Diogo).
- Mudanças no core do player/engine exigem review adversarial antes do push.
- Qualidade > cobertura: um "ganho" não provado pela medição não entra.

## Fase 0 — A régua (medir primeiro)

### T0.1 Benchmark reprodutível (`tools/bench.ts`)
Script committed que mede e imprime tabela:
- Síntese frio/quente × texto curto (~5 palavras) / médio (~30) / longo (~120): p50/p95 do
  tempo total e do tempo até ao 1.º byte de áudio.
- Overhead isolado do spawn do piper.exe (síntese de texto mínimo, repetida).
- Hit-rate da cache em replay de um log sintético de chat.
- RAM do processo node + nº máximo de processos piper em simultâneo.
**Aceitação:** `npx tsx tools/bench.ts` corre em <5 min e escreve baseline em `BENCHMARKS.md`.

### T0.2 Métricas de latência em produção
Estender o sistema `metrics` existente: histograma simples (p50/p95) de latência de síntese +
contador de sínteses; exposto no log periódico e/ou `/stats`.
**Aceitação:** logs mostram latências reais; testes das metrics verdes.

## Fase 1 — Quick-wins (paralelos à Fase 0, não dependem dela)

### T1.1 `/joke`: pausa 2s → 1s
Instrução direta pendente do Diogo ("faz só 1 segundo, isto foi demais").
`JOKE_LAUGH_PAUSE_MS 2000 → 1000` + teste atualizado.
**Aceitação:** teste verde com 1000ms; ouvido do Diogo confirma.

### T1.2 Runner de produção estável
`npm run start:prod`: build → pré-aquecimento davey com retry (anti-SAC, máx 5 tentativas) →
`node dist/index.js` com auto-restart (backoff simples). Guia `docs/HOSPEDAR.md` curto.
**Aceitação:** 1 comando arranca o bot; kill -9 ao processo → reinicia sozinho; bloqueio SAC
simulado (mensagem de erro) documentado no guia.

### T1.3 Cap global de processos Piper
Semáforo global (default `max(1, cpus-1)`, env `PIPER_MAX_CONCURRENCY`) à volta do spawn no
PiperEngine; pedidos acima do cap esperam em fila (FIFO), não falham.
**Aceitação:** teste prova que com cap=2 e 5 sínteses concorrentes nunca há >2 spawns vivos;
nenhuma síntese perdida.

## Fase 2 — Velocidade (ordenada pelos números da Fase 0)

### T2.1 Pool/processo persistente do Piper — GATED pela medição
Só avança se T0.1 mostrar overhead de spawn relevante (>~100ms/síntese). Opções por ordem de
simplicidade: processo persistente com stdin por linha; pool de N processos pré-arrancados.
**Aceitação:** bench antes/depois mostra a redução; 842+ testes verdes; fallback limpo se o
processo persistente morrer.

### T2.2 Streaming de reprodução (tempo-até-primeira-palavra ~constante)
`--output-raw` do Piper → começar a tocar assim que os primeiros bytes PCM saem; tee do stream
para a cache (o WAV final continua a ser guardado). Atrás de flag (`PIPER_STREAMING`, default
OFF até validado), fallback automático ao caminho atual em erro. Mexe no core do player →
**review adversarial obrigatório** antes do push.
**Aceitação:** bench: texto longo passa de ~14s para <2s até à primeira palavra; multi-segmento
e singleVoice continuam corretos; review adversarial sem achados de fiabilidade. A flag só passa
a ON por defeito depois de: bench verde + review limpo + OK de ouvido do Diogo num teste real.

### T2.3 Cache — decisão informada, não trabalho às cegas
Ler o hit-rate do T0.1. Se baixo (chat = mensagens únicas), documentar e NÃO investir (YAGNI).
Só otimizar o evict O(n) se o bench mostrar custo real.
**Aceitação:** decisão escrita em BENCHMARKS.md com o número que a justifica.

## Fase 3 — Qualidade (voz + deteção)

### T3.1 Fixar sentence_silence/noise por-voz — PRECISA DO OUVIDO DO DIOGO
Amostras A/B já geradas (`voz-pt-teste/ab-sentence-silence`). Diogo escolhe; valores entram em
`VOICE_PARAM_OVERRIDES`. (= task #26 pendente do backlog.)
**Aceitação:** valores fixados + teste; Diogo confirma de ouvido.

### T3.2 Memória de língua por-utilizador (adaptativa, 100% automática) — APROVADO
Guardar em memória (por guild+user, TTL curto, ex. 15 min) a última língua detetada com
confiança alta (frase longa/não-ambígua). Em fragmento curto ambíguo (ex. top-2 do franc quase
empatados, ou léxico sem match), resolver para a língua recente do utilizador em vez do palpite
do franc. NÃO é língua-base fixa: continua a seguir o que o utilizador realmente escreve.
**Aceitação:** teste: após frase longa PT, "isto ta a funcionar" resolve para voz pt_ (hoje: es_);
utilizador que muda de língua com frase clara muda a memória; sem memória → comportamento atual.

### T3.3 Alargar léxico de saudações com misses reais
Recolher misses reportados pelo Diogo/observados e acrescentar ao `greetings.ts` (mesmas regras
anti-colisão).
**Aceitação:** cada token novo com teste; zero colisões com palavras comuns das 34 línguas.

## Fase 4 — Escala/recursos

### T4.1 Bench de carga
Simular N guilds a pedir síntese em simultâneo (5/10/20): CPU, RAM, profundidade de fila,
latências p95. Valida o cap do T1.3 e dimensiona o default.
**Aceitação:** tabela em BENCHMARKS.md; cap default ajustado se os números o pedirem.

### T4.2 Leak-check sob carga
Soak test (~1h sintético): players/limiters/cache/processos estáveis (o 19.D corrigiu leaks;
re-provar sob carga com as novas features multi-segmento/streaming).
**Aceitação:** RAM plana no fim do soak; zero processos piper órfãos.

## Fase 5 — Fecho

### T5.1 Validação final + doc-sync
Re-correr bench completo → tabela ANTES/DEPOIS em `BENCHMARKS.md`; atualizar `ARCHITECTURE.md`
(streaming/pool/cap/memória de língua); review adversarial focado em TODAS as mudanças de perf.
**Aceitação:** números finais publicados; review sem achados abertos; CI verde; tudo pushed.

## Fora de âmbito

- Migração de motor TTS (Piper mantém-se; neural/OpenAI continua opcional como está).
- Mudanças de UI/UX (já polidas em P16/P18) além das mensagens novas estritamente necessárias.
- Distribuição/marketing (top.gg, verificação Discord P15 — mãos do Diogo, fora do código).
- Base de língua fixa por servidor (Diogo escolheu deteção 100% automática).

## Dependências do Diogo (não bloqueiam o resto)

- T3.1: ouvir as amostras A/B e escolher.
- T1.1: confirmar de ouvido a pausa de 1s.
- Reportar misses do léxico (T3.3) e resultados reais do mixed-voice.

## Ordem de execução

Fase 0 + Fase 1 em paralelo (tarefas independentes; bot OFF nos checkpoints de edição) →
Fase 2 (gated pelos números) → Fase 3 → Fase 4 → Fase 5.
