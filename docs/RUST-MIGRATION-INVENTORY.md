# Inventário da migração Rust — concluído

O runtime Discord, a store SQLite, TTS, jogos, comandos e APIs do Vozen vivem
agora nos crates Rust. Não existem ficheiros `.ts` no branch `main`. O branch
`legacy-typescript` preserva o snapshot anterior à limpeza para recuperação.

## Contratos preservados

| Área | Fonte Rust | Verificação |
| --- | --- | --- |
| Comandos Discord | `crates/vozen-contracts` e `crates/vozen-discord` | contrato JSON + testes de parsing/registro |
| SQLite | `crates/vozen-store` | schema JSON, migrações e integridade |
| Voz e i18n | `crates/vozen-tts`, `crates/vozen-discord` | catálogo gerado e testes de modelos/idiomas |
| Jogos e conteúdo | `crates/vozen-core`, `crates/vozen-discord/assets` | conteúdo JSON + testes de todas as rondas |
| Site | `site/`, `tools/*.mjs`, `site-tests/` | 54 testes, i18n, copy e minificação |

## Integrações mantidas

- Top.gg: webhook autenticado, replay/idempotência, recompensas e métricas.
- Ko-fi: token, pending/claim e concessões idempotentes.
- Premium/OAuth: `/api/me/premium`, CORS, audience e email verificado.
- Dashboard/admin: autorização Discord e estado de configuração.
- Site/API: Pages em `vozen.org` e health/API em `api.vozen.org`.

Os nomes de ambiente e os caminhos HTTP públicos permanecem compatíveis. O
deploy faz backup SQLite, healthcheck, canário de gateway e rollback da imagem;
nenhuma base de produção é apagada ou migrada destrutivamente.

## Gates de saída

`node tools/check-rust-contracts.mjs`, `node tools/check-rust-canaries.mjs`,
`cargo fmt`, `cargo check`, `cargo clippy`, `cargo test` e `npm run check:site`
passam antes de publicar. A CI constrói `Dockerfile.rust`; o deploy em `main`
usa apenas `docker-compose.rust.prod.yml`.
