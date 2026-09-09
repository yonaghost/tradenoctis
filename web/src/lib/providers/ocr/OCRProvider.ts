export type TextOrientation = 'horizontal' | 'vertical';

export interface OCRWord {
  text: string;
  confidence: number; // 0-100
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: OCRWord[];
  orientation: TextOrientation;
}

export interface OCRResult {
  lines: OCRLine[];
  detectedLang?: string;
  /** Average confidence across all recognized words, 0-100. */
  averageConfidence: number;
}

export interface OCRRequest {
  imageBuffer: Buffer;
  /** ISO code hint, or 'auto' to let the provider pick a script-agnostic model. */
  languageHint: string;
}

/**
 * Contract every OCR backend must satisfy: bytes in, positioned text out.
 * Implementations must never throw for "no text found" — they should return
 * an empty `lines` array instead, so callers can fall back to the original
 * image without treating it as an error.
 */
export interface OCRProvider {
  readonly id: string;
  recognize(request: OCRRequest): Promise<OCRResult>;
}

export class OCRProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OCRProviderError';
  }
}
