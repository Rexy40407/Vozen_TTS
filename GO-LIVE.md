# Go-live do Vozen — checklist

Checklist curto e ordenado para pôr o Vozen a sério (público + 24/7). Cada passo
resume o essencial e **liga** para o detalhe; não repete os guias completos.

> **Os passos 1-4 são TEUS** (precisam das tuas contas Discord/cloud); o código e
> a automação já estão prontos. O que falta são as decisões e o setup que só tu
> podes fazer nas tuas contas.

---

## 0. Pré-requisitos rápidos

- [ ] Tens o **`DISCORD_TOKEN`** e o **`CLIENT_ID`** da app no [Discord Developer Portal](https://discord.com/developers/applications) (criar/abrir a app → Bot → Reset Token; General Information → Application ID). _~2 min._
- [ ] Tens o **binário do Piper** (arquitetura certa) e **pelo menos um modelo de voz** prontos para o deploy — ver **[DEPLOY.md](DEPLOY.md)**. _(faz-se já no passo 3.)_

## 1. Ativar "Public Bot"

- [ ] No Developer Portal → Bot, liga o toggle **PUBLIC BOT** para qualquer pessoa poder convidar o Vozen; **verifica:** o toggle fica **ON**. _~1 min — detalhe: [docs/GO-PUBLIC.md §1](docs/GO-PUBLIC.md#1-ativar-public-bot)._
- [ ] Carrega o **ícone/avatar da app** no Developer Portal (General Information → App Icon, e Bot → Avatar): usa **`assets/vozen-icon.png`** (no repo — também disponível em `vozen-brand-assets-refined/vozen-icon.png`). _~1 min._

## 2. Ativar o MESSAGE CONTENT intent

- [ ] No Developer Portal → Bot → Privileged Gateway Intents, liga **MESSAGE CONTENT** (self-serve até 10k utilizadores, sem review) — é o que permite a auto-leitura de canal; **verifica:** o toggle fica ON e **Save Changes** ficou guardado. _~1 min — detalhe: [docs/GO-PUBLIC.md §2](docs/GO-PUBLIC.md#2-message-content-intent)._

## 3. Deployar 24/7

- [ ] Escolhe **uma** das 3 opções de hospedagem (Oracle free / VPS / PaaS) e arranca a instância; **verifica:** os logs mostram `[client] online como ...` (e, se definires `HEALTH_PORT`, o `GET /health` responde `200`). _~15-30 min na 1.ª vez — passos e comandos: [DEPLOY.md](DEPLOY.md)._

## 4. Adicionar a um servidor de teste

- [ ] Convida o Vozen ao teu servidor de testes (1.ª vez: usa o **link OAuth2** do [guia de self-host §3.2](docs/SELF-HOST.md#32-invite-the-bot); já dentro de um servidor podes reutilizar o comando `/invite`) e corre **`/setup`** lá para ligar a auto-leitura; **verifica:** o bot entra no canal de voz e lê uma mensagem. _~2 min._

## 5. (Opcional) Listar e pedir reviews

- [ ] Só **depois de estável**, lista o Vozen em bot lists (top.gg e afins) e pede reviews a utilizadores satisfeitos — apenas quando quiseres crescer. _Contexto: [docs/GO-PUBLIC.md §4](docs/GO-PUBLIC.md#4-recapitulação-isto-é-decisão-tua)._

---

**Privacidade e Termos:** revê **[PRIVACY.md](PRIVACY.md)** e **[TERMS.md](TERMS.md)** antes de ir público — são os URLs (`.../blob/main/PRIVACY.md` e `.../blob/main/TERMS.md`) a colar nos campos _Privacy Policy URL_ / _Terms of Service URL_ do Developer Portal.

**Dúvidas sobre comandos?** Corre **`/help`** no Discord para a lista completa.
