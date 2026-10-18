"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { useMember } from "./member-client";
import type { RatingSummary } from "./reviews";

// Course likes and saves in the browser (lib/course-social-server.ts does the writing, through /api/academy/social).
async function post(user: User, body: Record<string, unknown>) {
  const r = await fetch("/api/academy/social", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save that.");
  return j;
}

// The courses you saved, live, shared by every card on the page (one listener per member).
let savedUid: string | null = null;
let savedSet = new Set<string>();
let stop: (() => void) | null = null;
const listeners = new Set<(s: Set<string>) => void>();
function watch(uid: string | null) {
  if (uid === savedUid) return;
  stop?.(); stop = null; savedUid = uid; savedSet = new Set();
  listeners.forEach((f) => f(savedSet));
  if (!uid) return;
  stop = onSnapshot(query(collection(db, "savedCourses"), where("uid", "==", uid)), (s) => { savedSet = new Set(s.docs.map((d) => String(d.data().courseId))); listeners.forEach((f) => f(savedSet)); }, () => {});
}
const flip = (id: string) => { const n = new Set(savedSet); if (n.has(id)) n.delete(id); else n.add(id); savedSet = n; listeners.forEach((f) => f(n)); };

export function useSavedCourses() {
  const { user } = useMember();
  const [saved, setSaved] = useState<Set<string>>(savedSet);
  useEffect(() => {
    if (user === undefined) return;
    watch(user?.uid ?? null);
    setSaved(savedSet);
    listeners.add(setSaved);
    return () => { listeners.delete(setSaved); };
  }, [user]);
  // Shown at once; put back if the server says no.
  const toggle = useCallback(async (courseId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "Sign in to save courses." };
    flip(courseId);
    try { await post(user, { action: "save", courseId }); return { ok: true }; }
    catch (e) { flip(courseId); return { ok: false, error: e instanceof Error ? e.message : "Couldn't save that." }; }
  }, [user]);
  return { saved, toggle, signedIn: !!user };
}

// One course's likes, your like, your save and its stars (the course page).
export function useCourseSocial(courseId: string | undefined) {
  const { user } = useMember();
  const [s, setS] = useState<{ likeCount: number; liked: boolean; rating: RatingSummary } | null>(null);
  useEffect(() => {
    if (!courseId || user === undefined) return;
    let alive = true;
    (async () => {
      const headers: Record<string, string> = user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
      const r = await fetch(`/api/academy/social?courseId=${encodeURIComponent(courseId)}`, { headers }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (alive && r) setS({ likeCount: r.likeCount, liked: r.liked, rating: r.rating });
    })();
    return () => { alive = false; };
  }, [courseId, user]);
  const like = useCallback(async (): Promise<string | null> => {
    if (!user || !courseId || !s) return "Sign in to like courses.";
    const before = s;
    setS({ ...s, liked: !s.liked, likeCount: Math.max(0, s.likeCount + (s.liked ? -1 : 1)) });
    try { const r = await post(user, { action: "like", courseId }); setS((o) => (o ? { ...o, liked: r.liked, likeCount: r.likeCount } : o)); return null; }
    catch (e) { setS(before); return e instanceof Error ? e.message : "Couldn't save that."; }
  }, [user, courseId, s]);
  return { social: s, like, signedIn: !!user };
}
