import type { Firestore } from "firebase-admin/firestore";
import { getLimitOverrides } from "@/lib/limits-server";
import { limitFor } from "@/lib/limits";
import { effectiveTier } from "@/lib/users";
import { jobOn, opsOf, type NanaOps } from "./jobs";

// Events Nana reacts to, queued where they happen and handled by the scheduled run (app/api/cron/agents): agentEvents/{id}, server-only.
// Kept tiny on purpose: sending a message (lib/messages-server.ts) calls queueMessageEvent, which costs nothing for members without
// Nana's operator (their plan is checked from the profile already loaded) and one read for those with it.
export async function queueMessageEvent(db: Firestore, ev: { toUid: string; to: Record<string, unknown> | undefined; fromUid: string; cid: string; messageId: string }, now = new Date()): Promise<boolean> {
  const to = ev.to;
  if (!to || to.suspended === true) return false;
  const tier = effectiveTier({ username: String(to.username ?? ""), role: to.role, accountTier: to.accountTier } as never);
  if (limitFor("nanaOperator", tier, await getLimitOverrides(db)) <= 0) return false;
  const ops = opsOf((await db.doc(`nanaOps/${ev.toUid}`).get()).data() as Partial<NanaOps> | undefined);
  if (!jobOn(ops, "bookingReplies") && !jobOn(ops, "customerQuestions")) return false;
  await db.doc(`agentEvents/msg_${ev.messageId}`).set({ uid: ev.toUid, kind: "message", fromUid: ev.fromUid, cid: ev.cid, messageId: ev.messageId, status: "new", createdAt: now.toISOString(), expireAt: new Date(now.getTime() + 30 * 86_400_000) });
  return true;
}
