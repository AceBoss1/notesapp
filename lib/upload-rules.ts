// Shared by the presign route (server) and the uploader (browser).
export const ALLOWED_TYPES: Record<string, "image" | "video"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
};

export function maxUploadBytes(kind: "image" | "video", isAvatar: boolean): number {
  if (isAvatar) return 5 * 1024 * 1024;
  return kind === "image" ? 10 * 1024 * 1024 : 200 * 1024 * 1024;
}

// Confirms the file's leading bytes match a real image of the declared
// type — a renamed .exe or HTML file with an image/* content type fails.
export async function looksLikeImage(file: File): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  switch (file.type) {
    case "image/jpeg": return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png": return b[0] === 0x89 && ascii(1, 4) === "PNG";
    case "image/gif": return ascii(0, 4) === "GIF8";
    case "image/webp": return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "image/avif": return ascii(4, 8) === "ftyp" && /avif|avis|mif1/.test(ascii(8, 16));
    default: return true; // video: not byte-checked here
  }
}

// Pictures become WebP in the browser before they're uploaded (lib/upload.ts): smaller files, faster pages, and the camera's
// hidden details (where it was taken) are left behind. JPEG and PNG only: a GIF may move, AVIF and WebP are already small. Academy
// logos and signatures stay PNG, because the certificate picture (lib/certificate-image.tsx) can't read WebP. Long sides are cut
// down to `maxSide` (a profile picture needs far less than a cover). The original is kept when the browser can't make WebP or the
// WebP comes out bigger.
export type UploadPurpose = "journal" | "avatar" | "ad" | "moment" | "academy" | "chat" | "media";
export const WEBP_QUALITY = 0.82;
export function webpPlan(type: string, purpose: UploadPurpose): { maxSide: number } | null {
  if (purpose === "academy") return null;
  if (type !== "image/jpeg" && type !== "image/png") return null;
  return { maxSide: purpose === "avatar" ? 1024 : 2560 };
}
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export const webpName = (name: string) => `${name.replace(/\.[A-Za-z0-9]{1,5}$/, "") || "picture"}.webp`;

// POST /api/v1/uploads (partner API): the request body checked, and where the file goes.
export type ApiUploadRequest = { filename: string; contentType: string; size: number };
export function checkApiUpload(b: unknown): { ok: true; req: ApiUploadRequest } | { ok: false; message: string } {
  if (!b || typeof b !== "object") return { ok: false, message: "Send a JSON body." };
  const o = b as Record<string, unknown>;
  const filename = typeof o.filename === "string" ? o.filename.trim().slice(0, 120) : "";
  if (!filename) return { ok: false, message: "`filename` is required." };
  const contentType = typeof o.content_type === "string" ? o.content_type : "";
  if (ALLOWED_TYPES[contentType] !== "image") {
    return { ok: false, message: "`content_type` must be image/jpeg, image/png, image/webp, image/gif or image/avif." };
  }
  const max = maxUploadBytes("image", false);
  const size = o.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0 || size > max) {
    return { ok: false, message: `\`size\` must be the file's size in bytes, up to ${max / 1048576} MB.` };
  }
  return { ok: true, req: { filename, contentType, size } };
}
export const apiUploadKey = (uid: string, filename: string, now: number) =>
  `api/${uid}/${now}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
