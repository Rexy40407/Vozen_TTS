# Tornar o Vozen público e sempre-ligado (24/7)

Este documento descreve **o que é preciso fazer** para o Vozen deixar de ser um
bot privado de uso pessoal e passar a poder ser convidado por qualquer pessoa,
a correr de forma contínua (24/7). É um guia de **operações**, não uma mudança
de código.

> **Estas são decisões do dono da instância** (tu). O Vozen continua a ser
> **self-host**: tornar o bot público significa que qualquer um pode **convidá-lo**
> para o seu servidor, mas a instância continua a correr no teu hardware/VPS e
> sob a tua responsabilidade. O repositório está **privado por agora** — nada
> aqui acontece automaticamente; é tudo opt-in manual no Discord Developer Portal.

---

## 1. Ativar "Public Bot"

Por defeito, uma aplicação Discord só pode ser adicionada a servidores **pelo
próprio dono**. Para abrir o convite a qualquer pessoa, ativa o toggle
**Public Bot**.

Passos:

1. Vai ao [Discord Developer Portal](https://discord.com/developers/applications)
   e abre a tua aplicação (a do Vozen).
2. Menu lateral → **Bot**.
3. Em **Authorization Flow**, ativa o toggle **PUBLIC BOT**.
   - **Ligado**: qualquer pessoa com o link de convite pode adicionar o Vozen ao
     seu servidor.
   - **Desligado** (default): só tu (o dono) podes adicioná-lo.
4. Mantém **REQUIRES OAUTH2 CODE GRANT** **desligado** — o Vozen não usa esse fluxo.

> **O que isto significa, em concreto:** com "Public Bot" ligado, o link de
> convite que geras (e o comando `/invite` do próprio bot) passa a funcionar para
> qualquer servidor, não só para os teus. **Uma única instância** tua passa a
> servir todos esses servidores. Isto é uma decisão tua e tem implicações:
> carga, custos de hosting e responsabilidade de moderação/privacidade (ver
> `PRIVACY.md` e `TERMS.md`). Podes voltar a desligar a qualquer momento.

---

## 2. MESSAGE CONTENT intent

O Vozen precisa de **ler o conteúdo de texto** das mensagens para as conseguir
ler em voz alta — nomeadamente na **auto-leitura** de um canal de TTS
configurado (e em menções/replies ao bot). Para isso, a aplicação precisa do
privileged intent **MESSAGE CONTENT**.

Onde se ativa:

1. Developer Portal → a tua aplicação → **Bot**.
2. Secção **Privileged Gateway Intents**.
3. Ativa **MESSAGE CONTENT INTENT** e **guarda** (Save Changes).

**Self-serve até 10.000 utilizadores únicos.** Desde 2026 o antigo "muro dos 100
servidores" para o MESSAGE CONTENT intent **acabou**: o intent é **auto-servível
até 10.000 utilizadores únicos**, ou seja, ligas o toggle e funciona **sem review**
do Discord. Só **acima dos 10k** utilizadores únicos é que entra a review do
intent — com uma **janela de 90 dias** para apresentar a justificação (e há
reaplicação anual). Na prática, para um bot pessoal/de nicho tens muita margem:
ativa o intent logo, é o que permite a auto-leitura.

> Nota: não confundir com a **verificação da aplicação** (e o acesso à App
> Directory/Discovery), que é um portão **separado** que só surge por volta dos
> **~75-100 servidores** — esse é sobre listagem/descoberta, não sobre o
> MESSAGE CONTENT intent.

> **Rascunho da justificação** (guarda este parágrafo para quando o Discord
> pedir a justificação do intent na janela de review):
>
> > O Vozen é um bot de Text-to-Speech (TTS) para Discord. Precisa do MESSAGE
> > CONTENT intent para ler o **conteúdo de texto** das mensagens publicadas no
> > canal de TTS configurado pelo servidor (auto-leitura) e em menções/replies
> > diretas ao bot, e convertê-lo em **voz** reproduzida no canal de voz. O
> > conteúdo é processado de forma **transitória em memória** apenas para a
> > síntese de voz e **não é armazenado** em nenhuma base de dados nem nos logs
> > (ver `PRIVACY.md`). Sem este intent, a função central do bot — ler mensagens
> > em voz alta — não é possível.

(Esta redação está alinhada com a `PRIVACY.md` da instância: o texto é
processado em memória e não persistido; só o áudio gerado é cacheado em disco.)

---

## 3. Sempre-ligado (24/7)

Para o bot estar disponível para os servidores que o convidam, a tua instância
tem de estar **sempre a correr**. O teu PC pessoal serve para testar, mas para
24/7 a sério a opção realista é alojar a instância num servidor que não desligas.

Opções económicas:

- **VPS Linux ~€5/mês** (Hetzner, Contabo, DigitalOcean, etc.). Suficiente para o
  Vozen: o bot é um cliente websocket de saída e o Piper corre em CPU.
- **Oracle Cloud free tier** — instâncias *Always Free* (ex.: ARM Ampere) que
  podem correr o bot a custo zero, se conseguires provisionar uma.

O caminho de deploy já está documentado no **README → [§5 Deploy em VPS
(Docker)](SELF-HOST.md#5-deploy-on-a-vps-docker)**. O essencial:

```
docker compose up -d
```

O `docker-compose.yml` já define **`restart: unless-stopped`**, por isso o
container volta a subir sozinho após um reboot da VPS ou um crash — que é
exatamente o que "24/7" exige. Para atualizar: `git pull` e `docker compose up -d --build`.

### Monitorização de uptime (health endpoint)

O Vozen expõe um **health endpoint HTTP opcional** para uptime monitors (ex.:
[UptimeRobot](https://uptimerobot.com/)). É **opcional** e está **desligado por
defeito**:

- Define `HEALTH_PORT` no `.env` (ex.: `HEALTH_PORT=8080`). Sem essa variável,
  **não** é aberto nenhum servidor (comportamento default).
- Quando definido, o bot responde a `GET /health` com `200` e
  `{"status":"ok"}`. Qualquer outro caminho devolve `404`.
- O endpoint **não expõe dados sensíveis** (apenas um estado simples), por isso é
  seguro apontar-lhe um monitor externo. Configura o teu uptime monitor para
  fazer um pedido HTTP a `http://<host>:<HEALTH_PORT>/health` e alertar-te se
  deixar de responder `200`.

> **Nota (deploy Docker):** o `docker-compose.yml` recomendado (README §5) **não**
> publica portas — o container não expõe `HEALTH_PORT` para fora por defeito. Para
> um monitor **externo** alcançar o endpoint num deploy Docker, acrescenta
> `ports: ["<HEALTH_PORT>:<HEALTH_PORT>"]` ao serviço `vozen` no `docker-compose.yml`
> (ou faz bind apenas à loopback/rede interna se só monitorizares a partir da
> própria máquina). Em **deploy nativo** (sem Docker) o processo já escuta no host,
> por isso não é preciso passo extra.

> Nota: se expuseres a porta para fora da VPS (ex.: mapeá-la no Docker e abrir no
> firewall), garante que só o monitor lhe chega; o endpoint em si é inócuo, mas
> não há razão para o deixar mais aberto do que o necessário.

---

## 4. Recapitulação: isto é decisão tua

- Ativar **Public Bot**, ativar **MESSAGE CONTENT**, e alojar a instância 24/7
  são **decisões do dono** — nenhuma acontece sozinha.
- O **repositório está privado por agora**. Listar/divulgar o bot (Public Bot,
  diretórios de bots, etc.) é um passo deliberado e separado, que só faz sentido
  depois de teres a instância estável e sempre-ligada.
- Antes de ir público, revê **`PRIVACY.md`** e **`TERMS.md`** (e preenche o campo
  de contacto/responsável no fim da `PRIVACY.md`) — o Discord pede URLs de
  Privacy Policy e Terms of Service no fluxo de verificação.
