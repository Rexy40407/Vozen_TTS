#!/bin/sh
# Vozen — Docker HEALTHCHECK.
#
# O servidor de health (src/health.ts) so arranca quando HEALTH_PORT esta
# definido. Por isso o check tem de ser um NO-OP saudavel quando HEALTH_PORT
# nao esta definido — caso contrario marcaria o container como "unhealthy" no
# deploy default (sem health endpoint), o que seria um falso negativo.
#
#   - HEALTH_PORT ausente/vazio  -> exit 0 (saudavel; nada a sondar)
#   - HEALTH_PORT definido       -> GET http://127.0.0.1:$HEALTH_PORT/health
#                                   200 -> exit 0 ; qualquer outra coisa -> exit 1
#
# Implementacao via `node` (ja presente na imagem runtime) em vez de wget/curl:
# a base node:22-bookworm-slim nao garante wget/curl, e usar o http nativo do
# Node evita instalar qualquer pacote extra. O pedido tem timeout para nao
# pendurar o probe se o processo estiver vivo mas preso.

if [ -z "$HEALTH_PORT" ]; then
  exit 0
fi

exec node -e '
  const http = require("node:http");
  const port = process.env.HEALTH_PORT;
  const req = http.get(
    { host: "127.0.0.1", port, path: "/health", timeout: 4000 },
    (res) => { res.resume(); process.exit(res.statusCode === 200 ? 0 : 1); },
  );
  req.on("timeout", () => { req.destroy(); process.exit(1); });
  req.on("error", () => process.exit(1));
'
