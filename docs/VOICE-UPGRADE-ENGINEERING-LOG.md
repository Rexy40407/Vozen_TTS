# Log de engenharia — upgrade de voz (Engenheiro de Voz/TTS)

> Papel: **Engenheiro de Voz/TTS**. Sub-tarefa: *"Auditar o motor TTS atual,
> identificar limitações técnicas, e implementar o upgrade de voz (qualidade,
> vozes disponíveis, suporte a novos idiomas)"*.
>
> Este documento fecha o ciclo que `docs/VOICE-QUALITY.md`, `docs/SPEECH-DATA-
> AUDIT.md` e `docs/VOICE-EVAL-MOS-AB.md` deixaram em aberto: os três são
> diagnóstico + protocolo, **sem alteração de código**. Aqui **integrei** a
> parte que já tinha luz verde (baixo risco, verificável por inspeção de
> ficheiro) e documento honestamente o que continua fora de alcance com as
> ferramentas disponíveis (só leitura/escrita de ficheiros, **sem execução** —
> não corri `npm test`/`npm run build` nesta sessão).

## 0. Auditoria — ponto de partida

Motor: **Piper** (self-host, `.onnx` pré-treinados, `src/tts/piper.ts`) como
default; **NeuralEngine** (OpenAI `tts-1`/`tts-1-hd`, `src/tts/neural.ts`) atrás
de `TTS_ENGINE=neural`. Confirmei que uma parte do trabalho de auditorias
anteriores **já tinha sido integrada** no código antes desta sessão (não fui eu):

- `neural.ts`: default do modelo OpenAI já era `tts-1-hd` (tier de maior qualidade).
- `voiceMap.ts`: `nor`/`nob`/`nno` → prefixo `no_` já presentes (fecha o bug de
  alinhamento G3 do `SPEECH-DATA-AUDIT.md` — Norueguês deixou de cair sempre no
  fallback inglês).
- `greetings.ts`: `buna`/`bună`/`hejsa` já estavam em `GREETING_INITIAL` (fecha o
  G2 do mesmo documento).

O que **ainda não** estava feito, e que esta sessão implementou:
1. **G1** — 20 línguas com prefixo/modelo mapeado mas **zero cobertura de léxico
   curto** (saudações caíam no `franc`, que erra em texto curto, e saíam na voz
   errada).
2. **Eixo "vozes disponíveis" do motor neural** — 5 das 6 vozes OpenAI eram
   estruturalmente inalcançáveis (sempre `alloy`), sem nenhum controlo do
   operador.

## 1. O que foi implementado nesta sessão

### 1.1 `src/language/greetings.ts` — fecha G1 (parcialmente, com gate de segurança)

Mesclei um subconjunto **curado e verificado** dos candidatos em
`docs/speech-data/lexicon-candidates.json` para `LEXICON`/`GREETING_INITIAL`.

**Gate aplicado (mais estrito que o do documento original):** o `lexicon-
candidates.json` só verificava colisão contra o léxico Latino já existente. Isso
**não basta** para línguas que partilham o MESMO script entre si dentro do
próprio lote: Árabe+Persa (Perso-Arábico) e Russo+Ucraniano+Cazaque+Sérvio
(Cirílico). Reproduzi a verificação **por script partilhado**:

- **Cirílico (rus/ukr/kaz/srp):** as 4 listas do documento não tinham nenhum
  token duplicado entre si (ortografias distintas) — mesclei as 4 na íntegra.
- **Perso-Arábico (ara/fas):** encontrei uma colisão real que o documento não
  tinha isolado — `سلام` (saudação comum tanto em árabe corrente como em persa)
  e `السلام عليكم` (saudação islâmica pan-linguística) foram **excluídos**; só
  entraram tokens inequivocamente de uma língua (`مرحبا`/`شكرا`/... para árabe;
  `درود`/`ممنون`/... para persa).
- **Grego/Georgiano/Nepali(Devanagari)/Chinês:** script próprio, sem outra
  língua do lote a partilhá-lo → mesclados na íntegra (risco estrutural zero).
- **Latino (ces/hun/cym/isl/ltz/lav/slk/slv/swh/vie):** usei só o subconjunto
  que o próprio `lexicon-candidates.json` já assinalava como não-colidente (ex.
  excluí `ahoj`/`čau` de checo E eslovaco por ambiguidade entre si; excluí
  `helló`/`halló` por proximidade de `helo`(en)/`hallo`(de); excluí `merci` do
  luxemburguês por colidir com francês; excluí `zdravo`/`hvala` do esloveno por
  colidirem com sérvio) e confirmei manualmente (grep visual, não `franc` ao
  vivo) que nenhum token novo repete uma chave já existente no ficheiro.

**Línguas com cobertura de léxico curto nova:** `rus, ukr, kaz, srp, ara, fas,
ell, kat, nep, cmn, ces, hun, cym, isl, ltz, lav, slk, slv, swh, vie` — 20
línguas, fechando o G1 nominalmente (todas as línguas do gap original), embora
com **menos tokens por língua** do que o candidato bruto (subconjunto seguro,
não a lista inteira).

Também adicionei os líderes de saudação-inicial de 1 palavra correspondentes em
`GREETING_INITIAL` (regra 3 do `lookupShortLang`), só para tokens que são
saudações puras, replicando o padrão já usado para `pol/tur/swe/fin`.

### 1.2 FIX BLOQUEANTE #1 encontrado em autorrevisão: `normalize()` apagava marcas combinantes

Antes de dar a tarefa como terminada, tracei manualmente um dos testes novos que
escrevi (`lookupShortLang('नमस्ते') === 'nep'`) e a `normalize()` original
**partia-o**. A função só mantinha `\p{L}` (categoria Letter); as marcas
combinantes (`\p{M}`, Mn/Mc) eram substituídas por espaço. Isso é inofensivo
para Latino/Cirílico/Grego/CJK **precomposto**, mas o Devanagari (Nepali) **não
tem** forma precomposta: a virama (्, U+094D) e as vogais dependentes (े,
U+0947) são SEMPRE marcas combinantes separadas. `normalize('नमस्ते')` dava
`'नमस त'` (com espaços a meio) — a chave do `LEXICON` nunca batia, e as 3
entradas nepali ficavam **mortas** apesar de estarem no ficheiro.

**Corrigido:** `normalize()` agora chama `.normalize('NFC')` primeiro e mantém
`\p{M}` além de `\p{L}`/`\p{N}`. Comportamento **inalterado** para todas as
entradas anteriores. **Como isto foi apanhado:** um revisor (advisor) pediu para
traçar à mão um dos meus próprios testes antes de fechar a tarefa — sem essa
revisão, teria entregado 3 línguas silenciosamente não-funcionais.

### 1.3 FIX #2 (fecha por construção, não só por confiança no `npm test`): forma Unicode das CHAVES do léxico

Depois do fix de §1.2, o próprio revisor apontou um segundo risco da mesma
família: `normalize()` põe o **input** em NFC antes de procurar, mas as
**chaves** de `LEXICON`/`GREETING_INITIAL` nunca eram tocadas — eram comparadas
tal como gravadas no ficheiro-fonte. Uma releitura visual **não consegue
distinguir NFC de NFD** (renderizam de forma idêntica no ecrã), e como esta
sessão não tem forma de correr `npm test` para confirmar, "reler o ficheiro"
não fechava o risco — só o escondia.

**Corrigido por construção:** adicionei `LEXICON_NFC`/`GREETING_INITIAL_NFC`,
derivados de `LEXICON`/`GREETING_INITIAL` aplicando `.normalize('NFC')` a cada
chave UMA VEZ ao carregar o módulo. `lookupShortLang` passou a procurar
SEMPRE nestes mapas normalizados, nunca nos objetos originais. Resultado: o
input (já NFC via `normalize()`) bate com a chave **independentemente** da
forma Unicode em que ela foi gravada no ficheiro — elimina a dependência de
"confiar que escrevi em NFC" para todo o léxico Latino/Grego/Vietnamita
acentuado (Devanagari já não dependia disto, por não ter forma precomposta;
resolvido à parte em §1.2). Para as ~340 entradas anteriores é um no-op (já
estavam em NFC).

### 1.4 `src/tts/neural.ts` — fecha (parcialmente) o eixo "vozes disponíveis"

**Limitação encontrada na auditoria:** `mapVoice()` só tentava reconhecer uma
voz OpenAI dentro do `req.model` (que é sempre um id Piper, ex.
`'pt_PT-tugao-medium'`) — nunca batia, e o motor neural usava **sempre**
`'alloy'`, sem NENHUM controlo do operador sobre as outras 5 vozes da API
(`echo`, `fable`, `onyx`, `nova`, `shimmer`).

**Implementado:** `resolveNeuralVoice()`, no mesmo padrão exato de
`resolveNeuralModel()` (já existente): lê `OPENAI_TTS_VOICE` por-chamada, valida
contra as 6 vozes válidas, cai no default `'alloy'` se ausente/inválida — nunca
crasha por typo. `mapVoice()` agora cai nesta função em vez de um default
hardcoded. **Efeito colateral corrigido também:** a `cacheKey()` só discriminava
`model::tier` (não a voz) — sem incluir a voz na chave, mudar
`OPENAI_TTS_VOICE` deixaria o cache a servir para sempre o áudio da voz antiga.
Passei a compor a chave como `model::tier::voice`, mesmo padrão do fix anterior
para `tts-1`/`tts-1-hd`. Adicionei um teste (`tests/neural.test.ts`) que muda a
env entre duas chamadas e confirma um `fetch` novo (não serve do cache errado).

**O que isto NÃO resolve** (deliberadamente, é decisão de produto): continua a
não haver correspondência Piper→OpenAI por género/idioma/utilizador, nem
seleção de voz OpenAI dedicada no `/voice`. `OPENAI_TTS_VOICE` é uma escolha
**global única** para todo o motor neural — mas antes não havia escolha
nenhuma. Documentado em `.env.example` (`OPENAI_TTS_MODEL`/`OPENAI_TTS_VOICE`,
que também não estavam documentados lá antes desta sessão).

### 1.5 Testes novos — `tests/greetings.test.ts`, `tests/neural.test.ts`

Casos novos mirror do padrão existente em cada ficheiro. **NÃO EXECUTADOS** —
sem ferramenta de corrida de testes disponível nesta sessão (só `read_file`/
`write_file`/`list_dir`/`glob`). Tracei à mão os casos de maior risco
(Devanagari, depois do fix de §1.2) e a lógica bate.

## 2. GATE DE FECHO — ainda não cumprido, ação obrigatória do operador

**Esta entrega NÃO está confirmada como funcional.** Escrevi e revi
manualmente o código e os testes, e fechei por construção os dois riscos de
codificação Unicode que consegui identificar sem poder executar nada
(§1.2 e §1.3). Resta um risco que **só** um build/execução real apanha:

- **Chaves duplicadas silenciosas.** Um objeto/Set JS com uma chave repetida
  não dá erro de sintaxe — fica só com a última (`Object.fromEntries`/spread do
  `Set` herdam esse comportamento). `tsc`/lint apanha duplicados **exatos**
  (avisos de "duplicate key"); os meus `expect()` só apanham resultado errado
  em tokens **testados**. Revi manualmente por grep visual e não encontrei
  duplicados entre os tokens novos e os existentes, mas isso não é o mesmo que
  uma verificação de ferramenta.

**Ação obrigatória do operador antes de considerar isto fechado: correr
`npm run build` + `npm test`.** Se algo falhar, é nesse passo que aparece —
corrigir e voltar a correr. Diferença em relação à primeira versão deste log:
os riscos de forma Unicode (NFC/NFD) já não dependem desse passo — foram
fechados por construção em §1.2/§1.3; só falta a verificação de tipos/duplicados.

## 3. O que NÃO foi tocado, e porquê (limitações desta sessão)

- **C1/C2 — modelo em falta ou tier baixo por língua** (`VOICE-QUALITY.md §1`):
  continua a ser a causa **nº 1** de "não fala bem", e continua **fora de
  alcance**: exige aceder a `MODELS_DIR` (fora do repo) e à Hugging Face
  (piper-voices) para confirmar/instalar modelos `medium`+. Sem ferramentas de
  rede/execução nesta sessão, não pude sequer confirmar quais dos 38 modelos do
  `BENCHMARKS.md` estão instalados agora.
- **C3 — calibração de `length_scale` por medição**: precisa de correr o Piper e
  medir ms/fonema. Não corri nada. `VOICE_CALIBRATION` fica inalterado.
- **C4 — `noise_scale`/`noise_w`/`sentence_silence` por voz**: decisão de
  ouvido, deliberadamente vazia (`VOICE_PARAM_OVERRIDES = {}`). Não populei
  nenhum valor — inventá-los seria exatamente o que os ficheiros anteriores
  avisam para não fazer.
- **Correspondência Piper→OpenAI por-utilizador/por-língua**: continua por
  fazer (ver §1.4) — decisão de produto/UX, não resolvida às cegas aqui.
- **Léxico Latino: vários tokens do candidato ficaram de fora** (`ahoj`, `čau`,
  `helló`, `halló`, `zdravo`, `hvala`, o `merci` luxemburguês) por colisão
  identificada — ficam documentados aqui como "conhecidos, excluídos por
  desenho", não esquecidos.
- **Catalão (`cat`) continua sem líder de saudação curta** (`bon dia` tem 2
  tokens; a regra 3 só aceita 1 token líder) — gap já registado no
  `SPEECH-DATA-AUDIT.md` (G4), não corrigido aqui.
- **Build/testes não executados** (ver §2, GATE DE FECHO) — o maior risco
  residual desta entrega, agora reduzido a "chaves duplicadas" (os riscos de
  forma Unicode foram fechados por construção).

## 4. Impacto honesto (não sobrevender)

Isto fecha **C5 para texto curto** (a causa de **menor impacto** na priorização
do `VOICE-QUALITY.md §4`) para 20 línguas adicionais — e só ajuda línguas que
**já tenham um `.onnx` instalado** em `MODELS_DIR`. Também dá controlo real
sobre a voz do motor neural (antes: zero). O "upgrade de voz" pedido pela
tarefa global tem quatro alavancas reais de qualidade Piper
(`VOICE-QUALITY.md §0`); esta sessão não mexeu em qualidade de modelo/tier nem
em prosódia Piper — essas continuam a exigir acesso a `MODELS_DIR`/web (C1/C2)
ou áudio real (C3/C4), que não tive. **Pendente: correr `npm run build` +
`npm test` (§2) antes de declarar isto concluído.**
