# Log de engenharia — correção de bugs de voz/i18n (Engenheiro Backend de Integração)

> Papel: **Engenheiro Backend de Integração**. Sub-tarefa: *"Corrigir os bugs de
> código identificados (deteção de idioma, fallback, chamadas à API de voz) e
> integrar o novo motor/vozes no bot Discord Voxi."*
>
> Ferramentas nesta sessão: `read_file`/`write_file`/`list_dir`/`glob` + `advisor`
> (sem execução — não corri `npm run build`/`npm test`, tal como todas as sessões
> anteriores documentadas em `docs/`).

## 0. Ponto de partida — o que já estava corrigido (verificado por leitura direta)

Antes de tocar em código, li os 5 documentos de auditoria/engenharia já existentes
(`VOICE-QUALITY.md`, `SPEECH-DATA-AUDIT.md`, `I18N-LOCALE-AUDIT.md`,
`VOICE-UPGRADE-ENGINEERING-LOG.md`) e depois **confirmei contra o código atual**
(não fiquei só pela documentação) que uma sessão anterior/paralela já tinha
aplicado, de facto, a maior parte do que a minha sub-tarefa pede:

- **Deteção de idioma** (`src/language/greetings.ts`, `detect.ts`): o léxico G1
  (20 línguas novas), a normalização NFC/`\p{M}` (fix do bug do Devanagari), e a
  remoção de `hej`→`swe`/`tak`→`dan` (violação da própria regra anti-colisão do
  ficheiro, identificada em `I18N-LOCALE-AUDIT.md §1`) **já estavam no código**,
  com comentários a documentar o porquê. Confirmei que `tests/greetings.test.ts`
  não tem nenhuma asserção a depender de `hej`/`tak` (a remoção não parte nada).
- **Fallback de voz** (`src/language/voiceMap.ts`): o alinhamento `nob`/`nno`/
  `nor` → `no_` (G3) já estava presente; `pickVoiceForLang` honra a voz
  preferida corretamente.
- **Chamadas à API de voz** (`src/tts/neural.ts`): `resolveNeuralModel()` (tier
  `tts-1-hd` por defeito) e `resolveNeuralVoice()` (as 6 vozes OpenAI, antes
  sempre presas a `'alloy'`) já estavam implementadas, com `cacheKey()` a
  discriminar `model::tier::voice` (evita servir áudio em cache da voz/tier
  antigos após mudar `OPENAI_TTS_MODEL`/`OPENAI_TTS_VOICE`).
- **Integração do operador com o novo motor/vozes:** confirmei em `.env.example`
  que `OPENAI_TTS_MODEL` e `OPENAI_TTS_VOICE` estão documentados (com os valores
  válidos e o comportamento de fallback) — a integração não fica só no código,
  o operador consegue mesmo alcançar as 6 vozes/2 tiers via `.env`.

**Não refiz nem toquei em nenhum destes ficheiros** — reproduzir um ficheiro
inteiro com conteúdo Unicode sensível (Devanagari, Perso-Árabe, Cirílico) sem
poder correr testes arriscaria uma regressão silenciosa exatamente do tipo que
essas sessões já preveniram. Tracei os testes existentes (`greetings.test.ts`,
`langDetect.test.ts`) contra o código para confirmar consistência, não os
reescrevi.

## 1. O que apliquei nesta sessão

### 1.1 `src/i18n/catalog.ts` — `preview.sample.pt` deixou de misturar inglês

**Bug:** a frase-amostra falada pelo `/voice preview` em português dizia
*"Ola, eu sou o Voxi. type it, hear it."* — a segunda frase nunca tinha sido
traduzida. Isto é a **única chave do catálogo que é literalmente lida em voz
alta pelo TTS** (todas as outras são texto de UI), por isso uma frase
bilingue soa a erro de sintetizador para um utilizador que escolheu PT — é
exatamente o tipo de "falha na língua" que a tarefa global pede para corrigir.

**Porque apliquei (e não só propus, ao contrário da sessão de auditoria
anterior):** confirmei as 3 diferenças que tornam este caso seguro:
1. Ao contrário de `help.title`/`welcome.footer` (que têm um comentário
   explícito "tagline fica em inglês em qualquer idioma, fallback a en"),
   `preview.sample` **não tinha** esse comentário — não há evidência de que a
   mistura fosse intencional.
2. Os 32 ficheiros `locales/<code>.ts` da Fase B **já traduziram esta frase
   por inteiro** (ex. `es`: "escríbelo, escúchalo"; `ca`: "Escriu-ho i
   escolta'l") — PT (curado à mão na Fase A) era a única exceção.
3. A alteração LÓGICA é 1 string, em ASCII/Latin-1 simples, sem risco de
   colisão/corrupção Unicode do tipo que bloqueou edições em `greetings.ts`.

**Correção:** `pt: 'Ola, eu sou o Voxi. escreve, ouve.'` (padrão
curto/imperativo, igual ao das outras traduções Fase B). Comentário adicionado
no próprio ficheiro a documentar o fix e o porquê de ser seguro.

**Verificação feita (e o seu limite real):** a ferramenta `write_file`
**reescreve o ficheiro inteiro** (~600 linhas), não só as 2 linhas alteradas —
por isso a integridade das ~140 chaves NÃO tocadas depende de eu ter
reproduzido o ficheiro fielmente, não só da edição em si. Reli o ficheiro
completo depois de escrever e confirmei visualmente que as zonas de maior
risco (aspas escapadas em `setup.noChannel`, concatenações `+` em
`membersBody`/`quickStartBody`, os emojis `✅❌⏳👋`, os placeholders
`` `{model}` ``/`{speed}` entre crases, acentos portugueses `é/ã/ç/á`)
renderizam de forma idêntica ao original. **Isto é evidência forte, não uma
garantia**: uma leitura visual não é um parser — uma aspa reta trocada por
aspa curva, ou uma vírgula em falta, não seria necessariamente visível a olho
nu e só um `tsc`/`npm test` real apanha isso com certeza. Por isso o gate da
§3 nomeia explicitamente `catalog.ts` como "ficheiro inteiro reescrito", não
"2 linhas mudadas". Confirmei também `tests/commandsPreview.test.ts`: usa
`t('preview.sample', 'en')` (locale por omissão da guild de teste é `'en'`),
por isso **não** é afetado por esta mudança em `pt`.

### 1.2 `src/content/jokes.ts` — comentário desatualizado sobre o Norueguês

**Bug (cosmético, não funcional):** o comentário no topo do ficheiro dizia
*"o Noruegues 'no_' NAO entra: so existe em LOCALE_NAMES, sem modelo/prefixo em
LANG_TO_PREFIX"* — isto ficou **factualmente errado** depois do fix G3 em
`voiceMap.ts` (que já mapeia `nob`/`nno`/`nor` → `no_`) ter sido aplicado sem
atualizar esta nota. Não é um bug de comportamento (`JOKE_LANGUAGES` continua
correto em não incluir `no`, porque não há corpus de piadas norueguesas — essa
é a razão real), mas induzia o próximo agente/programador a uma conclusão falsa
sobre o estado do `voiceMap.ts`.

**Correção:** reescrevi o comentário para refletir a causa real (falta de
corpus de piadas, não falta de prefixo/modelo). Mesmo aviso de §1.1 aplica-se:
`write_file` reescreveu o ficheiro inteiro (as ~34 piadas nativas em
Cirílico/Árabe/Georgiano/Devanagari/Han incluídas). Reli o ficheiro depois de
escrever e as piadas nativas renderizam byte-a-byte iguais às da versão
anterior — mesma ressalva: releitura visual, não `tsc`/teste real.

## 2. O que identifiquei mas **NÃO** apliquei (e porquê)

- **`stats.synthLatency` ausente em 32/32 `locales/<code>.ts`**
  (`I18N-LOCALE-AUDIT.md §3`): confirmei o bug (ex. `de.ts` salta diretamente
  de `stats.synthErrors` para `stats.voiceDrops`). **Não corrigi**: exigiria
  inventar traduções técnicas para línguas que não posso verificar (georgiano,
  nepali, cazaque, árabe, persa, etc.), violando "não inventes"; e cada
  ficheiro é um objeto minificado de 1 linha com Unicode denso — reescrever os
  32 sem poder correr `npm test` arrisca corrupção silenciosa não detetável por
  releitura visual. Além disso, o impacto é só de **UI** (`/stats` mostra 1
  linha em inglês), não de voz/deteção — fora do núcleo da minha sub-tarefa. O
  `t()` já faz fallback gracioso para `en`, por isso não há crash nem texto em
  falta, só inconsistência cosmética. Fica documentado aqui para uma sessão
  futura com acesso a `npm test`.
- **Tipagem mais estrita do registry de locales** (`I18N-LOCALE-AUDIT.md
  §3.2`, fecharia a causa raiz do ponto anterior): não apliquei — uma mudança
  de tipo que não posso compilar/testar pode introduzir um erro de build que
  eu não consigo ver.
- **Norueguês em `SUPPORTED_LOCALES`/`JOKE_LANGUAGES`**: deixado como está.
  Auditorias anteriores já marcaram isto como decisão de produto (não um bug),
  a decidir pelo operador/Diogo — não decidi por conta própria.
- **C1–C4 do `VOICE-QUALITY.md`** (modelo em falta/tier baixo/ritmo/timbre por
  voz): continuam fora de alcance — exigem `MODELS_DIR`, acesso à web
  (piper-voices) ou áudio real, nenhum disponível nesta sessão.

## 3. GATE DE FECHO — ainda por cumprir

Tal como todas as sessões anteriores documentaram: **esta entrega não está
confirmada por execução.** As duas edições desta sessão reescreveram o
ficheiro INTEIRO (`write_file` não faz edição parcial):

- `src/i18n/catalog.ts` — ~600 linhas reescritas, mudança lógica de 1 valor.
- `src/content/jokes.ts` — ~230 linhas reescritas, mudança lógica de 1 comentário.

A releitura completa pós-escrita (único mecanismo de verificação disponível
sem execução) confirmou as zonas de maior risco intactas, mas **não substitui
`tsc`/testes reais** — só deteta corrupção óbvia, não um erro de sintaxe subtil
(aspas, vírgulas, chaves).

**Ação obrigatória do operador antes de fechar:** correr `npm run build &&
npm test`. Focar em `tests/commandsPreview.test.ts`, `tests/i18n.test.ts` e
`tests/jokes.test.ts` para as duas mudanças desta sessão — nenhum teste
existente parece depender do texto exato de `preview.sample.pt` ou do
comentário de `jokes.ts`, mas só a corrida real confirma.

## 4. Resumo executável

| # | O que | Ficheiro | Estado |
|---|---|---|---|
| 1 | Deteção de idioma (G1 léxico, NFC, remoção hej/tak) | `language/greetings.ts` | Já aplicado (sessão anterior) — confirmado, não tocado |
| 2 | Fallback de voz (Norueguês G3) | `language/voiceMap.ts` | Já aplicado (sessão anterior) — confirmado, não tocado |
| 3 | Chamadas à API de voz (modelo+voz OpenAI configuráveis, cache correta) | `tts/neural.ts` | Já aplicado (sessão anterior) — confirmado, não tocado |
| 3b | `.env.example` documenta `OPENAI_TTS_MODEL`/`OPENAI_TTS_VOICE` | `.env.example` | Já aplicado (sessão anterior) — confirmado, não tocado |
| 4 | `preview.sample.pt` falava inglês misturado | `i18n/catalog.ts` | **Aplicado nesta sessão** (ficheiro inteiro reescrito) — pendente `npm test` |
| 5 | Comentário desatualizado sobre Norueguês | `content/jokes.ts` | **Aplicado nesta sessão** (ficheiro inteiro reescrito) — pendente `npm test` |
| 6 | `stats.synthLatency` ausente em 32 locales | `i18n/locales/*.ts` | Documentado, NÃO aplicado (exige tradução verificada + testes) |
| 7 | Tipagem mais estrita do registry de locales | `i18n/locales/index.ts` | Documentado, NÃO aplicado (exige compilação) |
| 8 | Norueguês fora de `SUPPORTED_LOCALES`/`JOKE_LANGUAGES` | `i18n/index.ts`, `content/jokes.ts` | Decisão de produto — não decidido aqui |
