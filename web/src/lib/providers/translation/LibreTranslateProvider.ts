import {
  TranslationProvider,
  TranslationProviderError,
  TranslationRequest,
  TranslationResult,
} from './TranslationProvider';

/**
 * LibreTranslate (https://github.com/LibreTranslate/LibreTranslate) — open
 * source, self-hostable MT engine. Good fit when privacy or cost matters
 * more than best-in-class quality. Point `baseUrl` at your own instance;
 * `apiKey` is only required if that instance enforces one.
 */
export class LibreTranslateProvider implements TranslationProvider {
  readonly id = 'libretranslate';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async translate({ texts, sourceLang, targetLang }: TranslationRequest): Promise<TranslationResult> {
    if (texts.length === 0) return { translations: [] };

    // LibreTranslate's /translate accepts an array for `q` in recent
    // versions; to stay compatible with older deployments we translate
    // sequentially-batched requests instead of relying on that.
    const translations: string[] = [];
    let detectedSourceLang: string | undefined;

    for (const text of texts) {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: sourceLang === 'auto' ? 'auto' : sourceLang,
          target: targetLang,
          format: 'text',
          ...(this.apiKey ? { api_key: this.apiKey } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new TranslationProviderError(`LibreTranslate HTTP ${res.status}: ${body}`, this.id);
      }

      const json = (await res.json()) as { translatedText?: string; detectedLanguage?: { language?: string } };
      if (typeof json.translatedText !== 'string') {
        throw new TranslationProviderError('Unexpected LibreTranslate response shape', this.id);
      }
      translations.push(json.translatedText);
      detectedSourceLang = json.detectedLanguage?.language ?? detectedSourceLang;
    }

    return { translations, detectedSourceLang };
  }
}
