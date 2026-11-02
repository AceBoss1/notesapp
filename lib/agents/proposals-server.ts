import type { Firestore } from "firebase-admin/firestore";
import { getAgentSettings } from "./config-server";
import { ExecError, execute, undo as undoExec, type ExecDeps } from "./execute-server";
import { sha256 } from "./pairing";
import { KIND_INFO, allowed, expiryFor, undoWindowMs, viewOf, type Action, type Fact, type Proposal, type ProposalKind, type TrailStep } from "./proposals";
import { actionEntry, logAction, type LogResult } from "@/lib/mcp/log";
import { notifyBell } from "@/lib/email";
import { sendPush } from "@/lib/push-server";
import { getAdminDb } from "@/lib/firebase-admin";

// Nana's inbox on the server (agentProposals, server-only). A proposal is created once per thing (its id is a hash of the member and an
// idempotency key, so a job that runs twice, or an agent that retries, never makes two); the member approves (it runs), edits the draft,
// declines or dismisses it; something done can be undone within its window; anything left waiting expires (48 hours by default).
// Every decision is written to the activity log too, against the entry that asked.

export type NewProposal = {
  uid: string; kind: ProposalKind; source: string; sourceName: string; title: string; summary: string; idemKey: string;
  facts?: Fact[]; quote?: { from: string; text: string }; draft?: string; payload?: Record<string, unknown>; trail?: string[];
};
export type Alert = (uid: string, n: { title: string; body: string; href: string }) => Promise<void>;
// Bell and phone (when push is set up): something needs the member.
export const defaultAlert: Alert = async (uid, n) => {
  await notifyBell({ uid, type: "message", linkHref: n.href, message: `${n.title}: ${n.body}`.slice(0, 280) });
  await sendPush(getAdminDb(), uid, { title: n.title, body: n.body, url: n.href }).catch(() => 0);
};

const PURGE_DAYS = 365;
const idOf = (uid: string, key: string) => sha256(`${uid}|${key}`).slice(0, 24);
const step = (text: string, at: Date): TrailStep => ({ at: at.toISOString(), text: text.slice(0, 200) });

// Waiting for the member. Returns the proposal and whether it is new (an idempotent repeat returns the first one).
export async function createProposal(db: Firestore, input: NewProposal, now = new Date(), alert: Alert | null = defaultAlert): Promise<{ proposal: Proposal; fresh: boolean }> {
  const s = await getAgentSettings(db);
  const id = idOf(input.uid, input.idemKey);
  const ref = db.doc(`agentProposals/${id}`);
  const p: Proposal = {
    id, uid: input.uid, kind: input.kind, source: input.source, sourceName: input.sourceName, title: input.title.slice(0, 160), summary: input.summary.slice(0, 400),
    ...(input.facts ? { facts: input.facts.slice(0, 6) } : {}), ...(input.quote ? { quote: { from: input.quote.from.slice(0, 60), text: input.quote.text.slice(0, 1500) } } : {}),
    ...(input.draft !== undefined ? { draft: input.draft.slice(0, 4000) } : {}), payload: input.payload ?? {},
    status: "pending", createdAt: now.toISOString(), expiresAt: expiryFor(now, s).toISOString(),
    trail: (input.trail ?? []).map((t) => step(t, now)), idemKey: input.idemKey.slice(0, 200), purgeAt: new Date(now.getTime() + PURGE_DAYS * 86_400_000),
  };
  try { await ref.create(p); }
  catch { return { proposal: (await ref.get()).data() as Proposal, fresh: false }; }
  if (alert) await alert(input.uid, { title: input.sourceName === "Nana" ? "Nana needs you" : `${input.sourceName} is asking`, body: input.title, href: `/nana/inbox?p=${id}` }).catch(() => {});
  return { proposal: p, fresh: true };
}

// Done already, by the member's rule (a confirmation that goes without asking, a draft saved, a summary sent): kept in "Done by Nana"
// with its undo window.
export async function recordDone(db: Firestore, input: NewProposal & { result?: Record<string, unknown> }, now = new Date()): Promise<{ proposal: Proposal; fresh: boolean }> {
  const s = await getAgentSettings(db);
  const id = idOf(input.uid, input.idemKey);
  const ref = db.doc(`agentProposals/${id}`);
  const win = undoWindowMs(input.kind, true, s);
  const p: Proposal = {
    id, uid: input.uid, kind: input.kind, source: input.source, sourceName: input.sourceName, title: input.title.slice(0, 160), summary: input.summary.slice(0, 400),
    ...(input.facts ? { facts: input.facts } : {}), ...(input.draft !== undefined ? { draft: input.draft.slice(0, 4000) } : {}), payload: input.payload ?? {},
    status: "done", auto: true, createdAt: now.toISOString(), expiresAt: now.toISOString(), decidedAt: now.toISOString(), executedAt: now.toISOString(),
    ...(win ? { undoUntil: new Date(now.getTime() + win).toISOString() } : {}), result: input.result ?? {},
    trail: (input.trail ?? []).map((t) => step(t, now)), idemKey: input.idemKey.slice(0, 200), purgeAt: new Date(now.getTime() + PURGE_DAYS * 86_400_000),
  };
  try { await ref.create(p); return { proposal: p, fresh: true }; }
  catch { return { proposal: (await ref.get()).data() as Proposal, fresh: false }; }
}

// Has this key been used already (so a job doesn't redo the work, e.g. drafting with the AI, before finding out)?
export async function seen(db: Firestore, uid: string, idemKey: string): Promise<boolean> {
  return (await db.doc(`agentProposals/${idOf(uid, idemKey)}`).get()).exists;
}

export type InboxLists = { needs: Proposal[]; done: Proposal[]; declined: Proposal[] };
const strip = ({ purgeAt: _p, idemKey: _i, ...p }: Proposal) => p as Proposal;
export async function listProposals(db: Firestore, uid: string, now = new Date(), max = 150): Promise<InboxLists> {
  const snap = await db.collection("agentProposals").where("uid", "==", uid).orderBy("createdAt", "desc").limit(max).get();
  const out: InboxLists = { needs: [], done: [], declined: [] };
  for (const d of snap.docs) {
    let p = d.data() as Proposal;
    if (p.status === "pending" && p.expiresAt <= now.toISOString()) {
      await d.ref.update({ status: "expired", decidedAt: now.toISOString() }).catch(() => {});
      await markLog(db, p.id, "expired");
      p = { ...p, status: "expired" };
    }
    out[viewOf(p)].push(strip(p));
  }
  return out;
}

// The log entries that asked for this proposal get the member's answer.
async function markLog(db: Firestore, proposalId: string, result: LogResult) {
  const snap = await db.collection("agentActions").where("proposalId", "==", proposalId).limit(5).get().catch(() => null);
  for (const d of snap?.docs ?? []) await d.ref.update({ result }).catch(() => {});
}

export class InboxError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

// The member acts on one proposal. approve runs it (with their edited text if they changed it); edit only saves the text; decline and
// dismiss close it; undo takes back something done, inside its window.
export async function act(db: Firestore, uid: string, id: string, action: Action, input: { draft?: unknown } = {}, now = new Date(), deps: ExecDeps = {}): Promise<Proposal> {
  const ref = db.doc(`agentProposals/${String(id).replace(/[^a-f0-9]/g, "").slice(0, 24)}`);
  const s = await getAgentSettings(db);
  // Claim the proposal in a transaction so a double tap (or two devices) can't run it twice.
  const claimed = await db.runTransaction(async (t) => {
    const p = (await t.get(ref)).data() as Proposal | undefined;
    if (!p || p.uid !== uid) throw new InboxError("That item wasn't found.", 404);
    if (!allowed(p, action, now)) {
      if (action === "undo") throw new InboxError("It's too late to undo this one.", 409);
      if (p.status === "pending" && p.expiresAt <= now.toISOString()) throw new InboxError("This one has expired.", 410);
      if (p.kind === "money") throw new InboxError("Money never moves through Nana. Open the order to decide.", 403);
      throw new InboxError("This was already dealt with.", 409);
    }
    const draft = input.draft !== undefined ? String(input.draft).replace(/\u0000/g, "").slice(0, 4000) : p.draft ?? "";
    if (action === "edit") { t.update(ref, { draft, trail: [...p.trail, step("You edited the draft.", now)] }); return { p: { ...p, draft }, run: false }; }
    if (action === "decline" || action === "dismiss") {
      t.update(ref, { status: action === "decline" ? "declined" : "dismissed", decidedAt: now.toISOString(), trail: [...p.trail, step(action === "decline" ? "You declined it." : "You dismissed it.", now)] });
      return { p: { ...p, status: action === "decline" ? ("declined" as const) : ("dismissed" as const) }, run: false };
    }
    if (action === "undo") { t.update(ref, { undoUntil: now.toISOString() }); return { p, run: true }; } // closes the window: one undo
    t.update(ref, { status: "done", decidedAt: now.toISOString(), draft }); // approve: claimed as done; reverted to failed if it can't run
    return { p: { ...p, draft }, run: true };
  });
  const p = claimed.p;
  if (!claimed.run) {
    if (action !== "edit") await markLog(db, p.id, "declined");
    return strip(p);
  }
  if (action === "undo") {
    try {
      const r = await undoExec(db, uid, p);
      await ref.update({ status: "undone", result: { ...(p.result ?? {}), undo: r }, trail: [...p.trail, step("You undid it.", now)] });
      await markLog(db, p.id, "undone");
      return strip({ ...p, status: "undone" });
    } catch (e) {
      await ref.update({ undoUntil: p.undoUntil ?? null });
      throw e instanceof ExecError ? new InboxError(e.message, e.status) : e;
    }
  }
  try {
    const result = await execute(db, uid, p, p.draft ?? "", now, deps);
    const win = undoWindowMs(p.kind, false, s);
    const done: Proposal = { ...p, status: "done", executedAt: now.toISOString(), result, ...(win ? { undoUntil: new Date(now.getTime() + win).toISOString() } : {}), trail: [...p.trail, step(KIND_INFO[p.kind].sends ? "You approved it and it was sent." : "You approved it.", now)] };
    await ref.update({ executedAt: done.executedAt, result, ...(done.undoUntil ? { undoUntil: done.undoUntil } : {}), trail: done.trail });
    await markLog(db, p.id, "approved");
    await logAction(db, actionEntry(`approve_${p.kind}`, { proposal: p.id }, true, { via: "nana", uid, agent: p.sourceName, summary: `You approved: ${p.title}`, result: "approved", proposalId: p.id, logDays: s.logDays }, now));
    return strip(done);
  } catch (e) {
    const message = e instanceof ExecError || e instanceof Error ? e.message : "That didn't work.";
    await ref.update({ status: "pending", decidedAt: null, error: message.slice(0, 200), trail: [...p.trail, step(`It didn't go through: ${message}`, now)] });
    throw new InboxError(message, e instanceof ExecError ? e.status : 500);
  }
}

// The scheduled sweep: anything still waiting past its expiry closes as expired.
export async function expireDue(db: Firestore, now = new Date(), max = 200): Promise<number> {
  const snap = await db.collection("agentProposals").where("status", "==", "pending").where("expiresAt", "<=", now.toISOString()).limit(max).get();
  for (const d of snap.docs) {
    await d.ref.update({ status: "expired", decidedAt: now.toISOString() });
    await markLog(db, d.id, "expired");
  }
  return snap.size;
}
