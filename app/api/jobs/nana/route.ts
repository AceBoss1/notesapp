import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getState, saveSetup } from "@/lib/nana-jobs-server";
import { me, njFail, noStore } from "@/lib/nana-jobs-api";

export const dynamic = "force-dynamic";

// Nana Jobs (/jobs/nana). GET → the member's set-up, connected AIs (last four characters only), CV review and latest shortlist.
// POST { profile?, settings?, step?: "sources" | "when", finish?: true } saves any part of the set-up and returns the new state.
export async function GET(req: NextRequest) {
  try { return NextResponse.json(await getState(getAdminDb(), await me(req)), noStore); }
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
