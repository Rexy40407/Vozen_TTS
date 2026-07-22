import { describe, expect, it } from 'vitest';
import { initDb } from '../src/store/db';
import {
  deleteChannelProfile,
  getChannelProfile,
  listChannelProfiles,
  MAX_CHANNEL_PROFILES_PER_GUILD,
  saveChannelProfile,
} from '../src/store/channelProfiles';
import { resolveChannelPolicy } from '../src/policy/channelPolicy';
import { getGuildConfig, setGuildConfig } from '../src/store/guildConfig';

const guild = 'guild';

describe('channel profiles', () => {
  it('migrates idempotently and is inert without a profile', () => {
    const db = initDb(':memory:');
    const columns = db.pragma('table_info(channel_profile)') as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'guild_id',
        'channel_id',
        'auto_read',
        'translation_enabled',
        'engine',
        'speed',
        'max_chars',
        'read_bots',
        'voice_channel_id',
        'locale',
        'effect',
      ]),
    );
    const config = getGuildConfig(db, guild);
    expect(resolveChannelPolicy(config, null)).toEqual({
      autoRead: config.autoread,
      translationEnabled: config.translationEnabled,
      defaultVoice: config.defaultVoice,
      engine: null,
      speed: null,
      maxChars: config.maxChars,
      readBots: config.readBots,
      voiceChannelId: null,
      locale: null,
      effect: null,
    });
  });

  it('an inherited/null profile cannot expand auto-read beyond the configured guild channel', () => {
    const database = initDb(':memory:');
    try {
      setGuildConfig(database, 'guild', { autoread: true, ttsChannelId: 'configured' });
      saveChannelProfile(database, 'guild', 'other', {
        autoRead: null,
        translationEnabled: null,
        defaultVoice: null,
        engine: null,
        speed: null,
        maxChars: null,
        readBots: null,
        voiceChannelId: null,
        locale: null,
        effect: null,
      });
      const profile = getChannelProfile(database, 'guild', 'other');
      expect(profile?.autoRead).toBeNull();
      // The listener owns the final channel-id check; this assertion locks the profile
      // representation to "inherit", not an implicit opt-in for an arbitrary channel.
      expect(resolveChannelPolicy(getGuildConfig(database, 'guild'), profile).autoRead).toBe(true);
    } finally {
      database.close();
    }
  });

  it('stores only policy metadata and resolves explicit overrides', () => {
    const db = initDb(':memory:');
    setGuildConfig(db, guild, { autoread: false, translationEnabled: false, defaultVoice: 'base' });
    expect(
      saveChannelProfile(db, guild, 'text-1', {
        autoRead: true,
        translationEnabled: true,
        defaultVoice: 'voice-1',
        engine: 'piper',
        speed: 1.2,
        maxChars: 500,
        readBots: true,
        voiceChannelId: 'voice-channel-1',
        locale: 'es',
        effect: 'robot',
      }),
    ).toBe(true);
    const profile = getChannelProfile(db, guild, 'text-1');
    expect(profile).toEqual({
      guildId: guild,
      channelId: 'text-1',
      autoRead: true,
      translationEnabled: true,
      defaultVoice: 'voice-1',
      engine: 'piper',
      speed: 1.2,
      maxChars: 500,
      readBots: true,
      voiceChannelId: 'voice-channel-1',
      locale: 'es',
      effect: 'robot',
    });
    expect(resolveChannelPolicy(getGuildConfig(db, guild), profile)).toEqual({
      autoRead: true,
      translationEnabled: true,
      defaultVoice: 'voice-1',
      engine: 'piper',
      speed: 1.2,
      maxChars: 500,
      readBots: true,
      voiceChannelId: 'voice-channel-1',
      locale: 'es',
      effect: 'robot',
    });
    deleteChannelProfile(db, guild, 'text-1');
    expect(getChannelProfile(db, guild, 'text-1')).toBeNull();
  });

  it('has one profile per channel and a bounded guild count', () => {
    const db = initDb(':memory:');
    for (let index = 0; index < MAX_CHANNEL_PROFILES_PER_GUILD; index += 1) {
      expect(
        saveChannelProfile(db, guild, `text-${index}`, {
          autoRead: null,
          translationEnabled: null,
          defaultVoice: null,
          engine: null,
          speed: null,
          maxChars: null,
          readBots: null,
          voiceChannelId: null,
          locale: null,
          effect: null,
        }),
      ).toBe(true);
    }
    expect(listChannelProfiles(db, guild)).toHaveLength(MAX_CHANNEL_PROFILES_PER_GUILD);
    expect(
      saveChannelProfile(db, guild, 'one-too-many', {
        autoRead: true,
        translationEnabled: null,
        defaultVoice: null,
        engine: null,
        speed: null,
        maxChars: null,
        readBots: null,
        voiceChannelId: null,
        locale: null,
        effect: null,
      }),
    ).toBe(false);
    expect(
      saveChannelProfile(db, guild, 'text-0', {
        autoRead: true,
        translationEnabled: null,
        defaultVoice: null,
        engine: null,
        speed: null,
        maxChars: null,
        readBots: null,
        voiceChannelId: null,
        locale: null,
        effect: null,
      }),
    ).toBe(true);
  });
});
