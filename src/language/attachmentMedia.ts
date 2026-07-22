// src/language/attachmentMedia.ts
//
// Classifies Discord ATTACHMENTS and STICKERS into media items to announce (image,
// video, audio, compressed file, file, gif, multiple). The voice localization
// ("uma imagem"/"an image") happens downstream (spokenPhrases); here only the
// TYPE is decided. PURE — operates on minimal shapes ({contentType,name}), so it
// can be tested without real Discord objects.

import type { MediaKind, MediaItem } from './spokenPhrases';

/** Minimal shape of an attachment (subset of discord.js's Attachment). */
export interface AttachmentLike {
  contentType?: string | null;
  name?: string | null;
}

const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz']);

function extOf(name: string | null | undefined): string {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/**
 * Type of ONE attachment, by content-type (preferred) or name extension (fallback).
 * gif takes priority over image (a .gif is an image, but Diogo wants "a gif").
 * PURE.
 */
export function classifyAttachment(att: AttachmentLike): MediaKind {
  const ct = (att.contentType ?? '').toLowerCase();
  const ext = extOf(att.name);

  if (ct === 'image/gif' || ext === 'gif') return 'gif';
  if (ct.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico', 'tiff'].includes(ext))
    return 'image';
  if (ct.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'].includes(ext))
    return 'video';
  if (ct.startsWith('audio/') || ['mp3', 'ogg', 'wav', 'flac', 'm4a', 'opus'].includes(ext))
    return 'audio';
  if (ARCHIVE_EXT.has(ext)) return 'archive';
  return 'file';
}

/**
 * Media from attachments: 0 -> none; 1 -> its type; >1 -> a single "multiple files"
 * (like the competitor — avoids the verbose "image image video"). PURE.
 */
export function mediaFromAttachments(atts: AttachmentLike[]): MediaItem[] {
  if (atts.length === 0) return [];
  if (atts.length > 1) return [{ kind: 'multiple' }];
  return [{ kind: classifyAttachment(atts[0]) }];
}

/** Minimal shape of a sticker. */
export interface StickerLike {
  name?: string | null;
}

/**
 * Media from stickers: one per sticker, reading the NAME (the competitor reads the
 * sticker's name). Empty name -> the item falls back to "a sticker" downstream. PURE.
 */
export function mediaFromStickers(stickers: StickerLike[]): MediaItem[] {
  return stickers.map((s) => ({ kind: 'sticker' as const, text: s.name ?? undefined }));
}
