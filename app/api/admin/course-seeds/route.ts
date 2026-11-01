import { NextRequest, NextResponse } from "next/server";
import { AccessError, getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { isSuper } from "@/lib/admin-access";
import { SEED_OWNER_USERNAME, SEED_PROGRESS_NOTE } from "@/lib/course-seeds";
import { SeedError, planSeeds, seedCourses } from "@/lib/course-seeds-server";

export const dynamic = "force-dynamic";

// Admin → Academy, "Seed courses": the owner's two prepared courses (lib/course-seeds.ts), written as @emmanuel's.
// GET → { owner, plans, note }: the dry run (what each seed will create or rewrite). POST { key, confirm: true } → { result }.
// Super admins and the owner only: it writes courses on a member's behalf.
async function owner(req: NextRequest) {
  const a = await verifyAdminAccess(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  if (!isSuper(a.access) && !a.owner) throw new SeedError("Only super admins can seed courses.", 403);
  return a;
}
const fail = (e: unknown) => {
  if (e instanceof SeedError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof AccessError || String((e as { code?: unknown })?.code ?? "").startsWith("auth/")) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  console.error("[course seeds]", e);
  return NextResponse.json({ error: "Couldn't seed the course; its lessons weren't changed. Try again." }, { status: 500 });
};

export async function GET(req: NextRequest) {
  try {
    await owner(req);
    return NextResponse.json({ owner: SEED_OWNER_USERNAME, plans: await planSeeds(getAdminDb()), note: SEED_PROGRESS_NOTE }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    await owner(req);
    const b = (await req.json().catch(() => ({}))) as { key?: unknown; confirm?: unknown };
    if (b.confirm !== true) return NextResponse.json({ error: "Check what will change first, then confirm." }, { status: 400 });
    const [result] = await seedCourses(getAdminDb(), SEED_OWNER_USERNAME, new Date(), { only: String(b.key ?? "") });
    return NextResponse.json({ result });
  } catch (e) { return fail(e); }
}
