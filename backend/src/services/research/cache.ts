interface CacheEntry<T> {
  expiresAt: number;
  promise: Promise<T>;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Memoize an async loader by key for `ttlMs`, sharing in-flight promises.
 *
 * A rejected load is evicted so the next call retries.
 *
 * @param key Cache key.
 * @param ttlMs Time-to-live in milliseconds.
 * @param load Loader invoked on a miss.
 * @returns The cached or freshly loaded value.
 */
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  const promise = load();
  const entry: CacheEntry<T> = {
    expiresAt: now + Math.max(0, ttlMs),
    promise,
  };

  cache.set(key, entry);

  promise.catch(() => {
    if (cache.get(key) === entry) {
      cache.delete(key);
    }
  });

  return promise;
}

/** Clear all cached research entries (used by tests). */
export function clearResearchCache(): void {
  cache.clear();
}
