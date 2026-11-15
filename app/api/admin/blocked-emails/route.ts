import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { BUILT_IN_BLOCKED_DOMAINS } from "@/lib/email-blocklist";
import { BlocklistError, addDomains, addedDomains, findBlockedAccounts, removeDomain, suspendBlockedAccounts } from "@/lib/email-blocklist-server";

export const dynamic = "force-dynamic";
const NEED = ["moderation", "support"] as const;

// Admin → Throwaway emails. GET → { builtIn, added }. POST { action: "add", domains } · { action: "remove", domain }
// · { action: "find" } → { accounts } · { action: "suspend" } (moderation only) → { suspended }.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), NEED);
    return NextResponse.json({ builtIn: BUILT_IN_BLOCKED_DOMAINS, added: await addedDomains(getAdminDb()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return fail(err); }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const by = await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), body.action === "suspend" ? ["moderation"] : NEED);
    const db = getAdminDb();
    if (body.action === "add") return NextResponse.json({ added: await addDomains(db, body.domains, by) });
    if (body.action === "remove") return NextResponse.json({ added: await removeDomain(db, body.domain, by) });
    if (body.action === "find") return NextResponse.json({ accounts: await findBlockedAccounts(db, getAuth(getAdminApp())) });
    if (body.action === "suspend") return NextResponse.json({ suspended: await suspendBlockedAccounts(db, getAuth(getAdminApp()), by) });
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) { return fail(err); }
}
function fail(err: unknown) {
  if (err instanceof BlocklistError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, "Couldn't update the throwaway email list");
  return NextResponse.json({ error: f.message }, { status: f.status });
}
