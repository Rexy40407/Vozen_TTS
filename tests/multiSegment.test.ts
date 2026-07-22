// tests/multiSegment.test.ts — P14.4b (wiring do caminho por-segmento atras da flag)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MultiSegmentEngine } from '../src/tts/multiSegment';
import { AudioCache } from '../src/tts/cache';
import type { TTSEngine, SynthRequest } from '../src/tts/engine';

const SAMPLE_RATE = 22050;
const BLOCK_ALIGN = 2;

function makeWav(data: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * BLOCK_ALIGN, 28);
  header.writeUInt16LE(BLOCK_ALIGN, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// Modelos disponiveis: EN + RU. base model (fallback) = de_ (terceira lingua),
// para que a escolha por-segmento seja significativa (nunca cai no fallback por
// acaso quando a deteccao acerta).
const AVAILABLE = ['en_US-amy-medium', 'ru_RU-denis-medium'];

describe('MultiSegmentEngine — flag ON (caminho por-segmento)', () => {
  let dir: string;
  let cache: AudioCache;
  let wroteFiles: string[];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'multiseg-'));
    cache = new AudioCache(dir);
    wroteFiles = [];
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /**
   * base engine falso: escreve um WAV canonico distinto por chamada e devolve o
   * caminho. Captura os requests recebidos para asercoes.
   */
  function makeBase(): { engine: TTSEngine; calls: SynthRequest[] } {
    const calls: SynthRequest[] = [];
    let n = 0;
    const engine: TTSEngine = {
      synth: vi.fn(async (req: SynthRequest) => {
        calls.push({ ...req });
        n += 1;
        const p = join(dir, `seg-${n}.wav`);
        writeFileSync(p, makeWav(Buffer.from([n, n, n, n])));
        wroteFiles.push(p);
        return p;
      }),
    };
    return { engine, calls };
  }

  it('texto bilingue (EN + RU) -> base.synth chamado POR-SEGMENTO com a voz de cada lingua + concatWavs', async () => {
    const { engine: base, calls } = makeBase();
    const eng = new MultiSegmentEngine(base, AVAILABLE, cache);
    const en = 'good morning to all the members of this server i hope you are doing well';
    const ru = 'привет всем участникам этого замечательного сервера сегодня прекрасный день друзья';
    const req: SynthRequest = { text: `${en}. ${ru}`, model: 'de_DE-thorsten-medium', speed: 1 };

    const outPath = eng.synth(req);
    const resolved = await outPath;

    // >=2 chamadas ao base (uma por segmento).
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const models = calls.map((c) => c.model);
    expect(models.some((m) => m.startsWith('en_'))).toBe(true);
    expect(models.some((m) => m.startsWith('ru_'))).toBe(true);
    // speed propagada.
    expect(calls.every((c) => c.speed === 1)).toBe(true);

    // O output e um WAV concatenado valido (header RIFF/WAVE).
    const buf = readFileSync(resolved);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
    // dados combinados = 4 (seg1) + silencio + 4 (seg2) -> > 8 bytes.
    const dataSize = buf.readUInt32LE(40);
    expect(dataSize).toBeGreaterThan(8);
  });

  it('req.singleVoice=true -> delega no base TAL E QUAL mesmo com texto multi-script (nunca parte)', async () => {
    const { engine: base, calls } = makeBase();
    const eng = new MultiSegmentEngine(base, AVAILABLE, cache);
    const en = 'good morning to all the members of this server i hope you are doing well';
    const ru = 'привет всем участникам этого замечательного сервера сегодня прекрасный день друзья';
    // Texto MULTI-SCRIPT (EN + RU) que normalmente SERIA partido, mas singleVoice
    // desliga o split: e a voz deliberadamente escolhida (ex. /voice preview, /joke)
    // que tem de ser honrada verbatim, incl. leadSilenceMs.
    const req: SynthRequest = {
      text: `${en}. ${ru}`,
      model: 'de_DE-thorsten-medium',
      speed: 1,
      singleVoice: true,
      leadSilenceMs: 1000,
    };

    await eng.synth(req);

    // Uma unica chamada ao base, com o req INTACTO (model, texto completo e
    // leadSilenceMs preservados). Nao ha sintese por-segmento.
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe('de_DE-thorsten-medium');
    expect(calls[0].text).toBe(req.text);
    expect(calls[0].leadSilenceMs).toBe(1000);
  });

  it('texto monolingue -> 1 unico segmento -> UMA chamada ao base com o req INTACTO (respeita req.model)', async () => {
    const { engine: base, calls } = makeBase();
    const eng = new MultiSegmentEngine(base, AVAILABLE, cache);
    const req: SynthRequest = {
      text: 'good morning to all the members of this server i hope you are doing very well today',
      model: 'de_DE-thorsten-medium',
      speed: 1,
    };

    await eng.synth(req);

    // Um so segmento -> delega no base tal e qual, SEM re-escolher a voz. Isto
    // preserva a voz que o resolveSynth ja resolveu (ex. voz do user via /voice):
    // o caminho por-segmento so entra quando ha MESMO mais do que uma lingua.
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe('de_DE-thorsten-medium');
    expect(calls[0].text).toBe(req.text);
  });

  it('usa req.model como fallback quando a lingua de um segmento nao tem modelo disponivel', async () => {
    const { engine: base, calls } = makeBase();
    // Sem modelos disponiveis -> os segmentos caem todos no fallback req.model.
    const eng = new MultiSegmentEngine(base, [], cache);
    const en = 'good morning to all the members of this server i hope you are doing well';
    const ru = 'привет всем участникам этого замечательного сервера сегодня прекрасный день друзья';
    const req: SynthRequest = { text: `${en}. ${ru}`, model: 'de_DE-thorsten-medium', speed: 1 };

    await eng.synth(req);

    // >1 segmento -> ha sintese por-segmento, mas sem modelos disponiveis todos
    // os segmentos usam o fallback req.model.
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.every((c) => c.model === 'de_DE-thorsten-medium')).toBe(true);
  });

  it('um segmento que FALHA -> nao crasha: cai no synth single-voice de todo o texto (req.model)', async () => {
    const calls: SynthRequest[] = [];
    let n = 0;
    const base: TTSEngine = {
      synth: vi.fn(async (req: SynthRequest) => {
        calls.push({ ...req });
        // Falha se for uma sintese PARCIAL (segmento) — detetamos pelo facto de o
        // texto ser mais curto que o texto completo. A chamada de fallback
        // (texto completo) tem de passar.
        n += 1;
        if (n === 1) throw new Error('piper boom no segmento');
        const p = join(dir, `ok-${n}.wav`);
        writeFileSync(p, makeWav(Buffer.from([1, 2, 3, 4])));
        return p;
      }),
    };
    const eng = new MultiSegmentEngine(base, AVAILABLE, cache);
    const en = 'good morning to all the members of this server i hope you are doing well';
    const ru = 'привет всем участникам этого замечательного сервера сегодня прекрасный день друзья';
    const req: SynthRequest = { text: `${en}. ${ru}`, model: 'de_DE-thorsten-medium', speed: 1 };

    const resolved = await eng.synth(req);
    const buf = readFileSync(resolved);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    // A ultima chamada (fallback) usou o texto COMPLETO com o req.model.
    const last = calls[calls.length - 1];
    expect(last.text).toBe(req.text);
    expect(last.model).toBe('de_DE-thorsten-medium');
  });
});
