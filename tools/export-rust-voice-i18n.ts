import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format } from 'prettier';
import { catalog } from '../src/i18n/catalog';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../src/i18n/index';
import { locales } from '../src/i18n/locales';

const target = path.resolve('contracts/voice-response-i18n.json');
const check = process.argv.includes('--check');

// These are the only current Rust-promoted voice responses.  Keeping the list here makes adding
// a new semantic Rust outcome a deliberate review of the existing Node public copy.
const KEYS = [
  'error.generic',
  'error.needManageGuild',
  'join.needVoiceChannel',
  'join.missingPerms',
  'join.joined',
  'join.joinedAutoread',
  'leave.left',
  'skip.notInVoice',
  'skip.nothing',
  'skip.skipped',
  'shutup.notInVoice',
  'shutup.nothing',
  'shutup.done',
  'tts.notInVoice',
  'tts.nothingToRead',
  'tts.nothingAfterClean',
  'tts.tooFast',
  'tts.blocked',
  'tts.queued',
  'tts.busy',
  'ttsFile.tooLong',
  'ttsFile.unavailable',
  'ttsFile.ready',
  'ttsFile.failed',
  'voice.unknownModel',
  'voice.badSpeed',
  'voice.set',
  'voice.engine.gcloudLocked',
  'voice.engine.kokoroLocked',
  'voice.reset',
  'voice.detection.on',
  'voice.detection.off',
  'voice.optout',
  'voice.optin',
  'voice.nickname.set',
  'voice.nickname.cleared',
  'voice.nickname.invalid',
  'voice.effect.set',
  'voice.effect.cleared',
  'voice.effect.locked',
  'translation.ready',
  'translation.invalidLocale',
  'translation.quota',
  'translation.disabled',
  'translation.empty',
  'translation.unavailable',
  'translation.guildOnly',
  'translation.invalidSpeakLocale',
  'translation.defaultSaved',
  'translation.speakOff',
  'translation.speakOn',
  'translation.optedOut',
  'translation.optedIn',
  'pron.listHeader',
  'pron.listEmpty',
  'pron.set',
  'pron.removed',
  'pron.notFound',
  'pron.empty',
  'pron.limitHit',
  'pron.limitUpsell',
  'spron.listHeader',
  'spron.listEmpty',
  'spron.set',
  'spron.removed',
  'spron.notFound',
  'spron.limitHit',
  'config.language.set',
  'config.language.unsupported',
  'config.autoreadOn',
  'config.autoreadOff',
  'config.enabledOn',
  'config.enabledOff',
  'config.xsaidOn',
  'config.xsaidOff',
  'config.autojoinOn',
  'config.autojoinOff',
  'config.stayOn',
  'config.stayOff',
  'config.readBotsOn',
  'config.readBotsOff',
  'config.textInVoiceOn',
  'config.textInVoiceOff',
  'config.antispamOn',
  'config.antispamOff',
  'config.streaksOn',
  'config.streaksOff',
  'config.soundboardOn',
  'config.soundboardOff',
  'config.votePromosLabel',
  'config.greetOn',
  'config.greetOff',
  'config.on',
  'config.off',
  'config.maxCharsRange',
  'config.maxCharsSet',
  'config.rateLimitRange',
  'config.rateLimitSet',
  'config.roleSet',
  'config.roleCleared',
  'config.showTitle',
  'config.showChannel',
  'config.showAutoread',
  'config.showRole',
  'config.showPriorityRole',
  'config.showBlockedRole',
  'config.showEnabled',
  'config.showXsaid',
  'config.showAutojoin',
  'config.showReadBots',
  'config.showTextInVoice',
  'config.showAntispam',
  'config.showSoundboard',
  'config.showGreet',
  'config.showVoice',
  'config.showMaxChars',
  'config.showRateLimit',
  'config.showBlocklist',
  'config.reset',
  'uptime.text',
  'invite.noClientId',
  'invite.link',
  'invite.button',
  'help.title',
  'help.embedTitle',
  'help.intro',
  'help.quickStartTitle',
  'help.quickStartBody',
  'help.groupStarted',
  'help.groupStartedBody',
  'help.groupVoice',
  'help.groupVoiceBody',
  'help.groupFun',
  'help.groupFunBody',
  'help.groupAdmin',
  'help.groupAdminBody',
  'help.groupMore',
  'help.groupMoreBody',
  'help.footer',
  'help.support',
  'help.source',
  'welcome.enginePlans',
  'vote.noClientId',
  'vote.link',
  'vote.button',
  'vote.cooldownStatus',
  'topspeakers.title',
  'topspeakers.empty',
  'topspeakers.line',
  'config.valueNone',
  'config.valueAny',
  'config.valueAutoDetect',
  'config.defaultVoiceSet',
  'config.channelWrongType',
  'config.channelNoAccess',
  'config.channelSet',
  'config.priorityRoleSet',
  'config.priorityRoleCleared',
  'config.blockedRoleSet',
  'config.blockedRoleCleared',
  'config.rolesConflict',
  'config.greetLangSet',
  'config.wordEmpty',
  'config.blocked',
  'config.blockLimit',
  'config.unblocked',
] as const;

type CatalogEntry = { en: string; pt?: string };
const entries = catalog as Record<string, CatalogEntry>;

function message(locale: string, key: (typeof KEYS)[number]): string {
  const entry = entries[key];
  if (!entry?.en) throw new Error(`Missing canonical English i18n key: ${key}`);
  return (
    locales[locale]?.[key] ?? (entry as Record<string, string | undefined>)[locale] ?? entry.en
  );
}

async function main(): Promise<void> {
  const contract = {
    schema_version: 1,
    generated_from: 'src/i18n/catalog.ts + src/i18n/locales',
    default_locale: DEFAULT_LOCALE,
    supported_locales: [...SUPPORTED_LOCALES],
    keys: [...KEYS],
    messages: Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [
        locale,
        Object.fromEntries(KEYS.map((key) => [key, message(locale, key)])),
      ]),
    ),
  };
  const expected = await format(JSON.stringify(contract), {
    parser: 'json',
    printWidth: 100,
    singleQuote: true,
  });

  if (check) {
    const actual = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (actual !== expected) {
      console.error('Rust voice i18n contract is stale. Run: npm run build:rust-contracts');
      process.exitCode = 1;
    }
    return;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, expected, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), target)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
