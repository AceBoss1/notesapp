import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { DomainDoc, checkDomain, domainForUid, registerDomain, removeDomain, vercelConfigured } from "@/lib/domains";
import { normalizeHost } from "@/lib/host";
import { HttpError, consoleMember, consoleRoute } from "@/lib/console-auth";

export const dynamic = "force-dynamic";

const view = (d: (DomainDoc & { id?: string }) | null) => d && { host: d.host, status: d.status, home: d.home, note: d.note || "", dns: d.dns, verifiedAt: d.verifiedAt || null };

async function allowed(req: NextRequest) {
  const m = await consoleMember(req);
  if (!m.domainAllowed) throw new HttpError(403, "Your own domain is an Enterprise feature. See the Pricing page, or send us a request at /contact.");
  return m;
}

export async function GET(req: NextRequest) {
  return consoleRoute("Couldn't load your domain", async () => {
    const m = await consoleMember(req);
    return NextResponse.json({ allowed: m.domainAllowed, domain: m.domainAllowed ? view(await domainForUid(m.uid)) : null, autoConnect: vercelConfigured() });
  });
}

// Add a domain (one per account). Starts as pending until DNS is verified.
export async function POST(req: NextRequest) {
  return consoleRoute("Couldn't add the domain", async () => {
    const m = await allowed(req);
    const body = await req.json().catch(() => ({}));
    const host = normalizeHost(String(body.host || ""));
    if (!host) throw new HttpError(400, "Enter a domain like notes.yourbrand.com or yourbrand.com.");
    if (await domainForUid(m.uid)) throw new HttpError(400, "You already have a domain — remove it first to use another.");
    const db = getAdminDb();
    if ((await db.doc(`customDomains/${host}`).get()).exists) throw new HttpError(409, "That domain is already connected to another account.");
    const reg = await registerDomain(host);
    const doc: DomainDoc = { host, uid: m.uid, username: m.user.username, status: "pending", home: "profile", dns: reg.dns, vercel: reg.vercel, ...(reg.note ? { note: reg.note } : {}), createdAt: new Date().toISOString() };
    await db.doc(`customDomains/${host}`).set(doc);
    return NextResponse.json({ domain: view(doc) });
  });
}

// { action: "check" } re-runs verification; { home: "profile" | "store" } changes what the domain's front page shows.
export async function PATCH(req: NextRequest) {
  return consoleRoute("Couldn't update the domain", async () => {
    const m = await allowed(req);
    const d = await domainForUid(m.uid);
    if (!d) throw new HttpError(404, "No domain yet.");
    const body = await req.json().catch(() => ({}));
    const ref = getAdminDb().doc(`customDomains/${d.id}`);
    if (body.home === "profile" || body.home === "store") {
      await ref.update({ home: body.home });
      return NextResponse.json({ domain: view({ ...d, home: body.home }) });
    }
    if (body.action === "check") {
      const r = await checkDomain(d.host);
      const patch: Partial<DomainDoc> = r.active ? { status: "active", note: "", verifiedAt: new Date().toISOString() } : { status: "pending", note: r.note || "" };
      await ref.update(patch);
      return NextResponse.json({ domain: view({ ...d, ...patch }) });
    }
    throw new HttpError(400, "Nothing to change.");
  });
}

export async function DELETE(req: NextRequest) {
  return consoleRoute("Couldn't remove the domain", async () => {
    const m = await allowed(req);
    const d = await domainForUid(m.uid);
    if (!d) return NextResponse.json({ ok: true });
    await removeDomain(d.host);
    await getAdminDb().doc(`customDomains/${d.id}`).delete();
    return NextResponse.json({ ok: true });
  });
}
