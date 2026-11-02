import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { digestWanted, setDigestWanted } from "@/lib/digest-server";
import { booksReportWanted, setBooksReportWanted } from "@/lib/books-report-server";

export const dynamic = "force-dynamic";

// The member's email choices (emailPrefs/{uid}, server-only), each on unless switched off: the weekly digest and the monthly Business
// books summary. GET → { weeklyDigest, booksReport }; POST with either or both.
async function uid(req: NextRequest) {
  return (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""))).uid;
}
async function prefs(id: string) {
  const db = getAdminDb();
  const [weeklyDigest, booksReport] = await Promise.all([digestWanted(db, id), booksReportWanted(db, id)]);
  return { weeklyDigest, booksReport };
}
export async function GET(req: NextRequest) {
  let id: string;
  try { id = await uid(req); } catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  return NextResponse.json(await prefs(id));
}
export async function POST(req: NextRequest) {
  let id: string;
  try { id = await uid(req); } catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const b = (await req.json().catch(() => ({}))) as { weeklyDigest?: unknown; booksReport?: unknown };
  const set = (v: unknown) => typeof v === "boolean";
  if (!set(b.weeklyDigest) && !set(b.booksReport)) return NextResponse.json({ error: "On or off?" }, { status: 400 });
  if ((b.weeklyDigest !== undefined && !set(b.weeklyDigest)) || (b.booksReport !== undefined && !set(b.booksReport))) return NextResponse.json({ error: "On or off?" }, { status: 400 });
  const db = getAdminDb();
  if (set(b.weeklyDigest)) await setDigestWanted(db, id, b.weeklyDigest as boolean);
  if (set(b.booksReport)) await setBooksReportWanted(db, id, b.booksReport as boolean);
  return NextResponse.json(await prefs(id));
}
