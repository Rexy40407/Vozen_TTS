import franc from 'franc';
import { lookupShortLang } from './greetings';

/** Acesso a `franc.all` (ranking [lang, score]) — nao tipado no default export. */
type FrancAll = (
  text: string,
  opts?: { minLength?: number; only?: string[] },
) => [string, number][];
const francAll = (franc as unknown as { all: FrancAll }).all;

/**
 * Margem minima (score do 1.º menos o do 2.º, ambos 0..1) para considerar a deteccao
 * do franc CONFIANTE. Empirico: ingles claro da ~0.15 de margem; o par ambiguo PT/ES
 * em texto curto da ~0.01. 0.10 separa-os bem.
 */
const CONFIDENT_MARGIN = 0.1;

/**
 * Deteta a lingua COM um sinal de confianca. Usado pela memoria de lingua (T3.2): so
 * memorizamos deteccoes confiantes e so as usamos para resolver fragmentos ambiguos.
 *  - match de lexico de saudacoes => confiante (temos a certeza);
 *  - senao franc: confiante sse a margem do topo sobre o 2.º >= CONFIDENT_MARGIN;
 *  - 'und'/vazio => lang '' e nao-confiante.
 * PURO.
 */
export function detectLangDetailed(text: string): { lang: string; confident: boolean } {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { lang: '', confident: false };

  const short = lookupShortLang(trimmed);
  if (short) return { lang: short, confident: true };

  const ranked = francAll(trimmed);
  const top = ranked[0];
  if (!top || top[0] === 'und') return { lang: '', confident: false };
  const second = ranked[1];
  const margin = second ? top[1] - second[1] : 1;
  return { lang: top[0], confident: margin >= CONFIDENT_MARGIN };
}

/**
 * Deteta a lingua de um texto.
 * Devolve um codigo ISO 639-3 (ex. 'por', 'eng') ou '' se desconhecido/muito curto.
 * PURO: sem efeitos secundarios.
 *
 * Ordem: (1) lexico de saudacoes/palavras curtas — o franc NAO decide texto curto
 * ("ola"->'und', "ola tudo bem"->Tok Pisin), por isso o lexico curado tem
 * PRECEDENCIA para essas; (2) franc para texto suficientemente longo.
 */
export function detectLang(text: string): string {
  return detectLangDetailed(text).lang;
}
