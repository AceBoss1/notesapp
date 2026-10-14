// Notes Life saves: on this device after every change (localStorage), and in the player's NotesApp account (Firestore lifeSaves/{uid})
// about every 30 seconds, after important moments, and when the tab is hidden. Restore points: one per real hour of the day (h0–h23,
// overwritten as the hours come round) and one per day of the week (d0–d6). Only needs, place and looks are in a save: money and what
// you own are on the server, so restoring a save can never add or remove them.
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitize, type SaveState } from "@/lib/life/play";

const KEY = (uid: string) => `notesLife:save:${uid}`;
const MARK = (uid: string) => `notesLife:points:${uid}`;
type Stored = { state: SaveState; savedAt: number };

function readLocal(uid: string): Stored | null {
  try { const raw = localStorage.getItem(KEY(uid)); if (!raw) return null; const j = JSON.parse(raw); return { state: sanitize(j.state), savedAt: Number(j.savedAt) || 0 }; } catch { return null; }
}
export function saveLocal(uid: string, state: SaveState, now = Date.now()) {
  try { localStorage.setItem(KEY(uid), JSON.stringify({ state, savedAt: now })); } catch { /* private mode: the cloud save still works */ }
}

// The newer of this device's save and the cloud save.
export async function loadSave(uid: string): Promise<{ state: SaveState; from: "device" | "cloud" | "new" }> {
  const local = readLocal(uid);
  let cloud: Stored | null = null;
  try { const d = (await getDoc(doc(db, "lifeSaves", uid))).data(); if (d?.state) cloud = { state: sanitize(JSON.parse(String(d.state))), savedAt: Number(d.savedAt) || 0 }; } catch { /* offline: the device save is enough */ }
  if (local && (!cloud || local.savedAt >= cloud.savedAt)) return { state: local.state, from: "device" };
  if (cloud) return { state: cloud.state, from: "cloud" };
  return { state: sanitize(null), from: "new" };
}

export async function saveCloud(uid: string, state: SaveState, now = Date.now()): Promise<void> {
  const body = { state: JSON.stringify(state), v: 1, savedAt: Math.floor(now) };
  await setDoc(doc(db, "lifeSaves", uid), body);
  // Restore points, each written once when its slot comes round.
  const d = new Date(now);
  const hourKey = `${d.toDateString()} ${d.getHours()}`, dayKey = d.toDateString();
  let marks: { h?: string; d?: string } = {};
  try { marks = JSON.parse(localStorage.getItem(MARK(uid)) || "{}"); } catch { /* fine */ }
  const writes: Promise<void>[] = [];
  if (marks.h !== hourKey) { writes.push(setDoc(doc(db, "lifeSavePoints", `${uid}_h${d.getHours()}`), { uid, ...body, slot: `h${d.getHours()}` })); marks.h = hourKey; }
  if (marks.d !== dayKey) { writes.push(setDoc(doc(db, "lifeSavePoints", `${uid}_d${d.getDay()}`), { uid, ...body, slot: `d${d.getDay()}` })); marks.d = dayKey; }
  await Promise.all(writes);
  try { localStorage.setItem(MARK(uid), JSON.stringify(marks)); } catch { /* fine */ }
}

export type RestorePoint = { slot: string; savedAt: number; kind: "hourly" | "daily" };
export async function restorePoints(uid: string): Promise<RestorePoint[]> {
  const snap = await getDocs(query(collection(db, "lifeSavePoints"), where("uid", "==", uid)));
  const week = Date.now() - 7 * 86_400_000, day = Date.now() - 86_400_000;
  return snap.docs.map((x) => ({ slot: String(x.data().slot), savedAt: Number(x.data().savedAt), kind: String(x.data().slot).startsWith("h") ? "hourly" as const : "daily" as const }))
    .filter((p) => p.savedAt > (p.kind === "hourly" ? day : week)).sort((a, b) => b.savedAt - a.savedAt);
}
export async function restorePoint(uid: string, slot: string): Promise<SaveState | null> {
  const d = (await getDoc(doc(db, "lifeSavePoints", `${uid}_${slot}`))).data();
  return d?.state ? sanitize(JSON.parse(String(d.state))) : null;
}
