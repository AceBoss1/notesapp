// NotesApp Ventures on the server (lib/ventures.ts): sending a pitch, a member's own pitches, withdrawing one, and the team's review
// (Admin → Ventures). Collections, server-written only (firestore.rules refuse browsers): ventureApplications/{id}; settings/ventures
// (the round) is under settings.
import type { Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { isKidUid } from "./kids";
import { notifyBell } from "./email";
import {
  AGREE_TEXT, CALL_NAME, DEFAULT_CALL, LIMITS, OPEN_STATUSES, PICKS_MAX, PICKS_MIN, STATUS_NOTE, VENTURES_PATH,
  isKind, isPicks, isRegion, isSector, isStage, isStatus, quarterOf,
  type Application, type CallSettings, type MyApplication, type Status,
} from "./ventures";

export class VenturesError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const COL = "ventureApplications";

const text = (v: unknown, max: number, label: string, min = 0): string => {
  const s = String(v ?? "").replace(/\r\n/g, "\n").trim();
  if (s.length < min) throw new VenturesError(400, min > 1 ? `${label}: write at least ${min} characters.` : `${label} is needed.`);
  if (s.length > max) throw new VenturesError(413, `${label} can be up to ${max} characters.`);
  return s;
};

// Rolling applications: the call is open unless the team pauses it (Admin → Ventures); picks a quarter from Admin → Limits.
export async function callSettings(db: Firestore): Promise<CallSettings> {
  const d = (await db.doc("settings/ventures").get()).data();
  return {
    open: typeof d?.open === "boolean" ? d.open : DEFAULT_CALL.open,
    picksPerQuarter: isPicks(d?.picksPerQuarter) ? d.picksPerQuarter : DEFAULT_CALL.picksPerQuarter,
  };
}

export type ApplyInput = Record<string, unknown>;

export async function sendPitch(db: Firestore, me: { uid: string; emailVerified: boolean }, b: ApplyInput, now = new Date()): Promise<MyApplication> {
  if (!me.emailVerified) throw new VenturesError(403, "Verify your email first: open the link we sent to your inbox.");
  if (isKidUid(me.uid)) throw new VenturesError(403, `${CALL_NAME} is for members aged 18 and over.`);
  const u = (await db.doc(`users/${me.uid}`).get()).data();
  if (!u || u.suspended === true) throw new VenturesError(403, "Your account can't do that right now.");
  if (u.teen === true) throw new VenturesError(403, `${CALL_NAME} is for members aged 18 and over.`);
  if (!u.username) throw new VenturesError(400, "Finish setting up your profile first.");
  if (!(await callSettings(db)).open) throw new VenturesError(409, `${CALL_NAME} is paused for now. Follow #NotesApp to hear when pitches open again.`);
  const quarter = quarterOf(now);
  if (b.agree !== true) throw new VenturesError(400, `Tick the box: "${AGREE_TEXT}"`);
  if (b.emergingMarkets !== true) throw new VenturesError(400, "Only ideas and ventures for emerging markets are welcome. Confirm yours is.");
  if (!isKind(b.kind)) throw new VenturesError(400, "Say whether it's a feature, a product or a business.");
  if (!isSector(b.sector)) throw new VenturesError(400, "Choose the area it's in.");
  if (!isStage(b.stage)) throw new VenturesError(400, "Choose how far along it is.");
  if (!isRegion(b.region)) throw new VenturesError(400, "Choose the emerging market it's for.");
  const teamSize = Math.floor(Number(b.teamSize));
  if (!Number.isFinite(teamSize) || teamSize < 1 || teamSize > LIMITS.teamSize) throw new VenturesError(400, `Team size is 1 to ${LIMITS.teamSize}.`);
  const links = (Array.isArray(b.links) ? b.links : String(b.links ?? "").split(/\s+/)).map((l) => String(l).trim()).filter(Boolean);
  if (links.length > LIMITS.links) throw new VenturesError(400, `Up to ${LIMITS.links} links.`);
  if (links.some((l) => !/^https:\/\/[^\s]+\.[^\s]+$/.test(l) || l.length > 300)) throw new VenturesError(400, "Links must start with https://");

  const app: Omit<Application, "id"> = {
    uid: me.uid, username: String(u.username), name: String(u.displayName ?? u.username),
    quarter, kind: b.kind, sector: b.sector, stage: b.stage, region: b.region,
    countries: text(b.countries, LIMITS.countries, "The countries it's for", 2),
    title: text(b.title, LIMITS.title, "The name of your idea", 2),
    oneLiner: text(b.oneLiner, LIMITS.oneLiner, "Your one-line pitch", 10),
    problem: text(b.problem, LIMITS.problem, "The problem", 40),
    solution: text(b.solution, LIMITS.solution, "Your idea", 40),
    whyYou: text(b.whyYou, LIMITS.whyYou, "Why you", 20),
    traction: text(b.traction, LIMITS.traction, "Traction"),
    teamSize, links, status: "received", createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
  const mine = await db.collection(COL).where("uid", "==", me.uid).get();
  const inQuarter = mine.docs.filter((d) => d.data().quarter === quarter && d.data().status !== "withdrawn");
  if (inQuarter.length >= LIMITS.perQuarter) throw new VenturesError(429, `You can send up to ${LIMITS.perQuarter} pitches a quarter. Withdraw one to send another, or pitch again next quarter.`);
  if (inQuarter.some((d) => String(d.data().title).toLowerCase() === app.title.toLowerCase())) throw new VenturesError(409, "You've already pitched an idea with that name this quarter.");
  const id = randomBytes(8).toString("hex");
  await db.doc(`${COL}/${id}`).set(app);
  await notifyBell({ uid: me.uid, type: "ventures", linkHref: VENTURES_PATH + "#mine", message: `${CALL_NAME}: we've received "${app.title}". It's kept confidential, and a person reads every pitch.` }).catch(() => {});
  return toMine(id, { ...app, id });
}

const toMine = (id: string, a: Application): MyApplication => ({ id, quarter: a.quarter, title: a.title, oneLiner: a.oneLiner, status: a.status, createdAt: a.createdAt, kind: a.kind, region: a.region, ...(a.advice ? { advice: a.advice } : {}) });

export async function myPitches(db: Firestore, uid: string): Promise<MyApplication[]> {
  const s = await db.collection(COL).where("uid", "==", uid).get();
  return s.docs.map((d) => toMine(d.id, d.data() as Application)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function withdrawPitch(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<void> {
  if (typeof id !== "string" || !/^[0-9a-f]{16}$/.test(id)) throw new VenturesError(404, "Pitch not found.");
  const ref = db.doc(`${COL}/${id}`);
  const a = (await ref.get()).data() as Application | undefined;
  if (!a || a.uid !== uid) throw new VenturesError(404, "Pitch not found.");
  if (!OPEN_STATUSES.includes(a.status)) throw new VenturesError(409, "That pitch can't be withdrawn now.");
  await ref.update({ status: "withdrawn", updatedAt: now.toISOString() });
}

// ── The team (Admin → Ventures) ──────────────────────────────────────────────────────────────────────────────────────────────────
export type AdminVentures = { applications: Application[]; call: CallSettings; quarter: string; pickedThisQuarter: number };
export async function adminPitches(db: Firestore, now = new Date()): Promise<AdminVentures> {
  const s = await db.collection(COL).get();
  const order: Record<Status, number> = { received: 0, reviewing: 1, shortlisted: 2, picked: 3, "not-picked": 4, withdrawn: 5 };
  const applications = s.docs.map((d) => ({ ...(d.data() as Omit<Application, "id">), id: d.id }))
    .sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt));
  const quarter = quarterOf(now);
  const pickedThisQuarter = applications.filter((a) => a.status === "picked" && a.pickedQuarter === quarter).length;
  return { applications, call: await callSettings(db), quarter, pickedThisQuarter };
}

export async function decidePitch(db: Firestore, id: unknown, input: { status?: unknown; notes?: unknown; advice?: unknown; perksSent?: unknown }, now = new Date()): Promise<void> {
  if (typeof id !== "string" || !/^[0-9a-f]{16}$/.test(id)) throw new VenturesError(404, "Pitch not found.");
  const ref = db.doc(`${COL}/${id}`);
  const a = (await ref.get()).data() as Application | undefined;
  if (!a) throw new VenturesError(404, "Pitch not found.");
  const patch: Record<string, unknown> = { updatedAt: now.toISOString() };
  const { picksPerQuarter } = await callSettings(db);
  if (input.status !== undefined) {
    if (!isStatus(input.status) || input.status === "withdrawn") throw new VenturesError(400, "Choose a status.");
    if (a.status === "withdrawn") throw new VenturesError(409, "The member withdrew this pitch.");
    patch.status = input.status;
    // Up to picksPerQuarter picks a quarter (owner, 6 Nov 2026: what the team can build at its current strength; Admin → Limits).
    if (input.status === "picked" && a.status !== "picked") {
      const quarter = quarterOf(now);
      const picked = await db.collection(COL).where("pickedQuarter", "==", quarter).get();
      if (picked.docs.filter((d) => d.data().status === "picked").length >= picksPerQuarter) {
        throw new VenturesError(409, `${picksPerQuarter} pitch${picksPerQuarter === 1 ? " is" : "es are"} already picked in ${quarter}, the most a quarter (Admin → Limits). Un-pick one first, or pick this next quarter.`);
      }
      patch.pickedQuarter = quarter;
    }
  }
  if (input.notes !== undefined) patch.notes = String(input.notes ?? "").slice(0, 2000);
  if (input.advice !== undefined) patch.advice = String(input.advice ?? "").trim().slice(0, LIMITS.advice);
  if (input.perksSent === true) patch.perksSentAt = now.toISOString();
  await ref.update(patch);
  const st = patch.status as Status | undefined;
  const tell = st && st !== a.status ? STATUS_NOTE[st] : undefined;
  if (tell) await notifyBell({ uid: a.uid, type: "ventures", linkHref: VENTURES_PATH + "#mine", message: tell(a.title, picksPerQuarter) }).catch(() => {});
}

// Picks a quarter (super admin, Admin → Limits → NotesApp Ventures). Applies sitewide at once; picks already made stay picked.
export async function setPicksPerQuarter(db: Firestore, n: unknown, by: string): Promise<CallSettings> {
  if (!isPicks(n)) throw new VenturesError(400, `Picks a quarter is a whole number from ${PICKS_MIN} to ${PICKS_MAX}.`);
  await db.doc("settings/ventures").set({ picksPerQuarter: n, updatedBy: by, updatedAt: new Date().toISOString() }, { merge: true });
  return callSettings(db);
}

// Pause or reopen the call (super admin).
export async function setCall(db: Firestore, input: { open?: unknown }, by: string): Promise<CallSettings> {
  if (typeof input.open !== "boolean") throw new VenturesError(400, "Open or pause the call.");
  await db.doc("settings/ventures").set({ open: input.open, updatedBy: by, updatedAt: new Date().toISOString() }, { merge: true });
  return callSettings(db);
}
