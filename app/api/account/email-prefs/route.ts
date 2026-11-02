import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { digestWanted, setDigestWanted } from "@/lib/digest-server";
import { booksReportWanted, setBooksReportWanted } from "@/lib/books-report-server";
import { getAnnouncementsWanted, setAnnouncementsWanted } from "@/lib/announcements-server";
import { reportWanted, setReportWanted } from "@/lib/referral-report-server";

export const dynamic = "force-dynamic";

// The member's email choices (emailPrefs/{uid}, server-only), each on unless switched off: the weekly digest, #NotesApp
// announcements (news to every member, lib/announcements-server.ts), the monthly referrals report and the monthly Business books
// summary. GET → { weeklyDigest, announcements, referralReport, booksReport }; POST with any of them.
async function uid(req: NextRequest) {
  return (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""))).uid;
}
async function prefs(id: string) {
  const db = getAdminDb();
  const [weeklyDigest, announcements, referralReport, booksReport] = await Promise.all([digestWanted(db, id), getAnnouncementsWanted(db, id), reportWanted(db, id), booksReportWanted(db, id)]);
  return { weeklyDigest, announcements, referralReport, booksReport };
}
export async function GET(req: NextRequest) {
  let id: string;
  try { id = await uid(req); } catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  return NextResponse.json(await prefs(id));
}
export async function POST(req: NextRequest) {
  let id: string;
  try { id = await uid(req); } catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const b = (await req.json().catch(() => ({}))) as { weeklyDigest?: unknown; announcements?: unknown; referralReport?: unknown; booksReport?: unknown };
  const set = (v: unknown) => typeof v === "boolean";
  if (!set(b.weeklyDigest) && !set(b.announcements) && !set(b.referralReport) && !set(b.booksReport)) return NextResponse.json({ error: "On or off?" }, { status: 400 });
  if (b.weeklyDigest !== undefined && !set(b.weeklyDigest)) return NextResponse.json({ error: "On or off?" }, { status: 400 });
  if (b.announcements !== undefined && !set(b.announcements)) return NextResponse.json({ error: "On or off?" }, { status: 400 });
  if (b.referralReport !== undefined && !set(b.referralReport)) return NextResponse.json({ error: "On or off?" }, { status: 400 });
  if (b.booksReport !== undefined && !set(b.booksReport)) return NextResponse.json({ error: "On or off?" }, { status: 400 });
  const db = getAdminDb();
  if (set(b.weeklyDigest)) await setDigestWanted(db, id, b.weeklyDigest as boolean);
  if (set(b.announcements)) await setAnnouncementsWanted(db, id, b.announcements as boolean);
  if (set(b.referralReport)) await setReportWanted(db, id, b.referralReport as boolean);
  if (set(b.booksReport)) await setBooksReportWanted(db, id, b.booksReport as boolean);
  return NextResponse.json(await prefs(id));
}
