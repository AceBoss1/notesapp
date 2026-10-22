"use client";
import { emptyProgress, mergeProgress, passPayload, type ExamId, type OfflinePass, type Progress, type StudentQuestion } from "@/lib/exam-prep";

// What Naija Exam Prep keeps on the phone (IndexedDB), so practice and mocks work with no data: saved packs, progress and the
// last offline mocks. Nothing here is sent anywhere unless the student is signed in (then progress is merged with the account).
export type SavedPack = { exam: ExamId; questions: StudentQuestion[]; savedAt: string; hasPack: boolean; pass?: OfflinePass & { sig: string }; publicKey?: string; uid?: string | null };

const DB = "naija-exam-prep", STORE = "kv";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}
const get = <T>(key: string) => tx<T | undefined>("readonly", (s) => s.get(key)).catch(() => undefined);
const put = (key: string, v: unknown) => tx("readwrite", (s) => s.put(v, key));
const del = (key: string) => tx("readwrite", (s) => s.delete(key));

export const savedPack = (exam: ExamId) => get<SavedPack>(`pack:${exam}`);
export async function savedPacks(): Promise<SavedPack[]> {
  const all = await Promise.all((["jamb", "waec", "neco"] as ExamId[]).map(savedPack));
  return all.filter((p): p is SavedPack => !!p);
}
export const keepPack = (p: SavedPack) => put(`pack:${p.exam}`, p);
export const forgetPack = (exam: ExamId) => del(`pack:${exam}`);

export const localProgress = async () => (await get<Progress>("progress")) ?? emptyProgress();
export const keepProgress = (p: Progress) => put("progress", p);
export async function mergeLocalProgress(p: Progress) { const merged = mergeProgress(await localProgress(), p); await keepProgress(merged); return merged; }

// The offline pass: signed by the server (P-256, lib/exam-prep-server.ts signPass) for this account and pack, until its date.
// Checked here with WebCrypto, so paid questions open offline only for the account that has the pack, and only until the pass ends.
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function passValid(p: SavedPack, uid: string | null | undefined, now = new Date()): Promise<boolean> {
  if (!p.pass || !p.publicKey || !uid || p.pass.uid !== uid || p.pass.exp <= now.toISOString()) return false;
  try {
    const key = await crypto.subtle.importKey("spki", b64(p.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const { sig, ...pass } = p.pass;
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64(sig), new TextEncoder().encode(passPayload(pass)));
  } catch { return false; }
}
// The questions a saved pack opens for this student right now: free ones always, paid ones with a valid pass.
export async function usableQuestions(p: SavedPack, uid: string | null | undefined): Promise<{ questions: StudentQuestion[]; paidOpen: boolean }> {
  const paidOpen = await passValid(p, uid);
  return { questions: p.questions.filter((q) => q.access === "free" || paidOpen), paidOpen };
}

// The pages (and their scripts) that must open with no connection, kept by the browser's cache; the service worker serves them.
export const PAGE_CACHE = "prep-pages-v1";
export async function cachePages(paths: string[]) {
  if (!("caches" in window)) return;
  const cache = await caches.open(PAGE_CACHE);
  for (const path of paths) {
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) continue;
      const html = await res.clone().text();
      await cache.put(path, res);
      const assets = Array.from(new Set(Array.from(html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g), (m) => m[0])));
      await Promise.all(assets.map(async (a) => { if (!(await cache.match(a))) await cache.add(a).catch(() => undefined); }));
    } catch { /* offline or blocked: tried again next time */ }
  }
}
