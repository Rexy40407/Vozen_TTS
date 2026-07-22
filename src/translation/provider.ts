/** Privacy-minimised text translation provider boundary. */

export type TranslationFailureCode = 'disabled' | 'quota_exhausted' | 'transient' | 'permanent';

export class TranslationError extends Error {
  constructor(
    readonly code: TranslationFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}

export interface TranslationRequest {
  /** Current message text only. Never include identities, links, embeds, or history. */
  text: string;
  targetLocale: string;
}

export interface TranslationProvider {
  readonly kind: 'disabled' | 'azure';
  readonly enabled: boolean;
  translate(request: TranslationRequest): Promise<string>;
}

export interface TranslationProviderConfig {
  kind: 'disabled' | 'azure';
  endpoint?: string;
  apiKey?: string;
}

export const TRANSLATION_REQUEST_TIMEOUT_MS = 10_000;

export function parseTranslationProviderConfig(
  env: Record<string, string | undefined>,
): TranslationProviderConfig {
  const requested = (env.TRANSLATION_PROVIDER ?? 'disabled').trim().toLowerCase();
  if (requested !== 'azure') return { kind: 'disabled' };
  const endpoint = env.TRANSLATION_AZURE_ENDPOINT?.trim();
  const apiKey = env.TRANSLATION_AZURE_KEY?.trim();
  // Invalid/incomplete configuration deliberately degrades to disabled. The caller may expose
  // only the generic admin diagnostic; never echo an endpoint or credential back to Discord.
  if (!endpoint || !apiKey) return { kind: 'disabled' };
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return { kind: 'disabled' };
  } catch {
    return { kind: 'disabled' };
  }
  return { kind: 'azure', endpoint: endpoint.replace(/\/+$/, ''), apiKey };
}

export class DisabledTranslationProvider implements TranslationProvider {
  readonly kind = 'disabled' as const;
  readonly enabled = false;

  async translate(): Promise<string> {
    throw new TranslationError('disabled', 'Translation provider is not configured');
  }
}

/** Azure Translator-compatible adapter. It receives the minimal request object above only. */
export class AzureTranslationProvider implements TranslationProvider {
  readonly kind = 'azure' as const;
  readonly enabled = true;

  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async translate(request: TranslationRequest): Promise<string> {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSLATION_REQUEST_TIMEOUT_MS);
    try {
      response = await this.fetchImpl(
        `${this.endpoint}/translate?api-version=3.0&to=${encodeURIComponent(request.targetLocale)}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.apiKey,
          },
          signal: controller.signal,
          // No author, guild, channel, message URL, attachment, embed, or history is sent.
          body: JSON.stringify([{ Text: request.text }]),
        },
      );
    } catch {
      throw new TranslationError('transient', 'Translation provider request failed');
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 429 || response.status >= 500)
      throw new TranslationError('transient', 'Translation provider is temporarily unavailable');
    if (!response.ok)
      throw new TranslationError('permanent', 'Translation provider rejected the request');
    try {
      const body = (await response.json()) as Array<{ translations?: Array<{ text?: unknown }> }>;
      const text = body[0]?.translations?.[0]?.text;
      if (typeof text !== 'string' || text.trim() === '')
        throw new TranslationError('permanent', 'Translation provider returned no text');
      return text;
    } catch (err) {
      if (err instanceof TranslationError) throw err;
      throw new TranslationError('permanent', 'Translation provider returned an invalid response');
    }
  }
}

export function createTranslationProvider(config: TranslationProviderConfig): TranslationProvider {
  if (config.kind !== 'azure' || !config.endpoint || !config.apiKey)
    return new DisabledTranslationProvider();
  return new AzureTranslationProvider(config.endpoint, config.apiKey);
}
