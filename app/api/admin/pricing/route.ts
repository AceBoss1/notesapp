import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { isSuper } from "@/lib/admin-access";
import { PricingError } from "@/lib/pricing";
import { pricingView, savePricing } from "@/lib/pricing-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
async function caller(req: NextRequest) {
  const me = await verifyAdminAccess(bearer(req));
  if (!me.owner && !isSuper(me.access)) throw new PricingError("Prices are for the owner and super admins.", 403);
  return { uid: me.uid, email: me.email, owner: me.owner, super: isSuper(me.access) };
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof PricingError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Owner and super admins: GET → the prices and rates in force, the defaults, and the change log.
// POST { config } saves a full set of prices and rates; POST { reset: true } goes back to the built-in defaults. New prices apply to new
// purchases at once; people already subscribed keep the plan they bought until it renews on a new plan (see lib/tier-billing.ts).
export async function GET(req: NextRequest) {
  try {
    await caller(req);
    return NextResponse.json(await pricingView(getAdminDb()), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load prices");
  }
}

export async function POST(req: NextRequest) {
  try {
    const c = await caller(req);
    const limited = await rateLimit(req, "pricing", c.uid, 30, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const r = await savePricing(getAdminDb(), c, b.config, b.reset === true);
    revalidateTag("pricing"); // the layout's cached copy of the prices
    revalidatePath("/", "layout"); // pages built with the old numbers are rebuilt with the new ones
    return NextResponse.json(r);
  } catch (err) {
    return fail(err, "Couldn't save prices");
  }
}
