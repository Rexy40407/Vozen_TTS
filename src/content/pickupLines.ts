/**
 * Banco de PICK-UP LINES (frases de engate) multilingue para o /rizz.
 *
 * Contrato (igual ao jokes.ts, do qual REUTILIZA a lista de línguas):
 *  - A fonte de verdade das línguas é `JOKE_LANGUAGES` (jokes.ts) — as mesmas 35, com o
 *    mesmo `key`/`prefix`/`display`, para partilhar o autocomplete e a escolha de voz.
 *  - Cada língua tem >=1 frase, no SCRIPT nativo correto (nunca transliterada — misturar
 *    Latim num modelo não-latino "come" as palavras no Piper).
 *  - `pickLine(key, seed)` é PURO/DETERMINÍSTICO: lines[seed % lines.length]. Fallback ao
 *    inglês para key desconhecida.
 *
 * Curadoria: SFW e "corny" de propósito (sem nada explícito/ofensivo — arriscaria a review
 * das bot lists e o ToS do Discord). As línguas que consigo verificar levam frases naturais
 * e brincalhonas; as restantes usam um elogio simples e universal, seguro em qualquer
 * cultura. Podem ser trocadas por curadoria nativa sem mexer no código.
 */

import { JOKE_LANGUAGES, jokeLangByKey } from './jokes';

// Re-exporta a lista/lookup partilhados para o handler e os testes do /rizz não terem de
// saber que vêm do jokes.ts (mesma UX do /joke).
export { JOKE_LANGUAGES, jokeLangByKey };

const PICKUP_LINES: Record<string, string[]> = {
  en: [
    'Are you a magician? Because whenever I look at you, everyone else disappears.',
    'Do you have a map? I keep getting lost in your eyes.',
    'If being cute were a crime, you would be in a lot of trouble.',
  ],
  pt: [
    'Tens um mapa? É que eu perco-me sempre nos teus olhos.',
    'Se a beleza fosse tempo, tu eras a eternidade.',
    'Acredito em amor à primeira vista, ou tenho de passar outra vez?',
  ],
  es: [
    '¿Tienes un mapa? Porque me acabo de perder en tus ojos.',
    '¿Crees en el amor a primera vista o tengo que pasar otra vez?',
    'Si la belleza fuera tiempo, tú serías la eternidad.',
  ],
  fr: [
    'Est-ce que tu as un plan ? Parce que je me perds dans tes yeux.',
    'Crois-tu au coup de foudre, ou dois-je repasser une deuxième fois ?',
    'Si être beau était un crime, tu serais déjà coupable.',
  ],
  de: [
    'Hast du eine Karte? Ich habe mich gerade in deinen Augen verlaufen.',
    'Glaubst du an Liebe auf den ersten Blick, oder soll ich nochmal vorbeigehen?',
    'Dein Lächeln bringt den ganzen Raum zum Leuchten.',
  ],
  it: [
    'Hai una mappa? Perché mi sto perdendo nei tuoi occhi.',
    "Credi nell'amore a prima vista o devo ripassare?",
    'Il tuo sorriso illumina tutta la stanza.',
  ],
  nl: [
    'Heb je een kaart? Want ik verdwaal in je ogen.',
    'Geloof je in liefde op het eerste gezicht, of moet ik nog een keer langslopen?',
  ],
  ca: ['Tens un mapa? Perquè em perdo als teus ulls.', 'El teu somriure il·lumina tota la sala.'],
  cs: ['Máš mapu? Protože se ztrácím v tvých očích.', 'Tvůj úsměv rozzáří celou místnost.'],
  cy: ['Mae dy wên yn goleuo’r ystafell gyfan.'],
  da: ['Har du et kort? Jeg er lige faret vild i dine øjne.', 'Dit smil lyser hele rummet op.'],
  fi: ['Onko sinulla kartta? Eksyn aina silmiisi.', 'Hymysi valaisee koko huoneen.'],
  ka: ['შენი ღიმილი მთელ ოთახს ანათებს.'],
  el: ['Το χαμόγελό σου φωτίζει όλο τον χώρο.', 'Νομίζω πως χάθηκα μέσα στα μάτια σου.'],
  hu: ['Van térképed? Mert elveszek a szemeidben.', 'A mosolyod bevilágítja az egész szobát.'],
  is: ['Ertu með kort? Ég er týndur í augunum þínum.'],
  ja: [
    '君の笑顔を見ると、まわりのみんなが消えてしまうよ。',
    '君の笑顔は今日いちばんきれいな景色だ。',
  ],
  kk: ['Сенің күлкің бүкіл бөлмені жарқыратады.'],
  lv: ['Tavs smaids izgaismo visu telpu.'],
  lb: ['Däi Laachen erhellt de ganze Raum.'],
  ne: ['तिम्रो मुस्कानले सबै ठाउँ उज्यालो बनाउँछ।'],
  fa: ['لبخند تو زیباترین چیزیه که امروز دیدم.', 'انگار توی چشمای تو گم شدم.'],
  pl: ['Masz mapę? Bo gubię się w twoich oczach.', 'Twój uśmiech rozświetla cały pokój.'],
  ro: ['Ai o hartă? Pentru că m-am rătăcit în ochii tăi.', 'Zâmbetul tău luminează toată camera.'],
  ru: ['Кажется, я потерялся в твоих глазах.', 'Твоя улыбка освещает всё вокруг.'],
  sr: ['Твој осмех обасјава цео простор.', 'Изгубио сам се у твојим очима.'],
  sk: ['Máš mapu? Lebo sa strácam v tvojich očiach.'],
  sl: ['Imaš zemljevid? Ker se izgubljam v tvojih očeh.'],
  sw: ['Tabasamu lako linaangaza chumba kizima.', 'Macho yako ni mazuri kuliko nyota za usiku.'],
  sv: ['Har du en karta? Jag går vilse i dina ögon.', 'Ditt leende lyser upp hela rummet.'],
  tr: ['Haritan var mı? Çünkü gözlerinde kayboluyorum.', 'Gülüşün bütün odayı aydınlatıyor.'],
  uk: ['Здається, я загубився у твоїх очах.', 'Твоя усмішка освітлює все навколо.'],
  vi: ['Em có bản đồ không? Vì anh lạc trong mắt em rồi.', 'Nụ cười của em làm sáng cả căn phòng.'],
  ar: ['عيناك أجمل ما رأيت اليوم.', 'ابتسامتك تضيء المكان كله.'],
  zh: ['你的笑容是我今天见过最美的风景。', '见到你，其他人都消失了。'],
};

/**
 * Escolhe uma frase de engate da língua `langKey` de forma PURA e DETERMINÍSTICA dado o
 * `seed`: lines[seed % lines.length]. Fallback ao inglês se a key for desconhecida. O
 * `seed` em runtime pode ser Date.now(); os testes passam seeds fixos.
 */
export function pickLine(langKey: string, seed: number): string {
  const lines = PICKUP_LINES[langKey] ?? PICKUP_LINES.en;
  const idx = ((seed % lines.length) + lines.length) % lines.length;
  return lines[idx];
}

/** Keys que têm banco próprio (para o teste de completude). */
export const PICKUP_KEYS = Object.keys(PICKUP_LINES);
