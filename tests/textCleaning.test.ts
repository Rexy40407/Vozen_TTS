import { describe, it, expect } from 'vitest';
import { cleanText, collectUrlMedia, collectMarkdownMedia } from '../src/textCleaning/clean';
import type { CleanOptions } from '../src/textCleaning/clean';

const opts: CleanOptions = {
  maxChars: 200,
  resolveUser: (id: string) => `@user${id}`,
  resolveChannel: (id: string) => `#chan${id}`,
};

describe('cleanText', () => {
  describe('URLs', () => {
    // The URL is REMOVED from the body; the announcement ("a link"/"a gif") is done downstream
    // (localized in the voice) via collectUrlMedia — tested in its own describe below.
    it('removes http(s) from the body (does not read the raw URL)', () => {
      expect(cleanText('vai a https://exemplo.com agora', opts)).toBe('vai a agora');
      expect(cleanText('http://a.b/c?x=1', opts)).toBe('');
    });

    it('removes www. from the body', () => {
      expect(cleanText('ve www.exemplo.com ja', opts)).toBe('ve ja');
    });
  });

  describe('collectUrlMedia — classifies URLs into link/gif for the announcement', () => {
    it('normal URL -> [link]', () => {
      expect(collectUrlMedia('vai a https://exemplo.com agora')).toEqual(['link']);
      expect(collectUrlMedia('ve www.exemplo.com ja')).toEqual(['link']);
    });

    it('Tenor/Giphy GIF -> [gif]', () => {
      expect(collectUrlMedia('olha https://tenor.com/view/cat-gif-12345 lol')).toEqual(['gif']);
      expect(collectUrlMedia('https://giphy.com/gifs/funny-abc123')).toEqual(['gif']);
    });

    it('direct .gif media -> [gif]', () => {
      expect(collectUrlMedia('https://cdn.exemplo.com/animacao.gif')).toEqual(['gif']);
    });

    it('multiple URLs -> one item per URL, order preserved', () => {
      expect(collectUrlMedia('a https://x.com b https://tenor.com/view/y c')).toEqual([
        'link',
        'gif',
      ]);
    });

    it('no URL -> []', () => {
      expect(collectUrlMedia('mensagem normal sem links')).toEqual([]);
    });

    // Bug-hunt 2026-07: a URL INSIDE code/spoiler was announced TWICE
    // (as "code"/"spoiler" via collectMarkdownMedia AND as "link"/"gif" here),
    // because this scan ran over the RAW text. Now it only counts URLs in what remains
    // after removing code and spoilers — parity with what cleanText removes.
    it('URL inside code is NOT counted as a link (avoids double counting)', () => {
      expect(collectUrlMedia('`https://tenor.com/view/x-gif-1`')).toEqual([]);
      expect(collectUrlMedia('```\nhttps://exemplo.com\n```')).toEqual([]);
      expect(collectUrlMedia('||https://exemplo.com||')).toEqual([]);
    });

    it('URL OUTSIDE code is still counted (the normal case is unchanged)', () => {
      expect(collectUrlMedia('vê `codigo` e https://exemplo.com')).toEqual(['link']);
    });
  });

  describe('spoiler — content is NOT read (only announced)', () => {
    it('cleanText removes the spoiler content from the body', () => {
      expect(cleanText('olha ||segredo grande|| aqui', opts)).toBe('olha aqui');
      expect(cleanText('||tudo oculto||', opts)).toBe('');
    });

    it('collectMarkdownMedia counts spoilers and code', () => {
      expect(collectMarkdownMedia('olha ||segredo|| aqui')).toEqual(['spoiler']);
      expect(collectMarkdownMedia('corre `npm test` agora')).toEqual(['code']);
      expect(collectMarkdownMedia('```\nbloco\n``` e `inline`')).toEqual(['code', 'code']);
    });

    it('code INSIDE a spoiler counts only as spoiler (no double counting)', () => {
      expect(collectMarkdownMedia('||`secret code`||')).toEqual(['spoiler']);
    });

    it('no spoiler or code -> []', () => {
      expect(collectMarkdownMedia('mensagem normal')).toEqual([]);
    });
  });

  describe('user mentions', () => {
    it('resolve <@123> via resolveUser', () => {
      expect(cleanText('ola <@123>', opts)).toBe('ola @user123');
    });

    it('resolves <@!123> (nickname) via resolveUser', () => {
      expect(cleanText('ola <@!456>', opts)).toBe('ola @user456');
    });
  });

  describe('channel mentions', () => {
    it('resolve <#456> via resolveChannel', () => {
      expect(cleanText('vai a <#789>', opts)).toBe('vai a #chan789');
    });
  });

  describe('role mentions', () => {
    it('removes role mention <@&123> (does not read it literally)', () => {
      // Before the fix, <@&123> survived all phases and was read as "<@&123>".
      const r = cleanText('atencao <@&123> pessoal', opts);
      expect(r).not.toContain('<@&123>');
      expect(r).not.toContain('123');
      expect(r).toBe('atencao pessoal');
    });
  });

  describe('emojis', () => {
    it('READS the name of the custom emoji <:nome:789>', () => {
      expect(cleanText('boa <:pog:789> festa', opts)).toBe('boa pog festa');
    });

    it('READS the name of the animated custom emoji <a:nome:789>', () => {
      expect(cleanText('boa <a:dance:111> festa', opts)).toBe('boa dance festa');
    });

    it('custom emoji with underscore -> name with spaces', () => {
      expect(cleanText('<:party_blob:1>', opts)).toBe('party blob');
    });

    it('removes unicode emoji', () => {
      expect(cleanText('ola 😀 mundo 🎉', opts)).toBe('ola mundo');
    });
  });

  describe('code blocks', () => {
    it('removes ```code``` blocks', () => {
      expect(cleanText('antes ```const x = 1;``` depois', opts)).toBe('antes depois');
    });

    it('removes multiline ```code``` blocks', () => {
      expect(cleanText('antes ```\nlinha1\nlinha2\n``` depois', opts)).toBe('antes depois');
    });

    it('removes inline `code`', () => {
      expect(cleanText('usa `npm install` aqui', opts)).toBe('usa aqui');
    });
  });

  describe('collapse repetitions', () => {
    it('collapses long lowercase runs to 3 ("aaaaaa" -> "aaa")', () => {
      expect(cleanText('aaaaaa', opts)).toBe('aaa');
    });

    it('collapses uppercase to 2 ("WWWW" -> "WW")', () => {
      expect(cleanText('WWWW', opts)).toBe('WW');
    });

    it('does not touch short runs', () => {
      expect(cleanText('aa BB', opts)).toBe('aa BB');
    });
  });

  describe('truncate', () => {
    it('truncates to maxChars', () => {
      const longo = 'abcd'.repeat(13); // 52 chars, no runs of 3+ equal chars so nothing collapses
      const r = cleanText(longo, { ...opts, maxChars: 10 });
      expect(r.length).toBe(10);
    });

    it('does not split surrogate pairs when truncating (no lone surrogates)', () => {
      // 𝕏 (U+1D54F) is 2 UTF-16 code units and is NOT Extended_Pictographic,
      // so it survives cleaning. Truncating at an odd boundary would split the pair
      // leaving a lone surrogate -> garbage for Piper's stdin.
      const text = 'ab' + '𝕏'.repeat(5); // 'a','b', then surrogate pairs
      const r = cleanText(text, { ...opts, maxChars: 5 });
      // No code unit may be a lone surrogate (0xD800-0xDFFF without a pair).
      for (let idx = 0; idx < r.length; idx++) {
        const code = r.charCodeAt(idx);
        const isHigh = code >= 0xd800 && code <= 0xdbff;
        const isLow = code >= 0xdc00 && code <= 0xdfff;
        if (isHigh) {
          const next = r.charCodeAt(idx + 1);
          expect(next >= 0xdc00 && next <= 0xdfff).toBe(true);
          idx++; // skip the already-validated low surrogate
        } else {
          expect(isLow).toBe(false); // low surrogate without a preceding high = orphan
        }
      }
    });
  });

  describe('emojis with zero-width components / flags (ZWJ/VS16/keycap/RI)', () => {
    // Stripping \p{Extended_Pictographic} removed the base pictogram but left
    // the zero-width components (U+200D ZWJ, U+FE0F VS16, U+20E3 keycap) and the
    // regional indicators (flags) — invisible but TRUTHY residue that survived
    // the trim and passed the empty guard. Now it must go too.
    it('heart ❤️ (U+2764 U+FE0F) -> "" (VS16 removed)', () => {
      expect(cleanText('❤️', opts)).toBe('');
    });

    it('ZWJ sequence 👨‍💻 -> "" (base + ZWJ removed, no residue)', () => {
      expect(cleanText('👨‍💻', opts)).toBe('');
    });

    it('keycap 1️⃣ -> "1" (VS16+keycap removed, the base DIGIT survives)', () => {
      expect(cleanText('1️⃣', opts)).toBe('1');
    });

    it('flag 🇦🇩 (regional indicators) -> "" (RI removed)', () => {
      expect(cleanText('🇦🇩', opts)).toBe('');
    });

    it('emoji with components in the middle of text -> only the text remains', () => {
      expect(cleanText('ola ❤️ mundo', opts)).toBe('ola mundo');
    });
  });

  describe('empty', () => {
    it('returns "" if there is only emoji', () => {
      expect(cleanText('😀', opts)).toBe('');
    });

    it('returns "" if there is only a code block', () => {
      expect(cleanText('```apenas codigo```', opts)).toBe('');
    });

    it('returns "" for an empty string or only spaces', () => {
      expect(cleanText('   ', opts)).toBe('');
      expect(cleanText('', opts)).toBe('');
    });
  });

  describe('edge-cases: emoji + URL + mention together', () => {
    it('cleans emoji + URL + user mention in the same message', () => {
      // unicode emoji removed, URL removed from body, mention resolved
      expect(cleanText('😀 https://example.com <@123>', opts)).toBe('@user123');
    });

    it('cleans role + custom emoji + URL in the same message', () => {
      // role removed, custom emoji READ (fire), URL removed from body
      expect(cleanText('check <@&999> <:fire:123> at https://x.com', opts)).toBe('check fire at');
    });

    it('a message of only unicode emojis returns ""', () => {
      expect(cleanText('😀🎉🔥', opts)).toBe('');
    });
  });

  describe('edge-cases: nested markdown', () => {
    it('removes inline code inside bold text, preserving the bold and the rest of the text', () => {
      // clean.ts does not remove bold/italic; only code fences and inline code are removed
      expect(cleanText('**negrito com `code` dentro**', opts)).toBe('**negrito com dentro**');
    });

    it('code fence containing a mention: fence is removed, mention is never resolved', () => {
      // the code block is stripped in phase 1, before mentions in phase 4
      expect(cleanText('antes ```\n<@123>\n``` depois', opts)).toBe('antes depois');
    });
  });

  describe('edge-cases: unicode', () => {
    it('preserves accented Latin characters (café, açaí)', () => {
      expect(cleanText('café açaí', opts)).toBe('café açaí');
    });

    it('preserves non-Latin script (Japanese)', () => {
      expect(cleanText('こんにちは', opts)).toBe('こんにちは');
    });

    it('preserves the astral math char 𝕏 (U+1D54F) which is not Extended_Pictographic', () => {
      // 𝕏 takes 2 UTF-16 code units but is not an emoji, so it survives cleaning
      expect(cleanText('a𝕏b', opts)).toBe('a𝕏b');
    });
  });
});
