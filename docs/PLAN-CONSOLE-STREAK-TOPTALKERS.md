# Plano — Streak por servidor + Top 10 global na consola admin (plan 038)

> Extensão do admin console (plan 037). Planeado em 2026-07-18.
> Repos afetados: **Vozen-bot** (store + API) e **vozen-helper-bot/site** (`site/vozen.html`).

## Objetivo

Na tab **Servidores** da consola admin (owner-only):

1. **Streak por servidor** — cada servidor tem uma streak de dias consecutivos em que *pelo menos uma pessoa* falou (mensagem auto-lida pelo Vozen). Mesmas regras da streak de utilizador já existente (`talkStats.ts`, estilo Duolingo): falhar 1 dia **não** quebra (freeze); falhar 2 dias consecutivos (gap ≥ 3) **perde tudo**. Mostrada como coluna na tabela de servidores.
2. **Top 10 global** — um cartão à direita com os 10 utilizadores com mais mensagens lidas **somadas em todos os servidores**, com **avatar + nome** além do ID. Label: **"Top 10 — pessoas com mais mensagens"**.

"Visível só para mim" já está garantido: toda a consola é gated pelo `adminApi` (sessão assinada, só o `OWNER_ID`).

## Scope

### In
- Nova tabela `guild_talk_streak` + módulo store `guildTalkStreak.ts` (TDD).
- Bump no `messageHandler` ao lado do `bumpTalk` existente.
- Seed inicial honesto: na 1.ª escrita de um guild, arrancar com `MAX(effectiveStreak)` dos users desse guild (lower bound verdadeiro da streak do servidor — evita que tudo comece a 🔥1).
- `adminApi.listGuilds()` passa a incluir `streak` (live) e `bestStreak` por servidor.
- Novo endpoint `GET /api/admin/toptalkers` (sessão obrigatória, CORS do painel, guard 500 como o BUG-01) com identidade resolvida (nome + avatar) via novo dep `resolveUsers`.
- UI em `site/vozen.html`: coluna "Streak" na tabela + cartão Top 10 à direita.
- Compliance: `guild_talk_streak` no `GUILD_PURGE_TABLES` (rot-guard) + adenda ao `AUDIT-CONSOLE-037.md`; verificar se `PRIVACY.md` §1.2 cobre o agregado cross-server (se não, uma linha).

### Out
- Streak de servidor visível a membros (comandos públicos, /top-speakers) — é privada do dono.
- Histórico por-dia / gráficos; notificações de streak; backfill perfeito (não existe histórico diário).
- Qualquer mudança à streak de utilizador existente.
- Tab Helper do painel.

## Fases

### F1 — Store `guildTalkStreak` (TDD)
Deliverable: módulo puro + tabela, testes verdes. Dep: nenhuma.
- [ ] RED: `tests/guildTalkStreak.test.ts` — casos: 1.º bump (seed com MAX effectiveStreak dos users do guild, mínimo 1), mesmo dia (no-op), dia seguinte (+1), 1 dia falhado (freeze, +1), gap ≥ 3 (reset a 1), `best_streak`, leitura live com `effectiveStreak` (reusar a função exportada de `talkStats.ts`).
- [ ] `db.ts`: `CREATE TABLE IF NOT EXISTS guild_talk_streak (guild_id TEXT PRIMARY KEY, streak INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0, last_date TEXT NOT NULL DEFAULT '')` no bloco de schema (convenção do repo: IF NOT EXISTS, não migrations numeradas).
- [ ] `src/store/guildTalkStreak.ts`: `bumpGuildTalk(db, guildId, now)` (mesma máquina de estados do `bumpTalk`, sem contador de mensagens) + `getGuildStreak(db, guildId, now)`; reusar `dateKey`/`dayKeyMinus`/`effectiveStreak` importados de `talkStats.ts`.
- [ ] Compliance: adicionar `'guild_talk_streak'` a `GUILD_PURGE_TABLES` em `dataLifecycle.ts` (tem `guild_id`, sem `user_id` → não entra no USER_ERASE). O rot-guard `dataLifecycle.test.ts` deve passar.
- [ ] Done: `npx vitest run` verde.

### F2 — Wiring no messageHandler
Deliverable: streak a contar em produção. Dep: F1.
- [ ] Chamar `bumpGuildTalk` em `messageHandler.ts` imediatamente ao lado do `bumpTalk` (linha ~393) — mesma condição: só mensagens que contam (as skipped não contam).
- [ ] Teste: no teste existente do messageHandler (ou novo caso), verificar que uma mensagem auto-lida incrementa a streak do guild.
- [ ] Done: suite verde; comportamento igual ao user streak em condições idênticas.

### F3 — API admin (streak nos guilds + /toptalkers)
Deliverable: endpoints prontos, testados sem socket e via router. Dep: F1.
- [ ] `adminApi.ts`: `AdminGuildRow` ganha `streak: number` e `bestStreak: number`, preenchidos em `listGuilds()` via `getGuildStreak`.
- [ ] `adminApi.ts`: novo dep opcional `resolveUsers?: (ids: string[]) => Promise<AdminUserBrief[]>` (`{ id, username: string | null, avatar: string | null }`) e método async `listTopTalkers()`: SQL `SELECT user_id, SUM(spoken_count) AS total FROM talk_stats GROUP BY user_id ORDER BY total DESC LIMIT 10`, merge com a identidade resolvida (fallback: username/avatar null → UI mostra o ID).
- [ ] `index.ts` (onde já injeta `resolveGuilds`): implementar `resolveUsers` com `client.users.fetch(id).catch(() => null)` + cache em memória (Map, TTL ~10 min) para não bater na REST a cada refresh do painel; avatar via `displayAvatarURL({ size: 64, extension: 'webp' })`.
- [ ] `kofiWebhook.ts`: rota `GET /api/admin/toptalkers` — `authorize()` obrigatório (403 sem sessão), CORS = `adminPanelOrigin`, try/catch → 500 (padrão BUG-01; rota é async, o catch tem de envolver o await).
- [ ] Testes: `adminApi.test.ts` (agregação cross-guild, ordenação, limite 10, fallback sem resolveUsers) + `adminRouter.test.ts` (403 sem sessão, 200 com sessão, shape da resposta, CORS, fixture `resolveGuilds` ganha streak).
- [ ] Done: `npm run check` verde.

### F4 — UI no painel (`site/vozen.html`)
Deliverable: tab Servidores com streak + cartão Top 10. Dep: F3.
- [ ] Layout da tab Servidores: grid 2 colunas — tabela de servidores à esquerda (`minmax(0,1fr)`), cartão Top 10 à direita (~340px); empilha a 1 coluna abaixo de ~900px.
- [ ] Coluna "Streak" na tabela: `🔥 N` (0 → "—" esbatido); tooltip/secundário com best (`melhor: N`) se couber sem poluir.
- [ ] Cartão "Top 10 — pessoas com mais mensagens": lista rank + avatar (28px, redondo; fallback: círculo com inicial/ID) + nome (fallback: ID em `monospace`) + contagem à direita; fetch a `GET /api/admin/toptalkers` quando a tab abre.
- [ ] Respeitar as regras do site: sem terceiros novos (avatares vêm de `cdn.discordapp.com` → **adicionar ao `img-src` do CSP** — única mudança de CSP), sem PowerShell a editar conteúdo (mojibake guard), `npm run build:site` se aplicável.
- [ ] Done: verificação no browser — sem erros de CSP/consola, dados reais renderizados, responsive ok.

### F5 — Deploy + verificação real + compliance
Deliverable: em produção, documentado. Dep: F2–F4.
- [ ] Commits com autoria humana + push; deploy VPS (`git pull` + build + restart do serviço do Vozen TTS) + publish do site (GitHub Pages).
- [ ] Verificar no painel real: streaks aparecem (seed ≥ 1 nos servidores ativos), Top 10 com avatares/nomes.
- [ ] Adenda ao `docs/AUDIT-CONSOLE-037.md`: nova superfície (streak por guild = agregado sem dados pessoais; top10 global = SUM de contagens já armazenadas, owner-only, sem conteúdo de mensagens); confirmar/ajustar `PRIVACY.md` §1.2 numa linha se o texto atual não cobrir agregação cross-server.
- [ ] Done: painel real ok + docs atualizados.

## UI Blueprint (confinado à F4)

- **Tokens**: reutilizar os existentes do `vozen.html` (dark, cartões com borda subtil, headers de tabela em maiúsculas esbatidas). Nenhum token novo.
- **Componentes/estados**: linha do Top 10 = `[#rank] [avatar|fallback-inicial] [nome|ID] …… [count]`; estados: loading (skeleton/`—`), vazio ("sem dados"), erro (mensagem discreta + retry no próximo open da tab). Coluna Streak: `🔥 N` / `—`.
- **Responsivo**: grid → stack < ~900px; tabela mantém o scroll horizontal se precisar.

## Riscos

- **Sem histórico diário**: a streak de servidor só é exata a partir do deploy. Mitigação: seed com `MAX(effectiveStreak)` dos users do guild — lower bound verdadeiro, nunca inflaciona. Aceite.
- **`client.users.fetch` falha/rate-limit** para users que saíram de todos os servidores: fallback para ID; cache TTL evita repetição. Aceite.
- **CSP do site**: esquecer o `img-src` para o CDN do Discord parte os avatares silenciosamente — é passo explícito da F4 com verificação de consola.
- **Rota async no router**: o padrão BUG-01 existente cobre rotas sync; um `await` fora de try/catch mataria o processo (uncaught rejection). O teste do router deve incluir um caso de erro do store → 500.
- **Rot-guard**: criar a tabela sem a registar em `dataLifecycle.ts` falha a suite — a F1 já o inclui, não deixar para o fim.

## MVP

F1 + F2 + F3: a streak conta em produção e a API devolve tudo (verificável por curl com sessão). A F4 torna-a visível; a F5 fecha compliance e deploy.

Próxima ação concreta: escrever `tests/guildTalkStreak.test.ts` (RED) com os casos de streak da F1.
