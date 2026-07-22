// eslint.config.mjs — flat config. Regras recommended SEM type-checking
// (rápido; as type-aware ficam para depois). Prettier trata do estilo.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'site/',
      'site-dist/',
      'logs/',
      'node_modules/',
      'audio-cache/',
      'scratchpad/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // Afinações para o código deste repo (só afrouxar, sem mexer em lógica):
    rules: {
      // O TypeScript já verifica identificadores indefinidos melhor que o ESLint
      // (e conhece os globais Node via @types/node). Manter no-undef ligado só
      // dá falsos positivos em `process`/`console` nos scripts .mjs.
      'no-undef': 'off',
      // Placeholders com prefixo `_` são intencionais (stubs de assinatura,
      // args de callbacks que temos de aceitar mas não usamos).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Idioma de atribuição em sequência usado intencionalmente (ex.: escolher
      // o vencedor num único for) — não é uma expressão perdida por engano.
      '@typescript-eslint/no-unused-expressions': 'off',
      // RE_EMOJI_EXTRA remove componentes de emoji (VS16, keycap, ZWJ) de
      // propósito; os code points combinantes na classe são desejados.
      'no-misleading-character-class': 'off',
    },
  },
  {
    // Nos testes, stubs/mocks usam `any` e `require()` de propósito.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // shard.ts usa `require('./index')` preguiçoso de propósito (import no topo
    // executaria main() no ramo de sharding) — ver o comentário no ficheiro.
    files: ['src/shard.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Scripts CommonJS de operações (ex.: tools/register-guild.cjs): `require()` é
    // o idioma nativo do .cjs (importam o dist compilado, que também é CommonJS).
    files: ['tools/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Regras TYPE-AWARE cirúrgicas só para src/ (não o recommendedTypeChecked inteiro, que
    // inundaria): apanham a classe de bugs "promessa fire-and-forget cuja rejeição vira um
    // unhandledRejection" — que já mordeu o projeto uma vez (plano 002). Precisa de type-info,
    // por isso `projectService`.
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
);
