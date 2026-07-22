// src/tts/wavConcat.ts — P14.4a
//
// Concatena WAVs PCM (formato Piper: 22050 Hz, mono, 16-bit) num unico WAV,
// com padding de silencio entre segmentos. PURO: opera so sobre Buffers.

/** Formato canonico exigido (Piper). */
const REQUIRED_SAMPLE_RATE = 22050;
const REQUIRED_CHANNELS = 1;
const REQUIRED_BITS = 16;
const BLOCK_ALIGN = (REQUIRED_CHANNELS * REQUIRED_BITS) / 8; // 2
const BYTE_RATE = REQUIRED_SAMPLE_RATE * BLOCK_ALIGN; // 44100

/** Silencio default entre segmentos (ms). Pequeno anti-clique. */
const DEFAULT_SILENCE_MS = 60;

interface ParsedWav {
  sampleRate: number;
  channels: number;
  bits: number;
  audioFormat: number;
  data: Buffer;
}

/**
 * Faz o parse de um WAV RIFF localizando os chunks `fmt ` e `data` por ID
 * (walker de chunks — NAO assume offset fixo 44, para tolerar chunks extra como
 * `fact`/`LIST` antes do `data`). Respeita o pad de alinhamento a palavra
 * (chunks de tamanho impar levam 1 byte de padding).
 */
export function parseWav(wav: Buffer, index: number): ParsedWav {
  const where = `WAV #${index + 1}`;
  if (wav.length < 12) {
    throw new Error(`${where}: buffer is too small to be a WAV file`);
  }
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${where}: not a valid RIFF/WAVE file`);
  }

  let fmt: {
    sampleRate: number;
    channels: number;
    bits: number;
    audioFormat: number;
  } | null = null;
  let data: Buffer | null = null;

  // Percorre os chunks a partir do offset 12 (logo apos "WAVE").
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (body + size > wav.length) {
      // Chunk anuncia mais bytes do que existem — WAV truncado/corrompido.
      throw new Error(`${where}: chunk '${id}' exceeds the buffer length`);
    }
    if (id === 'fmt ') {
      fmt = {
        audioFormat: wav.readUInt16LE(body + 0),
        channels: wav.readUInt16LE(body + 2),
        sampleRate: wav.readUInt32LE(body + 4),
        bits: wav.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = wav.subarray(body, body + size);
    }
    // Avanca: 8 (cabecalho do chunk) + size + pad de alinhamento (impar -> +1).
    offset = body + size + (size % 2);
  }

  if (!fmt) throw new Error(`${where}: missing 'fmt ' chunk`);
  if (!data) throw new Error(`${where}: missing 'data' chunk`);

  return { ...fmt, data };
}

/** Valida que um WAV parseado bate o formato canonico Piper (senao lanca). */
function validateFormat(w: ParsedWav, index: number): void {
  const where = `WAV #${index + 1}`;
  if (w.audioFormat !== 1) {
    throw new Error(`${where}: unsupported audioFormat ${w.audioFormat} (expected PCM=1)`);
  }
  if (w.sampleRate !== REQUIRED_SAMPLE_RATE) {
    throw new Error(
      `${where}: sample rate ${w.sampleRate} nao suportado (esperado ${REQUIRED_SAMPLE_RATE} Hz)`,
    );
  }
  if (w.channels !== REQUIRED_CHANNELS) {
    throw new Error(`${where}: unsupported channel count ${w.channels} (expected mono=1)`);
  }
  if (w.bits !== REQUIRED_BITS) {
    throw new Error(`${where}: unsupported ${w.bits}-bit audio (expected 16-bit)`);
  }
}

/** Constroi um WAV canonico (header 44 bytes) a partir dos dados PCM combinados. */
export function buildWav(data: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4); // ChunkSize
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20); // AudioFormat = PCM
  header.writeUInt16LE(REQUIRED_CHANNELS, 22);
  header.writeUInt32LE(REQUIRED_SAMPLE_RATE, 24);
  header.writeUInt32LE(BYTE_RATE, 28);
  header.writeUInt16LE(BLOCK_ALIGN, 32);
  header.writeUInt16LE(REQUIRED_BITS, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40); // Subchunk2Size
  return Buffer.concat([header, data]);
}

/**
 * Constroi um WAV canonico (22050/mono/16-bit) contendo APENAS silencio (zeros) de
 * `ms` milissegundos. PURO. Reutiliza `buildWav` e as constantes de formato Piper,
 * por isso o header e byte-a-byte compativel com os WAVs do PiperEngine (e passa no
 * validateFormat do concatWavs). Serve para PREPENDER silencio a uma fala:
 * `concatWavs([silenceWav(ms), realWav], { silenceMs: 0 })`. `ms<=0` -> data vazia.
 */
export function silenceWav(ms: number): Buffer {
  const samples = Math.max(0, Math.round((ms / 1000) * REQUIRED_SAMPLE_RATE));
  return buildWav(Buffer.alloc(samples * BLOCK_ALIGN)); // zeros
}

/**
 * Concatena varios WAVs PCM (22050/mono/16-bit) num unico WAV, com um bloco de
 * silencio (zeros) entre cada par de segmentos (N-1 gaps: nem leading nem
 * trailing). Valida o formato de todos os inputs; reconstroi o header com os
 * tamanhos RIFF/data corretos. PURO.
 *
 * @throws se o array for vazio, se algum buffer nao for WAV valido, ou se o
 *         formato nao for exatamente 22050 Hz / mono / 16-bit PCM.
 */
export function concatWavs(wavs: Buffer[], opts: { silenceMs?: number } = {}): Buffer {
  if (wavs.length === 0) {
    throw new Error('concatWavs: at least one WAV is required (received an empty array)');
  }

  const parsed = wavs.map((w, i) => {
    const p = parseWav(w, i);
    validateFormat(p, i);
    return p;
  });

  const silenceMs = opts.silenceMs ?? DEFAULT_SILENCE_MS;
  const silenceSamples = Math.max(0, Math.round((silenceMs / 1000) * REQUIRED_SAMPLE_RATE));
  const silence = Buffer.alloc(silenceSamples * BLOCK_ALIGN); // zeros

  const parts: Buffer[] = [];
  for (let i = 0; i < parsed.length; i++) {
    if (i > 0 && silence.length > 0) parts.push(silence);
    parts.push(parsed[i].data);
  }

  return buildWav(Buffer.concat(parts));
}
