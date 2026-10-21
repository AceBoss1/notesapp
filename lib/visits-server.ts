import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { APP_SHORT_DOMAINS, KNOWN_ROOTS } from "./host";
import { dayKey, sourceOf, type Source } from "./analytics";

// Member analytics (lib/analytics.ts): the daily visit rollup each counted view adds to. Kept apart from lib/analytics-server.ts so the
// view counters (journals, profiles, store items, courses) don't load the report's reads.
//
// ownerViews/{uid}_{yyyymmdd}: one document per member per day: { uid, day, count, pages: { "note:<id>": n, … }, src: { search: n, … } }.
// Every counted view of something the member owns (their profile or site home, a journal, a store item, a course) adds to it, next to the
// existing pageViews buckets, so a 90-day report is 90 small reads. Server-only (firestore.rules).

export const ownerVisitRef = (db: Firestore, uid: string, day: string) => db.doc(`ownerViews/${uid}_${day.replace(/-/g, "")}`);
export const ownerVisitData = (uid: string, day: string, kind: string, id: string, source: Source) => ({
  uid, day, count: FieldValue.increment(1), pages: { [`${kind}:${id}`]: FieldValue.increment(1) }, src: { [source]: FieldValue.increment(1) },
});
// Where a view came from, as the browser reported it (lib/track.ts visitSource). Our own addresses and the host the view was sent to (a member's
// own domain) count as moving around inside.
export function sourceFrom(body: { ref?: unknown; utm?: unknown }, requestHost: string | null): Source {
  const own = [...KNOWN_ROOTS, ...APP_SHORT_DOMAINS, ...(requestHost ? [requestHost.split(":")[0].toLowerCase().replace(/^www\./, "")] : [])];
  return sourceOf(body.ref, body.utm, own);
}
export async function countOwnerVisit(db: Firestore, uid: string, kind: string, id: string, source: Source, now = new Date()) {
  if (!uid) return;
  const day = dayKey(now);
  await ownerVisitRef(db, uid, day).set(ownerVisitData(uid, day, kind, id, source), { merge: true });
}
