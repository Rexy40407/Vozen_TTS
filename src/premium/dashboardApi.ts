// Core of the web dashboard for guild configuration.
// Discord is authoritative for identity and manageable guilds. Config and option lists are only
// returned after MANAGE_GUILD/ADMINISTRATOR and bot presence have both been confirmed.

import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { ChannelType, PermissionFlagsBits, type Guild } from 'discord.js';
import { LOCALE_DISPLAY_NAMES, SUPPORTED_LOCALES } from '../i18n/index';
import { voiceDisplayName } from '../language/voiceMap';
import { getGuildConfig, setGuildConfig, type GuildConfig } from '../store/guildConfig';
import {
  deleteChannelProfile,
  getChannelProfile,
  listChannelProfiles,
  saveChannelProfile,
  type ChannelProfile,
  type ChannelProfilePatch,
} from '../store/channelProfiles';
import type { UserEngine } from '../store/userVoice';
import { VOICE_EFFECTS } from '../tts/effects';

const BOOL_FIELDS = [
  'autoread',
  'xsaid',
  'autojoin',
  'readBots',
  'textInVoice',
  'antispam',
  'streakAnnounce',
  'soundboard',
  'greetOnJoin',
  'translationEnabled',
  'votePromos',
  'stayInCall',
] as const;

export const DASHBOARD_FIELDS = [
  ...BOOL_FIELDS,
  'maxChars',
  'ratePerMin',
  'locale',
  'ttsChannelId',
  'defaultVoice',
  'priorityRoleId',
  'blockedRoleId',
] as const;
type DashboardField = (typeof DASHBOARD_FIELDS)[number];

export type DashboardConfig = Pick<GuildConfig, DashboardField>;

export interface DashboardOption {
  id: string;
  label: string;
  unavailable?: boolean;
}

export interface DashboardGuildPayload {
  config: DashboardConfig;
  capabilities: {
    ttsChannelId: true;
    defaultVoice: true;
    channelProfiles: true;
  };
  options: {
    channels: DashboardOption[];
    voices: DashboardOption[];
    locales: DashboardOption[];
    voiceChannels: DashboardOption[];
    roles: DashboardOption[];
  };
  channelProfiles: ChannelProfile[];
}

export interface InvalidDashboardSetting {
  error: 'invalid_setting';
  field: 'ttsChannelId' | 'defaultVoice' | 'priorityRoleId' | 'blockedRoleId';
}

export type DashboardSaveResult = DashboardGuildPayload | InvalidDashboardSetting | null;

export interface InvalidChannelProfile {
  error: 'invalid_profile';
  field: keyof ChannelProfilePatch | 'channelId' | 'limit';
}

export type DashboardProfileSaveResult = DashboardGuildPayload | InvalidChannelProfile | null;

const MAX_CHARS_MIN = 1;
const MAX_CHARS_MAX = 2000;
const RATE_MIN = 1;
const RATE_MAX = 120;

const clampInt = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

export interface DashboardValidationOptions {
  channelIds: ReadonlySet<string>;
  voiceIds: ReadonlySet<string>;
  roleIds?: ReadonlySet<string>;
}

export interface ChannelProfileValidationOptions extends DashboardValidationOptions {
  voiceChannelIds: ReadonlySet<string>;
}

export type SanitizeChannelProfileResult =
  { ok: true; patch: Partial<ChannelProfilePatch> } | ({ ok: false } & InvalidChannelProfile);

const PROFILE_BOOL_FIELDS = ['autoRead', 'translationEnabled', 'readBots'] as const;
const PROFILE_ENGINES: readonly UserEngine[] = ['google', 'piper', 'kokoro', 'gcloud'];

export function sanitizeChannelProfile(
  input: unknown,
  options: ChannelProfileValidationOptions,
): SanitizeChannelProfileResult {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const patch: Partial<ChannelProfilePatch> = {};
  for (const field of PROFILE_BOOL_FIELDS) {
    if (field in src) {
      if (src[field] !== null && typeof src[field] !== 'boolean')
        return { ok: false, error: 'invalid_profile', field };
      patch[field] = src[field] as boolean | null;
    }
  }
  if ('defaultVoice' in src) {
    if (
      src.defaultVoice !== null &&
      (typeof src.defaultVoice !== 'string' || !options.voiceIds.has(src.defaultVoice))
    )
      return { ok: false, error: 'invalid_profile', field: 'defaultVoice' };
    patch.defaultVoice = src.defaultVoice as string | null;
  }
  if ('engine' in src) {
    if (
      src.engine !== null &&
      (typeof src.engine !== 'string' || !PROFILE_ENGINES.includes(src.engine as UserEngine))
    )
      return { ok: false, error: 'invalid_profile', field: 'engine' };
    patch.engine = src.engine as UserEngine | null;
  }
  if ('speed' in src) {
    if (
      src.speed !== null &&
      (typeof src.speed !== 'number' ||
        !Number.isFinite(src.speed) ||
        src.speed < 0.5 ||
        src.speed > 2)
    )
      return { ok: false, error: 'invalid_profile', field: 'speed' };
    patch.speed = src.speed as number | null;
  }
  if ('maxChars' in src) {
    if (
      src.maxChars !== null &&
      (typeof src.maxChars !== 'number' ||
        !Number.isInteger(src.maxChars) ||
        src.maxChars < MAX_CHARS_MIN ||
        src.maxChars > MAX_CHARS_MAX)
    )
      return { ok: false, error: 'invalid_profile', field: 'maxChars' };
    patch.maxChars = src.maxChars as number | null;
  }
  if ('voiceChannelId' in src) {
    if (
      src.voiceChannelId !== null &&
      (typeof src.voiceChannelId !== 'string' || !options.voiceChannelIds.has(src.voiceChannelId))
    )
      return { ok: false, error: 'invalid_profile', field: 'voiceChannelId' };
    patch.voiceChannelId = src.voiceChannelId as string | null;
  }
  if ('locale' in src) {
    if (
      src.locale !== null &&
      (typeof src.locale !== 'string' ||
        !(SUPPORTED_LOCALES as readonly string[]).includes(src.locale))
    )
      return { ok: false, error: 'invalid_profile', field: 'locale' };
    patch.locale = src.locale as string | null;
  }
  if ('effect' in src) {
    if (
      src.effect !== null &&
      (typeof src.effect !== 'string' || !(VOICE_EFFECTS as readonly string[]).includes(src.effect))
    )
      return { ok: false, error: 'invalid_profile', field: 'effect' };
    patch.effect = src.effect as string | null;
  }
  return { ok: true, patch };
}

export type SanitizePatchResult =
  { ok: true; patch: Partial<DashboardConfig> } | ({ ok: false } & InvalidDashboardSetting);

/**
 * Converts a raw client body to the dashboard whitelist and validates server-generated choices.
 * Unknown keys are discarded. A missing channel always wins over an attempted Auto-read=true so
 * the database cannot contain that impossible state.
 */
export function sanitizePatch(
  input: unknown,
  options: DashboardValidationOptions,
  current: Pick<DashboardConfig, 'ttsChannelId' | 'autoread'>,
): SanitizePatchResult {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const patch: Partial<DashboardConfig> = {};

  for (const field of BOOL_FIELDS) {
    if (field in src) patch[field] = Boolean(src[field]);
  }
  if (typeof src.maxChars === 'number' && Number.isFinite(src.maxChars)) {
    patch.maxChars = clampInt(src.maxChars, MAX_CHARS_MIN, MAX_CHARS_MAX);
  }
  if (typeof src.ratePerMin === 'number' && Number.isFinite(src.ratePerMin)) {
    patch.ratePerMin = clampInt(src.ratePerMin, RATE_MIN, RATE_MAX);
  }
  if (
    typeof src.locale === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(src.locale)
  ) {
    patch.locale = src.locale;
  }

  if ('ttsChannelId' in src) {
    if (
      src.ttsChannelId !== null &&
      (typeof src.ttsChannelId !== 'string' || !options.channelIds.has(src.ttsChannelId))
    ) {
      return { ok: false, error: 'invalid_setting', field: 'ttsChannelId' };
    }
    patch.ttsChannelId = src.ttsChannelId as string | null;
  }

  if ('defaultVoice' in src) {
    if (
      typeof src.defaultVoice !== 'string' ||
      (src.defaultVoice !== '' && !options.voiceIds.has(src.defaultVoice))
    ) {
      return { ok: false, error: 'invalid_setting', field: 'defaultVoice' };
    }
    patch.defaultVoice = src.defaultVoice;
  }

  const roleIds = options.roleIds ?? new Set<string>();
  for (const field of ['priorityRoleId', 'blockedRoleId'] as const) {
    if (!(field in src)) continue;
    if (src[field] !== null && (typeof src[field] !== 'string' || !roleIds.has(src[field]))) {
      return { ok: false, error: 'invalid_setting', field };
    }
    patch[field] = src[field] as string | null;
  }
  const currentRoles = current as typeof current & {
    priorityRoleId?: string | null;
    blockedRoleId?: string | null;
  };
  const priority =
    patch.priorityRoleId !== undefined ? patch.priorityRoleId : currentRoles.priorityRoleId;
  const blocked =
    patch.blockedRoleId !== undefined ? patch.blockedRoleId : currentRoles.blockedRoleId;
  if (priority && priority === blocked) {
    return { ok: false, error: 'invalid_setting', field: 'blockedRoleId' };
  }

  const effectiveChannel =
    patch.ttsChannelId !== undefined ? patch.ttsChannelId : current.ttsChannelId;
  if ('ttsChannelId' in src && src.ttsChannelId !== null && !('autoread' in src)) {
    patch.autoread = true;
  }
  if (effectiveChannel === null && ('autoread' in src || 'ttsChannelId' in src)) {
    patch.autoread = false;
  }

  return { ok: true, patch };
}

export interface ManageableGuild {
  id: string;
  name: string;
  icon: string | null;
}

/** Returns only ordinary text channels where the bot can read and respond. */
export function listAuthorizedTextChannels(guild: Guild): DashboardOption[] {
  const botMember = guild.members.me;
  if (!botMember) return [];
  return [...guild.channels.cache.values()]
    .filter((channel) => channel.type === ChannelType.GuildText)
    .filter((channel) =>
      channel
        .permissionsFor(botMember)
        ?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ]),
    )
    .sort(
      (left, right) => left.rawPosition - right.rawPosition || left.name.localeCompare(right.name),
    )
    .map((channel) => ({ id: channel.id, label: `#${channel.name}` }));
}

export interface DashboardApiDeps {
  db: Database.Database;
  now: () => number;
  /** Discord application that is allowed to mint dashboard tokens. */
  expectedClientId: string;
  fetchImpl: typeof fetch;
  botHasGuild: (guildId: string) => boolean;
  resolveChannels: (guildId: string) => DashboardOption[];
  resolveVoiceChannels?: (guildId: string) => DashboardOption[];
  resolveRoles?: (guildId: string) => DashboardOption[];
  availableModels: readonly string[];
  guildsTtlMs?: number;
  cacheMaxEntries?: number;
  logError?: (message: string, error: unknown) => void;
}

export interface DashboardApi {
  listGuilds(token: string): Promise<ManageableGuild[] | null>;
  getGuild(token: string, guildId: string): Promise<DashboardGuildPayload | null>;
  saveConfig(token: string, guildId: string, patch: unknown): Promise<DashboardSaveResult>;
  saveChannelProfile(
    token: string,
    guildId: string,
    channelId: string,
    patch: unknown,
  ): Promise<DashboardProfileSaveResult>;
  deleteChannelProfile(token: string, guildId: string, channelId: string): Promise<boolean | null>;
}

const DISCORD_GUILDS = 'https://discord.com/api/v10/users/@me/guilds';
const DISCORD_OAUTH_ME = 'https://discord.com/api/v10/oauth2/@me';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
const FETCH_TIMEOUT_MS = 5_000;

function projectConfig(config: GuildConfig): DashboardConfig {
  const out = {} as DashboardConfig;
  for (const field of DASHBOARD_FIELDS) {
    (out as Record<string, unknown>)[field] = config[field];
  }
  return out;
}

function canManage(permissions: unknown, owner: unknown): boolean {
  if (owner === true) return true;
  if (typeof permissions !== 'string' && typeof permissions !== 'number') return false;
  try {
    const bits = BigInt(permissions);
    return (bits & MANAGE_GUILD) !== 0n || (bits & ADMINISTRATOR) !== 0n;
  } catch {
    return false;
  }
}

export function createDashboardApi(deps: DashboardApiDeps): DashboardApi {
  const ttl = deps.guildsTtlMs ?? 60_000;
  const maxEntries = Math.max(1, Math.floor(deps.cacheMaxEntries ?? 512));
  const cache = new Map<string, { guilds: ManageableGuild[] | null; exp: number }>();

  const tokenCacheKey = (token: string): string =>
    createHash('sha256').update(token).digest('base64url');

  function prune(now: number): void {
    for (const [key, value] of cache) if (value.exp <= now) cache.delete(key);
    while (cache.size >= maxEntries) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }

  async function fetchManageable(token: string): Promise<ManageableGuild[] | null> {
    const now = deps.now();
    const cacheKey = tokenCacheKey(token);
    const hit = cache.get(cacheKey);
    if (hit && hit.exp > now) return hit.guilds;
    if (hit) cache.delete(cacheKey);
    prune(now);

    let guilds: ManageableGuild[] | null = null;
    try {
      const oauthController = new AbortController();
      const oauthTimer = setTimeout(() => oauthController.abort(), FETCH_TIMEOUT_MS);
      let oauth: Response;
      try {
        oauth = await deps.fetchImpl(DISCORD_OAUTH_ME, {
          headers: { Authorization: `Bearer ${token}` },
          signal: oauthController.signal,
        });
      } finally {
        clearTimeout(oauthTimer);
      }
      if (oauth.ok) {
        const authorization = (await oauth.json()) as {
          application?: { id?: unknown };
          scopes?: unknown;
        };
        const scopes = Array.isArray(authorization.scopes)
          ? authorization.scopes.filter((scope): scope is string => typeof scope === 'string')
          : [];
        const isAuthorizedToken =
          authorization.application?.id === deps.expectedClientId &&
          scopes.includes('identify') &&
          scopes.includes('guilds');
        if (isAuthorizedToken) {
          const guildController = new AbortController();
          const guildTimer = setTimeout(() => guildController.abort(), FETCH_TIMEOUT_MS);
          let response: Response;
          try {
            response = await deps.fetchImpl(DISCORD_GUILDS, {
              headers: { Authorization: `Bearer ${token}` },
              signal: guildController.signal,
            });
          } finally {
            clearTimeout(guildTimer);
          }
          if (response.ok) {
            const raw = (await response.json()) as unknown;
            guilds = (Array.isArray(raw) ? raw : [])
              .filter(
                (guild): guild is Record<string, unknown> => !!guild && typeof guild === 'object',
              )
              .filter((guild) => typeof guild.id === 'string' && deps.botHasGuild(guild.id))
              .filter((guild) => canManage(guild.permissions, guild.owner))
              .map((guild) => ({
                id: guild.id as string,
                name: typeof guild.name === 'string' ? guild.name : (guild.id as string),
                icon: typeof guild.icon === 'string' ? guild.icon : null,
              }));
          }
        }
      }
    } catch (error) {
      // Fetch error messages can include request headers. Keep bearer tokens out of logs.
      deps.logError?.(
        '[dashboard] failed to list Discord guilds',
        error instanceof Error ? error.name : 'fetch_error',
      );
    }
    prune(now);
    cache.set(cacheKey, { guilds, exp: now + ttl });
    return guilds;
  }

  async function authorize(token: string, guildId: string): Promise<boolean> {
    const guilds = await fetchManageable(token);
    // Recheck live bot presence even when the user's manageable-guild list came from the TTL cache.
    return (
      guilds !== null && deps.botHasGuild(guildId) && guilds.some((guild) => guild.id === guildId)
    );
  }

  function availableOptions(guildId: string): DashboardGuildPayload['options'] {
    let channels: DashboardOption[] = [];
    try {
      channels = deps.resolveChannels(guildId);
    } catch (error) {
      deps.logError?.('[dashboard] failed to resolve guild channels', error);
    }
    const voices = [...new Set(deps.availableModels)].map((id) => ({
      id,
      label: voiceDisplayName(id),
    }));
    const locales = SUPPORTED_LOCALES.map((id) => ({ id, label: LOCALE_DISPLAY_NAMES[id] }));
    let voiceChannels: DashboardOption[] = [];
    let roles: DashboardOption[] = [];
    try {
      voiceChannels = deps.resolveVoiceChannels?.(guildId) ?? [];
    } catch (error) {
      deps.logError?.('[dashboard] failed to resolve guild voice channels', error);
    }
    try {
      roles = deps.resolveRoles?.(guildId) ?? [];
    } catch (error) {
      deps.logError?.('[dashboard] failed to resolve guild roles', error);
    }
    return { channels, voices, locales, voiceChannels, roles };
  }

  function buildPayload(guildId: string): DashboardGuildPayload {
    const config = projectConfig(getGuildConfig(deps.db, guildId));
    const options = availableOptions(guildId);
    if (
      config.ttsChannelId &&
      !options.channels.some((option) => option.id === config.ttsChannelId)
    ) {
      options.channels.unshift({
        id: config.ttsChannelId,
        label: config.ttsChannelId,
        unavailable: true,
      });
    }
    if (
      config.defaultVoice &&
      !options.voices.some((option) => option.id === config.defaultVoice)
    ) {
      options.voices.unshift({
        id: config.defaultVoice,
        label: config.defaultVoice,
        unavailable: true,
      });
    }
    return {
      config,
      capabilities: { ttsChannelId: true, defaultVoice: true, channelProfiles: true },
      options,
      channelProfiles: listChannelProfiles(deps.db, guildId),
    };
  }

  return {
    listGuilds: (token) => fetchManageable(token),

    async getGuild(token, guildId) {
      if (!(await authorize(token, guildId))) return null;
      return buildPayload(guildId);
    },

    async saveConfig(token, guildId, input) {
      if (!(await authorize(token, guildId))) return null;
      const current = getGuildConfig(deps.db, guildId);
      const options = availableOptions(guildId);
      const clean = sanitizePatch(
        input,
        {
          channelIds: new Set(options.channels.map((option) => option.id)),
          voiceIds: new Set(options.voices.map((option) => option.id)),
          roleIds: new Set(options.roles.map((option) => option.id)),
        },
        current,
      );
      if (!clean.ok) return { error: clean.error, field: clean.field };
      setGuildConfig(deps.db, guildId, clean.patch);
      return buildPayload(guildId);
    },

    async saveChannelProfile(token, guildId, channelId, input) {
      if (!(await authorize(token, guildId))) return null;
      const options = availableOptions(guildId);
      if (!options.channels.some((channel) => channel.id === channelId)) {
        return { error: 'invalid_profile', field: 'channelId' };
      }
      const clean = sanitizeChannelProfile(input, {
        channelIds: new Set(options.channels.map((option) => option.id)),
        voiceIds: new Set(options.voices.map((option) => option.id)),
        voiceChannelIds: new Set(options.voiceChannels.map((option) => option.id)),
      });
      if (!clean.ok) return { error: clean.error, field: clean.field };
      const current = getChannelProfile(deps.db, guildId, channelId);
      const empty: ChannelProfilePatch = {
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
      };
      if (
        !saveChannelProfile(deps.db, guildId, channelId, { ...empty, ...current, ...clean.patch })
      ) {
        return { error: 'invalid_profile', field: 'limit' };
      }
      return buildPayload(guildId);
    },

    async deleteChannelProfile(token, guildId, channelId) {
      if (!(await authorize(token, guildId))) return null;
      deleteChannelProfile(deps.db, guildId, channelId);
      return true;
    },
  };
}

/** Returns voice/stage channels where the bot can connect and speak. */
export function listAuthorizedVoiceChannels(guild: Guild): DashboardOption[] {
  const botMember = guild.members.me;
  if (!botMember) return [];
  return [...guild.channels.cache.values()]
    .filter(
      (channel) =>
        channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice,
    )
    .filter((channel) =>
      channel
        .permissionsFor(botMember)
        ?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ]),
    )
    .sort(
      (left, right) => left.rawPosition - right.rawPosition || left.name.localeCompare(right.name),
    )
    .map((channel) => ({ id: channel.id, label: channel.name }));
}

/** Managed integration roles and @everyone are not useful queue-policy choices. */
export function listConfigurableRoles(guild: Guild): DashboardOption[] {
  return [...guild.roles.cache.values()]
    .filter((role) => role.id !== guild.id && !role.managed)
    .sort((left, right) => right.position - left.position || left.name.localeCompare(right.name))
    .map((role) => ({ id: role.id, label: role.name }));
}
