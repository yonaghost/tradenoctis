import { describe, expect, it } from 'vitest';
import { CachingTranslationProvider } from '../providers/translation/CachingTranslationProvider';
import { TranslationProvider, TranslationRequest, TranslationResult } from '../providers/translation/TranslationProvider';

class CountingProvider implements TranslationProvider {
  readonly id = 'counting';
  calls: TranslationRequest[] = [];

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    this.calls.push(request);
    return { translations: request.texts.map((t) => `[${request.targetLang}] ${t}`) };
  }
}

describe('CachingTranslationProvider', () => {
  it('only forwards cache misses to the wrapped provider', async () => {
    const inner = new CountingProvider();
    // Unique text per test run avoids collisions with the shared module-level cache.
    const unique = `hello-${Date.now()}-${Math.random()}`;
    const provider = new CachingTranslationProvider(inner);

    const first = await provider.translate({ texts: [unique, 'again'], sourceLang: 'en', targetLang: 'pt' });
    expect(first.translations).toEqual([`[pt] ${unique}`, '[pt] again']);
    expect(inner.calls[0].texts).toEqual([unique, 'again']);

    const second = await provider.translate({ texts: [unique, 'again', 'new-one'], sourceLang: 'en', targetLang: 'pt' });
    expect(second.translations).toEqual([`[pt] ${unique}`, '[pt] again', '[pt] new-one']);
    // Second call should only forward the genuinely new text.
    expect(inner.calls[1].texts).toEqual(['new-one']);
  });

  it('keeps translations for different target languages independent', async () => {
    const inner = new CountingProvider();
    const provider = new CachingTranslationProvider(inner);
    const unique = `hi-${Date.now()}-${Math.random()}`;

    await provider.translate({ texts: [unique], sourceLang: 'en', targetLang: 'pt' });
    await provider.translate({ texts: [unique], sourceLang: 'en', targetLang: 'es' });

    expect(inner.calls).toHaveLength(2);
  });
});
