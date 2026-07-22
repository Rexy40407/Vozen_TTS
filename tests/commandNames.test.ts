import { describe, expect, it } from 'vitest';
import { commandDefs, ownerCommandDefs } from '../src/commands/definitions';

type CommandNode = { name: string; options?: CommandNode[] };

function collectNames(nodes: CommandNode[]): string[] {
  return nodes.flatMap((node) => [node.name, ...collectNames(node.options ?? [])]);
}

describe('Discord command names', () => {
  const names = collectNames([...commandDefs, ...ownerCommandDefs] as CommandNode[]);

  it('uses hyphens for every exposed multi-word command, subcommand and option', () => {
    expect(names).toEqual(
      expect.arrayContaining([
        'shut-up',
        '8-ball',
        'top-speakers',
        'server-stats',
        'bot-stats',
        'server-pronunciation',
        'vozen-grant',
        'generate-code',
        'auto-read',
        'x-said',
        'auto-join',
        'anti-spam',
        'block-word',
        'opt-in',
        'opt-out',
        'expires-days',
      ]),
    );
  });

  it('does not reintroduce the legacy glued names', () => {
    for (const legacyName of [
      'shutup',
      '8ball',
      'topspeakers',
      'serverstats',
      'botstats',
      'serverpronunciation',
      'vozengrant',
      'gencode',
      'autoread',
      'xsaid',
      'autojoin',
      'antispam',
      'blockword',
      'optin',
      'optout',
      'expires_days',
    ]) {
      expect(names).not.toContain(legacyName);
    }
  });
});
