import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, setAdminClaim, verifyAdminRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";

// Admin-only: grant or revoke the `admin` custom claim by email.
// You can't revoke your own — that's how you'd lock everyone out.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const callerUid = await verifyAdminRequest(idToken).catch(() => null);
    if (!callerUid) return NextResponse.json({ error: "Admins only." }, { status: 403 });
    const limited = rateLimit(req, "set-admin", callerUid, 20, 3600);
    if (limited) return limited;

    const { email, admin } = await req.json();
    if (typeof email !== "string" || typeof admin !== "boolean") {
      return NextResponse.json({ error: "email and admin (boolean) are required" }, { status: 400 });
    }
    const target = await getAuth(getAdminApp()).getUserByEmail(email).catch(() => null);
    if (!target) return NextResponse.json({ error: "No account with that email." }, { status: 404 });
    if (!admin && target.uid === callerUid) {
      return NextResponse.json({ error: "You can't remove your own admin access." }, { status: 400 });
    }
    await setAdminClaim(target.uid, admin);
    return NextResponse.json({ ok: true, uid: target.uid, admin });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
