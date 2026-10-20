"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { api } from "./moments-client";
import { useMember } from "./member-client";
import { isPaid, orderedLessons, type Course, type CourseListing, type Enrolment, type Lesson } from "./courses";
import { visitSource } from "./track";

// Notes Academy in the browser. Published courses (and a free course's lessons) are read straight from Firestore (the rules allow
// it); a paid course lists its lessons from its outline and opens each through POST /api/academy/lesson; a tutor's draft comes from
// the server (GET /api/academy/courses?slug=); every change goes through /api/academy.

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
        const course = courseFrom(doc.id, doc.data());
        // A paid course's lessons stay private: its outline says what each one is.
        const lessons = isPaid(course)
          ? (course.outline ?? []).map((o, i) => ({ ...o, order: i }) as Lesson)
          : orderedLessons(await getDocs(query(collection(db, "courses", doc.id, "lessons"), orderBy("order"))).then((x) => x.docs.map((l) => ({ ...l.data(), id: l.id }) as Lesson)).catch(() => []), course.modules);
        if (alive) setS((o) => ({ ...o, status: "ready", course, lessons, preview: false }));
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

  // Bought from the payment page, or back from it: look again.
  const refresh = useCallback(async () => {
    if (!courseId || !uid) return;
    const x = await getDocs(query(collection(db, "enrolments"), where("uid", "==", uid), where("courseId", "==", courseId), limit(1))).catch(() => null);
    setS((o) => ({ ...o, enrolment: (x?.docs[0]?.data() as Enrolment | undefined) ?? null }));
  }, [courseId, uid]);

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

  return { ...s, enrol, mark, refresh };
}

// The live class and community links (only for people who enrolled or bought, and the tutors). null: none to show.
export function useCourseLinks(courseId: string | undefined, enabled: boolean) {
  const { user } = useMember();
  const [links, setLinks] = useState<{ classUrl: string; communityUrl: string } | null>(null);
  useEffect(() => {
    if (!courseId || !enabled || !user) { setLinks(null); return; }
    let alive = true;
    api<{ links: { classUrl: string; communityUrl: string } | null }>(`/api/academy/links?courseId=${encodeURIComponent(courseId)}`).then((r) => { if (alive) setLinks(r.links); }).catch(() => {});
    return () => { alive = false; };
  }, [courseId, enabled, user]);
  return links;
}

// The learner's purchase of a paid course (to offer a refund while it's allowed).
export function useCoursePurchase(courseId: string | undefined, enabled: boolean) {
  const [p, setP] = useState<{ reference: string; refundable: boolean; refundUntil: string } | null>(null);
  const load = useCallback(() => {
    if (!courseId || !enabled) { setP(null); return; }
    api<{ purchase: typeof p }>(`/api/academy/purchase?courseId=${encodeURIComponent(courseId)}`).then((r) => setP(r.purchase)).catch(() => setP(null));
  }, [courseId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const refund = useCallback(async () => {
    await api("/api/academy/purchase", { body: { action: "refund", courseId } });
  }, [courseId]);
  return { purchase: p, refund, reload: load };
}

// One lesson's content through the server (paid courses, uploads). Throws with .code "device_limit" (and .devices) on a third device.
export type LessonContent = { id: string; title: string; kind: Lesson["kind"]; preview: boolean; body?: string; youtubeId?: string; playerUrl?: string; pdf?: boolean; watermark?: { username: string; email: string } };
export async function fetchLesson(user: User | null | undefined, courseId: string, lessonId: string, deviceId: string, deviceLabel: string): Promise<{ lesson: LessonContent; purchaseRef: string | null }> {
  const r = await fetch("/api/academy/lesson", {
    method: "POST", headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}) },
    body: JSON.stringify({ courseId, lessonId, deviceId, deviceLabel }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "Couldn't open this lesson."), { code: j.code, devices: j.devices, status: r.status });
  return j;
}

// Counts one look at a course, at most once a day per browser. Quiet if anything goes wrong.
export async function countCourseView(courseId: string, user?: User | null) {
  try {
    const key = `na-course-view-${courseId}`, today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
    await fetch("/api/academy/view", { method: "POST", headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}) }, body: JSON.stringify({ courseId, ...visitSource() }), keepalive: true });
  } catch { /* a missed count is fine */ }
}
