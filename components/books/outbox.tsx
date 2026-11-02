"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { applyResults, badgeText, batchFailed, discard, due, enqueue, prune, resultText, retry, stuckCount, waitingCount, type OutboxAction, type OutboxItem, type SyncResult } from "@/lib/books-outbox";
import { naira } from "@/lib/books";
import { Icon } from "./shared";

// The phone's side of offline entry (docs/BUSINESS-BOOKS.md, step 8; the rules are lib/books-outbox.ts, the server lib/books-sync-server.ts).
// IndexedDB "notesapp-books": the outbox (one record per entry, by clientId), and a few snapshots so Books opens with no connection (the
// day's home, the items and prices, the customers) plus the last sign-in token for Background Sync. The service worker (public/sw.js)
// reads the same database when it syncs on its own.
const DB = "notesapp-books", VERSION = 1;
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej(new Error("no IndexedDB"));
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("outbox")) d.createObjectStore("outbox", { keyPath: "clientId" }); if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv"); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = async <T,>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> => {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => { res(req ? (req.result as T) : undefined); d.close(); };
    t.onerror = () => { rej(t.error); d.close(); };
  });
};
export const readOutbox = async (): Promise<OutboxItem[]> => (await tx<OutboxItem[]>("outbox", "readonly", (s) => s.getAll()).catch(() => [])) ?? [];
export async function writeOutbox(list: OutboxItem[]) {
  const d = await open();
  await new Promise<void>((res, rej) => {
    const t = d.transaction("outbox", "readwrite"), s = t.objectStore("outbox");
    s.clear(); for (const x of list) s.put(x);
    t.oncomplete = () => { res(); d.close(); }; t.onerror = () => { rej(t.error); d.close(); };
  });
}
export const kvGet = async <T,>(key: string): Promise<T | undefined> => tx<T>("kv", "readonly", (s) => s.get(key)).catch(() => undefined);
export const kvSet = async (key: string, value: unknown) => { await tx("kv", "readwrite", (s) => { s.put(value, key); }).catch(() => undefined); };

// A failure that means "no connection" rather than "the server said no".
export const isOfflineError = (e: unknown) => (typeof navigator !== "undefined" && navigator.onLine === false) || e instanceof TypeError || /network|failed to fetch|load failed|offline/i.test(String((e as Error)?.message ?? ""));

type Ctx = {
  items: OutboxItem[]; owner: string; syncing: boolean;
  queue: (action: OutboxAction, body: Record<string, unknown>, label: string, totalKobo: number) => Promise<OutboxItem>;
  syncNow: () => Promise<void>; retryItem: (clientId: string) => Promise<void>; dropItem: (clientId: string) => Promise<void>;
};
const OutboxContext = createContext<Ctx | null>(null);
export const useOutbox = () => useContext(OutboxContext);

export function OutboxProvider({ user, owner, onSynced, children }: { user: User; owner: string; onSynced: () => void; children: ReactNode }) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);
  const ownerUid = owner || user.uid;
  const save = useCallback(async (next: OutboxItem[]) => { setItems(next); await writeOutbox(next).catch(() => undefined); }, []);

  const syncNow = useCallback(async () => {
    if (busy.current || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
    busy.current = true; setSyncing(true);
    try {
      let list = prune(await readOutbox(), Date.now());
      const batch = due(list, Date.now()).filter((x) => x.owner === ownerUid);
      if (batch.length) {
        const ids = batch.map((x) => x.clientId);
        list = list.map((x) => (ids.includes(x.clientId) ? { ...x, state: "sending" } : x));
        await save(list);
        try {
          const token = await user.getIdToken();
          await kvSet("token", { token, uid: user.uid, at: Date.now() });
          const res = await fetch("/api/books", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "sync", owner: ownerUid, items: batch.map((x) => ({ clientId: x.clientId, action: x.action, at: x.at, body: x.body })) }) });
          const j = await res.json().catch(() => ({}));
          if (res.ok) list = applyResults(list, (j.results ?? []) as SyncResult[], Date.now());
          else if (res.status === 403 || res.status === 402) list = applyResults(list, ids.map((clientId) => ({ clientId, status: "failed", notes: [], error: j.error || "These books can't take entries from this account now." })), Date.now());
          else list = batchFailed(list, ids, j.error || `The server said ${res.status}.`, Date.now());
        } catch (e) { list = batchFailed(list, ids, (e as Error).message || "No connection.", Date.now()); }
        await save(list);
        if (list.some((x) => ids.includes(x.clientId) && x.state === "done")) onSynced();
      } else setItems(list);
    } finally { busy.current = false; setSyncing(false); }
  }, [user, ownerUid, save, onSynced]);

  const queue = useCallback<Ctx["queue"]>(async (action, body, label, totalKobo) => {
    const clientId = String(body.clientId ?? "");
    const list = enqueue(await readOutbox(), { clientId, owner: ownerUid, action, body, at: new Date().toISOString(), label, totalKobo });
    await save(list);
    // Background Sync where the browser has it (Chrome on Android); otherwise the page syncs when it's next open or in view.
    navigator.serviceWorker?.ready.then((r) => (r as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync?.register("books-outbox")).catch(() => undefined);
    return list.find((x) => x.clientId === clientId)!;
  }, [ownerUid, save]);

  const retryItem = useCallback(async (clientId: string) => { await save(retry(await readOutbox(), clientId)); await syncNow(); }, [save, syncNow]);
  const dropItem = useCallback(async (clientId: string) => { await save(discard(await readOutbox(), clientId)); }, [save]);

  useEffect(() => {
    readOutbox().then((l) => setItems(prune(l, Date.now()))).then(syncNow).catch(() => undefined);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    user.getIdToken().then((token) => kvSet("token", { token, uid: user.uid, at: Date.now() })).catch(() => undefined);
    const go = () => { void syncNow(); };
    const vis = () => { if (document.visibilityState === "visible") go(); };
    const msg = (e: MessageEvent) => { if (e.data?.type === "books-sync") go(); if (e.data?.type === "books-synced") readOutbox().then(setItems).then(onSynced).catch(() => undefined); };
    window.addEventListener("online", go); window.addEventListener("focus", go); document.addEventListener("visibilitychange", vis);
    navigator.serviceWorker?.addEventListener("message", msg);
    const t = window.setInterval(() => { if (navigator.onLine) go(); }, 60_000);
    return () => { window.removeEventListener("online", go); window.removeEventListener("focus", go); document.removeEventListener("visibilitychange", vis); navigator.serviceWorker?.removeEventListener("message", msg); window.clearInterval(t); };
  }, [user, syncNow, onSynced]);

  const value = useMemo(() => ({ items: items.filter((x) => x.owner === ownerUid), owner: ownerUid, syncing, queue, syncNow, retryItem, dropItem }), [items, ownerUid, syncing, queue, syncNow, retryItem, dropItem]);
  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

// Save an entry: straight to the server when there's a connection; into the outbox when there isn't (or the request couldn't get out).
export async function saveOrQueue<T>(o: Ctx | null, send: () => Promise<T>, action: OutboxAction, body: Record<string, unknown>, label: string, totalKobo: number): Promise<{ queued: true; item: OutboxItem } | { queued: false; result: T }> {
  if (o && typeof navigator !== "undefined" && navigator.onLine === false) return { queued: true, item: await o.queue(action, body, label, totalKobo) };
  try { return { queued: false, result: await send() }; }
  catch (e) {
    if (o && isOfflineError(e)) return { queued: true, item: await o.queue(action, body, label, totalKobo) };
    throw e;
  }
}

// "3 waiting to sync": the badge, on the phone's tab bar and in the desktop sidebar.
export function SyncBadge({ compact }: { compact?: boolean }) {
  const o = useOutbox();
  const [online, setOnline] = useState(true);
  useEffect(() => { const f = () => setOnline(navigator.onLine); f(); window.addEventListener("online", f); window.addEventListener("offline", f); return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); }; }, []);
  if (!o) return null;
  const text = badgeText(o.items);
  if (!text && online) return null;
  const stuck = stuckCount(o.items) > 0;
  return (
    <button onClick={() => o.syncNow()} title={online ? "Sync now" : "You're offline. Entries are kept on this phone."} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-ui text-xs font-semibold ${stuck ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`} role="status">
      <Icon name="cloud" className="h-4 w-4" />{!online ? (text ? `Offline · ${text}` : "Offline · entries save on this phone") : o.syncing ? "Syncing…" : text}{compact ? "" : ""}
    </button>
  );
}

// What's waiting, and what happened to what synced: shown on Today while there's anything to show.
export function OutboxPanel() {
  const o = useOutbox();
  if (!o || !o.items.length) return null;
  const list = [...o.items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  return (
    <section className="card mt-4 p-5" aria-label="Entries on this phone">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-ui text-lg font-bold text-ink">On this phone</h2>
        <span className="text-sm text-slate">{waitingCount(o.items) ? `${waitingCount(o.items)} waiting to sync` : "All synced"}</span>
      </div>
      <ul className="mt-2 divide-y divide-rule">
        {list.map((x) => (
          <li key={x.clientId} className="flex items-start justify-between gap-3 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="block font-ui font-semibold text-ink">{x.label}</span>
              <span className={`block text-[13px] ${x.state === "stuck" ? "text-red-700" : x.state === "done" ? "text-slate" : "text-amber-800"}`}>
                {x.state === "done" && x.result ? resultText(x.result) : x.state === "stuck" && x.result ? resultText(x.result) : `Waiting to sync${x.lastError ? ` · ${x.lastError}` : ""}`}
              </span>
              {x.state === "stuck" && <span className="mt-1 flex gap-3 text-xs font-semibold"><button onClick={() => o.retryItem(x.clientId)} className="text-crimson">Try again</button><button onClick={() => window.confirm("Remove this entry from the phone? It won't be saved.") && o.dropItem(x.clientId)} className="text-slate">Remove</button></span>}
            </span>
            <span className="shrink-0 font-ui font-bold text-ink">{naira(x.totalKobo)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
