import {
  TranslationProvider,
  TranslationProviderError,
  TranslationRequest,
  TranslationResult,
} from './TranslationProvider';

/**
 * Official Google Cloud Translation API v2 (REST, API-key auth).
 * https://cloud.google.com/translate/docs/reference/rest/v2/translate
 *
 * This is the recommended provider for production: stable SLA, broad
 * language coverage, official ToS. Requires `GOOGLE_TRANSLATE_API_KEY`.
 */
export class GoogleCloudTranslationProvider implements TranslationProvider {
  readonly id = 'google-cloud';

  constructor(private readonly apiKey: string) {}

  async translate({ texts, sourceLang, targetLang }: TranslationRequest): Promise<TranslationResult> {
    if (texts.length === 0) return { translations: [] };

    const params = new URLSearchParams();
    params.set('key', this.apiKey);
    params.set('target', normalizeForGoogle(targetLang));
    params.set('format', 'text');
    if (sourceLang !== 'auto') params.set('source', normalizeForGoogle(sourceLang));
    for (const text of texts) params.append('q', text);

    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?${params.toString()}`, {
      method: 'POST',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new TranslationProviderError(`Google Cloud Translation HTTP ${res.status}: ${body}`, this.id);
    }

    const json = (await res.json()) as {
      data?: { translations?: { translatedText: string; detectedSourceLanguage?: string }[] };
    };
    const translations = json.data?.translations;
    if (!translations || translations.length !== texts.length) {
      throw new TranslationProviderError('Unexpected Google Cloud Translation response shape', this.id);
    }

    return {
      translations: translations.map((t) => decodeHtmlEntities(t.translatedText)),
      detectedSourceLang: translations[0]?.detectedSourceLanguage,
    };
  }
}

function normalizeForGoogle(lang: string): string {
  // Google Cloud Translation uses 'zh-CN'/'zh-TW' style codes already.
  return lang;
}

// The v2 API returns HTML-escaped text when format=text is respected loosely
// by some locales; guard against stray entities leaking into the UI.
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
