import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { AgentAuthError, approveRequest, canConnect, denyRequest, startOAuth, viewRequest } from "@/lib/agents/grants-server";
import { getAgentSettings } from "@/lib/agents/config-server";
import { defaultGrant } from "@/lib/agents/scopes";
import { accessDayChoices, actionChoices, discountChoices } from "@/lib/agents/config";
import { agentUrls, requestHost } from "@/lib/agents/urls";

export const dynamic = "force-dynamic";

// The Connect NotesApp screen's server (app/(main)/connect). The screen opens with an OAuth request's parameters or a pairing code:
//   POST { action: "start", params } → opens an OAuth request (no sign-in needed yet): { id }
//   GET ?id= | ?code=                → what is asking, its code, the defaults and choices, and whether the member's plan allows it
//   POST { action: "approve", id, policy } (signed in) → { redirect? } · POST { action: "deny", id } → { redirect? }
async function uidOf(req: NextRequest): Promise<string | null> {
  const t = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const d = t ? await getAuth(getAdminApp()).verifyIdToken(t).catch(() => null) : null;
  return d?.uid ?? null;
}
const fail = (e: unknown) => {
  if (e instanceof AgentAuthError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  console.error("[agents] authorize failed", e);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
};

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "agent-view", clientIp(req), 60, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const uid = await uidOf(req);
    const sp = req.nextUrl.searchParams;
    const view = await viewRequest(db, uid, { id: sp.get("id") ?? undefined, code: sp.get("code") ?? undefined });
    const s = await getAgentSettings(db);
    const me = uid ? await canConnect(db, uid) : null;
    return NextResponse.json({
      request: view, defaults: defaultGrant(s), choices: { accessDays: accessDayChoices(s), actionsPerDay: actionChoices(s), discountNaira: discountChoices(s) },
      linkCodeMinutes: s.linkCodeMinutes, logDays: s.logDays, urls: agentUrls(requestHost(req.headers)),
      me: me ? { allowed: me.ok, name: String(me.user.displayName ?? ""), username: String(me.user.username ?? ""), avatar: String(me.user.avatar ?? "") } : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    if (b.action === "start") {
      const limited = await rateLimit(req, "agent-connect", clientIp(req), 10, 600);
      if (limited) return limited;
      const r = await startOAuth(db, (b.params ?? {}) as Record<string, unknown>);
      return NextResponse.json({ id: r.id });
    }
    const uid = await uidOf(req);
    if (!uid) return NextResponse.json({ error: "Sign in to connect an assistant." }, { status: 401 });
    if (b.action === "approve") return NextResponse.json(await approveRequest(db, uid, String(b.id ?? ""), b.policy));
    if (b.action === "deny") return NextResponse.json(await denyRequest(db, String(b.id ?? "")));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return fail(e); }
}
