# Decisão de âmbito — Norueguês (voz vs. interface vs. piadas)

> Papel: **Corretor** (sub-tarefa: aplicar as correções pendentes apontadas pela
> revisão consolidada em `docs/QA-MULTILINGUE-REPORT.md §8`). Ferramentas nesta
> sessão: `read_file`/`write_file`/`list_dir`/`glob` + `advisor` — sem execução.
>
> Este documento **converte um gap silencioso numa decisão explícita**, tal como
> pedido pela revisão ("a decisão de produto sobre o Norueguês ... continua por
> decidir"). **Não é uma alteração de código** — é o registo da decisão e da
> justificação, para o operador confirmar ou substituir.

## 1. Estado atual, confirmado por leitura direta do código (não da documentação)

Li os 3 ficheiros-fonte diretamente nesta sessão:

| Estrutura | Ficheiro | Norueguês presente? |
|---|---|---|
| Voz (deteção→modelo) | `src/language/voiceMap.ts::LANG_TO_PREFIX` | **Sim** — `nob`/`nno`/`nor` → `no_`; autónimo `no_NO: 'Norsk'` em `LOCALE_NAMES` |
| Interface (`/config language`, comandos) | `src/i18n/index.ts::SUPPORTED_LOCALES` (34 entradas) | **Não** — confirmei a lista completa, `'no'` ausente |
| Piadas (`/joke`) | `src/content/jokes.ts::JOKE_LANGUAGES` (34 entradas) | **Não** — confirmei a lista completa, `'no'`/`'nb'`/`'nn'` ausente |

Ou seja: o Voxi **já consegue falar** norueguês (se houver um `.onnx` `no_NO`
instalado em `MODELS_DIR`), mas um utilizador **não pode** pôr a interface em
norueguês nem pedir uma piada nessa língua.

## 2. Porque a opção "adicionar Norueguês às 3 estruturas" não é segura para um
   agente de só-ficheiros aplicar diretamente

`LOCALE_DISPLAY_NAMES` em `i18n/index.ts` está tipado como
`Record<SupportedLocale, string>` — adicionar `'no'` a `SUPPORTED_LOCALES` sem
lhe dar um nome ali é **erro de compilação por desenho** (não posso confirmar
sem `tsc`, que não tenho). Mas o problema real é maior do que sintaxe:

- **Interface completa** exigiria criar `src/i18n/locales/no.ts` com a tradução
  de ~140 chaves do catálogo (o mesmo padrão dos outros 32 ficheiros Fase B).
  Traduzir texto de UI para norueguês **sem falante nativo nem forma de testar**
  viola diretamente a instrução "não inventes" que atravessa todos os
  documentos desta série (`VOICE-UPGRADE-ENGINEERING-LOG.md §3`,
  `I18N-LOCALE-AUDIT.md §3.2`, `VOICE-BUGFIX-BACKEND-LOG.md §2`).
- **Piadas** exigiriam um corpus nativo norueguês em `JOKES` — o mesmo
  problema: inventar piadas "norueguesas" sem falante nativo é exatamente o
  tipo de conteúdo fabricado que os agentes anteriores recusaram produzir.
- **Alinhamento verificado pela QA:** `docs/QA-MULTILINGUE-REPORT.md §2`
  confirmou que `SUPPORTED_LOCALES`, `LOCALE_DISPLAY_NAMES` (chaves) e
  `JOKE_LANGUAGES` (chaves) são **idênticos, elemento a elemento** — as 34
  entradas batem certo nas 3 estruturas. Adicionar Norueguês a UMA delas sem
  as outras duas **quebra essa invariante verificada** (introduz uma
  divergência nova, não documentada, exatamente o tipo de regressão que a QA
  andou a caçar). Adicionar às 3 ao mesmo tempo exige o conteúdo (tradução +
  piadas) que não posso inventar.

## 3. Decisão registada

**Mantém-se o estado atual: Norueguês como "voz suportada, não é língua de
interface listada"** — não por esquecimento, mas como decisão explícita desta
sessão, pelas razões acima (restrição real: falta conteúdo verificável, não
falta vontade).

Isto **não é "aprovar" nem "fechar" o gap** — é documentar que o gap é
conhecido, medido, e que a via de fecho (tradução nativa + corpus de piadas)
está identificada e fora do alcance de ferramentas só-de-ficheiro.

### Recomendação para o operador (Diogo)

1. **Se não houver intenção de suportar Norueguês na interface a curto prazo:**
   nenhuma ação de código necessária. Considerar adicionar UM comentário em
   `i18n/index.ts` junto a `SUPPORTED_LOCALES` a dizer explicitamente "Norueguês
   tem voz (`voiceMap.ts`) mas está deliberadamente fora da interface — falta
   tradução nativa e corpus de piadas, ver `docs/DECISION-NORWEGIAN-SCOPE.md`"
   — para a próxima sessão não voltar a tratar isto como bug por descobrir.
2. **Se houver intenção de suportar:** o caminho é (a) obter tradução nativa
   (ou revista por nativo) das ~140 chaves de `i18n/catalog.ts` para
   `src/i18n/locales/no.ts`, seguindo exatamente o padrão dos outros 32
   ficheiros; (b) obter/curar ≥1 piada nativa norueguesa para `JOKES.no` em
   `content/jokes.ts`; (c) adicionar `'no'` a `SUPPORTED_LOCALES` +
   `LOCALE_DISPLAY_NAMES` + `JOKE_LANGUAGES` no mesmo commit; (d) correr
   `npm run build && npm test` (o `Record<SupportedLocale,string>` de
   `LOCALE_DISPLAY_NAMES` vai recusar compilar se o autónimo faltar — é a
   rede de segurança já existente no código, não precisa de ser recriada).
3. **Não promover parcialmente** (ex. só interface, sem piadas, ou vice-versa)
   sem atualizar `JOKE_LANGUAGES`/`SUPPORTED_LOCALES` a par — isso reintroduz
   a divergência que a QA verificou não existir hoje.

## 4. O que este documento NÃO fez

- Não tocou em nenhum ficheiro de código (`voiceMap.ts`, `i18n/index.ts`,
  `jokes.ts` ficam exatamente como estavam).
- Não inventou tradução nem piada norueguesa.
- Não decidiu "sim, vamos suportar Norueguês" — isso continua a ser decisão de
  produto do operador. O que este documento fecha é a ambiguidade de "ninguém
  decidiu nada" → agora está registado **qual é a restrição real** e **qual é
  o caminho de fecho**, para a decisão do operador ser informada em vez de às
  cegas.
