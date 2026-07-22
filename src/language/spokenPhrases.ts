// src/language/spokenPhrases.ts
//
// Léxico de FRASES FALADAS (não é UI — é texto que o Vozen SINTETIZA em voz alta)
// para os anúncios: media (link/gif/imagem/…), o "disse" do xsaid, e "spoiler"/
// "código". Ao contrário do i18n (resolvido pelo locale do Discord do utilizador),
// isto é resolvido pela LÍNGUA DA VOZ que fala — a mesma voz diz o anúncio, por isso
// "um gif" sai em voz portuguesa e "a gif" em voz inglesa (decisão do Diogo:
// "idioma da mensagem").
//
// Chave = prefixo de locale do modelo Piper (a parte antes do 1.º '_': en, pt, es…).
// Traduzimos o NÚCLEO de línguas em que temos confiança; as restantes caem no
// inglês (mesma filosofia da Fase B do i18n) — um fallback inglês honesto é melhor
// que uma tradução-máquina errada, sobretudo no "disse", que prefixa CADA mensagem.

export type MediaKind =
  | 'link'
  | 'gif'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'archive'
  | 'multiple'
  | 'sticker'
  | 'spoiler'
  | 'code';

/** Um item de media a anunciar. `text` só é usado por 'sticker' (o nome do sticker). */
export interface MediaItem {
  kind: MediaKind;
  text?: string;
}

export interface SpokenPhrases {
  // xsaid (commit B): "{nome} {said}"
  said: string;
  // media (este commit)
  link: string;
  gif: string;
  image: string;
  video: string;
  audio: string;
  file: string;
  archive: string;
  multiple: string;
  sticker: string;
  // spoiler / código (commit C)
  spoiler: string;
  code: string;
}

const EN: SpokenPhrases = {
  said: 'said',
  link: 'a link',
  gif: 'a gif',
  image: 'an image',
  video: 'a video',
  audio: 'an audio',
  file: 'a file',
  archive: 'a compressed file',
  multiple: 'multiple files',
  sticker: 'a sticker',
  spoiler: 'spoiler',
  code: 'code',
};

// Núcleo traduzido. NOTA pt: a única voz portuguesa é pt_BR (Brasil), por isso
// usamos termos brasileiros ("arquivo", "figurinha") — é a voz que vai falar.
const PHRASES: Record<string, SpokenPhrases> = {
  en: EN,
  pt: {
    said: 'disse',
    link: 'um link',
    gif: 'um gif',
    image: 'uma imagem',
    video: 'um vídeo',
    audio: 'um áudio',
    file: 'um arquivo',
    archive: 'um arquivo compactado',
    multiple: 'vários arquivos',
    sticker: 'uma figurinha',
    spoiler: 'spoiler',
    code: 'código',
  },
  es: {
    said: 'dijo',
    link: 'un enlace',
    gif: 'un gif',
    image: 'una imagen',
    video: 'un vídeo',
    audio: 'un audio',
    file: 'un archivo',
    archive: 'un archivo comprimido',
    multiple: 'varios archivos',
    sticker: 'un sticker',
    spoiler: 'spoiler',
    code: 'código',
  },
  fr: {
    said: 'a dit',
    link: 'un lien',
    gif: 'un gif',
    image: 'une image',
    video: 'une vidéo',
    audio: 'un audio',
    file: 'un fichier',
    archive: 'un fichier compressé',
    multiple: 'plusieurs fichiers',
    sticker: 'un sticker',
    spoiler: 'spoiler',
    code: 'du code',
  },
  de: {
    said: 'sagt',
    link: 'ein Link',
    gif: 'ein GIF',
    image: 'ein Bild',
    video: 'ein Video',
    audio: 'eine Audiodatei',
    file: 'eine Datei',
    archive: 'eine komprimierte Datei',
    multiple: 'mehrere Dateien',
    sticker: 'ein Sticker',
    spoiler: 'Spoiler',
    code: 'Code',
  },
  it: {
    said: 'ha detto',
    link: 'un link',
    gif: 'una gif',
    image: "un'immagine",
    video: 'un video',
    audio: 'un audio',
    file: 'un file',
    archive: 'un file compresso',
    multiple: 'più file',
    sticker: 'uno sticker',
    spoiler: 'spoiler',
    code: 'codice',
  },
  nl: {
    said: 'zei',
    link: 'een link',
    gif: 'een gif',
    image: 'een afbeelding',
    video: 'een video',
    audio: 'een audio',
    file: 'een bestand',
    archive: 'een gecomprimeerd bestand',
    multiple: 'meerdere bestanden',
    sticker: 'een sticker',
    spoiler: 'spoiler',
    code: 'code',
  },
  pl: {
    said: 'powiedział',
    link: 'link',
    gif: 'gif',
    image: 'obraz',
    video: 'wideo',
    audio: 'audio',
    file: 'plik',
    archive: 'skompresowany plik',
    multiple: 'wiele plików',
    sticker: 'naklejka',
    spoiler: 'spoiler',
    code: 'kod',
  },
  ru: {
    said: 'сказал',
    link: 'ссылка',
    gif: 'гиф',
    image: 'изображение',
    video: 'видео',
    audio: 'аудио',
    file: 'файл',
    archive: 'сжатый файл',
    multiple: 'несколько файлов',
    sticker: 'стикер',
    spoiler: 'спойлер',
    code: 'код',
  },
};

/**
 * Prefixo de locale (chave do léxico) a partir de um modelo Piper: a parte antes
 * do 1.º '_'. Ex.: 'pt_BR-cadu-medium' -> 'pt', 'en_US-amy-medium' -> 'en'. Sem '_'
 * (defensivo) -> 'en'. PURO.
 */
export function langKeyOfModel(model: string): string {
  const i = model.indexOf('_');
  return i === -1 ? 'en' : model.slice(0, i);
}

/**
 * Frases faladas para um prefixo de locale (en, pt, es…). Fallback: inglês para
 * qualquer língua ainda não traduzida. PURO.
 */
export function spokenPhrasesFor(langKey: string): SpokenPhrases {
  return PHRASES[langKey] ?? EN;
}

/**
 * Constrói o SUFIXO de media a acrescentar ao fim da fala, já na língua `phrases`.
 * Cada item -> a sua palavra (ex. [gif] -> "um gif"); 'sticker' com nome -> o nome
 * do sticker tal e qual (o concorrente lê o nome). Junta por espaço. PURO.
 */
export function buildMediaSuffix(media: MediaItem[], phrases: SpokenPhrases): string {
  return media
    .map((m) => (m.kind === 'sticker' ? m.text?.trim() || phrases.sticker : phrases[m.kind]))
    .filter((s) => s.length > 0)
    .join(' ');
}
