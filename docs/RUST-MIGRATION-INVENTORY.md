# Inventário da migração Rust

Este inventário é a barreira de segurança antes de remover o legado TypeScript.
O branch `legacy-typescript` preserva o estado anterior à limpeza.

## Fontes TypeScript ainda referenciadas

| Área | Ficheiros de origem | Substituto/consumidor Rust |
| --- | --- | --- |
| Contratos Discord | `src/contracts/*`, `tools/export-rust-contracts.ts` | `crates/vozen-contracts`, contrato gerado em `crates/vozen-discord` |
| Schema SQLite | `src/contracts/sqliteSchemaContract.ts`, `tools/export-rust-schema.ts` | `crates/vozen-store` e migrações Rust |
| Voz e i18n | `src/language/*`, `src/i18n/*`, exporters Rust | `crates/vozen-tts`, `crates/vozen-discord`, catálogos gerados |
| Jogos e conteúdo | `src/games/*`, `src/games/content/*`, exporters Rust | `crates/vozen-core`, `crates/vozen-discord/assets` |
| Site | `tools/i18n-src/*`, `tools/*.mjs`, `site/*` | Continua separado do runtime; não depende do bot TypeScript |

## Integrações que não podem regredir

| Contrato | Implementação Rust | Verificação obrigatória |
| --- | --- | --- |
| Top.gg webhook e recompensas | `crates/vozen-api/src/topgg_webhook.rs` | assinatura, replay, duplicados, recompensa e `/webhook/topgg` |
| Top.gg métricas/comandos | `crates/vozen-runtime/src/topgg_metrics.rs` | sincronização de comandos e publicação periódica |
| Ko-fi | `crates/vozen-api/src/kofi_webhook.rs` | token, idempotência, pending grant e `/webhook/kofi` |
| Premium/OAuth | `crates/vozen-api/src/premium_api.rs`, `discord_oauth.rs` | `/api/me/premium`, CORS, audience, email verificado |
| Dashboard/admin | `crates/vozen-api/src/dashboard_api.rs`, `admin_api.rs` | autorização Discord e respostas compatíveis |
| Site | `site/`, `site/js/*`, `site/css/*` | build do Pages, `https://vozen.org`, `https://api.vozen.org/health` |

## Regras de remoção

1. Não remover uma origem TypeScript enquanto o substituto Rust não tiver teste de paridade.
2. Não alterar `tts.db` nesta limpeza; o deploy continua a usar backup e rollback.
3. Não remover nomes de variáveis do `.env.rust.prod` sem atualizar runtime, documentação e teste de arranque.
4. O site continua com build independente; apenas o runtime do bot muda para Rust-only.

## Critério de saída

O legado só sai da `main` quando os contratos acima passarem em CI, o staging responder
com `Ready`, e o deploy de produção confirmar DB íntegra, API acessível e rollback disponível.
