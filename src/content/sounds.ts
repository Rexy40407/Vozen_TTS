/**
 * Registo CURADO de clips de soundboard para o /sound. PURO/testável — só nomes e
 * chaves, sem fs. O handler (commands/handlers/fun.ts) resolve o caminho absoluto a
 * partir de `soundFilename(key)` e toca o WAV DIRETO via `SynthRequest.assetPath` (sem
 * motor/cache/efeitos) — o MESMO caminho do efeito sonoro do /rizz.
 *
 * Compliance (ver docs/COMPLIANCE-VAGA5.md · Soundboard):
 *  - SÓ clips livres de direitos. Os clips desta vaga são GERADOS por nós
 *    (`tools/gen-sfx.mjs`, tons sintéticos) => sem copyright de terceiros, CC0 por
 *    autoria própria. A proveniência de cada ficheiro fica em `assets/sfx/LICENSES.md`.
 *  - SEM upload de utilizadores nesta vaga (evita UGC/moderação/copyright) — decisão à
 *    parte, com o seu próprio portão.
 *  - Cada clip aqui TEM de ter o .wav correspondente em assets/sfx/ (teste de
 *    integridade em tests/sounds.test.ts) — senão o /sound ofereceria silêncio.
 *  - Choices do Discord limitadas a 25 (garantido pelo teste).
 */

export interface SoundClip {
  /** Chave estável = nome do ficheiro (sem extensão) em assets/sfx/. kebab-ascii. */
  key: string;
  /** Nome amigável mostrado no picker do comando e na lista. */
  name: string;
  /** Emoji opcional para a lista (`/sound` sem argumento). */
  emoji?: string;
}

// Biblioteca inicial: tons sintéticos gerados por tools/gen-sfx.mjs (sem direitos de
// terceiros). Extensível — dropar um WAV CC0 em assets/sfx/, registá-lo aqui e no
// LICENSES.md, e o teste de integridade confirma que batem certo.
export const SOUNDS: SoundClip[] = [
  { key: 'airhorn', name: 'Air horn', emoji: '📢' },
  { key: 'ding', name: 'Ding', emoji: '🔔' },
  { key: 'buzzer', name: 'Wrong buzzer', emoji: '❌' },
  { key: 'tada', name: 'Ta-da!', emoji: '🎉' },
  { key: 'sad-trombone', name: 'Sad trombone', emoji: '🎺' },
  { key: 'beep', name: 'Beep', emoji: '🔊' },
  { key: 'coin', name: 'Coin', emoji: '🪙' },
  { key: 'pop', name: 'Pop', emoji: '🫧' },
  { key: 'laser', name: 'Laser', emoji: '🛸' },
  { key: 'success', name: 'Success', emoji: '✅' },
  { key: 'error', name: 'Error', emoji: '⛔' },
  { key: 'boing', name: 'Boing', emoji: '🪀' },
  { key: 'sparkle', name: 'Sparkle', emoji: '✨' },
  { key: 'whoosh', name: 'Whoosh', emoji: '💨' },
];

const BY_KEY = new Map(SOUNDS.map((s) => [s.key, s] as const));

/** Lookup por chave; `undefined` se a chave não estiver no registo. */
export function soundByKey(key: string): SoundClip | undefined {
  return BY_KEY.get(key);
}

/** Nome do ficheiro do clip em assets/sfx/ (o handler junta com o diretório dos assets). */
export function soundFilename(key: string): string {
  return `${key}.wav`;
}

/** Choices para a definição do slash command (o Discord limita a 25 — ver teste). */
export const SOUND_CHOICES: { name: string; value: string }[] = SOUNDS.map((s) => ({
  name: s.emoji ? `${s.emoji} ${s.name}` : s.name,
  value: s.key,
}));

/** Todas as chaves (para os testes de integridade e a lista). */
export const SOUND_KEYS: string[] = SOUNDS.map((s) => s.key);
