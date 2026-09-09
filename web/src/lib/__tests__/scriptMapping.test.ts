import { describe, expect, it } from 'vitest';
import { scriptToTesseractLangs, verticalVariant } from '../providers/ocr/scriptMapping';

describe('scriptToTesseractLangs', () => {
  it('maps known scripts to their trained-data code', () => {
    expect(scriptToTesseractLangs('Japanese', 'auto')).toEqual(['jpn']);
    expect(scriptToTesseractLangs('Korean', 'auto')).toEqual(['kor']);
    expect(scriptToTesseractLangs('HanT', 'auto')).toEqual(['chi_tra']);
  });

  it('prefers the ISO language hint for Latin script, with an eng fallback', () => {
    expect(scriptToTesseractLangs('Latin', 'pt')).toEqual(['por', 'eng']);
    expect(scriptToTesseractLangs('Latin', 'en')).toEqual(['eng']);
  });

  it('falls back to the language hint when no script was detected', () => {
    expect(scriptToTesseractLangs(undefined, 'ja')).toEqual(['jpn']);
  });

  it('falls back to a broad default when there is no signal at all', () => {
    expect(scriptToTesseractLangs(undefined, 'auto')).toEqual(['eng', 'por']);
  });
});

describe('verticalVariant', () => {
  it('returns a "_vert" variant for CJK trained-data packs', () => {
    expect(verticalVariant('jpn')).toBe('jpn_vert');
    expect(verticalVariant('chi_sim')).toBe('chi_sim_vert');
  });

  it('returns null for scripts without a vertical package', () => {
    expect(verticalVariant('eng')).toBeNull();
    expect(verticalVariant('kor')).toBeNull();
  });
});
