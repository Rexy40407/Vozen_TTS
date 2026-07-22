/**
 * Riso LOCALIZADO por língua, no script CORRETO (nunca transliterado).
 *
 * Puro e determinístico: `laughterFor(prefix)` devolve sempre a mesma string para
 * o mesmo prefixo de locale (ex. 'en_', 'ru_', 'ar_'). O prefixo é a parte inicial
 * do nome do modelo Piper até ao primeiro '_' inclusive (ex. 'en_US-amy-medium' ->
 * 'en_'), o mesmo prefixo usado em LANG_TO_PREFIX / pickVoice.
 *
 * Regras de design (pedido do Diogo: riso substancial "ha ha ha" / "he he he"):
 *  - >= 5 sílabas ESPAÇADAS, com duração-alvo >= ~1.5s no TTS.
 *  - Sílaba VOCALIZADA por língua: o 'h' é MUDO no phonemizer de algumas línguas
 *    (Português, Italiano) -> "ha" quase não soa; nessas usa-se "he" (que voca).
 *    Espanhol/Catalão usam "ja" (o 'j' = som /x/, o "haha" espanhol).
 *  - Contagem CALIBRADA POR MODELO: a duração por sílaba varia ~3x entre modelos
 *    (medido empiricamente com cada .onnx; o tugão pt_PT corre com length_scale 1.5;
 *    o kk_KZ é x_low e MUITO lento -> contagem baixa). Cada língua foi medida e a
 *    contagem escolhida para ultrapassar ~1.5s sem exagerar.
 *  - Script NATIVO nas escritas não-latinas (Cirílico, Árabe, Georgiano,
 *    Devanagari, Han) — nunca transliterado.
 *  - Fallback "ha" x6 para prefixo desconhecido ou vazio.
 */
interface Laugh {
  /** Sílaba de riso, no script nativo e VOCALIZÁVEL da língua. */
  unit: string;
  /** Repetições (calibrado por medição real do modelo para durar >= ~1.5s). */
  count: number;
}

const LAUGHTER: Record<string, Laugh> = {
  // ── Latinas com "ha" (h vocalizado); contagem calibrada por modelo ──
  en_: { unit: 'ha', count: 6 }, // amy 2.1s / alan 1.9s
  fr_: { unit: 'ha', count: 6 }, // 1.9s
  de_: { unit: 'ha', count: 5 }, // 2.2s
  cs_: { unit: 'ha', count: 5 }, // 1.8s
  nl_: { unit: 'ha', count: 9 }, // alex 1.7s / nathalie 2.0s
  pl_: { unit: 'ha', count: 12 }, // 1.9s
  tr_: { unit: 'ha', count: 7 }, // 1.8s
  sv_: { unit: 'ha', count: 10 }, // 1.6s
  fi_: { unit: 'ha', count: 9 }, // 1.8s
  da_: { unit: 'ha', count: 6 }, // 1.9s
  ro_: { unit: 'ha', count: 12 }, // 1.5s
  hu_: { unit: 'ha', count: 14 }, // 1.6s
  cy_: { unit: 'ha', count: 9 }, // 1.7s
  is_: { unit: 'ha', count: 9 }, // 1.6s
  lb_: { unit: 'ha', count: 13 }, // 1.6s
  lv_: { unit: 'ha', count: 10 }, // 1.8s
  sk_: { unit: 'ha', count: 13 }, // 1.6s
  sl_: { unit: 'ha', count: 7 }, // 2.1s
  sw_: { unit: 'ha', count: 8 }, // 1.9s
  vi_: { unit: 'ha', count: 12 }, // 1.6s
  // ── 'h' MUDO no phonemizer -> "he" (vocaliza) ──
  pt_: { unit: 'he', count: 6 }, // tugão(ls1.5) 1.8s / cadu 2.6s
  it_: { unit: 'he', count: 5 }, // 2.1s
  // ── Espanhol/Catalão: "ja" (o "haha" espanhol) ──
  es_: { unit: 'ja', count: 9 }, // davefx 1.5s / ald 3.3s (2 modelos, velocidades díspares)
  ca_: { unit: 'ja', count: 6 }, // 2.1s
  // ── Grego ──
  el_: { unit: 'χα', count: 7 }, // 2.0s
  // ── Cirílico ──
  ru_: { unit: 'ха', count: 12 }, // 1.6s
  uk_: { unit: 'ха', count: 12 }, // 2.5s
  sr_: { unit: 'ха', count: 12 }, // 1.6s
  kk_: { unit: 'ха', count: 5 }, // x_low MUITO lento -> 1.6s (x12 dava 5.3s)
  // ── Árabe / Persa ──
  ar_: { unit: 'هه', count: 12 }, // 1.6s
  fa_: { unit: 'هه', count: 12 }, // 1.6s
  // ── Georgiano / Devanagari / Han ──
  ka_: { unit: 'ჰა', count: 6 }, // 1.9s
  ne_: { unit: 'हा', count: 6 }, // 2.3s
  zh_: { unit: '哈哈', count: 5 }, // par espaçado evita a saturação do modelo -> 2.6s
  ja_: { unit: 'ハ', count: 8 }, // katakana ハ (onomatopeia, lê sempre "ha"); gTTS-backed (sem .onnx) -> contagem estimada ~1.8s
};

/** "ha" x6: fallback razoável para prefixo desconhecido/vazio. */
const FALLBACK: Laugh = { unit: 'ha', count: 6 };

/** Constrói o riso repetindo a sílaba, ESPAÇADA (para o TTS a articular). */
function build(l: Laugh): string {
  return Array<string>(l.count).fill(l.unit).join(' ');
}

/**
 * Riso para o prefixo de locale dado, no script correto, com >= 5 sílabas e
 * duração-alvo >= ~1.5s (calibrado por medição real de cada modelo). PURO.
 */
export function laughterFor(langPrefix: string): string {
  return build(LAUGHTER[langPrefix] ?? FALLBACK);
}
