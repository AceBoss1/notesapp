// Watermarked video downloads for Media (owner, 3 Nov 2026: "Yes, emphasis on TRANSPARENT watermark"). Pure and client-safe; the server
// side is lib/media-video-dl-server.ts.
//
// Cloudflare Stream can only burn a watermark into a video when the video is uploaded or copied, and the mark then shows in every
// rendition, playback included. So the video people watch stays clean, and a creator who allows downloads gets a SECOND copy of the video
// with a see-through mark (a transparent PNG: the NotesApp "na" mark, @username and "NotesApp", laid on at the opacity below), and MP4
// downloads are switched on for that copy only. The copy counts against the creator's Media storage, so a downloadable video takes about
// twice the room. The look of the mark (how see-through, how big, which corner) is set in Admin → Limits → Video download watermark.

// ── The watermark's look (serverConfig/mediaWatermark, read through lib/media-video-dl-server.ts) ──
export type WatermarkKey = "opacityPct" | "sizePct" | "paddingPct" | "corner";
export type WatermarkSettingDef = { key: WatermarkKey; label: string; unit: string; min: number; max: number; def: number; kind?: "corner" };
export const WATERMARK_CORNERS = ["lowerRight", "lowerLeft", "upperRight", "upperLeft"] as const; // Stream's own position names
export type WatermarkCorner = (typeof WATERMARK_CORNERS)[number];
export const CORNER_LABEL: Record<WatermarkCorner, string> = { lowerRight: "Bottom right", lowerLeft: "Bottom left", upperRight: "Top right", upperLeft: "Top left" };
export const WATERMARK_SETTINGS: WatermarkSettingDef[] = [
  // Kept see-through: the mark never covers the video. 100% would be solid, which the owner ruled out.
  { key: "opacityPct", label: "How visible the mark is (lower is more see-through)", unit: "%", min: 15, max: 70, def: 40 },
  { key: "sizePct", label: "Width of the mark, as a share of the video's width", unit: "%", min: 8, max: 40, def: 22 },
  { key: "paddingPct", label: "Space between the mark and the video's edge", unit: "%", min: 1, max: 15, def: 4 },
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
// What an admin sent: whole numbers within each range that differ from the default; anything else is dropped.
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
// What Stream's watermark profile takes: fractions from 0 to 1, and a position name.
export const streamWatermarkParams = (s: WatermarkSettings) => ({ opacity: s.opacityPct / 100, scale: s.sizePct / 100, padding: s.paddingPct / 100, position: cornerOf(s) });
// A creator's profile is made once and used again while their @username and the look stay the same; a change makes a new one.
export const watermarkProfileKey = (username: string, s: WatermarkSettings) => `${username.toLowerCase()}|${s.opacityPct}|${s.sizePct}|${s.paddingPct}|${s.corner}`;

// ── One video's downloadable copy (mediaPosts/{id}.videoDl) ──
// source: Stream is making an MP4 of the original, which the copy is made from (removed again once the copy has it);
// copying: the watermarked copy is being made; rendering: the copy's MP4 is being made; ready: people can download it; failed: why.
export type VideoDlState = "source" | "copying" | "rendering" | "ready" | "failed";
export type VideoDl = {
  state: VideoDlState; startedAt: string; updatedAt: string;
  profileUid: string; // the watermark profile used
  sourceUrl?: string; // the original's MP4, while the copy is being made
  copyUid?: string; // the watermarked copy on Stream
  url?: string; // the copy's MP4 address (it plays only with a signed token: the copy keeps signed links on)
  bytes: number; // counted in the creator's Media storage (the original's size until the copy's is known)
  why?: string;
};
export const DL_PENDING: VideoDlState[] = ["source", "copying", "rendering"];
export const dlPending = (d: VideoDl | undefined) => !!d && DL_PENDING.includes(d.state);
export const DL_GIVE_UP_MS = 86_400_000; // a copy not ready in a day is given up (and the creator can switch downloads off and on to try again)

// What Stream told us about one step, and what to do next. Pure, so the order of the steps is tested on its own.
export type DlFacts = {
  now: number;
  sourceDownload?: { status: "inprogress" | "ready" | "error"; url: string } | null; // the original's MP4 (state "source")
  copy?: { readyToStream: boolean; state?: string; size?: number } | null; // the copy (states "copying" and "rendering")
  copyDownload?: { status: "inprogress" | "ready" | "error"; url: string } | null; // the copy's MP4 (state "rendering")
};
export type DlAction =
  | { do: "wait" }
  | { do: "copy"; url: string } // make the watermarked copy from the original's MP4
  | { do: "render" } // the copy is ready: drop the original's MP4, make the copy's
  | { do: "ready"; url: string; bytes?: number }
  | { do: "fail"; why: string };
export function nextDlStep(d: VideoDl, f: DlFacts): DlAction {
  if (f.now - Date.parse(d.startedAt) > DL_GIVE_UP_MS) return { do: "fail", why: "The download copy took too long to make. Switch downloads off and on to try again." };
  if (d.state === "source") {
    if (!f.sourceDownload || f.sourceDownload.status === "error") return { do: "fail", why: "Cloudflare couldn't make a copy of this video to download. Switch downloads off and on to try again." };
    return f.sourceDownload.status === "ready" && f.sourceDownload.url ? { do: "copy", url: f.sourceDownload.url } : { do: "wait" };
  }
  if (d.state === "copying") {
    if (!f.copy || f.copy.state === "error") return { do: "fail", why: "Cloudflare couldn't add the watermark to this video. Switch downloads off and on to try again." };
    return f.copy.readyToStream ? { do: "render" } : { do: "wait" };
  }
  if (d.state === "rendering") {
    if (!f.copyDownload || f.copyDownload.status === "error") return { do: "fail", why: "Cloudflare couldn't make the download file. Switch downloads off and on to try again." };
    return f.copyDownload.status === "ready" && f.copyDownload.url ? { do: "ready", url: f.copyDownload.url, ...(f.copy?.size ? { bytes: f.copy.size } : {}) } : { do: "wait" };
  }
  return { do: "wait" };
}

// The copy keeps signed links on, so its MP4 address only works with a token in place of the video's id. `filename` names the saved file.
export function signedDownloadUrl(url: string, copyUid: string, token: string, filename?: string): string {
  const signed = url.replace(`/${copyUid}/`, `/${encodeURIComponent(token)}/`);
  return filename ? `${signed}${signed.includes("?") ? "&" : "?"}filename=${encodeURIComponent(filename)}` : signed;
}
export const videoDownloadName = (username: string, postId: string) => `${username}-notesapp-${postId.slice(0, 6)}`;

// What a viewer sees of it (MediaPostView.videoDownload): only "ready" to others; the creator also sees "preparing" and "failed".
export type VideoDownloadView = "preparing" | "ready" | "failed";
export const dlView = (d: VideoDl | undefined): VideoDownloadView | undefined =>
  !d ? undefined : d.state === "ready" ? "ready" : d.state === "failed" ? "failed" : "preparing";

export const VIDEO_DL_PREPARING = "The download is being prepared, with a see-through @username and NotesApp mark. Try again in a few minutes.";
export const VIDEO_DL_NOT_SET_UP = "Video downloads aren't switched on yet.";
export const VIDEO_DL_STORAGE = "There isn't room in your Media storage for a downloadable copy of this video. Delete some posts, or move up a plan for more room.";
// The note next to the switch: a downloadable video takes about twice its size in Media storage.
export const VIDEO_DL_NOTE = "Downloads carry a see-through @you + NotesApp mark. We keep a second, marked copy of the video for downloads, so it takes about twice the room in your Media storage. The video people watch stays clean.";
