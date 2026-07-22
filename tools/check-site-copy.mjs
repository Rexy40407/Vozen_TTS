import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'parse5';

const root = process.cwd();
const htmlPath = resolve(root, 'site/index.html');
const messagesPath = resolve(root, 'tools/i18n-src/en.json');
const html = readFileSync(htmlPath, 'utf8');
const messages = JSON.parse(readFileSync(messagesPath, 'utf8')).ui;
const document = parse(html, { sourceCodeLocationInfo: true });

const normalize = (value) => value.replace(/\s+/g, ' ').trim();

const textContent = (node) => {
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(textContent).join('');
};

const attribute = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value;
const failures = [];
let checked = 0;

const walk = (node) => {
  const key = attribute(node, 'data-i18n');
  if (key) {
    checked += 1;
    const line = node.sourceCodeLocation?.startLine ?? '?';
    const expected = messages[key];
    const actual = normalize(textContent(node));

    if (typeof expected !== 'string') {
      failures.push(`site/index.html:${line} data-i18n="${key}" has no canonical English string`);
    } else if (actual !== normalize(expected)) {
      failures.push(
        `site/index.html:${line} data-i18n="${key}"\n` +
          `  expected: ${normalize(expected)}\n` +
          `  received: ${actual}`,
      );
    }
  }

  for (const child of node.childNodes ?? []) walk(child);
};

walk(document);

if (failures.length > 0) {
  console.error(`English HTML fallback differs from tools/i18n-src/en.json (${failures.length}):`);
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`English HTML fallback matches ${checked} canonical data-i18n strings.`);
}
