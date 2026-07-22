/**
 * Frases curtas e neutras em cada lingua-base, para o jogo "Adivinha a Lingua": o
 * Vozen le UMA das frases COM A VOZ dessa lingua e os jogadores adivinham QUE lingua
 * e. VARIAS frases por lingua (escolhida ao acaso em cada ronda) para nao se decorar
 * a frase em vez de reconhecer a lingua. Conteudo inofensivo, boa cobertura fonetica.
 * Sao lidas via gTTS/Piper na lingua correspondente, por isso o texto tem de estar
 * CORRETO nessa lingua (acentos incluidos).
 *
 * Chave = codigo base ISO-639-1 (o mesmo que baseCodeOf devolve de um id de modelo).
 * O jogo so escolhe entre linguas que tenham AQUI frases E uma voz instalada, por
 * isso ter frases a mais (sem voz) e inofensivo — simplesmente nunca sao escolhidas.
 */
export const LANGUAGE_PHRASES: Record<string, string[]> = {
  pt: [
    'Olá a todos, hoje está um dia muito bonito para conversarmos juntos.',
    'Eu gosto muito de ler livros à noite.',
    'Amanhã vamos cozinhar um jantar especial.',
    'A música deixa-me sempre feliz.',
  ],
  en: [
    'Hello everyone, today is a beautiful day to sit down and have a chat.',
    'I really enjoy reading books at night.',
    'Tomorrow we are cooking a special dinner.',
    'Music always makes me happy.',
  ],
  es: [
    'Hola a todos, hoy es un día muy bonito para sentarnos a conversar.',
    'Me gusta mucho leer libros por la noche.',
    'Mañana vamos a cocinar una cena especial.',
    'La música siempre me hace feliz.',
  ],
  fr: [
    'Bonjour à tous, aujourd’hui est une belle journée pour discuter ensemble.',
    'J’aime beaucoup lire des livres le soir.',
    'Demain nous allons cuisiner un dîner spécial.',
    'La musique me rend toujours heureux.',
  ],
  de: [
    'Hallo zusammen, heute ist ein schöner Tag, um gemütlich zu plaudern.',
    'Ich lese abends sehr gerne Bücher.',
    'Morgen kochen wir ein besonderes Abendessen.',
    'Musik macht mich immer glücklich.',
  ],
  it: [
    'Ciao a tutti, oggi è una bella giornata per fare due chiacchiere insieme.',
    'Mi piace molto leggere libri la sera.',
    'Domani cuciniamo una cena speciale.',
    'La musica mi rende sempre felice.',
  ],
  nl: [
    'Hallo allemaal, vandaag is een mooie dag om gezellig te kletsen.',
    'Ik lees ’s avonds heel graag boeken.',
    'Morgen koken we een speciaal diner.',
    'Muziek maakt me altijd blij.',
  ],
  ru: [
    'Привет всем, сегодня прекрасный день, чтобы посидеть и поговорить.',
    'Я очень люблю читать книги по вечерам.',
    'Завтра мы приготовим особенный ужин.',
    'Музыка всегда делает меня счастливым.',
  ],
  uk: [
    'Привіт усім, сьогодні чудовий день, щоб сісти й поговорити.',
    'Я дуже люблю читати книги вечорами.',
    'Завтра ми приготуємо особливу вечерю.',
    'Музика завжди робить мене щасливим.',
  ],
  pl: [
    'Cześć wszystkim, dziś jest piękny dzień na miłą rozmowę.',
    'Bardzo lubię czytać książki wieczorem.',
    'Jutro ugotujemy wyjątkową kolację.',
    'Muzyka zawsze poprawia mi humor.',
  ],
  tr: [
    'Herkese merhaba, bugün oturup sohbet etmek için güzel bir gün.',
    'Geceleri kitap okumayı çok severim.',
    'Yarın özel bir akşam yemeği pişireceğiz.',
    'Müzik beni her zaman mutlu eder.',
  ],
  cs: [
    'Ahoj všichni, dnes je krásný den na příjemné povídání.',
    'Večer velmi rád čtu knihy.',
    'Zítra uvaříme zvláštní večeři.',
    'Hudba mě vždy potěší.',
  ],
  ca: [
    'Hola a tothom, avui fa un dia molt bonic per seure a conversar.',
    'M’agrada molt llegir llibres a la nit.',
    'Demà cuinarem un sopar especial.',
    'La música sempre em fa feliç.',
  ],
  sv: [
    'Hej allihopa, idag är en vacker dag för att sitta och prata.',
    'Jag tycker mycket om att läsa böcker på kvällen.',
    'Imorgon lagar vi en speciell middag.',
    'Musik gör mig alltid glad.',
  ],
  fi: [
    'Hei kaikki, tänään on kaunis päivä istua alas ja jutella.',
    'Pidän kovasti kirjojen lukemisesta iltaisin.',
    'Huomenna laitamme erityisen illallisen.',
    'Musiikki tekee minut aina iloiseksi.',
  ],
  da: [
    'Hej allesammen, i dag er en dejlig dag til at sidde og snakke.',
    'Jeg kan rigtig godt lide at læse bøger om aftenen.',
    'I morgen laver vi en særlig middag.',
    'Musik gør mig altid glad.',
  ],
  ro: [
    'Bună tuturor, azi este o zi frumoasă pentru o conversație plăcută.',
    'Îmi place foarte mult să citesc cărți seara.',
    'Mâine vom găti o cină specială.',
    'Muzica mă face mereu fericit.',
  ],
  el: [
    'Γεια σε όλους, σήμερα είναι μια όμορφη μέρα για μια ωραία κουβέντα.',
    'Μου αρέσει πολύ να διαβάζω βιβλία το βράδυ.',
    'Αύριο θα μαγειρέψουμε ένα ξεχωριστό δείπνο.',
    'Η μουσική με κάνει πάντα χαρούμενο.',
  ],
  hu: [
    'Sziasztok mindenkinek, ma szép nap van egy kis beszélgetéshez.',
    'Este nagyon szeretek könyveket olvasni.',
    'Holnap különleges vacsorát főzünk.',
    'A zene mindig boldoggá tesz.',
  ],
  ar: [
    'مرحباً بالجميع، اليوم يوم جميل لنجلس ونتحدث معاً.',
    'أحب قراءة الكتب في المساء كثيراً.',
    'غداً سنطبخ عشاءً مميزاً.',
    'الموسيقى تجعلني سعيداً دائماً.',
  ],
  vi: [
    'Xin chào mọi người, hôm nay là một ngày đẹp để ngồi trò chuyện.',
    'Tôi rất thích đọc sách vào buổi tối.',
    'Ngày mai chúng ta sẽ nấu một bữa tối đặc biệt.',
    'Âm nhạc luôn làm tôi vui.',
  ],
  zh: [
    '大家好，今天是个坐下来聊天的好日子。',
    '我很喜欢晚上读书。',
    '明天我们要做一顿特别的晚餐。',
    '音乐总是让我开心。',
  ],
  sk: [
    'Ahojte všetci, dnes je krásny deň na príjemný rozhovor.',
    'Večer veľmi rád čítam knihy.',
    'Zajtra uvaríme špeciálnu večeru.',
    'Hudba ma vždy poteší.',
  ],
  sr: [
    'Здраво свима, данас је леп дан да седнемо и попричамо.',
    'Веома волим да читам књиге увече.',
    'Сутра ћемо спремити посебну вечеру.',
    'Музика ме увек чини срећним.',
  ],
  sw: [
    'Habari zenu nyote, leo ni siku nzuri ya kukaa na kuzungumza.',
    'Ninapenda sana kusoma vitabu jioni.',
    'Kesho tutapika chakula maalum cha jioni.',
    'Muziki hunifurahisha kila wakati.',
  ],
  is: [
    'Halló öll, í dag er fallegur dagur til að setjast niður og spjalla.',
    'Mér finnst mjög gaman að lesa bækur á kvöldin.',
    'Á morgun eldum við sérstakan kvöldverð.',
    'Tónlist gleður mig alltaf.',
  ],
  lv: [
    'Sveiki visiem, šodien ir skaista diena, lai apsēstos un parunātu.',
    'Man ļoti patīk vakaros lasīt grāmatas.',
    'Rīt mēs gatavosim īpašas vakariņas.',
    'Mūzika mani vienmēr iepriecina.',
  ],
};
