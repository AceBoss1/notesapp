import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { normalizeHost } from "@/lib/host";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Signs a member's visitor into the member's own domain. Someone who has just signed in on www.notesapp.name.ng asks for
// a hand-off to an ACTIVE custom domain; we mint a short-lived Firebase custom token for their own account and return the
// URL on that domain that redeems it (in the #fragment, so it never reaches a server log or a Referer header).
// POST { host, next? } with Authorization: Bearer <ID token>  →  { url }
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "auth-handoff", clientIp(req), 20, 60);
  if (limited) return limited;
  try {
    const user = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const host = normalizeHost(String(body.host || ""));
    let next = String(body.next || "/");
    if (!next.startsWith("/") || next.startsWith("//")) next = "/";
    if (!host) return NextResponse.json({ error: "Unknown domain." }, { status: 400 });
    // Only ever hand a session to a domain we serve for a member.
    const d = (await getAdminDb().doc(`customDomains/${host}`).get()).data();
    if (!d || d.status !== "active") return NextResponse.json({ error: "Unknown domain." }, { status: 400 });
    const token = await getAuth(getAdminApp()).createCustomToken(user.uid);
    return NextResponse.json({ url: `https://${host}/auth/handoff#t=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}` });
  } catch (err) {
    console.error("auth handoff failed:", err);
    return NextResponse.json({ error: "Couldn't complete sign-in on that site. Try again." }, { status: 500 });
  }
}
