// tools/upload-app-emojis.mjs
//
// Uploads ALL of the bot's emoji tiles (assets/<group>/*.png — chess, wordle, …)
// as APPLICATION EMOJIS. App emojis work in any server without Nitro or guild
// slots. IDEMPOTENT: lists the existing ones and creates only the missing ones. Run
// once (or whenever you add/swap assets):
//   node tools/upload-app-emojis.mjs
//
// Needs DISCORD_TOKEN + CLIENT_ID in the environment (the same .env as the bot).

import { REST, Routes } from 'discord.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../dist/config/index.js';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/** All PNGs in assets/<group>/*.png (one level of subdirectories). */
function collectPngs() {
  const out = [];
  for (const group of readdirSync(ASSETS)) {
    const dir = join(ASSETS, group);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.png')) out.push({ name: basename(file, '.png'), path: join(dir, file) });
    }
  }
  return out;
}

async function main() {
  const cfg = loadConfig();
  const rest = new REST({ version: '10' }).setToken(cfg.token);

  const existing = await rest.get(Routes.applicationEmojis(cfg.clientId));
  const have = new Map((existing.items ?? []).map((e) => [e.name, e.id]));

  const pngs = collectPngs();
  let created = 0;
  let skipped = 0;
  for (const { name, path } of pngs) {
    if (have.has(name)) {
      skipped++;
      continue;
    }
    const b64 = readFileSync(path).toString('base64');
    const res = await rest.post(Routes.applicationEmojis(cfg.clientId), {
      body: { name, image: `data:image/png;base64,${b64}` },
    });
    have.set(name, res.id);
    created++;
    console.log(`+ ${name} -> ${res.id}`);
  }

  console.log(`\nfeito: ${created} criados, ${skipped} já existiam, ${have.size} no total.`);
}

main().catch((err) => {
  console.error('[upload-app-emojis] failed:', err);
  process.exit(1);
});
