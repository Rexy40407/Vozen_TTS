// src/tts/gcloud.ts — PREMIUM TTS engine via the OFFICIAL Google Cloud Text-to-Speech
// API (STANDARD tier). It is the "Google HD" of /voice set, exclusive to anyone with
// Vozen Plus or server Premium (gated in resolveUserEngine + gcloudUsage). Value vs the
// free gTTS: stable official API (without the 429s/blocks of the unofficial endpoint),
// voice gender choice, and consistent latency/reliability.
//
// Format: we request LINEAR16 at 22050Hz mono — the SAME as Piper/gTTS — so the
// audioContent (base64) is already a ready WAV that fits frictionlessly into the pipeline
// (cache, leadSilenceMs, player, silence concat).
//
// Economics: $4/1M chars, with a permanent free tier of 4M chars/month. The cost limits
// (monthly allowances per person/pass) live in Phase 3 (gcloudUsage) — this engine only
// synthesizes; the counting happens here at the chokepoint in Phase 3.
//
// WITHOUT GOOGLE_TTS_API_KEY, this engine is NOT even built: the factory makes the
// 'gcloud' path be gTTS itself (identity), so choosing Google HD behaves like the default.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { rmDirSafe } from './cleanupDir';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SynthRequest, TTSEngine } from './engine';
import { AudioCache, cacheKey } from './cache';
import { concatWavs, silenceWav } from './wavConcat';
import { lowerAllCapsRuns } from './deCaps';
import { dayKeyUTC, monthKeyUTC, type UsageScope } from '../store/gcloudUsage';
import type { OperationalMetric, ProviderHealth } from '../store/operationalMetrics';
import { metrics } from '../metrics';
import { log } from '../logging/logger';

const GCLOUD_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const GCLOUD_TIMEOUT_MS = 15000;
/** Sample rate requested from Google — same as the rest of the pipeline (Piper/gTTS = 22050). */
const GCLOUD_SAMPLE_RATE = 22050;

/**
 * BCP-47 `languageCode` from a Piper model id. The ids are `lang_REGION-voice-quality`
 * (e.g. 'pt_PT-tuga-medium', 'en_US-amy-medium'); the locale is the 1st token before the
 * '-', and swapping the '_' for '-' gives exactly BCP-47 ('pt_PT' -> 'pt-PT', 'en_US' ->
 * 'en-US'). Without a recognizable locale -> 'en-US' (safe fallback). Google picks the
 * default Standard voice for that language (we do not pass `voice.name`). PURE and
 * deterministic.
 */
export function bcp47OfModel(model: string): string {
  const locale = model.split('-')[0]; // 'pt_PT-tuga-medium' -> 'pt_PT'
  if (!locale || !/^[a-z]{2,3}_[A-Za-z]{2,}$/.test(locale)) return 'en-US';
  return locale.replace('_', '-');
}

/** Persistent monthly counters (implemented by store/gcloudUsage over SQLite). */
export interface GcloudUsage {
  reserve(
    scope: UsageScope,
    key: string,
    month: string,
    monthlyLimit: number,
    day: string,
    dailyLimit: number,
    chars: number,
  ): boolean;
  refund(
    scope: UsageScope,
    key: string,
    month: string,
    day: string,
    dailyLimit: number,
    chars: number,
  ): void;
  record?(metric: OperationalMetric, value?: number): void;
  setHealth?(health: ProviderHealth): void;
}

/** Google HD cost ceilings (come from config). See AppConfig.gcloud*. */
export interface GcloudLimits {
  maxChars: number; // request above this -> gTTS
  plusMonthly: number; // personal Plus pool
  pass3Monthly: number; // 3-server pass pool
  pass8Monthly: number; // 8-server pass pool
  dailyBudget: number; // GLOBAL/day in-memory backstop (0 = disabled)
}

export interface GCloudOptions {
  /** injectable fetch (tests). Default: the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** persistent monthly counters; absent => no counting (e.g. Phase 1 / tests). */
  usage?: GcloudUsage;
  /** cost ceilings; absent => NO enforcement (behaves like Phase 1). */
  limits?: GcloudLimits;
  /** injectable clock (deterministic month/day tests). Default Date.now. */
  now?: () => number;
}

/** BUDGET error: signals the RouterEngine that wraps the engine to fall back to gTTS. */
class GcloudBudgetError extends Error {}

/**
 * Google Cloud TTS Standard engine. Implements the SAME TTSEngine interface and shares
 * the cache by cacheKey (its own 'gcloud' namespace — see factory). An HTTP error /
 * invalid response / exhausted BUDGET THROWS, so the RouterEngine that wraps it falls back
 * to gTTS (nobody is left without a voice). It is the cost CHOKEPOINT: it counts the chars
 * ONLY on the real call to Google (cache-miss), so the count is exact and covers ALL call
 * sites (all pass through here via deps.engine -> PerUserEngineRouter -> this engine).
 */
export class GCloudEngine implements TTSEngine {
  private readonly apiKey: string;
  private readonly cache: AudioCache;
  private readonly fetchImpl: typeof fetch;
  private readonly usage?: GcloudUsage;
  private readonly limits?: GcloudLimits;
  private readonly now: () => number;
  // Anti-spam for the denial log: an exhausted pool would deny EVERY message — logging them
  // all floods the log. Warn AT MOST once per (day, pool). Cleared when the UTC day changes.
  private warnedDenials = new Set<string>();
  private warnedDay = '';

  constructor(apiKey: string, cache: AudioCache, opts: GCloudOptions = {}) {
    this.apiKey = apiKey;
    this.cache = cache;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.usage = opts.usage;
    this.limits = opts.limits;
    this.now = opts.now ?? Date.now;
  }

  /** Monthly ceiling of the descriptor's pool (the engine owns the price table; see config). */
  private limitFor(budget: NonNullable<SynthRequest['gcloudBudget']>): number {
    const L = this.limits!;
    if (budget.scope === 'user') return L.plusMonthly;
    if (budget.scope === 'pass') return (budget.seats ?? 8) <= 3 ? L.pass3Monthly : L.pass8Monthly;
    return L.pass3Monthly; // 'guild' (direct Premium without pass): uses the 3-server tier
  }

  /**
   * Decides whether THIS request can go to Google. Throws GcloudBudgetError (-> gTTS) when:
   * there is no budget (fail-safe: a non-gated path never spends $), the text exceeds
   * maxChars, the monthly pool is exhausted, or the daily backstop blows. Without `limits`,
   * it is a no-op (Phase 1).
   */
  private enforceBudget(req: SynthRequest, chars: number): void {
    if (!this.limits) return; // no ceilings configured => Phase 1 behavior (no gate)
    const budget = req.gcloudBudget;
    if (!budget) {
      this.deny('gcloud request without a budget (fail-safe)');
    }
    if (chars > this.limits.maxChars) {
      this.deny(`text ${chars} chars > max ${this.limits.maxChars}`);
    }
  }

  /**
   * Records the fallback (metric) and throws the budget error (-> gTTS). The `throttleKey`
   * (when given) limits the WARN to once per day per pool — a recurring denial (exhausted
   * pool) does not spam the log. Without `throttleKey` (e.g. fail-safe without budget = a
   * sign of a bug), it always warns.
   */
  private deny(reason: string, throttleKey?: string): never {
    metrics.inc('gcloudFallbacks');
    this.usage?.record?.('synth_fallback');
    this.usage?.setHealth?.('degraded');
    let shouldWarn = true;
    if (throttleKey) {
      const d = new Date(this.now());
      const dayKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      if (this.warnedDay !== dayKey) {
        this.warnedDenials.clear();
        this.warnedDay = dayKey;
      }
      shouldWarn = !this.warnedDenials.has(throttleKey);
      if (shouldWarn) this.warnedDenials.add(throttleKey);
    }
    if (shouldWarn) log.warn(`[gcloud] request denied; falling back to gTTS: ${reason}`);
    throw new GcloudBudgetError(reason);
  }

  /**
   * Reserves the consumption BEFORE the real call (cache-miss). Debiting now — instead of
   * after the `await` — closes the check-then-act race: two concurrent syntheses from the
   * SAME pool (a pass covers several guilds) would both see the old total and both pass the
   * ceiling.
   */
  private reserveUsage(req: SynthRequest, chars: number): boolean {
    if (!this.limits || !req.gcloudBudget || !this.usage) return true;
    const now = this.now();
    return this.usage.reserve(
      req.gcloudBudget.scope,
      req.gcloudBudget.key,
      monthKeyUTC(now),
      this.limitFor(req.gcloudBudget),
      dayKeyUTC(now),
      this.limits.dailyBudget,
      chars,
    );
  }

  /** Returns the reservation when synthesis fails (a failed call does not spend budget). */
  private refundUsage(req: SynthRequest, chars: number): void {
    if (!this.limits || !req.gcloudBudget || !this.usage) return;
    const now = this.now();
    this.usage.refund(
      req.gcloudBudget.scope,
      req.gcloudBudget.key,
      monthKeyUTC(now),
      dayKeyUTC(now),
      this.limits.dailyBudget,
      chars,
    );
  }

  async synth(req: SynthRequest): Promise<string> {
    const key = cacheKey(req);
    const cached = this.cache.get(key);
    if (cached) return cached; // cache-hit: NO call to Google (no cost, no counting)

    // Cache-miss => there will be a real call. Apply the ceilings BEFORE spending $.
    const chars = req.text.length;
    this.enforceBudget(req, chars);
    // Reserve the consumption BEFORE the await (closes the check-then-act race — see reserveUsage).
    if (!this.reserveUsage(req, chars)) {
      this.deny(
        'monthly pool or global daily backstop exhausted',
        `pool:${req.gcloudBudget!.scope}:${req.gcloudBudget!.key}`,
      );
    }

    let wav: Buffer;
    const providerStartedAt = process.hrtime.bigint();
    try {
      wav = await this.fetchSpeech(req);
    } catch (err) {
      this.refundUsage(req, chars); // failed synthesis -> return the reservation
      this.usage?.record?.('synth_failure');
      this.usage?.setHealth?.('degraded');
      throw err;
    }
    // Success -> record the real-cost metrics.
    metrics.inc('gcloudSynths');
    metrics.add('gcloudChars', chars);
    this.usage?.record?.('synth_success');
    this.usage?.record?.('provider_charged_chars', chars);
    this.usage?.record?.(
      'synth_latency_ms',
      Number(process.hrtime.bigint() - providerStartedAt) / 1e6,
    );
    this.usage?.setHealth?.('healthy');
    // Lead silence (same semantics as Piper/gTTS): PREPENDED to the WAV.
    if (req.leadSilenceMs && req.leadSilenceMs > 0) {
      wav = concatWavs([silenceWav(req.leadSilenceMs), wav], { silenceMs: 0 });
    }

    const workDir = mkdtempSync(join(tmpdir(), 'gcloud-'));
    const outPath = join(workDir, 'out.wav');
    try {
      writeFileSync(outPath, wav);
      return this.cache.put(key, outPath);
    } finally {
      rmDirSafe(workDir);
    }
  }

  private async fetchSpeech(req: SynthRequest): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GCLOUD_TIMEOUT_MS);

    let res: Response;
    try {
      res = await this.fetchImpl(GCLOUD_TTS_URL, {
        method: 'POST',
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // lowerAllCapsRuns: prevents an ALL-CAPS "shout" from coming out spelled letter
          // by letter (same problem as gTTS/Kokoro/Neural — the transform lives in deCaps.ts).
          input: { text: lowerAllCapsRuns(req.text) },
          voice: { languageCode: bcp47OfModel(req.model) },
          audioConfig: {
            audioEncoding: 'LINEAR16',
            sampleRateHertz: GCLOUD_SAMPLE_RATE,
            // speakingRate: the user's speed (Google accepts 0.25–4.0); 1 = natural.
            ...(req.speed > 0 && Math.abs(req.speed - 1) > 1e-6
              ? { speakingRate: Math.min(4, Math.max(0.25, req.speed)) }
              : {}),
          },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const reason =
        (err as Error)?.name === 'AbortError'
          ? `timeout (${GCLOUD_TIMEOUT_MS}ms)`
          : (err as Error).message;
      throw new Error(`Network failure while contacting the Google Cloud TTS API: ${reason}`, {
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Google Cloud TTS API returned ${res.status} ${res.statusText}${detail ? `: ${detail.trim()}` : ''}`,
      );
    }

    const data = (await res.json().catch(() => ({}))) as { audioContent?: string };
    if (!data.audioContent) {
      throw new Error('Google Cloud TTS API response did not contain audioContent');
    }
    const buf = Buffer.from(data.audioContent, 'base64');
    if (buf.length === 0) {
      throw new Error('Google Cloud TTS API returned empty audioContent');
    }
    return buf;
  }
}
