import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { cleanKv, mergeKv } from "@/lib/arcade/progress";

export const dynamic = "force-dynamic";

// A signed-in member's Notes Arcade progress (wins, records, choices). GET → { kv }; POST { kv } → merges and returns { kv }.
// Guests never call this: their progress lives only in the page and starts afresh on reload (lib/arcade/store.ts).
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
  const db = getAdminDb();
  const ref = db.doc(`arcadeProgress/${me.uid}`);
  const kv = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const merged = mergeKv(cleanKv(snap.get("kv")), update).kv;
    tx.set(ref, { kv: merged, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
    return merged;
  });
  return NextResponse.json({ kv });
}
