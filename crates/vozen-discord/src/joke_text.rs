//! Canonical multilingual joke catalog ported from `src/content/jokes.ts`.
//!
//! The key, prefix, ordering and seeded selection intentionally match Node.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct JokeLanguage {
    pub key: &'static str,
    pub prefix: &'static str,
    pub display: &'static str,
    pub jokes: &'static [&'static str],
}

pub static JOKE_LANGUAGES: &[JokeLanguage] = &[
    JokeLanguage {
        key: "ar",
        prefix: "ar_",
        display: "Arabic",
        jokes: &[
            "ماذا قال الصفر للثمانية؟ يا له من حزام جميل!",
            "لماذا كان كتاب الرياضيات حزينًا؟ لأن لديه الكثير من المسائل.",
        ],
    },
    JokeLanguage {
        key: "ca",
        prefix: "ca_",
        display: "Catalan",
        jokes: &[
            "Què li diu un zero a un vuit? Quin cinturó més bonic!",
            "Per què estava trist el llibre de mates? Perquè tenia molts problemes.",
        ],
    },
    JokeLanguage {
        key: "zh",
        prefix: "zh_",
        display: "Chinese",
        jokes: &[
            "为什么数学书不开心？因为它有太多问题。",
            "零对八说了什么？你的腰带真好看！",
        ],
    },
    JokeLanguage {
        key: "cs",
        prefix: "cs_",
        display: "Czech",
        jokes: &[
            "Co řekla nula osmičce? Pěkný pásek!",
            "Proč byla kniha matematiky smutná? Měla moc problémů.",
        ],
    },
    JokeLanguage {
        key: "cy",
        prefix: "cy_",
        display: "Welsh",
        jokes: &[
            "Beth ddywedodd sero wrth wyth? Belt hyfryd!",
            "Pam roedd y llyfr mathemateg yn drist? Roedd ganddo lawer o broblemau.",
        ],
    },
    JokeLanguage {
        key: "da",
        prefix: "da_",
        display: "Danish",
        jokes: &[
            "Hvad sagde nullet til ottetallet? Sikke et flot bælte!",
            "Hvorfor var matematikbogen ked af det? Den havde for mange problemer.",
        ],
    },
    JokeLanguage {
        key: "nl",
        prefix: "nl_",
        display: "Dutch",
        jokes: &[
            "Wat doet een koe op een aardbeving? Milkshake.",
            "Waarom kunnen skeletten niet liegen? Je kijkt zo door ze heen.",
        ],
    },
    JokeLanguage {
        key: "en",
        prefix: "en_",
        display: "English",
        jokes: &[
            "Why did the scarecrow win an award? He was outstanding in his field.",
            "I told my computer I needed a break, and now it won't stop sending me KitKats.",
            "Why don't scientists trust atoms? Because they make up everything.",
        ],
    },
    JokeLanguage {
        key: "fi",
        prefix: "fi_",
        display: "Finnish",
        jokes: &[
            "Mitä nolla sanoi kahdeksalle? Hieno vyö!",
            "Miksi matematiikan kirja oli surullinen? Siinä oli liikaa ongelmia.",
        ],
    },
    JokeLanguage {
        key: "fr",
        prefix: "fr_",
        display: "French",
        jokes: &[
            "Que dit un escargot quand il croise une limace ? Regarde, un nudiste !",
            "Quel est le comble pour un électricien ? De ne pas être au courant.",
            "Pourquoi les poissons détestent l’ordinateur ? À cause du Net.",
        ],
    },
    JokeLanguage {
        key: "ka",
        prefix: "ka_",
        display: "Georgian",
        jokes: &[
            "რა უთხრა ნულმა რვას? რა ლამაზი ქამარი გაქვს!",
            "რატომ იყო მათემატიკის წიგნი მოწყენილი? ბევრი პრობლემა ჰქონდა.",
        ],
    },
    JokeLanguage {
        key: "de",
        prefix: "de_",
        display: "German",
        jokes: &[
            "Was macht ein Clown im Büro? Faxen.",
            "Was ist orange und klingt wie ein Papagei? Eine Karotte.",
            "Warum können Bienen so gut rechnen? Weil sie summen.",
        ],
    },
    JokeLanguage {
        key: "el",
        prefix: "el_",
        display: "Greek",
        jokes: &[
            "Τι είπε το μηδέν στο οκτώ; Ωραία ζώνη!",
            "Γιατί ήταν λυπημένο το βιβλίο των μαθηματικών; Είχε πολλά προβλήματα.",
        ],
    },
    JokeLanguage {
        key: "hu",
        prefix: "hu_",
        display: "Hungarian",
        jokes: &[
            "Mit mondott a nulla a nyolcasnak? Milyen szép öv!",
            "Miért volt szomorú a matekkönyv? Mert sok problémája volt.",
        ],
    },
    JokeLanguage {
        key: "is",
        prefix: "is_",
        display: "Icelandic",
        jokes: &[
            "Hvað sagði núllið við áttuna? Flott belti!",
            "Af hverju var stærðfræðibókin leið? Hún átti of mörg vandamál.",
        ],
    },
    JokeLanguage {
        key: "it",
        prefix: "it_",
        display: "Italian",
        jokes: &[
            "Qual è il colmo per un elettricista? Non avere santi in paradiso, ma tanti contatti.",
            "Cosa fa un pesce quando pensa? Rimane in scia.",
            "Come si chiama un boomerang che non torna? Un bastone.",
        ],
    },
    JokeLanguage {
        key: "ja",
        prefix: "ja_",
        display: "Japanese",
        jokes: &[
            "布団が吹っ飛んだ。",
            "電話に出んわ。",
            "ゼロが8に言いました。素敵なベルトだね！",
        ],
    },
    JokeLanguage {
        key: "kk",
        prefix: "kk_",
        display: "Kazakh",
        jokes: &[
            "Нөл сегізге не деді? Белдігің әдемі екен!",
            "Математика кітабы неге көңілсіз болды? Себебі оның мәселесі көп еді.",
        ],
    },
    JokeLanguage {
        key: "lv",
        prefix: "lv_",
        display: "Latvian",
        jokes: &[
            "Ko nulle teica astotniekam? Skaista josta!",
            "Kāpēc matemātikas grāmata bija skumja? Tai bija pārāk daudz problēmu.",
        ],
    },
    JokeLanguage {
        key: "lb",
        prefix: "lb_",
        display: "Luxembourgish",
        jokes: &[
            "Wat sot d’Null zu der Aacht? Schéine Rimm!",
            "Firwat war d’Mathésbuch traureg? Et hat ze vill Problemer.",
        ],
    },
    JokeLanguage {
        key: "ne",
        prefix: "ne_",
        display: "Nepali",
        jokes: &[
            "शून्यले आठलाई के भन्यो? राम्रो पेटी!",
            "गणितको किताब किन दुःखी थियो? किनकि यसमा धेरै समस्या थिए।",
        ],
    },
    JokeLanguage {
        key: "fa",
        prefix: "fa_",
        display: "Persian",
        jokes: &[
            "صفر به هشت چه گفت؟ چه کمربند قشنگی!",
            "چرا کتاب ریاضی ناراحت بود؟ چون مشکلات زیادی داشت.",
        ],
    },
    JokeLanguage {
        key: "pl",
        prefix: "pl_",
        display: "Polish",
        jokes: &[
            "Co zero powiedziało ósemce? Ładny pasek!",
            "Dlaczego książka do matematyki była smutna? Bo miała za dużo problemów.",
        ],
    },
    JokeLanguage {
        key: "pt",
        prefix: "pt_",
        display: "Portuguese",
        jokes: &[
            "Porque é que o livro de matemática estava triste? Porque tinha muitos problemas.",
            "O que é que o zero disse ao oito? Belo cinto!",
            "Sabes qual é o cúmulo da paciência? Um careca a fazer a risca ao meio.",
        ],
    },
    JokeLanguage {
        key: "ro",
        prefix: "ro_",
        display: "Romanian",
        jokes: &[
            "Ce i-a spus zero lui opt? Frumoasă centură!",
            "De ce era tristă cartea de matematică? Avea prea multe probleme.",
        ],
    },
    JokeLanguage {
        key: "ru",
        prefix: "ru_",
        display: "Russian",
        jokes: &[
            "Почему компьютер простудился? Потому что забыл закрыть окна.",
            "Что сказал ноль восьмёрке? Классный ремень!",
        ],
    },
    JokeLanguage {
        key: "sr",
        prefix: "sr_",
        display: "Serbian",
        jokes: &[
            "Шта је нула рекла осмици? Леп каиш!",
            "Зашто је књига из математике била тужна? Имала је превише проблема.",
        ],
    },
    JokeLanguage {
        key: "sk",
        prefix: "sk_",
        display: "Slovak",
        jokes: &[
            "Čo povedala nula osmičke? Pekný opasok!",
            "Prečo bola kniha matematiky smutná? Mala priveľa problémov.",
        ],
    },
    JokeLanguage {
        key: "sl",
        prefix: "sl_",
        display: "Slovenian",
        jokes: &[
            "Kaj je ničla rekla osmici? Lep pas!",
            "Zakaj je bila knjiga matematike žalostna? Ker je imela preveč težav.",
        ],
    },
    JokeLanguage {
        key: "es",
        prefix: "es_",
        display: "Spanish",
        jokes: &[
            "¿Qué hace una abeja en el gimnasio? Zum-ba.",
            "¿Cómo se despiden los químicos? Ácido un placer.",
            "¿Qué le dice un cero a un ocho? ¡Bonito cinturón!",
        ],
    },
    JokeLanguage {
        key: "sw",
        prefix: "sw_",
        display: "Swahili",
        jokes: &[
            "Sifuri alimwambia nini nane? Mkanda mzuri!",
            "Kwa nini kitabu cha hesabu kilikuwa na huzuni? Kwa sababu kilikuwa na matatizo mengi.",
        ],
    },
    JokeLanguage {
        key: "sv",
        prefix: "sv_",
        display: "Swedish",
        jokes: &[
            "Vad sa nollan till åttan? Snygg skärp!",
            "Varför var matteboken ledsen? Den hade för många problem.",
        ],
    },
    JokeLanguage {
        key: "tr",
        prefix: "tr_",
        display: "Turkish",
        jokes: &[
            "Sıfır sekize ne demiş? Ne güzel kemerin var!",
            "Matematik kitabı neden üzgündü? Çünkü çok fazla problemi vardı.",
        ],
    },
    JokeLanguage {
        key: "uk",
        prefix: "uk_",
        display: "Ukrainian",
        jokes: &[
            "Чому комп’ютер застудився? Бо не закрив вікна.",
            "Що сказав нуль вісімці? Гарний пояс!",
        ],
    },
    JokeLanguage {
        key: "vi",
        prefix: "vi_",
        display: "Vietnamese",
        jokes: &[
            "Số không nói gì với số tám? Thắt lưng đẹp đấy!",
            "Tại sao quyển sách toán buồn? Vì nó có quá nhiều bài toán.",
        ],
    },
];

#[must_use]
pub fn joke_lang_by_key(key: &str) -> Option<&'static JokeLanguage> {
    JOKE_LANGUAGES.iter().find(|language| language.key == key)
}

#[must_use]
pub fn pick_joke(language: &str, seed: i64) -> &'static str {
    let jokes = joke_lang_by_key(language)
        .map(|language| language.jokes)
        .unwrap_or_else(|| joke_lang_by_key("en").expect("English joke catalog").jokes);
    jokes[seed.rem_euclid(jokes.len() as i64) as usize]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_the_node_language_catalogue_and_seeded_fallback() {
        assert_eq!(JOKE_LANGUAGES.len(), 35);
        assert_eq!(joke_lang_by_key("pt").expect("Portuguese").prefix, "pt_");
        assert_eq!(
            pick_joke("en", 0),
            "Why did the scarecrow win an award? He was outstanding in his field."
        );
        assert_eq!(pick_joke("missing", 0), pick_joke("en", 0));
        assert_eq!(
            pick_joke("en", -1),
            "Why don't scientists trust atoms? Because they make up everything."
        );
    }
}
