import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { AccessError, getAdminApp, getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { ThrowawayError, addDomains, blocklist, findAccounts, removeDomain, suspendAccounts } from "@/lib/throwaway-emails-server";

export const dynamic = "force-dynamic";

// Admin → People & Trust → Throwaway emails (customer care and trust & safety, like suspensions).
// GET → the blocklist. POST { action: "add", text } · { action: "remove", domain } · { action: "find" } · { action: "suspend", uids }
const NEED = ["support", "moderation"] as const;
const token = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(token(req), NEED);
    return NextResponse.json(await blocklist(getAdminDb()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const by = await verifyAdminRequest(token(req), NEED);
    const limited = await rateLimit(req, "throwaway-emails", by, 30, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (b.action === "add") return NextResponse.json(await addDomains(db, b.text, by));
    if (b.action === "remove") return NextResponse.json(await removeDomain(db, b.domain, by));
    if (b.action === "find") return NextResponse.json({ accounts: await findAccounts(db, getAuth(getAdminApp())) });
    if (b.action === "suspend") return NextResponse.json(await suspendAccounts(db, getAuth(getAdminApp()), b.uids, by));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return fail(e); }
}

function fail(e: unknown) {
  if (e instanceof AccessError) return NextResponse.json({ error: "Customer care and trust & safety only." }, { status: 403 });
  if (e instanceof ThrowawayError) return NextResponse.json({ error: e.message }, { status: e.status });
  const f = friendlyMessage(e, "Couldn't update throwaway emails");
  return NextResponse.json({ error: f.message }, { status: f.status });
}
