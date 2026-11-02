import type { Firestore } from "firebase-admin/firestore";

// The agent action log (agentActions, server-only, kept 12 months by default: set a Firestore TTL policy on `expireAt`). One entry per
// tool call through the MCP server and per thing Nana does: which tool, whether it worked, what was asked (the arguments, with anything
// written — journal text, message text — replaced by its length), the API key's id or the agent grant's id (never a secret), the client's
// name, and, for a connected agent or Nana, the member it acted for, a plain summary and the result (read, done, waiting, blocked,
// approved, declined, undone, expired). Nothing from the answer is stored. Console → Connected agents reads it (lib/agents/activity.ts).
export const LOG_DAYS = 365;
export type LogResult = "read" | "done" | "waiting" | "blocked" | "approved" | "declined" | "undone" | "expired" | "failed";
export type ActionEntry = {
  via: "mcp" | "nana"; tool: string; ok: boolean; error?: string; args: string; keyId?: string; client: string; at: string; expireAt: Date;
  uid?: string; grantId?: string; agent?: string; summary?: string; result?: LogResult; proposalId?: string; rule?: boolean;
};
// Fields that carry what someone wrote: logged as their length only ("what was asked, not content").
export const CONTENT_FIELDS = new Set(["content", "body", "text", "message", "draft", "description", "notes", "reply", "subtitle"]);
export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args ?? {})) out[k] = CONTENT_FIELDS.has(k) && typeof v === "string" ? `[${v.length} characters]` : v;
  return out;
}

export function actionEntry(
  tool: string, args: Record<string, unknown>, ok: boolean,
  opts: { error?: string; keyId?: string; client?: string; via?: "mcp" | "nana"; uid?: string; grantId?: string; agent?: string; summary?: string; result?: LogResult; proposalId?: string; rule?: boolean; logDays?: number },
  now = new Date(),
): ActionEntry {
  let a = "";
  try { a = JSON.stringify(redactArgs(args)); } catch { a = "{}"; }
  return {
    via: opts.via ?? "mcp", tool, ok, ...(opts.error ? { error: opts.error.slice(0, 200) } : {}), args: a.length > 500 ? `${a.slice(0, 497)}...` : a,
    ...(opts.keyId ? { keyId: opts.keyId } : {}), client: (opts.client || "unknown").slice(0, 120), at: now.toISOString(), expireAt: new Date(now.getTime() + (opts.logDays ?? LOG_DAYS) * 86_400_000),
    ...(opts.uid ? { uid: opts.uid } : {}), ...(opts.grantId ? { grantId: opts.grantId } : {}), ...(opts.agent ? { agent: opts.agent.slice(0, 60) } : {}),
    ...(opts.summary ? { summary: opts.summary.slice(0, 200) } : {}), ...(opts.result ? { result: opts.result } : {}), ...(opts.proposalId ? { proposalId: opts.proposalId } : {}),
    ...(opts.rule ? { rule: true } : {}),
  };
}

export async function logAction(db: Firestore, entry: ActionEntry): Promise<void> {
  await db.collection("agentActions").add(entry).catch(() => {});
}
