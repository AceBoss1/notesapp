import { NextRequest, NextResponse } from "next/server";
import { getUserEmails, verifyAdminRequest } from "@/lib/firebase-admin";
import { maskEmails } from "@/lib/pii-server";
import { rateLimit } from "@/lib/rate-limit";

// Admin-only: uid → masked email map (a•••i@gmail.com, lib/pii.ts), read from Firebase Authentication (emails are no longer
// stored in the public users documents). The real one is shown with a reason through /api/admin/reveal, which logs it.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const adminUid = await verifyAdminRequest(idToken, ["support", "moderation", "finance"]).catch(() => null);
    if (!adminUid) return NextResponse.json({ error: "Admins only." }, { status: 403 });
    const limited = await rateLimit(req, "user-emails", adminUid, 60, 600);
    if (limited) return limited;
    const { uids } = await req.json();
    if (!Array.isArray(uids) || uids.length > 1000 || !uids.every((u) => typeof u === "string")) {
      return NextResponse.json({ error: "uids must be an array of strings (max 1000)" }, { status: 400 });
    }
    return NextResponse.json({ emails: maskEmails(await getUserEmails(uids)) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
