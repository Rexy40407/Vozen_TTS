import { GREET_LANGUAGE_CHOICES } from '../voice/greeting';

export interface CastEntry {
  readonly id: string;
  readonly label: string;
}

export interface CastTheme {
  readonly key: string;
  readonly label: string;
  readonly entries: readonly CastEntry[];
}

export interface CastMember {
  readonly id: string;
  readonly displayName: string;
  readonly bot?: boolean;
}

export interface CastAssignment {
  readonly userId: string;
  readonly displayName: string;
  readonly entry: CastEntry;
}

/** The interactive picker deliberately stays below Discord's 25-option limit. */
export const CAST_LANGUAGE_CHOICES = GREET_LANGUAGE_CHOICES.map((choice) => ({ ...choice }));

const entry = (label: string): CastEntry => ({
  id: label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, ''),
  label,
});

const pack = (key: string, label: string, labels: readonly string[]): CastTheme => ({
  key,
  label,
  entries: labels.map(entry),
});

/**
 * Content is intentionally text-only. Franchise names are kept only in the bot's
 * selector/content pack; no images, logos, quotes, or copied descriptions are used.
 * The other packs are generic or Vozen-original archetypes.
 */
export const CAST_THEMES: readonly CastTheme[] = [
  pack('pokemon', 'Pokémon', [
    'Bulbasaur',
    'Ivysaur',
    'Venusaur',
    'Charmander',
    'Charmeleon',
    'Charizard',
    'Squirtle',
    'Wartortle',
    'Blastoise',
    'Caterpie',
    'Butterfree',
    'Pikachu',
    'Raichu',
    'Vulpix',
    'Jigglypuff',
    'Zubat',
    'Psyduck',
    'Growlithe',
    'Slowpoke',
    'Gengar',
    'Onix',
    'Voltorb',
    'Koffing',
    'Rhyhorn',
    'Chansey',
    'Scyther',
    'Magikarp',
    'Eevee',
    'Vaporeon',
    'Jolteon',
    'Flareon',
    'Snorlax',
    'Dratini',
    'Mewtwo',
    'Mew',
    'Chikorita',
    'Cyndaquil',
    'Totodile',
    'Togepi',
    'Mareep',
    'Umbreon',
    'Espeon',
    'Lugia',
    'Ho-Oh',
    'Treecko',
    'Torchic',
    'Mudkip',
    'Ralts',
    'Gardevoir',
    'Absol',
    'Lucario',
    'Gible',
    'Shinx',
    'Riolu',
    'Zorua',
    'Rowlet',
    'Litten',
    'Popplio',
    'Rockruff',
    'Mimikyu',
    'Sprigatito',
  ]),
  pack('anime', 'Anime', [
    'The quiet swordsman',
    'The cheerful pilot',
    'The sleepy shrine keeper',
    'The chaotic inventor',
    'The loyal rival',
    'The masked tactician',
    'The tiny powerhouse',
    'The mysterious transfer student',
    'The dramatic chef',
    'The time-travelling detective',
    'The gentle giant',
    'The storm caller',
    'The fearless captain',
    'The bookish mage',
    'The runaway prince',
    'The rooftop dreamer',
    'The mischievous spirit',
    'The calm strategist',
    'The hot-headed drummer',
    'The moonlit archer',
    'The accidental hero',
    'The undefeated gamer',
    'The wandering healer',
    'The starship mechanic',
    'The shy shapeshifter',
    'The café owner with secrets',
    'The optimistic rookie',
    'The ancient guardian',
    'The festival performer',
    'The one-eyed librarian',
  ]),
  pack('heroes', 'Hero archetypes', [
    'The solar guardian',
    'The midnight sentinel',
    'The elastic acrobat',
    'The gravity runner',
    'The shield bearer',
    'The soundwave hero',
    'The invisible scout',
    'The weather defender',
    'The clever sidekick',
    'The time keeper',
    'The iron-hearted medic',
    'The portal jumper',
    'The lightning protector',
    'The underwater rescuer',
    'The cosmic ranger',
    'The plant-powered hero',
    'The stealth expert',
    'The gadget builder',
    'The flame wielder',
    'The frost defender',
    'The mirror mage',
    'The luck champion',
    'The dream walker',
    'The gravity guardian',
    'The tiny titan',
    'The soundless spy',
    'The kinetic fighter',
    'The star navigator',
    'The shield maker',
    'The city protector',
  ]),
  pack('fantasy', 'Fantasy roles', [
    'Wizard',
    'Ranger',
    'Bard',
    'Healer',
    'Alchemist',
    'Blacksmith',
    'Druid',
    'Paladin',
    'Rogue',
    'Monk',
    'Cartographer',
    'Dragon rider',
    'Potion maker',
    'Treasure hunter',
    'Rune keeper',
    'Castle chef',
    'Beast tamer',
    'Sky pirate',
    'Village sage',
    'Forest guardian',
    'Crystal miner',
    'Spell librarian',
    'Quest planner',
    'Dungeon guide',
    'Enchanted tailor',
    'Royal messenger',
    'Moon priest',
    'Storm knight',
    'Goblin diplomat',
    'Portal architect',
  ]),
  pack('animals', 'Animals', [
    'Fox',
    'Red panda',
    'Otter',
    'Penguin',
    'Capybara',
    'Raccoon',
    'Dolphin',
    'Owl',
    'Turtle',
    'Hedgehog',
    'Koala',
    'Llama',
    'Elephant',
    'Giraffe',
    'Frog',
    'Axolotl',
    'Butterfly',
    'Bee',
    'Cat',
    'Dog',
    'Wolf',
    'Bear',
    'Panda',
    'Parrot',
    'Rabbit',
    'Squirrel',
    'Seal',
    'Meerkat',
    'Sloth',
    'Tiger',
  ]),
  pack('food', 'Food and desserts', [
    'Pizza',
    'Sushi',
    'Taco',
    'Pancake',
    'Waffle',
    'Cupcake',
    'Donut',
    'Cookie',
    'Brownie',
    'Ice cream',
    'Popcorn',
    'Pretzel',
    'Ramen',
    'Burger',
    'Sandwich',
    'Pasta',
    'Dumpling',
    'Mango',
    'Strawberry',
    'Watermelon',
    'Pineapple',
    'Chocolate',
    'Cheesecake',
    'Pudding',
    'Croissant',
    'Toast',
    'Soup',
    'Curry',
    'Burrito',
    'Marshmallow',
  ]),
  pack('space', 'Space', [
    'Comet',
    'Moon',
    'Nebula',
    'Asteroid',
    'Galaxy',
    'Black hole',
    'Rocket',
    'Satellite',
    'Space station',
    'Meteor',
    'Solar flare',
    'Constellation',
    'Planet',
    'Ringed world',
    'Star cluster',
    'Eclipse',
    'Space probe',
    'Aurora',
    'Gravity wave',
    'Cosmic dust',
    'Red giant',
    'White dwarf',
    'Moon rover',
    'Wormhole',
    'Star map',
    'Orbit',
    'Solar sail',
    'Pulsar',
    'Lunar eclipse',
    'Deep-space explorer',
  ]),
  pack('nature', 'Nature and weather', [
    'Thunderstorm',
    'Waterfall',
    'Volcano',
    'Snowflake',
    'Rainbow',
    'Tornado',
    'Sunrise',
    'Moonlight',
    'Ocean wave',
    'Wildflower',
    'Mountain',
    'River',
    'Forest',
    'Desert',
    'Glacier',
    'Firefly',
    'Breeze',
    'Raindrop',
    'Cloud',
    'Sunbeam',
    'Mossy stone',
    'Pine tree',
    'Coral reef',
    'Sand dune',
    'Canyon',
    'Lightning bolt',
    'Autumn leaf',
    'Morning dew',
    'Sea breeze',
    'Starry sky',
  ]),
];

const CAST_THEME_BY_KEY = new Map(CAST_THEMES.map((theme) => [theme.key, theme]));

export function castThemeByKey(key: string): CastTheme | undefined {
  return CAST_THEME_BY_KEY.get(key);
}

/** Pure, deterministic when `random` is injected. */
export function assignCast(
  members: readonly CastMember[],
  themeKey: string,
  random: () => number = Math.random,
): CastAssignment[] {
  const theme = castThemeByKey(themeKey);
  if (!theme) throw new RangeError('Unknown cast theme');

  const humans = members
    .filter((member) => !member.bot)
    .map((member) => ({ ...member }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'en', { sensitivity: 'base' }));
  if (humans.length > theme.entries.length) throw new RangeError('Cast has too many participants');

  const pool = theme.entries.map((item) => item);
  for (let index = pool.length - 1; index > 0; index--) {
    const value = Math.max(0, Math.min(0.999999999, random()));
    const swap = Math.floor(value * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }

  return humans.map((member, index) => ({
    userId: member.id,
    displayName: member.displayName,
    entry: pool[index],
  }));
}

const SPEECH_FOR: Record<string, { is: string; and: string }> = {
  en: { is: 'is', and: 'and' },
  pt: { is: 'é', and: 'e' },
  es: { is: 'es', and: 'y' },
  fr: { is: 'est', and: 'et' },
  de: { is: 'ist', and: 'und' },
  it: { is: 'è', and: 'e' },
  nl: { is: 'is', and: 'en' },
  sv: { is: 'är', and: 'och' },
  da: { is: 'er', and: 'og' },
  fi: { is: 'on', and: 'ja' },
  pl: { is: 'to', and: 'i' },
  ru: { is: '—', and: 'и' },
  uk: { is: '—', and: 'і' },
  tr: { is: 'bir', and: 've' },
  cs: { is: 'je', and: 'a' },
  el: { is: 'είναι', and: 'και' },
  ro: { is: 'este', and: 'și' },
  ca: { is: 'és', and: 'i' },
  hu: { is: 'egy', and: 'és' },
};

function speechClause(assignment: CastAssignment, language: string): string {
  const grammar = SPEECH_FOR[language] ?? SPEECH_FOR.en;
  return `${assignment.displayName} ${grammar.is} ${assignment.entry.label}`.trim();
}

export function buildCastSpeech(assignments: readonly CastAssignment[], language = 'en'): string {
  if (assignments.length === 0) return '';
  const grammar = SPEECH_FOR[language] ?? SPEECH_FOR.en;
  const clauses = assignments.map((assignment) => speechClause(assignment, language));
  if (clauses.length === 1) return `${clauses[0]}.`;
  if (clauses.length === 2) return `${clauses[0]} ${grammar.and} ${clauses[1]}.`;
  return `${clauses.slice(0, -1).join(', ')}, ${grammar.and} ${clauses.at(-1)}.`;
}

/**
 * Splits only at list boundaries where possible. The final fallback is a word
 * boundary so TTS never receives an overlong request.
 */
export function chunkCastSpeech(text: string, maxChars = 260): string[] {
  const source = text.trim();
  if (!source) return [];
  if (source.length <= maxChars) return [source];

  const chunks: string[] = [];
  let remaining = source;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars + 1);
    const boundaries = [
      ...window.matchAll(
        /,\s+(?=[A-ZÀ-Ý])|\s+(?=(?:and|e|y|et|und|och|og|ja|i|și|και|ve)\s+[A-ZÀ-Ý])/gu,
      ),
    ];
    const boundary = boundaries.at(-1)?.index;
    const cut = boundary && boundary > 0 ? boundary : window.lastIndexOf(' ');
    if (cut <= 0) {
      chunks.push(remaining.slice(0, maxChars).trim());
      remaining = remaining.slice(maxChars).trimStart();
    } else {
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trimStart();
    }
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
