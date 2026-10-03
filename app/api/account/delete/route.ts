import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { deletionBlockers, eraseAccount } from "@/lib/account-server";
import { deleteObject, privateFilesConfigured } from "@/lib/private-files";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FRESH_LOGIN_MS = 10 * 60_000; // deleting an account needs a sign-in from the last 10 minutes

async function who(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const d = await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null);
  return d ? { uid: d.uid, email: d.email || "", isAdmin: d.admin === true, authTime: (d.auth_time ?? 0) * 1000 } : null;
}

// GET → what, if anything, stops this account from being deleted right now.
export async function GET(req: NextRequest) {
  try {
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    return NextResponse.json({ blockers: await deletionBlockers(getAdminDb(), me.uid, { isAdmin: me.isAdmin }) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't check your account");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

// POST { confirm: "<username>" } → erase the account (personal data removed, money records kept anonymised).
export async function POST(req: NextRequest) {
  try {
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "account-delete", me.uid, 5, 3600);
    if (limited) return limited;
    if (Date.now() - me.authTime > FRESH_LOGIN_MS) return NextResponse.json({ error: "For your security, sign in again first.", code: "reauth" }, { status: 401 });

    const db = getAdminDb();
    const profile = (await db.doc(`users/${me.uid}`).get()).data();
    const { confirm } = await req.json();
    if (!profile || typeof confirm !== "string" || confirm.trim().toLowerCase() !== String(profile.username).toLowerCase()) {
      return NextResponse.json({ error: "Type your username exactly to confirm." }, { status: 400 });
    }
    const blockers = await deletionBlockers(db, me.uid, { isAdmin: me.isAdmin });
    if (blockers.length) return NextResponse.json({ error: "Your account can't be deleted yet.", blockers }, { status: 409 });

    const counts = await eraseAccount(db, me.uid, privateFilesConfigured() ? deleteObject : undefined);
    if (me.email) {
      await sendEmail({ to: me.email, subject: "Your #NotesApp account was deleted", text: `Your #NotesApp account and the personal data tied to it have been deleted, as you asked. Payment and order records are kept without your personal details, as the law requires. If this wasn't you, reply via the Contact page right away.\n\n#NotesApp` }).catch(() => {});
    }
    await getAuth(getAdminApp()).deleteUser(me.uid);
    console.info("[account] deleted", me.uid, JSON.stringify(counts));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't delete the account");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
