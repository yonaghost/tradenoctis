import { TranslationProvider } from './TranslationProvider';
import { GoogleCloudTranslationProvider } from './GoogleCloudTranslationProvider';
import { LibreTranslateProvider } from './LibreTranslateProvider';
import { GoogleWebDemoProvider } from './GoogleWebDemoProvider';
import { CachingTranslationProvider } from './CachingTranslationProvider';

export * from './TranslationProvider';

let cachedProvider: TranslationProvider | null = null;

/**
 * Selects the active translation backend from environment configuration.
 * Never hardcodes a real API key — everything comes from `process.env`.
 *
 *   TRANSLATION_PROVIDER=google-cloud   + GOOGLE_TRANSLATE_API_KEY
 *   TRANSLATION_PROVIDER=libretranslate + LIBRETRANSLATE_URL [+ LIBRETRANSLATE_API_KEY]
 *   (unset / anything else)             -> google-web-demo (see GoogleWebDemoProvider docs)
 */
export function getTranslationProvider(): TranslationProvider {
  if (cachedProvider) return cachedProvider;

  const selected = process.env.TRANSLATION_PROVIDER;
  let base: TranslationProvider;

  if (selected === 'google-cloud' && process.env.GOOGLE_TRANSLATE_API_KEY) {
    base = new GoogleCloudTranslationProvider(process.env.GOOGLE_TRANSLATE_API_KEY);
  } else if (selected === 'libretranslate' && process.env.LIBRETRANSLATE_URL) {
    base = new LibreTranslateProvider(process.env.LIBRETRANSLATE_URL, process.env.LIBRETRANSLATE_API_KEY);
  } else {
    base = new GoogleWebDemoProvider();
  }

  cachedProvider = new CachingTranslationProvider(base);
  return cachedProvider;
}
