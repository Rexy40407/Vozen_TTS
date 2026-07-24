import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { format } from 'prettier';
import { buildDiscordCommandContract } from '../src/contracts/discordCommandContract';

const target = path.resolve('contracts/discord-commands.json');
const check = process.argv.includes('--check');

async function main(): Promise<void> {
  const expected = await format(buildDiscordCommandContract(), {
    parser: 'json',
    printWidth: 100,
    singleQuote: true,
  });

  if (check) {
    const actual = existsSync(target) ? readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';
    if (actual !== expected) {
      console.error('Rust command contract is stale. Run: npm run build:rust-contracts');
      process.exitCode = 1;
    }
    return;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, expected, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), target)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
