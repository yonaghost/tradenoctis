/**
 * Minimal in-process LRU cache used for translation strings, OCR results and
 * processed images, all keyed by content hash (see `hash.ts`).
 *
 * Limitation: this cache lives in the Node.js process memory. On a
 * long-running server (e.g. `next start`, a container, a VM) it persists for
 * the life of the process. On a serverless/edge deployment where each
 * request may hit a fresh instance, it effectively becomes a no-op cache —
 * the pipeline still works correctly, just without the speed-up. See
 * docs/LIMITATIONS.md.
 */
export class MemoryCache<V> {
  private map = new Map<string, V>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // refresh recency
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }
}

// Module-level singletons so every API route invocation within the same
// server process shares the same cache.
export const translationTextCache = new MemoryCache<string>(20_000);
export const ocrResultCache = new MemoryCache<unknown>(2_000);
export const compositeImageCache = new MemoryCache<string>(2_000);
