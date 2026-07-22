// scripts/start-prod.mjs — supervisor de PRODUÇÃO do Vozen (spec T1.2).
//
// Corre com:  npm run start:prod   (faz build primeiro; ver package.json)
//
// Faz três coisas que o `tsx watch` (dev) não faz e que morderam em produção:
//   1. PRÉ-AQUECE o módulo nativo de voz (@snazzah/davey). No Windows, o Smart App
//      Control pode BLOQUEAR o binário no 1.º load (reputação cloud ainda pendente);
//      tentamos até 5×, o que resolve o bloqueio transitório antes de arrancar o bot.
//   2. Arranca `node dist/index.js` (build de produção — sem watch, sem recarregar
//      em edições, sem crashar em estados intermédios).
//   3. AUTO-RESTART: se o bot morrer por crash (código != 0), reinicia com backoff
//      exponencial (2s→4s→…→60s). Saída limpa (código 0) ou Ctrl-C → pára de vez.
//
// Puro Node ESM; NÃO faz parte do build TypeScript.

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decideOnExit, prewarmNative, STABLE_RESET_MS } from './supervisorPolicy.mjs';
import { makeRotatingWriter } from './logRotation.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// LOG PERSISTENTE em ficheiro (logs/vozen.log). Antes disto o stdio era 'inherit':
// os logs viviam só no terminal que arrancou o supervisor e PERDIAM-SE quando esse
// terminal fechava — quando um bug intermitente (ex.: autocomplete "Falha ao
// carregar opções") acontecia, nunca havia evidência para diagnosticar. Rotação por
// tamanho: >8MB roda para vozen.log.1 (mantém 1 geração) — tanto no arranque como A
// MEIO-do-run (plano 028: antes só rodava no arranque; um child em crash-loop
// inundava o ficheiro sem limite até encher o disco). Lógica extraída para
// scripts/logRotation.mjs (testada em tests/logRotation.test.ts); nunca lança.
const LOG_DIR = join(ROOT, 'logs');
const LOG_MAX_BYTES = 8 * 1024 * 1024;
const logWriter = makeRotatingWriter(LOG_DIR, 'vozen.log', LOG_MAX_BYTES);
const toFile = (chunk) => {
  logWriter.write(chunk);
};
const log = (m) => {
  const line = `[start-prod] ${m}`;
  console.log(line);
  toFile(`${new Date().toISOString()} ${line}\n`);
};

// GUARD de instância única. Um bot do Discord só pode ter UMA ligação de voz por
// guild; correr vários processos com o MESMO token fá-los expulsar-se uns aos outros
// do canal de voz → o bot fica MUDO na call (foi exatamente o incidente das 5
// instâncias acumuladas por reinícios). Aqui prendemos uma porta de loopback: se já
// estiver ocupada, OUTRO supervisor Vozen está vivo → recusamos arrancar. O SO liberta
// a porta quando o processo morre, por isso não há lock preso (ao contrário de um
// PID-file). Porta configurável (SINGLE_INSTANCE_PORT); 0/"off" desliga o guard (para
// quem corre vários bots diferentes na mesma máquina, cada um com o seu token).
function acquireSingleInstanceLock() {
  const raw = process.env.SINGLE_INSTANCE_PORT;
  if (raw === '0' || raw === 'off') {
    log('guard de instância única DESLIGADO (SINGLE_INSTANCE_PORT=' + raw + ').');
    return Promise.resolve(null);
  }
  const port = Number(raw) || 59595;
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        log('ABORTADO: já há um Vozen a correr (porta de lock ' + port + ' ocupada).');
        log('Mata a instância existente antes de arrancar outra — vários bots com o');
        log('mesmo token lutam pela ligação de voz e o bot fica mudo. (Desliga este');
        log('guard com SINGLE_INSTANCE_PORT=off se corres bots diferentes na máquina.)');
        process.exit(1);
      }
      // Qualquer outro erro (ex.: sem permissão para o socket): não bloquear o
      // arranque por causa do guard — avisar e seguir.
      log('AVISO: guard de instância única indisponível (' + err.code + ') — sigo na mesma.');
      resolve(null);
    });
    // Só loopback: o lock é local à máquina, não expõe nada à rede.
    server.listen(port, '127.0.0.1', () => {
      log('lock de instância única adquirido (porta ' + port + ').');
      // Manter o handle vivo toda a vida do processo (não fechar): é ele que mantém
      // a porta ocupada. unref() para não impedir a saída limpa se o event-loop
      // esvaziar por outra razão.
      server.unref();
      resolve(server);
    });
  });
}

/** Pré-aquece o davey até carregar OK (anti-Smart App Control). */
function prewarmDavey() {
  const tryLoad = () =>
    spawnSync(process.execPath, ['-e', "require('@snazzah/davey')"], {
      cwd: ROOT,
      stdio: 'ignore',
    }).status === 0;
  return prewarmNative(tryLoad, log);
}

let stopping = false;
let attempt = 0;
let currentChild = null; // handle do bot em execução (para o sinal o poder matar)
let resetTimer = null; // timer que zera o backoff após 60s saudáveis

function startOnce() {
  // stdout/stderr do bot vão para a CONSOLA (como antes) E para logs/vozen.log.
  const child = spawn(process.execPath, [join(ROOT, 'dist', 'index.js')], {
    cwd: ROOT,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (d) => {
    process.stdout.write(d);
    toFile(d);
  });
  child.stderr?.on('data', (d) => {
    process.stderr.write(d);
    toFile(d);
  });
  currentChild = child;

  child.on('exit', (code, signal) => {
    if (currentChild === child) currentChild = null;
    // Limpa o timer de reset DESTE arranque. Sem isto, um reset atrasado de um
    // arranque anterior zerava `attempt` a meio de um crash-loop, e a backoff
    // exponencial nunca subia — degradava para um delay quase fixo que martelava
    // o restart em vez de recuar até aos 60s.
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    // Decisão (política pura, testada em tests/startProd.test.ts): ignorar se
    // estamos a parar, parar de vez no código 0, senão reiniciar com backoff.
    const d = decideOnExit(code, stopping, attempt);
    if (d.action === 'ignore') return;
    if (d.action === 'stop') {
      log('bot terminou de forma limpa (código 0) — não reinicio.');
      return;
    }
    attempt = d.nextAttempt;
    log(
      `bot caiu (código ${code ?? 'null'}, sinal ${signal ?? 'null'}) — reinício #${attempt} em ${d.delayMs / 1000}s.`,
    );
    setTimeout(startOnce, d.delayMs);
  });

  // Um arranque que dure >60s conta como saudável → limpa o backoff. Guardamos o
  // handle para o cancelar no exit (senão zera `attempt` fora de tempo — ver acima).
  resetTimer = setTimeout(() => {
    resetTimer = null;
    if (!stopping) attempt = 0;
  }, STABLE_RESET_MS);
}

// Encaminha o sinal para o FILHO e só sai depois de ele morrer. Sem isto, o
// supervisor saía sozinho e deixava o bot ÓRFÃO — que continuava ligado ao Discord
// com o token, libertava o lock de instância única, e um restart do init (docker
// stop / pm2 / kill do PID do supervisor) spawnava um SEGUNDO bot: exatamente o
// incidente das instâncias duplicadas. Timeout de segurança (SIGKILL) para não ficar
// preso se o filho não terminar a tempo.
let shuttingDown = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopping = true;
    const child = currentChild;
    if (!child) {
      log(`${sig} recebido — nada a parar.`);
      process.exit(0);
      return;
    }
    log(`${sig} recebido — a parar o bot e a aguardar que feche…`);
    const done = () => process.exit(0);
    child.once('exit', done);
    try {
      child.kill(sig);
    } catch {
      done();
      return;
    }
    const t = setTimeout(() => {
      log('bot não fechou em 8s — SIGKILL.');
      try {
        child.kill('SIGKILL');
      } catch {
        // já morto
      }
      done();
    }, 8000);
    t.unref?.();
  });
}

// Recusa arrancar se já houver outro Vozen vivo (evita o incidente das instâncias
// duplicadas). Corre ANTES do prewarm/arranque para falhar cedo e barato.
await acquireSingleInstanceLock();
prewarmDavey();
log('a arrancar dist/index.js (produção, com auto-restart)…');
startOnce();
