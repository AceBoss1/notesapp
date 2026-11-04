import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { AccessError, getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { isSuper } from "@/lib/admin-access";
import { StaffPassError, getStaffPass, saveStaffPass, staffPassLog } from "@/lib/staff-pass-server";
import { passActive } from "@/lib/staff-pass";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// The staff test pass (lib/staff-pass.ts), super admins only: GET → { pass, active, log }; POST { on, until? } → turns it on until then
// (7 days by default, at most 30) or off. Every change is logged in staffPassLog with who made it.
async function superCaller(req: NextRequest) {
  const a = await verifyAdminAccess(bearer(req));
  if (!isSuper(a.access)) throw new AccessError("Your role doesn't include this area");
  return a;
}
const fail = (err: unknown, fallback: string) => {
  if (err instanceof StaffPassError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

export async function GET(req: NextRequest) {
  try {
    await superCaller(req);
    const db = getAdminDb();
    const pass = await getStaffPass(db, 0);
    return NextResponse.json({ pass, active: passActive(pass), log: await staffPassLog(db) });
  } catch (err) {
    return fail(err, "Couldn't load the staff test pass");
  }
}

export async function POST(req: NextRequest) {
  try {
    const a = await superCaller(req);
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    const pass = await saveStaffPass(db, { uid: a.uid, email: a.email, super: true }, body);
    return NextResponse.json({ pass, active: passActive(pass), log: await staffPassLog(db) });
  } catch (err) {
    return fail(err, "Couldn't save the staff test pass");
  }
}
