// src/textCleaning/accents.ts — per-language accent restoration.
//
// PROBLEM: in casual chat people often write WITHOUT accents ("nao", "voce",
// "amanha"). Piper/espeak reads the literal spelling and sounds BAD (verified: "nao" and "não"
// produce different audio). SOLUTION: before synthesizing, restore the accents of the
// most common words of the DETECTED language.
//
// CURATION RULE (intra-language, not cross-language): a word only goes in if its
// UNACCENTED form is NOT, itself, ANOTHER common word of the same language
// (in ANY inflection and ANY capitalization — the match is case-insensitive). That
// is why the ambiguous pairs are LEFT OUT (pt: esta/está, e/é, so/só, pais/país,
// pode/pôde, publico/público, musica/música, pratica/prática, manha/manhã…). When in
// doubt, EXCLUDE — a wrong swap is worse than a missing accent. Applies ONLY to the
// corresponding language (the `por` dictionary only runs when the language is `por`).
//
// Keys in lowercase, no accent; values with accent and ALSO in lowercase (the
// output capitalization is restored by `matchCase` from the matched token, and the
// case is irrelevant to the phoneme — Piper/espeak ignores it). `restoreAccents` matches
// on WORD BOUNDARY (same style as expandAbbreviations) and preserves the token's
// capitalization (lowercase / First-uppercase / ALL-UPPERCASE).

/** ISO 639-3 (the output of detectLang) -> unaccented dictionary -> accented. */
const DICTS: Record<string, Record<string, string>> = {
  // ── Portuguese ─────────────────────────────────────────────────────────────
  por: {
    nao: 'não',
    sao: 'são',
    entao: 'então',
    estao: 'estão',
    nao_: 'não',
    voce: 'você',
    voces: 'vocês',
    portugues: 'português',
    ingles: 'inglês',
    frances: 'francês',
    japones: 'japonês',
    chines: 'chinês',
    alemao: 'alemão',
    tambem: 'também',
    alem: 'além',
    ninguem: 'ninguém',
    alguem: 'alguém',
    parabens: 'parabéns',
    porem: 'porém',
    amanha: 'amanhã',
    manhas: 'manhãs',
    rapido: 'rápido',
    rapida: 'rápida',
    rapidos: 'rápidos',
    rapidas: 'rápidas',
    facil: 'fácil',
    faceis: 'fáceis',
    dificil: 'difícil',
    dificeis: 'difíceis',
    ultimo: 'último',
    ultima: 'última',
    ultimos: 'últimos',
    ultimas: 'últimas',
    proximo: 'próximo',
    proxima: 'próxima',
    proximos: 'próximos',
    proximas: 'próximas',
    numero: 'número',
    numeros: 'números',
    pagina: 'página',
    paginas: 'páginas',
    familia: 'família',
    familias: 'famílias',
    policia: 'polícia',
    experiencia: 'experiência',
    paciencia: 'paciência',
    ciencia: 'ciência',
    historia: 'história',
    historias: 'histórias',
    memoria: 'memória',
    vitoria: 'vitória',
    gloria: 'glória',
    servico: 'serviço',
    servicos: 'serviços',
    preco: 'preço',
    precos: 'preços',
    comecar: 'começar',
    comeca: 'começa',
    comecou: 'começou',
    coracao: 'coração',
    coracoes: 'corações',
    mae: 'mãe',
    maes: 'mães',
    irmao: 'irmão',
    irmaos: 'irmãos',
    irma: 'irmã',
    agua: 'água',
    aguas: 'águas',
    otimo: 'ótimo',
    otima: 'ótima',
    pessimo: 'péssimo',
    pessima: 'péssima',
    unico: 'único',
    unica: 'única',
    possivel: 'possível',
    impossivel: 'impossível',
    possiveis: 'possíveis',
    nivel: 'nível',
    niveis: 'níveis',
    util: 'útil',
    inutil: 'inútil',
    maquina: 'máquina',
    maquinas: 'máquinas',
    video: 'vídeo',
    videos: 'vídeos',
    musculo: 'músculo',
    ate: 'até',
  },
  // ── Spanish (only NON-ambiguous content words; excluding que/qué, si/sí, tu/tú…) ─
  spa: {
    informacion: 'información',
    corazon: 'corazón',
    tambien: 'también',
    adios: 'adiós',
    facil: 'fácil',
    dificil: 'difícil',
    rapido: 'rápido',
    ultimo: 'último',
    numero: 'número',
    pagina: 'página',
    telefono: 'teléfono',
    arbol: 'árbol',
    lapiz: 'lápiz',
    musica: 'música',
    pelicula: 'película',
    cancion: 'canción',
    tambien_: 'también',
    espanol: 'español',
    ingles: 'inglés',
    frances: 'francés',
    aqui: 'aquí',
    alli: 'allí',
    ademas: 'además',
    despues: 'después',
    quiza: 'quizá',
  },
  // ── French (common content words; excluding a/à, ou/où, la/là…) ──────────────
  fra: {
    francais: 'français',
    tres: 'très',
    etre: 'être',
    deja: 'déjà',
    apres: 'après',
    cafe: 'café',
    ecole: 'école',
    etudiant: 'étudiant',
    numero: 'numéro',
    telephone: 'téléphone',
    tele: 'télé',
    fenetre: 'fenêtre',
    theatre: 'théâtre',
    probleme: 'problème',
    systeme: 'système',
    modele: 'modèle',
    celebre: 'célèbre',
    repondre: 'répondre',
    prefere: 'préfère',
    achete: 'achète',
  },
  // ── German ───────────────────────────────────────────────────────────────────
  // The umlaut (ä/ö/ü) CHANGES the phoneme (e.g. "schon"[ʃoːn] vs "schön"[ʃøːn]) and is
  // very often omitted in chat ("fur", "konnen", "grun"). Restoring it clearly improves the
  // audio. BUT German is a minefield of minimal pairs distinguished ONLY by the
  // umlaut — so the curation here is EVEN stricter: only words whose
  // umlaut-less form does NOT exist as ANY German word, in ANY inflection and
  // ANY capitalization (the match is case-insensitive), go in. The infinitives (-en) and the
  // clearly-not-a-word forms are the safe ground; the conjugated ones collide.
  //
  // Values in lowercase (the case does not affect the phoneme; `matchCase` restores it from the token).
  // The ß is deliberately LEFT OUT: "ss"->"ß" barely changes the phoneme (~zero gain) and
  // "ss" is legitimate spelling (Swiss), so swapping it would be a risk with no return.
  deu: {
    fur: 'für', // fur = English word, not German
    konnen: 'können',
    mussen: 'müssen',
    durfen: 'dürfen',
    naturlich: 'natürlich',
    moglich: 'möglich',
    wahrend: 'während',
    grun: 'grün',
    tur: 'tür',
    kuche: 'küche',
    madchen: 'mädchen',
    horen: 'hören',
    gehoren: 'gehören',
    wunschen: 'wünschen',
    fuhlen: 'fühlen',
    erzahlen: 'erzählen',
    funf: 'fünf',
    glucklich: 'glücklich',
    zuruck: 'zurück',
    // ── EXCLUDED (the umlaut-less form IS another common German word) ──────────
    //   schon/schön (schon = "already"), wurde/würde, mochte/möchte, mochten/möchten,
    //   hatte/hätte, konnte/könnte, musste/müsste, durfte/dürfte, wusste/wüsste,
    //   ware/wäre (+ Ware = goods), wahlen/wählen (Wahlen = elections),
    //   zahlen/zählen (zahlen = to pay), lauft/läuft (ihr lauft), hort/hört (Hort),
    //   spat/spät (Spat = mineral), gluck/glück (Gluck = the composer's surname).
    //   Also EXCLUDED über/uber: collides with the brand "Uber" (case-insensitive match)
    //   — when in doubt, exclude (the file's own rule).
  },
};

// Remove the marker keys with '_' (they never match: normalize does not produce '_') that only
// exist to avoid literal duplicates above.
for (const lang of Object.keys(DICTS)) {
  for (const k of Object.keys(DICTS[lang])) if (k.includes('_')) delete DICTS[lang][k];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Regexes PRE-COMPILED per-language once at load (not per message). `restoreAccents`
// is on the hot path; recompiling dozens of RegExp with \p{...}+lookbehind on every message
// (88 in pt alone) was wasted CPU. Built AFTER the cleanup of '_' keys above.
const COMPILED_DICTS: Record<string, ReadonlyArray<readonly [RegExp, string]>> = {};
for (const lang of Object.keys(DICTS)) {
  COMPILED_DICTS[lang] = Object.keys(DICTS[lang]).map((key) => [
    new RegExp(`(?<=^|[^\\p{L}\\p{N}])${escapeRegExp(key)}(?=[^\\p{L}\\p{N}]|$)`, 'giu'),
    DICTS[lang][key],
  ]);
}

/** Applies the capitalization of `sample` (the matched token) to the accented form `accented`. */
function matchCase(sample: string, accented: string): string {
  if (sample === sample.toUpperCase() && sample !== sample.toLowerCase()) {
    return accented.toUpperCase(); // ALL UPPERCASE
  }
  if (sample[0] === sample[0].toUpperCase() && sample[0] !== sample[0].toLowerCase()) {
    return accented[0].toUpperCase() + accented.slice(1); // First-uppercase
  }
  return accented; // lowercase
}

/**
 * Restores the accents of the known words of `lang` (ISO 639-3 code) in `text`.
 * No-op if `lang` has no dictionary. Matches on WORD BOUNDARY
 * (`[^\p{L}\p{N}]`), case-insensitive, preserving capitalization. PURE.
 */
export function restoreAccents(text: string, lang: string): string {
  const compiled = COMPILED_DICTS[lang];
  if (!compiled) return text;
  let out = text;
  for (const [pattern, accented] of compiled) {
    out = out.replace(pattern, (m) => matchCase(m, accented));
  }
  return out;
}

/**
 * ISO 639-3 code (for `restoreAccents`) from a Piper model name, but
 * ONLY for the languages with an accent dictionary (otherwise ''). Used in the FIXED-voice
 * path (detection OFF), where the language comes from the chosen voice, not the text.
 */
export function accentLangOfModel(model: string): string {
  const us = model.indexOf('_');
  const prefix = us === -1 ? '' : model.slice(0, us); // 'pt', 'es', 'fr', 'de'…
  const map: Record<string, string> = { pt: 'por', es: 'spa', fr: 'fra', de: 'deu' };
  return map[prefix.toLowerCase()] ?? '';
}
