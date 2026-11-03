// Media (docs/MEDIA.md): NotesApp's own videos and pictures. Client-safe constants and pure rules, shared by the studio, the creator's
// Media tab and the server (lib/media-server.ts). Phase M1: posting, the creator's grid, pinned Moments and posts, site pictures, the
// profile picture album, watermarked picture downloads, plan limits and teen rules. The /media feed, comments, reactions and gifts are
// phase M2; their counters (commentsCount, reactions, giftsTotal…) are already on every post so M2 only has to fill them.
import type { AccountTier } from "./users";
import { setting } from "@/lib/config";
import { VIDEO_WEEKLY_LIMIT } from "./video-rules";
import { hearsOnlyFromFollowed, mayReshare, teenAudience, type YoungFlags } from "./young";

// On everywhere unless NEXT_PUBLIC_MEDIA_LIVE is "false" (the tab then disappears and the API answers 404).
export const MEDIA_LIVE = setting("NEXT_PUBLIC_MEDIA_LIVE") !== "false";

export const MEDIA_KINDS = ["video", "pictures"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const isMediaKind = (v: unknown): v is MediaKind => MEDIA_KINDS.includes(v as MediaKind);

// Who can see a post (owner, 3 Nov 2026: everyone / followers / subscribers, like the rest of the site). A teen's posts are for people
// they follow back, whatever is chosen here (mediaVisible below).
export const MEDIA_AUDIENCES = ["everyone", "followers", "subscribers"] as const;
export type MediaAudience = (typeof MEDIA_AUDIENCES)[number];
export const isMediaAudience = (v: unknown): v is MediaAudience => MEDIA_AUDIENCES.includes(v as MediaAudience);
export const AUDIENCE_LABEL: Record<MediaAudience, string> = { everyone: "Everyone", followers: "Followers", subscribers: "Subscribers" };

export const MEDIA_CAPTION_MAX = 2200;
export const MEDIA_PICTURES_MAX = 10; // pictures in one post (a carousel)
export const MEDIA_PINNED_MAX = 3; // pinned posts at the top of a creator's Media
export const MOMENTS_PINNED_MAX = 10; // pinned Moments (they stay past their 24–72 hours while pinned)
export const MEDIA_PICTURE_MAX_BYTES = 5 * 1024 * 1024; // what /api/upload allows a member's own pictures (lib/upload-rules.ts)
export const MEDIA_SOUND = "Original sound"; // owner, 3 Nov 2026: original sound only, no music library

// Plan limits (Admin → Limits, group "Media"). The video ladder mirrors post videos and video moments (VIDEO_WEEKLY_LIMIT); the rest are
// the defaults proposed in docs/MEDIA.md. Media videos are counted apart from post videos and video moments.
export const MEDIA_VIDEO_WEEKLY_LIMIT: Record<AccountTier, number> = { ...VIDEO_WEEKLY_LIMIT };
export const MEDIA_VIDEO_MAX_SECONDS: Record<AccountTier, number> = { standard: 60, basic: 60, pro: 180, business: 180, enterprise: 600 };
export const MEDIA_PICTURE_POSTS_DAILY: Record<AccountTier, number> = { standard: 5, basic: 10, pro: 20, business: 40, enterprise: 100 };
export const MEDIA_STORAGE_GB: Record<AccountTier, number> = { standard: 1, basic: 5, pro: 20, business: 50, enterprise: 200 };
export const GB = 1024 ** 3;

// A post as stored (mediaPosts/{id}). Server-written only; read through /api/media (firestore.rules refuse clients).
export type MediaPicture = { key: string; bytes: number };
export type MediaVideo = { streamUid: string; durationSec: number; bytes: number; uploadId: string };
export type MediaStatus = "processing" | "ready" | "rejected";
export type MediaPostDoc = {
  ownerUid: string; ownerUsername: string; kind: MediaKind;
  caption: string; sound: string;
  pictures?: MediaPicture[]; video?: MediaVideo;
  status: MediaStatus; rejectedReason?: string;
  audience: MediaAudience;
  allowComments: boolean; allowShares: boolean; allowGifts: boolean; allowDownloads: boolean;
  pinned: boolean; pinnedAt?: string;
  createdAt: string; updatedAt: string;
  bytes: number; // counted against the plan's Media storage
  // Counters. M1 fills viewCount and downloadCount; M2 (feed, comments, reactions, gifts) fills the rest.
  viewCount: number; downloadCount: number; sharesCount: number;
  commentsCount: number; reactions: Record<string, number>; reactionsCount: number; giftsTotal: number; giftsCount: number;
};

// What a viewer gets: no keys or upload ids, only addresses.
export type MediaPostView = {
  id: string; kind: MediaKind; caption: string; sound: string; status: MediaStatus; rejectedReason?: string;
  pictures: string[]; video?: { streamUid: string; durationSec: number; poster: string; player: string };
  cover: string; // the first picture or the video's poster; "" when there is none (the tile shows the pattern)
  audience: MediaAudience; allowComments: boolean; allowShares: boolean; allowGifts: boolean; allowDownloads: boolean;
  pinned: boolean; createdAt: string;
  viewCount: number; downloadCount: number; sharesCount: number; commentsCount: number; reactionsCount: number; giftsTotal: number;
  mine: boolean;
};

// Cloudflare Stream's own public addresses for a video (Media videos use public playback, not the signed playback courses use).
export const streamPoster = (uid: string) => `https://videodelivery.net/${encodeURIComponent(uid)}/thumbnails/thumbnail.jpg?time=1s&height=640`;
export const streamPlayer = (uid: string) => `https://iframe.videodelivery.net/${encodeURIComponent(uid)}`;

// ── Who sees what ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Relation = { signedIn: boolean; self: boolean; viewerFollows: boolean; followsViewer: boolean; subscribed: boolean; blocked: boolean };

// One post, for one viewer. The owner always; a block either way, never. A teen's (or a member who kept the teen rules after 18): only
// mutual followers, whatever the audience says (lib/young.ts teenAudience, the Moments rule). Otherwise the post's own audience.
export function mediaVisible(o: { owner: YoungFlags; audience: MediaAudience; status: MediaStatus; rel: Relation }): boolean {
  if (o.rel.self) return true;
  if (o.rel.blocked || o.status !== "ready") return false;
  if (hearsOnlyFromFollowed(o.owner)) return teenAudience({ signedIn: o.rel.signedIn, self: false, viewerFollows: o.rel.viewerFollows, followsViewer: o.rel.followsViewer });
  if (o.audience === "everyone") return true;
  if (o.audience === "followers") return o.rel.signedIn && o.rel.viewerFollows;
  return o.rel.signedIn && o.rel.subscribed;
}

// The rest of a teen's Media page (site pictures, the profile picture album): same rule as their posts.
export const mediaPageVisible = (owner: YoungFlags, rel: Relation) =>
  rel.self || (!rel.blocked && (!hearsOnlyFromFollowed(owner) || teenAudience({ signedIn: rel.signedIn, self: false, viewerFollows: rel.viewerFollows, followsViewer: rel.followsViewer })));

// The switches a post may have. Teens: no downloads, no shares (mayReshare), no gifts; everyone: the creator's choice.
export function allowedSwitches(owner: YoungFlags, want: { allowComments: boolean; allowShares: boolean; allowGifts: boolean; allowDownloads: boolean }) {
  const teen = hearsOnlyFromFollowed(owner);
  return { allowComments: want.allowComments, allowShares: want.allowShares && mayReshare(owner), allowGifts: want.allowGifts && !teen, allowDownloads: want.allowDownloads && !teen };
}

// Phase M2 (comments): only people a teen follows may comment on or mention them. The same rule as Moments (mayReach in lib/young.ts),
// kept here so the comment route has one call to make.
export { mayReach as mayCommentOnMedia } from "./young";

export const TEEN_DOWNLOAD_BLOCKED = "Downloads are off for this member's Media.";
export const DOWNLOADS_OFF = "The creator hasn't allowed downloads of this post.";
export const VIDEO_DOWNLOADS_SOON = "Downloads of videos are coming soon. Pictures can be downloaded now, with a watermark.";

// ── Site pictures (the site kit: cover, top banner, gallery, services) ─────────────────────────────────────────────────────────
export type SitePictureSource = "cover" | "hero" | "gallery" | "services";
export const SITE_SOURCE_LABEL: Record<SitePictureSource, string> = { cover: "Site cover", hero: "Top banner", gallery: "Gallery", services: "Services" };
export type SitePicture = { id: string; url: string; source: SitePictureSource; caption: string; hidden: boolean };

// A short, stable id for a site picture (its address), so a Hide switch keeps working when the site is reordered. FNV-1a, 2 × 32 bits.
export function sitePictureId(url: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return `s${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

// The site's pictures, in the order a visitor meets them, each once. `blocks` and `cover` are the stored site (lib/site-kits.ts SiteDoc).
type SiteLike = { cover?: string; blocks?: { hero?: { on?: boolean; image?: string }; gallery?: { on?: boolean; items?: { image?: string; caption?: string }[] }; services?: { on?: boolean; items?: { image?: string; name?: string }[] } } };
export function sitePicturesOf(site: SiteLike | null | undefined, hidden: Iterable<string> = []): SitePicture[] {
  if (!site) return [];
  const hide = new Set(hidden);
  const out: SitePicture[] = [];
  const seen = new Set<string>();
  const add = (url: string | undefined, source: SitePictureSource, caption = "") => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    const id = sitePictureId(url);
    out.push({ id, url, source, caption, hidden: hide.has(id) });
  };
  add(site.cover, "cover");
  const b = site.blocks;
  if (b?.hero?.on) add(b.hero.image, "hero");
  if (b?.gallery?.on) for (const g of b.gallery.items ?? []) add(g.image, "gallery", g.caption ?? "");
  if (b?.services?.on) for (const s of b.services.items ?? []) add(s.image, "services", s.name ?? "");
  return out;
}

// Studio settings (mediaSettings/{uid}). Site pictures show by default (owner, 3 Nov 2026); each can be hidden, or all at once.
export type MediaSettings = { hideAllSite: boolean; hiddenSite: string[]; showAlbum: boolean };
export const DEFAULT_MEDIA_SETTINGS: MediaSettings = { hideAllSite: false, hiddenSite: [], showAlbum: true };
export function cleanMediaSettings(v: unknown): MediaSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const ids = Array.isArray(o.hiddenSite) ? o.hiddenSite.filter((x): x is string => typeof x === "string" && /^s[0-9a-f]{16}$/.test(x)) : [];
  return { hideAllSite: o.hideAllSite === true, hiddenSite: Array.from(new Set(ids)).slice(0, 200), showAlbum: o.showAlbum !== false };
}

// ── Lives & Replays ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A replay tile on the Lives & replays tab. lib/media-replays.ts returns these (none until the replays feature lands).
export type ReplayTile = { id: string; title: string; poster: string; durationSec: number; href: string; createdAt: string; live?: boolean };

// ── Small helpers for the pages ───────────────────────────────────────────────────────────────────────────────────────────────
export const compact = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(n));
export const mediaDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}`;
export const gbText = (gb: number) => (gb === 0 ? "no limit" : `${gb} GB`);
export const secondsText = (s: number) => (s % 60 === 0 ? `${s / 60} minute${s === 60 ? "" : "s"}` : s < 60 ? `${s} seconds` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

// What the first bytes of an uploaded picture say it is (the bucket stores whatever was sent, so the post checks before it points at it).
export function sniffPicture(b: Uint8Array): "webp" | "jpeg" | "png" | "gif" | "avif" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(b.slice(from, to)));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 4 && b[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (b.length >= 4 && ascii(0, 4) === "GIF8") return "gif";
  if (b.length >= 12 && ascii(4, 8) === "ftyp" && /avif|avis|mif1/.test(ascii(8, 12))) return "avif";
  return null;
}
// A Media picture's key: in the member's own media/ folder, as /api/upload makes it (purpose "media").
export const isOwnMediaKey = (key: unknown, uid: string): key is string =>
  typeof key === "string" && key.length <= 300 && key.startsWith(`media/${uid}/`) && !key.includes("..") && /^[A-Za-z0-9._/-]+$/.test(key);
