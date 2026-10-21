import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { planImport } from "@/lib/inventory";
import { ensurePricing } from "@/lib/pricing-server";
import { inventoryAddonPrice, inventoryTrialDays } from "@/lib/pricing";
import { InventoryError, accessFor, adjustStock, applyImport, historyOf, readInventory, saveDetails, startInventoryTrial } from "@/lib/inventory-server";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
const fail = (err: unknown, what: string) => {
  if (err instanceof InventoryError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// GET ?owner=<uid>[&history=<itemId>|all] → the store's stock lines, details and summary (lib/inventory-server.ts readInventory), or its
// history. owner defaults to the signed-in account; an organisation's teammates pass the organisation's uid. Without inventory: { access }.
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const db = getAdminDb();
    await ensurePricing();
    const price = { price: inventoryAddonPrice(), trialDays: inventoryTrialDays() };
    const owner = req.nextUrl.searchParams.get("owner") || me.uid;
    const history = req.nextUrl.searchParams.get("history");
    if (history) return NextResponse.json({ moves: await historyOf(db, me.uid, owner, history === "all" ? undefined : history) }, { headers: { "Cache-Control": "no-store" } });
    // The stores this person can work on: their own, and organisations that gave them store access or made them an admin.
    const memberOf = await db.collection("orgMembers").where("memberUid", "==", me.uid).get().catch(() => null);
    const orgs = (memberOf?.docs ?? []).map((d) => d.data()).filter((m) => m.store === true || m.role === "admin").map((m) => String(m.orgUid));
    const names = orgs.length ? await db.getAll(...orgs.map((u) => db.doc(`users/${u}`))) : [];
    const accounts = [{ uid: me.uid, name: "My store" }, ...names.filter((d) => d.exists).map((d) => ({ uid: d.id, name: String(d.data()?.displayName ?? d.id) }))];
    try {
      return NextResponse.json({ ...(await readInventory(db, me.uid, owner)), accounts }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      // No inventory yet: say what it would take (the trial, the add-on or Business).
      if (e instanceof InventoryError && e.status === 402 && owner === me.uid) {
        const p = (await db.doc(`users/${me.uid}`).get()).data();
        return NextResponse.json({ access: p ? accessFor(p as Parameters<typeof accessFor>[0]) : { ok: false, canTrial: false }, tier: p?.accountTier ?? "standard", accounts, ...price });
      }
      throw e;
    }
  } catch (err) {
    return fail(err, "Couldn't load your inventory");
  }
}

// POST { action, owner?, … }:
//   trial                                   — start the one-time free trial (Free Basic)
//   details  { itemId, sku?, variantSku?, costKobo?, lowAt? }
//   adjust   { itemId, variant?, mode: add|set, amount, reason, note? }
//   import   { csv, apply? }                 — without apply: what would change and any problems; with apply: saves it
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "inventory", me.uid, 600, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    await ensurePricing();
    const b = await req.json().catch(() => ({}));
    const owner = typeof b.owner === "string" && b.owner ? b.owner : me.uid;
    if (b.action === "trial") return NextResponse.json({ access: await startInventoryTrial(db, me.uid) });
    if (b.action === "details") return NextResponse.json({ inventory: await saveDetails(db, me.uid, owner, String(b.itemId ?? ""), b) });
    if (b.action === "adjust") return NextResponse.json(await adjustStock(db, me.uid, owner, String(b.itemId ?? ""), b));
    if (b.action === "import") {
      const csv = String(b.csv ?? "");
      if (csv.length > 2_000_000) return NextResponse.json({ error: "That file is too big (2 MB at most)." }, { status: 413 });
      const { lines } = await readInventory(db, me.uid, owner);
      const plan = planImport(csv, lines);
      if (!b.apply) return NextResponse.json(plan);
      if (plan.problems.length) return NextResponse.json({ error: "Fix the rows with problems first.", ...plan }, { status: 400 });
      return NextResponse.json({ applied: await applyImport(db, me.uid, owner, plan.changes) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
