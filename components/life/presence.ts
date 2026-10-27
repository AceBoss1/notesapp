// Notes Life presence: where you are in the game (lifePresence/{uid}: place, outfit, time), so real players at the same place see each
// other and can open a real NotesApp chat. Only the place is shared; the name and picture come from the player's public profile, so
// nobody can pretend to be someone else. Switch it off in Settings ("Show me to other players"); it's on this device only.
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Present = { uid: string; username: string; name: string; avatar: string; outfit: string };
export type PresencePlace = "home" | "work" | "chef" | "hotel" | "itel" | "dw" | "market" | "wuse2" | "ride";
const FRESH_MS = 10 * 60_000; // seen in the last ten real minutes
const KEY = "notesLife:showMe";

export const showMe = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
export const setShowMe = (on: boolean) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* fine */ } };

export async function announce(uid: string, place: PresencePlace, outfit: string) {
  if (!showMe()) return hide(uid);
  await setDoc(doc(db, "lifePresence", uid), { place, outfit, at: Date.now() }).catch(() => {});
}
export async function hide(uid: string) { await deleteDoc(doc(db, "lifePresence", uid)).catch(() => {}); }

const profiles = new Map<string, Promise<{ username: string; name: string; avatar: string } | null>>();
const profile = (uid: string) => {
  if (!profiles.has(uid)) profiles.set(uid, getDoc(doc(db, "users", uid)).then((d) => { const x = d.data(); return x?.username && x.suspended !== true ? { username: String(x.username), name: String(x.displayName ?? x.username), avatar: String(x.avatar ?? "") } : null; }).catch(() => null));
  return profiles.get(uid)!;
};

// Other real players at this place right now (at most 4, newest first).
export async function whoIsHere(me: string, place: PresencePlace): Promise<Present[]> {
  if (place === "home") return [];
  const snap = await getDocs(query(collection(db, "lifePresence"), where("place", "==", place), orderBy("at", "desc"), limit(8))).catch(() => null);
  if (!snap) return [];
  const fresh = snap.docs.filter((d) => d.id !== me && Number(d.data().at) > Date.now() - FRESH_MS).slice(0, 4);
  const rows = await Promise.all(fresh.map(async (d) => { const p = await profile(d.id); return p ? { uid: d.id, ...p, outfit: String(d.data().outfit || "#64748b") } : null; }));
  return rows.filter((r): r is Present => !!r);
}
