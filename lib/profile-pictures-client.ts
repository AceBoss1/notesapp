"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { DEFAULT_AVATAR } from "@/lib/admin";
import type { ProfilePicture } from "@/lib/profile-pictures";

// A member's pictures, newest first, with the one they use now at the front even if it was never recorded.
export async function picturesOf(uid: string, current: string): Promise<ProfilePicture[]> {
  const snap = await getDocs(query(collection(db, "profilePictures"), where("uid", "==", uid))).catch(() => null);
  const list = (snap?.docs ?? []).map((d) => ({ id: d.id, url: String(d.data().url), createdAt: String(d.data().createdAt) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const now = current && current !== DEFAULT_AVATAR ? current : "";
  return now ? [list.find((p) => p.url === now) ?? { id: "", url: now, createdAt: "" }, ...list.filter((p) => p.url !== now)] : list;
}

// Tell the server about a new profile picture (and the one it replaced). Best effort: the picture is already changed.
export async function notePictureChange(url: string, previous?: string): Promise<void> {
  const u = auth.currentUser;
  if (!u) return;
  await fetch("/api/account/pictures", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await u.getIdToken()}` }, body: JSON.stringify({ url, previous }) }).catch(() => {});
}

export async function removeOldPicture(id: string): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error("Sign in first.");
  const r = await fetch(`/api/account/pictures?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${await u.getIdToken()}` } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't remove it.");
}
