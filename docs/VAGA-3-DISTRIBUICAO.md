# Vaga 3 — Distribuição e escala (guia de ação)

Esta vaga é **metade código, metade operacional**. O código já está feito e no bot
(auto-post top.gg + webhook de erros). Este documento é a parte **que é tua** — copy,
checklists e o que ligar. Segue por ordem.

---

## 0. Ligar o que já está no código (5 min)

No teu `.env` (NÃO commitar), define quando tiveres os valores:

```
TOPGG_TOKEN=          # top.gg -> o teu bot -> Edit -> Webhooks/API -> API Token
ERROR_WEBHOOK_URL=    # Discord: canal privado -> Integrações -> Webhooks -> Novo -> Copiar URL
```

- **TOPGG_TOKEN** liga o auto-post da contagem de servidores (sobe no ranking/descoberta).
- **ERROR_WEBHOOK_URL** faz os erros de produção caírem num canal teu (com dedup, sem spam).

Ambos são **opt-in**: sem eles, o bot corre exatamente como agora. Reinicia o bot depois de definir.

---

## 1. ⚠️ Verificação do Discord — a barreira dos 100 servidores (PRIORIDADE)

**O Vozen lê mensagens, por isso usa o `Message Content Intent` — que é PRIVILEGIADO.**
Sem verificação, um bot só pode crescer até **~100 servidores**. Depois disso, o Discord
**bloqueia** a entrada em servidores novos até estar verificado. A verificação demora
semanas, por isso **candidata-te AO APROXIMARES-TE dos 75 servidores**, não aos 99.

### Checklist de verificação
- [ ] Conta de developer com **2FA ativado** e email verificado.
- [ ] **Política de Privacidade** e **Termos de Serviço** publicados (URLs públicos) — obrigatório.
- [ ] No portal de developers, no pedido de verificação, **justificar o Message Content
      Intent**: "O bot é um leitor de Text-to-Speech: lê em voz alta as mensagens do canal
      configurado para pessoas sem microfone / com acessibilidade. O conteúdo é usado só
      para sintetizar áudio em tempo real e não é armazenado." (Este é o ponto que mais
      reprova — sê explícito e honesto.)
- [ ] Descrever os outros intents: `GuildVoiceStates` (saber onde falar), `GuildMembers`
      (nome de quem falou no xsaid).
- [ ] Confirmar que **NÃO** guardas conteúdo de mensagens (o Vozen não guarda — só cache de
      áudio efémera). Diz isto na política de privacidade.

> Nota: enquanto não verificado, o Message Content Intent tem de estar **ligado à mão** no
> painel do bot (Bot -> Privileged Gateway Intents -> Message Content Intent = ON).

---

## 2. Listagem no top.gg — copy pronta a colar

O pitch central ataca a maior fraqueza do concorrente: **a voz grátis deles é robótica; a
nossa é neural e grátis; e falamos 34 línguas.**

### Short description (tagline, ~200 caracteres)
```
Vozes neurais GRÁTIS em 34 línguas — o Vozen lê o chat em voz alta para quem não tem
microfone. Deteta a língua, anuncia quem falou, e soa natural. Sem paywall.
```

### Long description (corpo da listagem, markdown)
```
# 🔊 Vozen — Text-to-Speech com voz natural, grátis

O Vozen lê as mensagens do teu servidor em voz alta — perfeito para quem não tem
microfone, para acessibilidade, ou só para não parares de jogar para escrever.

## Porquê o Vozen?
- 🎙️ **Voz natural GRÁTIS** — nada de vozes robóticas atrás de paywall.
- 🌍 **34 línguas** — deteta a língua da mensagem e fala com a voz certa.
- 🗣️ **"Fulano disse…"** — sabes sempre quem falou (podes desligar).
- 🖱️ **Botão direito → Ler em voz alta** — lê qualquer mensagem sem escrever nada.
- 🚪 **Entra sozinho** na call quando escreves (opcional).
- 🔧 **Personalizável** — voz por pessoa, apelido falado, dicionário de pronúncia,
  lista de palavras bloqueadas, velocidade.
- 🎭 `/joke` e `/laugh` em várias línguas.

## Começar
1. `/setup` — escolhe o canal a ser lido.
2. `/join` — o Vozen entra na tua call.
3. Escreve no canal — ele lê!

Precisas de ajuda? `/help` lista tudo.
```

### Tags / categorias no top.gg
`Text-to-Speech`, `Accessibility`, `Social`, `Utility`, `Voice`

---

## 3. Diretórios para submeter (backlinks + descoberta)

Submete a mesma copy nestes (dofollow / tráfego de descoberta):
- [ ] **top.gg** (o principal — o auto-post da contagem já liga aqui)
- [ ] **discord.bots.gg**
- [ ] **bots.ondiscord.xyz**
- [ ] **discordbotlist.com**
- [ ] **Discord App Directory** (via o portal de developers — precisa de verificação)

> O código já suporta o top.gg. Se quiseres auto-post para discord.bots.gg / discordbotlist
> também, é fácil de adicionar ao `botLists.ts` (têm endpoints equivalentes) — pede.

---

## 4. Campanha de votos (ranking no top.gg)

O `/vote` já existe no bot e o webhook de votos já está no código. Para converter:
- [ ] Menciona o `/vote` na mensagem de boas-vindas / no `/help` (já lá está).
- [ ] Opcional: um pequeno incentivo por voto (ex.: badge, prioridade de fila) — NÃO essencial.
- [ ] Vota tu e pede a amigos no arranque — os primeiros votos desbloqueiam visibilidade.

O concorrente tem ~1,5M servidores mas só **124 votos** — é um flanco aberto. Poucos votos
consistentes já te põem à frente na página deles.

---

## 5. Premium — DEPOIS de tração, não antes

Aviso da research: o concorrente converte só ~550 pagantes em 1,5M servidores (~€22k/ano).
**A monetização não pode ser o motor de crescimento neste nicho.** Plano:
1. Cresce grátis primeiro (a voz neural grátis É o pitch de aquisição).
2. Só quando tiveres milhares de servidores, considera um tier premium leve (ex.: mais
   vozes, tradução, sem limites de rate) — nunca escondendo o que hoje é grátis.

---

## Estado

| Item | Estado |
|---|---|
| Auto-post top.gg (código) | ✅ feito (liga com TOPGG_TOKEN) |
| Webhook de erros (código) | ✅ feito (liga com ERROR_WEBHOOK_URL) |
| Copy da listagem top.gg | ✅ pronta (secção 2) |
| Checklist de verificação | ✅ pronto (secção 1) — **é o teu próximo passo real** |
| Política de Privacidade / ToS | ⏳ tu — precisas de publicar |
| Submeter aos diretórios | ⏳ tu |
