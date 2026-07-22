# Plano 035 — Fim da ativação automática (compras novas pendem; renovações continuam)

Escrito 2026-07-17, contra `5dde1d0`. Decisão do Diogo: **nenhuma compra NOVA ativa
sozinha**; só renovações de uma subscrição já reclamada continuam automáticas.
Planeamento apenas — execução por ordem explícita.

## Objetivo

Hoje, quando o email do comprador já está ligado a uma conta Discord
(`kofi_supporter`), o webhook aplica QUALQUER compra diretamente — sem claim, sem
escolha de conta e **sem a caixa de consentimento dos 14 dias** (a compra mensal do
Diogo em 2026-07-17 02:03 foi entregue assim). Isso cria dois problemas:

1. **Consentimento** — a renúncia ao direito de retratação (2011/83/UE art. 16(m)) só
   é recolhida no passo de claim; um grant direto salta-a.
2. **Conta errada** — quem compra com um email já ligado não consegue pôr o passe
   noutra conta Discord (prendas, contas alternativas). Não há transferência
   self-service.

Regra nova: **compra nova ⇒ pendente ⇒ claim no site (escolhe conta + consente)**.
**Renovação de subscrição já reclamada ⇒ continua automática** — o assinante já
consentiu e já escolheu a conta; obrigá-lo a reclamar todos os meses só o faria
perder o serviço que paga.

## Scope

### In

- Parse do campo `is_first_subscription_payment` do payload Ko-fi (novo em
  `KofiEvent`; hoje só capturamos `is_subscription_payment`).
- Routing novo no webhook (`kofiWebhook.ts`):
  - **Renovação** = `is_subscription_payment && !is_first_subscription_payment` **e**
    email já ligado em `kofi_supporter` → aplica direto (comportamento atual).
    Exigir AMBOS os sinais é o fallback de segurança: se o Ko-fi não mandar o campo
    `is_first`, o pior caso é uma compra pender — nunca ativar sem consentimento.
  - **Tudo o resto** (1º pagamento de membership, qualquer Shop order) → SEMPRE
    pendente, mesmo com email ligado, mesmo com Discord ID na mensagem. O caminho do
    ID-na-mensagem deixa de conceder diretamente (saltava o consentimento).
  - Renovação com email NÃO ligado → pendente (como hoje; o claim aplica as
    acumuladas).
- Coluna nova `is_subscription INTEGER NOT NULL DEFAULT 0` em `kofi_pending`
  (migração `ALTER TABLE` guardada, padrão já existente em `db.ts:279-304`).
- Semântica do claim ajustada (é aqui que mora a contaminação de prendas — ver
  Riscos):
  - O claim aplica a transação reclamada **+ apenas** as pendentes do MESMO email
    que sejam `is_subscription` (renovações órfãs acumuladas). Uma compra da Shop
    pendente (ex.: prenda) **não** é arrastada pelo claim de outra pessoa.
  - `rememberKofiSupporter` (a ligação email→Discord que roteia renovações) passa a
    ser gravada **só quando o claim é de uma subscrição**. Reclamar uma prenda da
    Shop não sequestra o routing das renovações do comprador.
- Logs: com a regra nova, "compra pendente" passa a ser o caminho NORMAL — o log
  atual (`[ERROR] purchase without a Discord ID`) desce para INFO no caso
  reconhecido-e-pendente; ERROR fica reservado para pendente-sem-tx-id (grant
  manual) e Shop Order fora do mapa.
- Testes TDD para todos os ramos + characterization dos dois formatos reais de
  payload (membership e Shop) + gate completo + deploy.

### Out

- Copy do site (plano 034 cobre; nota: a hint do claim não precisa de mudar para
  isto funcionar).
- Botão "unlink email" no painel — deixa de ser necessário: com compras novas sempre
  pendentes, a conta escolhe-se em cada claim.
- Auto-match pelo email do Discord (scope `email` no OAuth) — continua como evolução
  futura; composível com este plano (auto-SUGERIR nunca foi auto-ATIVAR).
- Premium Apps do Discord, top.gg vote grants, `/redeem` — fluxos distintos, já são
  atos explícitos do utilizador.

## Fases

### F1 — Payload (TDD)
- [ ] `KofiEvent.isFirstSubscriptionPayment` + parse (`o.is_first_subscription_payment === true`).
- [ ] **Done:** testes de parse cobrem presente/ausente/false; ausente ⇒ `false`.

### F2 — Store (TDD)
- [ ] Migração `kofi_pending.is_subscription` (default 0) + `recordPendingGrant`
      recebe o flag.
- [ ] `claimPendingGrant`: arrasta só pendentes `is_subscription` do mesmo email;
      rebind só em claims de subscrição.
- [ ] **Done:** testes novos verdes, incluindo "prenda da Shop não é arrastada" e
      "claim de prenda não muda o binding"; os 24 testes de claim existentes
      continuam verdes (ajustados onde a semântica mudou de propósito).

### F3 — Routing do webhook (TDD)
- [ ] Não-renovação ⇒ nunca chama `resolveKofiDiscordId`; pende com `emailHash` +
      flag de subscrição.
- [ ] Renovação (ambos os sinais) ⇒ comportamento atual.
- [ ] **Done:** characterization: payload de membership 1º mês com email ligado ⇒
      PENDE (é a inversão do que aconteceu a 2026-07-17 02:03); renovação ⇒ aplica;
      Shop com email ligado ⇒ PENDE.

### F4 — Logs + fecho
- [ ] Níveis de log ajustados (pendente-normal = INFO).
- [ ] `npm run check` verde, deploy, serviço ativo.
- [ ] **Done:** gate verde; `journalctl` sem ERROR espúrio no arranque.

### F5 — Prova real [needs Diogo]
- [ ] Compra de 1 cêntimo na Shop (email JÁ ligado): tem de PENDER e ser reclamável
      com a caixa de consentimento. Repor preço depois.
- [ ] Renovação real (~2026-08-16, o Premium mensal do Diogo): tem de aplicar
      sozinha, sem claim.
- [ ] **Done:** ambos observados nos logs/DB.

## Riscos

- **Contaminação de prendas (o risco nº 1, já mitigado no desenho):** com tudo a
  pender, o claim atual (a) aplica TODAS as pendentes do mesmo email e (b) re-liga o
  email à conta que reclama. Cenário: assinante compra prenda para B com o mesmo
  email → B reclama → hoje o binding saltava para B e **as renovações do assinante
  passavam a cair na conta de B**. As duas regras da F2 (arrastar só subscrições;
  rebind só em subscrições) fecham isto. Sem elas, este plano criaria um bug pior do
  que o que corrige.
- **Fiabilidade do `is_first_subscription_payment`:** não temos payload real
  arquivado que o confirme. Mitigação: exigir também o email ligado; na dúvida,
  pende — o modo de falha preferido pela decisão do Diogo (reclamar uma vez vs.
  ativar sem consentimento).
- **Mudança de expectativa:** a "magia" da 2ª compra instantânea desaparece para
  compras novas — é o pedido, mas fica registado que é deliberado. As renovações
  mantêm a magia.
- **Caminho do dinheiro + restart do bot:** deployar em hora morta; F5 valida com
  dinheiro real antes de dar por fechado.
- Migração de schema em DB viva: `ALTER TABLE ADD COLUMN` com guarda idempotente —
  padrão já usado 3× no repo, risco baixo.

## MVP

F1–F4 (regra nova em produção). F5 é a prova com dinheiro real, nas datas em que é
possível.

**Próxima ação concreta:** teste RED de parse — payload de membership com
`is_first_subscription_payment: true` tem de expor `isFirstSubscriptionPayment === true`
em `parseKofiPayload` (tests/kofi.test.ts).
