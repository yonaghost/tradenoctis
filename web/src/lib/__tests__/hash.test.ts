import { describe, expect, it } from 'vitest';
import { sha256Hex, textCacheKey, imageCacheKey } from '../cache/hash';

describe('hash helpers', () => {
  it('produces a stable hex digest for the same input', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'));
    expect(sha256Hex('hello')).not.toBe(sha256Hex('world'));
  });

  it('scopes text cache keys by language pair so translations never collide', () => {
    const a = textCacheKey('Hello', 'en', 'pt');
    const b = textCacheKey('Hello', 'en', 'es');
    const c = textCacheKey('Hello', 'auto', 'pt');
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('scopes image cache keys by content bytes and source-language hint', () => {
    const bytesA = Buffer.from('image-bytes-a');
    const bytesB = Buffer.from('image-bytes-b');
    expect(imageCacheKey(bytesA, 'auto')).not.toBe(imageCacheKey(bytesB, 'auto'));
    expect(imageCacheKey(bytesA, 'auto')).not.toBe(imageCacheKey(bytesA, 'ja'));
    expect(imageCacheKey(bytesA, 'auto')).toBe(imageCacheKey(bytesA, 'auto'));
  });
});
