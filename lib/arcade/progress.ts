// What a signed-in member's Arcade progress may hold (owner, 21 Nov 2026: "we need to fix the login saving progress"). The games keep
// their wins, records and choices as small text values under keys like "arcade-ncho-wins" (lib/arcade/store.ts); for a signed-in
// member those are saved to arcadeProgress/{uid}.kv by /api/arcade/progress. Shared by the server and the tests, so both clean alike.

export const MAX_KEYS = 120;
export const MAX_VALUE = 2_000;
const KEY = /^(notes-)?arcade-[a-z0-9][a-z0-9-]{0,62}$/;

export function cleanKey(k: unknown): string | null {
  return typeof k === "string" && KEY.test(k) ? k : null;
}

export function cleanValue(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" && v.length <= MAX_VALUE ? v : null;
}

// Only well-formed keys and values; anything else is dropped, not saved.
export function cleanKv(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const key = cleanKey(k);
    const value = cleanValue(v);
    if (key && value !== null) out[key] = value;
  }
  return out;
}

// Merges an update into what's saved. A new key past the limit is refused; existing keys can always be updated.
export function mergeKv(saved: Record<string, string>, update: Record<string, string>): { kv: Record<string, string>; refused: string[] } {
  const kv = { ...cleanKv(saved) };
  const refused: string[] = [];
  for (const [k, v] of Object.entries(cleanKv(update))) {
    if (!(k in kv) && Object.keys(kv).length >= MAX_KEYS) { refused.push(k); continue; }
    kv[k] = v;
  }
  return { kv, refused };
}
