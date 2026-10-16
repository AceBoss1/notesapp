import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { digestWanted, setDigestWanted } from "@/lib/digest-server";

export const dynamic = "force-dynamic";

// The member's email choices (emailPrefs/{uid}, server-only): for now, the weekly digest. GET → { weeklyDigest }; POST { weeklyDigest }.
async function uid(req: NextRequest) {
  return (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""))).uid;
}
export async function GET(req: NextRequest) {
  try { return NextResponse.json({ weeklyDigest: await digestWanted(getAdminDb(), await uid(req)) }); }
  catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
}
export async function POST(req: NextRequest) {
  let id: string;
  try { id = await uid(req); } catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const b = (await req.json().catch(() => ({}))) as { weeklyDigest?: unknown };
  if (typeof b.weeklyDigest !== "boolean") return NextResponse.json({ error: "On or off?" }, { status: 400 });
  await setDigestWanted(getAdminDb(), id, b.weeklyDigest);
  return NextResponse.json({ weeklyDigest: b.weeklyDigest });
}
