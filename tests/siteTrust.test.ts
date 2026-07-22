import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'parse5';
import { describe, expect, it } from 'vitest';
import { INVITE_PERMISSIONS } from '../src/commands/helpers';
import { GUILD_PURGE_TABLES, USER_ERASE_TABLES } from '../src/store/dataLifecycle';

const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), { encoding: 'utf8' });

const CLIENT_ID = '1523826014935842997';
const CANONICAL_PERMISSIONS = '326420745216';
const CANONICAL_INVITE =
  `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}` +
  `&permissions=${CANONICAL_PERMISSIONS}&scope=bot%20applications.commands`;
const SUPPORT_URL = 'https://discord.gg/4kYw2WUbNN';

const normalizedDiscordInvites = (content: string): string[] =>
  [...content.matchAll(/https:\/\/discord\.com\/oauth2\/authorize\?[^"')\s]+/g)].map((match) =>
    match[0].replaceAll('&amp;', '&'),
  );

const supportUrls = (content: string): string[] =>
  [...content.matchAll(/https:\/\/discord\.gg\/[A-Za-z0-9]+/g)].map((match) => match[0]);

type HtmlNode = {
  nodeName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

const htmlAttribute = (node: HtmlNode, name: string): string | undefined =>
  node.attrs?.find((entry) => entry.name === name)?.value;

const htmlNodes = (html: string, predicate: (node: HtmlNode) => boolean): HtmlNode[] => {
  const matches: HtmlNode[] = [];
  const visit = (node: HtmlNode): void => {
    if (predicate(node)) matches.push(node);
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parse(html) as unknown as HtmlNode);
  return matches;
};

describe('site acquisition and trust contracts', () => {
  it('keeps the bot, runtime, HTML fallbacks, and README on one invite bitfield', () => {
    expect(INVITE_PERMISSIONS).toBe(CANONICAL_PERMISSIONS);

    const runtime = source('site/js/main-v43.js');
    expect(runtime).toContain(`const INVITE_PERMISSIONS = "${CANONICAL_PERMISSIONS}";`);
    expect(runtime).toContain(
      '`https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${INVITE_PERMISSIONS}&scope=bot%20applications.commands`',
    );

    for (const path of ['README.md', 'site/index.html']) {
      const invites = normalizedDiscordInvites(source(path));
      expect(invites.length, path).toBeGreaterThan(0);
      expect(new Set(invites), path).toEqual(new Set([CANONICAL_INVITE]));
    }

    const inviteLinks = htmlNodes(source('site/index.html'), (node) =>
      (htmlAttribute(node, 'class') ?? '').split(/\s+/).includes('js-invite'),
    );
    expect(inviteLinks).toHaveLength(3);
    for (const link of inviteLinks) {
      expect(htmlAttribute(link, 'href')).toBe(CANONICAL_INVITE);
      expect(htmlAttribute(link, 'class')?.split(/\s+/)).toContain('btn--discord-cta');
    }
  });

  it('uses the official support server everywhere public', () => {
    for (const path of [
      'README.md',
      'PRIVACY.md',
      'site/index.html',
      'site/privacy.html',
      'site/terms.html',
      'site/js/main-v43.js',
    ]) {
      const urls = supportUrls(source(path));
      expect(urls.length, path).toBeGreaterThan(0);
      expect(new Set(urls), path).toEqual(new Set([SUPPORT_URL]));
    }
  });

  it('discloses aggregate talk usage and distinguishes erasure from legal retention', () => {
    for (const path of ['PRIVACY.md', 'site/privacy.html']) {
      const policy = source(path);
      expect(policy, path).toContain('talk_usage');
      expect(policy, path).toMatch(/aggregate/i);
      expect(policy, path).toMatch(/language/i);
      expect(policy, path).toMatch(/engine/i);
      expect(policy, path).toMatch(/operator[^.]{0,80}console/i);
      expect(policy, path).toMatch(/financial|accounting|legal obligation/i);
      expect(policy, path).not.toMatch(/deletes everything/i);
    }

    expect(USER_ERASE_TABLES).toContain('talk_usage');
    expect(GUILD_PURGE_TABLES).toContain('talk_usage');
  });

  it('keeps search and social fallbacks on the current product facts', () => {
    const homepage = source('site/index.html');
    expect(homepage).toContain('Discord TTS Bot — 35 Languages, 38 Voices | Vozen');
    expect(homepage).toContain('38 neural voices in 35 languages and 16 minigames');
    expect(homepage).toContain('Core free forever; Premium adds optional extras.');
    expect(homepage).toContain('data-to="16"');
    expect(homepage).toContain('38 Piper voices in 35 languages');
    expect(homepage).toContain('Kokoro and Google HD are Premium voice engines');
    expect(homepage).toContain('data-i18n="price.m.21"');
    expect(homepage).toMatch(
      /data-i18n="price\.m\.21"[^>]*>Kokoro neural engine<\/th><td[^>]*class="has-not">—<\/td><td[^>]*class="has">✓<\/td><td[^>]*class="has">✓<\/td>/,
    );
  });

  it('documents /cast publicly without exposing bot-only theme names', () => {
    const siteFiles = [
      'site/index.html',
      'site/js/i18n-v40.js',
      ...['en', 'pt', 'fr', 'es', 'de', 'tr', 'ar', 'zh', 'ru', 'ko'].map(
        (lang) => `tools/i18n-src/${lang}.json`,
      ),
    ];
    for (const path of siteFiles) {
      const content = source(path);
      expect(content, path).toContain('/cast');
      expect(content.toLowerCase(), path).not.toMatch(/pok[eé]mon/);
    }
  });

  it('runs the parser-based English fallback verifier before building the site', () => {
    const pkg = JSON.parse(source('package.json')) as { scripts?: Record<string, string> };

    expect(pkg.scripts?.['check:site-copy']).toBe('node tools/check-site-copy.mjs');
    expect(pkg.scripts?.['check:site']).toContain('npm run check:site-copy');
    expect(source('tools/check-site-copy.mjs')).toContain("from 'parse5'");
  });

  it('ships a privacy-safe public status page backed by the versioned API', () => {
    const page = source('site/status.html');
    const script = source('site/js/status-v1.js');

    expect(page).toContain('Vozen service status');
    expect(page).toContain('js/status-v1.js');
    expect(script).toContain('https://api.vozen.org/api/public/status');
    expect(script).toContain('textContent');
    expect(script).not.toContain('innerHTML');
    expect(script).not.toMatch(/guild|user|message|token|secret/i);
  });
});
