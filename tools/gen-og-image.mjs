// tools/gen-og-image.mjs
//
// Gera site/assets/og-image.png (1200x630) a partir do banner de marca
// (assets/vozen-banner.png) — o og:image que aparece quando um link do Vozen e
// partilhado no Discord/Twitter. Cover-fit centrado: mantem o logo+wordmark
// completos, corta so uns pixeis no topo/fundo (o banner e 1792x1024).
//
// Regenerar (sharp NAO esta em package.json, e so uma ferramenta de build):
//   npm i --no-save sharp
//   node tools/gen-og-image.mjs

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets', 'vozen-banner.png');
const out = join(root, 'site', 'assets', 'og-image.png');

const info = await sharp(src)
  .resize(1200, 630, { fit: 'cover', position: 'center' })
  .png()
  .toFile(out);
console.log(`og-image.png escrito de ${src}: ${info.size} bytes (1200x630)`);
