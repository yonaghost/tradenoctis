import {
  TranslationProvider,
  TranslationProviderError,
  TranslationRequest,
  TranslationResult,
} from './TranslationProvider';

/**
 * Zero-config fallback so a fresh checkout can actually translate something
 * without any secret configured. It calls the free, unofficial endpoint
 * behind translate.google.com's website (`translate_a/single`) instead of
 * the paid, officially supported Cloud Translation API.
 *
 * IMPORTANT — this is NOT a production-grade provider:
 *  - it is not an official, documented, or stable API; Google can change or
 *    block it without notice, and it is rate-limited per IP;
 *  - it exists purely so evaluators/developers get real, working
 *    translations out of the box.
 *
 * Configure `TRANSLATION_PROVIDER=google-cloud` (with `GOOGLE_TRANSLATE_API_KEY`)
 * or `TRANSLATION_PROVIDER=libretranslate` (with `LIBRETRANSLATE_URL`) for any
 * real deployment. See docs/LIMITATIONS.md.
 */
export class GoogleWebDemoProvider implements TranslationProvider {
  readonly id = 'google-web-demo';

  async translate({ texts, sourceLang, targetLang }: TranslationRequest): Promise<TranslationResult> {
    if (texts.length === 0) return { translations: [] };

    const translations: string[] = [];
    let detectedSourceLang: string | undefined;

    for (const text of texts) {
      const params = new URLSearchParams({
        client: 'gtx',
        sl: sourceLang === 'auto' ? 'auto' : sourceLang,
        tl: targetLang,
        dt: 't',
        q: text,
      });

      const res = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
      if (!res.ok) {
        throw new TranslationProviderError(`google-web-demo HTTP ${res.status}`, this.id);
      }

      const json = (await res.json()) as unknown;
      const { translated, detected } = parseGoogleWebResponse(json);
      if (translated === null) {
        throw new TranslationProviderError('Unexpected google-web-demo response shape', this.id);
      }
      translations.push(translated);
      detectedSourceLang = detected ?? detectedSourceLang;
    }

    return { translations, detectedSourceLang };
  }
}

function parseGoogleWebResponse(json: unknown): { translated: string | null; detected?: string } {
  // Response shape: [ [ [translatedChunk, originalChunk, ...], ... ], null, detectedLang, ... ]
  if (!Array.isArray(json) || !Array.isArray(json[0])) return { translated: null };
  const chunks = json[0] as unknown[];
  let translated = '';
  for (const chunk of chunks) {
    if (Array.isArray(chunk) && typeof chunk[0] === 'string') {
      translated += chunk[0];
    }
  }
  const detected = typeof json[2] === 'string' ? (json[2] as string) : undefined;
  return { translated: translated || null, detected };
}
