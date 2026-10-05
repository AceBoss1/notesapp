import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { notifyBell } from "@/lib/email";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: the Enterprise accounts and the rates agreed with each. users/{uid}.customRates is written here only
// (Firestore rules stop members editing it); it applies while the account is on Enterprise.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    const db = getAdminDb();
    const [users, domains] = await Promise.all([db.collection("users").where("accountTier", "==", "enterprise").get(), db.collection("customDomains").get()]);
    const host = new Map(domains.docs.map((d) => [d.data().uid as string, d.data().host as string]));
    return NextResponse.json({
      accounts: users.docs.map((d) => {
        const u = d.data();
        return { uid: d.id, username: u.username, displayName: u.displayName, apiAccess: u.apiAccess === true, domain: host.get(d.id) || null, customRates: u.customRates || {} };
      }),
    });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load Enterprise accounts");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

// { username, session?, physical?, digital?, adShare? } — percentages (0–50 for commissions, 0–100 for the ad share);
// a blank or missing field clears that override, so the Enterprise default applies.
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    const body = await req.json();
    const db = getAdminDb();
    const name = String(body.username || "").trim().toLowerCase().replace(/^@/, "");
    const uid = (await db.doc(`usernames/${name}`).get()).data()?.uid as string | undefined;
    if (!uid) return NextResponse.json({ error: `No member with the username @${name}.` }, { status: 404 });
    const user = (await db.doc(`users/${uid}`).get()).data();
    if (user?.accountTier !== "enterprise") return NextResponse.json({ error: `@${name} isn't on the Enterprise plan. Approve their Enterprise request first.` }, { status: 409 });

    const rates: Record<string, number> = {};
    for (const [key, max] of [["session", 50], ["physical", 50], ["digital", 50], ["adShare", 100]] as const) {
      const raw = body[key];
      if (raw === "" || raw === null || raw === undefined) continue;
      const pct = Number(raw);
      if (!Number.isFinite(pct) || pct < 0 || pct > max) return NextResponse.json({ error: `${key}: enter a percentage between 0 and ${max}.` }, { status: 400 });
      rates[key] = Math.round(pct * 100) / 10000; // 12.5 % → 0.125
    }
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.doc(`users/${uid}`).update({ customRates: Object.keys(rates).length ? rates : FieldValue.delete() });
    await notifyBell({ uid, type: "org", linkHref: "/profile/publishing", message: "Your agreed Enterprise rates have been updated." });
    return NextResponse.json({ ok: true, customRates: rates });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't save the rates");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
