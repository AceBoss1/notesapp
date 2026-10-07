import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { MessageError } from "@/lib/messages-server";
import type { MessageAttachment } from "@/lib/messages-rules";
import { presignGet, privateFilesConfigured } from "@/lib/private-files";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET ?cid=&mid=&i=0[&download=1] → { url, name, kind, type }: a short-lived link to one file in a message, for the two people in the
// conversation only. Pictures and videos open in the page; download=1 (or a document) saves the file.
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "messages");
    const q = req.nextUrl.searchParams;
    const db = getAdminDb();
    const conv = (await db.doc(`conversations/${q.get("cid") ?? "-"}`).get()).data();
    if (!conv || !(conv.participants as string[]).includes(me.uid)) throw new MessageError(404, "That file wasn't found.");
    const msg = (await db.doc(`conversations/${q.get("cid")}/messages/${q.get("mid") ?? "-"}`).get()).data();
    const a = (msg?.attachments as MessageAttachment[] | undefined)?.[Number(q.get("i") ?? 0)];
    if (!a) throw new MessageError(404, "That file wasn't found.");
    if (!privateFilesConfigured()) throw new MessageError(503, "Files aren't available right now.");
    const inline = q.get("download") !== "1" && a.kind !== "document";
    return NextResponse.json({ url: await presignGet(a.key, a.name, a.type, inline), name: a.name, kind: a.kind, type: a.type });
  } catch (err) {
    return fail(err, "Couldn't open the file");
  }
}
