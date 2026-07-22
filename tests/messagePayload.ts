import { MessageFlags } from 'discord.js';

type JsonEncodable = { toJSON(): unknown };

function asJson(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toJSON' in value) {
    return (value as JsonEncodable).toJSON();
  }
  return value;
}

function collectText(value: unknown, out: string[]): void {
  const json = asJson(value);
  if (typeof json === 'string') {
    out.push(json);
    return;
  }
  if (Array.isArray(json)) {
    for (const item of json) collectText(item, out);
    return;
  }
  if (!json || typeof json !== 'object') return;

  const record = json as Record<string, unknown>;
  if (typeof record.content === 'string') out.push(record.content);
  if (typeof record.title === 'string') out.push(record.title);
  if (typeof record.description === 'string') out.push(record.description);
  if (Array.isArray(record.fields)) collectText(record.fields, out);
  if (typeof record.name === 'string' && typeof record.value === 'string') {
    out.push(record.name, record.value);
  }
  if (Array.isArray(record.embeds)) collectText(record.embeds, out);
  if (Array.isArray(record.components)) collectText(record.components, out);
}

/** Extracts visible copy from strings, legacy embeds, and nested Components V2 payloads. */
export function messageText(payload: unknown): string {
  const out: string[] = [];
  collectText(payload, out);
  return out
    .join('\n')
    .replace(/(^|\n)\*\*([^*\n]+[.!?。！？])\*\*\s*/gu, '$1$2 ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function messageFlags(payload: unknown): number {
  if (!payload || typeof payload !== 'object' || !('flags' in payload)) return 0;
  return Number((payload as { flags?: unknown }).flags ?? 0);
}

export function isEphemeral(payload: unknown): boolean {
  return (messageFlags(payload) & MessageFlags.Ephemeral) !== 0;
}
