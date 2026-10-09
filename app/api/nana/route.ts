import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { NanaError } from "@/lib/nana";
import { chat, nanaConfigured } from "@/lib/nana-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { messages: [{role, content}], chatId?, name?, email?, page? } → { reply, chatId, handoff, gap }.
// Signed-in members are recognised from their sign-in (name and email come from the account); visitors must send a name and email.
export async function POST(req: NextRequest) {
  try {
    if (!nanaConfigured()) return NextResponse.json({ error: "Nana isn't switched on yet. Please use the contact page." }, { status: 503 });
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();

    let signedIn: { uid: string; name: string; email: string } | null = null;
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const d = await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null);
      if (d) {
        const profile = (await db.doc(`users/${d.uid}`).get()).data();
        signedIn = { uid: d.uid, email: d.email || "", name: String(profile?.displayName || d.name || "") };
      }
    }
    // Per person and per address, so one visitor can't use up everyone's share.
    const who = signedIn?.uid ?? String(body.email ?? "").toLowerCase().slice(0, 100);
    const limited = rateLimit(req, "nana", `${clientIp(req)}:${who}`, 14, 600) ?? rateLimit(req, "nana-ip", clientIp(req), 60, 3600);
    if (limited) return limited;

    return NextResponse.json(await chat(db, { chatId: body.chatId, name: body.name, email: body.email, messages: body.messages, page: body.page, signedIn }), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NanaError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't reach Nana");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
