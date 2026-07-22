/**
 * Banco de PIADAS multilingue + lista de linguas suportadas.
 *
 * Contrato:
 *  - Uma lingua por PREFIXO de locale distinto de LANG_TO_PREFIX (voiceMap.ts) —
 *    35 no total (com o japones 'ja_'). FIX (auditoria i18n/locale — docs/I18N-LOCALE-AUDIT.md §0.2):
 *    o Noruegues ('no_') NAO entra em JOKE_LANGUAGES, mas NAO e por falta de
 *    prefixo/modelo em LANG_TO_PREFIX (esse mapeamento EXISTE — 'nob'/'nno'/'nor'
 *    -> 'no_', ver voiceMap.ts) — e por falta de um corpus de piadas nativas em
 *    noruegues nesta lista. O comentario anterior estava desatualizado (dizia o
 *    contrario) desde que o fix de alinhamento do voiceMap foi aplicado sem
 *    atualizar esta nota. A lista `JOKE_LANGUAGES` e a UNICA fonte de verdade
 *    (autocomplete do /joke, escolha de voz e testes de completude iteram-na).
 *  - `key` estavel (o `value` do autocomplete e o argumento de pickJoke), `prefix`
 *    no formato 'xx_' (para casar com availableModels.startsWith(prefix)) e `display`
 *    em INGLES (para o utilizador anglofono filtrar por substring no autocomplete).
 *  - Cada lingua tem >=1 piada, escrita NATIVAMENTE e no SCRIPT correto (nunca
 *    transliterada). Curtas e SFW para o TTS renderizar limpo.
 *  - `pickJoke(key, seed)` e PURO/DETERMINISTICO: jokes[seed % jokes.length].
 *    Fallback ao ingles para key desconhecida.
 *
 * Curadoria: as piadas de linguas que consegui verificar sao naturais; as restantes
 * usam piadas SIMPLES e universais (sem politica/religiao, inofensivas) — melhores
 * do que arriscar ofensa. Podem ser trocadas por curadoria nativa sem mexer no codigo.
 */

export interface JokeLanguage {
  /** Chave estavel — value do autocomplete e argumento de pickJoke. */
  key: string;
  /** Prefixo de locale 'xx_' (casa com availableModels.startsWith(prefix)). */
  prefix: string;
  /** Nome em INGLES (para o autocomplete filtrar por substring anglofono). */
  display: string;
}

/**
 * As 35 linguas suportadas (prefixos distintos de LANG_TO_PREFIX). Ordenadas por
 * display para uma lista de autocomplete estavel e previsivel.
 */
export const JOKE_LANGUAGES: JokeLanguage[] = [
  { key: 'ar', prefix: 'ar_', display: 'Arabic' },
  { key: 'ca', prefix: 'ca_', display: 'Catalan' },
  { key: 'zh', prefix: 'zh_', display: 'Chinese' },
  { key: 'cs', prefix: 'cs_', display: 'Czech' },
  { key: 'cy', prefix: 'cy_', display: 'Welsh' },
  { key: 'da', prefix: 'da_', display: 'Danish' },
  { key: 'nl', prefix: 'nl_', display: 'Dutch' },
  { key: 'en', prefix: 'en_', display: 'English' },
  { key: 'fi', prefix: 'fi_', display: 'Finnish' },
  { key: 'fr', prefix: 'fr_', display: 'French' },
  { key: 'ka', prefix: 'ka_', display: 'Georgian' },
  { key: 'de', prefix: 'de_', display: 'German' },
  { key: 'el', prefix: 'el_', display: 'Greek' },
  { key: 'hu', prefix: 'hu_', display: 'Hungarian' },
  { key: 'is', prefix: 'is_', display: 'Icelandic' },
  { key: 'it', prefix: 'it_', display: 'Italian' },
  { key: 'ja', prefix: 'ja_', display: 'Japanese' },
  { key: 'kk', prefix: 'kk_', display: 'Kazakh' },
  { key: 'lv', prefix: 'lv_', display: 'Latvian' },
  { key: 'lb', prefix: 'lb_', display: 'Luxembourgish' },
  { key: 'ne', prefix: 'ne_', display: 'Nepali' },
  { key: 'fa', prefix: 'fa_', display: 'Persian' },
  { key: 'pl', prefix: 'pl_', display: 'Polish' },
  { key: 'pt', prefix: 'pt_', display: 'Portuguese' },
  { key: 'ro', prefix: 'ro_', display: 'Romanian' },
  { key: 'ru', prefix: 'ru_', display: 'Russian' },
  { key: 'sr', prefix: 'sr_', display: 'Serbian' },
  { key: 'sk', prefix: 'sk_', display: 'Slovak' },
  { key: 'sl', prefix: 'sl_', display: 'Slovenian' },
  { key: 'es', prefix: 'es_', display: 'Spanish' },
  { key: 'sw', prefix: 'sw_', display: 'Swahili' },
  { key: 'sv', prefix: 'sv_', display: 'Swedish' },
  { key: 'tr', prefix: 'tr_', display: 'Turkish' },
  { key: 'uk', prefix: 'uk_', display: 'Ukrainian' },
  { key: 'vi', prefix: 'vi_', display: 'Vietnamese' },
];

/** Lookup rapido por key (evita .find repetido no handler/testes). */
const BY_KEY: Record<string, JokeLanguage> = Object.fromEntries(
  JOKE_LANGUAGES.map((l) => [l.key, l]),
);

/** Devolve a lingua pela key, ou undefined se desconhecida. PURO. */
export function jokeLangByKey(key: string): JokeLanguage | undefined {
  return BY_KEY[key];
}

/**
 * Banco de piadas por key de lingua. >=1 por lingua, no script nativo. Curtas e SFW.
 * As nao-latinas (ru/uk/kk/sr Cirilico, ar/fa Arabe, ka Georgiano, ne Devanagari,
 * zh Han) estao no script correto — misturar Latim num modelo desses "come" as
 * palavras no Piper.
 */
const JOKES: Record<string, string[]> = {
  // ── Verificadas (naturais) ────────────────────────────────────────────────
  en: [
    'Why did the scarecrow win an award? He was outstanding in his field.',
    "I told my computer I needed a break, and now it won't stop sending me KitKats.",
    "Why don't scientists trust atoms? Because they make up everything.",
  ],
  pt: [
    'Porque é que o livro de matemática estava triste? Porque tinha muitos problemas.',
    'O que é que o zero disse ao oito? Belo cinto!',
    'Sabes qual é o cúmulo da paciência? Um careca a fazer a risca ao meio.',
  ],
  es: [
    '¿Qué hace una abeja en el gimnasio? Zum-ba.',
    '¿Cómo se despiden los químicos? Ácido un placer.',
    '¿Qué le dice un cero a un ocho? ¡Bonito cinturón!',
  ],
  fr: [
    'Que dit un escargot quand il croise une limace ? Regarde, un nudiste !',
    'Quel est le comble pour un électricien ? De ne pas être au courant.',
    'Pourquoi les poissons détestent l’ordinateur ? À cause du Net.',
  ],
  de: [
    'Was macht ein Clown im Büro? Faxen.',
    'Was ist orange und klingt wie ein Papagei? Eine Karotte.',
    'Warum können Bienen so gut rechnen? Weil sie summen.',
  ],
  it: [
    'Qual è il colmo per un elettricista? Non avere santi in paradiso, ma tanti contatti.',
    'Cosa fa un pesce quando pensa? Rimane in scia.',
    'Come si chiama un boomerang che non torna? Un bastone.',
  ],
  nl: [
    'Wat doet een koe op een aardbeving? Milkshake.',
    'Waarom kunnen skeletten niet liegen? Je kijkt zo door ze heen.',
  ],
  ru: [
    'Почему компьютер простудился? Потому что забыл закрыть окна.',
    'Что сказал ноль восьмёрке? Классный ремень!',
  ],
  uk: ['Чому комп’ютер застудився? Бо не закрив вікна.', 'Що сказав нуль вісімці? Гарний пояс!'],
  zh: ['为什么数学书不开心？因为它有太多问题。', '零对八说了什么？你的腰带真好看！'],
  ja: ['布団が吹っ飛んだ。', '電話に出んわ。', 'ゼロが8に言いました。素敵なベルトだね！'],
  // ── Piadas simples e universais (curadoria nativa a melhorar depois) ───────
  ar: [
    'ماذا قال الصفر للثمانية؟ يا له من حزام جميل!',
    'لماذا كان كتاب الرياضيات حزينًا؟ لأن لديه الكثير من المسائل.',
  ],
  ca: [
    'Què li diu un zero a un vuit? Quin cinturó més bonic!',
    'Per què estava trist el llibre de mates? Perquè tenia molts problemes.',
  ],
  cs: [
    'Co řekla nula osmičce? Pěkný pásek!',
    'Proč byla kniha matematiky smutná? Měla moc problémů.',
  ],
  cy: [
    'Beth ddywedodd sero wrth wyth? Belt hyfryd!',
    'Pam roedd y llyfr mathemateg yn drist? Roedd ganddo lawer o broblemau.',
  ],
  da: [
    'Hvad sagde nullet til ottetallet? Sikke et flot bælte!',
    'Hvorfor var matematikbogen ked af det? Den havde for mange problemer.',
  ],
  fi: [
    'Mitä nolla sanoi kahdeksalle? Hieno vyö!',
    'Miksi matematiikan kirja oli surullinen? Siinä oli liikaa ongelmia.',
  ],
  ka: [
    'რა უთხრა ნულმა რვას? რა ლამაზი ქამარი გაქვს!',
    'რატომ იყო მათემატიკის წიგნი მოწყენილი? ბევრი პრობლემა ჰქონდა.',
  ],
  el: [
    'Τι είπε το μηδέν στο οκτώ; Ωραία ζώνη!',
    'Γιατί ήταν λυπημένο το βιβλίο των μαθηματικών; Είχε πολλά προβλήματα.',
  ],
  hu: [
    'Mit mondott a nulla a nyolcasnak? Milyen szép öv!',
    'Miért volt szomorú a matekkönyv? Mert sok problémája volt.',
  ],
  is: [
    'Hvað sagði núllið við áttuna? Flott belti!',
    'Af hverju var stærðfræðibókin leið? Hún átti of mörg vandamál.',
  ],
  kk: [
    'Нөл сегізге не деді? Белдігің әдемі екен!',
    'Математика кітабы неге көңілсіз болды? Себебі оның мәселесі көп еді.',
  ],
  lv: [
    'Ko nulle teica astotniekam? Skaista josta!',
    'Kāpēc matemātikas grāmata bija skumja? Tai bija pārāk daudz problēmu.',
  ],
  lb: [
    'Wat sot d’Null zu der Aacht? Schéine Rimm!',
    'Firwat war d’Mathésbuch traureg? Et hat ze vill Problemer.',
  ],
  ne: [
    'शून्यले आठलाई के भन्यो? राम्रो पेटी!',
    'गणितको किताब किन दुःखी थियो? किनकि यसमा धेरै समस्या थिए।',
  ],
  fa: ['صفر به هشت چه گفت؟ چه کمربند قشنگی!', 'چرا کتاب ریاضی ناراحت بود؟ چون مشکلات زیادی داشت.'],
  pl: [
    'Co zero powiedziało ósemce? Ładny pasek!',
    'Dlaczego książka do matematyki była smutna? Bo miała za dużo problemów.',
  ],
  ro: [
    'Ce i-a spus zero lui opt? Frumoasă centură!',
    'De ce era tristă cartea de matematică? Avea prea multe probleme.',
  ],
  sr: [
    'Шта је нула рекла осмици? Леп каиш!',
    'Зашто је књига из математике била тужна? Имала је превише проблема.',
  ],
  sk: [
    'Čo povedala nula osmičke? Pekný opasok!',
    'Prečo bola kniha matematiky smutná? Mala priveľa problémov.',
  ],
  sl: [
    'Kaj je ničla rekla osmici? Lep pas!',
    'Zakaj je bila knjiga matematike žalostna? Ker je imela preveč težav.',
  ],
  sw: [
    'Sifuri alimwambia nini nane? Mkanda mzuri!',
    'Kwa nini kitabu cha hesabu kilikuwa na huzuni? Kwa sababu kilikuwa na matatizo mengi.',
  ],
  sv: [
    'Vad sa nollan till åttan? Snygg skärp!',
    'Varför var matteboken ledsen? Den hade för många problem.',
  ],
  tr: [
    'Sıfır sekize ne demiş? Ne güzel kemerin var!',
    'Matematik kitabı neden üzgündü? Çünkü çok fazla problemi vardı.',
  ],
  vi: [
    'Số không nói gì với số tám? Thắt lưng đẹp đấy!',
    'Tại sao quyển sách toán buồn? Vì nó có quá nhiều bài toán.',
  ],
};

/**
 * Escolhe uma piada da lingua `langKey` de forma PURA e DETERMINISTICA dado o
 * `seed`: jokes[seed % jokes.length]. Fallback ao ingles se a key for desconhecida.
 * O `seed` em runtime pode ser Date.now(); os testes passam seeds fixos.
 */
export function pickJoke(langKey: string, seed: number): string {
  const jokes = JOKES[langKey] ?? JOKES.en;
  const idx = ((seed % jokes.length) + jokes.length) % jokes.length;
  return jokes[idx];
}
