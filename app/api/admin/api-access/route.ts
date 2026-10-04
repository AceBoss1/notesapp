import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { DomainDoc, removeDomain, vercelConfigured } from "@/lib/domains";
import { notifyBell } from "@/lib/email";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: who has API access, and every custom domain.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    const db = getAdminDb();
    const [enabled, domains] = await Promise.all([db.collection("users").where("apiAccess", "==", true).get(), db.collection("customDomains").get()]);
    return NextResponse.json({
      enabled: enabled.docs.map((d) => ({ uid: d.id, username: d.data().username, displayName: d.data().displayName, tier: d.data().accountTier })),
      domains: domains.docs.map((d) => ({ ...(d.data() as DomainDoc) })),
      autoConnect: vercelConfigured(),
    });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load API access");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

// { action: "set_access", username, enabled } | { action: "set_domain", host, status: "active"|"pending" } | { action: "remove_domain", host }
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    const body = await req.json();
    const db = getAdminDb();
    if (body.action === "set_access") {
      const name = String(body.username || "").trim().toLowerCase().replace(/^@/, "");
      const uid = (await db.doc(`usernames/${name}`).get()).data()?.uid as string | undefined;
      if (!uid) return NextResponse.json({ error: `No member with the username @${name}.` }, { status: 404 });
      const enabled = body.enabled === true;
      await db.doc(`users/${uid}`).update({ apiAccess: enabled });
      if (!enabled) {
        // Switching access off also revokes live keys and stops webhooks.
        const keys = await db.collection("apiKeys").where("uid", "==", uid).get();
        await Promise.all(keys.docs.filter((k) => !k.data().revokedAt).map((k) => k.ref.update({ revokedAt: new Date().toISOString() })));
        const eps = await db.collection("webhookEndpoints").where("uid", "==", uid).get();
        await Promise.all(eps.docs.map((e) => e.ref.update({ active: false })));
      } else {
        await notifyBell({ uid, type: "org", linkHref: "/console", message: "API access is now enabled on your account — create keys and webhooks in the Console." });
      }
      return NextResponse.json({ ok: true });
    }
    if (body.action === "set_domain" || body.action === "remove_domain") {
      const host = String(body.host || "");
      const ref = db.doc(`customDomains/${host}`);
      const d = (await ref.get()).data() as DomainDoc | undefined;
      if (!d) return NextResponse.json({ error: "No such domain." }, { status: 404 });
      if (body.action === "remove_domain") {
        await removeDomain(host);
        await ref.delete();
      } else {
        const active = body.status === "active";
        await ref.update(active ? { status: "active", note: "", verifiedAt: new Date().toISOString() } : { status: "pending" });
        if (active) await notifyBell({ uid: d.uid, type: "org", linkHref: "/console", message: `${host} is now live on #NotesApp.` });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't update API access");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
