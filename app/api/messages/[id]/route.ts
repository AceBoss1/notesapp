import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getThread, markRead } from "@/lib/messages-server";
import { groupMembers } from "@/lib/groups-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET → the messages in one conversation (and marks it read for you)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await authed(req, "messages");
    const db = getAdminDb();
    const t = await getThread(db, me.uid, params.id);
    if (t.kind === "group" && t.group) return NextResponse.json({ kind: "group", group: t.group, members: await groupMembers(db, t.group), messages: t.messages });
    const u = (await db.doc(`users/${t.withUid}`).get()).data();
    const blockedByMe = (await db.doc(`dmBlocks/${me.uid}_${t.withUid}`).get()).exists;
    return NextResponse.json({ ...t, kind: "direct", blockedByMe, with: { uid: t.withUid, username: u?.username ?? "", displayName: u?.displayName ?? "Member", avatar: u?.avatar ?? "" } });
  } catch (err) {
    return fail(err, "Couldn't load the conversation");
  }
}

// POST → marks the conversation read for you (the live view calls this as messages arrive)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await authed(req, "messages");
    await markRead(getAdminDb(), me.uid, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't update the conversation");
  }
}
