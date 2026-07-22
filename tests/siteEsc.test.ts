import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// TEST-05: the site panel's `esc()` function escapes HTML before injecting it into the DOM — it
// is the anti-XSS barrier for data coming from the API (names, emails, premium state). We do not
// extract it into a module (the site loads via a plain <script>, not modules — touching that
// risked the load). Instead, we READ the real source, isolate the `esc` expression and evaluate
// it in a sandbox — testing the code that runs in production without altering the site. If
// prettier reformats `esc`, this test fails loudly (on purpose).

// cwd = repo root when vitest runs (avoids import.meta, banned in the CommonJS output
// of tsconfig.test.json). The bundle changes name on each cache-bust (main-vN.js) — we find it.
const JS_DIR = join(process.cwd(), 'site', 'js');
const MAIN_JS = readdirSync(JS_DIR).find((f) => /^main-v\d+\.js$/.test(f));
if (!MAIN_JS) throw new Error('não encontrei site/js/main-v*.js (bundle principal do site)');
const SRC = readFileSync(join(JS_DIR, MAIN_JS), 'utf8');

function extractEsc(): (s: unknown) => string {
  // Captures `(s) => String(s).replace( ... \n    );` — from `(s) =>` to the `);` that closes the replace.
  const m = SRC.match(/const esc =\s*(\(s\)\s*=>[\s\S]*?\n\s*\)\s*);/);
  if (!m) throw new Error(`não encontrei a expressão do esc em ${MAIN_JS} (mudou o formato?)`);
  return eval('(' + m[1] + ')') as (s: unknown) => string;
}

describe('site esc() — anti-XSS escaping of the panel (real source)', () => {
  const esc = extractEsc();

  it('escapes the 5 dangerous characters', () => {
    expect(esc('&')).toBe('&amp;');
    expect(esc('<')).toBe('&lt;');
    expect(esc('>')).toBe('&gt;');
    expect(esc('"')).toBe('&quot;');
    expect(esc("'")).toBe('&#39;');
  });

  it('neutralizes a <script> payload', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('neutralizes an attribute break-out', () => {
    expect(esc('" onmouseover="alert(1)')).toBe('&quot; onmouseover=&quot;alert(1)');
  });

  it('leaves benign text intact', () => {
    expect(esc('Diogo #1234')).toBe('Diogo #1234');
    expect(esc('café ☕ 中文')).toBe('café ☕ 中文');
  });

  it('coerces non-strings via String() without blowing up', () => {
    expect(esc(42)).toBe('42');
    expect(esc(null)).toBe('null');
    expect(esc(undefined)).toBe('undefined');
  });
});
