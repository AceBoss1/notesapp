import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { MessageError } from "@/lib/messages-server";
import { createGroup } from "@/lib/groups-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// POST { title, usernames: string[] } → { id }: a member starts a group with people they follow or who follow them. (Team rooms are made
// from the team hub, never here.)
export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "messages", true);
    const limited = rateLimit(req, "group-create", me.uid, 5, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    const names: string[] = (Array.isArray(body.usernames) ? body.usernames : []).map((n: unknown) => String(n).trim().replace(/^@/, "").toLowerCase()).filter(Boolean).slice(0, 60);
    const docs = names.length ? await db.getAll(...names.map((n) => db.doc(`usernames/${n}`))) : [];
    if (docs.some((d) => !d.exists)) throw new MessageError(404, "One of those usernames wasn't found.");
    const memberUids = docs.map((d) => String(d.data()?.uid));
    return NextResponse.json(await createGroup(db, me.uid, { title: body.title, memberUids, scope: "public" }));
  } catch (err) {
    return fail(err, "Couldn't create the group");
  }
}
