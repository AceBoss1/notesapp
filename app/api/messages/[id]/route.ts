import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getThread } from "@/lib/messages-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET → the messages in one conversation (and marks it read for you)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await authed(req, "messages");
    const db = getAdminDb();
    const t = await getThread(db, me.uid, params.id);
    const u = (await db.doc(`users/${t.withUid}`).get()).data();
    const blockedByMe = (await db.doc(`dmBlocks/${me.uid}_${t.withUid}`).get()).exists;
    return NextResponse.json({ ...t, blockedByMe, with: { uid: t.withUid, username: u?.username ?? "", displayName: u?.displayName ?? "Member", avatar: u?.avatar ?? "" } });
  } catch (err) {
    return fail(err, "Couldn't load the conversation");
  }
}
