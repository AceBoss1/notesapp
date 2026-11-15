import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getState, saveSetup } from "@/lib/nana-jobs-server";
import { me, njFail, noStore } from "@/lib/nana-jobs-api";
import { firstValue } from "@/lib/growth-server";

export const dynamic = "force-dynamic";

// Nana Jobs (/jobs/nana). GET → the member's set-up, connected AIs (last four characters only), CV review and latest shortlist.
// POST { profile?, settings?, step?: "sources" | "when", finish?: true } saves any part of the set-up and returns the new state.
export async function GET(req: NextRequest) {
  try {
    const uid = await me(req);
    const s = await getState(getAdminDb(), uid);
    if (s.run?.jobs?.length) await firstValue(getAdminDb(), uid, "shortlist"); // growth: a shortlist seen is a job-seeker's first value
    return NextResponse.json(s, noStore);
  }
  catch (err) { return njFail(err, "Couldn't load Nana Jobs"); }
}
export async function POST(req: NextRequest) {
  try {
    const uid = await me(req);
    const db = getAdminDb();
    await saveSetup(db, uid, await req.json().catch(() => ({})));
    return NextResponse.json(await getState(db, uid), noStore);
  } catch (err) { return njFail(err, "Couldn't save that"); }
}
