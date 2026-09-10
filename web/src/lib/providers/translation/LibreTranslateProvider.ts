import {
  TranslationProvider,
  TranslationProviderError,
  TranslationRequest,
  TranslationResult,
} from './TranslationProvider';

// Free-tier hosts (Render, Railway free plans, etc.) commonly spin the
// container down after a period of inactivity, so the first request after
// a while can take tens of seconds to "cold start" before LibreTranslate
// even starts responding. A short timeout would treat that as a permanent
// failure on every idle-then-visit; this generous default gives a cold
// start room to finish while still eventually giving up rather than
// hanging a page-load forever. Override with LIBRETRANSLATE_TIMEOUT_MS.
const DEFAULT_TIMEOUT_MS = 45_000;

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
    private readonly timeoutMs: number = Number(process.env.LIBRETRANSLATE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  ) {}

  async translate({ texts, sourceLang, targetLang }: TranslationRequest): Promise<TranslationResult> {
    if (texts.length === 0) return { translations: [] };

    // LibreTranslate's /translate accepts an array for `q` in recent
    // versions; to stay compatible with older deployments we translate
    // sequentially-batched requests instead of relying on that.
    const translations: string[] = [];
    let detectedSourceLang: string | undefined;

    for (const text of texts) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      let res: Response;
      try {
        res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            q: text,
            source: sourceLang === 'auto' ? 'auto' : sourceLang,
            target: targetLang,
            format: 'text',
            ...(this.apiKey ? { api_key: this.apiKey } : {}),
          }),
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new TranslationProviderError(
            `LibreTranslate timed out after ${this.timeoutMs}ms (a free-tier instance may still be cold-starting — try again shortly)`,
            this.id,
          );
        }
        throw new TranslationProviderError('LibreTranslate request failed', this.id, err);
      } finally {
        clearTimeout(timeout);
      }

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
