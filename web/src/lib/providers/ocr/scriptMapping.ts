/**
 * Maps a Tesseract OSD (Orientation & Script Detection) script name, or a
 * known ISO language hint, to the Tesseract traineddata bundle(s) to load
 * for the full recognition pass. Kept as a pure lookup table so it is
 * unit-testable without running Tesseract itself.
 */

export const ISO_TO_TESSERACT: Record<string, string> = {
  en: 'eng',
  pt: 'por',
  es: 'spa',
  fr: 'fra',
  de: 'deu',
  it: 'ita',
  nl: 'nld',
  pl: 'pol',
  tr: 'tur',
  sv: 'swe',
  vi: 'vie',
  id: 'ind',
  ru: 'rus',
  ar: 'ara',
  hi: 'hin',
  th: 'tha',
  ja: 'jpn',
  ko: 'kor',
  'zh-CN': 'chi_sim',
  'zh-TW': 'chi_tra',
};

/** Scripts for which we also attempt the "_vert" (vertical) trained data. */
export const VERTICAL_CAPABLE_SCRIPTS = new Set(['Japanese', 'Han', 'HanS', 'HanT']);

/**
 * Given an OSD script name, returns the candidate Tesseract language codes
 * to try for the main OCR pass, in priority order. Multiple candidates are
 * only returned for scripts where a single trained-data package cannot
 * disambiguate the actual language (e.g. Han -> could be Simplified or
 * Traditional Chinese) — the caller runs each and keeps the highest
 * confidence result.
 */
export function scriptToTesseractLangs(script: string | undefined, languageHint: string): string[] {
  if (script) {
    switch (script) {
      case 'Japanese':
        return ['jpn'];
      case 'Korean':
      case 'Hangul':
        return ['kor'];
      case 'Han':
      case 'HanS':
        return ['chi_sim'];
      case 'HanT':
        return ['chi_tra'];
      case 'Cyrillic':
        return ['rus'];
      case 'Arabic':
        return ['ara'];
      case 'Devanagari':
        return ['hin'];
      case 'Thai':
        return ['tha'];
      case 'Latin':
        return [ISO_TO_TESSERACT[languageHint] ?? 'eng', 'eng'].filter((v, i, a) => a.indexOf(v) === i);
      default:
        break;
    }
  }

  if (languageHint !== 'auto' && ISO_TO_TESSERACT[languageHint]) {
    return [ISO_TO_TESSERACT[languageHint]];
  }

  // No script/language signal at all: fall back to the broadest common set.
  return (process.env.OCR_FALLBACK_LANGS ?? 'eng+por').split('+');
}

export function verticalVariant(tesseractLang: string): string | null {
  return ['jpn', 'chi_sim', 'chi_tra'].includes(tesseractLang) ? `${tesseractLang}_vert` : null;
}
