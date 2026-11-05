// The permanent NotesApp mark on every Media picture, Media video and published live replay (owner, 5 Nov 2026, approved mockup
// "Both"). Pure and client-safe; the drawing is lib/media-watermark.tsx and the server side lib/media-mark-server.ts.
//
// Two marks, drawn into the file itself when it arrives, so the marked file is the only copy we keep (the clean upload is deleted):
//   • the centre: a large, faint full logo (the crimson "na" square and the NotesApp wordmark) across the middle, about 60% of the width;
//   • the corner: the crimson "na" square and "@username" in white with a soft dark edge (no "NotesApp" word: owner, "na @emmanuel in the
//     bottom right is okay").
// Both are sized from the picture or video frame, so a tall phone photo and a wide banner look the same. Pictures are marked on our
// server; videos and replays by Cloudflare Stream, from a watermark profile (one full-frame transparent PNG with both marks drawn in place).

// ── The look (Admin → Limits → Media watermark: serverConfig/mediaWatermark) ──
export type WatermarkKey = "centreOpacityPct" | "centreSizePct" | "cornerOpacityPct" | "cornerSizePct" | "paddingPct" | "corner";
export type WatermarkSettingDef = { key: WatermarkKey; label: string; unit: string; min: number; max: number; def: number; kind?: "corner" };
export const WATERMARK_CORNERS = ["lowerRight", "lowerLeft", "upperRight", "upperLeft"] as const; // Stream's own position names
export type WatermarkCorner = (typeof WATERMARK_CORNERS)[number];
export const CORNER_LABEL: Record<WatermarkCorner, string> = { lowerRight: "Bottom right", lowerLeft: "Bottom left", upperRight: "Top right", upperLeft: "Top left" };
export const WATERMARK_SETTINGS: WatermarkSettingDef[] = [
  { key: "centreOpacityPct", label: "Centre logo: how visible (lower is fainter)", unit: "%", min: 5, max: 40, def: 16 },
  { key: "centreSizePct", label: "Centre logo: width, as a share of the picture's width", unit: "%", min: 30, max: 80, def: 60 },
  // Kept see-through: the owner ruled out a solid mark.
  { key: "cornerOpacityPct", label: "Corner mark (na @username): how visible", unit: "%", min: 30, max: 90, def: 88 },
  { key: "cornerSizePct", label: "Corner mark: size (100 is the approved size: letters 3.6% of the width)", unit: "%", min: 50, max: 200, def: 100 },
  { key: "paddingPct", label: "Corner mark: space from the edge, as a share of the width and height", unit: "%", min: 1, max: 10, def: 3 },
  { key: "corner", label: "Corner", unit: "corner", min: 0, max: WATERMARK_CORNERS.length - 1, def: 0, kind: "corner" },
];
export type WatermarkSettings = Record<WatermarkKey, number>;
export type WatermarkOverrides = Partial<WatermarkSettings>;
export const WATERMARK_DEFAULTS = Object.fromEntries(WATERMARK_SETTINGS.map((s) => [s.key, s.def])) as WatermarkSettings;
export function watermarkSettings(overrides: WatermarkOverrides = {}): WatermarkSettings {
  const out = { ...WATERMARK_DEFAULTS };
  for (const s of WATERMARK_SETTINGS) {
    const v = overrides[s.key];
    if (typeof v === "number" && Number.isInteger(v) && v >= s.min && v <= s.max) out[s.key] = v;
  }
  return out;
}
// What an admin sent: whole numbers within each range that differ from the default; anything else (old keys included) is dropped.
export function cleanWatermarkOverrides(input: unknown): WatermarkOverrides {
  const out: WatermarkOverrides = {};
  if (!input || typeof input !== "object") return out;
  for (const s of WATERMARK_SETTINGS) {
    const raw = (input as Record<string, unknown>)[s.key];
    const v = Number(raw);
    if (raw !== undefined && raw !== null && raw !== "" && Number.isInteger(v) && v >= s.min && v <= s.max && v !== s.def) out[s.key] = v;
  }
  return out;
}
export const cornerOf = (s: WatermarkSettings): WatermarkCorner => WATERMARK_CORNERS[s.corner] ?? "lowerRight";

// ── Where the marks go on a picture or frame of width × height ──
// The corner says only "@username" next to the na square: never the NotesApp word.
export const cornerText = (username: string) => `@${username}`;
export const MARK_CRIMSON = "#9a0633";
export const MARK_WORD = "NotesApp";
// Rough widths of the letters (Inter Bold, in ems), enough to keep the marks inside the frame; the drawing measures the real text.
const EM_WORD = 4.95; // "NotesApp" at 800
const EM_CHAR = 0.6; // an average letter of a username at 700

export type MarkBox = { x: number; y: number; w: number; h: number };
export type MarkGeometry = {
  width: number; height: number;
  centre: MarkBox & { square: number; gap: number; font: number; opacity: number };
  corner: MarkBox & { square: number; gap: number; font: number; opacity: number; text: string; corner: WatermarkCorner };
};

export function markGeometry(width: number, height: number, username: string, s: WatermarkSettings = WATERMARK_DEFAULTS): MarkGeometry {
  const W = Math.max(1, Math.round(width)), H = Math.max(1, Math.round(height));
  // Centre: square + gap + wordmark, in units of the square (mockup: square 15% of the width, gap 2.2%, word 8.8%).
  const unitsWide = 1 + 2.2 / 15 + (8.8 / 15) * EM_WORD; // ≈ 4.05 squares
  let square = (W * (s.centreSizePct / 100)) / unitsWide;
  square = Math.min(square, H * 0.4); // a wide banner: the logo is never taller than 40% of it
  const cw = square * unitsWide;
  const centre = {
    x: Math.round((W - cw) / 2), y: Math.round((H - square) / 2), w: Math.round(cw), h: Math.round(square),
    square: Math.round(square), gap: Math.round(square * (2.2 / 15)), font: Math.round(square * (8.8 / 15)), opacity: s.centreOpacityPct / 100,
  };
  // Corner (approved mockup, 5 Nov): letters 3.6% of the width, the na square 1.9 letters, 3% in from the right and the bottom. On a very
  // wide banner the letters stop growing at 6% of the height (the square at about 11%), and a very long username is made to fit in 70% of the width.
  const text = cornerText(username);
  let font = Math.min(0.036 * W, 0.06 * H) * (s.cornerSizePct / 100);
  const wide = (f: number) => f * 1.9 + f * 0.45 + text.length * f * EM_CHAR;
  if (wide(font) > W * 0.7) font = (W * 0.7) / wide(1);
  font = Math.max(8, font);
  const sq = font * 1.9, cwid = wide(font);
  const padX = Math.max(4, (s.paddingPct / 100) * W), padY = Math.max(4, (s.paddingPct / 100) * H);
  const corner = cornerOf(s);
  const right = corner === "lowerRight" || corner === "upperRight", bottom = corner === "lowerRight" || corner === "lowerLeft";
  return {
    width: W, height: H, centre,
    corner: {
      x: Math.round(right ? W - padX - cwid : padX), y: Math.round(bottom ? H - padY - sq : padY), w: Math.round(cwid), h: Math.round(sq),
      square: Math.round(sq), gap: Math.round(font * 0.45), font: Math.round(font), opacity: s.cornerOpacityPct / 100, text, corner,
    },
  };
}

// A picture the re-marking job can't write back in its own format (a GIF or AVIF): it gets a new marked address instead.
export class FormatNotKept extends Error { constructor() { super("This picture's format can't be written back as it is."); } }

// ── Videos and replays: one Stream watermark profile per creator and frame shape ──
// Stream lays one PNG on a video at a position and a scale ("1.0 fills the entire video"). So the PNG is the whole frame, transparent, with
// both marks drawn where they belong, and it is laid on at scale 1.0 in the centre with no padding and full opacity (the marks carry their
// own see-through). A frame is only filled exactly when the PNG has the video's shape, so there is one PNG per shape, the nearest of these.
export const MARK_SHAPES = { "9x16": 9 / 16, "3x4": 3 / 4, "1x1": 1, "4x3": 4 / 3, "16x10": 16 / 10, "16x9": 16 / 9, "21x9": 21 / 9 } as const;
export type MarkShape = keyof typeof MARK_SHAPES;
export const MARK_SHAPE_KEYS = Object.keys(MARK_SHAPES) as MarkShape[];
export function shapeOf(width: unknown, height: unknown, fallback: MarkShape = "16x9"): MarkShape {
  const w = Number(width), h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return fallback;
  const r = Math.log(w / h);
  return MARK_SHAPE_KEYS.reduce((best, k) => (Math.abs(Math.log(MARK_SHAPES[k]) - r) < Math.abs(Math.log(MARK_SHAPES[best]) - r) ? k : best), MARK_SHAPE_KEYS[0]);
}
// The PNG's size for a shape: 1280 on the long side (small: it is almost all transparent).
export function shapeSize(shape: MarkShape): { w: number; h: number } {
  const r = MARK_SHAPES[shape];
  return r >= 1 ? { w: 1280, h: Math.round(1280 / r) } : { w: Math.round(1280 * r), h: 1280 };
}
export const STREAM_PROFILE = { opacity: 1, padding: 0, scale: 1, position: "center" } as const;
// A creator's profile for a shape is made once and used again while their @username and the look stay the same.
export const markProfileKey = (username: string, shape: MarkShape, s: WatermarkSettings) =>
  [username.toLowerCase(), shape, ...WATERMARK_SETTINGS.map((d) => s[d.key])].join("|");

// ── Downloads (allowed per post by its creator): the stored file is already marked, so a download is that file ──
// A video's MP4 is made by Stream from the (marked) video itself the first time downloads are allowed: rendering → ready, or failed.
export type VideoDownload = { state: "rendering" | "ready" | "failed"; startedAt: string; updatedAt: string; url?: string; why?: string };
export type VideoDownloadView = "preparing" | "ready" | "failed";
export const downloadView = (d: VideoDownload | undefined): VideoDownloadView | undefined =>
  !d ? undefined : d.state === "ready" ? "ready" : d.state === "failed" ? "failed" : "preparing";
export const DOWNLOAD_GIVE_UP_MS = 86_400_000;
export const videoDownloadName = (username: string, postId: string) => `${username}-notesapp-${postId.slice(0, 6)}`;
export const withFilename = (url: string, filename: string) => `${url}${url.includes("?") ? "&" : "?"}filename=${encodeURIComponent(filename)}`;
// A signed video's MP4 (a replay's, during the re-marking): the token goes in place of the video's id.
export const signedDownloadUrl = (url: string, uid: string, token: string) => url.replace(`/${uid}/`, `/${encodeURIComponent(token)}/`);

export const VIDEO_DL_PREPARING = "The download file is being made. Try again in a few minutes.";
export const VIDEO_DL_NOT_SET_UP = "Video downloads aren't switched on yet.";
export const NOT_MARKED_YET = "This video is being given the NotesApp mark. Downloads open once that's done.";
// The studio's words: what every post carries, and what the downloads switch does.
export const MARK_NOTE = "Every Media picture and video carries the NotesApp mark and your @username, added when it's uploaded. We keep only the marked copy.";
export const DOWNLOADS_NOTE = "People who can see the post can save it. They get the same marked file everyone sees.";

// ── The re-marking job (Admin → Limits → Media watermark → Re-mark existing pictures and videos; lib/media-mark-backfill.ts) ──
// Everything posted before the mark: Media pictures and videos, published video replays, shop item photos, site service pictures and
// journal pictures. It runs a batch at a time (from the admin button and the cron), keeps its place in serverConfig/markBackfill and each
// video's steps on the video's own document, so it can stop anywhere and carry on; running it again changes nothing already marked.
export const BACKFILL_KINDS = [
  { key: "mediaPictures", label: "Media pictures (posts)" },
  { key: "mediaVideos", label: "Media videos" },
  { key: "replays", label: "Live replays" },
  { key: "shopItems", label: "Shop items" },
  { key: "services", label: "Services (sites)" },
  { key: "journals", label: "Journals" },
  { key: "momentPictures", label: "Moment pictures" },
  { key: "momentVideos", label: "Moment videos (pinned)" },
] as const;
export type BackfillKind = (typeof BACKFILL_KINDS)[number]["key"];
// done: marked now; already: carried the mark; pending: a video Stream is still copying; failed: couldn't (see the log, run again);
// skipped: nothing to mark (an audio replay, a post still processing or rejected); external: a picture that isn't in our storage (an
// outside link or one shipped with the app), left as it is.
export const BACKFILL_COUNTS = ["done", "already", "pending", "failed", "skipped", "external"] as const;
export type BackfillCounts = Record<(typeof BACKFILL_COUNTS)[number], number>;
export const BACKFILL_PHASES = ["mediaPosts", "replays", "storeItems", "sites", "notes", "moments", "recount"] as const;
export type BackfillState = {
  status: "idle" | "running" | "paused" | "done";
  phase: number; cursor: string | null; counts: Record<BackfillKind, BackfillCounts>;
  recounted: number; runs: number; startedAt?: string; updatedAt?: string; finishedAt?: string; startedBy?: string; lockUntil?: number; lastError?: string;
};
export const emptyCounts = (): Record<BackfillKind, BackfillCounts> =>
  Object.fromEntries(BACKFILL_KINDS.map((k) => [k.key, Object.fromEntries(BACKFILL_COUNTS.map((c) => [c, 0]))])) as Record<BackfillKind, BackfillCounts>;
export const emptyBackfill = (): BackfillState => ({ status: "idle", phase: 0, cursor: null, counts: emptyCounts(), recounted: 0, runs: 0 });
