import { describe, expect, it } from 'vitest';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import { admitUserSpeech } from '../src/voice/admission';

const GUILD = 'guild';
const USER = 'user';

function deps(db: ReturnType<typeof initDb>): any {
  return { db };
}

function guild(callerChannel: string | null, botChannel: string | null, roles: string[] = []): any {
  return {
    members: {
      me: { voice: { channelId: botChannel } },
      cache: new Map([[USER, { roles: { cache: new Map(roles.map((role) => [role, {}])) } }]]),
    },
  };
}

describe('user-originated speech admission', () => {
  it.each([
    ['tts', 'vc', 'vc', [], true, 'standard'],
    ['preview', 'vc', 'other', [], false, 'not-in-same-voice'],
    ['fun', null, 'vc', [], false, 'not-in-same-voice'],
    ['cast', 'vc', 'vc', ['blocked', 'priority'], false, 'blocked'],
    ['context', 'vc', 'vc', ['priority'], true, 'accessibility'],
  ])(
    '%s follows the shared same-call and blocked-wins policy',
    (_family, caller, bot, roles, ok, value) => {
      const db = initDb(':memory:');
      try {
        setGuildConfig(db, GUILD, { priorityRoleId: 'priority', blockedRoleId: 'blocked' });
        const result = admitUserSpeech(deps(db), GUILD, USER, guild(caller, bot, roles), caller);
        if (ok) expect(result).toEqual({ allowed: true, lane: value });
        else expect(result).toEqual({ allowed: false, reason: value });
      } finally {
        db.close();
      }
    },
  );
});
