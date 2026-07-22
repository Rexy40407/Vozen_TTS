# Auditoria de dados de fala/lingua — línguas fracas

> Papel: **Especialista em Dados de Fala**. Sub-tarefa pedida: *"curar, limpar e
> alinhar datasets de áudio+transcrição de qualidade para as línguas fracas,
> identificando lacunas nos dados de treino"*.
> Este documento é o **diagnóstico ao nível dos DADOS** e é complementar de
> `docs/VOICE-QUALITY.md` (que já detém a análise de *causas* C1–C5 e das alavancas
> de modelo/prosódia). Não repito essa análise; ligo-me a ela.

## 0. Verificação da premissa (o mais importante)

**O Voxi não tem pipeline de treino, nem dataset, nem corpus áudio+transcrição.**
O motor é o **Piper** (`src/tts/piper.ts`), que consome modelos neurais `.onnx`
**pré-treinados** de https://huggingface.co/rhasspy/piper-voices. A pasta
`audio-cache/` é **saída sintetizada em cache**, não dados de treino; `tools/` são
probes de benchmark; não existe áudio+transcrição alinhado em lado nenhum do repo.

Consequência honesta: a tarefa **literal** — curar/alinhar *datasets de treino* — **não
tem referente aqui**. Não fiz (nem podia fazer) curadoria de corpus de treino, porque
não há treino. Não maquilhei isto com um reframe que finja o contrário.

O que **é** genuinamente "dados de fala" neste repo, e que eu **posso** curar, limpar
e alinhar com ferramentas de ficheiro, são os **dados de língua** que decidem *que voz
fala cada mensagem*:

- o mapa de deteção→modelo (`voiceMap.ts :: LANG_TO_PREFIX`),
- os autónimos do dropdown (`voiceMap.ts :: LOCALE_NAMES`),
- o **léxico de texto curto** (`greetings.ts :: LEXICON` / `GREETING_INITIAL`).

E entreguei a **metade "transcrição"** de um par áudio+transcrição que hoje falta: um
**corpus de frases de referência por língua**, que é exatamente o input que o método de
calibração A3 do `VOICE-QUALITY.md` descreve mas nunca fornece.

**Aviso de impacto (não sobrevender):** a causa nº 1 de "não fala bem" é **C1/C2** (não
há modelo `.onnx` para a língua, ou é de tier baixo) — e isso **eu não consigo tocar**
(só tenho ferramentas de ficheiro; sem web, sem a lista de modelos instalados, que vive
fora do repo). O trabalho de dados abaixo resolve a fatia **C5** (deteção de texto curto)
e **prepara** a A3 (calibração). **Só compensa para línguas que já tenham modelo
instalado** — sem modelo, a língua continua a garble na voz inglesa por muito bom que
seja o léxico.

## 1. Entregáveis (ficheiros de dados novos, sem alterar código)

Em `docs/speech-data/`:

| Ficheiro | O que é | Serve |
|---|---|---|
| `reference-sentences.json` | Corpus de **frases de referência por língua** (a metade *transcrição*). | A3 (medir ms/fonema → `VOICE_CALIBRATION`) e A5 (A/B de prosódia). |
| `lexicon-coverage.json` | **Matriz de cobertura** alinhando as 4 estruturas de dados de língua. | Ver quem tem/não tem léxico de texto curto; achar desalinhamentos. |
| `lexicon-candidates.json` | **Candidatos curados** de saudações para as 20 línguas sem cobertura. | Fechar C5/A4 — **com gate de verificação**. |

Segui o precedente do `VOICE-QUALITY.md`: **não alterei `greetings.ts` nem
`calibration.ts`**. Editar o léxico às cegas violaria a regra anti-colisão documentada
no próprio ficheiro (que exige verificação empírica com o `franc`, que não posso correr).

## 2. Cobertura curada e alinhada (o "limpar + alinhar")

Cruzei, byte-a-byte, as 4 estruturas. Resumo (detalhe em `lexicon-coverage.json`):

- **34 línguas** mapeadas em `LANG_TO_PREFIX` (deteção→modelo).
- **14** têm léxico de texto curto: `por, eng, spa, fra, deu, ita, nld, pol, tur, swe,
  fin, dan, ron, cat`.
- **20 não têm nenhum token de texto curto** → as suas saudações caem no `franc`, que
  erra em texto curto (documentado em `greetings.ts`) → **voz errada**. Estas são, ao
  nível dos dados, as **"línguas fracas" em texto curto**:
  `rus, ukr, ces, ell, hun, ara, cym, fas, isl, kat, kaz, ltz, lav, nep, slk, slv, srp,
  swh, vie, cmn`.

## 3. Lacunas e desalinhamentos encontrados (o "identificar lacunas")

- **G1 — 20 línguas sem léxico de texto curto** (lista acima). Lacuna de dados nº 1 na
  minha camada. Candidatos em `lexicon-candidates.json`.
- **G2 — Tokens em `LEXICON` que faltam em `GREETING_INITIAL`** (desalinhamento interno):
  - Romeno `buna` / `bună` — existem em `LEXICON` mas não lideram frase curta → "buna ce
    faci" não é apanhado pela regra da saudação-inicial.
  - Dinamarquês `hejsa` — idem.
- **G3 — `no_NO` (Norueguês) é display-only e não-roteável:** está em `LOCALE_NAMES`
  (autónimo "Norsk") mas **não há** `nor → no_` em `LANG_TO_PREFIX`. Um modelo Norueguês
  instalado mostraria o nome certo mas **nunca seria auto-selecionado** → texto Norueguês
  cai no fallback inglês (garble). É um bug de alinhamento, não só uma lacuna.
- **G4 — Catalão sem líder de saudação curta:** a única saudação (`bon dia`) tem 2 tokens
  e `GREETING_INITIAL` só aceita 1 token líder → frases catalãs curtas não são apanhadas
  pela regra 3.

## 4. Curadoria proposta (o "curar") — com gate

`lexicon-candidates.json` traz saudações **atestadas** (factos, não invenção) para as 20
línguas, divididas por risco:

- **Seguras (script único):** Cirílico/Grego/Árabe/Georgiano/CJK/Devanágari **não colidem**
  com o léxico Latino atual (`rus, ukr, ell, ara, fas, kat, kaz, nep, srp` (cirílico), `cmn`).
- **A verificar (Latino):** podem colidir entre si ou com tokens existentes — assinalei as
  colisões conhecidas (ex.: `ahoj` é comum a Checo **e** Eslovaco; `helo`/`hallo`/`merci`
  já pertencem a EN/DE/FR; `zdravo`/`hvala` são ambíguos SR/HR/SL).

**Gate obrigatório antes de fundir em `greetings.ts`:** (1) verificar com `franc` v5
(mesmo critério do ficheiro); (2) rever colisões; (3) confirmar o iso3 em
`LANG_TO_PREFIX`. Não fundi nada eu próprio — só forneci os dados curados e o gate.

## 5. Como isto liga ao objetivo global

O relato "em algumas línguas parece que não sabe falar" tem, ao nível dos dados, dois
tratamentos que preparei:

1. **Texto curto sai na voz errada (C5):** fechado pela curadoria do léxico (§4), quando
   verificada. Corrige saudações/frases curtas — o caso mais visível em chat.
2. **Ritmo por medir (C3/A3):** o `reference-sentences.json` dá a **transcrição** que
   faltava para o operador sintetizar, medir ms/fonema e preencher `VOICE_CALIBRATION`
   com números **medidos** (não inventados).

Ambos ficam atrás do pré-requisito **C1/C2** (ter um modelo `medium`+ instalado por
língua), que é do domínio do operador e está em `VOICE-QUALITY.md §2`.

## 6. Limitações (o que NÃO fiz e porquê)

- **Sem dataset de treino para curar** — o Voxi não treina. A tarefa literal não tem
  referente; entreguei a camada de dados de língua que existe de facto.
- **Só ferramentas de ficheiro:** sem web (não confirmo modelos em piper-voices), sem
  execução (não corri `franc` nem Piper, não sintetizei, não medi ms/fonema). Por isso
  **não preenchi valores de `VOICE_CALIBRATION`** — só o corpus para os medir.
- **Corpus de referência: metade transcrição, sem áudio.** O áudio gera-se sintetizando
  as frases; não o pude fazer aqui.
- **Confiança marcada por entrada.** Frases de script menos comum (`ka, kk, ne, lb`) ficam
  só com a saudação-semente e `confidence: low` — precisam de revisão por falante nativo /
  fonte verificada antes de servirem de ground-truth. Não fabriquei frases inteiras onde
  não tenho certeza (respeita "não inventes").
- **Candidatos de léxico não verificados:** entregues **com gate**, não fundidos. A
  verificação empírica com `franc` é obrigatória e não a pude correr.
- **Nenhuma alteração de código.** Consistente com o precedente do `VOICE-QUALITY.md`:
  os dados ficam prontos; a integração fica para quando houver verificação/medição.
