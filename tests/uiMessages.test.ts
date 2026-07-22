import { describe, expect, it } from 'vitest';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { COLORS } from '../src/ui/theme';
import {
  channelCard,
  editCard,
  formatCardText,
  messageEditCard,
  replyCard,
  toneFromContent,
  updateCard,
} from '../src/ui/messages';

describe('Vozen Components V2 message system', () => {
  it('infers semantic accents from language-independent status marks', () => {
    expect(toneFromContent('✅ Saved')).toBe('success');
    expect(toneFromContent('⚠️ Check this')).toBe('warning');
    expect(toneFromContent('❌ Failed')).toBe('danger');
    expect(toneFromContent('💎 Premium')).toBe('premium');
    expect(toneFromContent('Ready')).toBe('brand');
  });

  it('turns long prose into a scannable lead plus follow-up lines', () => {
    const text =
      "✅ I'm in General! Next step: use `/tts hello` and I'll read it aloud. Run `/setup` for auto-read.";
    expect(formatCardText(text)).toBe(
      "**✅ I'm in General!**\nNext step: use `/tts hello` and I'll read it aloud.\nRun `/setup` for auto-read.",
    );
  });

  it('creates the same hierarchy for CJK punctuation without spaces', () => {
    const text =
      '✅ 一般チャンネルに参加しました！次に `/tts hello` を使うと読み上げます。自動読み上げには `/setup` を実行してください。';
    expect(formatCardText(text)).toBe(
      '**✅ 一般チャンネルに参加しました！**\n次に `/tts hello` を使うと読み上げます。\n自動読み上げには `/setup` を実行してください。',
    );
  });

  it('keeps inline emphasis while separating instructions and technical metadata', () => {
    const text =
      '✅ A tua voz agora é **Espanhol (Espanha) — Davefx** a 1× (motor: **Piper**). Experimenta `/tts olá` para a ouvir. (id: `es_ES-davefx-medium`)';
    expect(formatCardText(text)).toBe(
      '✅ A tua voz agora é **Espanhol (Espanha) — Davefx** a 1× (motor: **Piper**).\nExperimenta `/tts olá` para a ouvir.\n-# id: `es_ES-davefx-medium`',
    );
  });

  it('preserves intentional Markdown and compact messages', () => {
    expect(formatCardText('### Ready\nUse `/tts hello`.')).toBe('### Ready\nUse `/tts hello`.');
    expect(formatCardText('Skipped.')).toBe('Skipped.');
  });

  it('groups copy and controls inside one accessible container', () => {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('continue')
        .setLabel('Continue')
        .setStyle(ButtonStyle.Primary),
    );
    const payload = replyCard('✅ Ready to continue.', {
      ephemeral: true,
      rows: [row],
    });
    const flags = Number(payload.flags);
    expect(flags & MessageFlags.IsComponentsV2).toBeTruthy();
    expect(flags & MessageFlags.Ephemeral).toBeTruthy();

    const component = payload.components?.[0];
    const container = component && 'toJSON' in component ? component.toJSON() : component;
    expect(container?.type).toBe(ComponentType.Container);
    expect(container).toMatchObject({
      accent_color: COLORS.success,
      components: [
        { type: ComponentType.TextDisplay, content: '✅ Ready to continue.' },
        { type: ComponentType.ActionRow },
      ],
    });
  });

  it('uses the correct flag contracts for edits, updates, and channel messages', () => {
    expect(Number(editCard('Done.').flags)).toBe(MessageFlags.IsComponentsV2);
    expect(updateCard('Done.')).not.toHaveProperty('flags');
    expect(Number(channelCard('Done.').flags)).toBe(MessageFlags.IsComponentsV2);
    expect(Number(messageEditCard('Done.').flags)).toBe(MessageFlags.IsComponentsV2);
    expect(messageEditCard('Done.')).toMatchObject({ content: null, embeds: [] });
  });

  it('suppresses mentions by default and allows an explicit safe override', () => {
    expect(replyCard('@everyone translated output').allowedMentions).toEqual({ parse: [] });
    expect(channelCard('<@123> notice').allowedMentions).toEqual({ parse: [] });
    expect(
      replyCard('<@123> explicit', { allowedMentions: { users: ['123'], parse: [] } })
        .allowedMentions,
    ).toEqual({ users: ['123'], parse: [] });
  });
});
