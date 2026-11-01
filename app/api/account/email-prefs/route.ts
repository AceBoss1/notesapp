import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { digestWanted, setDigestWanted } from "@/lib/digest-server";
import { getAnnouncementsWanted, setAnnouncementsWanted } from "@/lib/announcements-server";

export const dynamic = "force-dynamic";

// The member's email choices (emailPrefs/{uid}, server-only): the weekly digest and #NotesApp announcements (news to every member,
// lib/announcements-server.ts). GET → { weeklyDigest, announcements }; POST { weeklyDigest?, announcements? }.
async function uid(req: NextRequest) {
  return (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""))).uid;
}
async function both(id: string) {
  const db = getAdminDb();
  const [weeklyDigest, announcements] = await Promise.all([digestWanted(db, id), getAnnouncementsWanted(db, id)]);
  return { weeklyDigest, announcements };
}
export async function GET(req: NextRequest) {
  try { return NextResponse.json(await both(await uid(req))); }
  catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
}
export async function POST(req: NextRequest) {
  let id: string;
  try { id = await uid(req); } catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const b = (await req.json().catch(() => ({}))) as { weeklyDigest?: unknown; announcements?: unknown };
  if (typeof b.weeklyDigest !== "boolean" && typeof b.announcements !== "boolean") return NextResponse.json({ error: "On or off?" }, { status: 400 });
  if (typeof b.weeklyDigest === "boolean") await setDigestWanted(getAdminDb(), id, b.weeklyDigest);
  if (typeof b.announcements === "boolean") await setAnnouncementsWanted(getAdminDb(), id, b.announcements);
  return NextResponse.json(await both(id));
}
