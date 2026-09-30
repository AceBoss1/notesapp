import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { ADMIN_PROFILES } from "@/lib/admin";
import { isReservedUsername, SYNTHETIC_USERNAMES } from "@/lib/journals-directory";

export const dynamic = "force-dynamic";

const COOLDOWN_DAYS = 30;

// Self-serve username change. The old name stays reserved as an alias that
// still resolves to the member (old links keep working; nobody else can
// take it). Denormalised copies (notes, follows, subscriptions) are updated.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "username-change", user.uid, 5, 3600);
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const next = String(body.username ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (next.length < 3 || next.length > 24) return NextResponse.json({ error: "Username must be 3–24 characters (letters, numbers, _)." }, { status: 400 });
    if (isReservedUsername(next)) return NextResponse.json({ error: 'Usernames can\'t contain "notesapp" — that\'s reserved for the platform.' }, { status: 400 });
    if (SYNTHETIC_USERNAMES.includes(next) || Object.values(ADMIN_PROFILES).some((a) => a.username === next)) {
      return NextResponse.json({ error: "That username is reserved." }, { status: 409 });
    }

    const db = getAdminDb();
    const userRef = db.doc(`users/${user.uid}`);
    const me = (await userRef.get()).data();
    if (!me) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (me.role === "admin") return NextResponse.json({ error: "Founder usernames can't be changed here." }, { status: 403 });
    if (me.suspended) return NextResponse.json({ error: "Suspended accounts can't change username." }, { status: 403 });
    const prev = String(me.username);
    if (prev === next) return NextResponse.json({ error: "That's already your username." }, { status: 400 });
    if (me.usernameChangedAt) {
      const days = (Date.now() - new Date(me.usernameChangedAt).getTime()) / 86400000;
      if (days < COOLDOWN_DAYS) {
        return NextResponse.json({ error: `You can change your username once every ${COOLDOWN_DAYS} days. Try again in ${Math.ceil(COOLDOWN_DAYS - days)} day(s).` }, { status: 429 });
      }
    }

    // Atomically claim the new name and switch the profile over.
    await db.runTransaction(async (tx) => {
      const claim = db.doc(`usernames/${next}`);
      const existing = await tx.get(claim);
      if (existing.exists && existing.data()?.uid !== user.uid) throw new Error("USERNAME_TAKEN");
      tx.set(claim, { uid: user.uid });
      tx.update(userRef, { username: next, usernameChangedAt: new Date().toISOString(), previousUsername: prev });
    });

    // Best-effort: refresh denormalised copies.
    const notes = await db.collection("notes").where("authorUid", "==", user.uid).get();
    for (let i = 0; i < notes.docs.length; i += 400) {
      const batch = db.batch();
      notes.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, { authorUsername: next }));
      await batch.commit();
    }
    for (const col of ["follows", "subscriptions"] as const) {
      const snap = await db.collection(col).where("username", "==", prev).get();
      for (let i = 0; i < snap.docs.length; i += 200) {
        const batch = db.batch();
        snap.docs.slice(i, i + 200).forEach((d) => {
          const data = d.data();
          const owner = (col === "follows" ? data.followerUid : data.subscriberUid) as string;
          batch.set(db.doc(`${col}/${owner}_${next}`), { ...data, username: next });
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    }
    return NextResponse.json({ ok: true, username: next });
  } catch (err) {
    if (err instanceof Error && err.message === "USERNAME_TAKEN") return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    const f = friendlyMessage(err, "Couldn't change your username");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
