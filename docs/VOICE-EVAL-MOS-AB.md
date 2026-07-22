# Avaliação de qualidade de voz por língua — MOS + A/B com falantes nativos

> Papel: **Avaliador de Qualidade com Falantes Nativos**. Sub-tarefa: *"definir e
> conduzir testes MOS e A/B com falantes nativos por língua, documentar defeitos de
> pronúncia e validar melhorias em cada iteração"*.
>
> Este documento **define o protocolo e entrega os instrumentos** (grelhas, esquemas
> de dados, taxonomia de defeitos, laço de iteração) para o operador **conduzir** a
> avaliação. Complementa — não repete — `docs/VOICE-QUALITY.md` (causas C1–C5 e as
> alavancas de código) e `docs/SPEECH-DATA-AUDIT.md` (camada de dados de língua).
> Fecha uma lacuna que ambos deixam explicitamente em aberto: o `VOICE-QUALITY.md §3`
> e a auditoria dizem que a afinação C4/A5 "exige o ouvido do operador / A-B" mas
> **nenhum fornece o instrumento A/B**. É esse instrumento que este documento entrega.

## 0. O que este documento É e o que NÃO é

**É:** um protocolo replicável (MOS + A/B/CMOS ancorado em ITU-T P.800), com grelhas
de pontuação em branco, uma taxonomia de defeitos de pronúncia, e um esquema de
registo de iterações — tudo pronto a preencher.

**NÃO é:** um relatório com resultados percetuais. **Não conduzi as sessões** (não
recruto falantes nativos, não reproduzo nem ouço áudio, não corro o Piper — só tenho
ferramentas de ficheiro). Por isso **nenhuma pontuação MOS nem preferência A/B foi
preenchida**. **Distinção importante:** pontuações *percetuais* (de ouvido) inventadas
são proibidas; mas defeitos **evidenciados pelo código** (factos derivados do repo) são
factos estabelecidos — esses **estão** semeados como backlog inicial em
`docs/eval/pronunciation-defects.template.json` (`provenance: code-analysis`), à espera
de confirmação de gravidade por nativo (ver §4 e §7).

## 1. Pré-requisito que restringe o âmbito (ler primeiro)

**Avalia-se por VOZ INSTALADA, não por língua mapeada.** Testar uma língua que **não
tem** modelo `.onnx` em `MODELS_DIR` mede a **voz inglesa de fallback** a ler texto
estrangeiro (o *garble* C1 de `VOICE-QUALITY.md`), **não** a voz dessa língua — um MOS
assim é ruído, não sinal. Por isso o conjunto de teste **arranca da lista de modelos
em runtime** (o `BENCHMARKS.md` regista **38** modelos em
`C:\Users\diogo\piper_pkg\piper\models`; a lista real vive **fora do repo**, o
`tools/bench.ts` descobre-a). Regra: **um plano de avaliação por cada `.onnx`
instalado**; línguas sem modelo ficam fora (o tratamento delas é C1/A1 — instalar o
modelo — não a avaliação).

**Estímulos = `docs/speech-data/reference-sentences.json`.** Reutiliza-se esse corpus
(não se cunham frases novas). Herda-se o seu **portão de confiança**: entradas com
`sentence: null` / `confidence: low` (`ka_GE`, `kk_KZ`, `ne_NP`, `lb_LU`) **não podem
servir de estímulo** enquanto não forem completadas. **Sinergia real:** o mesmo passo
de recrutamento de falantes nativos que este protocolo exige é o que **desbloqueia**
essas entradas do corpus — o falante nativo valida/escreve a frase antes de a pontuar
(ver §6.4). Não é duplicação de esforço; é o mesmo painel a fechar dois buracos.

## 2. Teste MOS — qualidade absoluta (snapshot por voz)

**Norma:** ITU-T P.800, escala **ACR** (Absolute Category Rating) de naturalidade.

| MOS | Naturalidade |
|---:|---|
| 5 | Excelente — indistinguível de fala humana |
| 4 | Boa — natural, imperfeições mínimas |
| 3 | Razoável — percetivelmente sintética mas confortável |
| 2 | Fraca — sintética e cansativa/estranha |
| 1 | Má — "não sabe falar" (fonemas errados, robótica, ininteligível) |

**Painel por língua:**
- **Falantes nativos** da língua avaliada (requisito não-negociável — só um nativo
  ouve fonemas/acentuação errados).
- **Mínimo ≥ 5 raters × ≥ 2 frases** por voz para o **snapshot MOS**. *Porquê este
  piso:* abaixo de ~5 raters o intervalo de confiança do MOS fica largo demais para
  distinguir uma voz "3.2" de uma "3.8" (o degrau que separa "aceitável" de "má");
  ≥ 2 frases evita que uma única frase infeliz decida o veredicto. É um **piso
  pragmático de self-host**, não a amostra de um paper (P.800 sugere ~15–30+);
  documenta-se o N real usado.
- **Apresentação cega e aleatorizada:** o rater **não** sabe que voz/tier ouve; ordem
  baralhada por rater. Evita viés de marca/expectativa.
- **Âncoras de calibração (hi/lo):** intercalar 1 amostra claramente boa (a voz-âncora
  `en_US-amy-medium`, já a referência do repo) e 1 claramente má (ex. um tier `x_low`
  ou a voz inglesa a ler a frase estrangeira — o garble C1) por sessão. Servem para
  **calibrar o rater** (quem dá 5 ao garble está a pontuar mal) e para normalizar entre
  raters. As âncoras **não** entram na média da voz sob teste.

**Saída:** MOS médio por voz + desvio-padrão + IC 95% + N. Grelha em branco:
`docs/eval/mos-scoresheet.template.json`.

## 3. Teste A/B + CMOS — validação de melhoria (o laço de iteração)

Para "**validar melhorias em cada iteração**" o instrumento certo **não** é o MOS
absoluto (que oscila com o painel), mas o **comparativo emparelhado** — mede o *delta*
A→B com o mesmo par de estímulos:

**Norma:** ITU-T P.800 **CCR/CMOS** (Comparison Category Rating), escala −3..+3:

| CMOS | B em relação a A |
|---:|---|
| +3 | Muito melhor |
| +2 | Melhor |
| +1 | Ligeiramente melhor |
| 0 | Igual |
| −1 | Ligeiramente pior |
| −2 | Pior |
| −3 | Muito pior |

Emparelhar com **escolha forçada A/B** ("qual soa mais natural?"). Uma iteração
"passa" se o **CMOS médio > 0 com IC 95% que NÃO cruza 0** (critério **primário**); a
escolha forçada, testada por um **binomial** (H0: 50/50), é **suplementar/corroborante**.

> **Potência estatística — reconciliar com o piso de §2.** O piso de ≥ 5 raters serve o
> *snapshot* MOS, mas é **subdimensionado para o binomial da escolha forçada**: com
> n = 5 só um 5/5 unânime atinge p ≈ 0.03 (4/5 dá p ≈ 0.19). Por isso o gate primário é
> o **IC do CMOS** (mais informativo por rater que um voto binário), e o binomial é
> corroborante. Para uma decisão A/B robusta usar um painel **maior que o piso MOS**
> (idealmente ≥ 12–15 raters); com n = 5, tratar o resultado como **indicativo**, não
> conclusivo, e não fundir só com base nele. Documentar sempre o N e o IC — não
> reportar "passou" sem eles.

**Cada A/B mapeia a UMA alavanca de código** (senão o teste é vago). Matriz:

| Iteração testa… | Alavanca (código) | A (antes) | B (depois) | Causa |
|---|---|---|---|---|
| Trocar tier | modelo em `MODELS_DIR` | `it_IT-riccardo-x_low` | `it_IT-*-medium` | C2 |
| Calibrar ritmo | `VOICE_CALIBRATION[model]` | `length_scale` atual | valor **medido** (método A3) | C3 |
| Timbre/pausa | `VOICE_PARAM_OVERRIDES[model]` | preset orgânico global | override parcial candidato | C4 |
| Preset global | `ORGANIC_LENGTH_SCALE` / `PIPER_DEFAULT_SYNTH_PARAMS` | preset X | preset Y | C4 |

> A linha C3 fecha o laço que o `VOICE-QUALITY.md A3` deixa aberto: a calibração de
> `length_scale` sai de **medição** (ms/fonema), e o A/B **confirma percetualmente** que
> o número medido soa melhor antes de o fixar em `calibration.ts`. Medição propõe; A/B
> dispõe.

**Saída:** por iteração — CMOS médio + IC, % preferência por B, p-valor, N, decisão
(merge / rejeitar). Grelha: `docs/eval/ab-cmos.template.json`. Registo cumulativo:
`docs/eval/iteration-results.template.json`.

## 4. Documentar defeitos de pronúncia (taxonomia + registo)

O MOS diz *quanto* soa mal; o registo de defeitos diz *o quê* e *onde* — o que
acciona a correção. Cada rater nativo, ao pontuar, **anota o defeito** por categoria:

| Código | Defeito | Exemplo típico | Alavanca provável |
|---|---|---|---|
| `G2P` | Fonema errado / grafema-para-fonema falhado | letra lida com som de outra língua | tier/modelo (C2) ou fallback (C1) |
| `STRESS` | Acentuação/tónica na sílaba errada | "cidáde" em vez de "cidade" | modelo (treino) |
| `RHYTHM` | Ritmo apressado/arrastado ("come as palavras") | frase sai 30% rápida | `VOICE_CALIBRATION` (C3) |
| `DIACRITIC` | Diacrítico mal tratado (til/cedilha/háček) | ã/ç/ř lidos como base | modelo / normalização de texto |
| `LOANWORD` | Estrangeirismo/nome próprio mal dito | palavra EN num texto PT | esperado; anotar frequência |
| `INTONATION` | Entoação plana/errada a nível de frase | pergunta soa afirmação | `noise_w`/params (C4) |
| `TONE` | Tom lexical errado (línguas tonais: `zh`, `vi`) — muda o **significado** | tom errado troca a palavra | modelo / params (C4) |
| `PAUSE` | Pausas a mais/menos entre frases | corrido ou entrecortado | `sentence_silence` (C4) |
| `TRUNCATION` | Corte/omissão de fim de palavra ou frase | última sílaba comida | modelo / `MAX_CHARS` |
| `GARBLE` | Ininteligível — voz da língua errada | texto turco em voz inglesa | **C1** (instalar modelo) |
| `OTHER` | Outro (descrever no campo livre) | — | — |

> `TONE` está separado de `INTONATION` de propósito: em Chinês/Vietnamita o tom é
> **lexical** (erra-o e a palavra muda de sentido), não apenas melodia de frase.

Esquema de registo (um evento por defeito ouvido):
`docs/eval/pronunciation-defects.template.json`. Campos-chave: `locale`, `model`,
`sentence_ref`, `defect_code`, `severity` (1–3), `timestamp_in_clip`, `rater_id`,
`note`, `provenance`. Isto transforma "não fala bem" em tickets accionáveis e ligados
à alavanca.

**Backlog inicial já semeado (factos de código, não pontuações de ouvido).** O mesmo
ficheiro traz um bloco `code_evidenced_backlog` com **5 defeitos já estabelecidos por
análise do repo** (`provenance: code-analysis`, `status: pending-native-confirmation`):
D1 `pt_PT-tugao-medium` **RHYTHM** (~30% rápido, mitigado C3), D2 `no_NO` **GARBLE**
(bug de alinhamento G3 — sem `nor→no_`), D3 `it_IT-riccardo-x_low` e D4 `en_GB-alan-low`
**tier baixo** (C2), D5 armadilha de **DIACRITIC** na chave de `VOICE_CALIBRATION`
(guarda de regressão). São o ponto de partida da 1.ª iteração (§6) — o falante nativo
**confirma a gravidade**, o defeito em si já é facto.

## 5. Procedimento passo-a-passo (o "conduzir")

Para **cada voz `.onnx` instalada**:

1. **Preparar estímulos.** Extrair a(s) frase(s) da língua de
   `reference-sentences.json` (saltar `confidence: low`/`null` até §6.4).
2. **Sintetizar os clipes.** Com o Piper, gerar o WAV de cada frase para: (a) a voz sob
   teste, (b) a âncora `en_US-amy-medium`, (c) as variantes A/B da iteração em curso.
   Guardar com nomes **cegos** (ex. `clip_017.wav`) e um mapa privado clip→condição
   que o rater não vê.
3. **Recrutar painel** (≥ 5 nativos/língua para MOS; ≥ 12–15 para A/B robusto — ver §3).
   Entregar as instruções de rater (`docs/eval/rater-instructions.md`).
4. **Sessão MOS** (§2): cada rater pontua 1–5 + anota defeitos (§4) por clipe, em ordem
   aleatória, com âncoras intercaladas.
5. **Sessão A/B/CMOS** (§3): pares A vs B da iteração; CMOS −3..+3 + escolha forçada.
6. **Consolidar** nas grelhas JSON de `docs/eval/`. Calcular médias, IC, p-valor.
7. **Decidir e registar** a iteração em `iteration-results.template.json` (merge só se
   passar o critério §3).

## 6. Laço de iteração — "validar melhorias em cada iteração"

```
  baseline MOS (§2)  ──►  identificar pior voz / defeito dominante (§4)
        ▲                                │
        │                                ▼
  registar iteração  ◄──  A/B da alavanca certa (§3)  ◄──  alterar 1 alavanca
   (results-log)              (CMOS + preferência)         (C2/C3/C4)
        │                                                       ▲
        └───────────────  repetir na próxima pior voz  ─────────┘
```

Regras do laço:
- **Uma alavanca por iteração.** Mudar tier E calibração ao mesmo tempo impede saber o
  que ajudou. Um A/B, uma variável.
- **Baseline antes de tocar.** Sem MOS/defeito de partida não há "antes" contra o qual
  validar. O baseline é a 1.ª passagem (§2) sem alterações. O `code_evidenced_backlog`
  (§4) dá os candidatos de arranque (D1 é o mais concreto: ritmo do tugão via C3).
- **Merge só com evidência.** Critério de passagem em §3. Uma iteração que não passa
  fica registada como **rejeitada** (evita repetir a mesma tentativa).
- **Priorizar por impacto** (segue `VOICE-QUALITY.md §4`): C1/C2 (modelo/tier) antes de
  C3 (ritmo) antes de C4 (timbre). Não afinar `noise_*` numa voz que ainda é `x_low`.

### 6.4 Passo que desbloqueia o corpus de baixa confiança

Para `ka_GE`, `kk_KZ`, `ne_NP`, `lb_LU` (e qualquer futura `confidence: low`): **antes**
da sessão de pontuação, o falante nativo **valida ou escreve** a frase de referência em
falta. O resultado volta a `reference-sentences.json` (subindo a `confidence`) e só
então a voz entra na avaliação. Assim o painel fecha o buraco do corpus e o da
avaliação na mesma sessão.

## 7. Limitações (o que NÃO fiz e porquê)

- **Nenhuma sessão conduzida.** Só tenho ferramentas de ficheiro: não recrutei
  falantes, não sintetizei clipes, não reproduzi nem ouvi áudio, não corri estatística.
  Entreguei **protocolo + instrumentos + backlog de defeitos evidenciados por código**,
  não resultados percetuais.
- **Grelhas percetuais em branco, marcadas `pending`.** **Nenhuma** pontuação MOS ou
  preferência A/B foi preenchida (precisam de raters/áudio). Inventá-las violaria "não
  inventes". Os defeitos do `code_evidenced_backlog` **não** são exceção a isto: são
  factos derivados do código (não pontuações de ouvido), marcados
  `pending-native-confirmation` quanto à *gravidade*.
- **Âmbito dependente de dados externos.** A lista dos 38 modelos instalados vive fora
  do repo; o plano por-voz materializa-se quando essa lista estiver acessível. Sem ela,
  o protocolo é completo mas os alvos concretos ficam por instanciar.
- **Corpus de baixa confiança bloqueia 4 línguas** (`ka/kk/ne/lb`) até serem validadas
  por nativo (§6.4) — herdado do portão de `reference-sentences.json`, não contornado.
- **Sem alteração de código.** Consistente com o precedente: os instrumentos ficam
  prontos; preencher `calibration.ts` fica para quando o A/B (§3) validar um valor
  medido — para não introduzir regressão audível.
- **N pragmático, não de paper.** O piso ≥ 5 raters é de self-host para o snapshot MOS;
  o A/B fiável precisa de mais (§3). Para publicação seria ≥ 15–30 (P.800). Documentado
  para não sobrevender a força estatística.
```
