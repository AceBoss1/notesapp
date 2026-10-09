import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { MessageError } from "@/lib/messages-server";
import { addGroupMembers, removeGroupMember, renameGroup, setGroupAdmin } from "@/lib/groups-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// POST { action: "rename", title } | { action: "add", usernames } | { action: "remove", uid } (an admin removes someone) | { action: "leave" } |
// { action: "admin", uid, admin: boolean }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await authed(req, "messages", true);
    const limited = rateLimit(req, "group-edit", me.uid, 30, 600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    switch (body.action) {
      case "rename": await renameGroup(db, me.uid, params.id, body.title); break;
      case "add": {
        const names: string[] = (Array.isArray(body.usernames) ? body.usernames : []).map((n: unknown) => String(n).trim().replace(/^@/, "").toLowerCase()).filter(Boolean).slice(0, 60);
        const docs = names.length ? await db.getAll(...names.map((n) => db.doc(`usernames/${n}`))) : [];
        if (docs.some((d) => !d.exists)) throw new MessageError(404, "One of those usernames wasn't found.");
        await addGroupMembers(db, me.uid, params.id, docs.map((d) => String(d.data()?.uid)));
        break;
      }
      case "remove": await removeGroupMember(db, me.uid, params.id, String(body.uid ?? "")); break;
      case "leave": await removeGroupMember(db, me.uid, params.id, me.uid); break;
      case "admin": await setGroupAdmin(db, me.uid, params.id, String(body.uid ?? ""), body.admin === true); break;
      default: throw new MessageError(400, "Unknown action.");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't update the group");
  }
}
