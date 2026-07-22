# Deploy do Vozen (24/7)

Runbook curto para alojar o Vozen sempre-ligado, com `docker compose`, em qualquer
das três opções abaixo. Os passos de Docker/Piper/modelos/`.env` são os mesmos do
**[README §5 — Deploy em VPS (Docker)](docs/SELF-HOST.md#5-deploy-on-a-vps-docker)**; este
documento foca o que **difere por opção** (sobretudo a **arquitetura** do Piper) e
o que é **comum** (env vars + como verificar).

> Estado: o build da imagem e a síntese real do Piper são **(verificação ao vivo
> pendente)** — não foram corridos neste ambiente. Ver README §5.

A diferença que mais magoa entre opções é a **arquitetura do CPU**: o binário do
Piper e as `.so` que ele carrega são **específicos da arquitetura**. A imagem
Docker (`node:22-bookworm*`) é multi-arch e corre em ARM64 e x86_64 sem mudanças,
**mas tens de descarregar o build do Piper certo para a tua máquina** — senão o
container arranca e o Piper falha a carregar (`error while loading shared libraries`).

Builds do Piper (em https://github.com/rhasspy/piper/releases):

| Máquina                                        | Asset do Piper               |
| ---------------------------------------------- | ---------------------------- |
| Oracle Ampere / ARM64 (`uname -m` → `aarch64`) | `piper_linux_aarch64.tar.gz` |
| VPS x86 / Intel/AMD (`uname -m` → `x86_64`)    | `piper_linux_x86_64.tar.gz`  |

---

## Opção A — Oracle Cloud free tier (€0, ARM64)

As instâncias _Always Free_ da Oracle costumam ser **Ampere ARM64 (aarch64)**.
A imagem corre em ARM64, mas **o Piper tem de ser o build `aarch64`** — **não** o
`x86_64` que o README §5.2 indica por defeito.

1. Cria uma instância **Ampere (ARM64)** _Always Free_ (shape `VM.Standard.A1.Flex`),
   imagem Ubuntu. Abre acesso SSH.
2. Instala o Docker + plugin compose v2:
   ```
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # re-login para aplicar
   docker --version && docker compose version
   ```
3. Clona o repositório:
   ```
   git clone https://github.com/Rexy40407/discord-bot-Vozen.git
   cd discord-bot-Vozen
   ```
4. **Piper ARM64** — confirma `uname -m` (deve dar `aarch64`) e extrai para `./piper/`:
   ```
   curl -fsSLO https://github.com/rhasspy/piper/releases/latest/download/piper_linux_aarch64.tar.gz
   tar -xzf piper_linux_aarch64.tar.gz   # cria ./piper/ com o binário + .so + espeak-ng-data/
   ```
   (Detalhe da estrutura da pasta: README §5.2.)
5. **Modelos** — pelo menos uma voz em `./models/` (README §5.3):
   ```
   mkdir -p models
   # coloca <voz>.onnx + <voz>.onnx.json em ./models/ (ex.: en_US-amy-medium)
   ```
6. **`.env`** — `cp .env.example .env` e preenche os segredos (ver "Comum" abaixo).
7. Arranca:
   ```
   docker compose up -d --build
   docker compose logs -f vozen
   ```

---

## Opção B — VPS x86 (~€5/mês: Hetzner, DigitalOcean, Contabo, …)

Igual à Opção A, **mas com o Piper `x86_64`** (a máquina é Intel/AMD).

1. Cria a VPS Linux (Ubuntu/Debian). SSH para dentro.
2. Instala Docker + compose v2 (mesmos comandos da Opção A, passo 2).
3. `git clone … && cd discord-bot-Vozen`.
4. **Piper x86_64** — confirma `uname -m` (deve dar `x86_64`):
   ```
   curl -fsSLO https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz
   tar -xzf piper_linux_x86_64.tar.gz
   ```
5. Modelos em `./models/` e `.env` — igual à Opção A (passos 5–6).
6. `docker compose up -d --build`.

**24/7 sem systemd:** o `docker-compose.yml` já usa `restart: unless-stopped`, e o
serviço do Docker arranca no boot da VPS por defeito. Juntos, isto basta para o
container voltar a subir após um crash **ou** um reboot — não precisas de uma unit
systemd à parte. (Se quiseres mesmo uma camada extra, uma unit systemd que corra
`docker compose up -d` no `cd` do projeto é opcional, não obrigatória.)

---

## Opção C — Railway / Render (PaaS)

Viável, **mas com uma ressalva honesta**: o Piper precisa do **binário + modelos
em disco**, e o sistema de ficheiros destes PaaS é tipicamente **efémero** (perde-se
a cada deploy/restart). A cache de áudio regenera-se sozinha, mas o **binário do
Piper e os modelos `.onnx` têm de existir** — ou **dentro da imagem**, ou num
**volume persistente** que o plano ofereça. Sem uma dessas duas coisas, o Piper
não arranca em PaaS efémero; nesse caso **prefere a Opção A (Oracle) ou B (VPS)**.

> **A base de dados SQLite também é efémera.** Num PaaS com FS efémero, a
> `tts.db` (`DB_PATH=/data/tts.db`) é apagada a cada redeploy/restart — não é só
> a cache de áudio que se regenera. Isso significa que **toda a configuração
> por-servidor do `/setup`** (canal de TTS, voz por servidor, blocklist,
> pronúncias, etc.) se perde a cada deploy. Recomendação: monta um **volume/disco
> persistente** para `/data` (onde vive a `tts.db`), ou **prefere VPS/Oracle**, se
> quiseres manter a config entre deploys.

Passos básicos:

1. Liga o repositório ao projeto no Railway/Render (deploy a partir do
   `Dockerfile` deste repo).
2. Define as env vars no painel do serviço (ver "Comum" abaixo). Os caminhos
   `DB_PATH` / `MODELS_DIR` / `PIPER_PATH` que o `docker-compose.yml` fixa **não**
   são aplicados aqui — em PaaS terás de os definir tu (e garantir que apontam
   para onde o Piper/modelos realmente ficam).
3. Garante que o Piper (build da arquitetura do runner) **e** os modelos chegam ao
   container — incluindo-os na imagem **ou** montando um volume persistente. Aponta
   `PIPER_PATH` e `MODELS_DIR` para esses caminhos.

> Sem isto resolvido, o bot liga ao Discord mas qualquer TTS via Piper falha. Não
> há atalho: em PaaS efémero, ou os ficheiros vêm na imagem/volume, ou usa VPS/Oracle.

---

## Comum a todas as opções

### Env vars (no `.env`, ou no painel do PaaS)

**Obrigatórias:**

| Variável        | O que pôr                                         |
| --------------- | ------------------------------------------------- |
| `DISCORD_TOKEN` | Token do bot (Dev Portal → Bot → Reset Token)     |
| `CLIENT_ID`     | Application ID (Dev Portal → General Information) |

**Úteis (opcionais):** `DEFAULT_VOICE` (modelo presente em `./models/`),
`DEFAULT_SPEED`, `INACTIVITY_MS`, `QUEUE_CAP`, `MAX_CHARS`, `RATE_PER_MIN`,
`LOG_LEVEL`, `TTS_ENGINE` (`piper` default | `neural`), `OPENAI_API_KEY`
(só se `TTS_ENGINE=neural`), `HEALTH_PORT` (ver abaixo), `BOT_SHARDS` (ver "Escalar"
abaixo). Tabela completa: README §5.4.

> **Em deploy Docker (Opções A/B)**, **não** definas `DB_PATH` / `MODELS_DIR` /
> `PIPER_PATH` no `.env` — vêm já fixos do `docker-compose.yml` com os caminhos do
> container.

### Verificar que arrancou

```
docker compose logs -f vozen
```

Esperado: uma linha tipo `[client] online como <bot>#<tag>`. Os slash commands são
registados automaticamente no arranque — não corras `npm run register`.

No arranque há também um health-check do ffmpeg: `[health] ffmpeg OK (<versão>)`. Se
vires `[health] ffmpeg nao encontrado ou invalido …`, o binário do `ffmpeg-static`
falta ou é da **plataforma errada** (ex.: um build Linux baixado como `ffmpeg.exe` no
Windows). O bot arranca na mesma, mas a reprodução de voz vai falhar — corre no
Windows `node node_modules/ffmpeg-static/install.js` para rebaixar o binário certo.

### Health endpoint (uptime monitor, opcional)

Desligado por defeito. Define `HEALTH_PORT` (ex.: `HEALTH_PORT=8080`) no `.env` para
o bot responder a `GET /health` com `200 {"status":"ok"}`. Em Docker, para um monitor
**externo** lhe chegar, descomenta o bloco `ports:` no `docker-compose.yml` (mesmo
valor de `HEALTH_PORT` nos dois lados). A imagem traz um `HEALTHCHECK` que sonda este
endpoint quando `HEALTH_PORT` está definido e faz no-op saudável quando não está.

Detalhes e notas de segurança do endpoint: **[docs/GO-PUBLIC.md](docs/GO-PUBLIC.md)**
(secção "Monitorização de uptime").

### Escalar (sharding, opcional — só perto de ~1000+ guilds)

O default é single-process (`npm start` / `node dist/index.js`) e serve confortavelmente
até perto dos ~1000 guilds — não precisas de fazer nada. Para escalar além disso, o
Discord exige múltiplos _gateway shards_ (≈1 shard / 1000 guilds): define `BOT_SHARDS`
(`auto`, ou um inteiro ≥ 2) e arranca com **`npm run start:sharded`** (`node dist/shard.js`),
que faz spawn de um processo por shard. Com `BOT_SHARDS` vazio/ausente, `start:sharded`
comporta-se como o arranque normal. O `npm start` continua single-process e ignora `BOT_SHARDS`.

---

Ver também: **[README §5](docs/SELF-HOST.md#5-deploy-on-a-vps-docker)** (passos Docker em
detalhe + resolução de problemas) e **[docs/GO-PUBLIC.md](docs/GO-PUBLIC.md)**
(tornar o bot público + sempre-ligado).
