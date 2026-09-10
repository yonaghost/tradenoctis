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
  { code: 'ja', label: 'Japonês (日本語)' },
  { code: 'ko', label: 'Coreano (한국어)' },
  { code: 'zh-CN', label: 'Chinês simplificado (中文)' },
  { code: 'zh-TW', label: 'Chinês tradicional (中文)' },
  { code: 'ru', label: 'Russo (Русский)' },
  { code: 'ar', label: 'Árabe (العربية)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'nl', label: 'Neerlandês (Nederlands)' },
  { code: 'pl', label: 'Polonês (Polski)' },
  { code: 'tr', label: 'Turco (Türkçe)' },
  { code: 'vi', label: 'Vietnamita (Tiếng Việt)' },
  { code: 'th', label: 'Tailandês (ไทย)' },
  { code: 'id', label: 'Indonésio (Bahasa Indonesia)' },
  { code: 'sv', label: 'Sueco (Svenska)' },
];

export const DEFAULT_TARGET_LANG = 'pt';

export function isKnownLanguage(code: string): boolean {
  return LANGUAGES.some((l) => l.code === code);
}
