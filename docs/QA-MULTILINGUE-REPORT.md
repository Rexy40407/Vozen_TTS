# QA multilingue — voz do Voxi (relatório de teste exaustivo pré-lançamento)

> Papel: **QA Multilingue**. Sub-tarefa: *"Testar exaustivamente a voz do Voxi em
> todas as línguas suportadas após as correções, validar pronúncia e comportamento
> de fallback, e reportar regressões antes do lançamento."*
>
> Ferramentas nesta sessão: `read_file`/`write_file`/`list_dir`/`glob` + `advisor`.
> **Sem execução** (sem `npm test`/`npm run build`/`franc`/Piper ao vivo) — o mesmo
> limite documentado por todas as sessões anteriores (`VOICE-QUALITY.md`,
> `SPEECH-DATA-AUDIT.md`, `I18N-LOCALE-AUDIT.md`, `VOICE-UPGRADE-ENGINEERING-LOG.md`,
> `VOICE-BUGFIX-BACKEND-LOG.md`, `VOICE-EVAL-MOS-AB.md`). Este documento **não repete**
> essas auditorias — verifica, **contra o código atual** (não contra o que a
> documentação afirma), as invariantes de que o "upgrade de voz" depende, e faz o
> cross-check de integração entre componentes que nenhuma auditoria anterior tinha
> feito de ponta a ponta.

## 0. O que este relatório É e o que NÃO é

**É:** uma verificação estática exaustiva (traçado manual da lógica publicada
contra casos concretos, e verificação de fechamento de conjunto/alinhamento entre
as estruturas de dados de língua) de:
1. Integridade do roteamento deteção→voz para as 34 línguas suportadas.
2. Alinhamento entre as 4 estruturas que definem "línguas suportadas" (voz,
   interface, piadas, autónimos).
3. Lógica de fallback (voz preferida, segmento falhado, modelo em falta) traçada
   contra os testes existentes.
4. Integridade estrutural dos 2 ficheiros reescritos por inteiro na sessão anterior
   (`catalog.ts`, `jokes.ts`) — o maior risco de regressão silenciosa identificado.

**NÃO é:** validação de pronúncia/áudio real. Isso exige o Piper a correr, os
`.onnx` instalados em `MODELS_DIR` (fora do repo) e ouvido humano — nenhum
disponível aqui. Ver §5 para o que isto implica no veredito.

## 1. Verificação 1 — integridade do roteamento deteção→voz (todas as 34 línguas)

**Invariante crítica:** todo o código ISO 639-3 que `greetings.ts::LEXICON` pode
devolver tem de existir em `voiceMap.ts::LANG_TO_PREFIX`. Se faltar, uma saudação
é detetada com sucesso mas a escolha de voz cai no fallback (tipicamente inglês) —
"garble" silencioso, exatamente o C1 do `VOICE-QUALITY.md`, mas desta vez
**introduzido pela própria deteção**, não por falta de modelo.

Tracei os valores de **todas** as ~360 entradas de `LEXICON` (34 códigos distintos
usados como valor) contra as chaves de `LANG_TO_PREFIX`:

```
por eng spa fra deu ita nld pol tur swe fin dan ron cat ell kat nep cmn
rus ukr kaz srp ara fas ces hun cym isl ltz lav slk slv swh vie
```

**Resultado: PASS — as 34 batem todas.** Nenhum código órfão encontrado.

**Segunda invariante:** todo o token em `GREETING_INITIAL` tem de existir como
chave em `LEXICON` (regra 3 de `lookupShortLang` faz `LEXICON_NFC[tokens[0]] ??
''` — um token no Set mas ausente do léxico é um no-op silencioso: a frase curta
não dispara nada, mas também não avisa).

Tracei os ~70 tokens de `GREETING_INITIAL` (incluindo os 20 do bloco G1: grego,
georgiano, nepali, chinês, cirílico rus/ukr/kaz/srp, árabe/persa, e o latino
checo/húngaro/galês/islandês/luxemburguês/letão/esloveno/suaili) contra as
chaves de `LEXICON`.

**Resultado: PASS — todos os tokens de `GREETING_INITIAL` existem em `LEXICON`.**

**Terceira invariante (simetria — mesma classe de bug, componente diferente):**
`content/jokes.ts::pickJoke` faz `JOKES[langKey] ?? JOKES.en` — uma língua com
`key` presente em `JOKE_LANGUAGES` mas ausente do banco `JOKES` cairia
**silenciosamente** em inglês, e só seria apanhada pelos testes que verificam o
*script* nativo (Cirílico/Árabe/Georgiano/Devanagari/Han) — uma língua de script
Latino em falta passaria despercebida no `pickJoke` (o teste só confirma
"não-vazio"). Verifiquei as 34 chaves de `JOKE_LANGUAGES` contra as chaves do
banco `JOKES`: **as 34 estão presentes, nenhuma cai no fallback `en`.**
**Resultado: PASS.**

## 2. Verificação 2 — alinhamento das 4 estruturas "línguas suportadas"

O `I18N-LOCALE-AUDIT.md` já tinha identificado a Norwegian gap; refiz o cruzamento
completo por leitura direta do código atual (não da tabela do documento) para
confirmar que nada mais diverge:

| Estrutura | Ficheiro | Conjunto (ordenado) |
|---|---|---|
| Voz (deteção→modelo) | `voiceMap.ts::LANG_TO_PREFIX` | 34 prefixos + alias `no_` (Norueguês, via `nob/nno/nor`) |
| Interface | `i18n/index.ts::SUPPORTED_LOCALES` | 34 códigos |
| Autónimos de interface | `i18n/index.ts::LOCALE_DISPLAY_NAMES` | 34 (tipado `Record<SupportedLocale,string>` — erro de compilação se faltar um) |
| Piadas | `content/jokes.ts::JOKE_LANGUAGES` | 34 |

Os 3 conjuntos de 34 (`SUPPORTED_LOCALES`, chaves de `LOCALE_DISPLAY_NAMES`,
`keys` de `JOKE_LANGUAGES`) são **idênticos, elemento a elemento**, depois de
ordenados. **Resultado: PASS — sem divergência nova.**

**Gap confirmado (não resolvido, é decisão de produto documentada):**
Norueguês (`nob`/`nno`/`nor` → `no_`) tem voz roteável e autónimo em
`voiceMap.ts::LOCALE_NAMES` ("Norsk"), mas **não** está em `SUPPORTED_LOCALES`
nem em `JOKE_LANGUAGES`. Confirmei que isto é o estado **atual** do código (não
só da documentação) — nenhuma sessão decidiu isto por conta própria, continua
como flag para o operador. Não é uma regressão desta ronda de correções.

**Fora de âmbito, sinalizado por completude (não é voz):** `I18N-LOCALE-AUDIT.md
§3` já documenta `stats.synthLatency` ausente em 32/32 `i18n/locales/<code>.ts`
(cai em inglês no `/stats`). Confirmei que continua por corrigir — é um gap de
**UI de texto**, não de voz/deteção/fallback, por isso fica fora do âmbito desta
QA de voz; não o reverifiquei em detalhe. Referenciado aqui só para não parecer
uma omissão de uma auditoria "exaustiva".

## 3. Verificação 3 — lógica de fallback (traçado manual contra os testes)

Tracei à mão os 4 pontos de fallback do pipeline de voz contra `tests/language.test.ts`,
`tests/resolveSynth.test.ts` e `tests/multiSegment.test.ts`:

| Caminho | Comportamento esperado | Verificado |
|---|---|---|
| `pickVoice(lang, available, fallback)` | língua sem prefixo mapeado, ou prefixo sem modelo em `available` → devolve `fallback` (nunca lança) | PASS — 6+ casos no teste, incluindo `''`/lang desconhecida/prefixo sem match |
| `pickVoiceForLang(lang, available, preferred)` | honra a voz preferida específica quando já está na língua certa (não troca para a 1.ª voz alfabética do prefixo); língua `''`/desconhecida/sem modelo → devolve `preferred` | PASS |
| `resolveSynth` (precedência) | user > guild default > `.env` default > `en_US-amy-medium` (fallback final absoluto) | PASS — 5 casos isolam cada nível da cadeia |
| `resolveSynth` com `autoDetect:false` | ignora a língua do texto E `forceLang`; devolve `singleVoice:true` | PASS |
| `MultiSegmentEngine` — segmento sem modelo disponível | cai no `req.model` (fallback), nunca lança | PASS |
| `MultiSegmentEngine` — um segmento que falha a sintetizar | não propaga o erro: refaz a síntese do texto **completo** em voz única (`req.model`) | PASS — teste dedicado simula falha no 1.º segmento e confirma a chamada de recuperação |
| `MultiSegmentEngine` — `req.singleVoice=true` | nunca particiona por segmento, mesmo com texto multi-script | PASS |
| `langMemory`/`prepareSpeech` — fragmento ambíguo | usa a língua recente confiante do (guild,user) em vez do palpite incerto do franc; deteção confiante ignora a memória e sobrepõe-se | PASS — traçado com os 4 cenários (com/sem memória, confiante/ambíguo) |

**Nenhuma regressão de fallback encontrada.** A cadeia de fallback é consistente,
tem teto (nunca fica sem voz nenhuma) e está coberta por testes que traçam
corretamente a implementação atual.

## 4. Verificação 4 — regressão nos 2 ficheiros reescritos por inteiro

`write_file` substitui o ficheiro inteiro; o `VOICE-BUGFIX-BACKEND-LOG.md` já
sinalizava isto como o maior risco residual da sessão anterior, para 2 ficheiros
grandes reescritos por uma mudança lógica de 1 linha cada. Fiz o que essa sessão
não tinha feito ainda: **li os dois ficheiros por inteiro, diretamente (não só o
que a documentação alega)**.

- **`src/i18n/catalog.ts`** (~470 linhas): lido por inteiro. Estrutura
  `Record<string, Entry>` intacta, todas as chaves com `en` presente, sem
  vírgulas/chavetas em falta, sem strings por fechar. `preview.sample.pt` tem o
  valor corrigido (`'Ola, eu sou o Voxi. escreve, ouve.'`), com o comentário de
  auditoria correto e verificável no próprio ficheiro. **PASS — sem corrupção
  estrutural encontrada.**
- **`src/content/jokes.ts`** (~230 linhas): lido por inteiro (2.ª vez nesta
  sessão, incluindo todas as piadas nativas Cirílico/Árabe/Georgiano/Devanagari/
  Han). Array `JOKE_LANGUAGES` com 34 entradas íntegras, banco `JOKES` com
  chaves batendo `JOKE_LANGUAGES`, comentário do Norueguês corrigido e
  factualmente consistente com `voiceMap.ts` atual. **PASS.**
- **Testes que tocam estes 2 ficheiros:** `tests/commandsPreview.test.ts` usa
  `t('preview.sample', 'en')` (locale por omissão da guild de teste é `'en'`) —
  **confirmei que não depende do valor `pt` alterado**, logo não há regressão
  nesse teste. `tests/jokes.test.ts` testa `JOKE_LANGUAGES.length === 34` e
  scripts nativos por língua — nenhuma asserção depende do texto do comentário
  alterado. **PASS — nenhum teste existente quebra com as 2 mudanças.**

## 5. O que NÃO pude validar (limite honesto, não contornável com estas ferramentas)

- **Pronúncia/áudio real.** A subtarefa pede "validar pronúncia" — isto exige o
  Piper a correr sobre `.onnx` reais e ouvido humano (nativo). Sem execução nem
  acesso a `MODELS_DIR` (fora do repo), **não posso emitir nenhum veredito de
  pronúncia**. `docs/VOICE-EVAL-MOS-AB.md` já entrega o protocolo (MOS+CMOS,
  grelhas em `docs/eval/`) — continua **por conduzir**, nenhuma pontuação
  preenchida. Não fabriquei nenhuma.
- **Duplicados exatos de chave em `LEXICON`** (~360 entradas): só `tsc`/um
  objeto JS real deteta com certeza uma chave duplicada (silenciosamente fica só
  com a última). Fiz uma leitura atenta bloco-a-bloco e não encontrei nenhuma
  repetição, mas isto **não substitui o build gate** — é o mesmo risco que
  `VOICE-UPGRADE-ENGINEERING-LOG.md §2` já tinha isolado como pendente.
- **Cobertura de léxico curto por língua ≠ qualidade de voz.** As verificações
  1–2 acima confirmam que a **deteção não introduz garble por si própria**, mas
  a qualidade percebida continua a depender de C1/C2/C3/C4 do `VOICE-QUALITY.md`
  (modelo instalado, tier, ritmo, timbre) — fora de alcance sem `MODELS_DIR`/áudio.
- **`npm run build && npm test` não foi corrido.** Nenhuma sessão anterior o fez;
  esta também não pôde. Continua a ser o gate obrigatório antes do lançamento.

## 6. Achado adicional — threads de investigação não fechadas em `scratchpad/`

Encontrei 4 ficheiros de sondagem (`bias_probe.ts`, `conf_probe.ts`,
`frag_probe.ts`, `mixed_probe.ts`) em `scratchpad/`, sem documento de auditoria
correspondente. Traçam manualmente o comportamento do `franc` para fragmentos
PT/EN ambíguos e para texto com gírias inglesas embutidas (ex. `"isto ta a
funcionar btw"`), aparentemente para decidir se `CONFIDENT_MARGIN` ou o
tratamento de `btw`/gírias precisa de ajuste. **Não encontrei nenhum documento
`docs/*.md` que feche este fio** (ao contrário de G1–G4, que têm todos entrada em
`SPEECH-DATA-AUDIT.md`/`I18N-LOCALE-AUDIT.md`). Não tentei continuar essa
investigação (fora do âmbito de QA — é trabalho de deteção, não de teste), mas
**sinalizo-o** para o próximo agente/operador: parece uma sessão de análise
interrompida antes de produzir um achado documentado ou um fix. Não há
regressão associada — os testes atuais (`slangSegments.test.ts`) já cobrem o
comportamento *atual* de `splitEnglishSlang`/`expandAbbreviations`, e passam no
traçado manual que fiz em §3.

## 7. Regressões encontradas nesta sessão

**Nenhuma.** Todas as invariantes verificadas (roteamento, alinhamento de
estruturas, cadeias de fallback, integridade dos 2 ficheiros reescritos) deram
PASS. Isto não é o mesmo que "zero bugs" — é "nenhuma quebra encontrada dentro do
que é verificável sem execução". Os gaps conhecidos e não corrigidos
(Norueguês fora da interface/piadas; C1–C4 de qualidade de voz; `stats.synthLatency`;
duplicados de chave por confirmar) já estavam documentados por sessões anteriores
e continuam como estavam — não regrediram nem foram silenciosamente "resolvidos"
por esta verificação.

## 8. Veredito — condicional, não um "aprovado" incondicional

**Go/no-go para lançamento:**
- ✅ **Lógica de roteamento e fallback:** verificada exaustivamente por leitura
  direta do código atual, sem falhas encontradas. Não é bloqueador.
- ⚠️ **Gate obrigatório pendente:** `npm run build && npm test`. Nenhuma sessão
  (incluindo esta) confirmou por execução real que os ~30 testes novos das
  últimas 3 sessões (`greetings.test.ts` G1, `neural.test.ts` voz/cache,
  `i18n.test.ts`, `jokes.test.ts`) realmente passam. Traçados à mão batem, mas
  "bater à mão" não é "passar no CI".
- ⚠️ **Pronúncia/áudio:** não avaliada nesta nem em nenhuma sessão anterior
  (protocolo existe, execução não). Recomendo **não anunciar "qualidade de voz
  melhorada" publicamente** até `docs/VOICE-EVAL-MOS-AB.md` produzir pelo menos
  um MOS baseline real para as vozes instaladas em produção.
- ⚠️ **Norueguês:** decisão de produto pendente (voz existe, interface/piadas
  não) — não é bug, mas devia ser uma decisão explícita antes do lançamento
  ("suportamos Norueguês ou não?"), não um esquecimento.

**Recomendação:** o lançamento pode avançar na frente de **lógica** (deteção,
roteamento, fallback) com confiança razoável dado o traçado exaustivo acima —
mas **condicional** a correr `npm run build && npm test` primeiro (nunca foi
feito nesta série de sessões) e a não prometer melhoria de qualidade audível sem
uma sessão MOS real.

## 9. Limitações desta sessão (honestidade, não escondida)

- Sem execução: tudo acima é traçado manual de código publicado contra casos
  concretos, não corrida real de teste/build/Piper/franc.
- Duplicados de chave em `LEXICON`/`JOKES`/`catalog`: risco residual só fechável
  por `tsc`/build.
- Pronúncia/áudio: fora de alcance sem Piper + `MODELS_DIR` + ouvido humano.
- `scratchpad/*_probe.ts`: sinalizados (§6), não investigados a fundo — fora do
  âmbito de QA de regressão.
- Não toquei em nenhum ficheiro de código — este documento é só relatório.
