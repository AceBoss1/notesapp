import type { Firestore } from "firebase-admin/firestore";

// The agent action log (agentActions, server-only, kept 12 months: set a Firestore TTL policy on `expireAt`). One entry per tool call
// through the MCP server: which tool, whether it worked, the arguments (shortened), the API key's id when one was used (never the secret)
// and the client's name. Nothing from the answer is stored. Phase 2's write tools will log here too, with the member's approval.
export const LOG_DAYS = 365;
export type ActionEntry = { via: "mcp"; tool: string; ok: boolean; error?: string; args: string; keyId?: string; client: string; at: string; expireAt: Date };

export function actionEntry(tool: string, args: Record<string, unknown>, ok: boolean, opts: { error?: string; keyId?: string; client?: string }, now = new Date()): ActionEntry {
  let a = "";
  try { a = JSON.stringify(args); } catch { a = "{}"; }
  return {
    via: "mcp", tool, ok, ...(opts.error ? { error: opts.error.slice(0, 200) } : {}), args: a.length > 500 ? `${a.slice(0, 497)}...` : a,
    ...(opts.keyId ? { keyId: opts.keyId } : {}), client: (opts.client || "unknown").slice(0, 120), at: now.toISOString(), expireAt: new Date(now.getTime() + LOG_DAYS * 86_400_000),
  };
}

export async function logAction(db: Firestore, entry: ActionEntry): Promise<void> {
  await db.collection("agentActions").add(entry).catch(() => {});
}
