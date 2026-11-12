import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { addCompany, removeCompany } from "@/lib/nana-jobs-server";
import { liveDeps, me, njFail, noStore } from "@/lib/nana-jobs-api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Companies you're watching. POST { name }: we check whether it has a public Greenhouse, Lever or Ashby board before adding it.
// DELETE ?name= stops watching it.
export async function POST(req: NextRequest) {
  try {
    const uid = await me(req);
    const limited = await rateLimit(req, "nana-jobs-company", uid, 30, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json({ companies: await addCompany(getAdminDb(), uid, b.name, liveDeps()) }, noStore);
  } catch (err) { return njFail(err, "Couldn't check that company"); }
}
export async function DELETE(req: NextRequest) {
  try { return NextResponse.json({ companies: await removeCompany(getAdminDb(), await me(req), req.nextUrl.searchParams.get("name")) }, noStore); }
  catch (err) { return njFail(err, "Couldn't remove it"); }
}
