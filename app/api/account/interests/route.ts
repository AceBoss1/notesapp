import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_INTERESTS, cleanTopics } from "@/lib/topics";

export const dynamic = "force-dynamic";

// A member's interests (users/{uid}.interests: topic slugs from lib/topics.ts, at most MAX_INTERESTS). Saved here, not by the
// browser, so only real topics are ever stored. GET → { interests }; POST { interests } → { interests }.
async function who(req: NextRequest) {
  return (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""))).uid;
}
export async function GET(req: NextRequest) {
  let uid: string;
  try { uid = await who(req); } catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const u = (await getAdminDb().doc(`users/${uid}`).get()).data();
  return NextResponse.json({ interests: cleanTopics(u?.interests, MAX_INTERESTS) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  let uid: string;
  try { uid = await who(req); } catch { return NextResponse.json({ error: "Sign in first." }, { status: 401 }); }
  const limited = await rateLimit(req, "interests", uid, 30, 60);
  if (limited) return limited;
  const b = (await req.json().catch(() => ({}))) as { interests?: unknown };
  if (!Array.isArray(b.interests)) return NextResponse.json({ error: "Which topics?" }, { status: 400 });
  const interests = cleanTopics(b.interests, MAX_INTERESTS);
  const ref = getAdminDb().doc(`users/${uid}`);
  if (!(await ref.get()).exists) return NextResponse.json({ error: "Finish setting up your profile first." }, { status: 404 });
  await ref.update({ interests, interestsAt: new Date().toISOString() });
  return NextResponse.json({ interests });
}
