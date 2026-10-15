import type { Firestore } from "firebase-admin/firestore";

// Platform numbers that are built by reading whole collections (traction, revenue) are kept as a snapshot in
// `statCache/{key}` and rebuilt at most once per `maxAgeMs`, however many people open the pages and on whichever server
// instance. Without this every cold instance re-read every user, payment and ledger entry. Opening a page costs one
// read; "Refresh now" (fresh: true) rebuilds straight away. Server-only: firestore.rules has no rule for statCache, so
// browsers can't read or write it.
type Snap<T> = { at: number; data: T };
const memory = new Map<string, Snap<unknown>>();
const building = new Map<string, Promise<Snap<unknown>>>();

export async function storedSnapshot<T>(
  db: Firestore,
  key: string,
  maxAgeMs: number,
  build: () => Promise<T>,
  opts: { fresh?: boolean } = {},
): Promise<{ data: T; asOf: string }> {
  const out = (s: Snap<T>) => ({ data: s.data, asOf: new Date(s.at).toISOString() });
  const young = (s?: Snap<unknown> | null) => !!s && Date.now() - s.at < maxAgeMs;
  if (!opts.fresh) {
    const m = memory.get(key);
    if (young(m)) return out(m as Snap<T>);
    const doc = await db.collection("statCache").doc(key).get().catch(() => null);
    const d = doc?.exists ? doc.data() : null;
    if (d && typeof d.json === "string" && typeof d.at === "number") {
      const s: Snap<T> = { at: d.at, data: JSON.parse(d.json) as T };
      memory.set(key, s);
      if (young(s)) return out(s);
    }
  }
  let job = building.get(key) as Promise<Snap<T>> | undefined;
  if (!job) {
    job = (async () => {
      const s: Snap<T> = { at: Date.now(), data: await build() };
      memory.set(key, s);
      // Stored as JSON text: the reports hold optional (undefined) fields Firestore won't accept as values.
      await db.collection("statCache").doc(key).set({ at: s.at, json: JSON.stringify(s.data) }).catch(() => {});
      return s;
    })().finally(() => building.delete(key));
    building.set(key, job);
  }
  try {
    return out(await job);
  } catch (err) {
    // A failed rebuild serves the last snapshot rather than an error.
    const old = memory.get(key) as Snap<T> | undefined;
    if (old) return out(old);
    throw err;
  }
}
