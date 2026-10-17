"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { api } from "./moments-client";
import { useMember } from "./member-client";
import type { Course, CourseListing, Enrolment, Lesson } from "./courses";

// Notes Academy in the browser. Published courses and their lessons are read straight from Firestore (the rules allow it);
// a teacher's draft comes from the server (GET /api/academy/courses?slug=); every change goes through /api/academy.

// The published courses (GET /api/public/academy), all or one teacher's, shared in this tab for a minute. undefined while loading.
const listCache = new Map<string, { at: number; p: Promise<CourseListing[]> }>();
export function useAcademy(owner?: string, enabled = true): CourseListing[] | undefined {
  const [v, setV] = useState<CourseListing[] | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    const key = owner?.toLowerCase() ?? "";
    let hit = listCache.get(key);
    if (!hit || Date.now() - hit.at > 60_000) {
      hit = { at: Date.now(), p: fetch(`/api/public/academy${key ? `?owner=${encodeURIComponent(key)}` : ""}`).then((r) => (r.ok ? r.json() : { courses: [] })).then((j) => j.courses ?? []).catch(() => []) };
      listCache.set(key, hit);
    }
    let alive = true;
    hit.p.then((x) => { if (alive) setV(x); });
    return () => { alive = false; };
  }, [owner, enabled]);
  return v;
}

const courseFrom = (id: string, d: Record<string, unknown>) => ({ ...d, id, lessonIds: Array.isArray(d.lessonIds) ? d.lessonIds : [] }) as Course;

// The signed-in member's enrolments (Continue learning on /academy).
export async function myEnrolments(uid: string): Promise<Enrolment[]> {
  const s = await getDocs(query(collection(db, "enrolments"), where("uid", "==", uid))).catch(() => null);
  return s ? s.docs.map((d) => d.data() as Enrolment) : [];
}

type CourseState = {
  status: "loading" | "missing" | "ready";
  course: Course | null;
  lessons: Lesson[];
  preview: boolean; // the teacher looking at their own draft
  enrolment: Enrolment | null | undefined; // undefined while unknown
  user: User | null | undefined;
};

// A course page's data: the course by its address, its lessons, and the visitor's enrolment, with enrol() and mark().
export function useCourse(slug: string) {
  const { user } = useMember();
  const [s, setS] = useState<CourseState>({ status: "loading", course: null, lessons: [], preview: false, enrolment: undefined, user });
  const uid = user?.uid;
  const known = user !== undefined;

  useEffect(() => {
    let alive = true;
    (async () => {
      const found = await getDocs(query(collection(db, "courses"), where("slug", "==", slug), where("status", "==", "published"), limit(1))).catch(() => null);
      const doc = found?.docs[0];
      if (doc) {
        const lessons = await getDocs(query(collection(db, "courses", doc.id, "lessons"), orderBy("order"))).then((x) => x.docs.map((l) => ({ ...l.data(), id: l.id }) as Lesson)).catch(() => []);
        if (alive) setS((o) => ({ ...o, status: "ready", course: courseFrom(doc.id, doc.data()), lessons, preview: false }));
        return;
      }
      if (!known) return; // wait to know who's looking: it may be the teacher's draft
      const own = uid ? await api<{ course: Course; lessons: Lesson[] }>(`/api/academy/courses?slug=${encodeURIComponent(slug)}`).catch(() => null) : null;
      if (!alive) return;
      setS((o) => (own ? { ...o, status: "ready", course: own.course, lessons: own.lessons, preview: own.course.status !== "published" } : { ...o, status: "missing" }));
    })();
    return () => { alive = false; };
  }, [slug, uid, known]);

  const courseId = s.course?.id;
  useEffect(() => {
    setS((o) => ({ ...o, user }));
    if (!courseId || !known) return;
    if (!uid) { setS((o) => ({ ...o, enrolment: null })); return; }
    let alive = true;
    getDocs(query(collection(db, "enrolments"), where("uid", "==", uid), where("courseId", "==", courseId), limit(1)))
      .then((x) => { if (alive) setS((o) => ({ ...o, enrolment: (x.docs[0]?.data() as Enrolment | undefined) ?? null })); })
      .catch(() => { if (alive) setS((o) => ({ ...o, enrolment: null })); });
    return () => { alive = false; };
  }, [courseId, uid, known, user]);

  const enrol = useCallback(async () => {
    if (!courseId) return;
    const r = await api<{ enrolment: Enrolment }>("/api/academy/enrol", { body: { courseId } });
    setS((o) => ({ ...o, enrolment: r.enrolment, course: o.course && o.course.ownerUid !== uid && !o.enrolment ? { ...o.course, enrolCount: o.course.enrolCount + 1 } : o.course }));
  }, [courseId, uid]);
  const mark = useCallback(async (lessonId: string, done: boolean) => {
    if (!courseId) return;
    const r = await api<{ enrolment: Enrolment }>("/api/academy/progress", { body: { courseId, lessonId, done } });
    setS((o) => ({ ...o, enrolment: r.enrolment }));
  }, [courseId]);

  return { ...s, enrol, mark };
}

// Counts one look at a course, at most once a day per browser. Quiet if anything goes wrong.
export async function countCourseView(courseId: string, user?: User | null) {
  try {
    const key = `na-course-view-${courseId}`, today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
    await fetch("/api/academy/view", { method: "POST", headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}) }, body: JSON.stringify({ courseId }), keepalive: true });
  } catch { /* a missed count is fine */ }
}
