import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { NanaError } from "@/lib/nana";
import { chat } from "@/lib/nana-server";
import { hubContextFor } from "@/lib/nana-hub";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { messages: [{role, content}], chatId?, name?, email?, page?, context? } → { reply, chatId, handoff, gap, mode, via, notice? }.
// Signed-in members are recognised from their sign-in (name and email come from the account); visitors must send a name and email.
// context "hub" is for staff inside the team hub: it needs an admin sign-in and adds the team-only knowledge and that person's open work.
// mode says whether the AI wrote the reply ("ai") or the knowledge base did ("kb"); with no AI available Nana still answers.
export async function POST(req: NextRequest) {
  try {
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

    let hubContext: string | undefined;
    if (body.context === "hub") {
      const me = await verifyAdminAccess(token); // throws unless this is a signed-in staff member
      hubContext = await hubContextFor(db, me.uid, signedIn?.name || me.email);
    }
    return NextResponse.json(await chat(db, { chatId: body.chatId, name: body.name, email: body.email, messages: body.messages, page: body.page, signedIn, hubContext }), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NanaError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't reach Nana");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
