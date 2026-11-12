import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { setStatus } from "@/lib/nana-jobs-server";
import { me, njFail } from "@/lib/nana-jobs-api";

export const dynamic = "force-dynamic";

// POST { hash, status: interested | applied | not_for_me | null }. Only the member sets these; a run never overwrites them.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    await setStatus(getAdminDb(), await me(req), b.hash, b.status ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) { return njFail(err, "Couldn't save that"); }
}
