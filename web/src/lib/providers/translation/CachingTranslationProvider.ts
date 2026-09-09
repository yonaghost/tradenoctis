import { translationTextCache } from '../../cache/memoryCache';
import { textCacheKey } from '../../cache/hash';
import { TranslationProvider, TranslationRequest, TranslationResult } from './TranslationProvider';

/**
 * Decorator: caches each individual string by content hash + language pair,
 * so repeated phrases (nav menus, boilerplate, repeated manga sound effects)
 * are translated once. Only the cache-miss subset is sent to the wrapped
 * provider, preserving input order in the response.
 */
export class CachingTranslationProvider implements TranslationProvider {
  readonly id: string;

  constructor(private readonly inner: TranslationProvider) {
    this.id = `cached(${inner.id})`;
  }

  async translate({ texts, sourceLang, targetLang }: TranslationRequest): Promise<TranslationResult> {
    const results = new Array<string | undefined>(texts.length);
    const missIndexes: number[] = [];
    const missTexts: string[] = [];

    texts.forEach((text, i) => {
      const key = textCacheKey(text, sourceLang, targetLang);
      const cached = translationTextCache.get(key);
      if (cached !== undefined) {
        results[i] = cached;
      } else {
        missIndexes.push(i);
        missTexts.push(text);
      }
    });

    let detectedSourceLang: string | undefined;
    if (missTexts.length > 0) {
      const fresh = await this.inner.translate({ texts: missTexts, sourceLang, targetLang });
      detectedSourceLang = fresh.detectedSourceLang;
      missIndexes.forEach((originalIndex, j) => {
        const translated = fresh.translations[j] ?? texts[originalIndex];
        results[originalIndex] = translated;
        translationTextCache.set(textCacheKey(texts[originalIndex], sourceLang, targetLang), translated);
      });
    }

    return {
      translations: results.map((r, i) => r ?? texts[i]),
      detectedSourceLang,
    };
  }
}
