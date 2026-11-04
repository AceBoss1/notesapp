import { NextRequest, NextResponse } from "next/server";
import { getUserEmails, verifyAdminRequest } from "@/lib/firebase-admin";
import { maskEmails } from "@/lib/pii-server";
import { rateLimit } from "@/lib/rate-limit";

// Admin-only: uid → masked email map (a•••i@gmail.com, lib/pii.ts), read from Firebase Authentication (emails are no longer
// stored in the public users documents). The real one is shown with a reason through /api/admin/reveal, which logs it.
// Accounts that sign in with the same email address (Gmail dots and +tags ignored), as uid → group number, so the Users page can
// flag a real duplicate without seeing the address. Accounts with an email nobody else has are left out.
function sharedEmailGroups(emails: Record<string, string>): Record<string, number> {
  const norm = (e: string) => {
    const [local, domain = ""] = e.trim().toLowerCase().split("@");
    const gmail = domain === "gmail.com" || domain === "googlemail.com";
    return gmail ? `${local.split("+")[0].replace(/\./g, "")}@gmail.com` : `${local}@${domain}`;
  };
  const by = new Map<string, string[]>();
  for (const [uid, e] of Object.entries(emails)) by.set(norm(e), [...(by.get(norm(e)) ?? []), uid]);
  const out: Record<string, number> = {};
  let n = 0;
  for (const uids of Array.from(by.values())) if (uids.length > 1) { n++; for (const u of uids) out[u] = n; }
  return out;
}

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
    const emails = await getUserEmails(uids);
    return NextResponse.json({ emails: maskEmails(emails), sharedEmail: sharedEmailGroups(emails) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
