import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { DigitalFail, DigitalPurchase } from "./digital-server";
import { PublicLesson } from "./store";

// Server-only. View-only items (and courses): the buyer never gets a file, they open it in the player. Each purchase works
// on at most MAX_DEVICES devices, with unlimited sessions on those. Every attempt from a third device is refused and counted
// (viewAccess/{reference}.blocked), and a buyer who loses a device can remove it — a couple of times a month, so a
// registration can't be passed around.
export const MAX_DEVICES = 2;
export const MAX_REMOVALS = 2;
const REMOVAL_WINDOW_MS = 30 * 86_400_000;

export type StoredLesson = PublicLesson & { uid?: string; key?: string; size?: number };
export type ViewFile = { ownerUid: string; access?: "view"; lessons?: StoredLesson[] };
export type Device = { id: string; label: string; firstAt: string; lastAt: string };
type Access = { reference: string; buyerUid: string; itemId: string; devices: Device[]; blocked: number; removals: string[] };

export const publicLesson = (l: StoredLesson): PublicLesson => ({ id: l.id, title: l.title, kind: l.kind, ...(l.durationSec ? { durationSec: l.durationSec } : {}) });

export function cleanDeviceId(v: unknown): string {
  const s = String(v ?? "");
  if (!/^[A-Za-z0-9-]{16,64}$/.test(s)) throw new DigitalFail("This browser couldn't be identified. Reload the page and try again.", 400);
  return s;
}
const cleanLabel = (v: unknown) => String(v ?? "Unknown device").replace(/[^\w .,()/+-]/g, "").trim().slice(0, 60) || "Unknown device";

export async function loadViewPurchase(uid: string, reference: string) {
  const db = getAdminDb();
  const pref = db.doc(`digitalPurchases/${reference}`);
  const p = (await pref.get()).data() as DigitalPurchase | undefined;
  if (!p || p.buyerUid !== uid) throw new DigitalFail("Purchase not found.", 404);
  const file = (await db.doc(`storeFiles/${p.itemId}`).get()).data() as ViewFile | undefined;
  if (file?.access !== "view" || !file.lessons?.length) throw new DigitalFail("This purchase isn't a view-only item.", 409);
  return { db, pref, p, file, lessons: file.lessons };
}

export type DeviceResult =
  | { ok: true; used: number; max: number; isNew: boolean; devices: Device[] }
  | { ok: false; used: number; max: number; attempt: number; devices: Device[] };

// Registers this device if there is room (register=true), or just checks it is already registered (register=false).
export async function checkDevice(reference: string, uid: string, itemId: string, deviceId: string, label: string, register: boolean): Promise<DeviceResult> {
  const db = getAdminDb();
  const ref = db.doc(`viewAccess/${reference}`);
  return db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as Access | undefined;
    const devices = cur?.devices ?? [];
    const now = new Date().toISOString();
    const mine = devices.find((d) => d.id === deviceId);
    if (mine) {
      const next = devices.map((d) => (d.id === deviceId ? { ...d, lastAt: now } : d));
      t.set(ref, { reference, buyerUid: uid, itemId, devices: next, blocked: cur?.blocked ?? 0, removals: cur?.removals ?? [] });
      return { ok: true as const, used: next.length, max: MAX_DEVICES, isNew: false, devices: next };
    }
    if (register && devices.length < MAX_DEVICES) {
      const next = [...devices, { id: deviceId, label: cleanLabel(label), firstAt: now, lastAt: now }];
      t.set(ref, { reference, buyerUid: uid, itemId, devices: next, blocked: cur?.blocked ?? 0, removals: cur?.removals ?? [] });
      return { ok: true as const, used: next.length, max: MAX_DEVICES, isNew: true, devices: next };
    }
    const attempt = (cur?.blocked ?? 0) + (register ? 1 : 0);
    if (register) t.set(ref, { reference, buyerUid: uid, itemId, devices, blocked: attempt, lastBlockedAt: now, removals: cur?.removals ?? [] });
    return { ok: false as const, used: devices.length, max: MAX_DEVICES, attempt, devices };
  });
}

export async function removeDevice(reference: string, uid: string, deviceId: string): Promise<{ devices: Device[]; removalsLeft: number }> {
  const db = getAdminDb();
  const ref = db.doc(`viewAccess/${reference}`);
  return db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as Access | undefined;
    if (!cur || cur.buyerUid !== uid) throw new DigitalFail("Nothing to remove.", 404);
    const recent = (cur.removals ?? []).filter((r) => Date.now() - new Date(r).getTime() < REMOVAL_WINDOW_MS);
    if (recent.length >= MAX_REMOVALS) throw new DigitalFail(`You can remove a device ${MAX_REMOVALS} times in 30 days and you've used them. Contact support if you've lost access.`, 429);
    if (!cur.devices.some((d) => d.id === deviceId)) throw new DigitalFail("That device isn't registered.", 404);
    const devices = cur.devices.filter((d) => d.id !== deviceId);
    const removals = [...recent, new Date().toISOString()];
    t.update(ref, { devices, removals });
    return { devices, removalsLeft: MAX_REMOVALS - removals.length };
  });
}

// What the buyer is shown about their devices (the ids are theirs to remove by, and no one else's).
export const deviceView = (devices: Device[], currentId: string) => devices.map((d) => ({ id: d.id, label: d.label, lastAt: d.lastAt, current: d.id === currentId }));

// First open makes the sale final, exactly as the first download does for a file.
export async function markOpened(reference: string, firstAlready: boolean) {
  const now = new Date().toISOString();
  await getAdminDb().doc(`digitalPurchases/${reference}`).update({ downloads: FieldValue.increment(1), ...(firstAlready ? {} : { firstDownloadAt: now }), lastDownloadAt: now });
}
