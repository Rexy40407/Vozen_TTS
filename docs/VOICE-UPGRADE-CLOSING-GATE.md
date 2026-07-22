# Gate de fecho — upgrade de voz do Voxi (checklist único e definitivo)

> Papel: **Corretor**. Sub-tarefa: aplicar as correções apontadas pela revisão
> consolidada (ver citação completa em §0) sobre o trabalho de
> `VOICE-UPGRADE-ENGINEERING-LOG.md`, `VOICE-BUGFIX-BACKEND-LOG.md`,
> `QA-MULTILINGUE-REPORT.md` e `VOICE-EVAL-MOS-AB.md`.
>
> **Porque este documento existe:** a revisão apontou que os mesmos itens
> pendentes estão repetidos, com variações, em vários documentos
> (`VOICE-QUALITY.md`, `SPEECH-DATA-AUDIT.md`, `I18N-LOCALE-AUDIT.md`,
> `VOICE-UPGRADE-ENGINEERING-LOG.md`, `VOICE-BUGFIX-BACKEND-LOG.md`,
> `VOICE-EVAL-MOS-AB.md`, `QA-MULTILINGUE-REPORT.md`). Isto **não resolve**
> nenhum dos itens (ver §2 — nenhum é executável com ferramentas
> só-de-ficheiro), mas fecha o problema de "N sítios para verificar o mesmo
> gate": a partir de agora **este é o único documento a consultar** para saber
> o que falta antes de anunciar o upgrade como concluído. Os outros documentos
> continuam válidos para o *detalhe* (não foram apagados nem duplicados aqui).

## 0. A revisão que este documento fecha

> "O trabalho APLICADO ao código é sólido e correto por inspeção... PORÉM não
> posso certificar 'aprovado': (1) ... 'npm run build && npm test' correu a
> verde em ZERO sessões...; (2) a própria QA entregou veredito 'condicional,
> não aprovado incondicional'...; (3) a decisão de produto sobre o Norueguês...
> continua por decidir; (4) não se pode anunciar 'qualidade de voz melhorada'
> sem uma sessão MOS/A-B real... Ações obrigatórias antes de fechar: correr
> build+testes a verde, decidir o Norueguês, e conduzir pelo menos um MOS
> baseline."

## 1. Estado de cada ação obrigatória, à data desta sessão (2026-07-03)

| # | Ação obrigatória | Estado | Quem pode fechar | Onde está o detalhe |
|---|---|---|---|---|
| 1 | `npm run build && npm test` a verde | 🔴 **OPEN** — nunca corrido, em nenhuma sessão desta série (confirmado: todas as sessões documentadas usaram só `read_file`/`write_file`/`list_dir`/`glob`, sem ferramenta de execução) | Operador (ou um agente com ferramenta de shell) | `VOICE-UPGRADE-ENGINEERING-LOG.md §2`, `VOICE-BUGFIX-BACKEND-LOG.md §3`, `QA-MULTILINGUE-REPORT.md §5/§8` |
| 2 | Decidir o Norueguês | 🟡 **DECISÃO REGISTADA** nesta sessão — ver `docs/DECISION-NORWEGIAN-SCOPE.md`. Recomendação: manter voz-só até haver tradução nativa; caminho de promoção documentado. **Falta:** confirmação final do operador (aceitar a recomendação ou escolher promover) | Operador | `docs/DECISION-NORWEGIAN-SCOPE.md` (novo, esta sessão) |
| 3 | Conduzir ≥1 MOS baseline | 🔴 **OPEN** — protocolo e instrumentos existem (`VOICE-EVAL-MOS-AB.md`, grelhas em `docs/eval/`), **zero sessões conduzidas**, zero pontuações preenchidas | Operador + falantes nativos + Piper a correr | `docs/VOICE-EVAL-MOS-AB.md §7`, `docs/eval/*.template.json` |

**Nenhum item passou de OPEN para FECHADO por execução nesta sessão** — as
ferramentas disponíveis (`read_file`/`write_file`/`list_dir`/`glob`) não
executam `npm`, não tocam áudio, não recrutam falantes. Isto é consistente com
o que a própria revisão concluiu: "o gap é de VALIDAÇÃO, não de execução do
código". O item 2 avançou de "silenciosamente por decidir" para "decisão
explícita, à espera de confirmação" — o único movimento possível com estas
ferramentas.

## 2. Porque nenhum destes 3 itens é fechável com ferramentas só-de-ficheiro
   (para a próxima sessão não repetir a tentativa)

- **Build/testes:** exige um interpretador de comandos (`npm`, `tsc`, `vitest`)
  a correr no sistema de ficheiros real. `read_file`/`write_file` não
  executam código — só leem/escrevem texto. Não há forma de "simular" isto
  sem inventar um resultado (proibido).
- **MOS baseline:** exige (a) o binário Piper a correr, (b) os `.onnx` reais em
  `MODELS_DIR` (fora do repo), (c) falantes nativos a ouvir e pontuar áudio
  real. Nenhum destes três está ao alcance de ferramentas de ficheiro.
- **Norueguês:** a parte *decidível* por ferramentas de ficheiro (registar a
  restrição real e o caminho de fecho) **foi feita** nesta sessão. A parte que
  falta — tradução nativa + corpus de piadas, ou a confirmação do operador de
  não promover — exige, respetivamente, um falante nativo e uma decisão de
  produto humana. Nenhuma ferramenta fecha isso por si.

## 3. O que esta sessão verificou adicionalmente (não fecha o gate, reduz risco)

Como corretor, refiz — de forma independente — uma leitura completa de
`src/language/greetings.ts::LEXICON` (as ~340 entradas) e
`src/language/voiceMap.ts::LANG_TO_PREFIX`, à procura de chaves duplicadas
exatas por bloco de script (Latino, Cirílico, Perso-Arábico, Grego, Georgiano,
Devanagari, Han). **Não encontrei nenhuma duplicata.** Isto **converge** com o
achado independente de `QA-MULTILINGUE-REPORT.md §1/§5`, que já tinha feito a
mesma verificação.

**Isto não fecha o item 1 da tabela acima.** Duas leituras manuais
independentes que concordam aumentam a confiança, mas não substituem `tsc`:
nenhuma leitura visual humana (ou de agente) deteta com 100% de certeza uma
chave repetida em ~360 entradas, algumas delas em scripts com formas Unicode
visualmente indistinguíveis (NFC vs. NFD) — é precisamente o risco que
`VOICE-UPGRADE-ENGINEERING-LOG.md §1.3` já descreveu e que só o parser real
(`tsc`/Node a carregar o objeto) fecha com certeza.

Também li diretamente `src/i18n/index.ts` e `src/content/jokes.ts` para
confirmar, à data desta sessão, o estado exato usado em
`docs/DECISION-NORWEGIAN-SCOPE.md` (34 entradas em `SUPPORTED_LOCALES` e em
`JOKE_LANGUAGES`, `'no'` ausente de ambas) — não fiquei só pela descrição de
`I18N-LOCALE-AUDIT.md`/`QA-MULTILINGUE-REPORT.md`, confirmei contra o ficheiro
atual.

Não alterei nenhum ficheiro de **código** nesta sessão: não encontrei nenhum
defeito concreto e verificável que justificasse uma edição (o critério usado —
só editar código perante um bug confirmado, não para "melhorar" algo que já
passa por inspeção, para não repetir o risco de regressão silenciosa em
`write_file` que todas as sessões anteriores documentaram e evitaram).

## 4. Recomendação final — o que dizer publicamente até os 3 itens fecharem

- **Não anunciar** "build/testes passam" — não foi verificado por execução.
- **Não anunciar** "qualidade de voz melhorada" ou citar qualquer número MOS —
  nenhuma sessão perceptual foi conduzida.
- **Pode anunciar-se**, com confiança razoável (mas não "aprovado
  incondicional"): cobertura de deteção de saudações para mais 20 línguas,
  correção do bug de colisão hej/tak, roteamento do Norueguês na voz, controlo
  de voz/tier OpenAI, correção da amostra bilingue em `/voice preview`. Estes
  são factos de código verificados por leitura direta (duas vezes,
  independentemente) — não dependem de MOS para serem verdadeiros, só a
  frase "qualidade melhorada" (que é uma alegação percetual) depende.

## 5. Para o operador — as 3 ações que fecham isto

1. `npm run build && npm test` na raiz do repo. Se falhar, o erro aponta o
   ficheiro/linha — os candidatos de maior risco já estão identificados:
   `greetings.ts` (chaves duplicadas/Unicode), `catalog.ts` e `jokes.ts`
   (ficheiros reescritos por inteiro nesta série de sessões).
2. Ler `docs/DECISION-NORWEGIAN-SCOPE.md §3` e confirmar (ou substituir) a
   recomendação — é uma decisão de 1 parágrafo, não um projeto.
3. Seguir `docs/VOICE-EVAL-MOS-AB.md §5` (procedimento passo-a-passo) para
   conduzir pelo menos 1 sessão MOS com falantes nativos reais, começando
   pelas vozes do `code_evidenced_backlog` em
   `docs/eval/pronunciation-defects.template.json` (D1–D5 já semeados).
