# Vozen — type it, hear it.
# Imagem Docker multi-stage para deploy hosted (invite-and-go) numa VPS Linux.
#
# Notas importantes:
#  - Base Debian (bookworm), NUNCA Alpine: os prebuilds nativos de
#    better-sqlite3 / sodium-native / @discordjs/opus assumem glibc; o musl do
#    Alpine quebra-os.
#  - A MESMA major do Node nos dois stages (ABI nativa tem de bater certo):
#    builder = node:22-bookworm, runtime = node:22-bookworm-slim.
#  - O binario do Piper e os modelos .onnx NAO entram na imagem (licencas/tamanho):
#    vem por volumes montados em runtime (ver docker-compose.yml e README).

# ---------- builder ----------
FROM node:22-bookworm AS builder
WORKDIR /app

# Toolchain de compilacao nativa: usado apenas como fallback quando algum
# pacote nao tem prebuild para esta plataforma (better-sqlite3 / sodium-native
# / @discordjs/opus). node-gyp precisa de python3 + make + g++ (build-essential).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Instala dependencias primeiro (camada cacheavel) a partir do lockfile.
COPY package.json package-lock.json ./
RUN npm ci

# Copia o resto do codigo e compila TypeScript -> dist/.
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Copia o node_modules JA construido (inclui os .node nativos compilados no
# builder — a ABI bate certo porque a major do Node e a mesma) e o dist + o
# package.json. NAO reinstala nada nem precisa de toolchain aqui.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Script do HEALTHCHECK (ver HEALTHCHECK abaixo). Copiado do contexto de build
# (nao vem do builder). Invocado via `sh` no HEALTHCHECK, por isso nao depende
# do bit de execucao — robusto mesmo se o ficheiro for criado em Windows.
COPY docker/healthcheck.sh /app/docker/healthcheck.sh

# /data e o diretorio persistente: a base de dados SQLite (DB_PATH=/data/tts.db),
# os ficheiros WAL/SHM e a cache de audio (audio-cache/, criada ao lado da DB).
# O utilizador 'node' (uid 1000, ja existe na imagem oficial) tem de poder
# escrever aqui. Em runtime este caminho recebe um volume nomeado (ver compose).
RUN mkdir -p /data && chown -R node:node /data

# Corre como utilizador nao-root.
USER node

# HEALTHCHECK condicional ao HEALTH_PORT.
#  - Sem HEALTH_PORT (default): o script faz exit 0 (saudavel) — o bot nao expoe
#    health endpoint por defeito, por isso o probe nao pode falhar nesse caso.
#  - Com HEALTH_PORT: sonda GET /health e reporta unhealthy se nao responder 200.
# O check usa `node` (ja na imagem) — nao instalamos wget/curl. start-period da
# folga ao arranque (login no Discord + registo de comandos) sem flapar.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD ["sh", "/app/docker/healthcheck.sh"]

# Entry real do bot (CommonJS — package.json sem "type":"module").
# Os slash commands sao registados automaticamente no arranque (src/index.ts),
# por isso nao e preciso um passo 'npm run register' separado em producao.
CMD ["node", "dist/index.js"]
