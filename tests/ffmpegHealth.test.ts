import { describe, it, expect } from 'vitest';
import { checkFfmpeg } from '../src/health/ffmpeg';

// checkFfmpeg e uma funcao PURA/testavel: recebe um `getInfo` injetado (default o
// real prism FFmpeg.getInfo) e traduz o resultado num veredicto simples. Aqui
// mockamos o getInfo para nao depender do ffmpeg real do sistema.

describe('checkFfmpeg — health-check do ffmpeg', () => {
  it('(a) getInfo devolve versao => { ok:true, version }', () => {
    const res = checkFfmpeg(() => ({
      command: '/x/ffmpeg',
      info: '',
      version: '6.1.1-essentials_build',
      output: 'Hyper fast Audio and Video encoder',
    }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.version).toBe('6.1.1-essentials_build');
    }
  });

  it('(a2) versao ausente => ok:true mas version cai para "desconhecida"', () => {
    const res = checkFfmpeg(
      () =>
        ({
          command: '/x/ffmpeg',
          info: '',
          output: 'algum output sem campo version',
        }) as unknown as ReturnType<typeof import('prism-media').FFmpeg.getInfo>,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.version).toBe('desconhecida');
    }
  });

  it('(b) getInfo lanca => { ok:false, error } com mensagem acionavel (contem install.js)', () => {
    const res = checkFfmpeg(() => {
      throw new Error('FFmpeg/avconv not found!');
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('install.js');
      // mensagem deve mencionar ffmpeg e o comando de correcao no Windows
      expect(res.error).toMatch(/ffmpeg/i);
      expect(res.error).toContain('node node_modules/ffmpeg-static/install.js');
      // e deve expor a causa crua para diagnostico
      expect(res.error).toContain('not found');
    }
  });

  it('(c) default sem argumento nao rebenta (usa o getInfo real, so nao deve lancar)', () => {
    // Nao afirmamos ok/version (depende do ambiente); so que devolve um veredicto
    // e nunca propaga a excecao.
    expect(() => checkFfmpeg()).not.toThrow();
    const res = checkFfmpeg();
    expect(typeof res.ok).toBe('boolean');
  });
});
