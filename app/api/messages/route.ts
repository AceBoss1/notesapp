import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";
import { privateBucket, privateFilesConfigured } from "@/lib/private-files";
import { MessageError, listConversations, sendMessage } from "@/lib/messages-server";
import { MESSAGES_PER_MINUTE } from "@/lib/messages-rules";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// Checks a sent file really is in the private bucket, and how big it is.
async function headPrivate(key: string): Promise<{ size: number } | null> {
  try { return { size: Number((await getR2Client().send(new HeadObjectCommand({ Bucket: privateBucket(), Key: key }))).ContentLength || 0) }; } catch { return null; }
}

// GET → your conversations, newest first, with the other member's name and picture
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "messages");
    const db = getAdminDb();
    const rows = await listConversations(db, me.uid);
    if (new URL(req.url).searchParams.get("unread") === "1") return NextResponse.json({ unread: rows.reduce((n, r) => n + r.unread, 0) });
    const users = await db.getAll(...rows.map((r) => db.doc(`users/${r.withUid}`)));
    const byUid = new Map(users.map((u) => [u.id, u.data()]));
    return NextResponse.json({
      conversations: rows.map((r) => {
        const u = byUid.get(r.withUid);
        return { ...r, with: { uid: r.withUid, username: u?.username ?? "", displayName: u?.displayName ?? "Member", avatar: u?.avatar ?? "" } };
      }),
    });
  } catch (err) {
    return fail(err, "Couldn't load messages");
  }
}

// POST { toUid? , toUsername?, text, attachmentIds?, sticker?, replyToId? }
export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "messages", true);
    const limited = rateLimit(req, "dm", me.uid, MESSAGES_PER_MINUTE, 60);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    let toUid = String(body.toUid ?? "");
    if (!toUid && body.toUsername) {
      const name = (await db.doc(`usernames/${String(body.toUsername).toLowerCase()}`).get()).data();
      toUid = String(name?.uid ?? "");
    }
    if (!toUid) throw new MessageError(404, "That member wasn't found.");
    return NextResponse.json(await sendMessage(db, me.uid, toUid, { text: String(body.text ?? ""), attachmentIds: Array.isArray(body.attachmentIds) ? body.attachmentIds : [], sticker: body.sticker ? String(body.sticker) : undefined, replyToId: body.replyToId ? String(body.replyToId) : undefined }, new Date(), undefined, undefined, privateFilesConfigured() ? { head: headPrivate } : undefined));
  } catch (err) {
    return fail(err, "Couldn't send the message");
  }
}
