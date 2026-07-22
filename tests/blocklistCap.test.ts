import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initDb } from '../src/store/db';
import { addBlockword, getBlocklist, MAX_BLOCKWORDS } from '../src/store/blocklist';

const G = 'g1';
let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});
function freshDb() {
  dir = mkdtempSync(join(tmpdir(), 'vozen-blk-'));
  return initDb(join(dir, 't.db'));
}

describe('blocklist — cap de palavras (ABUSE hardening)', () => {
  it('aceita ate ao teto e recusa a seguir', () => {
    const db = freshDb();
    // Enche ate ao teto por SQL cru (rapido); a ultima entrada via addBlockword ainda cabe.
    for (let i = 0; i < MAX_BLOCKWORDS - 1; i++) {
      db.prepare('INSERT INTO blocklist (guild_id, word) VALUES (?, ?)').run(G, `w${i}`);
    }
    expect(addBlockword(db, G, 'ultima')).toBe('ok');
    expect(getBlocklist(db, G)).toHaveLength(MAX_BLOCKWORDS);
    // Teto atingido -> a proxima e recusada e a lista nao cresce.
    expect(addBlockword(db, G, 'demais')).toBe('limit');
    expect(getBlocklist(db, G)).toHaveLength(MAX_BLOCKWORDS);
    db.close();
  });

  it('re-adicionar uma palavra existente e no-op (nao duplica)', () => {
    const db = freshDb();
    expect(addBlockword(db, G, 'palavra')).toBe('ok');
    expect(addBlockword(db, G, 'palavra')).toBe('ok'); // ON CONFLICT DO NOTHING
    expect(getBlocklist(db, G)).toEqual(['palavra']);
    db.close();
  });
});
