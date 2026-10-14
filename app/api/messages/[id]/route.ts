import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getThread, isMuted, markRead, setMute } from "@/lib/messages-server";
import { bannedMembers, groupMembers } from "@/lib/groups-server";
import { authed, fail } from "@/lib/moments-api";
import { answerRequest, changeMessage, pinChat, pinMessage } from "@/lib/message-edits";
import { deleteObject, privateFilesConfigured } from "@/lib/private-files";

export const dynamic = "force-dynamic";

// GET → the messages in one conversation (and marks it read for you)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await authed(req, "messages");
    const db = getAdminDb();
    const t = await getThread(db, me.uid, params.id);
    const muted = await isMuted(db, me.uid, params.id);
    if (t.kind === "group" && t.group) {
      const isAdmin = t.group.adminUids.includes(me.uid);
      return NextResponse.json({ kind: "group", group: t.group, members: await groupMembers(db, t.group), banned: isAdmin ? await bannedMembers(db, t.group) : [], muted, messages: t.messages });
    }
    const u = (await db.doc(`users/${t.withUid}`).get()).data();
    const blockedByMe = (await db.doc(`dmBlocks/${me.uid}_${t.withUid}`).get()).exists;
    return NextResponse.json({ ...t, kind: "direct", blockedByMe, muted, with: { uid: t.withUid, username: u?.username ?? "", displayName: u?.displayName ?? "Member", avatar: u?.avatar ?? "" } });
  } catch (err) {
    return fail(err, "Couldn't load the conversation");
  }
}

// POST → marks the conversation read for you (the live view calls this as messages arrive); POST { action: "mute", muted } mutes or unmutes it for you;
// { action: "pin", messageId, pin } pins a message (3 at most); { action: "pin_chat", pin } pins the chat in your inbox (3 at most);
// { action: "edit", messageId, text } / { action: "delete", messageId } changes your own message (asks the readers once it's read);
// { action: "request", requestId, answer: "allow" | "decline" | "withdraw" } answers such a request.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await authed(req, "messages");
    const body = await req.json().catch(() => ({}));
    if (body.action === "mute") { await setMute(getAdminDb(), me.uid, params.id, body.muted === true); return NextResponse.json({ ok: true }); }
    const del = privateFilesConfigured() ? deleteObject : undefined;
    if (body.action === "pin") return NextResponse.json(await pinMessage(getAdminDb(), me.uid, params.id, String(body.messageId ?? ""), body.pin !== false));
    if (body.action === "pin_chat") return NextResponse.json(await pinChat(getAdminDb(), me.uid, params.id, body.pin !== false));
    if (body.action === "edit" || body.action === "delete") return NextResponse.json(await changeMessage(getAdminDb(), me.uid, params.id, String(body.messageId ?? ""), body.action, body.text, del));
    if (body.action === "request") return NextResponse.json(await answerRequest(getAdminDb(), me.uid, String(body.requestId ?? ""), body.answer === "allow" ? "allow" : body.answer === "withdraw" ? "withdraw" : "decline", del));
    await markRead(getAdminDb(), me.uid, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't update the conversation");
  }
}
