// scripts/logRotation.mjs — writer de log com rotação a MEIO-do-run (plano 028).
//
// Extraído de start-prod.mjs para ser testável em vitest (RED→GREEN). Antes disto
// a rotação só corria UMA VEZ, no arranque do supervisor; durante o resto da vida
// do processo o `toFile` escrevia sem qualquer verificação de tamanho — um child em
// crash-loop (cada reinício despeja mais stdout/stderr) inundava logs/vozen.log sem
// limite até encher o disco pequeno da VPS. Aqui contamos os bytes escritos e rodamos
// A MEIO quando ultrapassam `maxBytes`, mantendo sempre exatamente 1 geração (`.1`).
//
// Decisão de desenho: escrita SÍNCRONA (appendFileSync) em vez de um WriteStream
// persistente. Um WriteStream mantém o file descriptor aberto; rodar (rename) um
// ficheiro com fd aberto é frágil no Windows (EBUSY/EPERM até o close assíncrono
// terminar) e obrigaria o writer a ser assíncrono — o que torna "nunca lança" mais
// difícil de garantir e o teste mais dependente de temporização. Escrita síncrona por
// chunk evita essa corrida; o custo (abrir/fechar o fd a cada chunk) é aceitável para
// o volume de logs de um bot Discord.

import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cria um writer de log com rotação por tamanho. NUNCA lança — qualquer falha
 * (disco cheio, sem permissão, pasta removida a meio) é engolida e essa linha
 * perde-se no ficheiro; a consola, gerida à parte pelo chamador, continua sempre.
 *
 * @param {string} dir - pasta do ficheiro de log (criada se não existir)
 * @param {string} fileName - nome do ficheiro, ex.: 'vozen.log'
 * @param {number} maxBytes - tamanho máximo antes de rodar para `<fileName>.1`
 * @returns {{ write: (chunk: string | Buffer) => void, currentFile: string, rotatedFile: string }}
 */
export function makeRotatingWriter(dir, fileName, maxBytes) {
  const filePath = join(dir, fileName);
  const rotatedPath = `${filePath}.1`;
  let bytesWritten = 0;
  let rotating = false;

  function rotate() {
    if (rotating) return;
    rotating = true;
    try {
      rmSync(rotatedPath, { force: true });
      renameSync(filePath, rotatedPath);
    } catch {
      // ficheiro ainda não existe (nada a rodar) ou falha de FS — segue sem rodar
    } finally {
      bytesWritten = 0;
      rotating = false;
    }
  }

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // sem pasta possível — cada write() abaixo vai falhar e degradar em silêncio
  }
  try {
    bytesWritten = statSync(filePath).size;
  } catch {
    bytesWritten = 0; // ficheiro ainda não existe
  }
  // Rotação também no arranque (espelha o comportamento antigo do start-prod.mjs):
  // se o ficheiro já vinha de uma sessão anterior acima do limite, roda já aqui,
  // antes da 1.ª escrita desta sessão.
  if (bytesWritten > maxBytes) rotate();

  function write(chunk) {
    try {
      const len = Buffer.byteLength(chunk);
      if (bytesWritten + len > maxBytes) rotate();
      appendFileSync(filePath, chunk);
      bytesWritten += len;
    } catch {
      // disco cheio / sem permissão / pasta removida a meio — nunca lança,
      // perde-se esta linha no ficheiro (a consola continua a funcionar à parte).
    }
  }

  return {
    write,
    get currentFile() {
      return filePath;
    },
    get rotatedFile() {
      return rotatedPath;
    },
  };
}
