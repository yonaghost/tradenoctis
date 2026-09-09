/**
 * Curated language list for the UI. This does NOT limit which languages can
 * actually be translated — any provider that supports a code not listed here
 * still works if passed directly (e.g. from `?lang=` in the URL). The list
 * only drives the language picker dropdown, so it exists to keep that menu
 * usable rather than to gate functionality.
 */
export interface LanguageOption {
  code: string;
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh-CN', label: '中文（简体）' },
  { code: 'zh-TW', label: '中文（繁體）' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ไทย' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'sv', label: 'Svenska' },
];

export const DEFAULT_TARGET_LANG = 'pt';

export function isKnownLanguage(code: string): boolean {
  return LANGUAGES.some((l) => l.code === code);
}
