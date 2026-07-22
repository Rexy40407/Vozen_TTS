// src/health/ffmpeg.ts
//
// Health-check do ffmpeg no arranque.
//
// Contexto: @discordjs/voice transcodifica o audio (createAudioResource com
// StreamType.Arbitrary) atraves do prism-media, que por sua vez invoca o binario
// do ffmpeg (ffmpeg-static ou o do PATH). Se esse binario faltar ou for da
// plataforma ERRADA (ex.: um binario Linux baixado como ffmpeg.exe no Windows,
// residuo de installs Docker), o prism nao o encontra e a 1a reproducao rebenta
// tarde com um unhandledRejection cru — em vez de um erro claro no arranque.
//
// `checkFfmpeg()` antecipa esse problema: chama `FFmpeg.getInfo()` (que faz
// spawn do binario e le a versao) dentro de um try/catch e devolve um veredicto
// simples. E PURA/testavel: aceita um `getInfo` injetado (default o real) para
// os testes poderem mockar sem depender do ffmpeg do sistema.

import { FFmpeg } from 'prism-media';

export type FfmpegCheck = { ok: true; version: string } | { ok: false; error: string };

/** Assinatura do getInfo do prism (injetavel para testes). */
type GetInfo = () => ReturnType<typeof FFmpeg.getInfo>;

/**
 * Verifica se um ffmpeg utilizavel esta acessivel.
 *  - OK  => { ok: true, version } (a versao vem do output do proprio ffmpeg;
 *           se por algum motivo vier vazia, cai para "desconhecida").
 *  - Falha => { ok: false, error } com mensagem ACIONAVEL, que inclui o comando
 *             de correcao no Windows e a causa crua para diagnostico.
 *
 * @param getInfo funcao que devolve a info do ffmpeg (default: prism FFmpeg.getInfo,
 *                embrulhada para evitar surpresas de binding de `this`).
 */
export function checkFfmpeg(getInfo: GetInfo = () => FFmpeg.getInfo()): FfmpegCheck {
  try {
    const info = getInfo();
    return { ok: true, version: info.version ?? 'desconhecida' };
  } catch (err) {
    return {
      ok: false,
      error:
        'FFmpeg was not found or is invalid; run: node node_modules/ffmpeg-static/install.js ' +
        `(${String(err)})`,
    };
  }
}
