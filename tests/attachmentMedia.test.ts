import { describe, it, expect } from 'vitest';
import {
  classifyAttachment,
  mediaFromAttachments,
  mediaFromStickers,
} from '../src/language/attachmentMedia';

describe('classifyAttachment — tipo por content-type ou extensão', () => {
  it('gif (prioridade sobre image)', () => {
    expect(classifyAttachment({ contentType: 'image/gif', name: 'a.gif' })).toBe('gif');
    expect(classifyAttachment({ contentType: null, name: 'boom.GIF' })).toBe('gif');
  });

  it('image / video / audio por content-type', () => {
    expect(classifyAttachment({ contentType: 'image/png', name: 'x.png' })).toBe('image');
    expect(classifyAttachment({ contentType: 'video/mp4', name: 'x.mp4' })).toBe('video');
    expect(classifyAttachment({ contentType: 'audio/mpeg', name: 'x.mp3' })).toBe('audio');
  });

  it('image / video / audio por extensão (contentType ausente)', () => {
    expect(classifyAttachment({ name: 'foto.jpeg' })).toBe('image');
    expect(classifyAttachment({ name: 'clip.mov' })).toBe('video');
    expect(classifyAttachment({ name: 'som.ogg' })).toBe('audio');
  });

  it('arquivo comprimido', () => {
    expect(classifyAttachment({ name: 'pack.zip' })).toBe('archive');
    expect(classifyAttachment({ name: 'x.7z' })).toBe('archive');
  });

  it('desconhecido -> file', () => {
    expect(classifyAttachment({ contentType: null, name: 'notas.txt' })).toBe('file');
    expect(classifyAttachment({ name: null })).toBe('file');
  });
});

describe('mediaFromAttachments — 0 / 1 / vários', () => {
  it('nenhum -> []', () => {
    expect(mediaFromAttachments([])).toEqual([]);
  });

  it('um -> o seu tipo', () => {
    expect(mediaFromAttachments([{ contentType: 'image/png', name: 'a.png' }])).toEqual([
      { kind: 'image' },
    ]);
  });

  it('vários -> um único "multiple" (evita verbosidade)', () => {
    expect(
      mediaFromAttachments([
        { contentType: 'image/png', name: 'a.png' },
        { contentType: 'video/mp4', name: 'b.mp4' },
      ]),
    ).toEqual([{ kind: 'multiple' }]);
  });
});

describe('mediaFromStickers — um por sticker, pelo nome', () => {
  it('lê o nome de cada sticker', () => {
    expect(mediaFromStickers([{ name: 'pepe hug' }, { name: 'wave' }])).toEqual([
      { kind: 'sticker', text: 'pepe hug' },
      { kind: 'sticker', text: 'wave' },
    ]);
  });

  it('nome nulo -> text undefined (cai em "a sticker" a jusante)', () => {
    expect(mediaFromStickers([{ name: null }])).toEqual([{ kind: 'sticker', text: undefined }]);
  });

  it('sem stickers -> []', () => {
    expect(mediaFromStickers([])).toEqual([]);
  });
});
