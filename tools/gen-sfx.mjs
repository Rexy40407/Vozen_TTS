// tools/gen-sfx.mjs
//
// Generates the soundboard clips (/sound) as SYNTHETIC tones — no third-party rights
// (CC0 by own authorship). Output: WAV PCM 22050 Hz / mono / 16-bit in assets/sfx/.
// The keys must match src/content/sounds.ts (the test tests/sounds.test.ts fails
// if any registered clip has no file). Run:  node tools/gen-sfx.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets', 'sfx');
const SR = 22050; // sample rate (same as Piper — safe in the pipeline)
const TAU = Math.PI * 2;

// ── oscillators (continuous phase to avoid clicks) ────────────────────────────────
const sine = (ph) => Math.sin(ph);
const square = (ph) => (Math.sin(ph) >= 0 ? 1 : -1);
const saw = (ph) => {
  const t = (ph / TAU) % 1;
  return 2 * t - 1;
};

/** Note: oscillator `osc` at frequency `freq` with exponential decay `tau` (s). */
function note(seconds, freq, osc = sine, tau = 0.25, gain = 0.6) {
  let ph = 0;
  const dphBase = (TAU * freq) / SR;
  const n = Math.floor(seconds * SR);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = osc(ph) * Math.exp(-(i / SR) / tau) * gain;
    ph += dphBase;
  }
  return out;
}

/** Tone with a linear glissando from f0->f1 (for the trombone "womp"). */
function glide(seconds, f0, f1, osc = saw, gain = 0.5) {
  const n = Math.floor(seconds * SR);
  const out = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 + (f1 - f0) * (i / n);
    ph += (TAU * f) / SR;
    out[i] = osc(ph) * gain;
  }
  return out;
}

const silence = (seconds) => new Float64Array(Math.floor(seconds * SR));

// Deterministic PRNG (mulberry32): REPRODUCIBLE noise — gen-sfx must always produce the
// same WAV (Math.random would make the generation non-deterministic).
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** White noise (fixed seed -> deterministic). Base for whoosh/percussion. */
function noise(seconds, gain = 0.5, seed = 1) {
  const n = Math.floor(seconds * SR);
  const rng = mulberry32(seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = (rng() * 2 - 1) * gain;
  return out;
}
/** 1-pole low-pass: smooths the noise (hiss -> "whoosh"/"sh"). */
function lowpass(buf, alpha = 0.05) {
  const out = new Float64Array(buf.length);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += alpha * (buf[i] - y);
    out[i] = y;
  }
  return out;
}
/** Half-wave envelope (rises and falls) — swells like the whoosh. */
function swell(buf) {
  const n = buf.length;
  for (let i = 0; i < n; i++) buf[i] *= Math.sin((Math.PI * i) / n);
  return buf;
}

/** Concatenates several Float64Array. */
function concat(parts) {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Float64Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Sums (mixes) arrays aligned at the start; length = the longest. */
function mix(parts) {
  const total = Math.max(...parts.map((p) => p.length));
  const out = new Float64Array(total);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}

/** Short fade-in/out (ms) anti-click at the edges. */
function fade(buf, ms = 5) {
  const k = Math.min(Math.floor((ms / 1000) * SR), Math.floor(buf.length / 2));
  for (let i = 0; i < k; i++) {
    const g = i / k;
    buf[i] *= g;
    buf[buf.length - 1 - i] *= g;
  }
  return buf;
}

/** Normalizes to a target peak (avoids clipping while keeping audible volume). */
function normalize(buf, peak = 0.85) {
  let max = 0;
  for (const s of buf) max = Math.max(max, Math.abs(s));
  if (max === 0) return buf;
  const g = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

/** Float [-1,1] -> WAV PCM 16-bit mono. */
function toWav(buf) {
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    data.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// ── the clips (keys == src/content/sounds.ts) ───────────────────────────────────
const honk = (secs, f) =>
  mix([note(secs, f, saw, secs, 0.5), note(secs, f * 1.01, saw, secs, 0.25)]);

const CLIPS = {
  // Two rich sawtooth honks.
  airhorn: () => concat([fade(honk(0.4, 300)), silence(0.06), fade(honk(0.55, 300))]),
  // Bell: fundamental + harmonic, long decay.
  ding: () => fade(mix([note(0.7, 1180, sine, 0.28, 0.6), note(0.7, 2360, sine, 0.18, 0.2)])),
  // Wrong-answer buzzer: low, harsh square.
  buzzer: () => fade(note(0.6, 140, square, 0.6, 0.5)),
  // Ta-da!: fast C5-E5-G5 arpeggio + sustained C6.
  tada: () =>
    concat([
      fade(note(0.1, 523.25, sine, 0.12, 0.5)),
      fade(note(0.1, 659.25, sine, 0.12, 0.5)),
      fade(note(0.1, 783.99, sine, 0.12, 0.5)),
      fade(mix([note(0.6, 1046.5, sine, 0.5, 0.5), note(0.6, 1568, sine, 0.4, 0.2)])),
    ]),
  // Sad trombone "womp womp womp womp": 4 descending notes, glissando on the last.
  'sad-trombone': () =>
    concat([
      fade(glide(0.32, 233, 220, saw, 0.5)),
      silence(0.05),
      fade(glide(0.32, 208, 196, saw, 0.5)),
      silence(0.05),
      fade(glide(0.32, 185, 175, saw, 0.5)),
      silence(0.05),
      fade(glide(0.7, 175, 120, saw, 0.5)),
    ]),
  // Simple beep.
  beep: () => fade(note(0.22, 800, sine, 0.5, 0.6)),
  // Platformer-style coin: short B5 -> sustained E6.
  coin: () =>
    concat([
      fade(note(0.07, 987.77, sine, 0.08, 0.5), 3),
      fade(note(0.5, 1318.51, sine, 0.35, 0.5)),
    ]),
  // Pop: blip with a fast pitch drop.
  pop: () => fade(glide(0.08, 1400, 400, sine, 0.7), 3),
  // Laser "pew": descending square glissando.
  laser: () => fade(glide(0.4, 2000, 180, square, 0.4)),
  // Success: ascending run C5-D5-E5-G5 + sustained C6 (level-up).
  success: () =>
    concat([
      fade(note(0.08, 523.25, sine, 0.1, 0.5), 3),
      fade(note(0.08, 587.33, sine, 0.1, 0.5), 3),
      fade(note(0.08, 659.25, sine, 0.1, 0.5), 3),
      fade(note(0.08, 783.99, sine, 0.1, 0.5), 3),
      fade(mix([note(0.5, 1046.5, sine, 0.4, 0.5), note(0.5, 1568, sine, 0.3, 0.15)])),
    ]),
  // Error "uh-oh": two descending low square notes.
  error: () =>
    concat([
      fade(note(0.22, 196, square, 0.25, 0.45)),
      silence(0.05),
      fade(note(0.4, 155.56, square, 0.4, 0.45)),
    ]),
  // Boing: spring — rises and falls back down (saw glissando).
  boing: () =>
    concat([fade(glide(0.12, 180, 520, saw, 0.5), 3), fade(glide(0.4, 520, 150, saw, 0.5))]),
  // Sparkle: magical shimmer — 4 fast high notes + the last one ringing out.
  sparkle: () =>
    concat([
      fade(note(0.08, 1046.5, sine, 0.1, 0.4), 3),
      fade(note(0.08, 1318.51, sine, 0.1, 0.4), 3),
      fade(note(0.08, 1567.98, sine, 0.1, 0.4), 3),
      fade(note(0.45, 2093, sine, 0.35, 0.4)),
    ]),
  // Whoosh: low-pass noise with a swell envelope.
  whoosh: () => fade(swell(lowpass(noise(0.45, 0.9, 7), 0.06))),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [key, make] of Object.entries(CLIPS)) {
  const wav = toWav(normalize(make()));
  const path = join(OUT_DIR, `${key}.wav`);
  writeFileSync(path, wav);
  console.log(`wrote ${key}.wav (${(wav.length / 1024).toFixed(1)} KiB)`);
}
console.log('done.');
