import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSeeker, setSeeker } from "@/lib/jobs-server";
import { jobsFail, signedIn } from "@/lib/jobs-api";

export const dynamic = "force-dynamic";

// The member's private Notes Jobs settings: "I need a job" (openToWork) and their city (used only to match jobs; never shown).
export async function GET(req: NextRequest) {
  try {
    const me = await signedIn(req, false);
    return NextResponse.json(await getSeeker(getAdminDb(), me.uid));
  } catch (err) {
    return jobsFail(err, "Couldn't load your job settings");
  }
}
export async function POST(req: NextRequest) {
  try {
    const me = await signedIn(req, false);
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await setSeeker(getAdminDb(), me.uid, b));
  } catch (err) {
    return jobsFail(err, "Couldn't save your job settings");
  }
}
