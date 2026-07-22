/**
 * Bancos de conteúdo dos micro-comandos divertidos falados: /8-ball, /fortune, /fact,
 * /wyr. Cada banco tem versão EN e PT (as mesmas línguas da UI); o chamador escolhe pela
 * língua do utilizador e fala na voz dessa língua (como o /joke). Curto e SFW para o TTS
 * renderizar limpo. As funções pick* são PURAS/DETERMINÍSTICAS (bank[seed % len]); em
 * runtime usa-se Date.now() como seed (variedade sem sacrificar a testabilidade).
 */

export type FunLocale = 'en' | 'pt';

/** Normaliza um locale da UI (pode ser 'pt-BR', 'es', 'de'...) para 'en'|'pt'. */
export function funLocaleOf(locale: string): FunLocale {
  return locale.slice(0, 2).toLowerCase() === 'pt' ? 'pt' : 'en';
}

type Bank = Record<FunLocale, string[]>;

function pick(bank: Bank, locale: FunLocale, seed: number): string {
  const list = bank[locale];
  const idx = ((seed % list.length) + list.length) % list.length;
  return list[idx];
}

// ── Magic 8-Ball ────────────────────────────────────────────────────────────
const EIGHTBALL: Bank = {
  en: [
    'It is certain.',
    'Without a doubt.',
    'Yes, definitely.',
    'You may rely on it.',
    'Most likely.',
    'Outlook good.',
    'Signs point to yes.',
    'Reply hazy, try again.',
    'Ask again later.',
    'Cannot predict now.',
    "Don't count on it.",
    'My reply is no.',
    'Very doubtful.',
    'Absolutely not.',
  ],
  pt: [
    'É certo.',
    'Sem dúvida.',
    'Sim, definitivamente.',
    'Podes contar com isso.',
    'Muito provável.',
    'As perspetivas são boas.',
    'Os sinais apontam que sim.',
    'Resposta nebulosa, tenta outra vez.',
    'Pergunta outra vez mais tarde.',
    'Não consigo prever agora.',
    'Não contes com isso.',
    'A minha resposta é não.',
    'Muito duvidoso.',
    'Nem pensar.',
  ],
};

// ── Sorte / fortune cookie ──────────────────────────────────────────────────
const FORTUNE: Bank = {
  en: [
    'A pleasant surprise is waiting for you.',
    'Your hard work is about to pay off.',
    'A new friend will brighten your week.',
    'Adventure is on the horizon — say yes.',
    'Good news will come from far away.',
    'Trust your gut today; it is right.',
    'Something you lost will find its way back.',
    'A small act of kindness comes back tenfold.',
    'The next opportunity is worth the risk.',
    'Laughter will find you when you least expect it.',
  ],
  pt: [
    'Uma surpresa agradável está à tua espera.',
    'O teu esforço está prestes a dar frutos.',
    'Um novo amigo vai alegrar a tua semana.',
    'A aventura está no horizonte — diz que sim.',
    'Boas notícias virão de longe.',
    'Confia no teu instinto hoje; ele tem razão.',
    'Algo que perdeste vai voltar a ti.',
    'Um pequeno gesto de bondade volta multiplicado.',
    'A próxima oportunidade vale o risco.',
    'O riso vai encontrar-te quando menos esperares.',
  ],
};

// ── Factos curiosos ─────────────────────────────────────────────────────────
const FACT: Bank = {
  en: [
    'Octopuses have three hearts.',
    'Honey never spoils.',
    'Bananas are berries, but strawberries are not.',
    'A group of flamingos is called a flamboyance.',
    'Sharks existed before trees did.',
    'A day on Venus is longer than its year.',
    'Sea otters hold hands while they sleep.',
    'Bubble wrap was originally invented as wallpaper.',
    'The Eiffel Tower can grow over fifteen centimeters in summer.',
    'A shrimp has its heart in its head.',
  ],
  pt: [
    'Os polvos têm três corações.',
    'O mel nunca se estraga.',
    'As bananas são bagas, mas os morangos não.',
    'Um grupo de flamingos chama-se um flamboyance.',
    'Os tubarões existiam antes das árvores.',
    'Um dia em Vénus é mais longo do que o seu ano.',
    'As lontras-marinhas dormem de mãos dadas.',
    'O plástico-bolha foi inventado como papel de parede.',
    'A Torre Eiffel pode crescer mais de quinze centímetros no verão.',
    'O camarão tem o coração na cabeça.',
  ],
};

// ── Would You Rather ────────────────────────────────────────────────────────
const WYR: Bank = {
  en: [
    'Would you rather be able to fly or be invisible?',
    'Would you rather have unlimited pizza or unlimited tacos for life?',
    'Would you rather never have to sleep or never have to eat?',
    'Would you rather live without music or without movies?',
    'Would you rather be a wizard or a superhero?',
    'Would you rather always be ten minutes late or always twenty minutes early?',
    'Would you rather speak every language or play every instrument?',
    'Would you rather explore outer space or the deep ocean?',
  ],
  pt: [
    'Preferias poder voar ou ser invisível?',
    'Preferias ter pizza infinita ou tacos infinitos para o resto da vida?',
    'Preferias nunca ter de dormir ou nunca ter de comer?',
    'Preferias viver sem música ou sem filmes?',
    'Preferias ser um feiticeiro ou um super-herói?',
    'Preferias chegar sempre dez minutos atrasado ou sempre vinte minutos adiantado?',
    'Preferias falar todas as línguas ou tocar todos os instrumentos?',
    'Preferias explorar o espaço ou o fundo do oceano?',
  ],
};

export function pickEightball(locale: FunLocale, seed: number): string {
  return pick(EIGHTBALL, locale, seed);
}
export function pickFortune(locale: FunLocale, seed: number): string {
  return pick(FORTUNE, locale, seed);
}
export function pickFact(locale: FunLocale, seed: number): string {
  return pick(FACT, locale, seed);
}
export function pickWyr(locale: FunLocale, seed: number): string {
  return pick(WYR, locale, seed);
}
