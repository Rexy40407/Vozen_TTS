// src/commands/definitions.ts
//
// Command definitions (builders -> JSON payload) extracted from index.ts (DEBT-02):
// index.ts stays as a thin dispatcher/registry. `commandDefsRaw` is the raw array;
// `commandDefs` applies the context gate (Guild vs DM); `ownerCommandDefs` are the
// OWNER-ONLY commands registered separately. Pure/stateless — only builds payloads.

import {
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  PermissionFlagsBits,
  ChannelType,
  InteractionContextType,
  ApplicationIntegrationType,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { EFFECT_CHOICES } from '../tts/effects';
import { GREET_LANGUAGE_CHOICES } from '../voice/greeting';
import { SOUND_CHOICES } from '../content/sounds';

const commandDefsRaw: RESTPostAPIApplicationCommandsJSONBody[] = [
  // /invite — viral loop trigger: any user can request the bot's OAuth2
  // invite link. Top-level and WITHOUT setDefaultMemberPermissions (not
  // admin-only), so anyone who hears Vozen in a call can add it.
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Show the link to add Vozen to your server')
    .toJSON(),
  // /vote — link to Vozen's vote page on top.gg (P11.5). Top-level and WITHOUT
  // setDefaultMemberPermissions (NOT admin-only): any user can vote.
  // Like /invite, it's a growth trigger — voting (free, every 12h)
  // boosts the bot's visibility on top.gg.
  new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Show the link to vote for Vozen on top.gg')
    .toJSON(),
  // /help — in-app command discovery, for non-technical server owners.
  // Top-level and WITHOUT setDefaultMemberPermissions (NOT admin-only): any
  // user can request the list. The text is DERIVED from these commandDefs (see
  // handleHelp), so this command includes itself in the "General" group.
  new SlashCommandBuilder().setName('help').setDescription("Show Vozen's command list").toJSON(),
  new SlashCommandBuilder().setName('join').setDescription('Join your voice channel').toJSON(),
  new SlashCommandBuilder().setName('leave').setDescription('Leave the voice channel').toJSON(),
  new SlashCommandBuilder()
    .setName('tts')
    .setDescription('Vozen reads a text out loud')
    .addStringOption((o) => o.setName('text').setDescription('What to read').setRequired(true))
    .toJSON(),
  // Explicit private export.  This does NOT join or speak in a voice channel.
  new SlashCommandBuilder()
    .setName('tts-file')
    .setDescription('Create a private audio file from short text (does not join a call)')
    .addStringOption((o) =>
      o
        .setName('text')
        .setDescription('Short text to turn into audio')
        .setRequired(true)
        .setMaxLength(500),
    )
    .toJSON(),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current audio').toJSON(),
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('View or manage the privacy-safe playback queue')
    .addSubcommand((s) => s.setName('show').setDescription('Show pending queue metadata'))
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove one of your queued items (admins may remove any item)')
        .addStringOption((o) =>
          o.setName('id').setDescription('Opaque queue item id').setRequired(true),
        ),
    )
    .addSubcommand((s) => s.setName('clear').setDescription('Manage Server: clear queued audio'))
    .addSubcommand((s) => s.setName('skip').setDescription('Manage Server: skip current audio'))
    .addSubcommand((s) => s.setName('pause').setDescription('Manage Server: pause audio'))
    .addSubcommand((s) => s.setName('resume').setDescription('Manage Server: resume audio'))
    .toJSON(),
  // /shut-up — silences Vozen NOW: clears the whole queue and stops what's playing (without leaving
  // the call). /skip only skips the current message; this clears everything.
  new SlashCommandBuilder()
    .setName('shut-up')
    .setDescription('Make Vozen stop talking now (clears the whole queue)')
    .toJSON(),
  // /laugh — per-user fun (like /tts): Vozen laughs in the user's CURRENT voice.
  // No options, no admin gate; requires an active player (user in a call).
  new SlashCommandBuilder()
    .setName('laugh')
    .setDescription('Vozen laughs out loud in your current voice')
    .toJSON(),
  // /joke — tells a short joke in the chosen LANGUAGE. `language` uses AUTOCOMPLETE
  // (not choices): we support ~34 languages and Discord limits static choices to
  // 25. `laughter` (required) adds a laugh at the end.
  new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Vozen tells a short joke in the language you pick')
    .addStringOption((o) =>
      o
        .setName('language')
        .setDescription('Language of the joke')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addBooleanOption((o) =>
      o.setName('laughter').setDescription('Add laughter at the end?').setRequired(true),
    )
    .toJSON(),
  // /rizz — sends a pick-up line in the chosen LANGUAGE (same `language` autocomplete as
  // /joke). `sound` (required) plays the "rizz" sound effect at the end. Needs a call.
  new SlashCommandBuilder()
    .setName('rizz')
    .setDescription('Vozen drops a pickup line in the language you pick (💎 Premium)')
    .addStringOption((o) =>
      o
        .setName('language')
        .setDescription('Language of the pickup line')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addBooleanOption((o) =>
      o.setName('sound').setDescription('Add the rizz sound effect at the end?').setRequired(true),
    )
    .toJSON(),
  // /sound — plays a short soundboard clip in the call. `name` (OPTIONAL) uses choices
  // (curated library <=25); without an argument, the handler responds with the list of sounds.
  new SlashCommandBuilder()
    .setName('sound')
    .setDescription('Play a sound clip in the voice channel')
    .addStringOption((o) =>
      o
        .setName('name')
        .setDescription('Which sound to play (leave empty to list them)')
        .setRequired(false)
        .addChoices(...SOUND_CHOICES),
    )
    .toJSON(),
  // Fun micro-commands (spoken in voice + public response). Work without being
  // in a call (text only); if Vozen is in the call, it also speaks.
  new SlashCommandBuilder()
    .setName('8-ball')
    .setDescription('Ask the magic 8-ball a yes/no question')
    .addStringOption((o) =>
      o
        .setName('question')
        .setDescription('Your yes/no question')
        .setRequired(true)
        .setMaxLength(200),
    )
    .toJSON(),
  new SlashCommandBuilder().setName('fortune').setDescription('Vozen reads you a fortune').toJSON(),
  // /cast — randomly assigns a theme entry to every human in Vozen's current voice call.
  // The interactive panel keeps the command beginner-friendly: the language starts in English.
  new SlashCommandBuilder()
    .setName('cast')
    .setDescription('Randomly cast everyone in your voice call')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('fact')
    .setDescription('Vozen tells you a random fun fact')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('wyr')
    .setDescription('Vozen asks a "would you rather" question')
    .toJSON(),
  // /birthday — records your birthday; Vozen says "Happy Birthday" when you join the call
  // on that day. No year (only the day matters). set / clear / show.
  new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Vozen wishes you a happy birthday when you join on your day')
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Set your birthday (day + month, no year)')
        .addIntegerOption((o) =>
          o
            .setName('day')
            .setDescription('Day of the month (1–31)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(31),
        )
        .addIntegerOption((o) =>
          o
            .setName('month')
            .setDescription('Month (1–12)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(12),
        ),
    )
    .addSubcommand((s) => s.setName('clear').setDescription('Remove your saved birthday'))
    .addSubcommand((s) => s.setName('show').setDescription('Show your saved birthday'))
    .toJSON(),
  // /privacy — right to be forgotten (GDPR / Discord Policy §5(b)): delete all
  // personal data in a single command (with confirmation). Paid premium stays retained.
  new SlashCommandBuilder()
    .setName('privacy')
    .setDescription('Manage your personal data')
    .addSubcommand((s) =>
      s
        .setName('erase')
        .setDescription('Permanently delete all your personal data (asks you to confirm first)'),
    )
    .toJSON(),
  // Text-only, explicit opt-in translation. It is deliberately not a voice command and
  // automatic output never enters the TTS queue.
  new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Configure opt-in text translation (never speaks translated text)')
    .addSubcommand((s) =>
      s
        .setName('text')
        .setDescription('Translate text privately')
        .addStringOption((o) =>
          o
            .setName('text')
            .setDescription('Text to translate')
            .setRequired(true)
            .setMaxLength(1000),
        )
        .addStringOption((o) =>
          o.setName('locale').setDescription('Target locale, for example en or pt'),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('language')
        .setDescription('Save your default translation language')
        .addStringOption((o) =>
          o
            .setName('locale')
            .setDescription('Target locale, for example en or pt')
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('speak-language')
        .setDescription('Translate your messages before Vozen reads them (opt-in)')
        .addStringOption((o) =>
          o
            .setName('locale')
            .setDescription('Target locale, or off to disable')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName('status').setDescription('Show translation status (Manage Server)'),
    )
    .addSubcommand((s) =>
      s.setName('enable').setDescription('Enable configured mappings (Manage Server)'),
    )
    .addSubcommand((s) =>
      s.setName('disable').setDescription('Disable automatic translation (Manage Server)'),
    )
    .addSubcommand((s) =>
      s
        .setName('clear')
        .setDescription('Delete mappings and member translation opt-outs (Manage Server)'),
    )
    .addSubcommand((s) =>
      s
        .setName('map-add')
        .setDescription('Map a source text channel to a destination (Manage Server)')
        .addChannelOption((o) =>
          o
            .setName('source')
            .setDescription('Source text channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addChannelOption((o) =>
          o
            .setName('destination')
            .setDescription('Destination text channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('locale')
            .setDescription('Target locale, for example en or pt')
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('map-remove')
        .setDescription('Remove a source channel mapping (Manage Server)')
        .addChannelOption((o) =>
          o
            .setName('source')
            .setDescription('Source text channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName('map-list').setDescription('List channel mappings (Manage Server)'),
    )
    .addSubcommand((s) =>
      s
        .setName('preview')
        .setDescription('Preview a translation without posting it (Manage Server)')
        .addStringOption((o) =>
          o
            .setName('text')
            .setDescription('Text to translate')
            .setRequired(true)
            .setMaxLength(1000),
        )
        .addStringOption((o) =>
          o
            .setName('locale')
            .setDescription('Target locale, for example en or pt')
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('opt-out')
        .setDescription('Opt in or out of automatic translation for your messages')
        .addBooleanOption((o) =>
          o.setName('active').setDescription('Turn opt-out on or off').setRequired(true),
        ),
    )
    .toJSON(),
  // /top-speakers — who had the most messages read by Vozen + consecutive-day streaks.
  new SlashCommandBuilder()
    .setName('top-speakers')
    .setDescription('See who Vozen has read the most — and daily streaks')
    .toJSON(),
  // /server-stats — aggregated server statistics (Premium perk; free sees a teaser).
  // Public (anyone can see); the Premium gate is in the handler, not in the command.
  new SlashCommandBuilder()
    .setName('server-stats')
    .setDescription('Server stats: messages, top talkers and games (💎 Premium, free preview)')
    .toJSON(),
  // /premium — status/showcase + manage pass licences (info/activate/deactivate).
  new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Vozen Premium: your status, or use/free a licence on this server')
    .addSubcommand((s) =>
      s.setName('info').setDescription('See your Premium status — or what you get and how to buy'),
    )
    .addSubcommand((s) =>
      s
        .setName('activate')
        .setDescription('Use one of your Premium licences on this server (needs Manage Server)'),
    )
    .addSubcommand((s) =>
      s
        .setName('deactivate')
        .setDescription('Free this server’s Premium licence to use it elsewhere'),
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('transcribe')
    .setDescription('Live speech-to-text: transcribe consenting speakers to this channel (Premium)')
    .addSubcommand((s) =>
      s
        .setName('start')
        .setDescription(
          'Start transcribing the voice call to this channel (Manage Server, Premium)',
        )
        .addStringOption((o) =>
          o
            .setName('language')
            .setDescription('Language spoken in the call (defaults to the server language)')
            .setRequired(false)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName('stop').setDescription('Stop transcribing the voice call (Manage Server)'),
    )
    .addSubcommand((s) =>
      s.setName('revoke').setDescription('Withdraw your consent to be transcribed on this server'),
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Manage your voice')
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Set your voice')
        .addStringOption((o) =>
          o.setName('model').setDescription('Piper model').setRequired(true).setAutocomplete(true),
        )
        .addNumberOption((o) =>
          o.setName('speed').setDescription('Speed (0.5-2.0)').setRequired(false),
        )
        .addStringOption((o) =>
          o
            .setName('engine')
            .setDescription('Voice engine: default, Piper, Kokoro or Google HD (paid)')
            .setRequired(false)
            .addChoices(
              { name: 'Default (local Piper)', value: 'google' },
              { name: 'Piper', value: 'piper' },
              { name: '💎 Kokoro (Premium neural)', value: 'kokoro' },
              { name: '💎 Google HD (Premium)', value: 'gcloud' },
            ),
        ),
    )
    // /voice config — opens an interactive panel (dropdowns + Save button) so the
    // whole voice setup is done with clicks and NOTHING submits until Save. Avoids the
    // accidental Enter mid-configuration that a slash command with options allows.
    .addSubcommand((s) =>
      s.setName('config').setDescription('Open a panel to set up your voice (no accidental Enter)'),
    )
    .addSubcommand((s) => s.setName('list').setDescription('List the available models'))
    .addSubcommand((s) =>
      s
        .setName('favorite')
        .setDescription('Add a voice to your personal favourites')
        .addStringOption((o) =>
          o.setName('model').setDescription('Voice model').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('unfavorite')
        .setDescription('Remove a voice from your personal favourites')
        .addStringOption((o) =>
          o.setName('model').setDescription('Voice model').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) => s.setName('favorites').setDescription('Show your favourite voices'))
    .addSubcommand((s) => s.setName('recent').setDescription('Show your ten recent voices'))
    .addSubcommand((s) =>
      s
        .setName('browse')
        .setDescription('Browse the currently available voice catalog')
        .addStringOption((o) =>
          o.setName('query').setDescription('Search by voice or language').setMaxLength(50),
        )
        .addStringOption((o) =>
          o
            .setName('locale')
            .setDescription('Two-letter voice language, for example en')
            .setMaxLength(2),
        )
        .addStringOption((o) =>
          o
            .setName('engine')
            .setDescription('Catalog engine')
            .addChoices(
              { name: 'All available voices', value: 'all' },
              { name: 'Local catalog voices', value: 'local' },
              { name: 'Google catalog voices', value: 'google' },
            ),
        ),
    )
    .addSubcommand((s) => s.setName('reset').setDescription('Reset your voice to the default'))
    .addSubcommand((s) =>
      s
        .setName('detection')
        .setDescription('Native voice per language (the speaker may change). Off by default.')
        .addBooleanOption((o) =>
          o
            .setName('active')
            .setDescription('On = native voice per language; Off (default) = one fixed voice')
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName('opt-out').setDescription('Stop being read automatically in the auto-read channel'),
    )
    .addSubcommand((s) =>
      s.setName('opt-in').setDescription('Be read automatically again in the auto-read channel'),
    )
    .addSubcommand((s) =>
      s
        .setName('preview')
        .setDescription('Play a sample sentence in your current voice (or a specific model)')
        .addStringOption((o) =>
          o
            .setName('model')
            .setDescription('Piper model (optional)')
            .setRequired(false)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('nickname')
        .setDescription('How Vozen should call you out loud (xsaid). Leave empty to clear.')
        .addStringOption((o) =>
          o
            .setName('name')
            .setDescription('Spoken name (empty = use your server name)')
            .setRequired(false)
            .setMaxLength(40),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('effect')
        .setDescription('Apply a voice effect to your messages (💎 = Premium)')
        .addStringOption((o) =>
          o
            .setName('effect')
            .setDescription('Voice effect (none = clean; 💎 needs Premium)')
            .setRequired(true)
            .addChoices(...EFFECT_CHOICES),
        ),
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Server configuration (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('tts-channel')
        .setDescription('Set the auto-read channel')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Text channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('auto-read')
        .setDescription('Turn auto-read on/off')
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('max-chars')
        .setDescription('Maximum characters per message')
        .addIntegerOption((o) =>
          o
            .setName('value')
            .setDescription('1-2000')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(2000),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('rate-limit')
        .setDescription('Messages per minute per user')
        .addIntegerOption((o) =>
          o
            .setName('value')
            .setDescription('1-120')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(120),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('role')
        .setDescription('Restrict auto-read to a role (omit the role to clear the restriction)')
        .addRoleOption((o) =>
          o
            .setName('role')
            .setDescription('Allowed role (empty = no restriction)')
            .setRequired(false),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('priority-role')
        .setDescription('Accessibility queue priority role (omit to clear)')
        .addRoleOption((o) =>
          o
            .setName('role')
            .setDescription('Role with accessibility queue priority')
            .setRequired(false),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('blocked-role')
        .setDescription('Block a role from adding audio to the queue (omit to clear)')
        .addRoleOption((o) => o.setName('role').setDescription('Blocked role').setRequired(false)),
    )
    .addSubcommand((s) =>
      s
        .setName('enabled')
        .setDescription('Turn TTS on/off on this server (kill-switch)')
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('x-said')
        .setDescription('Announce who spoke before each message ("{name} said …")')
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('auto-join')
        .setDescription(
          'Vozen joins your voice channel automatically when you type in the TTS channel',
        )
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('always-on')
        .setDescription(
          '24/7 in-call (💎 Premium): Vozen stays in the voice channel even when empty',
        )
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('read-bots')
        .setDescription('Read messages from other bots and webhooks (off by default)')
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('text-in-voice')
        .setDescription(
          'Also read the text chat inside the voice channel Vozen is in (off by default)',
        )
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('anti-spam')
        .setDescription(
          "Don't read spammed messages (mass word repetition or the same big message) (off by default)",
        )
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('streaks')
        .setDescription('Show the 🔥 daily streak notice when someone speaks (on by default)')
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('soundboard')
        .setDescription(
          'Allow /sound (play sound clips in the call) on this server (on by default)',
        )
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('vote-reminders')
        .setDescription('Allow alternating Top.gg and support notices (off by default)')
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('greet')
        .setDescription('Greet people by name when they join the voice channel (on by default)')
        .addBooleanOption((o) => o.setName('active').setDescription('on/off').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('greet-language')
        .setDescription('Language of the join greeting (English by default)')
        .addStringOption((o) =>
          o
            .setName('language')
            .setDescription('Greeting language')
            .setRequired(true)
            .addChoices(...GREET_LANGUAGE_CHOICES),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('default-voice')
        .setDescription(
          "Set the server's default voice (used when the user has no voice of their own)",
        )
        .addStringOption((o) =>
          o.setName('model').setDescription('Piper model').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('language')
        .setDescription('Set the interface language (English is the default)')
        // AUTOCOMPLETE (not choices): we support 34 interface languages > 25, Discord's
        // cap for static choices. The `locale` branch of handleAutocomplete
        // filters SUPPORTED_LOCALES by endonym/code (LOCALE_DISPLAY_NAMES) and
        // returns up to 25 suggestions. The handler validates the choice against SUPPORTED_LOCALES.
        .addStringOption((o) =>
          o
            .setName('locale')
            .setDescription('Interface language')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName('show').setDescription("Show the server's current configuration"),
    )
    .addSubcommand((s) =>
      s.setName('reset').setDescription("Reset the server's configuration to defaults"),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('block-word')
        .setDescription('Manage the blocklist')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Add a word')
            .addStringOption((o) =>
              o.setName('word').setDescription('Word to block').setRequired(true).setMaxLength(60),
            ),
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove a word')
            .addStringOption((o) =>
              o.setName('word').setDescription('Word to unblock').setRequired(true),
            ),
        ),
    )
    // NB: the old `pronunciation` subgroup (server dictionary) was REMOVED in
    // plan v4 — pronunciations are now only PERSONAL via /pronunciation (individual).
    .toJSON(),
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Guided one-step configuration (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Auto-read channel (omit = use the current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .addBooleanOption((o) =>
      o
        .setName('test-voice')
        .setDescription('Play a short local voice check after setup')
        .setRequired(false),
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Bot statistics (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('How long Vozen has been online')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('bot-stats')
    .setDescription('Public Vozen stats: servers, voice sessions, uptime')
    .toJSON(),
  // /game — group minigames. PUBLIC (no admin gate): anyone starts a
  // game. Guild-only (not in DM_CAPABLE_COMMANDS -> the .map sets contexts:[Guild]).
  // The `game` option uses AUTOCOMPLETE (names in the user's language via t()); the
  // stop/list/leaderboard subcommands have no options.
  new SlashCommandBuilder()
    .setName('game')
    .setDescription('Play a minigame with the server')
    .addSubcommand((s) =>
      s
        .setName('play')
        .setDescription('Start a game')
        .addStringOption((o) =>
          o
            .setName('game')
            // OPTIONAL on purpose (beginner-friendly, plan v4): /game play "empty"
            // shows a select menu with the games instead of Discord requiring the option.
            .setDescription('Which game to play (leave empty to pick from a menu)')
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName('language')
            .setDescription('Language for Word Chain (ignored by other games)')
            .setRequired(false)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) => s.setName('stop').setDescription('Stop the current game'))
    .addSubcommand((s) => s.setName('list').setDescription('List the available games'))
    .addSubcommand((s) =>
      s.setName('leaderboard').setDescription("Show the server's game leaderboard"),
    )
    .addSubcommand((s) => s.setName('stats').setDescription('Show your own game stats'))
    .toJSON(),
  // /pronunciation — PERSONAL pronunciation dictionary (only affects the messages of whoever
  // created it; follows the user across servers). Limit 3 Free / 50 Premium (Plus or
  // Premium server). `add` without options opens a MODAL (beginner-friendly, plan v4).
  new SlashCommandBuilder()
    .setName('pronunciation')
    .setDescription('Teach Vozen how to say a word — only affects YOUR messages')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add or edit a personal pronunciation (leave empty for a form)')
        .addStringOption((o) =>
          o
            .setName('term')
            .setDescription('The word as people type it (e.g. "gg")')
            .setMaxLength(100),
        )
        .addStringOption((o) =>
          o
            .setName('say')
            .setDescription('How Vozen should say it (e.g. "good game")')
            .setMaxLength(200),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove one of your personal pronunciations')
        // AUTOCOMPLETE: lists the saved pronunciations (pick > type from memory).
        .addStringOption((o) =>
          o
            .setName('term')
            .setDescription('The word to remove — pick from your saved pronunciations')
            .setRequired(true)
            .setMaxLength(100)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) => s.setName('list').setDescription('List your personal pronunciations'))
    .toJSON(),
  // /server-pronunciation — SERVER pronunciation dictionary (admin): applies to
  // EVERYONE's messages. Limit 3 Free / 50 Premium. `add` without options opens a modal.
  new SlashCommandBuilder()
    .setName('server-pronunciation')
    .setDescription('Server-wide pronunciations for everyone (admin, 3 · 50 with Premium)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add or edit a server pronunciation (leave empty for a form)')
        .addStringOption((o) =>
          o.setName('term').setDescription('The word as people type it').setMaxLength(100),
        )
        .addStringOption((o) =>
          o.setName('say').setDescription('How Vozen should say it for everyone').setMaxLength(200),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove one of the server pronunciations')
        // AUTOCOMPLETE: lists the server's pronunciations (pick > type from memory).
        .addStringOption((o) =>
          o
            .setName('term')
            .setDescription("The word to remove — pick from the server's pronunciations")
            .setRequired(true)
            .setMaxLength(100)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) => s.setName('list').setDescription("List the server's pronunciations"))
    .toJSON(),
  // /randomizer — spoken draw: choose the number of options (2–5, modal) OR pass a
  // comma-separated list; Vozen picks one at random and says it in the call. Without any
  // options -> number select (beginner-friendly).
  new SlashCommandBuilder()
    .setName('randomizer')
    .setDescription('Vozen picks one option at random and says it out loud')
    .addIntegerOption((o) =>
      o
        .setName('amount')
        .setDescription('How many options to fill in (2–5, opens a form)')
        .setMinValue(2)
        .setMaxValue(5),
    )
    .addStringOption((o) =>
      o
        .setName('options')
        .setDescription('Or type them here, separated by commas (e.g. "pizza, sushi, tacos")')
        .setMaxLength(1000),
    )
    .toJSON(),
  // Context-menu (right-click a message -> Apps -> Speak): reads that message out
  // loud with the voice of whoever clicked. Complements /tts without typing anything.
  new ContextMenuCommandBuilder().setName('Speak').setType(ApplicationCommandType.Message).toJSON(),
  new ContextMenuCommandBuilder()
    .setName('Translate')
    .setType(ApplicationCommandType.Message)
    .toJSON(),
  new ContextMenuCommandBuilder()
    .setName('Transcribe voice message')
    .setType(ApplicationCommandType.Message)
    .toJSON(),
  // /redeem — PUBLIC: redeems a gift code (generated by the owner with /generate-code).
  // Grants Plus or a Premium pass to the redeemer's account (not to a server), so
  // it is DM-capable. Single-use; see store/premiumCode.ts.
  new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem a Vozen gift code')
    .addStringOption((o) =>
      o.setName('code').setDescription('Your gift code (e.g. VOZEN-XXXX-XXXX)').setRequired(true),
    )
    .toJSON(),
];

export type CommandCapability =
  | 'information'
  | 'personal-entitlement'
  | 'voice'
  | 'guild-configuration'
  | 'translation'
  | 'moderation'
  | 'owner';

export interface CommandExposure {
  /** A User App must be enabled manually in the Developer Portal before this can change runtime scope. */
  userAppCandidate: boolean;
  /** Existing gateway handlers are safe with no guild object. This is not an authorization grant. */
  dmSafe: boolean;
  capabilities: readonly CommandCapability[];
}

const DM_SAFE_EXPOSURES: Readonly<Record<string, CommandExposure>> = {
  invite: { dmSafe: true, userAppCandidate: true, capabilities: ['information'] },
  vote: { dmSafe: true, userAppCandidate: true, capabilities: ['information'] },
  help: { dmSafe: true, userAppCandidate: true, capabilities: ['information'] },
  uptime: { dmSafe: true, userAppCandidate: true, capabilities: ['information'] },
  'bot-stats': { dmSafe: true, userAppCandidate: true, capabilities: ['information'] },
  'tts-file': { dmSafe: true, userAppCandidate: true, capabilities: ['voice'] },
  translate: { dmSafe: true, userAppCandidate: true, capabilities: ['translation'] },
  Translate: { dmSafe: true, userAppCandidate: true, capabilities: ['translation'] },
  'Transcribe voice message': {
    dmSafe: true,
    userAppCandidate: true,
    capabilities: ['translation'],
  },
  // This is a personal entitlement action. It never reads a guild, joins voice or scans messages.
  redeem: { dmSafe: true, userAppCandidate: false, capabilities: ['personal-entitlement'] },
};

const DEFAULT_GUILD_EXPOSURE: CommandExposure = {
  dmSafe: false,
  userAppCandidate: false,
  capabilities: ['voice'],
};

/**
 * Single declarative context policy. New commands safely become guild-only until an
 * explicit review adds them above; this metadata never replaces handler-side checks.
 */
export function commandExposure(name: string): CommandExposure {
  return DM_SAFE_EXPOSURES[name] ?? DEFAULT_GUILD_EXPOSURE;
}

// All OTHER commands depend on a guild (voice session, config and per-guild
// store). By default Discord shows global commands in DM too, where
// `guildId` is null → the handler would write to the store with guildId null (SqliteError:
// guild_id NOT NULL) or respond with misleading things. Restricting them to the
// Guild context makes Discord HIDE them in DM. Centralized by name (instead of repeating
// .setContexts() in ~10 builders) so no new command is forgotten. Also covers
// the "Speak" context-menu (needs a voice channel).
const commandDefsWithContext: RESTPostAPIApplicationCommandsJSONBody[] = commandDefsRaw.map(
  (def) => {
    const exposure = commandExposure(def.name);
    if (exposure.userAppCandidate) {
      return {
        ...def,
        integration_types: [
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        ],
        contexts: [
          InteractionContextType.Guild,
          InteractionContextType.BotDM,
          InteractionContextType.PrivateChannel,
        ],
      };
    }
    if (exposure.dmSafe) {
      return {
        ...def,
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
      };
    }
    return {
      ...def,
      integration_types: [ApplicationIntegrationType.GuildInstall],
      contexts: [InteractionContextType.Guild],
    };
  },
);
export const commandDefs: RESTPostAPIApplicationCommandsJSONBody[] = commandDefsWithContext;

// OWNER-ONLY commands. They do NOT go into commandDefs (global): they're registered separately, as
// GUILD commands, only in OWNER_GUILD_ID (registerOwnerCommands). This way the public doesn't even
// see them in the picker — 1st layer of defense. The 2nd is the owner gate in the handler.
export const ownerCommandDefs: RESTPostAPIApplicationCommandsJSONBody[] = [
  new SlashCommandBuilder()
    .setName('vozen-grant')
    .setDescription('Owner only — grant Vozen Premium/Plus to a user')
    .addUserOption((o) => o.setName('user').setDescription('User to grant to').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('plan')
        .setDescription('What to grant')
        .setRequired(true)
        .addChoices(
          { name: 'Premium (server pass — set licences below)', value: 'premium' },
          { name: 'Plus (personal, follows the user)', value: 'plus' },
        ),
    )
    .addIntegerOption((o) =>
      o
        .setName('days')
        .setDescription('Duration in days (default 30)')
        .setMinValue(1)
        .setMaxValue(3650),
    )
    .addIntegerOption((o) =>
      o
        .setName('seats')
        .setDescription('Premium only: number of server licences (default 3)')
        .setMinValue(1)
        .setMaxValue(50),
    )
    .toJSON(),
  // /generate-code — OWNER-ONLY: generates gift code(s) the owner gives to whoever they want. Same
  // defense in depth as /vozen-grant (only registered in OWNER_GUILD_ID + owner gate
  // in the handler). Redeemed with /redeem (public). `plan` chooses Plus vs Premium pass.
  new SlashCommandBuilder()
    .setName('generate-code')
    .setDescription('Owner only — generate Vozen gift code(s)')
    .addStringOption((o) =>
      o
        .setName('plan')
        .setDescription('What the code grants')
        .setRequired(true)
        .addChoices(
          { name: 'Premium (server pass)', value: 'premium' },
          { name: 'Plus (personal, follows the user)', value: 'plus' },
        ),
    )
    .addIntegerOption((o) =>
      o
        .setName('days')
        .setDescription('Premium duration in days (default 30)')
        .setMinValue(1)
        .setMaxValue(3650),
    )
    .addIntegerOption((o) =>
      o
        .setName('seats')
        .setDescription('Premium only: server licences (default 3)')
        .setMinValue(1)
        .setMaxValue(50),
    )
    .addIntegerOption((o) =>
      o
        .setName('amount')
        .setDescription('How many codes to generate (default 1)')
        .setMinValue(1)
        .setMaxValue(20),
    )
    .addIntegerOption((o) =>
      o
        .setName('expires-days')
        .setDescription('Optional: code expires after this many days')
        .setMinValue(1)
        .setMaxValue(3650),
    )
    .toJSON(),
];
