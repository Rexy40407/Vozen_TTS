//! Pure /cast content, assignment and speech formatting.
//!
//! The lists intentionally mirror `src/content/cast.ts`; the gateway adapter can therefore
//! be promoted without making Discord users depend on Node-owned randomization.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CastEntry {
    pub id: &'static str,
    pub label: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CastTheme {
    pub key: &'static str,
    pub label: &'static str,
    pub entries: &'static [CastEntry],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CastMember {
    pub id: String,
    pub display_name: String,
    pub bot: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CastAssignment {
    pub user_id: String,
    pub display_name: String,
    pub entry: CastEntry,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CastLanguage {
    pub name: &'static str,
    pub value: &'static str,
}

pub const CAST_LANGUAGE_CHOICES: &[CastLanguage] = &[
    CastLanguage {
        name: "English",
        value: "en",
    },
    CastLanguage {
        name: "Português",
        value: "pt",
    },
    CastLanguage {
        name: "Español",
        value: "es",
    },
    CastLanguage {
        name: "Français",
        value: "fr",
    },
    CastLanguage {
        name: "Deutsch",
        value: "de",
    },
    CastLanguage {
        name: "Italiano",
        value: "it",
    },
    CastLanguage {
        name: "Nederlands",
        value: "nl",
    },
    CastLanguage {
        name: "Svenska",
        value: "sv",
    },
    CastLanguage {
        name: "Dansk",
        value: "da",
    },
    CastLanguage {
        name: "Suomi",
        value: "fi",
    },
    CastLanguage {
        name: "Polski",
        value: "pl",
    },
    CastLanguage {
        name: "Русский",
        value: "ru",
    },
    CastLanguage {
        name: "Українська",
        value: "uk",
    },
    CastLanguage {
        name: "Türkçe",
        value: "tr",
    },
    CastLanguage {
        name: "Čeština",
        value: "cs",
    },
    CastLanguage {
        name: "Ελληνικά",
        value: "el",
    },
    CastLanguage {
        name: "Română",
        value: "ro",
    },
    CastLanguage {
        name: "Català",
        value: "ca",
    },
    CastLanguage {
        name: "Magyar",
        value: "hu",
    },
];

pub const CAST_THEMES: &[CastTheme] = &[
    CastTheme {
        key: "pokemon",
        label: "Pokémon",
        entries: &[
            CastEntry {
                id: "bulbasaur",
                label: "Bulbasaur",
            },
            CastEntry {
                id: "ivysaur",
                label: "Ivysaur",
            },
            CastEntry {
                id: "venusaur",
                label: "Venusaur",
            },
            CastEntry {
                id: "charmander",
                label: "Charmander",
            },
            CastEntry {
                id: "charmeleon",
                label: "Charmeleon",
            },
            CastEntry {
                id: "charizard",
                label: "Charizard",
            },
            CastEntry {
                id: "squirtle",
                label: "Squirtle",
            },
            CastEntry {
                id: "wartortle",
                label: "Wartortle",
            },
            CastEntry {
                id: "blastoise",
                label: "Blastoise",
            },
            CastEntry {
                id: "caterpie",
                label: "Caterpie",
            },
            CastEntry {
                id: "butterfree",
                label: "Butterfree",
            },
            CastEntry {
                id: "pikachu",
                label: "Pikachu",
            },
            CastEntry {
                id: "raichu",
                label: "Raichu",
            },
            CastEntry {
                id: "vulpix",
                label: "Vulpix",
            },
            CastEntry {
                id: "jigglypuff",
                label: "Jigglypuff",
            },
            CastEntry {
                id: "zubat",
                label: "Zubat",
            },
            CastEntry {
                id: "psyduck",
                label: "Psyduck",
            },
            CastEntry {
                id: "growlithe",
                label: "Growlithe",
            },
            CastEntry {
                id: "slowpoke",
                label: "Slowpoke",
            },
            CastEntry {
                id: "gengar",
                label: "Gengar",
            },
            CastEntry {
                id: "onix",
                label: "Onix",
            },
            CastEntry {
                id: "voltorb",
                label: "Voltorb",
            },
            CastEntry {
                id: "koffing",
                label: "Koffing",
            },
            CastEntry {
                id: "rhyhorn",
                label: "Rhyhorn",
            },
            CastEntry {
                id: "chansey",
                label: "Chansey",
            },
            CastEntry {
                id: "scyther",
                label: "Scyther",
            },
            CastEntry {
                id: "magikarp",
                label: "Magikarp",
            },
            CastEntry {
                id: "eevee",
                label: "Eevee",
            },
            CastEntry {
                id: "vaporeon",
                label: "Vaporeon",
            },
            CastEntry {
                id: "jolteon",
                label: "Jolteon",
            },
            CastEntry {
                id: "flareon",
                label: "Flareon",
            },
            CastEntry {
                id: "snorlax",
                label: "Snorlax",
            },
            CastEntry {
                id: "dratini",
                label: "Dratini",
            },
            CastEntry {
                id: "mewtwo",
                label: "Mewtwo",
            },
            CastEntry {
                id: "mew",
                label: "Mew",
            },
            CastEntry {
                id: "chikorita",
                label: "Chikorita",
            },
            CastEntry {
                id: "cyndaquil",
                label: "Cyndaquil",
            },
            CastEntry {
                id: "totodile",
                label: "Totodile",
            },
            CastEntry {
                id: "togepi",
                label: "Togepi",
            },
            CastEntry {
                id: "mareep",
                label: "Mareep",
            },
            CastEntry {
                id: "umbreon",
                label: "Umbreon",
            },
            CastEntry {
                id: "espeon",
                label: "Espeon",
            },
            CastEntry {
                id: "lugia",
                label: "Lugia",
            },
            CastEntry {
                id: "ho-oh",
                label: "Ho-Oh",
            },
            CastEntry {
                id: "treecko",
                label: "Treecko",
            },
            CastEntry {
                id: "torchic",
                label: "Torchic",
            },
            CastEntry {
                id: "mudkip",
                label: "Mudkip",
            },
            CastEntry {
                id: "ralts",
                label: "Ralts",
            },
            CastEntry {
                id: "gardevoir",
                label: "Gardevoir",
            },
            CastEntry {
                id: "absol",
                label: "Absol",
            },
            CastEntry {
                id: "lucario",
                label: "Lucario",
            },
            CastEntry {
                id: "gible",
                label: "Gible",
            },
            CastEntry {
                id: "shinx",
                label: "Shinx",
            },
            CastEntry {
                id: "riolu",
                label: "Riolu",
            },
            CastEntry {
                id: "zorua",
                label: "Zorua",
            },
            CastEntry {
                id: "rowlet",
                label: "Rowlet",
            },
            CastEntry {
                id: "litten",
                label: "Litten",
            },
            CastEntry {
                id: "popplio",
                label: "Popplio",
            },
            CastEntry {
                id: "rockruff",
                label: "Rockruff",
            },
            CastEntry {
                id: "mimikyu",
                label: "Mimikyu",
            },
            CastEntry {
                id: "sprigatito",
                label: "Sprigatito",
            },
        ],
    },
    CastTheme {
        key: "anime",
        label: "Anime",
        entries: &[
            CastEntry {
                id: "the-quiet-swordsman",
                label: "The quiet swordsman",
            },
            CastEntry {
                id: "the-cheerful-pilot",
                label: "The cheerful pilot",
            },
            CastEntry {
                id: "the-sleepy-shrine-keeper",
                label: "The sleepy shrine keeper",
            },
            CastEntry {
                id: "the-chaotic-inventor",
                label: "The chaotic inventor",
            },
            CastEntry {
                id: "the-loyal-rival",
                label: "The loyal rival",
            },
            CastEntry {
                id: "the-masked-tactician",
                label: "The masked tactician",
            },
            CastEntry {
                id: "the-tiny-powerhouse",
                label: "The tiny powerhouse",
            },
            CastEntry {
                id: "the-mysterious-transfer-student",
                label: "The mysterious transfer student",
            },
            CastEntry {
                id: "the-dramatic-chef",
                label: "The dramatic chef",
            },
            CastEntry {
                id: "the-time-travelling-detective",
                label: "The time-travelling detective",
            },
            CastEntry {
                id: "the-gentle-giant",
                label: "The gentle giant",
            },
            CastEntry {
                id: "the-storm-caller",
                label: "The storm caller",
            },
            CastEntry {
                id: "the-fearless-captain",
                label: "The fearless captain",
            },
            CastEntry {
                id: "the-bookish-mage",
                label: "The bookish mage",
            },
            CastEntry {
                id: "the-runaway-prince",
                label: "The runaway prince",
            },
            CastEntry {
                id: "the-rooftop-dreamer",
                label: "The rooftop dreamer",
            },
            CastEntry {
                id: "the-mischievous-spirit",
                label: "The mischievous spirit",
            },
            CastEntry {
                id: "the-calm-strategist",
                label: "The calm strategist",
            },
            CastEntry {
                id: "the-hot-headed-drummer",
                label: "The hot-headed drummer",
            },
            CastEntry {
                id: "the-moonlit-archer",
                label: "The moonlit archer",
            },
            CastEntry {
                id: "the-accidental-hero",
                label: "The accidental hero",
            },
            CastEntry {
                id: "the-undefeated-gamer",
                label: "The undefeated gamer",
            },
            CastEntry {
                id: "the-wandering-healer",
                label: "The wandering healer",
            },
            CastEntry {
                id: "the-starship-mechanic",
                label: "The starship mechanic",
            },
            CastEntry {
                id: "the-shy-shapeshifter",
                label: "The shy shapeshifter",
            },
            CastEntry {
                id: "the-caf-owner-with-secrets",
                label: "The café owner with secrets",
            },
            CastEntry {
                id: "the-optimistic-rookie",
                label: "The optimistic rookie",
            },
            CastEntry {
                id: "the-ancient-guardian",
                label: "The ancient guardian",
            },
            CastEntry {
                id: "the-festival-performer",
                label: "The festival performer",
            },
            CastEntry {
                id: "the-one-eyed-librarian",
                label: "The one-eyed librarian",
            },
        ],
    },
    CastTheme {
        key: "heroes",
        label: "Hero archetypes",
        entries: &[
            CastEntry {
                id: "the-solar-guardian",
                label: "The solar guardian",
            },
            CastEntry {
                id: "the-midnight-sentinel",
                label: "The midnight sentinel",
            },
            CastEntry {
                id: "the-elastic-acrobat",
                label: "The elastic acrobat",
            },
            CastEntry {
                id: "the-gravity-runner",
                label: "The gravity runner",
            },
            CastEntry {
                id: "the-shield-bearer",
                label: "The shield bearer",
            },
            CastEntry {
                id: "the-soundwave-hero",
                label: "The soundwave hero",
            },
            CastEntry {
                id: "the-invisible-scout",
                label: "The invisible scout",
            },
            CastEntry {
                id: "the-weather-defender",
                label: "The weather defender",
            },
            CastEntry {
                id: "the-clever-sidekick",
                label: "The clever sidekick",
            },
            CastEntry {
                id: "the-time-keeper",
                label: "The time keeper",
            },
            CastEntry {
                id: "the-iron-hearted-medic",
                label: "The iron-hearted medic",
            },
            CastEntry {
                id: "the-portal-jumper",
                label: "The portal jumper",
            },
            CastEntry {
                id: "the-lightning-protector",
                label: "The lightning protector",
            },
            CastEntry {
                id: "the-underwater-rescuer",
                label: "The underwater rescuer",
            },
            CastEntry {
                id: "the-cosmic-ranger",
                label: "The cosmic ranger",
            },
            CastEntry {
                id: "the-plant-powered-hero",
                label: "The plant-powered hero",
            },
            CastEntry {
                id: "the-stealth-expert",
                label: "The stealth expert",
            },
            CastEntry {
                id: "the-gadget-builder",
                label: "The gadget builder",
            },
            CastEntry {
                id: "the-flame-wielder",
                label: "The flame wielder",
            },
            CastEntry {
                id: "the-frost-defender",
                label: "The frost defender",
            },
            CastEntry {
                id: "the-mirror-mage",
                label: "The mirror mage",
            },
            CastEntry {
                id: "the-luck-champion",
                label: "The luck champion",
            },
            CastEntry {
                id: "the-dream-walker",
                label: "The dream walker",
            },
            CastEntry {
                id: "the-gravity-guardian",
                label: "The gravity guardian",
            },
            CastEntry {
                id: "the-tiny-titan",
                label: "The tiny titan",
            },
            CastEntry {
                id: "the-soundless-spy",
                label: "The soundless spy",
            },
            CastEntry {
                id: "the-kinetic-fighter",
                label: "The kinetic fighter",
            },
            CastEntry {
                id: "the-star-navigator",
                label: "The star navigator",
            },
            CastEntry {
                id: "the-shield-maker",
                label: "The shield maker",
            },
            CastEntry {
                id: "the-city-protector",
                label: "The city protector",
            },
        ],
    },
    CastTheme {
        key: "fantasy",
        label: "Fantasy roles",
        entries: &[
            CastEntry {
                id: "wizard",
                label: "Wizard",
            },
            CastEntry {
                id: "ranger",
                label: "Ranger",
            },
            CastEntry {
                id: "bard",
                label: "Bard",
            },
            CastEntry {
                id: "healer",
                label: "Healer",
            },
            CastEntry {
                id: "alchemist",
                label: "Alchemist",
            },
            CastEntry {
                id: "blacksmith",
                label: "Blacksmith",
            },
            CastEntry {
                id: "druid",
                label: "Druid",
            },
            CastEntry {
                id: "paladin",
                label: "Paladin",
            },
            CastEntry {
                id: "rogue",
                label: "Rogue",
            },
            CastEntry {
                id: "monk",
                label: "Monk",
            },
            CastEntry {
                id: "cartographer",
                label: "Cartographer",
            },
            CastEntry {
                id: "dragon-rider",
                label: "Dragon rider",
            },
            CastEntry {
                id: "potion-maker",
                label: "Potion maker",
            },
            CastEntry {
                id: "treasure-hunter",
                label: "Treasure hunter",
            },
            CastEntry {
                id: "rune-keeper",
                label: "Rune keeper",
            },
            CastEntry {
                id: "castle-chef",
                label: "Castle chef",
            },
            CastEntry {
                id: "beast-tamer",
                label: "Beast tamer",
            },
            CastEntry {
                id: "sky-pirate",
                label: "Sky pirate",
            },
            CastEntry {
                id: "village-sage",
                label: "Village sage",
            },
            CastEntry {
                id: "forest-guardian",
                label: "Forest guardian",
            },
            CastEntry {
                id: "crystal-miner",
                label: "Crystal miner",
            },
            CastEntry {
                id: "spell-librarian",
                label: "Spell librarian",
            },
            CastEntry {
                id: "quest-planner",
                label: "Quest planner",
            },
            CastEntry {
                id: "dungeon-guide",
                label: "Dungeon guide",
            },
            CastEntry {
                id: "enchanted-tailor",
                label: "Enchanted tailor",
            },
            CastEntry {
                id: "royal-messenger",
                label: "Royal messenger",
            },
            CastEntry {
                id: "moon-priest",
                label: "Moon priest",
            },
            CastEntry {
                id: "storm-knight",
                label: "Storm knight",
            },
            CastEntry {
                id: "goblin-diplomat",
                label: "Goblin diplomat",
            },
            CastEntry {
                id: "portal-architect",
                label: "Portal architect",
            },
        ],
    },
    CastTheme {
        key: "animals",
        label: "Animals",
        entries: &[
            CastEntry {
                id: "fox",
                label: "Fox",
            },
            CastEntry {
                id: "red-panda",
                label: "Red panda",
            },
            CastEntry {
                id: "otter",
                label: "Otter",
            },
            CastEntry {
                id: "penguin",
                label: "Penguin",
            },
            CastEntry {
                id: "capybara",
                label: "Capybara",
            },
            CastEntry {
                id: "raccoon",
                label: "Raccoon",
            },
            CastEntry {
                id: "dolphin",
                label: "Dolphin",
            },
            CastEntry {
                id: "owl",
                label: "Owl",
            },
            CastEntry {
                id: "turtle",
                label: "Turtle",
            },
            CastEntry {
                id: "hedgehog",
                label: "Hedgehog",
            },
            CastEntry {
                id: "koala",
                label: "Koala",
            },
            CastEntry {
                id: "llama",
                label: "Llama",
            },
            CastEntry {
                id: "elephant",
                label: "Elephant",
            },
            CastEntry {
                id: "giraffe",
                label: "Giraffe",
            },
            CastEntry {
                id: "frog",
                label: "Frog",
            },
            CastEntry {
                id: "axolotl",
                label: "Axolotl",
            },
            CastEntry {
                id: "butterfly",
                label: "Butterfly",
            },
            CastEntry {
                id: "bee",
                label: "Bee",
            },
            CastEntry {
                id: "cat",
                label: "Cat",
            },
            CastEntry {
                id: "dog",
                label: "Dog",
            },
            CastEntry {
                id: "wolf",
                label: "Wolf",
            },
            CastEntry {
                id: "bear",
                label: "Bear",
            },
            CastEntry {
                id: "panda",
                label: "Panda",
            },
            CastEntry {
                id: "parrot",
                label: "Parrot",
            },
            CastEntry {
                id: "rabbit",
                label: "Rabbit",
            },
            CastEntry {
                id: "squirrel",
                label: "Squirrel",
            },
            CastEntry {
                id: "seal",
                label: "Seal",
            },
            CastEntry {
                id: "meerkat",
                label: "Meerkat",
            },
            CastEntry {
                id: "sloth",
                label: "Sloth",
            },
            CastEntry {
                id: "tiger",
                label: "Tiger",
            },
        ],
    },
    CastTheme {
        key: "food",
        label: "Food and desserts",
        entries: &[
            CastEntry {
                id: "pizza",
                label: "Pizza",
            },
            CastEntry {
                id: "sushi",
                label: "Sushi",
            },
            CastEntry {
                id: "taco",
                label: "Taco",
            },
            CastEntry {
                id: "pancake",
                label: "Pancake",
            },
            CastEntry {
                id: "waffle",
                label: "Waffle",
            },
            CastEntry {
                id: "cupcake",
                label: "Cupcake",
            },
            CastEntry {
                id: "donut",
                label: "Donut",
            },
            CastEntry {
                id: "cookie",
                label: "Cookie",
            },
            CastEntry {
                id: "brownie",
                label: "Brownie",
            },
            CastEntry {
                id: "ice-cream",
                label: "Ice cream",
            },
            CastEntry {
                id: "popcorn",
                label: "Popcorn",
            },
            CastEntry {
                id: "pretzel",
                label: "Pretzel",
            },
            CastEntry {
                id: "ramen",
                label: "Ramen",
            },
            CastEntry {
                id: "burger",
                label: "Burger",
            },
            CastEntry {
                id: "sandwich",
                label: "Sandwich",
            },
            CastEntry {
                id: "pasta",
                label: "Pasta",
            },
            CastEntry {
                id: "dumpling",
                label: "Dumpling",
            },
            CastEntry {
                id: "mango",
                label: "Mango",
            },
            CastEntry {
                id: "strawberry",
                label: "Strawberry",
            },
            CastEntry {
                id: "watermelon",
                label: "Watermelon",
            },
            CastEntry {
                id: "pineapple",
                label: "Pineapple",
            },
            CastEntry {
                id: "chocolate",
                label: "Chocolate",
            },
            CastEntry {
                id: "cheesecake",
                label: "Cheesecake",
            },
            CastEntry {
                id: "pudding",
                label: "Pudding",
            },
            CastEntry {
                id: "croissant",
                label: "Croissant",
            },
            CastEntry {
                id: "toast",
                label: "Toast",
            },
            CastEntry {
                id: "soup",
                label: "Soup",
            },
            CastEntry {
                id: "curry",
                label: "Curry",
            },
            CastEntry {
                id: "burrito",
                label: "Burrito",
            },
            CastEntry {
                id: "marshmallow",
                label: "Marshmallow",
            },
        ],
    },
    CastTheme {
        key: "space",
        label: "Space",
        entries: &[
            CastEntry {
                id: "comet",
                label: "Comet",
            },
            CastEntry {
                id: "moon",
                label: "Moon",
            },
            CastEntry {
                id: "nebula",
                label: "Nebula",
            },
            CastEntry {
                id: "asteroid",
                label: "Asteroid",
            },
            CastEntry {
                id: "galaxy",
                label: "Galaxy",
            },
            CastEntry {
                id: "black-hole",
                label: "Black hole",
            },
            CastEntry {
                id: "rocket",
                label: "Rocket",
            },
            CastEntry {
                id: "satellite",
                label: "Satellite",
            },
            CastEntry {
                id: "space-station",
                label: "Space station",
            },
            CastEntry {
                id: "meteor",
                label: "Meteor",
            },
            CastEntry {
                id: "solar-flare",
                label: "Solar flare",
            },
            CastEntry {
                id: "constellation",
                label: "Constellation",
            },
            CastEntry {
                id: "planet",
                label: "Planet",
            },
            CastEntry {
                id: "ringed-world",
                label: "Ringed world",
            },
            CastEntry {
                id: "star-cluster",
                label: "Star cluster",
            },
            CastEntry {
                id: "eclipse",
                label: "Eclipse",
            },
            CastEntry {
                id: "space-probe",
                label: "Space probe",
            },
            CastEntry {
                id: "aurora",
                label: "Aurora",
            },
            CastEntry {
                id: "gravity-wave",
                label: "Gravity wave",
            },
            CastEntry {
                id: "cosmic-dust",
                label: "Cosmic dust",
            },
            CastEntry {
                id: "red-giant",
                label: "Red giant",
            },
            CastEntry {
                id: "white-dwarf",
                label: "White dwarf",
            },
            CastEntry {
                id: "moon-rover",
                label: "Moon rover",
            },
            CastEntry {
                id: "wormhole",
                label: "Wormhole",
            },
            CastEntry {
                id: "star-map",
                label: "Star map",
            },
            CastEntry {
                id: "orbit",
                label: "Orbit",
            },
            CastEntry {
                id: "solar-sail",
                label: "Solar sail",
            },
            CastEntry {
                id: "pulsar",
                label: "Pulsar",
            },
            CastEntry {
                id: "lunar-eclipse",
                label: "Lunar eclipse",
            },
            CastEntry {
                id: "deep-space-explorer",
                label: "Deep-space explorer",
            },
        ],
    },
    CastTheme {
        key: "nature",
        label: "Nature and weather",
        entries: &[
            CastEntry {
                id: "thunderstorm",
                label: "Thunderstorm",
            },
            CastEntry {
                id: "waterfall",
                label: "Waterfall",
            },
            CastEntry {
                id: "volcano",
                label: "Volcano",
            },
            CastEntry {
                id: "snowflake",
                label: "Snowflake",
            },
            CastEntry {
                id: "rainbow",
                label: "Rainbow",
            },
            CastEntry {
                id: "tornado",
                label: "Tornado",
            },
            CastEntry {
                id: "sunrise",
                label: "Sunrise",
            },
            CastEntry {
                id: "moonlight",
                label: "Moonlight",
            },
            CastEntry {
                id: "ocean-wave",
                label: "Ocean wave",
            },
            CastEntry {
                id: "wildflower",
                label: "Wildflower",
            },
            CastEntry {
                id: "mountain",
                label: "Mountain",
            },
            CastEntry {
                id: "river",
                label: "River",
            },
            CastEntry {
                id: "forest",
                label: "Forest",
            },
            CastEntry {
                id: "desert",
                label: "Desert",
            },
            CastEntry {
                id: "glacier",
                label: "Glacier",
            },
            CastEntry {
                id: "firefly",
                label: "Firefly",
            },
            CastEntry {
                id: "breeze",
                label: "Breeze",
            },
            CastEntry {
                id: "raindrop",
                label: "Raindrop",
            },
            CastEntry {
                id: "cloud",
                label: "Cloud",
            },
            CastEntry {
                id: "sunbeam",
                label: "Sunbeam",
            },
            CastEntry {
                id: "mossy-stone",
                label: "Mossy stone",
            },
            CastEntry {
                id: "pine-tree",
                label: "Pine tree",
            },
            CastEntry {
                id: "coral-reef",
                label: "Coral reef",
            },
            CastEntry {
                id: "sand-dune",
                label: "Sand dune",
            },
            CastEntry {
                id: "canyon",
                label: "Canyon",
            },
            CastEntry {
                id: "lightning-bolt",
                label: "Lightning bolt",
            },
            CastEntry {
                id: "autumn-leaf",
                label: "Autumn leaf",
            },
            CastEntry {
                id: "morning-dew",
                label: "Morning dew",
            },
            CastEntry {
                id: "sea-breeze",
                label: "Sea breeze",
            },
            CastEntry {
                id: "starry-sky",
                label: "Starry sky",
            },
        ],
    },
];

pub const CAST_WAIT_MS: i64 = 120_000;
pub const CAST_MAX_MEMBERS: usize = 25;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CastAction {
    Theme,
    Language,
    Engine,
    Reveal,
    Cancel,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CastSession {
    pub user_id: String,
    pub guild_id: String,
    pub channel_id: String,
    pub voice_channel_id: String,
    pub theme_key: Option<String>,
    pub language: String,
    pub engine: String,
    pub issued_at_ms: i64,
}

impl CastSession {
    #[must_use]
    pub fn valid_at(&self, now_ms: i64) -> bool {
        now_ms >= self.issued_at_ms && now_ms.saturating_sub(self.issued_at_ms) <= CAST_WAIT_MS
    }
}

/// Parses the exact component ID shape emitted by the Rust cast panel. Arbitrary IDs are never
/// accepted as a session key, preventing one user's controls from mutating another flow.
pub fn parse_cast_component_id(custom_id: &str) -> Option<(CastAction, String)> {
    let mut parts = custom_id.split(':');
    if parts.next()? != "cast" {
        return None;
    }
    let action = match parts.next()? {
        "theme" => CastAction::Theme,
        "language" => CastAction::Language,
        "engine" => CastAction::Engine,
        "reveal" => CastAction::Reveal,
        "cancel" => CastAction::Cancel,
        _ => return None,
    };
    let session_id = parts.next()?.trim();
    if session_id.is_empty() || parts.next().is_some() {
        return None;
    }
    Some((action, session_id.to_owned()))
}

pub fn cast_theme_by_key(key: &str) -> Option<&'static CastTheme> {
    CAST_THEMES.iter().find(|theme| theme.key == key)
}

/// Fisher-Yates assignment. The callback is injectable so the command contract can be tested
/// without relying on process-global randomness.
pub fn assign_cast<F>(
    members: &[CastMember],
    theme_key: &str,
    mut random: F,
) -> Option<Vec<CastAssignment>>
where
    F: FnMut() -> f64,
{
    let theme = cast_theme_by_key(theme_key)?;
    let mut humans = members
        .iter()
        .filter(|member| !member.bot)
        .cloned()
        .collect::<Vec<_>>();
    humans.sort_by_key(|left| left.display_name.to_lowercase());
    if humans.len() > theme.entries.len() {
        return None;
    }
    let mut pool = theme.entries.to_vec();
    for index in (1..pool.len()).rev() {
        let value = random().clamp(0.0, 0.999_999_999);
        let swap = (value * (index + 1) as f64).floor() as usize;
        pool.swap(index, swap);
    }
    Some(
        humans
            .into_iter()
            .enumerate()
            .map(|(index, member)| CastAssignment {
                user_id: member.id,
                display_name: member.display_name,
                entry: pool[index],
            })
            .collect(),
    )
}

fn grammar(language: &str) -> (&'static str, &'static str) {
    match language {
        "pt" => ("é", "e"),
        "es" => ("es", "y"),
        "fr" => ("est", "et"),
        "de" => ("ist", "und"),
        "it" => ("è", "e"),
        "nl" => ("is", "en"),
        "sv" => ("är", "och"),
        "da" => ("er", "og"),
        "fi" => ("on", "ja"),
        "pl" => ("to", "i"),
        "ru" => ("—", "и"),
        "uk" => ("—", "і"),
        "tr" => ("bir", "ve"),
        "cs" => ("je", "a"),
        "el" => ("είναι", "και"),
        "ro" => ("este", "și"),
        "ca" => ("és", "i"),
        "hu" => ("egy", "és"),
        _ => ("is", "and"),
    }
}

pub fn build_cast_speech(assignments: &[CastAssignment], language: &str) -> String {
    if assignments.is_empty() {
        return String::new();
    }
    let (is, and) = grammar(language);
    let clauses = assignments
        .iter()
        .map(|assignment| {
            format!(
                "{} {} {}",
                assignment.display_name.trim(),
                is,
                assignment.entry.label
            )
        })
        .collect::<Vec<_>>();
    match clauses.as_slice() {
        [single] => format!("{single}."),
        [first, second] => format!("{first} {and} {second}."),
        _ => format!(
            "{}, {} {}.",
            clauses[..clauses.len() - 1].join(", "),
            and,
            clauses[clauses.len() - 1]
        ),
    }
}

/// Keeps TTS requests bounded while preferring sentence/list boundaries.
pub fn chunk_cast_speech(text: &str, max_chars: usize) -> Vec<String> {
    let source = text.trim();
    if source.is_empty() || max_chars == 0 {
        return Vec::new();
    }
    if source.chars().count() <= max_chars {
        return vec![source.to_owned()];
    }
    let mut chunks = Vec::new();
    let mut remaining = source.to_owned();
    while remaining.chars().count() > max_chars {
        let chars = remaining
            .char_indices()
            .take(max_chars + 1)
            .collect::<Vec<_>>();
        let window_end = chars
            .last()
            .map(|(index, ch)| index + ch.len_utf8())
            .unwrap_or(0);
        let window = &remaining[..window_end];
        let mut cut = None;
        for (index, _) in window.match_indices(", ") {
            cut = Some(index);
        }
        if cut.is_none() {
            for (index, _) in window.match_indices(' ') {
                cut = Some(index);
            }
        }
        let cut = cut.filter(|index| *index > 0).unwrap_or_else(|| {
            window
                .char_indices()
                .nth(max_chars)
                .map(|(index, _)| index)
                .unwrap_or(window.len())
        });
        let piece = remaining[..cut].trim();
        if !piece.is_empty() {
            chunks.push(piece.to_owned());
        }
        remaining = remaining[cut..].trim_start().to_owned();
    }
    if !remaining.is_empty() {
        chunks.push(remaining);
    }
    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    fn member(id: &str, name: &str, bot: bool) -> CastMember {
        CastMember {
            id: id.into(),
            display_name: name.into(),
            bot,
        }
    }

    #[test]
    fn mirrors_theme_limits_and_filters_bots() {
        let assigned = assign_cast(
            &[
                member("2", "zeta", false),
                member("1", "Alpha", false),
                member("b", "bot", true),
            ],
            "animals",
            || 0.0,
        )
        .unwrap();
        assert_eq!(assigned.len(), 2);
        assert_eq!(assigned[0].display_name, "Alpha");
        assert_eq!(assigned[1].display_name, "zeta");
    }

    #[test]
    fn rejects_unknown_theme_and_too_many_members() {
        assert!(assign_cast(&[], "missing", || 0.0).is_none());
        let members = (0..31)
            .map(|i| member(&i.to_string(), &i.to_string(), false))
            .collect::<Vec<_>>();
        assert!(assign_cast(&members, "animals", || 0.0).is_none());
    }

    #[test]
    fn speech_uses_localized_joiner_and_is_bounded() {
        let assignments = vec![
            CastAssignment {
                user_id: "1".into(),
                display_name: "Ana".into(),
                entry: CAST_THEMES[0].entries[0],
            },
            CastAssignment {
                user_id: "2".into(),
                display_name: "Bia".into(),
                entry: CAST_THEMES[0].entries[1],
            },
        ];
        assert_eq!(
            build_cast_speech(&assignments, "pt"),
            "Ana é Bulbasaur e Bia é Ivysaur."
        );
        assert!(
            chunk_cast_speech(&"x ".repeat(200), 40)
                .iter()
                .all(|chunk| chunk.chars().count() <= 40)
        );
    }

    #[test]
    fn component_ids_are_strict_and_sessions_expire() {
        assert_eq!(
            parse_cast_component_id("cast:reveal:interaction-1"),
            Some((CastAction::Reveal, "interaction-1".into()))
        );
        assert!(parse_cast_component_id("cast:reveal:").is_none());
        assert!(parse_cast_component_id("cast:reveal:one:extra").is_none());
        let session = CastSession {
            user_id: "user".into(),
            guild_id: "guild".into(),
            channel_id: "channel".into(),
            voice_channel_id: "voice".into(),
            theme_key: None,
            language: "en".into(),
            engine: "piper".into(),
            issued_at_ms: 100,
        };
        assert!(session.valid_at(100 + CAST_WAIT_MS));
        assert!(!session.valid_at(100 + CAST_WAIT_MS + 1));
    }
}
