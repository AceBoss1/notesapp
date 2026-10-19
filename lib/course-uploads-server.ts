import { createDirectUpload, deleteVideo, getVideo, playbackToken, playerUrl, streamConfigured, STREAM_MAX_BYTES } from "./stream";
import { deleteObject, headObject, presignUpload, privateFilesConfigured } from "./private-files";
import { checkDevice } from "./view-access";
import { CourseError, type UploadChecks } from "./courses-server";
import { PDF_MAX_BYTES, type Lesson } from "./courses";
import type { LessonDeps } from "./course-sales-server";

// Server-only. The real services behind paid courses' uploads and players: Cloudflare Stream for video (signed tokens, never a
// download) and the private R2 bucket for PDFs. Kept apart from lib/courses-server.ts so the course logic can be tested without them.
export const uploadChecks: UploadChecks = {
  video: async (uid) => {
    const v = await getVideo(uid);
    return v ? { creator: (v as { creator?: string }).creator, duration: v.duration } : null;
  },
  file: (key) => headObject(key),
};

export const lessonDeps: LessonDeps = {
  playerUrlFor: async (uid) => {
    if (!streamConfigured()) throw new CourseError("Video isn't available right now. Try again soon.", 503);
    return playerUrl(await playbackToken(uid, 4 * 3600));
  },
  checkDevice: (reference, uid, courseId, deviceId, label) => checkDevice(reference, uid, courseId, deviceId, label, true),
};

// Where the editor's browser sends an upload: a one-time Stream URL (the video belongs to the course's owner), or a short-lived
// signed PUT to courses/<id>/… in the private bucket.
export async function startUpload(ownerUid: string, courseId: string, kind: unknown, name: unknown, size: unknown): Promise<{ kind: "video"; uploadUrl: string; streamUid: string } | { kind: "pdf"; uploadUrl: string; fileKey: string }> {
  const bytes = Number(size);
  const fileName = String(name ?? "").replace(/[^\w.\- ()]/g, "_").slice(0, 100) || "file";
  if (kind === "video") {
    if (!streamConfigured()) throw new CourseError("Video uploads aren't available right now.", 503);
    if (!(bytes > 0) || bytes > STREAM_MAX_BYTES) throw new CourseError(`A video can be up to ${Math.round(STREAM_MAX_BYTES / 1024 / 1024)} MB.`);
    const u = await createDirectUpload(ownerUid, fileName);
    return { kind: "video", uploadUrl: u.uploadURL, streamUid: u.uid };
  }
  if (kind === "pdf") {
    if (!privateFilesConfigured()) throw new CourseError("PDF uploads aren't available right now.", 503);
    if (!(bytes > 0) || bytes > PDF_MAX_BYTES) throw new CourseError(`A PDF can be up to ${PDF_MAX_BYTES / 1024 / 1024} MB.`);
    if (!/\.pdf$/i.test(fileName)) throw new CourseError("Choose a PDF file.");
    const fileKey = `courses/${courseId}/${Date.now()}-${fileName.replace(/\s+/g, "-")}`;
    return { kind: "pdf", uploadUrl: await presignUpload(fileKey, "application/pdf", bytes), fileKey };
  }
  throw new CourseError("Upload a video or a PDF.");
}

export async function dropUpload(l: Pick<Lesson, "streamUid" | "fileKey">): Promise<void> {
  if (l.streamUid) await deleteVideo(l.streamUid).catch(() => {});
  if (l.fileKey) await deleteObject(l.fileKey).catch(() => {});
}
