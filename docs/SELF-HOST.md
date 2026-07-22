# Self-hosting Vozen

You do **not** need this page to use Vozen. The public bot is hosted and ready to
invite — see the [README](../README.md). This page is for people who want to run
their **own** instance, as the AGPL-3.0 license allows.

Related operator docs:

- [`GO-LIVE.md`](../GO-LIVE.md) — checklist to take an instance public.
- [`DEPLOY.md`](../DEPLOY.md) — hosting options (Oracle free tier, VPS, PaaS).
- [`docs/DEPLOY-VPS.md`](DEPLOY-VPS.md) — the full VPS recipe used in production
  (systemd + Caddy + the Premium API over HTTPS).
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — how the code is laid out.

---

## Quickstart (3 lines)

Already have Node (>= 22.12), the Piper binary and at least one `.onnx` voice model?
Then the minimum to get going is:

```bash
git clone https://github.com/Rexy40407/discord-bot-Vozen.git vozen && cd vozen
npm install                       # deps + native bindings
cp .env.example .env              # edit: DISCORD_TOKEN, CLIENT_ID, PIPER_PATH, MODELS_DIR; then: npm run register && npm run dev
```

That is just the summary. The step-by-step is below.

---

## 1. Prerequisites

### 1.1 Software

- **Node.js LTS** (>= 22.12 — required by `@discordjs/voice`). Check with:
  ```
  node -v
  npm -v
  ```
- **ffmpeg** — already bundled via `ffmpeg-static` (an npm dependency). You don't need to install anything by hand.
- **System**: Windows (primary target). On Windows, make sure you have the **Build Tools** to compile `better-sqlite3`/`sodium-native` if npm asks (usually the prebuilds are enough).

### 1.2 Piper binary

1. Go to https://github.com/rhasspy/piper/releases and download the build for **Windows** (`piper_windows_amd64.zip` or equivalent).
2. Extract it to a folder of yours, for example `C:\piper\`. Confirm that `C:\piper\piper.exe` exists.
3. That path is what you'll put in `PIPER_PATH` in the `.env`.

### 1.3 Voice models (.onnx)

Piper needs **voice models**. Each model is 2 files: `<voice>.onnx` and `<voice>.onnx.json`.

1. Create the `models/` folder at the project root:
   ```
   mkdir models
   ```
2. Download **1 or 2 voices** from https://huggingface.co/rhasspy/piper-voices (or from the Piper releases). Suggestion to start:
   - Portuguese: `pt_PT-tugão-medium` (or `pt_BR-faber-medium`)
   - English: `en_US-amy-medium`
3. Place **both** files of each voice inside `models/`. Example:
   ```
   models/
     en_US-amy-medium.onnx
     en_US-amy-medium.onnx.json
     pt_PT-tugão-medium.onnx
     pt_PT-tugão-medium.onnx.json
   ```
4. The model name (without extension) — e.g. `en_US-amy-medium` — is what you use as `DEFAULT_VOICE` and in `/voice set`.

### 1.4 Environment file

Copy the example and fill it in:

```
copy .env.example .env
```

Edit `.env`:

| Variable        | What to put                                                   |
| --------------- | ------------------------------------------------------------- |
| `DISCORD_TOKEN` | Bot token (Discord Dev Portal → Bot → Reset Token)            |
| `CLIENT_ID`     | Application ID (Dev Portal → General Information)             |
| `PIPER_PATH`    | Path to the executable, e.g. `C:\piper\piper.exe`             |
| `MODELS_DIR`    | Path to the models folder, e.g. `./models`                    |
| `DB_PATH`       | SQLite path, e.g. `./tts.db`                                  |
| `DEFAULT_VOICE` | Name of a model present in `models/`, e.g. `en_US-amy-medium` |
| `DEFAULT_SPEED` | Base speed, e.g. `1.0`                                        |
| `QUEUE_CAP`     | Maximum queue size, e.g. `20`                                 |
| `MAX_CHARS`     | Max characters per message, e.g. `300`                        |
| `RATE_PER_MIN`  | Messages per minute per user, e.g. `5`                        |

`.env.example` is the full reference — it lists every variable the bot reads,
including the optional ones (Premium API, Ko-fi, sidecars).

### 1.5 Voice models (languages)

Vozen **detects the language of each message** and automatically picks a model whose name starts with that language's **locale prefix**. You just drop the right model into `models/`.

**Where to get models.** All Piper models live at **https://huggingface.co/rhasspy/piper-voices** (a folder per language/country/voice). Each voice is always **2 files**: `<voice>.onnx` + `<voice>.onnx.json`. Download **both** and put them in `models/`.

**How the file name maps to detection.** Vozen looks only at the **locale prefix** at the start of the file name (`pt_`, `en_`, `es_`, ...). So `pt_PT-tugão-medium` **and** `pt_BR-faber-medium` both count as Portuguese — if you only have one, that's the one that plays; if you have both, the first one by order plays. If there is no model for the detected language, Vozen falls back to `DEFAULT_VOICE`.

Mapped languages (detection code → file-name prefix):

| Language                                                  | Prefix                                        | Example model                              |
| --------------------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| Portuguese (PT **and** BR)                                | `pt_`                                         | `pt_PT-tugão-medium`, `pt_BR-faber-medium` |
| English                                                   | `en_`                                         | `en_US-amy-medium`, `en_GB-alan-low`       |
| Spanish                                                   | `es_`                                         | `es_ES-davefx-medium`                      |
| French                                                    | `fr_`                                         | `fr_FR-siwis-medium`                       |
| German                                                    | `de_`                                         | `de_DE-thorsten-medium`                    |
| Italian                                                   | `it_`                                         | `it_IT-riccardo-x_low`                     |
| Dutch                                                     | `nl_`                                         | `nl_NL-mls-medium`                         |
| Russian                                                   | `ru_`                                         | `ru_RU-dmitri-medium`                      |
| Polish · Ukrainian · Turkish · Czech · Catalan            | `pl_` · `uk_` · `tr_` · `cs_` · `ca_`         | —                                          |
| Swedish · Finnish · Danish · Romanian · Greek · Hungarian | `sv_` · `fi_` · `da_` · `ro_` · `el_` · `hu_` | —                                          |

> You don't need **every** language: put in only the models you want to serve. Those without a model fall back to `DEFAULT_VOICE`.

**Regional `DEFAULT_VOICE`.** The factory default is `en_US-amy-medium`, but you can set **any** model present in `models/` — including a regional one — directly in the `.env`. Examples: `DEFAULT_VOICE=pt_PT-tugão-medium`, `pt_BR-faber-medium`, `es_ES-davefx-medium`, `fr_FR-siwis-medium`, `de_DE-thorsten-medium`. It is the voice used when the detected language has no matching model (and the starting point for mostly-PT/European servers).

---

## 2. Setup

```
npm install
npm run register
npm run dev
```

- `npm install` — installs dependencies and compiles the native bindings.
- `npm run register` — registers the slash commands on the Discord application (uses `DISCORD_TOKEN` + `CLIENT_ID`). Run this **once** and whenever you change command definitions.
- `npm run dev` — starts the bot. Expected in the terminal: `[client] online as <bot-name>#0000`.

For production, use `npm run start:prod` (it runs the supervisor: single-instance lock, native-module preheat, auto-restart, persistent logs). `node dist/index.js` runs the bot directly **without** that supervisor — not recommended in production.

---

## 3. Verify your install (manual checklist)

Run this checklist with the bot running (`npm run dev`) and you in a test Discord server where you are admin. Check off each item.

### 3.1 Create and configure the Discord application

- [ ] At https://discord.com/developers/applications → **New Application** → name it.
- [ ] **Bot** tab → **Reset Token** → copy the token into `DISCORD_TOKEN` in the `.env`.
- [ ] **General Information** → copy the **Application ID** into `CLIENT_ID` in the `.env`.
- [ ] **Bot** tab → **Privileged Gateway Intents** section → enable:
  - [ ] **MESSAGE CONTENT INTENT** (required to read message text and autoread).
  - [ ] **SERVER MEMBERS INTENT** (to resolve mention names).
- [ ] **Save Changes**.

### 3.2 Invite the bot

- [ ] **OAuth2 → URL Generator** → scopes: `bot` + `applications.commands`.
- [ ] Bot Permissions: `Connect`, `Speak`, `Send Messages`, `Read Message History`, `View Channels`.
- [ ] Open the generated URL, pick your test server, authorize.
- [ ] Confirm the bot appears **offline** in the member list (it will come online in step 3.3).

### 3.3 Startup

- [ ] `npm run register` ran without errors.
- [ ] `npm run dev` shows the client online line and the bot appears **online** in the server.

### 3.4 Basic voice

- [ ] Join a voice channel in the server.
- [ ] Type `/join` in a text channel. Expected: the bot joins your voice channel and confirms.
- [ ] Type `/tts text:hello`. Expected: you hear "hello" synthesized by Piper.
- [ ] Type `/leave`. Expected: the bot leaves the voice channel.

### 3.5 Auto-read

- [ ] `/join` again.
- [ ] Configure the auto-read channel: `/config tts-channel channel:#general` and `/config auto-read active:true`.
- [ ] Type a normal sentence in that channel (no command). Expected: the bot reads the sentence out loud.
- [ ] Type a sentence in another **non**-configured channel. Expected: the bot does **not** read it.

### 3.6 Text cleaning

With auto-read on, type each of these and confirm the behavior you hear:

- [ ] **Emoji**: `hi 😀 world` → you hear "hi world" (emoji skipped, its name not read).
- [ ] **URL**: `look at https://example.com now` → you hear "look at link now".
- [ ] **User mention**: `hi @YourName` → you hear "hi " followed by the **name** (not the numeric ID).
- [ ] **Channel mention**: `go to #general` → you hear "go to general" (channel name).
- [ ] **Code block**: a message with ` ```block``` ` → the code block is announced, not read verbatim.
- [ ] **Repetitions**: `aaaaaaaaaa` → collapsed (you don't hear 10 "a"s).
- [ ] **Long message**: type text above `MAX_CHARS` → it is truncated, the bot doesn't lock up.

### 3.7 Mentions and replies to the bot

- [ ] Do `@BotName hi` in any channel. Expected: the bot reads "hi".
- [ ] **Reply** to a message from the bot with text. Expected: the bot reads your text.

### 3.8 Language detection and per-user voice

- [ ] Type a sentence clearly in **English** → you hear an EN voice (if you have an EN model).
- [ ] Type a sentence clearly in **Portuguese** → you hear a PT voice (if you have a PT model).
- [ ] `/voice set model:en_US-amy-medium speed:1.0` (use a model you have in `models/`). Expected: confirmation that the voice was saved.
- [ ] Now type **in Portuguese** → you hear the EN voice you pinned (the user's voice takes **priority** over language detection).
- [ ] `/voice reset` → back to the language-detection behavior.

### 3.9 Queue and skip

- [ ] Paste **several** messages in quick succession (or several `/tts`). Expected: they play in order (FIFO), one at a time.
- [ ] During a long read, type `/skip`. Expected: it jumps to the next item in the queue immediately.
- [ ] Fill the queue above `QUEUE_CAP`. Expected: new entries are refused with a warning, the bot does **not** crash.

### 3.10 Moderation

- [ ] Add a blockword: `/config block-word add word:badword`.
- [ ] Type a sentence containing that word (or do `/tts text:badword`). Expected: it is **not** synthesized (filtered before TTS, both in auto-read and `/tts`).
- [ ] `/config block-word remove word:badword` → the sentence is read again.
- [ ] Send messages very fast (more than `RATE_PER_MIN` in a minute). Expected: past the limit, the extras are ignored/warned (per-user rate-limit).

### 3.11 Cache

- [ ] `/tts text:cache test` → note the time until you hear it.
- [ ] Repeat **exactly** `/tts text:cache test` with the same voice. Expected: it plays faster (served from the cache by a text+voice hash, without re-synthesizing).

### 3.12 Reliability — reconnection and inactivity

- [ ] With the bot playing, **force-disconnect it**: right-click the bot in the voice channel → **Disconnect** (or move it to another channel). Expected: the bot **reconnects automatically** to the channel and resumes, without crashing.
- [ ] Leave the bot alone in a voice channel with no human members. Expected: it leaves automatically unless Premium 24/7 mode is enabled.
- [ ] Throughout the whole session: confirm in the terminal that there was **no crash** (no stack trace killing the process). Occasional errors should be caught and logged, but the bot stays alive.

---

## 4. Troubleshooting

- **The bot doesn't read text / auto-read doesn't work**: confirm **MESSAGE CONTENT INTENT** is enabled in the Dev Portal.
- **Mentions come out as IDs**: confirm **SERVER MEMBERS INTENT** and that the bot can see the server members.
- **`piper` not found / error synthesizing**: confirm `PIPER_PATH` points to the right `.exe` and that the `.onnx`/`.onnx.json` files are in `MODELS_DIR`.
- **Commands don't appear**: run `npm run register` again; global commands can take a while to propagate.
- **No audio**: confirm the bot has `Connect` and `Speak` permissions in the voice channel.

---

## 5. Deploy on a VPS (Docker)

You run Vozen on a Linux VPS with `docker compose`, without installing Node or build tools by hand. The bot is an outbound websocket client — it does **not** expose ports and needs no domain/reverse-proxy.

> The production instance does **not** use this path — it runs from source under
> systemd (see [`docs/DEPLOY-VPS.md`](DEPLOY-VPS.md)). The Docker image build and
> real Piper synthesis inside it are **(live verification pending)**.

### 5.1 Prerequisites

- A Linux VPS (e.g. Ubuntu/Debian) with **Docker** and the **docker compose v2** plugin installed (`docker --version`, `docker compose version`).
- The project code on the VPS (e.g. `git clone` of the repository).

### 5.2 Piper binary (Linux)

Piper for Linux is **not** a standalone executable: it is a folder with the binary **plus** shared libraries (`libonnxruntime`, `libespeak-ng`, etc.) and the `espeak-ng-data/` folder. You have to mount the **whole folder** and point `PIPER_PATH` at the binary inside it.

1. Go to https://github.com/rhasspy/piper/releases and download the **Linux x86_64** build (e.g. `piper_linux_x86_64.tar.gz`).
2. Extract it to `./piper/` at the project root (next to `docker-compose.yml`). It should look like:
   ```
   piper/
     piper                  # the binary (no extension on Linux)
     libpiper_phonemize.so* # + other .so
     espeak-ng-data/
   ```
   The `docker-compose.yml` mounts `./piper` at `/opt/piper` (read-only) and sets `PIPER_PATH=/opt/piper/piper`.

### 5.3 Voice models (.onnx)

1. Create the `./models/` folder at the project root.
2. Put **at least one** voice there — each voice is 2 files (`<voice>.onnx` + `<voice>.onnx.json`), from https://huggingface.co/rhasspy/piper-voices. Suggestion to start: `en_US-amy-medium`.
   ```
   models/
     en_US-amy-medium.onnx
     en_US-amy-medium.onnx.json
   ```
   The `docker-compose.yml` mounts `./models` at `/models` (read-only) and sets `MODELS_DIR=/models`.
3. Make sure `DEFAULT_VOICE` in the `.env` matches a model present in `./models/`.

### 5.4 `.env` file

```
cp .env.example .env
```

Fill in **only** the secrets and tunables — do **not** set `DB_PATH`, `MODELS_DIR` or `PIPER_PATH` in the `.env`: those come fixed from `docker-compose.yml` with the container paths (`/data/tts.db`, `/models`, `/opt/piper/piper`).

| Variable         | Required?                   | What to put                                             |
| ---------------- | --------------------------- | ------------------------------------------------------- |
| `DISCORD_TOKEN`  | **Yes**                     | Bot token (Dev Portal → Bot → Reset Token)              |
| `CLIENT_ID`      | **Yes**                     | Application ID (Dev Portal → General Information)       |
| `DEFAULT_VOICE`  | No                          | Model present in `./models/`, e.g. `en_US-amy-medium`   |
| `DEFAULT_SPEED`  | No                          | Base speed (default `1.0`)                              |
| `QUEUE_CAP`      | No                          | Maximum queue size (default `20`)                       |
| `MAX_CHARS`      | No                          | Max characters per message (default `300`)              |
| `RATE_PER_MIN`   | No                          | Messages per minute per user (default `5`)              |
| `LOG_LEVEL`      | No                          | `debug` \| `info` \| `warn` \| `error` (default `info`) |
| `TTS_ENGINE`     | No                          | `piper` (default), `neural`, or legacy `gtts`/`router`  |
| `OPENAI_API_KEY` | Only if `TTS_ENGINE=neural` | OpenAI API key                                          |

### 5.5 Startup

```
docker compose up -d --build   # builds the image and starts in the background
docker compose logs -f vozen   # follow the logs
docker compose down            # stops and removes the container (data persists in the volume)
```

- The **slash commands are registered automatically** on startup — you do **not** need to run `npm run register` in the Docker deploy.
- The database, the WAL/SHM and the audio cache live in the named volume `data` (`/data` in the container) and **persist** across `up`/`down`. To also wipe the data: `docker compose down -v`.
- To update to a new version: `git pull` and `docker compose up -d --build`.

### 5.6 Troubleshooting (Docker)

- **`Missing required env var: DISCORD_TOKEN` / `CLIENT_ID`**: fill them in the `.env` (section 5.4).
- **Piper fails to start / error loading libraries (`error while loading shared libraries` or similar)**: confirm you mounted the **whole** Piper folder (not just the binary). If system runtime libs are missing, install them in the image (e.g. `apt-get install -y libgomp1 libstdc++6`) — the `-slim` base may not include them.
- **`/voice list` empty / no audio**: confirm there is a `.onnx` (+ `.onnx.json`) in `./models/` and that `DEFAULT_VOICE` matches one of them.

---

## 6. Optional sidecars

These are off unless you install them; the bot detects each one at startup and
hides or disables the matching feature when it is absent.

| Sidecar                          | Powers                      | Installer                        | Notes                                                                  |
| -------------------------------- | --------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| Kokoro (`kokoro-onnx`, ONNX/CPU) | `/voice set engine:Kokoro`  | `tools/setup-kokoro.ps1`         | No PyTorch. Requires Plus or Premium at runtime.                        |
| faster-whisper                   | `/transcribe` (voice→text)  | `tools/setup-whisper.{sh,ps1}`   | Model `base` runs on a small VPS (~2.2s per 13.6s of speech).          |

---

## 7. TTS engine choice

`TTS_ENGINE` defaults to `piper` — local, free, and the only mode supported here.

> `gtts` and `router` call an **unofficial** Google Translate endpoint and are retained
> only as explicit legacy/self-hosting options. Use an official provider API when a
> production deployment requires contractual API support. Whatever you pick, it changes
> where message text goes — disclose it in your instance's privacy policy
> (see [`PRIVACY.md`](../PRIVACY.md), which documents each engine's data flow).

---

## 8. Registering your instance with Discord

The Discord Developer Portal asks for a **Privacy Policy URL** and a **Terms of
Service URL** (for _Public Bot_ / verification). If your fork is public on GitHub,
you can point them at your own copies of these files:

- Privacy Policy URL: `https://github.com/<you>/<your-fork>/blob/main/PRIVACY.md`
- Terms of Service URL: `https://github.com/<you>/<your-fork>/blob/main/TERMS.md`

Before publishing, fill in the contact/responsible-party field at the end of
`PRIVACY.md` with **your** details — you are the controller for your instance, not
the upstream author. [`GO-LIVE.md`](../GO-LIVE.md) is the full checklist.

---

## 9. Your obligations under AGPL-3.0

If you run a **modified** Vozen and let other people use it over a network, you
must make that modified source available to those users. Running it unmodified
for your own server carries no such obligation. See [`LICENSE`](../LICENSE) for
the full text, and [`PRIVACY.md`](../PRIVACY.md) — as the operator of your
instance, **you** are the data controller for it.
