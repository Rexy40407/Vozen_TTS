import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter((file) => /\.(cjs|css|html|js|json|mjs|md|yml|yaml)$/.test(file));
const prettierCli = require.resolve('prettier/bin/prettier.cjs');
const result = spawnSync(
  process.execPath,
  [prettierCli, '--check', '--ignore-path', '.prettierignore', ...files],
  {
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
