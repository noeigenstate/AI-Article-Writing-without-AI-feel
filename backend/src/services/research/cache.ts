interface CacheEntry<T> {
  expiresAt: number;
  promise: Promise<T>;
}

const cache = new Map<string, CacheEntry<unknown>>();

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

export function clearResearchCache(): void {
  cache.clear();
}
