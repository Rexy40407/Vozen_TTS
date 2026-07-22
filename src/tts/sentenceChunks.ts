/**
 * A conservative playback chunker: sentence boundaries first, words second. It never
 * rewrites punctuation or content, and therefore remains safe before provider-specific
 * escaping and synthesis.
 */
export function splitForFastPlayback(text: string, maxChars: number): string[] {
  const normalized = text.trim().replace(/\s+/gu, ' ');
  if (!normalized) return [];
  if (!Number.isSafeInteger(maxChars) || maxChars < 8 || normalized.length <= maxChars) {
    return [normalized];
  }

  const sentences = normalized.match(/[^.!?]+(?:[.!?]+|$)/gu) ?? [normalized];
  const chunks: string[] = [];
  let current = '';

  const pushWords = (value: string): void => {
    for (const word of value.split(' ')) {
      if (!word) continue;
      if (!current) {
        current = word;
        continue;
      }
      if (`${current} ${word}`.length <= maxChars) {
        current += ` ${word}`;
      } else {
        chunks.push(current);
        current = word;
      }
    }
  };

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if (current && `${current} ${sentence}`.length <= maxChars) {
      current += ` ${sentence}`;
      continue;
    }
    if (current) {
      chunks.push(current);
      current = '';
    }
    if (sentence.length <= maxChars) current = sentence;
    else pushWords(sentence);
  }
  if (current) chunks.push(current);
  return chunks;
}
