import { NextResponse } from "next/server";
import { gateJournal } from "@/lib/content-checks-server";
import { isContentCheckError } from "@/lib/content-checks";
import { getAdminDb } from "@/lib/firebase-admin";
import { fail, parsePostBody, postJson, v1 } from "@/lib/api-v1";
import { emitWebhook } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

async function ownPost(id: string, uid: string) {
  const ref = getAdminDb().doc(`notes/${id}`);
  const n = (await ref.get()).data();
  // Someone else's post looks the same as a missing one.
  if (!n || n.authorUid !== uid) throw fail(404, "not_found", "No post with that id on this account.");
  return { ref, n };
}

export const GET = v1("read:posts", async (_req, { uid }, { params }) => {
  const { n } = await ownPost(params.id, uid);
  return NextResponse.json(postJson(params.id, n, true));
});

// Edit your own post, or publish / unpublish it with `status`.
export const PATCH = v1("write:posts", async (req, { uid }, { params }) => {
  const { ref, n } = await ownPost(params.id, uid);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") throw fail(400, "invalid_request", "Send a JSON body.");
  const fields = parsePostBody(body, true);
  if (!Object.keys(fields).length) throw fail(400, "invalid_request", "Nothing to change.");
  const next = { ...n, ...fields };
  // AI content checks: publishing, or changing a published post's words or picture, is checked first; if it breaks the rules the post
  // is saved as a draft.
  const changed = ["title", "content", "featured_image"].some((k) => k in fields && fields[k as keyof typeof fields] !== n[k]);
  if (next.status === "published" && (n.status !== "published" || changed)) {
    try { await gateJournal(getAdminDb(), uid, next, ref.path); }
    catch (e) {
      if (!isContentCheckError(e)) throw e;
      await ref.update({ ...fields, status: "draft" });
      throw fail(422, "content_blocked", `${e.message} It was saved as a draft.`);
    }
  }
  await ref.update(fields);
  if (n.status !== "published" && next.status === "published") void emitWebhook(uid, "post.published", postJson(params.id, next));
  return NextResponse.json(postJson(params.id, next, true));
});
