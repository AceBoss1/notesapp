import { createHash, randomBytes } from "crypto";
import { getAdminDb } from "./firebase-admin";
import { sendEmail } from "./email";
import type { ServiceStatus } from "./status";

// Incident history + email subscribers for /status. An incident opens after two consecutive bad
// checks (so one slow request doesn't count) and resolves on the first clean check. State lives in
// `settings/statusState`, incidents in `statusIncidents`, subscribers in `statusSubscribers` — all
// server-only. Checks run whenever /status is loaded or the cron job pings it, so history builds
// from the first check after deploy.
export type Incident = { id: string; startedAt: string; resolvedAt: string | null; services: string[]; worst: "degraded" | "down" };

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng").replace(/\/$/, "");
const MAX_EMAILS = 500;

export const subscriberId = (email: string) => createHash("sha1").update(email.trim().toLowerCase()).digest("hex").slice(0, 24);

async function emailSubscribers(subject: string, text: string) {
  const db = getAdminDb();
  const snap = await db.collection("statusSubscribers").limit(MAX_EMAILS).get();
  for (const d of snap.docs) {
    const { email, token } = d.data() as { email: string; token: string };
    const unsub = `${SITE()}/api/status/subscribe?id=${d.id}&t=${token}`;
    await sendEmail({
      to: email,
      subject,
      text: `${text}\n\nLive status: ${SITE()}/status\nStop these updates: ${unsub}`,
      action: { label: "View status page", url: `${SITE()}/status` },
    }).catch(() => {});
  }
}

export async function recordStatus(services: ServiceStatus[]): Promise<void> {
  try {
    const db = getAdminDb();
    const bad = services.filter((s) => s.state === "down" || s.state === "degraded");
    const stateRef = db.doc("settings/statusState");
    const state = ((await stateRef.get()).data() ?? {}) as { bad?: number; openId?: string | null };
    const strikes = bad.length ? (state.bad ?? 0) + 1 : 0;
    const now = new Date().toISOString();

    if (bad.length && strikes >= 2 && !state.openId) {
      const worst = bad.some((s) => s.state === "down") ? "down" : "degraded";
      const names = bad.map((s) => s.name);
      const ref = await db.collection("statusIncidents").add({ startedAt: now, resolvedAt: null, services: names, worst });
      await stateRef.set({ bad: strikes, openId: ref.id });
      await emailSubscribers(
        `#NotesApp incident: ${names.join(", ")} ${worst === "down" ? "down" : "running slowly"}`,
        `We're seeing a problem with ${names.join(", ")}. We're looking into it and will email you when it's resolved.\n\n#NotesApp`
      );
      return;
    }
    if (!bad.length && state.openId) {
      const ref = db.doc(`statusIncidents/${state.openId}`);
      const inc = (await ref.get()).data() as { startedAt: string; services: string[] } | undefined;
      await ref.set({ resolvedAt: now }, { merge: true });
      await stateRef.set({ bad: 0, openId: null });
      await emailSubscribers(
        `#NotesApp incident resolved: ${(inc?.services ?? []).join(", ")}`,
        `The problem with ${(inc?.services ?? []).join(", ")} is resolved. Thanks for your patience.\n\n#NotesApp`
      );
      return;
    }
    if (strikes !== (state.bad ?? 0)) await stateRef.set({ bad: strikes, openId: state.openId ?? null });
  } catch (err) {
    console.error("[status] couldn't record incident state", err);
  }
}

export async function recentIncidents(limit = 20): Promise<Incident[]> {
  const snap = await getAdminDb().collection("statusIncidents").orderBy("startedAt", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Incident, "id">) }));
}

export async function addSubscriber(email: string): Promise<void> {
  const ref = getAdminDb().doc(`statusSubscribers/${subscriberId(email)}`);
  if ((await ref.get()).exists) return;
  await ref.set({ email: email.trim().toLowerCase(), token: randomBytes(16).toString("hex"), createdAt: new Date().toISOString() });
}

export async function removeSubscriber(id: string, token: string): Promise<boolean> {
  const ref = getAdminDb().doc(`statusSubscribers/${id}`);
  const d = (await ref.get()).data() as { token?: string } | undefined;
  if (!d || !token || d.token !== token) return false;
  await ref.delete();
  return true;
}
