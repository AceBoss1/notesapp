// Tiny in-memory TTL cache with in-flight de-duplication. Firestore bills
// per document read, and several public pages read WHOLE collections
// (all notes, all users) on every visit — on the free tier that runs
// through the 50,000 reads/day quota quickly. Wrapping those reads in a
// short cache means one read set serves many visitors (per warm server
// instance, or per browser tab on the client).
export function ttlCache<T>(ttlMs: number, loader: () => Promise<T>) {
  let value: { at: number; data: T } | null = null;
  let inflight: Promise<T> | null = null;
  const get = async (): Promise<T> => {
    if (value && Date.now() - value.at < ttlMs) return value.data;
    if (inflight) return inflight;
    inflight = loader()
      .then((data) => {
        value = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
    // If a refresh fails but we have stale data, serve it rather than error.
    return inflight.catch((err) => {
      if (value) return value.data;
      throw err;
    });
  };
  get.invalidate = () => {
    value = null;
  };
  return get;
}

// The same, one cache per key (a username, a number of days…). Keeps at most `max` keys; the oldest goes first.
export function ttlCacheBy<K, T>(ttlMs: number, loader: (key: K) => Promise<T>, max = 500) {
  const caches = new Map<K, ReturnType<typeof ttlCache<T>>>();
  const get = (key: K): Promise<T> => {
    let c = caches.get(key);
    if (!c) {
      if (caches.size >= max) caches.delete(caches.keys().next().value as K);
      c = ttlCache(ttlMs, () => loader(key));
      caches.set(key, c);
    }
    return c();
  };
  get.invalidate = (key?: K) => { if (key === undefined) caches.clear(); else caches.delete(key); };
  return get;
}
