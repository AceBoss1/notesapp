import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { canActForSeller } from "@/lib/orders-server";
import { cleanText } from "@/lib/orders";
import { deleteObject, headObject, presignUpload, privateFilesConfigured, safeFileName } from "@/lib/private-files";
import { DIGITAL_MAX_BYTES } from "@/lib/private-files-config";
import { rateLimit } from "@/lib/rate-limit";
import { STREAM_MAX_BYTES, createDirectUpload, deleteVideo, getVideo, streamConfigured } from "@/lib/stream";
import { MAX_LESSONS } from "@/lib/store";
import { canSellViewOnly } from "@/lib/tiers";
import { effectiveTier } from "@/lib/users";
import { StoredLesson, publicLesson } from "@/lib/view-access";

export const dynamic = "force-dynamic";
class Fail extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// The seller builds a view-only item's lessons (video on Cloudflare Stream, PDF in the private bucket). Pro and above.
//   { action: "start",  itemId, kind: "video"|"pdf", title, filename?, size? }  → { lessonId, uploadUrl, uid?|key? }
//   { action: "finish", itemId, lessonId, kind, title, uid?|key?, size? }       → { lessons }
//   { action: "rename" | "move" | "remove", itemId, lessonId, title? | dir? }   → { lessons }
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "lessons", user.uid, 120, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    const itemRef = db.doc(`storeItems/${String(body.itemId || "")}`);
    const item = (await itemRef.get()).data();
    if (!item || item.kind !== "digital") throw new Fail("Digital item not found.", 404);
    if (!(await canActForSeller(user.uid, String(item.ownerUid)))) throw new Fail("Not your store.", 403);
    if (item.access !== "view") throw new Fail("This item is a plain download. Add a new item and choose “View only” to sell lessons.", 409);
    if (item.fileName) throw new Fail("This item already has a downloadable file.", 409);
    const owner = (await db.doc(`users/${item.ownerUid}`).get()).data();
    if (!owner || !canSellViewOnly(effectiveTier({ username: owner.username ?? "", role: owner.role ?? "reader", accountTier: owner.accountTier ?? "standard" }))) {
      throw new Fail("View-only items and courses are on the Pro plan and above.", 403);
    }
    const fileRef = db.doc(`storeFiles/${itemRef.id}`);
    const lessons = (((await fileRef.get()).data()?.lessons as StoredLesson[] | undefined) ?? []).slice();
    const save = async (next: StoredLesson[]) => {
      await fileRef.set({ ownerUid: item.ownerUid, access: "view", lessons: next, updatedAt: new Date().toISOString() });
      await itemRef.update({ lessons: next.map(publicLesson), lessonCount: next.length, updatedAt: new Date().toISOString() });
      return next.map(publicLesson);
    };
    const title = cleanText(String(body.title || ""), 120);
    const action = String(body.action);

    if (action === "start") {
      if (lessons.length >= MAX_LESSONS) throw new Fail(`A course can have up to ${MAX_LESSONS} lessons.`, 409);
      const size = Number(body.size);
      const lessonId = randomBytes(6).toString("hex");
      if (body.kind === "video") {
        if (!streamConfigured()) throw new Fail("Video hosting isn't set up yet.", 503);
        if (Number.isFinite(size) && size > STREAM_MAX_BYTES) throw new Fail(`Video files up to ${STREAM_MAX_BYTES / 1024 / 1024} MB can be uploaded here — compress longer videos first.`, 400);
        const up = await createDirectUpload(String(item.ownerUid), title || "Lesson");
        return NextResponse.json({ lessonId, uploadUrl: up.uploadURL, uid: up.uid });
      }
      if (body.kind === "pdf") {
        if (!privateFilesConfigured()) throw new Fail("Private file storage isn't configured.", 503);
        const filename = String(body.filename || "lesson.pdf");
        if (!/\.pdf$/i.test(filename)) throw new Fail("Choose a PDF file.", 400);
        if (!Number.isInteger(size) || size <= 0 || size > DIGITAL_MAX_BYTES) throw new Fail(`PDFs up to ${DIGITAL_MAX_BYTES / 1024 / 1024} MB.`, 400);
        const key = `lessons/${itemRef.id}/${Date.now()}-${safeFileName(filename)}`;
        return NextResponse.json({ lessonId, key, uploadUrl: await presignUpload(key, "application/pdf", size) });
      }
      throw new Fail("Unknown lesson type.", 400);
    }

    if (action === "finish") {
      if (!title) throw new Fail("Give the lesson a title.", 400);
      if (lessons.length >= MAX_LESSONS) throw new Fail(`A course can have up to ${MAX_LESSONS} lessons.`, 409);
      const id = String(body.lessonId || "");
      if (!/^[a-f0-9]{12}$/.test(id) || lessons.some((l) => l.id === id)) throw new Fail("That lesson was already added.", 409);
      if (body.kind === "video") {
        const v = await getVideo(String(body.uid || ""));
        if (!v) throw new Fail("We couldn't find that video. Try uploading it again.", 409);
        lessons.push({ id, title, kind: "video", uid: v.uid, ...(v.duration && v.duration > 0 ? { durationSec: Math.round(v.duration) } : {}) });
      } else {
        const key = String(body.key || "");
        const head = key.startsWith(`lessons/${itemRef.id}/`) ? await headObject(key) : null;
        if (!head || head.size <= 0) throw new Fail("We couldn't find the uploaded file. Try again.", 409);
        lessons.push({ id, title, kind: "pdf", key, size: head.size });
      }
      return NextResponse.json({ lessons: await save(lessons) });
    }

    const idx = lessons.findIndex((l) => l.id === String(body.lessonId || ""));
    if (idx < 0) throw new Fail("Lesson not found.", 404);
    if (action === "rename") {
      if (!title) throw new Fail("Give the lesson a title.", 400);
      lessons[idx] = { ...lessons[idx], title };
    } else if (action === "move") {
      const to = idx + (body.dir === "up" ? -1 : 1);
      if (to >= 0 && to < lessons.length) [lessons[idx], lessons[to]] = [lessons[to], lessons[idx]];
    } else if (action === "remove") {
      const [gone] = lessons.splice(idx, 1);
      if (gone.kind === "video" && gone.uid) await deleteVideo(gone.uid);
      if (gone.kind === "pdf" && gone.key) await deleteObject(gone.key);
    } else throw new Fail("Unknown action.", 400);
    return NextResponse.json({ lessons: await save(lessons) });
  } catch (err) {
    if (err instanceof Fail) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't update the lessons");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
