// Offline entry in Business books (docs/BUSINESS-BOOKS.md, step 8). Pure: the outbox's rules, kept apart from IndexedDB
// (components/books/outbox-store.ts) so they can be tested. The server side is lib/books-sync-server.ts (POST /api/books { action: "sync" }).
//
// - A sale, expense, payment received or purchase made with no connection goes into the outbox on the phone, with its own clientId. It
//   shows straight away, marked "waiting to sync".
// - The outbox is sent when the phone is back online: Background Sync where the browser has it (Chrome on Android), otherwise when Books is
//   opened or comes back into view, and on the `online` event. Up to SYNC_BATCH at a time, oldest first.
// - The server saves each one once (bookEntries/{owner}_{clientId}), so sending again is always safe. What it says about each comes back as
//   a result: saved, already saved, or not saved with the reason; and notes such as "Rice 10kg: only 2 were in stock, count it" or
//   "Funke wasn't in your customers, so she was added".
// - A failure that may pass (no connection, the server busy, signed out) is tried again later, waiting longer each time; one that won't
//   (the entry itself is wrong) stops and asks the seller.
export type OutboxAction = "sale" | "expense" | "payment" | "purchase";
export const OUTBOX_ACTIONS: OutboxAction[] = ["sale", "expense", "payment", "purchase"];
export const SYNC_BATCH = 25;
export const OUTBOX_MAX = 500; // entries a phone can hold before it must sync
export const KEEP_DONE_MS = 3 * 86_400_000; // results stay on the phone 3 days, so the seller can see what happened
export const MAX_BACKOFF_MS = 30 * 60_000;
export const OFFLINE_MAX_AGE_DAYS = 14; // an entry recorded offline keeps its own day if it syncs within 14 days

export type SyncStatus = "saved" | "duplicate" | "failed";
export type SyncResult = { clientId: string; status: SyncStatus; notes: string[]; error?: string; retry?: boolean; entryId?: string; receiptUrl?: string };
export type OutboxItem = {
  clientId: string; owner: string; action: OutboxAction; body: Record<string, unknown>;
  at: string; // when it was recorded on the phone (ISO)
  label: string; totalKobo: number; // what the badge and list show while it waits
  state: "waiting" | "sending" | "done" | "stuck";
  tries: number; nextTryAt: number; result?: SyncResult; lastError?: string; doneAt?: string;
};

const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
export const isClientId = (v: unknown): v is string => typeof v === "string" && CLIENT_ID.test(v);

// A new entry for the outbox. Throws when it can't be queued (an unknown action, no clientId, or a full outbox).
export function enqueue(list: OutboxItem[], item: Omit<OutboxItem, "state" | "tries" | "nextTryAt">): OutboxItem[] {
  if (!OUTBOX_ACTIONS.includes(item.action)) throw new Error("That can't be saved offline.");
  if (!isClientId(item.clientId)) throw new Error("Missing clientId.");
  if (list.some((x) => x.clientId === item.clientId)) return list; // a double tap: once is enough
  if (list.filter((x) => x.state !== "done").length >= OUTBOX_MAX) throw new Error(`${OUTBOX_MAX} entries are waiting. Connect to sync them first.`);
  return [...list, { ...item, body: { ...item.body, clientId: item.clientId, action: item.action }, state: "waiting", tries: 0, nextTryAt: 0 }];
}

// Waiting (and stuck-in-sending after a crash) entries whose time has come, oldest first, at most `limit`.
export function due(list: OutboxItem[], now: number, limit = SYNC_BATCH): OutboxItem[] {
  return list.filter((x) => (x.state === "waiting" || x.state === "sending") && x.nextTryAt <= now).sort((a, b) => a.at.localeCompare(b.at)).slice(0, limit);
}
export const backoff = (tries: number) => Math.min(MAX_BACKOFF_MS, 15_000 * 2 ** Math.max(0, tries - 1));

// After a sync: each result moves its entry on. Saved and already-saved are done; a failure the server says may pass is tried again later.
export function applyResults(list: OutboxItem[], results: SyncResult[], now: number): OutboxItem[] {
  const by = new Map(results.map((r) => [r.clientId, r]));
  return list.map((x) => {
    const r = by.get(x.clientId);
    if (!r) return x;
    if (r.status === "saved" || r.status === "duplicate") return { ...x, state: "done", result: r, doneAt: new Date(now).toISOString(), lastError: undefined };
    if (r.retry) { const tries = x.tries + 1; return { ...x, state: "waiting", tries, nextTryAt: now + backoff(tries), lastError: r.error, result: r }; }
    return { ...x, state: "stuck", result: r, lastError: r.error };
  });
}
// The whole batch didn't get through (no connection, a 5xx, signed out): all of it waits and is tried again.
export function batchFailed(list: OutboxItem[], ids: string[], error: string, now: number): OutboxItem[] {
  const set = new Set(ids);
  return list.map((x) => (set.has(x.clientId) ? { ...x, state: "waiting", tries: x.tries + 1, nextTryAt: now + backoff(x.tries + 1), lastError: error } : x));
}
// A stuck entry the seller fixed, or wants to try again as it is.
export const retry = (list: OutboxItem[], clientId: string, body?: Record<string, unknown>): OutboxItem[] =>
  list.map((x) => (x.clientId === clientId ? { ...x, state: "waiting", nextTryAt: 0, ...(body ? { body: { ...x.body, ...body } } : {}), lastError: undefined } : x));
export const discard = (list: OutboxItem[], clientId: string) => list.filter((x) => x.clientId !== clientId);
// Done entries go after KEEP_DONE_MS.
export const prune = (list: OutboxItem[], now: number) => list.filter((x) => x.state !== "done" || !x.doneAt || now - Date.parse(x.doneAt) < KEEP_DONE_MS);

export const waitingCount = (list: OutboxItem[], owner?: string) => list.filter((x) => (x.state === "waiting" || x.state === "sending") && (!owner || x.owner === owner)).length;
export const stuckCount = (list: OutboxItem[], owner?: string) => list.filter((x) => x.state === "stuck" && (!owner || x.owner === owner)).length;
export function badgeText(list: OutboxItem[], owner?: string): string {
  const w = waitingCount(list, owner), s = stuckCount(list, owner);
  if (!w && !s) return "";
  return [w ? `${w} waiting to sync` : "", s ? `${s} need${s === 1 ? "s" : ""} a look` : ""].filter(Boolean).join(" · ");
}
// What the seller reads about one entry once it's synced.
export function resultText(r: SyncResult): string {
  const head = r.status === "saved" ? "Saved" : r.status === "duplicate" ? "Already saved" : `Not saved: ${r.error ?? "try again"}`;
  return [head, ...r.notes].join(". ").replace(/\.\./g, ".");
}

// The day an offline entry belongs to: the moment it was recorded on the phone, if that's within OFFLINE_MAX_AGE_DAYS and not in the
// future (a phone's clock can be wrong); otherwise the moment it synced.
export function recordedAt(raw: unknown, now: Date): Date {
  const t = typeof raw === "string" ? Date.parse(raw) : NaN;
  if (!Number.isFinite(t) || t > now.getTime() + 5 * 60_000 || now.getTime() - t > OFFLINE_MAX_AGE_DAYS * 86_400_000) return now;
  return new Date(Math.min(t, now.getTime()));
}
