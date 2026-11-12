import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { connectProvider, disconnectProvider } from "@/lib/ai-connect";
import { assertAllowed } from "@/lib/nana-jobs-server";
import { me, njFail, noStore } from "@/lib/nana-jobs-api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Connect your AI for Nana Jobs. POST { provider: gemini | groq | anthropic | openai, key, baseUrl?, model? }: the key is checked with a free
// call, kept encrypted, and only its last four characters come back. DELETE ?provider= removes it. An Anthropic key is the same one Nana uses.
export async function POST(req: NextRequest) {
  try {
    const uid = await me(req);
    const limited = await rateLimit(req, "ai-connect", uid, 8, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    await assertAllowed(db, uid);
    const b = await req.json().catch(() => ({}));
    return NextResponse.json({ providers: await connectProvider(db, uid, b.provider, b) }, noStore);
  } catch (err) { return njFail(err, "Couldn't connect that AI"); }
}
export async function DELETE(req: NextRequest) {
  try {
    const uid = await me(req);
    return NextResponse.json({ providers: await disconnectProvider(getAdminDb(), uid, req.nextUrl.searchParams.get("provider")) }, noStore);
  } catch (err) { return njFail(err, "Couldn't remove it"); }
}
