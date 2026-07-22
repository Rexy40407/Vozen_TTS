import { describe, it, expect } from 'vitest';
import { detectLang } from '../src/language/detect';
import {
  pickVoice,
  pickVoiceForLang,
  modelDisplayName,
  syntheticGttsModels,
} from '../src/language/voiceMap';

// Catalogo estavel dos 38 modelos Piper (hardcoded de proposito — e o catalogo
// fixo do projeto, nao deve depender de runtime/descoberta para os testes).
const MODELS_38 = [
  'ar_JO-kareem-medium',
  'ca_ES-upc_ona-medium',
  'cs_CZ-jirka-medium',
  'cy_GB-bu_tts-medium',
  'da_DK-talesyntese-medium',
  'de_DE-mls-medium',
  'el_GR-joy-medium',
  'en_GB-alan-medium',
  'en_US-amy-medium',
  'es_ES-davefx-medium',
  'es_MX-ald-medium',
  'fa_IR-amir-medium',
  'fi_FI-harri-medium',
  'fr_FR-mls-medium',
  'hu_HU-anna-medium',
  'is_IS-bui-medium',
  'it_IT-paola-medium',
  'ka_GE-natia-medium',
  'kk_KZ-iseke-x_low',
  'lb_LU-marylux-medium',
  'lv_LV-aivars-medium',
  'ne_NP-chitwan-medium',
  'nl_BE-nathalie-medium',
  'nl_NL-alex-medium',
  'pl_PL-darkman-medium',
  'pt_BR-cadu-medium',
  'pt_PT-tugao-medium',
  'ro_RO-mihai-medium',
  'ru_RU-denis-medium',
  'sk_SK-lili-medium',
  'sl_SI-artur-medium',
  'sr_RS-serbski_institut-medium',
  'sv_SE-alma-medium',
  'sw_CD-lanfrica-medium',
  'tr_TR-dfki-medium',
  'uk_UA-ukrainian_tts-medium',
  'vi_VN-vais1000-medium',
  'zh_CN-chaowen-medium',
];

describe('detectLang', () => {
  it('deteta portugues numa frase longa', () => {
    const lang = detectLang(
      'Ola a todos, hoje vamos falar sobre o tempo que esta a fazer aqui na nossa cidade durante esta semana.',
    );
    expect(lang).toBe('por');
  });

  it('deteta ingles numa frase longa', () => {
    const lang = detectLang(
      'Hello everyone, today we are going to talk about the weather we are having here in our city during this week.',
    );
    expect(lang).toBe('eng');
  });

  it('devolve "" para texto vazio', () => {
    expect(detectLang('')).toBe('');
  });

  it('devolve "" para texto so com espacos', () => {
    expect(detectLang('   ')).toBe('');
  });

  it('devolve "" ou um codigo para texto muito curto (nunca rebenta)', () => {
    const lang = detectLang('oi');
    expect(typeof lang).toBe('string');
  });
});

describe('pickVoice', () => {
  const available = ['pt_PT-tugão-medium', 'en_US-amy-medium', 'es_ES-davefx-medium'];
  const fallback = 'en_US-amy-medium';

  it('escolhe voz portuguesa para "por"', () => {
    expect(pickVoice('por', available, fallback)).toBe('pt_PT-tugão-medium');
  });

  it('escolhe voz inglesa para "eng"', () => {
    expect(pickVoice('eng', available, fallback)).toBe('en_US-amy-medium');
  });

  it('escolhe voz espanhola para "spa"', () => {
    expect(pickVoice('spa', available, fallback)).toBe('es_ES-davefx-medium');
  });

  it('cai no fallback quando a lingua nao tem modelo', () => {
    expect(pickVoice('deu', available, fallback)).toBe(fallback);
  });

  it('cai no fallback quando lang e ""', () => {
    expect(pickVoice('', available, fallback)).toBe(fallback);
  });

  it('cai no fallback quando lang e desconhecida no mapa', () => {
    expect(pickVoice('xyz', available, fallback)).toBe(fallback);
  });

  // Linguas novas (P3.3)
  it('escolhe voz polaca para "pol"', () => {
    expect(pickVoice('pol', ['pl_PL-mls-medium'], fallback)).toBe('pl_PL-mls-medium');
  });

  // Japones: detecao 'jpn' -> voz sintetica ja_JP (so-gTTS, sem modelo Piper).
  it('escolhe a voz japonesa para "jpn"', () => {
    expect(pickVoice('jpn', ['ja_JP-google-medium', ...available], fallback)).toBe(
      'ja_JP-google-medium',
    );
  });

  it('escolhe voz ucraniana para "ukr"', () => {
    expect(pickVoice('ukr', ['uk_UA-lada-x_low'], fallback)).toBe('uk_UA-lada-x_low');
  });

  it('escolhe voz turca para "tur"', () => {
    expect(pickVoice('tur', ['tr_TR-dfki-medium'], fallback)).toBe('tr_TR-dfki-medium');
  });

  it('escolhe voz checa para "ces"', () => {
    expect(pickVoice('ces', ['cs_CZ-jirka-medium'], fallback)).toBe('cs_CZ-jirka-medium');
  });

  it('escolhe voz catalã para "cat"', () => {
    expect(pickVoice('cat', ['ca_ES-upc_ona-x_low'], fallback)).toBe('ca_ES-upc_ona-x_low');
  });

  it('escolhe voz sueca para "swe"', () => {
    expect(pickVoice('swe', ['sv_SE-nst-medium'], fallback)).toBe('sv_SE-nst-medium');
  });

  it('escolhe voz finlandesa para "fin"', () => {
    expect(pickVoice('fin', ['fi_FI-harri-medium'], fallback)).toBe('fi_FI-harri-medium');
  });

  it('escolhe voz dinamarquesa para "dan"', () => {
    expect(pickVoice('dan', ['da_DK-talesyntese-medium'], fallback)).toBe(
      'da_DK-talesyntese-medium',
    );
  });

  it('escolhe voz romena para "ron"', () => {
    expect(pickVoice('ron', ['ro_RO-mihai-medium'], fallback)).toBe('ro_RO-mihai-medium');
  });

  it('escolhe voz grega para "ell"', () => {
    expect(pickVoice('ell', ['el_GR-rapunzelina-low'], fallback)).toBe('el_GR-rapunzelina-low');
  });

  it('escolhe voz hungara para "hun"', () => {
    expect(pickVoice('hun', ['hu_HU-anna-medium'], fallback)).toBe('hu_HU-anna-medium');
  });

  // Fallback: lingua mapeada mas sem modelo disponivel
  it('cai no fallback quando lingua tem prefixo mas nenhum modelo corresponde', () => {
    expect(pickVoice('pol', ['pt_PT-tugão-medium', 'en_US-amy-medium'], fallback)).toBe(fallback);
  });

  // Determinismo: multiplos modelos com o mesmo prefixo → escolhe o primeiro por ordem
  it('com multiplos modelos do mesmo prefixo escolhe o primeiro por ordem', () => {
    expect(pickVoice('eng', ['en_GB-alan-low', 'en_US-amy-medium'], fallback)).toBe(
      'en_GB-alan-low',
    );
  });

  // ------------------------------------------------------------------
  // P7.3 — linguas em falta (PT/europeu). Provas de contrato: confirmam
  // que o prefixo 'por' -> 'pt_' cobre tanto pt_PT como pt_BR (ambos
  // comecam por 'pt_'), e que outros europeus resolvem quando ha modelo.
  // ------------------------------------------------------------------

  // (a) Com pt_PT E pt_BR disponiveis, "por" resolve para um modelo pt_
  //     (qualquer um serve — o contrato e "devolve um modelo pt_", nao um
  //     ficheiro especifico; a ordem ja e coberta pelo teste de determinismo).
  it('"por" resolve para um modelo pt_ quando ha pt_PT e pt_BR', () => {
    const models = ['pt_PT-tugão-medium', 'pt_BR-faber-medium', 'en_US-amy-medium'];
    const chosen = pickVoice('por', models, fallback);
    expect(chosen.startsWith('pt_')).toBe(true);
    expect(models).toContain(chosen);
  });

  // (b) So pt_BR disponivel → resolve para pt_BR (prova que 'pt_' apanha BR,
  //     nao apenas PT).
  it('"por" resolve para pt_BR quando so ha pt_BR', () => {
    expect(pickVoice('por', ['pt_BR-faber-medium', 'en_US-amy-medium'], fallback)).toBe(
      'pt_BR-faber-medium',
    );
  });

  // (c) Sem qualquer modelo pt_ → fallback.
  it('"por" cai no fallback quando nao ha nenhum modelo pt_', () => {
    expect(pickVoice('por', ['en_US-amy-medium', 'es_ES-davefx-medium'], fallback)).toBe(fallback);
  });

  // (d) Outros europeus ocidentais resolvem quando ha modelo do locale.
  it('"deu" resolve para de_DE quando ha modelo alemao', () => {
    expect(pickVoice('deu', ['de_DE-thorsten-medium', 'en_US-amy-medium'], fallback)).toBe(
      'de_DE-thorsten-medium',
    );
  });

  it('"spa" resolve para es_ES quando ha modelo espanhol', () => {
    expect(pickVoice('spa', ['es_ES-davefx-medium', 'en_US-amy-medium'], fallback)).toBe(
      'es_ES-davefx-medium',
    );
  });

  // ------------------------------------------------------------------
  // FIX (auditoria TTS — bug de alinhamento G3): 'no_NO' tinha autonimo em
  // LOCALE_NAMES ("Norsk") mas nenhum codigo de deteccao mapeado para 'no_' —
  // texto noruegues nunca conseguia rotar para um modelo noruegues instalado,
  // mesmo existindo um .onnx no_NO em MODELS_DIR (caia sempre no fallback).
  // Prova de regressao: os 3 codigos ISO 639-3 plausiveis (bokmal/nynorsk/macro)
  // resolvem para 'no_' quando ha um modelo desse prefixo disponivel.
  // ------------------------------------------------------------------
  it('"nob" (bokmal) resolve para no_NO quando ha modelo noruegues', () => {
    expect(pickVoice('nob', ['no_NO-heming-medium', 'en_US-amy-medium'], fallback)).toBe(
      'no_NO-heming-medium',
    );
  });

  it('"nno" (nynorsk) resolve para no_NO quando ha modelo noruegues', () => {
    expect(pickVoice('nno', ['no_NO-heming-medium', 'en_US-amy-medium'], fallback)).toBe(
      'no_NO-heming-medium',
    );
  });

  it('"nor" (macro-lingua) resolve para no_NO quando ha modelo noruegues', () => {
    expect(pickVoice('nor', ['no_NO-heming-medium', 'en_US-amy-medium'], fallback)).toBe(
      'no_NO-heming-medium',
    );
  });

  it('"nob" cai no fallback quando nao ha nenhum modelo no_ (comportamento inalterado sem modelo instalado)', () => {
    expect(pickVoice('nob', ['en_US-amy-medium', 'es_ES-davefx-medium'], fallback)).toBe(fallback);
  });
});

// ------------------------------------------------------------------
// pickVoiceForLang — "a lingua decide, mas honra a voz preferida quando bate".
// Diferenca vs pickVoice: aqui a 3.ª posicao e a voz PREFERIDA (user/guild/.env),
// nao um fallback anonimo. Se a preferida ja esta na lingua detetada, e ela que
// vence (mesmo que nao seja a 1.ª voz alfabetica do prefixo).
// ------------------------------------------------------------------

describe('pickVoiceForLang', () => {
  const available = [
    'en_GB-alan-medium',
    'en_US-amy-medium',
    'pt_PT-tugao-medium',
    'es_ES-davefx-medium',
  ];

  it('lingua desconhecida no mapa => devolve a voz preferida (nao da para detetar)', () => {
    expect(pickVoiceForLang('xyz', available, 'en_US-amy-medium')).toBe('en_US-amy-medium');
  });

  it('lang "" (deteccao falhou) => devolve a voz preferida', () => {
    expect(pickVoiceForLang('', available, 'pt_PT-tugao-medium')).toBe('pt_PT-tugao-medium');
  });

  it('preferida JA na lingua detetada => honra a preferida especifica (nao a 1.ª alfabetica)', () => {
    // eng detetado; preferida en_GB-alan comeca por 'en_' => fica alan, NAO amy.
    expect(pickVoiceForLang('eng', available, 'en_GB-alan-medium')).toBe('en_GB-alan-medium');
  });

  it('preferida noutra lingua => troca para uma voz da lingua detetada', () => {
    // preferida e inglesa mas o texto e portugues => escolhe pt_.
    expect(pickVoiceForLang('por', available, 'en_US-amy-medium')).toBe('pt_PT-tugao-medium');
  });

  it('lingua detetada sem modelo disponivel => fallback a preferida', () => {
    // 'deu' mapeia para 'de_', mas nao ha modelo de_ em `available`.
    expect(pickVoiceForLang('deu', available, 'en_US-amy-medium')).toBe('en_US-amy-medium');
  });

  it('sem preferida na lingua e com modelo disponivel => 1.ª voz do prefixo por ordem', () => {
    // preferida es_ (nao bate com eng); escolhe a 1.ª en_ por ordem de `available`.
    expect(pickVoiceForLang('eng', available, 'es_ES-davefx-medium')).toBe('en_GB-alan-medium');
  });
});

// ------------------------------------------------------------------
// Mapeamento COMPLETO dos 38 modelos Piper (todas as linguas).
// ------------------------------------------------------------------

describe('modelDisplayName — cada um dos 38 modelos tem nome amigavel', () => {
  // Para CADA modelo do catalogo, o nome de apresentacao tem de ser DIFERENTE
  // do id cru (ou seja: o locale existe em LOCALE_NAMES). Falha => locale sem nome.
  for (const model of MODELS_38) {
    it(`tem nome amigavel para ${model}`, () => {
      expect(modelDisplayName(model)).not.toBe(model);
    });
  }
});

describe('pickVoice — cada lingua dos 38 modelos routa para a voz certa', () => {
  const fallback = 'en_US-amy-medium';

  // codigo franc (confirmado empiricamente / alvo) -> prefixo de locale esperado.
  // Inclui as variantes plausiveis que o franc pode devolver para a mesma lingua.
  // Nota: cym/isl/ltz nao sao emitidos pelo franc v5 (mapeamento dormente, mas
  // pickVoice e independente do franc — testamos so a rota do dicionario).
  const cases: Array<[string, string]> = [
    ['ara', 'ar_'],
    ['arb', 'ar_'],
    ['cym', 'cy_'],
    ['fas', 'fa_'],
    ['pes', 'fa_'],
    ['isl', 'is_'],
    ['kat', 'ka_'],
    ['kaz', 'kk_'],
    ['ltz', 'lb_'],
    ['lav', 'lv_'],
    ['nep', 'ne_'],
    ['slk', 'sk_'],
    ['slv', 'sl_'],
    ['srp', 'sr_'],
    ['swh', 'sw_'],
    ['swa', 'sw_'],
    ['vie', 'vi_'],
    ['cmn', 'zh_'],
    ['zho', 'zh_'],
    // FIX G3: variantes noruegues, ver describe('pickVoice') acima para o
    // contexto completo do bug.
    ['nob', 'no_'],
    ['nno', 'no_'],
    ['nor', 'no_'],
  ];

  for (const [code, prefix] of cases) {
    it(`"${code}" routa para um modelo ${prefix}*`, () => {
      const chosen = pickVoice(code, MODELS_38.concat('no_NO-heming-medium'), fallback);
      expect(chosen.startsWith(prefix)).toBe(true);
    });
  }

  // Reforco: alguns mapeamentos antigos continuam a funcionar contra o catalogo dos 38.
  const legacy: Array<[string, string]> = [
    ['por', 'pt_'],
    ['eng', 'en_'],
    ['spa', 'es_'],
    ['deu', 'de_'],
    ['rus', 'ru_'],
    ['ukr', 'uk_'],
    ['ell', 'el_'],
    ['cat', 'ca_'],
  ];

  for (const [code, prefix] of legacy) {
    it(`(legado) "${code}" continua a routar para ${prefix}*`, () => {
      const chosen = pickVoice(code, MODELS_38, fallback);
      expect(chosen.startsWith(prefix)).toBe(true);
    });
  }
});

// ------------------------------------------------------------------
// syntheticGttsModels — catalogo INDEPENDENTE do disco (resiliencia)
// ------------------------------------------------------------------

describe('syntheticGttsModels — voices exposed only when unofficial gTTS is enabled', () => {
  it('sem NENHUM modelo Piper: injeta todas as linguas conhecidas via Google', () => {
    const synth = syntheticGttsModels([], true);
    // Uma voz sintetica por cada locale de LOCALE_NAMES (>=39).
    expect(synth.length).toBeGreaterThanOrEqual(39);
    // Todas seguem a convencao `{locale}-google-medium`.
    expect(synth.every((m) => m.endsWith('-google-medium'))).toBe(true);
    // Linguas-chave presentes (o "colapso so-japones" fica resolvido).
    expect(synth).toContain('pt_PT-google-medium');
    expect(synth).toContain('en_US-google-medium');
    expect(synth).toContain('es_ES-google-medium');
  });

  it('com os 38 modelos Piper: so injeta as linguas SEM modelo (ja_JP e no_NO)', () => {
    const synth = syntheticGttsModels(MODELS_38, true);
    expect(synth).toEqual(['ja_JP-google-medium', 'no_NO-google-medium']);
  });

  it('NUNCA duplica um locale que ja tem modelo Piper', () => {
    const synth = syntheticGttsModels(MODELS_38, true);
    // pt_PT/en_US/es_ES tem modelo Piper -> nao ha voz google para eles.
    expect(synth.some((m) => m.startsWith('pt_PT'))).toBe(false);
    expect(synth.some((m) => m.startsWith('en_US'))).toBe(false);
  });

  it('returns an empty list when unofficial gTTS is disabled', () => {
    expect(syntheticGttsModels([], false)).toEqual([]);
    expect(syntheticGttsModels(MODELS_38, false)).toEqual([]);
  });
});
