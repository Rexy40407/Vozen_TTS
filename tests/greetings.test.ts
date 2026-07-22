import { describe, it, expect } from 'vitest';
import { lookupShortLang } from '../src/language/greetings';
import { detectLang } from '../src/language/detect';

describe('lookupShortLang — lexico de saudacoes/palavras curtas', () => {
  it('token PT unico (com e sem acento) -> por', () => {
    expect(lookupShortLang('ola')).toBe('por');
    expect(lookupShortLang('olá')).toBe('por');
    expect(lookupShortLang('oi')).toBe('por');
    expect(lookupShortLang('obrigado')).toBe('por');
    expect(lookupShortLang('sim')).toBe('por');
    expect(lookupShortLang('não')).toBe('por');
    expect(lookupShortLang('nao')).toBe('por');
  });

  it('normaliza pontuacao e maiusculas antes de procurar', () => {
    expect(lookupShortLang('Olá!')).toBe('por');
    expect(lookupShortLang('  OLA  ')).toBe('por');
    expect(lookupShortLang('oi???')).toBe('por');
  });

  it('frase inteira conhecida -> lingua da frase', () => {
    expect(lookupShortLang('bom dia')).toBe('por');
    expect(lookupShortLang('boa noite')).toBe('por');
    expect(lookupShortLang('olá, tudo bem?')).toBe('por');
    expect(lookupShortLang('hola que tal')).toBe('spa');
  });

  it('frase curta iniciada por saudacao -> lingua da saudacao (franc erraria)', () => {
    expect(lookupShortLang('ola tudo bem')).toBe('por'); // franc dava 'tpi'
    expect(lookupShortLang('ciao come stai')).toBe('ita'); // franc dava 'por'
    expect(lookupShortLang('bonjour ca va')).toBe('fra'); // franc dava 'uzn'
    expect(lookupShortLang('hello there my friend')).toBe('eng'); // franc dava 'sco'
  });

  it('outras linguas com voz Piper', () => {
    expect(lookupShortLang('hola')).toBe('spa');
    expect(lookupShortLang('gracias')).toBe('spa');
    expect(lookupShortLang('merci')).toBe('fra');
    expect(lookupShortLang('bonjour')).toBe('fra');
    expect(lookupShortLang('danke')).toBe('deu');
    expect(lookupShortLang('hallo')).toBe('deu');
    expect(lookupShortLang('ciao')).toBe('ita');
    expect(lookupShortLang('grazie')).toBe('ita');
    expect(lookupShortLang('hi')).toBe('eng');
    expect(lookupShortLang('thanks')).toBe('eng');
  });

  it('nao reconhecido -> "" (deixa passar ao franc)', () => {
    expect(lookupShortLang('')).toBe('');
    expect(lookupShortLang('   ')).toBe('');
    expect(lookupShortLang('xyzzy')).toBe('');
    // frase longa nao-saudacao: cai no franc (nao no lexico).
    expect(lookupShortLang('isto e uma frase comprida sobre o tempo de hoje')).toBe('');
  });

  it('tokens ambiguos entre linguas NAO estao no lexico (evita falsos positivos)', () => {
    // "ok", "no", "si", "ja" sao usados em varias linguas -> deixados de fora.
    for (const t of ['ok', 'no', 'si', 'ja', 'a', 'o']) {
      expect(lookupShortLang(t)).toBe('');
    }
  });

  it('frase longa iniciada por saudacao (> 4 palavras) NAO dispara a regra inicial', () => {
    // Texto comprido decide-se pelo franc, nao pela 1.ª palavra.
    expect(lookupShortLang('hi everyone i need some help with the server config please')).toBe('');
  });

  // FIX (auditoria TTS — fecha G1, docs/SPEECH-DATA-AUDIT.md §3): saudacoes curtas
  // para linguas que so tinham modelo/prefixo mas nenhum token de lexico. NOTA: estes
  // casos foram ESCRITOS mas NAO EXECUTADOS (sem ferramenta de corrida de testes
  // disponivel nesta sessao) — mirror direto do padrao acima, a confirmar com
  // `npm test` antes de dar como fechado.
  it('G1 — script proprio, mapeamento 1:1 (grego/georgiano/nepali/chines)', () => {
    expect(lookupShortLang('γεια')).toBe('ell');
    expect(lookupShortLang('καλημέρα')).toBe('ell');
    expect(lookupShortLang('გამარჯობა')).toBe('kat');
    expect(lookupShortLang('नमस्ते')).toBe('nep');
    expect(lookupShortLang('你好')).toBe('cmn');
    expect(lookupShortLang('谢谢')).toBe('cmn');
  });

  it('G1 — cirilico partilhado (russo/ucraniano/cazaque/servio) sem colisao', () => {
    expect(lookupShortLang('привет')).toBe('rus');
    expect(lookupShortLang('спасибо')).toBe('rus');
    expect(lookupShortLang('привіт')).toBe('ukr');
    expect(lookupShortLang('дякую')).toBe('ukr');
    expect(lookupShortLang('сәлем')).toBe('kaz');
    expect(lookupShortLang('здраво')).toBe('srp');
  });

  it('G1 — perso-arabico prunado (arabe/persa) so tokens inequivocos', () => {
    expect(lookupShortLang('مرحبا')).toBe('ara');
    expect(lookupShortLang('شكرا')).toBe('ara');
    expect(lookupShortLang('درود')).toBe('fas');
    expect(lookupShortLang('خداحافظ')).toBe('fas');
  });

  it('G1 — latino curado (checo/hungaro/gales/islandes/luxemburgues/letao/eslovaco/esloveno/suaili/vietnamita)', () => {
    expect(lookupShortLang('nazdar')).toBe('ces');
    expect(lookupShortLang('szia')).toBe('hun');
    expect(lookupShortLang('shwmae')).toBe('cym');
    expect(lookupShortLang('sæl')).toBe('isl');
    expect(lookupShortLang('moien')).toBe('ltz');
    expect(lookupShortLang('sveiki')).toBe('lav');
    expect(lookupShortLang('ďakujem')).toBe('slk');
    expect(lookupShortLang('živjo')).toBe('slv');
    expect(lookupShortLang('habari')).toBe('swh');
    expect(lookupShortLang('xin chào')).toBe('vie');
  });

  it('G1 — frase curta iniciada por saudacao nova (regra 3)', () => {
    expect(lookupShortLang('γεια σου φιλε')).toBe('ell');
    expect(lookupShortLang('szia hogy vagy')).toBe('hun');
    expect(lookupShortLang('привет как дела')).toBe('rus');
  });
});

describe('detectLang — integra o lexico antes do franc', () => {
  it('o caso do dono: "ola" -> por (nao "" -> voz inglesa)', () => {
    expect(detectLang('ola')).toBe('por');
    expect(detectLang('olá')).toBe('por');
  });

  it('mantem a deteccao franc para frases longas', () => {
    expect(
      detectLang(
        'Ola a todos, hoje vamos falar sobre o tempo que esta a fazer aqui na nossa cidade durante esta semana.',
      ),
    ).toBe('por');
    expect(
      detectLang(
        'Hello everyone, today we are going to talk about the weather we are having here in our city during this week.',
      ),
    ).toBe('eng');
  });

  it('texto vazio/so espacos -> "" (inalterado)', () => {
    expect(detectLang('')).toBe('');
    expect(detectLang('   ')).toBe('');
  });
});
