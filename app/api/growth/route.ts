import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ourRoot } from "@/lib/host";
import { REFERRAL_COOKIE } from "@/lib/referrals";
import { FIRST_TOUCH_COOKIE, INSTALL_COOKIE, PING_COOKIE, decodeTouch } from "@/lib/growth";
import { inviteStats, markFirstValue, markSeen, recordInstall, recordSignupSource, recordVisit } from "@/lib/growth-server";

export const dynamic = "force-dynamic";

// Growth measurement (lib/growth.ts, docs/GROWTH.md). Small, first-party reports from our own pages; counts only.
// GET                                   → your own invite link's numbers (Your invite link): opened this month, joined, installed, active
// POST { action: "visit" }              → a new visitor or a creator's link opened, from the flag the middleware set (then cleared)
// POST { action: "install", device }    → the app was installed (appinstalled, or the installed app's first open on this device)
// POST { action: "seen", r?, fresh? }   → once a day: a signed-in member was here, and what brought them (?r=)
// POST { action: "value", kind, noteId? } → first value the browser sees first: a journal published, or one read to the end
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const who = (req: NextRequest) => verifySignedInRequest(bearer(req)).catch(() => null);
const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: NextRequest) {
  const u = await who(req);
  if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const db = getAdminDb();
    const username = String((await db.doc(`users/${u.uid}`).get()).data()?.username ?? "");
    return NextResponse.json({ username, ...(await inviteStats(db, u.uid, username)) }, noStore);
  } catch (e) {
    console.error("growth me", e);
    return NextResponse.json({ error: "Couldn't load your link's numbers." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (body.action === "visit") {
      if (await rateLimit(req, "growth-visit", clientIp(req), 30, 600)) return NextResponse.json({ ok: true });
      const ping = (req.cookies.get(PING_COOKIE)?.value || "").replace(/[^vo]/g, "");
      const u = bearer(req) ? await who(req) : null;
      const r = ping ? await recordVisit(db, { touch: decodeTouch(req.cookies.get(FIRST_TOUCH_COOKIE)?.value), ping, creator: req.cookies.get(REFERRAL_COOKIE)?.value, signedIn: !!u }) : { visit: false, open: false };
      const res = NextResponse.json({ ok: true, ...r }, noStore);
      const fam = ourRoot((req.headers.get("host") || "").toLowerCase().replace(/:\d+$/, ""));
      res.cookies.set(PING_COOKIE, "", { path: "/", maxAge: 0, ...(fam ? { domain: `.${fam.root}` } : {}) });
      return res;
    }
    if (body.action === "install") {
      if (await rateLimit(req, "growth-install", clientIp(req), 10, 3600)) return NextResponse.json({ ok: true });
      const u = bearer(req) ? await who(req) : null;
      const r = await recordInstall(db, { touch: decodeTouch(req.cookies.get(FIRST_TOUCH_COOKIE)?.value), uid: u?.uid ?? null, countDevice: body.device !== false });
      const res = NextResponse.json({ ok: true, ...r }, noStore);
      // Installed before having an account: the account gets it when they join.
      if (!u) res.cookies.set(INSTALL_COOKIE, "1", { path: "/", maxAge: 30 * 86_400, sameSite: "lax", secure: req.nextUrl.protocol === "https:", httpOnly: true });
      return res;
    }
    const u = await who(req);
    if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    if (body.action === "seen") {
      if (await rateLimit(req, "growth-seen", u.uid, 10, 3600)) return NextResponse.json({ ok: true });
      let seen = await markSeen(db, u.uid, body.r);
      // A new account whose sign-up didn't record its source (it signed up another way): record it now, from the same cookie.
      if (!seen.marked && body.fresh === true) {
        const r = await recordSignupSource(db, u.uid, req.cookies.get(FIRST_TOUCH_COOKIE)?.value, { installed: req.cookies.get(INSTALL_COOKIE)?.value === "1" });
        if (r.recorded) seen = { marked: true };
      }
      return NextResponse.json({ ok: true, ...seen }, noStore);
    }
    if (body.action === "value") {
      if (await rateLimit(req, "growth-value", u.uid, 20, 3600)) return NextResponse.json({ ok: true });
      if (body.kind === "journal") {
        // Only when they really have a published journal.
        const mine = await db.collection("notes").where("authorUid", "==", u.uid).select("status").limit(50).get();
        const ok = mine.docs.some((d) => d.data().status === "published");
        return NextResponse.json({ ok: true, recorded: ok ? await markFirstValue(db, u.uid, "journal") : false });
      }
      if (body.kind === "read") {
        const id = String(body.noteId ?? "");
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return NextResponse.json({ error: "Which journal?" }, { status: 400 });
        const n = (await db.doc(`notes/${id}`).get()).data();
        const ok = !!n && n.status === "published" && n.authorUid !== u.uid;
        return NextResponse.json({ ok: true, recorded: ok ? await markFirstValue(db, u.uid, "read") : false });
      }
      return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("growth", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
