import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../cache/memoryCache';

describe('MemoryCache', () => {
  it('stores and retrieves values', () => {
    const cache = new MemoryCache<string>(10);
    cache.set('a', '1');
    expect(cache.get('a')).toBe('1');
    expect(cache.has('a')).toBe(true);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry once capacity is exceeded', () => {
    const cache = new MemoryCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // 'a' should be evicted (least recently used)
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });

  it('treats a get() as a recency refresh', () => {
    const cache = new MemoryCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // refresh 'a', so 'b' becomes least-recently-used
    cache.set('c', 3);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });
});
