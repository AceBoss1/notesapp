import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { cleanKv } from "@/lib/arcade/progress";
import { saveProgress } from "@/lib/arcade/boards-server";

export const dynamic = "force-dynamic";

// A signed-in member's Notes Arcade progress (wins, records, choices). GET → { kv }; POST { kv } → merges and returns { kv }.
// Guests never call this: their progress lives only in the page and starts afresh on reload (lib/arcade/store.ts).
// Each save also moves the per-game leaderboards it touches (lib/arcade/boards-server.ts saveProgress), in the same transaction.
async function who(req: NextRequest) {
  return verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
}

export async function GET(req: NextRequest) {
  const me = await who(req);
  if (!me) return NextResponse.json({ error: "Sign in to load your Arcade progress." }, { status: 401 });
  const limited = await rateLimit(req, "arcade-progress-get", me.uid, 60, 60);
  if (limited) return limited;
  const snap = await getAdminDb().doc(`arcadeProgress/${me.uid}`).get();
  return NextResponse.json({ kv: cleanKv(snap.get("kv")) });
}

export async function POST(req: NextRequest) {
  const me = await who(req);
  if (!me) return NextResponse.json({ error: "Sign in to save your Arcade progress." }, { status: 401 });
  const limited = await rateLimit(req, "arcade-progress-post", me.uid, 120, 60);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const update = cleanKv(body?.kv);
  if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const kv = await saveProgress(getAdminDb(), me.uid, update);
  return NextResponse.json({ kv });
}
