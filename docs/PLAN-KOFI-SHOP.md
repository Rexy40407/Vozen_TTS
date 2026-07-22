# Plano — Setup da loja Ko-fi do Vozen (versão mínima: 1 membership, 3 tiers)

Escrito a 2026-07-11 e revisto após verificação na documentação oficial do
Ko-fi (2026-07-11). Execução: **maioritariamente do Diogo** (o painel Ko-fi é dele); o
bot/site já estão prontos. Este plano diz exatamente o que criar, com que NOMES (o
webhook lê o nome!) e como validar.

## Factos confirmados na doc oficial do Ko-fi (2026-07-11)
- **Memberships**: um programa com vários TIERS; cada tier tem Nome + Preço **por mês**.
  São **só mensais** (não há intervalo anual). Os tiers SÃO as "opções" — o comprador vê
  uma secção "Membership" e escolhe o tier. É o mais próximo de "1 produto com opções".
- **Loja (shop)**: variantes/opções são **só para produtos FÍSICOS**. Itens digitais
  (o nosso caso) NÃO podem ter variantes → cada preço anual seria um produto separado.
  Por isso o anual fica FORA do lançamento (nice-to-have, adiciona-se depois).

## Objetivo

Loja Ko-fi no estado de lançamento: **UMA membership "Vozen" com 3 tiers**, nomes que o
parser do webhook entende sem tocar em código, preços coerentes com vozen.org, instrução
do Discord ID no checkout, e uma compra de teste end-to-end validada.

**Regra de ouro — o parser lê o NOME do tier** (`src/premium/kofi.ts`, campo `tier_name`):
- contém `plus` → plano Plus · contém `premium` → plano Premium
- contém `(N servers)` → N licenças (ex. "(3 servers)", "(8 servers)")
- (memberships são sempre 30 dias — o parser já trata disso)

## Como fica (o resultado visível)

```
Página Ko-fi do Vozen
└── Secção "Membership"  ← UMA coisa, o comprador escolhe o tier
    ├── Vozen Plus                    €1.99/mês   (perks pessoais, qualquer servidor)
    ├── Vozen Premium (3 servers)     €3.99/mês   (servidor inteiro, 3 servidores)
    └── Vozen Premium (8 servers)     €7.99/mês   (servidor inteiro, 8 servidores)
```
Sem produtos de loja. Limpo. É "Vozen, escolhe o teu plano" numa secção só.

## Scope

### In
- 1 membership "Vozen" em modo "Membership tiers" com 3 tiers (nomes/preços/descrições).
- Instrução do Discord ID no checkout (webhook associa por ID; fallback por email nas
  renovações — já implementado).
- Terms da membership (o Ko-fi pede; texto curto sugerido abaixo).
- Branding mínimo: bio + link vozen.org, default tab = Memberships.
- Validação: webhook "Send Test" + 1 compra de teste real de valor baixo.

### Out (deliberado)
- **Anual** — digital não tem variantes; seriam produtos separados. Adiciona-se depois
  como shop items se/quando fizer sentido.
- Packs de allowance "Voice Boost" — idem (e depende do motor Google, ainda por ligar).
- Discord Premium Apps (canal alternativo, fee ~15-30%; pós-tração).
- Alterações de código — nada neste plano exige deploy.

## Fases

### Fase 1 — Criar a membership + tiers [Diogo]
- [ ] Ko-fi → Memberships → Membership Mode = **"Membership tiers"**.
- [ ] **Add Tier** ×3, EXATAMENTE com estes nomes (o webhook lê-os):
  - [ ] **Vozen Plus** — €1.99/mês
        Descrição: "Premium perks that follow YOU into every server — 8 voice effects,
        voice cloning, 50 personal pronunciations, /rizz and the premium games."
  - [ ] **Vozen Premium (3 servers)** — €3.99/mês
        Descrição: "Unlock Premium for everyone on up to 3 servers. Activate with
        /premium activate."
  - [ ] **Vozen Premium (8 servers)** — €7.99/mês
        Descrição: "Premium for everyone on up to 8 servers."
- [ ] Em cada tier, adicionar a instrução do Discord ID (Fase 2) na descrição.
- [ ] Enable nos 3 tiers.
- [ ] Arquivar/apagar tiers antigos que sobrem (ex. "(10 servers)", "Max") — renovações
      antigas continuam a funcionar (grandfathering já está no código).

### Fase 2 — Instrução do Discord ID (nos 3 tiers) [Diogo]
Texto sugerido (EN, público internacional) para a descrição de cada tier:
> ⚠️ IMPORTANT: after subscribing, paste your **Discord ID** in the message box so your
> Premium activates instantly. Copy it at **vozen.org/account** (log in with Discord).
- [ ] Colar nos 3 tiers.
- [ ] Confirmar que a caixa de mensagem no checkout está ATIVA.

### Fase 3 — Terms + página [Diogo]
- [ ] Membership Terms (curto): o que cada tier inclui, cobrança mensal na mesma data,
      como ativar (/premium activate), política de reembolso (digital, geralmente não
      reembolsável salvo lei aplicável — alinhar com vozen.org/terms).
- [ ] Bio da página + link https://vozen.org (+ /privacy, /terms).
- [ ] Settings → Page → Default tab = **Memberships**.
- [ ] Payout configurado, moeda EUR.
- [ ] Ko-fi → Webhooks: URL https://api.vozen.org/webhook/kofi confirmada (token já
      rodado e no `.env` do VPS — SEC·4 feito; NUNCA documentar o valor).

### Fase 4 — Validação end-to-end [Diogo + eu]
- [ ] Botão **"Send Test"** do webhook no painel → eu confirmo nos logs do VPS que
      chegou 200 e foi parseado.
- [ ] **Compra de teste real**: baixar temporariamente o preço do tier Plus para o
      mínimo que o Ko-fi permitir, subscrever com a tua outra conta (Discord ID na
      mensagem), e verificar:
      - webhook 200 + grant certo nos logs (plan=plus, 30 dias)
      - `/premium info` no Discord mostra o Plus
      - vozen.org/account mostra o estado
      - idempotência: retry do Ko-fi não duplica (ledger já testado em unit)
- [ ] Repor o preço; cancelar a subscrição de teste no Ko-fi.
- [ ] (Se der) repetir com "(3 servers)" para validar seats + /premium activate.

## Riscos

- **Nome do tier com typo quebra o mapeamento** (ex. "Server" sem "s", "3 server").
  Mitigação: copiar os nomes daqui letra a letra; a Fase 4 apanha antes de haver clientes.
- **Comprador esquece o Discord ID**: grant fica "manual" (aparece nos logs com tx id).
  Mitigação: instrução ⚠️ em todos os tiers + associação por email nas renovações (feita).
  Processo manual: vês o email no Ko-fi e usas /premium grant.
- **Sem anual no lançamento** = perde-se o desconto de fidelização anual. Aceite: o
  mensal já monetiza; anual entra depois como shop items separados sem bloquear nada.

## MVP

Fases 1+2+4 com o tier **Vozen Plus** validado end-to-end — a partir daí o dinheiro flui;
os tiers Premium são o mesmo padrão com seats.

Próxima ação concreta: Fase 1 — no painel Ko-fi, pôr Membership Mode em "Membership tiers" e criar o tier "Vozen Plus" a €1.99/mês.
