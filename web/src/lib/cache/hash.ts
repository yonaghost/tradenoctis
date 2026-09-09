import { createHash } from 'node:crypto';

export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Stable cache key for a piece of text bound to a language pair. */
export function textCacheKey(text: string, sourceLang: string, targetLang: string): string {
  return sha256Hex(`${sourceLang}:${targetLang}:${text}`);
}

/** Stable cache key for image bytes bound to a source-language hint. */
export function imageCacheKey(bytes: Buffer, sourceLangHint: string): string {
  return `${sha256Hex(bytes)}:${sourceLangHint}`;
}
