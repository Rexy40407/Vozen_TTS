import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  runRustStagingPreflight,
  RustStagingPreflightError,
} from '../tools/rust-staging-preflight';

const contract = JSON.parse(
  readFileSync(resolve(process.cwd(), 'contracts/discord-commands.json'), 'utf8'),
) as {
  public_commands: Array<{ name: string }>;
  owner_commands: Array<{ name: string }>;
};

const env = {
  DISCORD_TOKEN: 'staging-token-that-must-never-be-printed',
  CLIENT_ID: '123456789012345678',
  RUST_COMMANDS_GUILD_ID: '234567890123456789',
  OWNER_GUILD_ID: '234567890123456789',
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function happyFetch() {
  return vi.fn(async (input: unknown, _init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/users/@me')) return response({ id: env.CLIENT_ID });
    if (url.endsWith(`/guilds/${env.RUST_COMMANDS_GUILD_ID}`)) {
      return response({ id: env.RUST_COMMANDS_GUILD_ID });
    }
    if (url.includes('/guilds/') && url.endsWith('/commands')) {
      return response([...contract.public_commands, ...contract.owner_commands]);
    }
    if (url.endsWith('/commands')) return response([]);
    throw new Error(`unexpected URL: ${url}`);
  });
}

describe('Rust staging preflight', () => {
  it('performs only read requests and verifies the staging contract', async () => {
    const fetchImpl = happyFetch();
    const report = await runRustStagingPreflight({
      env,
      fetchImpl,
      apiBaseUrl: 'https://discord.test/api/v10',
    });

    expect(report).toEqual({
      ok: true,
      botUserMatchesApplication: true,
      guildReachable: true,
      guildCommandCount: 42,
      expectedGuildCommandCount: 42,
      globalCommandCount: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    for (const call of fetchImpl.mock.calls) {
      const input = call[0];
      const init = call[1] as RequestInit | undefined;
      expect(String(input)).toMatch(/^https:\/\/discord\.test\/api\/v10\//);
      expect(init?.method).toBe('GET');
      expect(init?.headers).toMatchObject({
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
        Accept: 'application/json',
      });
    }
  });

  it('fails before network access when required configuration is missing or invalid', async () => {
    const fetchImpl = vi.fn();
    await expect(
      runRustStagingPreflight({
        env: { ...env, DISCORD_TOKEN: '', CLIENT_ID: 'not-an-id' },
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: 'invalid_config' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed when the bot identity does not match the application', async () => {
    const fetchImpl = vi.fn(async () => response({ id: '999999999999999999' }));
    await expect(runRustStagingPreflight({ env, fetchImpl })).rejects.toMatchObject({
      code: 'application_mismatch',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not leak a Discord response body or token on REST failure', async () => {
    const secretBody = `do-not-leak-${env.DISCORD_TOKEN}`;
    const fetchImpl = vi.fn(async () => response({ message: secretBody }, 403));
    const error = await runRustStagingPreflight({ env, fetchImpl }).catch(
      (value: unknown) => value,
    );
    expect(error).toBeInstanceOf(RustStagingPreflightError);
    expect(String(error)).not.toContain(secretBody);
    expect(String(error)).not.toContain(env.DISCORD_TOKEN);
  });

  it('detects command drift without attempting to repair it', async () => {
    const fetchImpl = happyFetch();
    fetchImpl.mockImplementationOnce(async () => response({ id: env.CLIENT_ID }));
    fetchImpl.mockImplementationOnce(async () => response({ id: env.RUST_COMMANDS_GUILD_ID }));
    fetchImpl.mockImplementationOnce(async () => response([{ name: 'unexpected-command' }]));

    await expect(
      runRustStagingPreflight({ env, fetchImpl, apiBaseUrl: 'https://discord.test/api/v10' }),
    ).rejects.toMatchObject({ code: 'guild_command_mismatch' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(
      fetchImpl.mock.calls.every((call) => (call[1] as RequestInit | undefined)?.method === 'GET'),
    ).toBe(true);
  });
});
