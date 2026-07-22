# Plan 018 — Player "Hear it": 6 línguas audíveis nos 3 motores

> Planeado em 2026-07-08 (pedido do Diogo). Só toca no **site**
> (nada no bot). Deploy via GitHub Pages (push a `main`).

## Objetivo

O player "Hear it" do site passa a mostrar **só línguas que tocam nos 3 motores**
(Google + Piper + Kokoro), sem chips desativados nem áudio partido. Toda a língua
funciona em todos os motores — experiência consistente.

Pressupostos: samples geram-se localmente (Kokoro via `tools/gen-kokoro-samples.py`,
Piper e Google via os respetivos comandos), convertem-se a mp3 com `ffmpeg-static`,
e commitam-se em `site/assets/samples/`. O `?v=` dos assets é bumpado a cada mudança.

## ⚠️ Restrição que muda o pedido (ler primeiro)

O pedido é **6 línguas nos 3 motores**. Os factos dizem que a interseção **natural**
dos 3 é **5**: `en, es, fr, it, pt`. O Kokoro só serve 7 (en/es/fr/hi/it/pt/ja); o `ja`
está partido e o Piper **não tem** Hindi nem Japonês. Logo o **único** 6.º candidato
possível é **Hindi**, e só se conseguirmos uma **voz Piper de Hindi** (comunidade) que
soe bem — a validar no spike. Não há outra língua que feche os 3 motores.

Decisão a tomar no fim da Fase 0 (com o Diogo): **6 = en/es/fr/it/pt/hi** (se o Hindi
passar no spike) **ou** **5 = en/es/fr/it/pt** (se não passar).

## Scope

### In

- **Fase 0 (spike):** decidir o conjunto final — verificar se existe voz Piper de
  Hindi utilizável E se Kokoro Hindi/Italiano soam aceitáveis.
- Gerar os samples em falta (Italiano nos 3; Hindi nos 3 se entrar) e regenerar os
  existentes se preciso, tudo à MESMA frase por língua.
- Reescrever o `SAMPLES` do player: só as 5–6 línguas escolhidas, **cada uma com os 3
  motores** (`engines: ["google","piper","kokoro"]`), sem `de`/`ja`.
- Remover do repo os mp3 órfãos (de/ja e variantes que deixem de ser usados).
- Bump do `?v=` dos assets + deploy + verificação no site live (fresco).

### Out

- **Japonês** (Kokoro partido + sem Piper) — fica FORA; se um dia se quiser, é um
  plano à parte (misaki[ja] no sidecar + voz Piper ja, que hoje não existe).
- **Alemão** no player — sai (não há voz Kokoro alemã). Continua a funcionar no BOT
  via Google/Piper; só deixa de aparecer no comparador do site.
- Corrigir o Kokoro `ja` no bot (item já sinalizado à parte — não é deste plano).
- Qualquer mudança no motor/bot. Isto é 100% site.
- Adicionar >6 línguas ou um seletor "todas as línguas".

## Fases

### Fase 0 — Spike: fixar o conjunto de línguas (resolve o único desconhecido)

Deliverable: decisão **5 vs 6** com evidência ouvível.

- [ ] Confirmar Italiano nos 3: Piper `it_IT-paola-medium` (existe no catálogo local),
      Kokoro `it`/`if_sara`, Google `it` → gerar 1 clip de cada e ouvir.
- [ ] Hindi: procurar uma voz Piper `hi_*` em rhasspy/piper-voices; se existir,
      descarregar e gerar clip. Gerar também Kokoro `hi`/`hf_alpha` e Google `hi`.
- [ ] **Ouvir** os candidatos (o Diogo confirma): Hindi passa nos 3? Kokoro it/hi
      soam bem (sem o efeito "lixo" do ja)?
- [ ] Decidir: **6 (en/es/fr/it/pt/hi)** ou **5 (en/es/fr/it/pt)**. Registar no plano.
- Done: conjunto final fixado; para cada língua escolhida há prova de que os 3 motores
  produzem áudio audível.

### Fase 1 — Gerar TODOS os samples do conjunto final

Deliverable: `site/assets/samples/<code>{,-piper,-kokoro}.mp3` para cada língua, à
mesma frase.

- [ ] Definir a frase por língua (reusar as existentes de en/es/fr/pt; escrever it e,
      se entrar, hi). A frase TEM de bater com o áudio dos 3 motores.
- [ ] Google: `<code>.mp3`; Piper: `<code>-piper.mp3`; Kokoro: `<code>-kokoro.mp3`.
      Estender `tools/gen-kokoro-samples.py` para incluir it (e hi); usar os comandos
      Piper/gTTS existentes para os outros dois. Converter a mp3 com `ffmpeg-static`.
- [ ] Sanidade por ficheiro: duração plausível (~2–5s, nada de 10s-lixo), decodifica
      sem erro (`ffmpeg -f null`).
- Done: 15 (5 línguas) ou 18 (6) mp3 no disco, todos válidos e à frase certa.

### Fase 2 — Reescrever o player + limpar órfãos

Deliverable: `SAMPLES` do site só com o conjunto final, 3 motores por língua.

- [ ] `site/js/main.js`: reescrever `SAMPLES` (só as línguas finais; cada uma
      `engines: ["google","piper","kokoro"]`; frases certas; bandeira/nome). Tirar
      `de` e `ja`. `ENGINE_NAME`/`ENGINE_SUFFIX` já cobrem os 3.
- [ ] Apagar do repo os mp3 que deixam de ser usados (de*, ja*, e variantes não
      referenciadas). `git rm`.
- [ ] Atualizar copy/contadores se referirem nº de línguas do player (não confundir
      com as "35 línguas" do bot, que ficam).
- Done: nenhum chip fica desativado em nenhum motor; sem ficheiros órfãos.

### Fase 3 — Build, verificação fresca, deploy

- [ ] `npm run build:site`; bump do `?v=` de `js/main.js` (mudou) — nova versão.
- [ ] Verificar num browser FRESCO (preview, load cache-busted): para cada motor
      (Google/Piper/Kokoro) todos os chips habilitam e cada clip toca (`canplay`).
- [ ] Commit dos ficheiros do site + push a `main`; confirmar deploy do Pages OK.
- [ ] Verificar no site LIVE (curl cache-busted): `main.js?v=` novo + um mp3 de cada
      motor devolve 200.
- Done: site live com 5–6 línguas, 3 motores cada, sem chips mortos.

## UI Blueprint (acessório — confinado à Fase 2)

O componente já existe; não há redesign. Só muda o **conteúdo** e o estado dos chips:

- **Chips de língua:** o conjunto encolhe para 5–6; **nenhum** fica em estado
  `is-disabled` seja qual for o motor selecionado (era o bug de UX a resolver).
- **Toggle de motor (Google/Piper/Kokoro):** inalterado; trocar de motor nunca
  desativa línguas nem cai no fallback Google (deixa de haver fallback porque todas
  têm os 3).
- **Sem mudanças** de tokens, cores, tipografia, layout ou motion.

## Riscos

- **O pedido de 6 pode não ser atingível.** Se o Hindi não tiver voz Piper utilizável
  (ou soar mal), o máximo honesto são **5**. A Fase 0 resolve isto barato, ANTES de
  gerar tudo. Não inventar um 6.º "a martelo" (ex.: pôr Hindi só em Google+Kokoro com
  o chip Piper desativado) — isso reintroduz exatamente o bug que queremos matar.
- **Kokoro Hindi pode vir partido** como o Japonês (g2p do espeak para hi pode precisar
  de mais que o bundle). Mitigação: é o 1.º teste ouvível da Fase 0; se falhar, cai-se
  nas 5.
- **Voz Piper de Hindi = dependência externa** (download da comunidade, licença,
  qualidade variável). Se não houver uma decente, 5 é a resposta.
- **Regressão de cache** (utilizadores com o site antigo). Mitigação: o `?v=` já
  existe; bumpar sempre que um asset muda (lição das rondas anteriores).
- **Frase inconsistente entre motores** faz o áudio não bater com o texto no ecrã.
  Mitigação: uma única frase por língua, usada nos 3 comandos de geração.

## MVP

Fim da **Fase 2** com o conjunto **5** (en/es/fr/it/pt): já é a versão consistente e
sem bug (todos os chips funcionam nos 3 motores). O Hindi (→6) é um upgrade opcional
que só entra se passar a Fase 0. A Fase 3 leva-o a produção.

Próxima ação concreta: gerar e ouvir os clips de Italiano e Hindi nos 3 motores (Fase 0) para decidir 5 vs 6.
