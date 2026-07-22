// tests/wavConcat.test.ts — P14.4a
import { describe, it, expect } from 'vitest';
import { concatWavs, silenceWav } from '../src/tts/wavConcat';

// Formato canonico Piper: PCM 22050 Hz, mono, 16-bit.
const SAMPLE_RATE = 22050;
const CHANNELS = 1;
const BITS = 16;
const BLOCK_ALIGN = (CHANNELS * BITS) / 8; // 2
const BYTE_RATE = SAMPLE_RATE * BLOCK_ALIGN; // 44100

/**
 * Constroi um WAV PCM canonico (header 44 bytes) a partir de bytes de dados.
 * Usado para gerar entradas conhecidas nos testes.
 */
function makeWav(
  data: Buffer,
  opts: { sampleRate?: number; channels?: number; bits?: number; audioFormat?: number } = {},
): Buffer {
  const sampleRate = opts.sampleRate ?? SAMPLE_RATE;
  const channels = opts.channels ?? CHANNELS;
  const bits = opts.bits ?? BITS;
  const audioFormat = opts.audioFormat ?? 1;
  const blockAlign = (channels * bits) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(audioFormat, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Le os campos do header de um WAV canonico (data em offset 44). */
function readHeader(wav: Buffer) {
  return {
    riff: wav.toString('ascii', 0, 4),
    chunkSize: wav.readUInt32LE(4),
    wave: wav.toString('ascii', 8, 12),
    fmt: wav.toString('ascii', 12, 16),
    subchunk1Size: wav.readUInt32LE(16),
    audioFormat: wav.readUInt16LE(20),
    channels: wav.readUInt16LE(22),
    sampleRate: wav.readUInt32LE(24),
    byteRate: wav.readUInt32LE(28),
    blockAlign: wav.readUInt16LE(32),
    bits: wav.readUInt16LE(34),
    dataId: wav.toString('ascii', 36, 40),
    dataSize: wav.readUInt32LE(40),
  };
}

describe('concatWavs — matematica do header', () => {
  it('2 WAVs sem silencio -> dados = soma; header (ChunkSize/Subchunk2Size/etc.) correto', () => {
    const a = makeWav(Buffer.from([1, 2, 3, 4])); // 4 bytes = 2 amostras
    const b = makeWav(Buffer.from([5, 6, 7, 8, 9, 10])); // 6 bytes = 3 amostras
    const out = concatWavs([a, b], { silenceMs: 0 });
    const h = readHeader(out);

    expect(h.riff).toBe('RIFF');
    expect(h.wave).toBe('WAVE');
    expect(h.fmt).toBe('fmt ');
    expect(h.dataId).toBe('data');
    expect(h.subchunk1Size).toBe(16);
    expect(h.audioFormat).toBe(1);
    expect(h.channels).toBe(CHANNELS);
    expect(h.sampleRate).toBe(SAMPLE_RATE);
    expect(h.bits).toBe(BITS);
    expect(h.blockAlign).toBe(BLOCK_ALIGN);
    expect(h.byteRate).toBe(BYTE_RATE);

    // Sem silencio: dados combinados = 4 + 6 = 10 bytes.
    expect(h.dataSize).toBe(10);
    expect(h.chunkSize).toBe(36 + 10);
    // O buffer total = 44 (header) + 10 (dados).
    expect(out.length).toBe(44 + 10);
    // Os bytes de dados sao exatamente A seguido de B.
    expect(out.subarray(44)).toEqual(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  });

  it('silenceMs adiciona zeros SO no gap entre segmentos (N-1 gaps), nem leading nem trailing', () => {
    const a = makeWav(Buffer.from([1, 2, 3, 4]));
    const b = makeWav(Buffer.from([5, 6, 7, 8]));
    const silenceMs = 60;
    const out = concatWavs([a, b], { silenceMs });
    const h = readHeader(out);

    const silenceSamples = Math.round((silenceMs / 1000) * SAMPLE_RATE);
    const silenceBytes = silenceSamples * BLOCK_ALIGN;

    // dados = A + silencio + B (um so gap para 2 segmentos).
    expect(h.dataSize).toBe(4 + silenceBytes + 4);
    expect(h.chunkSize).toBe(36 + h.dataSize);

    const body = out.subarray(44);
    // Comeca com A (sem silencio leading).
    expect(body.subarray(0, 4)).toEqual(Buffer.from([1, 2, 3, 4]));
    // Termina com B (sem silencio trailing).
    expect(body.subarray(body.length - 4)).toEqual(Buffer.from([5, 6, 7, 8]));
    // O miolo (o gap) e todo zeros.
    const gap = body.subarray(4, 4 + silenceBytes);
    expect(gap.length).toBe(silenceBytes);
    expect(gap.every((byte) => byte === 0)).toBe(true);
  });

  it('duracao = soma das duracoes + silencio (via contagem de amostras)', () => {
    // 2205 amostras cada (0.1s @ 22050) -> 4410 bytes cada.
    const a = makeWav(Buffer.alloc(2205 * BLOCK_ALIGN, 7));
    const b = makeWav(Buffer.alloc(2205 * BLOCK_ALIGN, 9));
    const silenceMs = 100; // 2205 amostras
    const out = concatWavs([a, b], { silenceMs });
    const h = readHeader(out);
    const totalSamples = h.dataSize / BLOCK_ALIGN;
    // 2205 + 2205 (silencio) + 2205 = 6615 amostras.
    expect(totalSamples).toBe(2205 + 2205 + 2205);
    const durationSec = totalSamples / SAMPLE_RATE;
    expect(durationSec).toBeCloseTo(0.3, 5);
  });

  it('tres WAVs -> exatamente 2 gaps de silencio', () => {
    const a = makeWav(Buffer.from([1, 1]));
    const b = makeWav(Buffer.from([2, 2]));
    const c = makeWav(Buffer.from([3, 3]));
    const silenceMs = 10;
    const silenceBytes = Math.round((silenceMs / 1000) * SAMPLE_RATE) * BLOCK_ALIGN;
    const out = concatWavs([a, b, c], { silenceMs });
    const h = readHeader(out);
    expect(h.dataSize).toBe(2 + silenceBytes + 2 + silenceBytes + 2);
  });

  it('1 unico WAV -> devolve equivalente byte-a-byte (nenhum gap, sem silencio)', () => {
    const a = makeWav(Buffer.from([10, 20, 30, 40]));
    const out = concatWavs([a], { silenceMs: 60 });
    // 1 segmento -> 0 gaps -> identico ao input (mesmos dados e header canonico).
    expect(out).toEqual(a);
  });

  it('default silenceMs (opts ausente) nao crasha e produz WAV valido', () => {
    const a = makeWav(Buffer.from([1, 2]));
    const b = makeWav(Buffer.from([3, 4]));
    const out = concatWavs([a, b]);
    const h = readHeader(out);
    expect(h.riff).toBe('RIFF');
    // dataSize >= soma dos dados de entrada (4 bytes) + eventual silencio default.
    expect(h.dataSize).toBeGreaterThanOrEqual(4);
    expect(h.chunkSize).toBe(36 + h.dataSize);
  });

  it('parseia data corretamente mesmo com um chunk LIST antes do data (offset nao-canonico)', () => {
    // WAV com um chunk 'LIST' de 4 bytes entre 'fmt ' e 'data'. Um parser de
    // offset fixo (44) corromperia; o walker por-ID tem de encontrar o data certo.
    const data = Buffer.from([9, 8, 7, 6]);
    const listPayload = Buffer.from([0, 0, 0, 0]);
    const fmt = Buffer.alloc(24);
    fmt.write('fmt ', 0, 'ascii');
    fmt.writeUInt32LE(16, 4);
    fmt.writeUInt16LE(1, 8); // audioFormat
    fmt.writeUInt16LE(CHANNELS, 10);
    fmt.writeUInt32LE(SAMPLE_RATE, 12);
    fmt.writeUInt32LE(BYTE_RATE, 16);
    fmt.writeUInt16LE(BLOCK_ALIGN, 20);
    fmt.writeUInt16LE(BITS, 22);
    const list = Buffer.alloc(8 + listPayload.length);
    list.write('LIST', 0, 'ascii');
    list.writeUInt32LE(listPayload.length, 4);
    listPayload.copy(list, 8);
    const dataChunk = Buffer.alloc(8 + data.length);
    dataChunk.write('data', 0, 'ascii');
    dataChunk.writeUInt32LE(data.length, 4);
    data.copy(dataChunk, 8);
    const body = Buffer.concat([fmt, list, dataChunk]);
    const riff = Buffer.alloc(12);
    riff.write('RIFF', 0, 'ascii');
    riff.writeUInt32LE(4 + body.length, 4);
    riff.write('WAVE', 8, 'ascii');
    const weird = Buffer.concat([riff, body]);

    const out = concatWavs([weird, weird], { silenceMs: 0 });
    const h = readHeader(out);
    // Deve ter extraido 4 + 4 = 8 bytes de PCM (ignorando o LIST).
    expect(h.dataSize).toBe(8);
    expect(out.subarray(44)).toEqual(Buffer.from([9, 8, 7, 6, 9, 8, 7, 6]));
  });
});

describe('concatWavs — validacao de formato', () => {
  it('sample rate errado (16000) -> lanca erro claro', () => {
    const ok = makeWav(Buffer.from([1, 2]));
    const bad = makeWav(Buffer.from([3, 4]), { sampleRate: 16000 });
    expect(() => concatWavs([ok, bad])).toThrow(/22050|sample.?rate/i);
  });

  it('stereo (2 canais) -> lanca erro claro', () => {
    const ok = makeWav(Buffer.from([1, 2]));
    const bad = makeWav(Buffer.from([3, 4, 5, 6]), { channels: 2 });
    expect(() => concatWavs([ok, bad])).toThrow(/mono|channel|canal/i);
  });

  it('bits != 16 (ex. 8-bit) -> lanca erro claro', () => {
    const ok = makeWav(Buffer.from([1, 2]));
    const bad = makeWav(Buffer.from([3, 4]), { bits: 8 });
    expect(() => concatWavs([ok, bad])).toThrow(/16.?bit|bits/i);
  });

  it('audioFormat != 1 (nao-PCM) -> lanca erro claro', () => {
    const ok = makeWav(Buffer.from([1, 2]));
    const bad = makeWav(Buffer.from([3, 4]), { audioFormat: 3 });
    expect(() => concatWavs([ok, bad])).toThrow(/PCM|format/i);
  });

  it('nao-RIFF (lixo) -> lanca erro claro', () => {
    const garbage = Buffer.from('not a wav file at all here');
    expect(() => concatWavs([garbage])).toThrow(/RIFF|WAV/i);
  });

  it('array vazio -> lanca erro claro', () => {
    expect(() => concatWavs([])).toThrow(/vazio|empty|pelo menos|at least/i);
  });
});

describe('silenceWav — WAV de silencio (zeros) no formato Piper', () => {
  it('2000ms -> data com 2000/1000*22050*2 = 88200 bytes de zeros', () => {
    const ms = 2000;
    const expectedBytes = Math.round((ms / 1000) * SAMPLE_RATE) * BLOCK_ALIGN; // 88200
    const out = silenceWav(ms);
    const h = readHeader(out);

    expect(h.riff).toBe('RIFF');
    expect(h.wave).toBe('WAVE');
    expect(h.dataId).toBe('data');
    expect(h.sampleRate).toBe(SAMPLE_RATE);
    expect(h.channels).toBe(CHANNELS);
    expect(h.bits).toBe(BITS);
    expect(h.dataSize).toBe(expectedBytes);
    expect(expectedBytes).toBe(88200);
    // Todo o corpo e zeros (silencio).
    const body = out.subarray(44);
    expect(body.length).toBe(expectedBytes);
    expect(body.every((byte) => byte === 0)).toBe(true);
  });

  it('e um WAV valido que concatWavs aceita: prepend leading silence', () => {
    const ms = 2000;
    const silenceBytes = Math.round((ms / 1000) * SAMPLE_RATE) * BLOCK_ALIGN; // 88200
    const real = makeWav(Buffer.from([1, 2, 3, 4, 5, 6]));
    // Prepend do silencio ANTES do audio real, sem gaps extra.
    const out = concatWavs([silenceWav(ms), real], { silenceMs: 0 });
    const h = readHeader(out);

    expect(h.dataSize).toBe(silenceBytes + 6);
    const body = out.subarray(44);
    // Os primeiros 88200 bytes sao zeros (o silencio leading).
    expect(body.subarray(0, silenceBytes).every((byte) => byte === 0)).toBe(true);
    // Seguidos exatamente pelo audio real.
    expect(body.subarray(silenceBytes)).toEqual(Buffer.from([1, 2, 3, 4, 5, 6]));
  });

  it('0ms -> data vazia (WAV valido, sem amostras)', () => {
    const out = silenceWav(0);
    const h = readHeader(out);
    expect(h.dataSize).toBe(0);
  });
});
