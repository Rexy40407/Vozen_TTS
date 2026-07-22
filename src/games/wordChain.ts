// src/games/wordChain.ts
//
// 15th minigame: WORD CHAIN (inspired by Roblox's "Finish The Word").
// Turn-based in fixed order, 2 lives, ONE language per match (chosen in /game play).
// Vozen welcomes in the match's language, READS each accepted word out loud and
// announces the next letter. The chain rules live in the pure core (wordchain/core).

import type { Game, GameContext, GameDefinition, GameMessage, GameStartOptions } from './types';
import {
  ChainEngine,
  WORDCHAIN_LANGS,
  type Dictionary,
  type WordChainLang,
  type ValidationReason,
} from './wordchain/core';
import { loadDictionary } from './wordchain/dict';
import { pickVoice } from '../language/voiceMap';

const LOBBY_MS = 20000;
const LIVES = 2;
const WIN_BONUS = 3;

/** Friendly language name (autonym) for the text messages. */
const LANG_NAME: Record<WordChainLang, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
  fr: 'Français',
};

/** SPOKEN welcome, in the match's language (read with the native voice). */
const WELCOME: Record<WordChainLang, string> = {
  pt: 'Bem-vindos ao jogo da cadeia de palavras!',
  en: 'Welcome to the word chain game!',
  es: '¡Bienvenidos al juego de la cadena de palabras!',
  fr: 'Bienvenue au jeu de la chaîne de mots !',
};

function resolveLang(input?: string): WordChainLang {
  const l = (input ?? '').toLowerCase();
  return (WORDCHAIN_LANGS as readonly string[]).includes(l) ? (l as WordChainLang) : 'en';
}

/** pickVoice expects ISO 639-3 (LANG_TO_PREFIX uses 'por'/'eng'/…), not 2 letters. */
const ISO3: Record<WordChainLang, string> = { pt: 'por', en: 'eng', es: 'spa', fr: 'fra' };

/** i18n key for the feedback of an invalid attempt. */
function badKey(reason: ValidationReason): string {
  switch (reason) {
    case 'wrong-letter':
      return 'game.wordChain.bad.letter';
    case 'too-short':
      return 'game.wordChain.bad.short';
    case 'repeated':
      return 'game.wordChain.bad.repeated';
    case 'not-a-word':
      return 'game.wordChain.bad.word';
    default:
      return 'game.wordChain.bad.latin'; // not-latin / empty
  }
}

class WordChainGame implements Game {
  readonly id = 'word-chain';
  private readonly lang: WordChainLang;
  private dict: Dictionary | null = null;
  private engine: ChainEngine | null = null;
  private phase: 'lobby' | 'playing' | 'ended' = 'lobby';
  private readonly order: string[] = []; // ALIVE userIds, in turn order
  private readonly names = new Map<string, string>();
  private readonly lives = new Map<string, number>();
  private idx = 0; // index of the current player in `order`
  private turnGen = 0; // turn generation: a stale turn timer (gen != current) is a no-op
  private busy = false; // reentrancy latch: one guess is in flight (set before the first await)

  constructor(opts?: GameStartOptions) {
    this.lang = resolveLang(opts?.language);
  }

  async start(ctx: GameContext): Promise<void> {
    this.dict = loadDictionary(this.lang);
    if (!this.dict) {
      await ctx.send(ctx.t('game.wordChain.unavailable', { lang: LANG_NAME[this.lang] }));
      ctx.end();
      return;
    }
    await ctx.send(
      ctx.t('game.wordChain.lobby', { lang: LANG_NAME[this.lang], seconds: LOBBY_MS / 1000 }),
    );
    ctx.after(LOBBY_MS, () => this.beginPlay(ctx));
  }

  async onMessage(ctx: GameContext, msg: GameMessage): Promise<void> {
    if (this.phase === 'lobby') {
      this.join(msg);
      return;
    }
    if (this.phase !== 'playing') return;
    // Only the CURRENT player's message counts; spectators are ignored (clean turns).
    if (msg.authorId !== this.order[this.idx]) return;
    // Reentrancy guard: onMessage is dispatched fire-and-forget (manager does not await it),
    // so a same-player message can arrive while a prior handleGuess is suspended at
    // `await ctx.send`, before `idx` advances — letting the current player play twice and
    // skip the next. The latch is set synchronously before any await, so the second
    // dispatch sees it and is dropped. Cleared in finally.
    if (this.busy) return;
    this.busy = true;
    try {
      await this.handleGuess(ctx, msg);
    } finally {
      this.busy = false;
    }
  }

  private join(msg: GameMessage): void {
    if (this.names.has(msg.authorId)) return;
    this.names.set(msg.authorId, msg.authorName);
    this.lives.set(msg.authorId, LIVES);
    this.order.push(msg.authorId);
  }

  private voiceModel(ctx: GameContext): string {
    return pickVoice(ISO3[this.lang], ctx.availableModels, ctx.defaultVoice);
  }

  private beginPlay(ctx: GameContext): void {
    if (this.phase !== 'lobby') return;
    if (this.order.length < 2) {
      void ctx.send(ctx.t('game.wordChain.notEnough'));
      ctx.end();
      return;
    }
    this.phase = 'playing';
    this.engine = new ChainEngine(this.dict!, ctx.seed);
    // Spoken welcome in the match's language (native voice).
    void ctx.say(WELCOME[this.lang], { model: this.voiceModel(ctx) });
    const roster = this.order.map((id) => this.names.get(id)).join(', ');
    void ctx.send(ctx.t('game.wordChain.begin', { players: roster, lang: LANG_NAME[this.lang] }));
    this.announceTurn(ctx);
  }

  /** Announces the current turn and arms the timer (with a generation guard). */
  private announceTurn(ctx: GameContext): void {
    const gen = ++this.turnGen;
    const id = this.order[this.idx];
    const e = this.engine!;
    void ctx.send(
      ctx.t('game.wordChain.turn', {
        name: this.names.get(id) ?? '?',
        letter: e.requiredLetter.toUpperCase(),
        hearts: '❤️'.repeat(this.lives.get(id) ?? 0),
        seconds: Math.round(e.turnMs / 1000),
      }),
    );
    ctx.after(e.turnMs, () => {
      if (this.turnGen === gen && this.phase === 'playing') this.onTimeout(ctx);
    });
  }

  private async handleGuess(ctx: GameContext, msg: GameMessage): Promise<void> {
    const e = this.engine!;
    const res = e.validate(msg.content);
    if (!res.ok) {
      // Invalid attempt: feedback, BUT the timer keeps running (unlimited
      // attempts within the turn) — we don't re-arm or advance.
      await ctx.send(
        ctx.t(badKey(res.reason), { letter: e.requiredLetter.toUpperCase(), min: e.minLength }),
      );
      return;
    }
    e.accept(res.normalized);
    ctx.award(msg.authorId, 1);
    // Reads the accepted word out loud (language voice) — the heart of the game in Vozen.
    void ctx.say(res.normalized, { model: this.voiceModel(ctx) });
    await ctx.send(
      ctx.t('game.wordChain.accepted', {
        word: res.normalized,
        letter: e.requiredLetter.toUpperCase(),
      }),
    );
    // Next player (bumps turnGen -> the previous turn's timer becomes stale).
    this.idx = (this.idx + 1) % this.order.length;
    this.announceTurn(ctx);
  }

  private onTimeout(ctx: GameContext): void {
    const id = this.order[this.idx];
    const left = (this.lives.get(id) ?? 1) - 1;
    this.lives.set(id, left);
    if (left <= 0) {
      void ctx.send(ctx.t('game.wordChain.eliminated', { name: this.names.get(id) ?? '?' }));
      this.order.splice(this.idx, 1); // remove the current one; the next takes over `idx`
      this.lives.delete(id);
      if (this.order.length === 1) {
        this.declareWinner(ctx);
        return;
      }
      if (this.idx >= this.order.length) this.idx = 0; // wrap
    } else {
      void ctx.send(
        ctx.t('game.wordChain.timeout', {
          name: this.names.get(id) ?? '?',
          hearts: '❤️'.repeat(left),
        }),
      );
      this.idx = (this.idx + 1) % this.order.length;
    }
    this.announceTurn(ctx);
  }

  private declareWinner(ctx: GameContext): void {
    this.phase = 'ended';
    const id = this.order[0];
    ctx.award(id, WIN_BONUS);
    void ctx.send(
      ctx.t('game.wordChain.winner', {
        name: this.names.get(id) ?? '?',
        chain: this.engine?.chainLength ?? 0,
      }),
    );
    ctx.end();
  }
}

export const wordChainDef: GameDefinition = {
  id: 'word-chain',
  nameKey: 'game.wordChain.name',
  descKey: 'game.wordChain.descr',
  needsVoice: false, // voice is a BONUS; the game works in text-only if there's no call
  premium: true, // 💎 Premium (user's own Plus OR server Premium) — gated in handleGame
  usesLanguage: true,
  create: (opts) => new WordChainGame(opts),
};
