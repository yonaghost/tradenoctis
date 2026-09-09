/**
 * Contract every translation backend must satisfy. Keeping this narrow lets
 * us swap engines (LibreTranslate, Google Cloud Translation, ...) without
 * touching the pipeline that calls it.
 */
export interface TranslationRequest {
  texts: string[];
  /** BCP-47/ISO code, or 'auto' to let the provider detect it. */
  sourceLang: string;
  targetLang: string;
}

export interface TranslationResult {
  translations: string[];
  /** Detected source language, when the provider supports auto-detect. */
  detectedSourceLang?: string;
}

export interface TranslationProvider {
  readonly id: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export class TranslationProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TranslationProviderError';
  }
}
