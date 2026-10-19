// Adverts and boosts: the numbers Admin → Ads can change without a deploy, and the creative specification advertisers follow
// (shown on /advertise/specifications and checked by the campaign form and the checkout). Pure, so pages and tests share it;
// the stored copy is adConfig/main (server-only, lib/ad-config-server.ts).
import { AD_PLACEMENTS, type AdPlacement } from "./ads";

export type AdConfig = {
  boostsWide: number; // boosts shown at once on computers and tablets
  boostsPhone: number; // and on phones
  boostRotateSec: number; // how long each set of boosts stays
  adRotateSec: number; // how long each advert stays
  feedPromoted: number; // promoted posts between the posts in the journal feed
  digestSlots: number; // sponsored slots in the weekly digest (0 to 3)
  spotsOff: AdPlacement[]; // spots switched off
};

export const AD_CONFIG_DEFAULTS: AdConfig = { boostsWide: 3, boostsPhone: 1, boostRotateSec: 45, adRotateSec: 30, feedPromoted: 2, digestSlots: 3, spotsOff: [] };

const LIMITS: Record<Exclude<keyof AdConfig, "spotsOff">, [min: number, max: number]> = {
  boostsWide: [1, 4], boostsPhone: [1, 2], boostRotateSec: [10, 300], adRotateSec: [10, 300], feedPromoted: [0, 4], digestSlots: [0, 3],
};
export const AD_CONFIG_LIMITS = LIMITS;

// Whatever was stored (or sent from the admin form), made safe: numbers within their limits, unknown spots dropped.
export function cleanAdConfig(v: unknown): AdConfig {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out = { ...AD_CONFIG_DEFAULTS, spotsOff: [] as AdPlacement[] };
  for (const [k, [min, max]] of Object.entries(LIMITS) as [keyof typeof LIMITS, [number, number]][]) {
    const n = Math.round(Number(o[k]));
    if (Number.isFinite(n) && o[k] !== null && o[k] !== "") out[k] = Math.min(max, Math.max(min, n));
  }
  if (Array.isArray(o.spotsOff)) out.spotsOff = Array.from(new Set(o.spotsOff.filter((p): p is AdPlacement => typeof p === "string" && p in AD_PLACEMENTS)));
  return out;
}
export const spotOn = (c: AdConfig, p: AdPlacement) => !c.spotsOff.includes(p);

// ---- the creative specification ----
export const AD_TITLE_MAX = 60;
export const AD_TEXT_MAX = 120;
// The advert picture, shown in the same 1.91 : 1 frame everywhere (the site, the app, the weekly digest).
export const AD_IMAGE = { width: 1200, height: 628, sharpWidth: 2400, sharpHeight: 1256, minWidth: 600, minHeight: 314, bestBytes: 500 * 1024, maxBytes: 1024 * 1024, safe: { width: 960, height: 502 } };
// A Notes Life billboard (the wide roadside board in the game), for campaigns that also run there.
export const BILLBOARD_IMAGE = { width: 1600, height: 900, minWidth: 800, minHeight: 450, bestBytes: 500 * 1024, maxBytes: 1024 * 1024, safe: { width: 1280, height: 720 } };
export type ImageSpec = { width: number; height: number; minWidth: number; minHeight: number; maxBytes: number; sharpWidth?: number; sharpHeight?: number };

// Where to cut a picture of w × h so it fills the spec's shape: zoom 1 is the largest centred cut, higher zooms in, and
// x / y (0 to 1) slide the cut across what's left. Returns the cut and the size to draw it at (never larger than the
// picture itself, and at most the spec's sharp size).
export function cropFor(w: number, h: number, spec: ImageSpec, view: { zoom?: number; x?: number; y?: number } = {}) {
  const ratio = spec.width / spec.height;
  const zoom = Math.min(4, Math.max(1, view.zoom ?? 1));
  let cw = w, ch = w / ratio;
  if (ch > h) { ch = h; cw = h * ratio; }
  cw /= zoom; ch /= zoom;
  const sx = (w - cw) * Math.min(1, Math.max(0, view.x ?? 0.5));
  const sy = (h - ch) * Math.min(1, Math.max(0, view.y ?? 0.5));
  const width = Math.max(1, Math.min(spec.sharpWidth ?? spec.width, Math.round(cw))); // never enlarged
  return { sx: Math.round(sx), sy: Math.round(sy), sw: Math.round(cw), sh: Math.round(ch), width, height: Math.round(width / ratio) };
}

// Why a picture can't be used, or null when it can.
export function imageProblem(w: number, h: number, spec: ImageSpec): string | null {
  if (w < spec.minWidth || h < spec.minHeight) return `The picture is ${w} × ${h} px; it needs to be at least ${spec.minWidth} × ${spec.minHeight} px (best ${spec.width} × ${spec.height}).`;
  return null;
}
// Close enough to the spec's shape (within 2%) to use without cropping.
export const rightShape = (w: number, h: number, spec: ImageSpec) => Math.abs(w / h / (spec.width / spec.height) - 1) <= 0.02;
