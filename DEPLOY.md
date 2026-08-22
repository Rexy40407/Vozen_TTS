# Deploy do Vozen Rust

O runtime oficial é a imagem `Dockerfile.rust` e o compose de produção
`docker-compose.rust.prod.yml`. O antigo runtime Node/TypeScript não faz parte da
imagem nem do processo de deploy.

## VPS

```sh
git clone --branch migration/vozen-rust --single-branch https://github.com/Rexy40407/vozen.git
cd vozen
cp .env.rust.prod.example .env.rust.prod
# preencher DISCORD_TOKEN, CLIENT_ID e integrações Top.gg/Ko-fi/API necessárias
docker compose -f docker-compose.rust.prod.yml up -d --build
docker compose -f docker-compose.rust.prod.yml logs -f vozen
```

O volume `./rust-data:/data` contém a base SQLite e as caches. Faça backup de
`rust-data/tts.db` antes de cada atualização; o deploy oficial também cria um
backup automático antes de recriar o contentor. `restart: unless-stopped` mantém
o bot ativo depois de crashes e reboots, desde que o serviço Docker arranque no
boot.

## Verificação

```sh
docker compose -f docker-compose.rust.prod.yml ps
docker compose -f docker-compose.rust.prod.yml logs --tail 100 vozen
curl -fsS http://127.0.0.1:3001/health
```

Confirme nos logs `gateway ... Ready` e uma resposta HTTP 200. O site público e
a API (`https://vozen.org` e `https://api.vozen.org/health`) são serviços
separados, mas continuam a usar os contratos Premium/OAuth, Top.gg e Ko-fi
mantidos nos crates Rust.

## Atualizações e rollback

The production compose file enables `PUBLIC_STATUS_ENABLED=true` automatically.
Once Caddy points `api.vozen.org` at port 3001, `https://vozen.org/status`
reads the live bot, database, and voice-provider state. The public endpoint only
exposes coarse aggregate states; it never exposes tokens, messages, or internals.

1. `git fetch origin && git checkout migration/vozen-rust && git pull --ff-only`.
2. Pare o compose, copie `rust-data/tts.db` para um backup datado.
3. `docker compose -f docker-compose.rust.prod.yml up -d --build`.
4. Se a verificação falhar, volte ao commit anterior e restaure apenas a cópia
   de segurança da base; nunca apague a base em produção.

Antes de publicar, a CI executa os contratos JSON, canários, testes/clippy Rust,
os testes do site e a construção da imagem. A branch `legacy-typescript` mantém
o snapshot de recuperação do runtime antigo.
