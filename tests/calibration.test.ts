// tests/calibration.test.ts
import { describe, it, expect } from 'vitest';
import {
  lengthScaleFor,
  VOICE_CALIBRATION,
  VOICE_PARAM_OVERRIDES,
  synthParamsFor,
  type SynthParams,
} from '../src/tts/calibration';

describe('lengthScaleFor — per-voice speed calibration (ORGANIC preset ×1.10)', () => {
  it('voice without calibration: length_scale = 1.10/speed (global organic factor applied)', () => {
    // Organic preset: less rushed speech => ×1.10 on top of the calibration (1).
    expect(lengthScaleFor('en_US-amy-medium', 1)).toBeCloseTo(1.1);
    expect(lengthScaleFor('en_US-amy-medium', 2)).toBeCloseTo(0.55);
    expect(lengthScaleFor('en_US-amy-medium', 0.5)).toBeCloseTo(2.2);
  });

  it('tugão (pt_PT) keeps calibration 1.5 but resolves to 1.65 effective (×1.10 organic)', () => {
    // VOICE_CALIBRATION does NOT change (still 1.5); the ×1.10 organic composes on top.
    expect(VOICE_CALIBRATION['pt_PT-tugao-medium']).toBe(1.5);
    expect(lengthScaleFor('pt_PT-tugao-medium', 1)).toBeCloseTo(1.65);
  });

  it('the calibration composes with the user speed (multiplicative) and the ×1.10', () => {
    // 1.5 × 1.10 / 0.5 = 3.3 ; 1.5 × 1.10 / 2 = 0.825
    expect(lengthScaleFor('pt_PT-tugao-medium', 0.5)).toBeCloseTo(3.3);
    expect(lengthScaleFor('pt_PT-tugao-medium', 2)).toBeCloseTo(0.825);
  });

  it('invalid speed (0 or negative) treated as 1', () => {
    expect(lengthScaleFor('en_US-amy-medium', 0)).toBeCloseTo(1.1);
    expect(lengthScaleFor('pt_PT-tugao-medium', -3)).toBeCloseTo(1.65);
  });
});

describe('synthParamsFor — merge of quality params (global + per-voice override)', () => {
  const globals: SynthParams = { noiseScale: 0.667, noiseW: 0.8, sentenceSilence: 0.2 };

  it('VOICE_PARAM_OVERRIDES is EMPTY by default (no voice changes today)', () => {
    expect(Object.keys(VOICE_PARAM_OVERRIDES)).toHaveLength(0);
  });

  it('without override: returns the globals as-is (no audible regression)', () => {
    expect(synthParamsFor('en_US-amy-medium', globals)).toEqual(globals);
    expect(synthParamsFor('pt_PT-tugao-medium', globals)).toEqual(globals);
  });

  it('per-voice override wins over the global; non-override fields fall to the global', () => {
    // Injects a throwaway override just for this test and clears it afterward.
    VOICE_PARAM_OVERRIDES['zz_fake-voice'] = { noiseScale: 0.3 };
    try {
      const resolved = synthParamsFor('zz_fake-voice', globals);
      expect(resolved.noiseScale).toBe(0.3); // override wins
      expect(resolved.noiseW).toBe(0.8); // no override -> global
      expect(resolved.sentenceSilence).toBe(0.2); // no override -> global
    } finally {
      delete VOICE_PARAM_OVERRIDES['zz_fake-voice'];
    }
  });

  it('does not mutate the passed globals object (returns a copy)', () => {
    const snapshot = { ...globals };
    VOICE_PARAM_OVERRIDES['zz_fake-voice'] = { noiseW: 1.1 };
    try {
      synthParamsFor('zz_fake-voice', globals);
      expect(globals).toEqual(snapshot);
    } finally {
      delete VOICE_PARAM_OVERRIDES['zz_fake-voice'];
    }
  });
});
