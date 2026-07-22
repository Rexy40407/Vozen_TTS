# Auditoria de i18n/locale — deteção de idioma, pronúncia e encoding

> Papel: **Especialista em Localização/i18n**. Sub-tarefa: *"Mapear todas as
> línguas que o Voxi deveria suportar, reproduzir e catalogar onde a deteção
> de idioma, pronúncia ou encoding falham, e propor correções na lógica de
> i18n/locale."*
>
> Ferramentas disponíveis nesta sessão: só leitura/escrita de ficheiros (sem
> execução — não corri `npm test`/`npm run build`/`franc`/Piper). "Reproduzir"
> significa aqui **traçar à mão** a lógica publicada no código contra inputs
> concretos, tal como o precedente em `docs/VOICE-UPGRADE-ENGINEERING-LOG.md
> §1.2` já fez para o Devanagari — não execução real.
>
> Este documento é **complementar**, não duplicado, a `docs/SPEECH-DATA-
> AUDIT.md` e `docs/VOICE-UPGRADE-ENGINEERING-LOG.md` (que já cobrem
> exaustivamente `language/detect.ts` + `language/greetings.ts` + o léxico de
> saudações — G1-G4). Confirmei por leitura direta que os fixes G2/G3
> reclamados nesses documentos **estão de facto no código atual** (não fiquei
> só pela documentação):
>  - `voiceMap.ts::LANG_TO_PREFIX` tem `nob`/`nno`/`nor` → `no_` (fecha G3).
>  - `greetings.ts::GREETING_INITIAL` tem `buna`/`bună`/`hejsa` (fecha G2).
>  - As 20 línguas do G1 (rus/ukr/kaz/srp/ara/fas/ell/kat/nep/cmn/ces/hun/cym/
>    isl/ltz/lav/slk/slv/swh/vie) têm entradas em `LEXICON`.
>
> O meu foco foi a camada que esses documentos **não** cobriram: `src/i18n/`
> (catálogo de interface + 32 ficheiros `locales/<code>.ts`) e dois pontos de
> deteção que a auditoria de dados anterior não tinha isolado.

## 0. Mapa de línguas do Voxi (o que existe, onde)

O Voxi tem **três listas de línguas distintas**, que deveriam estar alinhadas
mas não estão 100%:

| Camada | Ficheiro | Contagem | Fonte de verdade |
|---|---|---|---|
| Voz (deteção→modelo Piper) | `language/voiceMap.ts::LANG_TO_PREFIX` | 34 prefixos distintos (+ alias `nob`/`nno`/`nor`→`no_`) | ISO 639-3 |
| Interface (texto dos comandos) | `i18n/index.ts::SUPPORTED_LOCALES` | 34 códigos ISO 639-1-ish | Suposto = línguas de voz |
| Piadas (`/joke`) | `content/jokes.ts::JOKE_LANGUAGES` | 34 | Suposto = línguas de voz |

**Achado 0.1 — Norueguês é a única língua com voz mas sem interface nem
piada.** `LANG_TO_PREFIX` mapeia `nob`/`nno`/`nor` → `no_`, e `LOCALE_NAMES`
tem o autónimo `no_NO: 'Norsk'` — ou seja, o Voxi **pode falar** norueguês se
houver um modelo instalado. Mas `SUPPORTED_LOCALES`/`LOCALE_DISPLAY_NAMES`/
`i18n/locales/index.ts` **não têm `'no'`**, e `JOKE_LANGUAGES` também não. Um
admin norueguês nunca pode pôr `/config language` em norueguês, nem pedir uma
piada em norueguês — mesmo que o bot já lhe fale nessa língua.

Isto é provavelmente uma decisão de âmbito deliberada (falta comentário
explícito a justificar), não decido por ele — **flag, não fix**.

**Achado 0.2 — comentário desatualizado em `content/jokes.ts` sobre o próprio
Norueguês.** O comentário no topo do ficheiro diz: *"o Noruegues 'no_' NAO
entra: so existe em LOCALE_NAMES, sem modelo/prefixo em LANG_TO_PREFIX"*. Isto
está **factualmente errado no código atual**: li `voiceMap.ts` diretamente e
`nob`/`nno`/`nor` **têm**, sim, um prefixo (`no_`) em `LANG_TO_PREFIX` (fix G3,
já integrado — ver acima). O comentário ficou por atualizar depois desse fix
ser aplicado a `voiceMap.ts` sem tocar em `jokes.ts`. Não é um bug funcional
(o `JOKE_LANGUAGES` continua correto em não incluir `no`, já que não há corpus
de piadas norueguesas), mas é uma **fonte de desinformação para o próximo
agente** que leia esse ficheiro e conclua algo falso sobre o estado do
`voiceMap.ts`. Proposta: atualizar o comentário para refletir a razão real
(falta de corpus de piadas, não falta de prefixo).

## 1. Achado principal — deteção de idioma: dois tokens no léxico violam a
   própria regra anti-colisão do ficheiro

`language/greetings.ts` documenta explicitamente, no topo do ficheiro:

> "REGRAS anti-colisao: só entram tokens FORTEMENTE associados a uma língua.
> Tokens ambíguos entre línguas (**"ok", "no", "si", "ja", "dag", "hej"**) são
> DELIBERADAMENTE deixados de fora"

Tracei à mão o próprio `LEXICON` do ficheiro contra essa regra e encontrei
**uma violação direta e uma por extensão do mesmo princípio**:

### 1.1 `hej: 'swe'` — o próprio token que o comentário diz estar excluído

`LEXICON` tem, byte-a-byte:
```
hej: 'swe',
hejsan: 'swe',
```
`hej` é a saudação mais comum do **dinamarquês** e também existe em
**norueguês** ("hei"/"hej" informal) — exatamente o tipo de token que o
comentário do próprio ficheiro nomeia como exemplo do que deve ficar de fora.
`hej` está também em `GREETING_INITIAL`, o que agrava o impacto (dispara
também a regra 3, frases curtas iniciadas por saudação).

**Reprodução à mão** (`lookupShortLang`, PURO, tracei a função linha a linha):
- Input `"hej"` → `normalize()` → `"hej"` → 1 token → `LEXICON_NFC['hej']` =
  `'swe'`. **Um dinamarquês que escreve "hej" (a saudação mais comum da
  língua) é detetado como sueco** e ouve a mensagem seguinte na voz sueca
  (via `pickVoiceForLang('swe', …)`), mesmo tendo `dan` como língua correta e
  um modelo `da_DK` eventualmente instalado.
- Input `"hej hvordan har du det"` (dinamarquês, "hej, como estás") → 5
  tokens → não bate a frase inteira → `tokens.length > 1` → regra 3: 5
  palavras excede `MAX_GREETING_PHRASE_TOKENS` (4), **então cai no franc**.
  Ou seja, o impacto real está concentrado no caso de **saudação isolada**
  ("hej" sozinho, ou até 4 palavras a começar por "hej") — o caso mais comum
  em chat casual.
- Efeito equivalente para `hei: 'fin'` num utilizador **norueguês**: "hei" é
  também norueguês comum, e está mapeado só para finlandês. Não está citado
  literalmente no comentário anti-colisão (só "hej" está), mas é o mesmo
  princípio: nenhuma entrada de norueguês existe no léxico (consistente com o
  Achado 0.1), por isso o norueguês nunca "ganha" — só pode ser
  **misdetetado** como outra língua nórdica ou cair no franc.

### 1.2 `tak: 'dan'` — extensão do mesmo princípio (não citado no comentário,
   inferência minha)

```
hejsa: 'dan', tak: 'dan',
```
`tak` é a palavra dinamarquesa para "obrigado" — mas **"tak" em polaco
significa "sim"**, uma das palavras mais frequentes do polaco em qualquer
chat ("tak, claro", "tak, obrigado"). O polaco **já tem** cobertura própria no
léxico (`cześć`/`dzień dobry`/`dziękuję`), por isso não há colisão de CHAVE no
objeto JS (só o dinamarquês usa a chave `'tak'`) — mas há colisão **semântica
real**: um utilizador polaco a escrever "tak" sozinho (resposta afirmativa
curtíssima, muito comum) é detetado como **dinamarquês**, não polaco.

Isto **não** está no exemplo do comentário original (só nomeia "dag"/"hej"),
por isso marco-o como a **minha inferência**, com confiança um pouco menor do
que o caso `hej` (que é uma violação *citada literalmente* pelo próprio
ficheiro) — mas segue exatamente a mesma regra que o ficheiro diz aplicar.

### 1.3 Proposta de correção (NÃO aplicada — ver §5 sobre porquê)

Remover as duas entradas ambíguas de `LEXICON` (e `hej` de `GREETING_INITIAL`):
```diff
- hej: 'swe',
  hejsan: 'swe',
  tack: 'swe',
  hei: 'fin',
  moikka: 'fin',
  kiitos: 'fin',
  hejsa: 'dan',
- tak: 'dan',
```
e em `GREETING_INITIAL`:
```diff
- 'cześć', 'czesc', 'merhaba', 'selam', 'hej', 'hejsan', 'hei', 'moikka',
+ 'cześć', 'czesc', 'merhaba', 'selam', 'hejsan', 'hei', 'moikka',
```
**Trade-off explícito, não escondido:** remover `hej: 'swe'` degrada a
deteção de saudações **suecas** curtas ("hej" sozinho deixa de bater no
léxico e cai no franc, que pode ou não acertar sueco vs. dinamarquês vs.
norueguês em texto curto — não posso verificar sem `franc`). Ou seja, isto
não é um "fix grátis": troca um falso-positivo determinístico (dinamarquês/
norueguês sempre errado) por uma incerteza (sueco passa a depender do franc).
A decisão correta depende de qual erro é mais comum na base de utilizadores
real do Voxi — dado que não tenho essa telemetria, **não decidi por conta
própria**; deixo a proposta com o trade-off explícito para o operador/próximo
agente decidir, e recomendo o mesmo gate que `VOICE-UPGRADE-ENGINEERING-LOG.md
§2` já usou: **correr `npm test` (`tests/greetings.test.ts` já cobre este
ficheiro e não tem nenhuma asserção sobre `hej`/`tak`, logo a remoção não
parte nenhum teste existente) antes de fechar.**

**Porque não apliquei a edição eu próprio:** `greetings.ts` é um ficheiro
grande (~340 entradas), com tokens não-Latinos (Devanagari, Perso-Arábico,
Cirílico) cuja forma Unicode exata (NFC vs. NFD) é **indistinguível a olho
nu** — o próprio ficheiro documenta isto na secção sobre `LEXICON_NFC`. A
única ferramenta que tenho para editar é `write_file` (substituição de
ficheiro inteiro, sem edição parcial). Reproduzir o ficheiro inteiro à mão
para mudar 2 linhas arrisca corromper silenciosamente um token não-Latino
já corrigido por uma sessão anterior — dano que não consigo detetar sem
correr os testes. Prefiro entregar a proposta exata (acima, com diff) a
arriscar essa regressão.

## 2. `preview.sample` (pt) — string FALADA pelo TTS mistura português e inglês

`src/i18n/catalog.ts`, chave `preview.sample` (a frase-amostra do `/voice
preview`, tocada em voz alta — é a ÚNICA chave "falada" do catálogo, conforme
o próprio comentário do ficheiro):

```
en: "Hi, I'm Voxi. type it, hear it.",
pt: 'Ola, eu sou o Voxi. type it, hear it.',
```

A tradução `pt` **não traduziu a segunda frase** — fica com "type it, hear
it." em inglês dentro de uma frase portuguesa, que é literalmente lida em voz
alta pelo TTS a utilizadores que escolheram português. Confirmei por leitura
direta de todos os 32 `locales/<code>.ts` que **nenhum outro** tem este
problema — todos traduziram a frase completa, ex.:
- `es`: "Hola, soy Voxi. escríbelo, escúchalo."
- `fr`: "Salut, je suis Voxi. Tapez-le, entendez-le."
- `de`: "Hi, ich bin Voxi. Tippen, hören."
- `ca`: "Hola, soc en Voxi. Escriu-ho i escolta'l."

**Calibração de confiança:** não é um "bug" no sentido de crash ou key
faltando — `catalog.ts` documenta deliberadamente que a tagline de marca
("type it, hear it" / a mesma ideia) fica em inglês para `pt` em **duas
outras** chaves (`help.title`, `welcome.footer`, ambas com o comentário "Sem
pt: a marca/tagline é a mesma em qualquer idioma"). É possível que
`preview.sample` devesse seguir a mesma regra deliberadamente. **Mas**: (a)
`preview.sample` NÃO tem esse comentário — não há evidência de que a mistura
ali seja intencional, ao contrário das outras duas chaves; (b) ao contrário
de `help.title`/`welcome.footer` (texto de UI, lido em silêncio), esta chave é
**falada**, pelo que uma frase bilingue soa como um erro de sintetizador, não
como uma escolha de marca; (c) os 32 locales da Fase B traduziram-na por
inteiro, criando uma assimetria onde PT (a língua mais cuidada, curada à mão
na Fase A) é a ÚNICA com esta mistura.

**Proposta de correção** (diff mínimo, uma linha, ficheiro pequeno — risco
baixo, mas não apliquei por decisão de manter o mesmo padrão de "propor, não
tocar" desta sessão sem poder correr testes):
```diff
- pt: 'Ola, eu sou o Voxi. type it, hear it.',
+ pt: 'Ola, eu sou o Voxi. escreve, ouve.',
```
(`escreve, ouve` segue o padrão imperativo curto usado pelas outras traduções
Fase B — es "escríbelo, escúchalo", ca "Escriu-ho i escolta'l".)

## 3. `stats.synthLatency` — chave ausente em TODOS os 32 ficheiros Fase B

`catalog.ts` define:
```
'stats.synthLatency': {
  en: 'Synthesis latency: p50 {p50}ms / p95 {p95}ms ({count} samples)',
  pt: 'Latencia de sintese: p50 {p50}ms / p95 {p95}ms ({count} amostras)',
},
```
Li os **32** ficheiros `src/i18n/locales/*.ts` (ar, ca, cs, cy, da, de, el,
es, fa, fi, fr, hu, is, it, ka, kk, lb, lv, ne, nl, pl, ro, ru, sk, sl, sr,
sv, sw, tr, uk, vi, zh) por inteiro. **Nenhum** tem a chave
`stats.synthLatency` — em todos, a lista salta diretamente de
`stats.synthErrors` para `stats.voiceDrops`. Confirmado por inspeção direta,
não por amostragem.

**Efeito:** `t('stats.synthLatency', locale, …)` cai sempre no fallback `en`
(`fromRegistry` = `undefined` para as 32 línguas Fase B, e o catálogo só tem
`en`/`pt` inline) — ou seja, **32 das 34 línguas de interface mostram esta
linha do `/stats` sempre em inglês**, mesmo com `/config language` configurado
para outra língua. É a única linha do `/stats` com este problema (confirmei
que as outras ~10 chaves `stats.*` existem em todos os 32 ficheiros).

### 3.1 Causa raiz — o registry não é type-checked contra o catálogo

`src/i18n/locales/index.ts`:
```ts
export const locales: Record<string, Record<string, string>> = {
  ar, ca, cs, cy, da, de, el, es, fa, fi, fr, hu, is, it, ka, kk,
  lb, lv, ne, nl, pl, ro, ru, sk, sl, sr, sv, sw, tr, uk, vi, zh,
};
```
O tipo é `Record<string, string>` — **qualquer** string como valor de chave
compila, incluindo um ficheiro a que falte uma chave do `catalog`. O `tsc`
não tem como detetar esta lacuna porque não há relação de tipo entre
`Object.keys(catalog)` e as chaves exigidas em cada `locales/<code>.ts`. É
exatamente por isto que uma chave (`stats.synthLatency`) escapou a 32
ficheiros sem nenhum erro de compilação — e é o mesmo motivo por que eu não
posso garantir, só por leitura, que esta seja a ÚNICA lacuna (ver limitação
em §5).

### 3.2 Proposta de correção

1. **Curto prazo (dados):** adicionar `stats.synthLatency` aos 32 ficheiros.
   Não fiz a tradução das 32 strings aqui — são triviais (mesma forma que
   `stats.synthErrors`/`stats.cacheHits` adjacentes em cada ficheiro, já
   traduzidas), mas prefiro não as inventar às cegas num ficheiro que não
   posso testar; o padrão a seguir está nas outras chaves `stats.*` já
   presentes em cada locale.
2. **Longo prazo (arquitetura, fecha a causa raiz):** apertar o tipo do
   registry para a união das chaves do `catalog`, ex.:
   ```ts
   type CatalogKey = keyof typeof catalog;
   export const locales: Record<string, Partial<Record<CatalogKey, string>>> = { … };
   ```
   Isto não obriga tradução completa (continua opcional/parcial, como hoje),
   mas faz o `tsc` recusar uma chave **inexistente no catálogo** (erro
   simétrico ao que já existe) e — mais importante para este caso — permite
   escrever um teste `for (const locale of Object.values(locales)) for (const
   key of Object.keys(catalog)) …` que reporte lacunas automaticamente. Esse
   teste de paridade (não escrito aqui, é trabalho de código) seria o
   substituto automatizado da auditoria manual §3 acima, e devia correr no
   CI para impedir que a próxima chave nova no catálogo repita este caso.

## 4. Placeholders `{param}` — amostragem dirigida (NÃO é uma verificação
   exaustiva)

`interpolate()` em `i18n/index.ts` substitui só as chaves `{param}` que
existirem no objeto `params`; um placeholder mal escrito numa tradução
(ex. `{canal}` em vez de `{channel}`) falha **silenciosamente** — o texto
final mostra literalmente `{canal}` em vez do valor, sem exceção nem log.
É a classe de erro de maior severidade nesta camada porque não há sinal
nenhum em runtime.

Amostrei **5 locales** (`de`, `ar`, `zh`, `ru`, `cy` — cobrindo Latino
acentuado, RTL, CJK, Cirílico e um Latino "exótico") contra **5 chaves** com
placeholders (`join.missingPerms{channel}`, `voice.set{name}{speed}{model}`,
`voice.abbrev.capReached{cap}`, `config.defaultVoiceSet{name}{model}`,
`welcome.description{setup}{help}`) — as 25 combinações batem exatamente com
os nomes de placeholder do `catalog.ts`. **Isto é uma amostra dirigida, não
uma auditoria completa** (137 chaves × 34 locales = 4 658 combinações
possíveis) — não afirmo que não haja nenhum mismatch nas restantes.

**Proposta:** o mesmo teste de paridade de chaves (§3.2) pode ser estendido
para também comparar o CONJUNTO de placeholders `{...}` de cada tradução
contra a versão `en`, com uma regex simples (`/\{(\w+)\}/g`) — deteta tanto
placeholder trocado como removido/acrescentado, sem precisar de saber
nenhuma língua. Isto fecha por construção a classe de erro inteira, em vez de
depender de amostragem manual.

## 5. Limitações honestas desta sessão

- **Sem execução.** Não corri `franc`, Piper, `npm test` nem `npm run build`.
  Todas as "reproduções" acima são traçados manuais da lógica publicada
  contra inputs concretos (mesmo método do precedente em
  `VOICE-UPGRADE-ENGINEERING-LOG.md §1.2`), não execução real. Onde a
  proposta de correção precisa de validação empírica (§1.3 — impacto em
  "hej" sueco), disse-o explicitamente em vez de fingir certeza.
- **Paridade de chaves: confirmei só UMA lacuna (`stats.synthLatency`) por
  leitura direta e completa dos 32 ficheiros.** Não fiz o diff byte-a-byte
  das 137 chaves × 32 locales — seria ~4 600 comparações, inviável à mão sem
  risco de erro humano maior do que o problema que se quer apanhar. A
  auditoria completa exige o teste automatizado proposto em §3.2, que é
  trabalho de código (fora do que "ferramentas de ficheiro" conseguem fazer
  com segurança nesta sessão).
- **Placeholders: amostra dirigida de 5×5, não exaustiva** (ver §4).
- **Nenhuma alteração de código foi aplicada.** Land a proposta de
  `greetings.ts` (§1.3) e `stats.synthLatency` (§3.2) exige reescrever
  ficheiros com conteúdo Unicode não-Latino sensível a NFC/NFD, usando uma
  ferramenta que só substitui o ficheiro inteiro (`write_file`, sem edição
  parcial) — risco de corrupção silenciosa que não consigo detetar sem
  correr os testes. Segui o mesmo precedente de `SPEECH-DATA-AUDIT.md` e
  `VOICE-QUALITY.md`: diagnóstico + proposta com diff exato, sem tocar no
  código, exceto onde explicitamente notado.
- **Exceção parcial — `catalog.ts::preview.sample`:** é a única correção
  desta lista pequena e de baixo risco (uma linha, ficheiro sem tokens
  Unicode frágeis) o suficiente para eu poder aplicar com confiança; mesmo
  assim, optei por **propor** em vez de aplicar, para manter uma única
  política consistente nesta sessão (tudo fica em proposta até o operador
  correr `npm run build && npm test`) em vez de misturar "algumas coisas
  apliquei, outras não" sem um critério visível.
- **Achado 0.1 (Norueguês) e §1.2 (`tak`/polaco) são inferências, não
  factos documentados no código** — marcados como tal, com confiança mais
  baixa do que o achado `hej` (citado literalmente pelo próprio ficheiro).
- **Gate obrigatório antes de fechar qualquer uma destas propostas:** correr
  `npm run build && npm test` (nenhum teste existente cobre `hej`/`tak`, mas
  `tests/greetings.test.ts`, `tests/i18n.test.ts` e `tests/commandsLocaleForUser.test.ts`
  são os ficheiros a observar para regressões).

## 6. Resumo executável (para quem for aplicar as correções)

| # | Achado | Ficheiro | Severidade | Confiança | Ação |
|---|---|---|---|---|---|
| 1 | `hej`→`swe` viola a regra anti-colisão citada pelo próprio ficheiro; dinamarquês/norueguês "hej"/"hei" saem em voz sueca | `language/greetings.ts` | Média (deteção errada recorrente em saudação comum) | Alta (violação literal do comentário) | Remover 2 entradas — diff em §1.3, com trade-off explícito |
| 2 | `tak`→`dan` colide com "tak" (=sim) em polaco | `language/greetings.ts` | Média | Média (inferência minha) | Mesma remoção, mesmo diff |
| 3 | `preview.sample.pt` mistura inglês numa frase FALADA | `i18n/catalog.ts` | Baixa-Média (só afeta pt, só `/voice preview`) | Alta | 1 linha — diff em §2 |
| 4 | `stats.synthLatency` ausente em 32/32 locales Fase B | `i18n/locales/*.ts` (32 ficheiros) | Baixa (1 linha do `/stats` sempre em inglês) | Alta (confirmado por leitura completa) | Adicionar a chave a cada ficheiro; tipar o registry (§3.2) para apanhar isto automaticamente no futuro |
| 5 | Norueguês tem voz mas não tem interface nem piada | `i18n/index.ts`, `content/jokes.ts` | Informativo | Média (pode ser âmbito deliberado) | Decisão de produto — não é bug |
| 6 | Comentário em `jokes.ts` sobre Norueguês está desatualizado/errado | `content/jokes.ts` | Cosmético | Alta | Atualizar comentário |
| 7 | Comentário "Fase A/B" em `i18n/index.ts`/`i18n/locales/index.ts` sugere que só en/pt estão traduzidos — falso, os 32 ficheiros já existem e estão completos | `i18n/index.ts`, `i18n/locales/index.ts` | Cosmético (mas induz o próximo agente em erro) | Alta | Atualizar comentário para "Fase B concluída" |
