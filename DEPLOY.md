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

## Encrypted production storage with manual unlock

The installed host procedures in `deploy/encryption/` operate on the existing
LUKS device `/dev/mapper/vozen-data` mounted at `/srv/vozen-secure`. They do not
format or migrate disks. Do not install them blindly on other hosts.

For this installation, Docker uses `restart=no` and the encrypted runtime
systemd service supervises the container after operator unlock. After reboot,
the bot remains stopped until its key is supplied through stdin. Keep keys
outside the VPS and Git, with an independently tested recovery copy. Two DPAPI
files tied to the same Windows profile are not an independent recovery backup.

Install the mount unit with its escaped name `srv-vozen\x2dsecure.mount`.
The runtime orders itself after the mount but does not require it at boot,
avoiding a dependency wait for an absent mapper. The host guard checks the
mount, mapper, data marker, database and expected data-directory symlink.

Unlock and run `/usr/local/sbin/vozen-data-guard` before publishing. Use the
actual project `VOZEN_COMPOSE_PROJECT=vozen-rust-prod`, not the historical
default `vozen-prod`. The deployment script exports the disabled Docker restart
policy when `/etc/vozen/encryption-enabled` exists. For manual Compose commands,
pass `--env-file .env.rust.prod`: a service's `env_file` does not provide Compose
interpolation variables. Preserve `VOZEN_REQUIRE_ENCRYPTED_DATA=1` in private
configuration. Never start a second production gateway.

Preserve ACLs and xattrs when copying data (`rsync -aAX`) and test access with
the actual container UID before cutover. Use the SQLite online backup script
instead of copying only an active WAL database's main file. Verify integrity,
foreign keys, HTTP health, gateway readiness and the encrypted backup target.
Never restore an old database snapshot over newer writes without an explicit
recovery decision; image rollback and database restore are separate operations.

Encryption of active data does not encrypt historical plaintext copies,
provider backups or old disk blocks from a copy-based migration. Retire exact
historical copies only after independent recovery verification and explicit
owner authorization. Do not claim complete coverage while those copies remain.
