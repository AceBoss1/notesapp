import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  CommunityError, addComment, communitiesIRun, createCircle, createCommunity, createPost, decide, directory, insights, join, leave, like, listCircles,
  listComments, listMembers, listPosts, pinPost, removeComment, removeMember, removePost, rotateInvite, setCircleMembers, setRole, unban,
  updateSettings, viewCommunity,
} from "@/lib/community-server";

export const dynamic = "force-dynamic";
const viewer = async (req: NextRequest) => (await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null))?.uid ?? null;
const fail = (err: unknown, what: string) => {
  if (err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, what);
  return NextResponse.json({ error: f.message }, { status: f.status });
};
const ok = (body: unknown) => NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });

// Communities (lib/community-server.ts). Signed out is fine for what non-members may see; `as` is an admin's "View as".
//   GET                       → { communities }: the directory, with my status in each
//   GET ?id=                  → the community as this person (or `as`) sees it: details, role, tabs, channels
//   GET ?id=&posts=<channel>  → { posts }
//   GET ?comments=<postId>    → { comments }
//   GET ?id=&members=active|pending|banned → { members }
//   GET ?id=&insights=1 · ?id=&circles=1 · ?run=1 → { communities } I own or help run (for linking one to my site)
export async function GET(req: NextRequest) {
  try {
    const uid = await viewer(req);
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    const id = q.get("id") ?? "", as = q.get("as") ?? undefined;
    if (q.get("run")) return ok({ communities: uid ? await communitiesIRun(db, uid) : [] });
    if (q.get("comments")) return ok({ comments: await listComments(db, uid, q.get("comments")!, as) });
    if (!id) return ok({ communities: await directory(db, uid) });
    if (q.get("posts")) return ok(await listPosts(db, uid, id, q.get("posts")!, as));
    if (q.get("members")) return ok({ members: await listMembers(db, uid, id, as, q.get("members") as "active" | "pending" | "banned") });
    if (q.get("insights")) { if (!uid) return ok({ error: "Sign in first." }); return ok({ insights: await insights(db, uid, id) }); }
    if (q.get("circles")) { if (!uid) return ok({ circles: [] }); return ok({ circles: await listCircles(db, uid, id) }); }
    return ok(await viewCommunity(db, id, uid, as));
  } catch (err) {
    return fail(err, "Couldn't load the community");
  }
}

// POST { action, … } (signed in): create · settings · invite_rotate · join · leave · decide · role · remove · ban · unban · post ·
// remove_post · pin · like · comment · remove_comment · circle · circle_members
export async function POST(req: NextRequest) {
  try {
    const uid = await viewer(req);
    if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "community", uid, 600, 3600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    const id = String(b.id ?? "");
    switch (b.action) {
      case "create": return ok({ community: await createCommunity(db, uid, b) });
      case "settings": return ok({ community: await updateSettings(db, uid, id, b.settings) });
      case "invite_rotate": return ok({ inviteCode: await rotateInvite(db, uid, id) });
      case "join": return ok({ member: await join(db, uid, id, b) });
      case "leave": await leave(db, uid, id); return ok({ ok: true });
      case "decide": await decide(db, uid, id, String(b.uid), b.approve === true); return ok({ ok: true });
      case "role": await setRole(db, uid, id, String(b.uid), b.role); return ok({ ok: true });
      case "remove": await removeMember(db, uid, id, String(b.uid), false); return ok({ ok: true });
      case "ban": await removeMember(db, uid, id, String(b.uid), true); return ok({ ok: true });
      case "unban": await unban(db, uid, id, String(b.uid)); return ok({ ok: true });
      case "post": return ok({ post: await createPost(db, uid, id, String(b.channel ?? ""), b) });
      case "remove_post": await removePost(db, uid, String(b.postId)); return ok({ ok: true });
      case "pin": await pinPost(db, uid, String(b.postId), b.pinned === true); return ok({ ok: true });
      case "like": await like(db, uid, String(b.postId), b.on === true); return ok({ ok: true });
      case "comment": return ok({ comment: await addComment(db, uid, String(b.postId), b.text) });
      case "remove_comment": await removeComment(db, uid, String(b.commentId)); return ok({ ok: true });
      case "circle": return ok({ circle: await createCircle(db, uid, id, b) });
      case "circle_members": await setCircleMembers(db, uid, id, String(b.circleId), b.memberUids); return ok({ ok: true });
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}
