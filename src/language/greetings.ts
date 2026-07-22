/**
 * Lexico de SAUDACOES / palavras curtas comuns -> lingua (codigo ISO 639-3).
 *
 * PORQUE existe: o `franc` (deteccao por trigramas) NAO consegue decidir a lingua
 * de texto muito curto — devolve 'und' para 1-3 letras ("ola", "oi", "hi") e chega
 * a errar em frases curtas ("ola tudo bem" -> Tok Pisin, "ciao come stai" ->
 * portugues). Forcar o franc com `only`/`minLength` baixo NAO ajuda: ele escolhe
 * um palpite CONFIANTE mas errado ("ola" -> turco, "sim" -> servio). Verificado
 * empiricamente com franc v5.
 *
 * A solucao correta para o texto curto e um lexico curado: mapeia as saudacoes e
 * palavras-marca mais comuns (na PROPRIA lingua, com e sem acento) para o codigo da
 * lingua. E baseado no TEXTO (nao no locale do cliente Discord), por isso funciona
 * tanto no /tts como na leitura automatica de canal (onde nao ha locale do user).
 *
 * REGRAS anti-colisao: so entram tokens FORTEMENTE associados a uma lingua. Tokens
 * ambiguos entre linguas ("ok", "no", "si", "ja", "dag", "hej") sao DELIBERADAMENTE
 * deixados de fora — caem no franc (texto longo) ou na voz preferida. Isto aplica-se
 * TAMBEM a linguas de script proprio que partilham o MESMO script entre si (ex.
 * arabe/persa em Perso-Arabico, ou russo/ucraniano/cazaque/servio em Cirilico): um
 * token so entra se for INEQUIVOCAMENTE de uma so lingua, mesmo sem colidir com o
 * lexico Latino existente (ver auditoria em docs/SPEECH-DATA-AUDIT.md e
 * docs/speech-data/lexicon-candidates.json — o gate de colisao e POR SCRIPT
 * PARTILHADO, nao so contra as entradas Latinas ja existentes).
 *
 * FIX (auditoria i18n/locale — docs/I18N-LOCALE-AUDIT.md §1): 'hej'->'swe' e
 * 'tak'->'dan' foram REMOVIDOS do lexico abaixo por violarem esta MESMA regra
 * anti-colisao que este comentario descreve:
 *  - 'hej' e citado LITERALMENTE pelo comentario acima como exemplo de token
 *    ambiguo a excluir (e tambem saudacao comum em dinamarques/norueguesa) — mas
 *    estava mapeado para 'swe', fazendo "hej" isolado (a saudacao mais comum do
 *    dinamarques) sair sempre em voz sueca. TRADE-OFF explicito: remover isto faz
 *    "hej" sueco cair no franc (incerto) em vez de bater sempre errado para
 *    dinamarques/noruegues — troca um falso-positivo deterministico por uma
 *    incerteza; sem telemetria para decidir qual erro e mais comum, a base
 *    documentada do proprio ficheiro (nomeia "hej" explicitamente) inclina para a
 *    remocao.
 *  - 'tak' e a palavra dinamarquesa para "obrigado", mas tambem significa "sim" em
 *    POLACO (resposta afirmativa curtissima e muito comum) — o polaco ja tem
 *    cobertura propria no lexico (cześć/dzień dobry/dziękuję), por isso um "tak"
 *    isolado escrito por um utilizador polaco saia sempre em voz dinamarquesa.
 *    Mesma logica anti-colisao do caso 'hej', aplicada por extensao (nao citada
 *    literalmente no comentario original).
 * A entrada correspondente foi tambem removida de GREETING_INITIAL (abaixo).
 * 'hejsan'/'tack' (sueco) e 'hejsa' (dinamarques) NAO foram tocados — sao tokens
 * mais longos e distintivos, nao citados pela regra anti-colisao.
 *
 * Os codigos devolvidos existem TODOS em LANG_TO_PREFIX (voiceMap.ts), senao a
 * escolha de voz nao encontraria modelo. PURO: sem efeitos secundarios.
 */

/**
 * Palavra/expressao normalizada -> codigo ISO 639-3. Chaves em minusculas, sem
 * pontuacao (o `normalize` abaixo poe o input no mesmo formato antes de procurar).
 * Inclui variantes com e sem acento porque muita gente escreve sem acentos.
 *
 * NOTA de estilo: chaves Latinas de 1 palavra ficam sem aspas (estilo original do
 * ficheiro); chaves com espacos ou em scripts nao-Latinos (Grego/Cirilico/Arabe/
 * Georgiano/Devanagari/CJK) vao SEMPRE entre aspas — nao é necessário (identificadores
 * JS aceitam letras Unicode), mas evita depender disso sem poder compilar/testar aqui.
 *
 * NOTA critica de codificacao: as procuras NAO usam este objeto diretamente — usam
 * `LEXICON_NFC` (ver mais abaixo), que normaliza estas chaves para NFC UMA VEZ ao
 * carregar o modulo. Isto fecha por construcao o risco de uma chave aqui ter sido
 * gravada em NFD (visualmente indistinguivel de NFC ao reler o ficheiro) e nunca
 * bater com o INPUT (que `normalize()` tambem poe em NFC antes de comparar).
 */
const LEXICON: Record<string, string> = {
  // ── Portugues (por) ────────────────────────────────────────────────────────
  ola: 'por',
  olá: 'por',
  oi: 'por',
  oie: 'por',
  opa: 'por',
  alo: 'por',
  alô: 'por',
  'bom dia': 'por',
  'boa tarde': 'por',
  'boa noite': 'por',
  'tudo bem': 'por',
  'tudo bom': 'por',
  'como estas': 'por',
  'como estás': 'por',
  obrigado: 'por',
  obrigada: 'por',
  obg: 'por',
  'muito obrigado': 'por',
  'muito obrigada': 'por',
  valeu: 'por',
  'de nada': 'por',
  sim: 'por',
  não: 'por',
  nao: 'por',
  claro: 'por',
  tchau: 'por',
  adeus: 'por',
  'ate logo': 'por',
  'até logo': 'por',
  'ate ja': 'por',
  'até já': 'por',
  beleza: 'por',
  'e ai': 'por',
  'e aí': 'por',

  // ── Ingles (eng) ───────────────────────────────────────────────────────────
  hi: 'eng',
  hey: 'eng',
  hello: 'eng',
  helo: 'eng',
  yo: 'eng',
  sup: 'eng',
  hiya: 'eng',
  heya: 'eng',
  thanks: 'eng',
  'thank you': 'eng',
  thx: 'eng',
  cheers: 'eng',
  please: 'eng',
  'good morning': 'eng',
  'good night': 'eng',
  'good evening': 'eng',
  'good afternoon': 'eng',
  yeah: 'eng',
  yep: 'eng',
  yup: 'eng',
  nope: 'eng',
  bye: 'eng',
  goodbye: 'eng',
  'see you': 'eng',

  // ── Espanhol (spa) ─────────────────────────────────────────────────────────
  hola: 'spa',
  buenas: 'spa',
  'buenos dias': 'spa',
  'buenos días': 'spa',
  'buenas tardes': 'spa',
  'buenas noches': 'spa',
  'hola que tal': 'spa',
  'que tal': 'spa',
  'qué tal': 'spa',
  gracias: 'spa',
  'muchas gracias': 'spa',
  adios: 'spa',
  adiós: 'spa',
  'hasta luego': 'spa',

  // ── Frances (fra) ──────────────────────────────────────────────────────────
  salut: 'fra',
  bonjour: 'fra',
  bonsoir: 'fra',
  coucou: 'fra',
  merci: 'fra',
  'merci beaucoup': 'fra',
  'au revoir': 'fra',
  oui: 'fra',
  'ca va': 'fra',
  'ça va': 'fra',
  'comment ca va': 'fra',
  'comment ça va': 'fra',
  'bonne nuit': 'fra',

  // ── Alemao (deu) ───────────────────────────────────────────────────────────
  hallo: 'deu',
  servus: 'deu',
  moin: 'deu',
  'guten tag': 'deu',
  'guten morgen': 'deu',
  'guten abend': 'deu',
  'gute nacht': 'deu',
  danke: 'deu',
  'danke schön': 'deu',
  'danke schon': 'deu',
  tschüss: 'deu',
  tschuss: 'deu',
  'auf wiedersehen': 'deu',
  nein: 'deu',

  // ── Italiano (ita) ─────────────────────────────────────────────────────────
  ciao: 'ita',
  salve: 'ita',
  buongiorno: 'ita',
  buonasera: 'ita',
  buonanotte: 'ita',
  grazie: 'ita',
  'grazie mille': 'ita',
  prego: 'ita',
  arrivederci: 'ita',
  'ciao come stai': 'ita',
  'come stai': 'ita',

  // ── Neerlandes (nld) ───────────────────────────────────────────────────────
  hoi: 'nld',
  doei: 'nld',
  'dank je': 'nld',
  'dank u': 'nld',
  bedankt: 'nld',
  goedemorgen: 'nld',
  goedenavond: 'nld',
  'tot ziens': 'nld',

  // ── Outras linguas com voz Piper (saudacoes-chave) ─────────────────────────
  cześć: 'pol',
  czesc: 'pol',
  'dzień dobry': 'pol',
  'dzien dobry': 'pol',
  dziękuję: 'pol',
  dziekuje: 'pol',
  merhaba: 'tur',
  selam: 'tur',
  teşekkürler: 'tur',
  tesekkurler: 'tur',
  hejsan: 'swe',
  tack: 'swe',
  hei: 'fin',
  moikka: 'fin',
  kiitos: 'fin',
  hejsa: 'dan',
  bună: 'ron',
  buna: 'ron',
  mulțumesc: 'ron',
  multumesc: 'ron',
  'bon dia': 'cat',
  gràcies: 'cat',
  gracies: 'cat',

  // ── FIX (auditoria TTS — fecha G1, docs/SPEECH-DATA-AUDIT.md §3): saudacoes
  // curtas para linguas que tinham modelo/prefixo mas NENHUM token de lexico —
  // caiam sempre no franc, que erra em texto curto (voz errada). Curadoria em
  // docs/speech-data/lexicon-candidates.json, com um gate de colisao adicional
  // aplicado aqui: POR SCRIPT PARTILHADO (nao so contra o lexico Latino), porque
  // arabe/persa partilham o Perso-Arabico e russo/ucraniano/cazaque/servio
  // partilham o Cirilico. Tokens ambiguos ENTRE ESSAS linguas foram excluidos
  // (ver notas por bloco); os incluidos sao inequivocos de UMA so lingua.
  //
  // Script proprio, mapeamento 1:1 nesta lista (sem outra lingua do lote a
  // partilhar o script) — risco de colisao estrutural zero:
  // Grego (ell)
  γεια: 'ell',
  'γεια σου': 'ell',
  καλημέρα: 'ell',
  καλησπέρα: 'ell',
  ευχαριστώ: 'ell',
  // Georgiano (kat)
  გამარჯობა: 'kat',
  მადლობა: 'kat',
  'დილა მშვიდობისა': 'kat',
  // Nepali/Devanagari (nep) — ATENCAO: estas chaves usam marcas combinantes
  // (virama/vogais) que NAO tem forma precomposta — `normalize()` tem de
  // PRESERVAR \p{M} (nao so \p{L}) para estas baterem certo (ver FIX abaixo).
  नमस्ते: 'nep',
  नमस्कार: 'nep',
  धन्यवाद: 'nep',
  // Chines (cmn)
  你好: 'cmn',
  您好: 'cmn',
  谢谢: 'cmn',
  早上好: 'cmn',
  晚安: 'cmn',

  // Cirilico — russo (rus), ucraniano (ukr), cazaque (kaz), servio (srp).
  // Verificado SEM duplicados exatos entre as 4 listas (ortografias distintas:
  // rus 'привет' vs ukr 'привіт'; kaz usa letras proprias ә/қ/ң; srp usa palavras
  // proprias). Nenhum token ambiguo entre estas 4 linguas foi encontrado.
  привет: 'rus',
  здравствуйте: 'rus',
  спасибо: 'rus',
  пока: 'rus',
  'доброе утро': 'rus',
  привіт: 'ukr',
  вітаю: 'ukr',
  дякую: 'ukr',
  'добрий день': 'ukr',
  'доброго ранку': 'ukr',
  сәлем: 'kaz',
  'сәлеметсіз бе': 'kaz',
  рахмет: 'kaz',
  'қайырлы таң': 'kaz',
  здраво: 'srp',
  'добар дан': 'srp',
  'добро јутро': 'srp',
  хвала: 'srp',

  // Perso-Arabico partilhado entre arabe (ara) e persa (fas) — PRUNADO: excluidos
  // tokens usados em AMBAS as linguas (ex. 'سلام' e 'السلام عليكم' sao saudacoes
  // comuns tanto ao arabe como ao persa falado — ambiguo, por isso NAO entram).
  // Mantidos so os inequivocamente de uma lingua.
  مرحبا: 'ara',
  شكرا: 'ara',
  'صباح الخير': 'ara',
  'مساء الخير': 'ara',
  درود: 'fas',
  ممنون: 'fas',
  'صبح بخیر': 'fas',
  خداحافظ: 'fas',

  // Script Latino — subconjunto CURADO do candidato (docs/speech-data/lexicon-
  // candidates.json), excluindo tokens sinalizados como ambiguos ENTRE linguas do
  // proprio lote (ex. 'ahoj'/'čau' partilhados por checo/eslovaco; 'helló'
  // proximo de 'helo'->eng; 'halló' proximo de 'hallo'->deu; 'merci' colide com
  // frances; 'zdravo'/'hvala' colidem com servio). Confirmado tambem SEM colisao
  // contra as entradas Latinas ja existentes acima.
  // Checo (ces)
  'dobrý den': 'ces',
  děkuji: 'ces',
  nazdar: 'ces',
  // Hungaro (hun)
  'jó napot': 'hun',
  köszönöm: 'hun',
  szia: 'hun',
  sziasztok: 'hun',
  // Gales (cym)
  shwmae: 'cym',
  'bore da': 'cym',
  diolch: 'cym',
  'noswaith dda': 'cym',
  // Islandes (isl)
  'góðan dag': 'isl',
  'góðan daginn': 'isl',
  takk: 'isl',
  sæl: 'isl',
  // Luxemburgues (ltz)
  moien: 'ltz',
  äddi: 'ltz',
  // Letao (lav)
  sveiki: 'lav',
  labdien: 'lav',
  labrīt: 'lav',
  paldies: 'lav',
  // Eslovaco (slk) — distinto do checo por diacritico ('deň' vs 'den')
  'dobrý deň': 'slk',
  ďakujem: 'slk',
  // Esloveno (slv) — evita 'zdravo'/'hvala' (colidem com servio)
  živjo: 'slv',
  'dober dan': 'slv',
  // Suaili (swh)
  habari: 'swh',
  jambo: 'swh',
  asante: 'swh',
  karibu: 'swh',
  mambo: 'swh',
  // Vietnamita (vie) — diacriticos tornam-nos distintivos
  'xin chào': 'vie',
  'chào bạn': 'vie',
  'cảm ơn': 'vie',
  'chào buổi sáng': 'vie',
};

/**
 * Tokens que podem LIDERAR uma frase curta (saudacao inicial). Quando o texto tem
 * poucas palavras e comeca por uma destas, assume-se a lingua da saudacao — resolve
 * "ola tudo bem", "hello there my friend", "ciao come stai" (onde o franc erra) sem
 * depender de casar a frase inteira. So SAUDACOES puras entram aqui (nao "sim"/"ok"),
 * para nao rotular mal frases que comecam por uma afirmacao. So tokens de UMA
 * palavra entram (a regra so olha para o 1.º token da frase).
 *
 * FIX (auditoria TTS — bug de alinhamento G2, docs/SPEECH-DATA-AUDIT.md §3): 'buna'/
 * 'bună' (romeno) e 'hejsa' (dinamarques) ja existiam como entradas de TOKEN UNICO em
 * LEXICON (por isso "buna" ou "hejsa" sozinhos ja funcionavam via passo (2) de
 * lookupShortLang), mas nao lideravam frase curta — "buna ce faci"/"hejsa alle sammen"
 * caiam no franc, que erra em texto curto. Sao SEGURAS de adicionar aqui: nao sao
 * tokens novos (ja estao em LEXICON, ja passaram a regra anti-colisao), so passam a
 * poder liderar uma frase de ate 4 palavras, tal como as restantes saudacoes puras.
 *
 * FIX (auditoria TTS — fecha G1): lideres de saudacao de UMA palavra para as linguas
 * acrescentadas ao LEXICON acima (so as que sao SAUDACOES puras, nao "obrigado"/
 * "thanks"-like; frases de saudacao com >1 palavra, ex. 'dobrý deň'/'xin chào', NAO
 * entram aqui por definicao — ficam apanhadas so pelo match de frase inteira).
 *
 * FIX (auditoria i18n/locale — docs/I18N-LOCALE-AUDIT.md §1): 'hej' removido deste
 * Set (e do LEXICON acima) — era citado literalmente pela regra anti-colisao do
 * ficheiro como token a excluir. Ver comentario no topo do ficheiro para o
 * trade-off completo.
 */
const GREETING_INITIAL = new Set<string>([
  'ola',
  'olá',
  'oi',
  'oie',
  'opa',
  'alo',
  'alô',
  'hi',
  'hey',
  'hello',
  'helo',
  'yo',
  'hiya',
  'heya',
  'sup',
  'hola',
  'buenas',
  'salut',
  'bonjour',
  'bonsoir',
  'coucou',
  'hallo',
  'servus',
  'moin',
  'ciao',
  'salve',
  'hoi',
  'cześć',
  'czesc',
  'merhaba',
  'selam',
  'hejsan',
  'hei',
  'moikka',
  'buna',
  'bună',
  'hejsa',
  // G1 — linguas novas (lideres de 1 palavra, so saudacoes puras).
  'γεια',
  'καλημέρα',
  'καλησπέρα',
  'გამარჯობა',
  'नमस्ते',
  'नमस्कार',
  '你好',
  '您好',
  'привет',
  'здравствуйте',
  'привіт',
  'вітаю',
  'сәлем',
  'здраво',
  'مرحبا',
  'درود',
  'nazdar',
  'szia',
  'sziasztok',
  'shwmae',
  'sæl',
  'moien',
  'sveiki',
  'živjo',
  'habari',
  'jambo',
  'karibu',
  'mambo',
]);

/**
 * FIX (auditoria TTS — fecha por CONSTRUCAO o risco de forma Unicode das chaves-
 * fonte): normaliza `LEXICON`/`GREETING_INITIAL` para NFC UMA VEZ ao carregar o
 * modulo, em vez de confiar que cada literal foi gravado em NFC no ficheiro-fonte.
 * Uma releitura visual do ficheiro NAO consegue distinguir NFC de NFD (renderizam
 * identicamente) — sem isto, uma chave gravada em NFD ficaria silenciosamente
 * inacessivel (o INPUT e posto em NFC por `normalize()`, mas a chave nunca era
 * tocada). `lookupShortLang` procura SEMPRE nestes mapas normalizados, nunca nos
 * objetos/Set originais. Para as ~340 entradas Latinas/Cirilicas/etc. ja existentes
 * isto e um no-op (ja estavam em NFC); para Devanagari (sem forma precomposta) e
 * tambem um no-op (`\p{M}` em `normalize()` e quem resolve esse caso — ver mais
 * abaixo). Cobre o caso intermedio: scripts COM forma precomposta (Latino
 * acentuado, Grego tonico, Vietnamita) onde a chave podia ter sido gravada em NFD.
 */
const LEXICON_NFC: Record<string, string> = Object.fromEntries(
  Object.entries(LEXICON).map(([token, lang]) => [token.normalize('NFC'), lang]),
);
const GREETING_INITIAL_NFC = new Set<string>(
  [...GREETING_INITIAL].map((token) => token.normalize('NFC')),
);

/** Nº maximo de palavras para aplicar a regra da saudacao-inicial. */
const MAX_GREETING_PHRASE_TOKENS = 4;

/**
 * Normaliza o texto para procura no lexico: NFC (junta marcas combinantes na forma
 * precomposta quando existe), minusculas, pontuacao/simbolos -> espaco, espacos
 * colapsados, trim. Mantem letras acentuadas, MARCAS COMBINANTES e numeros.
 * Ex.: "Olá, tudo bem?" -> "olá tudo bem".
 *
 * FIX (auditoria TTS — bug bloqueante apanhado em revisao antes de fechar a tarefa):
 * a versao anterior só mantinha `\p{L}` (Letter) — as marcas combinantes (`\p{M}`,
 * categoria Mn/Mc) eram apagadas (substituidas por espaco). Isso e inofensivo para
 * Latino/Cirilico/Grego/CJK precomposto, mas PARTIA silenciosamente o Devanagari
 * (nepali): 'नमस्ते' nao tem forma precomposta de 1 codepoint por letra — a virama
 * (्) e as vogais dependentes (े) SAO marcas combinantes SEMPRE presentes. Sem
 * `\p{M}` no conjunto mantido, `normalize('नमस्ते')` dava 'नमस त' (com espacos a
 * meio) em vez de 'नमस्ते', e a chave do LEXICON nunca batia — `lookupShortLang`
 * devolvia '' para as 3 entradas nepali (nunca 'nep'), apesar de estarem no
 * ficheiro. `.normalize('NFC')` adicional junta marcas destacaveis (ex. acentos
 * Latinos/Gregos/Vietnamitas escritos em NFD) à forma precomposta ANTES da procura;
 * combinado com `LEXICON_NFC`/`GREETING_INITIAL_NFC` acima (que aplicam a MESMA
 * normalizacao as chaves), o input bate com a chave seja qual for a forma Unicode em
 * que cada um chegou/foi gravado. Comportamento INALTERADO para todas as entradas
 * anteriores (nenhuma tem marca combinante solta nem depende de NFD/NFC diferente).
 */
function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deteta a lingua de texto CURTO por lexico de saudacoes/palavras comuns.
 * Devolve o codigo ISO 639-3 ou '' se nao reconhecer (o chamador cai no franc).
 *
 * Ordem: (1) frase inteira no lexico; (2) token unico no lexico; (3) frase curta
 * (<= 4 palavras) que COMECA por uma saudacao conhecida. PURO.
 */
export function lookupShortLang(text: string): string {
  const norm = normalize(text);
  if (!norm) return '';

  // (1) frase inteira (ex. "bom dia", "hola que tal").
  const whole = LEXICON_NFC[norm];
  if (whole) return whole;

  const tokens = norm.split(' ');

  // (2) token unico (ex. "ola", "hello").
  if (tokens.length === 1) return LEXICON_NFC[tokens[0]] ?? '';

  // (3) frase curta iniciada por saudacao (ex. "ola tudo bem", "ciao come stai").
  if (tokens.length <= MAX_GREETING_PHRASE_TOKENS && GREETING_INITIAL_NFC.has(tokens[0])) {
    return LEXICON_NFC[tokens[0]] ?? '';
  }

  return '';
}
