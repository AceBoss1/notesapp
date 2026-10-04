import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { ApiAuth } from "@/lib/api-keys";
import { byNewest, fail, paginate, parsePostBody, rowsOf, postJson, v1 } from "@/lib/api-v1";
import { slugify } from "@/lib/firestore-notes";
import { roleLabelFor } from "@/lib/users";
import { emitWebhook } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

export const GET = v1("read:posts", async (req, { uid }) => {
  const status = req.nextUrl.searchParams.get("status");
  const snap = await getAdminDb().collection("notes").where("authorUid", "==", uid).limit(1000).get();
  const rows = rowsOf(snap)
    .filter((n) => !status || n.status === status)
    .sort(byNewest("date"));
  const page = paginate(req, rows);
  return NextResponse.json({ data: page.data.map((n) => postJson(n.id, n)), next_cursor: page.next_cursor });
});

// Create a post as the key's owner. Drafts by default. Send an `Idempotency-Key` header to make retries safe.
export const POST = v1("write:posts", async (req: NextRequest, auth: ApiAuth) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") throw fail(400, "invalid_request", "Send a JSON body.");
  const fields = parsePostBody(body, false);
  const db = getAdminDb();
  const idem = req.headers.get("idempotency-key")?.slice(0, 200);
  const idemRef = idem ? db.doc(`apiIdempotency/${auth.keyId}_${createHash("sha256").update(idem).digest("hex").slice(0, 32)}`) : null;
  if (idemRef) {
    const prev = (await idemRef.get()).data();
    if (prev?.postId) {
      const n = (await db.doc(`notes/${prev.postId}`).get()).data();
      if (n) return NextResponse.json(postJson(prev.postId, n, true), { status: 200, headers: { "Idempotent-Replay": "true" } });
    }
  }
  const u = auth.user;
  let slug = slugify(String(fields.title)) || "post";
  if (!(await db.collection("notes").where("slug", "==", slug).limit(1).get()).empty) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  const note = {
    viewCount: 0, likeCount: 0, shareCount: 0,
    slug, title: fields.title, date: new Date().toISOString(), categories: [], tags: [], featured_image: "", content: fields.content,
    author: u.displayName, author_role: roleLabelFor(u as never), author_avatar: u.avatar || "",
    authorUid: auth.uid, authorUsername: u.username, status: "draft", ...fields,
  } as Record<string, any>;
  const ref = await db.collection("notes").add(note);
  if (idemRef) await idemRef.set({ postId: ref.id, at: new Date().toISOString(), expireAt: new Date(Date.now() + 86_400_000) });
  if (note.status === "published") void emitWebhook(auth.uid, "post.published", postJson(ref.id, note));
  return NextResponse.json(postJson(ref.id, note, true), { status: 201 });
});
