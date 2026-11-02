import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { act, InboxError, listProposals } from "@/lib/agents/proposals-server";
import { getOps, journalFromNotes, relearnVoice, saveOps } from "@/lib/agents/jobs-server";
import { cleanOpsPatch, JOBS } from "@/lib/agents/jobs";
import { editVoice } from "@/lib/agents/voice";
import { getAgentSettings, planLimit } from "@/lib/agents/config-server";
import { memberTier, nanaStatus } from "@/lib/nana-meter";
import { LIMIT_TIER_LABEL } from "@/lib/limits";
import { ExecError } from "@/lib/agents/execute-server";

export const dynamic = "force-dynamic";

// Nana's inbox (components/agents/NanaInbox.tsx). Everyone who has connected an assistant sees its requests here; Nana's own jobs are for
// plans with the operator (Business and Enterprise by default, Admin → Limits), and other plans see a friendly upsell, not an error.
//   GET (?count=1 for just the number waiting) → the three lists, Nana's jobs and voice, the plan, this period's AI use
//   POST { action: approve | edit | decline | dismiss | undo, id, draft? } · POST { action: "journal", notes }
//   PATCH { enabled?, paused?, autoConfirm?, jobs?: { <job>: boolean } } · PATCH { voice: "…" } · PATCH { relearn: true }
async function who(req: NextRequest): Promise<string> {
  const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const d = t ? await getAuth(getAdminApp()).verifyIdToken(t).catch(() => null) : null;
  if (!d) throw new InboxError("Sign in to see Nana's inbox.", 401);
  return d.uid;
}
const fail = (e: unknown) => {
  if (e instanceof InboxError || e instanceof ExecError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof Error && !/firestore|internal/i.test(e.message) && e.message.length < 160) return NextResponse.json({ error: e.message }, { status: 400 });
  console.error("[nana inbox] failed", e);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
};
const UPSELL = "Nana's jobs (booking replies, customer answers, journal drafts, shipping nudges and the weekly summary) come with Business and Enterprise.";

export async function GET(req: NextRequest) {
  try {
    const uid = await who(req);
    const db = getAdminDb();
    const now = new Date();
    if (req.nextUrl.searchParams.get("count")) {
      const snap = await db.collection("agentProposals").where("uid", "==", uid).where("status", "==", "pending").get();
      return NextResponse.json({ needs: snap.docs.filter((d) => String(d.data().expiresAt) > now.toISOString()).length }, { headers: { "Cache-Control": "no-store" } });
    }
    const tier = await memberTier(db, uid);
    const [lists, ops, s, operator, nana, user] = await Promise.all([
      listProposals(db, uid, now), getOps(db, uid), getAgentSettings(db), planLimit(db, uid, "nanaOperator", tier),
      nanaStatus(db, uid, now, tier).catch(() => null), db.doc(`users/${uid}`).get(),
    ]);
    const weekAi = nana && nana.allowanceKobo > 0 ? Math.min(100, Math.round((nana.usedKobo / nana.allowanceKobo) * 100)) : null;
    return NextResponse.json({
      ...lists, now: now.toISOString(),
      plan: { tier, label: LIMIT_TIER_LABEL[tier], operator: operator > 0, upsell: operator > 0 ? "" : UPSELL },
      ops: { enabled: ops.enabled, paused: ops.paused, autoConfirm: ops.autoConfirm, jobs: ops.jobs, voice: ops.voice ?? null },
      jobs: JOBS.map((j) => ({ id: j.id, label: j.label, detail: j.detail(s, ops.autoConfirm) })),
      settings: { draftHours: s.draftHours, undoReplyMinutes: s.undoReplyMinutes, undoAutoHours: s.undoAutoHours, logDays: s.logDays },
      ai: weekAi === null ? null : { usedPct: weekAi, resetEvery: nana!.resetEvery },
      me: { name: String(user.data()?.displayName ?? ""), firstName: String(user.data()?.displayName ?? "").split(/\s+/)[0] ?? "" },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await who(req);
    const limited = await rateLimit(req, "nana-inbox", uid, 120, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    if (b.action === "journal") return NextResponse.json({ proposal: await journalFromNotes(db, uid, String(b.notes ?? "")) });
    if (!["approve", "edit", "decline", "dismiss", "undo"].includes(b.action)) throw new InboxError("Choose what to do.");
    return NextResponse.json({ proposal: await act(db, uid, String(b.id ?? ""), b.action, { draft: b.draft }) });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: NextRequest) {
  try {
    const uid = await who(req);
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    if ((await planLimit(db, uid, "nanaOperator")) <= 0) throw new InboxError(UPSELL, 403);
    if (b.relearn === true) { await relearnVoice(db, uid); return GET(req); }
    if (typeof b.voice === "string") { await saveOps(db, uid, { voice: editVoice((await getOps(db, uid)).voice, b.voice) }); return GET(req); }
    const patch = cleanOpsPatch(b);
    const first = patch.enabled === true && !(await getOps(db, uid)).voice;
    await saveOps(db, uid, patch);
    if (first) await relearnVoice(db, uid).catch(() => null); // learn the voice the first time Nana is switched on
    return GET(req);
  } catch (e) { return fail(e); }
}
