import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// The organisations and businesses the signed-in member helps run, for the account menu's switcher (components/shell/AccountMenu.tsx;
// owner, 22 Nov 2026: "there's still need to be able to view/switch to organizations/businesses one has been made admin"):
// organisations where they're an admin (orgMembers role "admin") and sellers whose books they keep (bookStaff: manager or cashier).
// Each page they open checks the role again (lib/books-server.ts, the inventory, team and jobs APIs); this only lists.
// GET → { accounts: [{ uid, username, name, avatar, org, role: "admin" | "manager" | "cashier", store }] }
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const db = getAdminDb();
    const [members, staff] = await Promise.all([
      db.collection("orgMembers").where("memberUid", "==", me.uid).get().catch(() => null),
      db.collection("bookStaff").where("uid", "==", me.uid).get().catch(() => null),
    ]);
    const roles = new Map<string, { role: "admin" | "manager" | "cashier"; store: boolean }>();
    for (const m of members?.docs.map((d) => d.data()) ?? []) {
      if (m.role === "admin" && m.orgUid && m.orgUid !== me.uid) roles.set(String(m.orgUid), { role: "admin", store: m.store === true });
    }
    for (const s of staff?.docs.map((d) => d.data()) ?? []) {
      const owner = String(s.ownerUid ?? "");
      if (owner && owner !== me.uid && !roles.has(owner)) roles.set(owner, { role: s.role === "manager" ? "manager" : "cashier", store: false });
    }
    const ids = [...roles.keys()].slice(0, 30);
    const docs = ids.length ? await db.getAll(...ids.map((u) => db.doc(`users/${u}`))) : [];
    const accounts = docs.filter((d) => d.exists && d.data()?.suspended !== true && d.data()?.username).map((d) => {
      const u = d.data()!;
      const r = roles.get(d.id)!;
      return { uid: d.id, username: String(u.username), name: String(u.displayName ?? u.username), avatar: String(u.avatar ?? ""), org: u.accountKind === "organisation", role: r.role, store: r.store };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ accounts }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load your organisations");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
