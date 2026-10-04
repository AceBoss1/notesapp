import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { API_SCOPES, ApiScope, ApiKeyDoc, createApiKey } from "@/lib/api-keys";
import { HttpError, consoleMember, consoleRoute, needApi } from "@/lib/console-auth";

export const dynamic = "force-dynamic";
const MAX_ACTIVE = 10;

export async function GET(req: NextRequest) {
  return consoleRoute("Couldn't load your keys", async () => {
    const m = await consoleMember(req);
    const access = { apiAccess: m.apiAccess, domainAllowed: m.domainAllowed, username: m.user.username as string };
    if (!m.apiAccess) return NextResponse.json({ access, keys: [] });
    const snap = await getAdminDb().collection("apiKeys").where("uid", "==", m.uid).get();
    const keys = snap.docs
      .map((d) => { const k = d.data() as ApiKeyDoc; return { id: d.id, name: k.name, prefix: k.prefix, scopes: k.scopes, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt || null, revokedAt: k.revokedAt || null }; })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ access, keys });
  });
}

export async function POST(req: NextRequest) {
  return consoleRoute("Couldn't create the key", async () => {
    const m = await consoleMember(req);
    needApi(m);
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim().slice(0, 60);
    const scopes: ApiScope[] = ((Array.isArray(body.scopes) ? body.scopes : []) as unknown[]).filter((s): s is ApiScope => API_SCOPES.includes(s as ApiScope));
    if (!name) throw new HttpError(400, "Give the key a name, like “Precheks production”.");
    if (!scopes.length) throw new HttpError(400, "Choose at least one permission.");
    const active = (await getAdminDb().collection("apiKeys").where("uid", "==", m.uid).get()).docs.filter((d) => !d.data().revokedAt).length;
    if (active >= MAX_ACTIVE) throw new HttpError(400, `You can have up to ${MAX_ACTIVE} active keys — revoke one first.`);
    const { id, token } = await createApiKey(m.uid, name, Array.from(new Set(scopes)));
    return NextResponse.json({ id, token }); // the only time the full key is ever shown
  });
}

export async function DELETE(req: NextRequest) {
  return consoleRoute("Couldn't revoke the key", async () => {
    const m = await consoleMember(req);
    const id = req.nextUrl.searchParams.get("id") || "";
    const ref = getAdminDb().doc(`apiKeys/${id}`);
    const k = (await ref.get()).data() as ApiKeyDoc | undefined;
    if (!k || k.uid !== m.uid) throw new HttpError(404, "Key not found.");
    await ref.update({ revokedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  });
}
