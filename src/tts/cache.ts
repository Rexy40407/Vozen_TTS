// src/tts/cache.ts
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  renameSync,
  readdirSync,
  unlinkSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import type { SynthRequest } from './engine';
import { metrics } from '../metrics';

/** Número máximo de ficheiros .wav na cache antes de começar o evict (índice LRU em memória). */
const DEFAULT_MAX_FILES = 500;

/**
 * Audio-cache namespaces produced by a voice EFFECT. 'fx' is where the EffectEngine writes
 * (robot/echo/deep…). The keys are irreversible hashes, so a single person's entries cannot
 * be deleted selectively — a full-namespace purge is the only option. It is a regenerable
 * cache (re-synthesized when needed). ('q'/prosody does NOT belong here: the ProsodyEngine
 * returns the base without caching at that sample rate.)
 */
export const CLONE_DERIVED_NAMESPACES = ['fx'] as const;

/**
 * Deletes from disk every effect-derived cache namespace, given the cache root directory
 * (e.g. `<dbDir>/audio-cache`). best-effort — a missing or locked folder is not fatal (the
 * cache is regenerable). The keys are hashes, so a whole namespace is cleared at once.
 */
export function purgeCloneDerivedAudio(cacheRoot: string): void {
  for (const ns of CLONE_DERIVED_NAMESPACES) {
    try {
      rmSync(join(cacheRoot, ns), { recursive: true, force: true });
    } catch {
      // pasta inexistente/bloqueada — regenerável, não é fatal
    }
  }
}

export function cacheKey(req: SynthRequest): string {
  // Hash estavel e sensivel a fronteiras: separador \u0000 que nao aparece em texto normal.
  const payload = `${req.text}\u0000${req.model}\u0000${req.speed}`;
  // leadSilenceMs (silencio PREPENDido) altera o audio -> tem de alterar a chave,
  // senao a versao com/sem pausa colidiria. APPEND-only e SO quando >0: assim
  // undefined e 0 dao a MESMA chave das requests antigas (sem silencio) — as chaves
  // ja em disco ficam intactas. `req.speed` e numerico, logo o segmento numerico do
  // lead nunca colide com ele.
  const lead = req.leadSilenceMs ?? 0;
  let full = lead > 0 ? `${payload} ${lead}` : payload;
  // MOTOR na chave: APPEND-only e SO quando != 'google'/undefined. Assim 'google'/
  // undefined dão a MESMA chave das requests antigas (cache existente intacta), e cada
  // motor opt-in (piper/kokoro/gcloud) fica num espaço de chaves SEPARADO — dois users
  // com motores diferentes e o mesmo texto NÃO se cruzam (crítico no namespace combinado
  // 'multiseg', que usa esta função). O gcloud (Google HD) soa diferente do gtts, por
  // isso TEM de separar, senão serviria áudio gtts a quem pediu Google HD (e vice-versa).
  if (req.engine === 'piper' || req.engine === 'kokoro' || req.engine === 'gcloud')
    full = `${full} ${req.engine}`;
  return createHash('sha1').update(full, 'utf8').digest('hex');
}

export class AudioCache {
  private readonly dir: string;
  private readonly maxFiles: number;
  /** Sequência para nomes de ficheiro temporários únicos (escrita atómica em put). */
  private tmpSeq = 0;
  /** Nº de ficheiros .wav no dir, mantido em memória para evitar um readdir por put. */
  private count: number;
  /**
   * Índice LRU em memória: caminho completo do ficheiro -> true. A ORDEM DE INSERÇÃO
   * do Map é a própria ordem de acesso (mais antigo primeiro) — mover uma chave para
   * o fim (mais recente) é um delete+set. Substitui o mtime em disco como sinal de
   * LRU, o que elimina o readdir/stat do hot path do evict() (plano 020).
   */
  private lru = new Map<string, true>();

  constructor(dir: string, maxFiles: number = DEFAULT_MAX_FILES) {
    this.dir = dir;
    this.maxFiles = maxFiles;
    mkdirSync(this.dir, { recursive: true });
    // Um único scan no arranque (warm start: a cache persiste entre restarts) — semeia
    // TANTO o contador como o índice LRU (caminhos completos, mesma forma de chave que
    // put() usa). A ordem herdada do readdir é best-effort (tal como o mtime era antes
    // deste plano); só a partir daqui a ordem passa a ser exata via put()/get().
    try {
      const wavFiles = readdirSync(this.dir).filter((f) => f.endsWith('.wav'));
      this.count = wavFiles.length;
      for (const f of wavFiles) this.lru.set(join(this.dir, f), true);
    } catch {
      this.count = 0; // dir inacessível — o próximo evict reconciliará
    }
  }

  /**
   * Devolve uma nova instância de AudioCache com o diretório raiz em
   * `<dir>/<namespace>/`. Usado para isolar caches por motor (ex. 'piper'
   * vs 'neural'), evitando que um motor sirva áudio produzido pelo outro.
   * O maxFiles é herdado pelo namespace filho.
   */
  withNamespace(namespace: string): AudioCache {
    return new AudioCache(join(this.dir, namespace), this.maxFiles);
  }

  private pathFor(key: string): string {
    return join(this.dir, `${key}.wav`);
  }

  get(key: string): string | null {
    const p = this.pathFor(key);
    if (existsSync(p)) {
      metrics.inc('cacheHits');
      // LRU verdadeiro: no ACESSO, move a chave para o fim do índice em memória (mais
      // recente). Sem isto, o evict() despejava por ordem de CRIAÇÃO — uma entrada
      // quentíssima mas antiga seria evictada enquanto uma fria mas recém-criada
      // sobrevivia. Só quando o evict está ativo (maxFiles>0). Substitui o antigo
      // refresh de mtime em disco (utimesSync) — a ordem agora vive só em memória, o
      // que também poupa esse syscall no hot path de hit.
      if (this.maxFiles > 0) {
        this.lru.delete(p);
        this.lru.set(p, true);
      }
      return p;
    }
    metrics.inc('cacheMisses');
    return null;
  }

  put(key: string, srcPath: string): string {
    const dest = this.pathFor(key);
    // Escrita ATÓMICA: um `copyFileSync` direto para o path final deixava um `get()`
    // concorrente servir um .wav A MEIO da cópia (WAV truncado) quando dois synths da
    // MESMA chave corriam em paralelo. Copia para um tmp único no MESMO dir e faz
    // renameSync (atómico no mesmo filesystem).
    //
    // Guard exists-first: a chave é determinística (mesmo texto/voz => mesmo áudio), por
    // isso se `dest` já existe outro escritor ganhou — devolvemo-lo sem re-escrever.
    // Isto também evita o rename SOBRE um ficheiro aberto (que no Windows pode dar
    // EPERM): só renomeamos para um destino que ainda não existe.
    if (existsSync(dest)) return dest;
    // A pasta pode ter sido REMOVIDA em runtime (ex.: apagada por fora do processo).
    // Detecao BARATA: so
    // recria (e ZERA o contador — a pasta nova esta vazia) se realmente sumiu; num
    // dir existente o mkdirSync recursivo era um no-op, por isso saltamo-lo.
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
      this.count = 0;
      this.lru.clear(); // a pasta nova esta vazia -> o indice antigo ja nao e valido
    }
    const tmp = `${dest}.${process.pid}.${this.tmpSeq++}.tmp`;
    copyFileSync(srcPath, tmp);
    try {
      renameSync(tmp, dest);
    } catch (err) {
      // Limpa o tmp; se entretanto outro escritor criou o dest, aceita-o (degradação
      // graciosa em vez de propagar). Senão, propaga o erro real. NAO conta (nao
      // adicionamos um ficheiro novo por esta via).
      try {
        unlinkSync(tmp);
      } catch {
        // tmp já removido — ignora
      }
      if (existsSync(dest)) return dest;
      throw err;
    }
    // Um ficheiro novo aterrou: conta-o, regista-o no índice LRU (mais recente) e só
    // despeja acima do cap.
    this.count++;
    this.lru.delete(dest);
    this.lru.set(dest, true);
    if (this.maxFiles > 0 && this.count > this.maxFiles) {
      this.evict(dest);
    }
    return dest;
  }

  /**
   * Remove os ficheiros .wav mais antigos (por ordem de acesso no índice LRU em
   * memória) se o número total exceder `maxFiles`. O ficheiro recém-escrito
   * (`justWritten`) é sempre excluído da evicção. SEM readdir/stat — plano 020:
   * o directory scan por synthesis (500 syscalls síncronos no caso pior) estava a
   * bloquear o event loop partilhado por todas as guilds a cada cache-miss.
   */
  private evict(justWritten: string): void {
    while (this.count > this.maxFiles) {
      // O mais antigo é o primeiro da ordem de inserção/acesso do Map.
      let oldest: string | undefined;
      for (const k of this.lru.keys()) {
        if (k !== justWritten) {
          oldest = k;
          break;
        }
      }
      if (!oldest) break; // só resta o recém-escrito (ou drift count/lru — não trava)
      this.lru.delete(oldest);
      try {
        unlinkSync(oldest);
      } catch {
        // já removido fora do processo — best-effort, o índice segue em frente
      }
      this.count--;
    }
  }
}
