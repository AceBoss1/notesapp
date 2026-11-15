import { NextRequest } from "next/server";
import { clientIp } from "@/lib/rate-limit";
import { explain, liteConfigured, liteModel } from "@/lib/nana-lite-server";
import { body, db, fail, limit, maybeUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";

// Nana Lite (lib/nana-lite.ts, docs/NANA_LITE.md).
// GET → { on, model }: whether Nana Lite is switched on (NANA_LITE_URL), so the page shows or hides it.
// POST { questionId, chosen?, followUp?, lang? ("en" | "pcm") } → { text, model }: a short explanation from our own small model, grounded in
// the question's reviewed explanation. Nothing the student types is stored.
export async function GET() {
  return ok({ on: liteConfigured(), model: liteConfigured() ? liteModel() : null });
}
export async function POST(req: NextRequest) {
  try {
    const u = await maybeUser(req);
    const limited = await limit(req, "lite", u?.uid ?? null, 30, 600);
    if (limited) return limited;
    return ok(await explain(db(), { uid: u?.uid ?? null, ip: clientIp(req) }, await body(req)));
  } catch (e) { return fail(e); }
}
