// AI content checks: the rules (pure, shared by the server, the pages and the tests). docs/CONTENT_CHECKS.md has the plan.
//
// Every photo, video frame and text that people other than the author can see is checked before it is published (journals, community
// posts and comments, Moments, Media posts, shop items, events, profiles). Private 1:1 and group messages are never checked. The checker
// answers with a category, how sure it is (0 to 1), which item (the text, picture n or video n) and a short reason; `decide` turns that
// into pass, hold for a person, block (a strike) or the child-safety path. The figures (thresholds, strikes, days) are set in Admin →
// Reports → Content checks; the defaults are below. Help text never prints them.

export const CATEGORIES = ["sexual", "gore", "violence", "self_harm", "drugs", "weapons", "hate"] as const;
export type Category = (typeof CATEGORIES)[number];
// "csam": child sexual abuse material (instant permanent ban, reported); "unclear": the checker declined to look, so a person does.
export type FoundCategory = Category | "csam" | "unclear" | "none";
export const FOUND = [...CATEGORIES, "csam", "unclear", "none"] as const;
export const CONTEXTS = ["none", "news", "medical", "art"] as const;
export type CheckContext = (typeof CONTEXTS)[number];

export const CATEGORY_LABEL: Record<Exclude<FoundCategory, "none">, string> = {
  sexual: "sexual content", gore: "gore", violence: "violence", self_harm: "self-harm", drugs: "drugs", weapons: "weapons",
  hate: "hate or extremism", csam: "child sexual abuse material", unclear: "something our check couldn't judge",
};
export const CATEGORY_TAG: Record<Exclude<FoundCategory, "none">, string> = {
  sexual: "Sexual", gore: "Gore", violence: "Violence", self_harm: "Self-harm", drugs: "Drugs", weapons: "Weapons", hate: "Hate",
  csam: "Child safety", unclear: "Unclear",
};

// One thing the checker found. `item` is "text", "picture 1", "picture 2"…, or "video 1" (its poster and frames).
export type Finding = { category: FoundCategory; confidence: number; item: string; reason: string; context: CheckContext };

export type ContentKind =
  | "journal" | "journal_comment" | "community" | "community_post" | "community_comment" | "moment" | "media" | "store_item" | "event" | "profile";
export const KIND_LABEL: Record<ContentKind, string> = {
  journal: "journal", journal_comment: "comment on a journal", community: "community page", community_post: "community post",
  community_comment: "community comment", moment: "Moment", media: "Media post", store_item: "shop item", event: "event", profile: "profile",
};

// ── Settings (Admin → Reports → Content checks) ─────────────────────────────────────────────────────────────────────────────────
export type CheckSettings = {
  enabled: boolean; // off: nothing is checked and the database doesn't ask for a check
  blockAt: number; // this sure or more: blocked, and a strike
  reviewAt: number; // this sure or more (but under blockAt): held for a person to look at
  teenBlockAt: number; // the same for under-18s (stricter: lower)
  teenReviewAt: number;
  csamBanAt: number; // this sure of child sexual abuse material: permanent ban and the Legal team's queue; under it, held for Legal
  strikesToSuspend: number; // strikes inside the window that pause posting
  windowDays: number; // how long a strike counts
  suspendDays: number; // how long posting is paused
  communityStrikes: number; // strikes on a community's owner or moderators (in the window) before its members are warned, then it is closed
};
export const CHECK_DEFAULTS: CheckSettings = {
  enabled: true, blockAt: 0.85, reviewAt: 0.5, teenBlockAt: 0.6, teenReviewAt: 0.3, csamBanAt: 0.8,
  strikesToSuspend: 3, windowDays: 90, suspendDays: 14, communityStrikes: 3,
};

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
// What an admin saved, checked; a string is the reason it was refused. Missing fields keep `base`.
export function cleanCheckSettings(input: unknown, base: CheckSettings = CHECK_DEFAULTS): CheckSettings | string {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: CheckSettings = { ...base };
  if (o.enabled !== undefined) out.enabled = o.enabled === true;
  for (const k of ["blockAt", "reviewAt", "teenBlockAt", "teenReviewAt", "csamBanAt"] as const) {
    if (o[k] === undefined) continue;
    const n = num(o[k]);
    if (!Number.isFinite(n) || n <= 0 || n > 1) return "Confidence levels are between 0.01 and 1.";
    out[k] = Math.round(n * 100) / 100;
  }
  const whole: [keyof CheckSettings, number, number, string][] = [
    ["strikesToSuspend", 1, 20, "Strikes before a suspension: 1 to 20."],
    ["windowDays", 7, 730, "How long a strike counts: 7 to 730 days."],
    ["suspendDays", 1, 365, "How long posting is paused: 1 to 365 days."],
    ["communityStrikes", 1, 50, "Strikes before a community is warned: 1 to 50."],
  ];
  for (const [k, lo, hi, msg] of whole) {
    if (o[k] === undefined) continue;
    const n = num(o[k]);
    if (!Number.isInteger(n) || n < lo || n > hi) return msg;
    (out as Record<string, unknown>)[k] = n;
  }
  if (out.reviewAt >= out.blockAt) return "The review level must be below the block level.";
  if (out.teenReviewAt >= out.teenBlockAt) return "The teen review level must be below the teen block level.";
  if (out.teenBlockAt > out.blockAt || out.teenReviewAt > out.reviewAt) return "Teens' levels must be the same or stricter (lower) than adults'.";
  return out;
}

// ── Deciding ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Outcome = "pass" | "hold" | "block" | "csam" | "csam_review";
export type Decision = { outcome: Outcome; finding?: Finding };
const RANK: Record<Outcome, number> = { pass: 0, hold: 1, csam_review: 2, block: 3, csam: 4 };

export function decideOne(f: Finding, o: { teen: boolean; settings: CheckSettings }): Outcome {
  const s = o.settings;
  if (f.category === "none") return "pass";
  if (f.category === "unclear") return "hold";
  const review = o.teen ? s.teenReviewAt : s.reviewAt;
  if (f.category === "csam") return f.confidence >= s.csamBanAt ? "csam" : f.confidence >= Math.min(review, 0.2) ? "csam_review" : "pass";
  const block = o.teen ? s.teenBlockAt : s.blockAt;
  if (f.confidence >= block) {
    // News, medical and art are judged in context: a violent news photo or a medical picture goes to a person rather than being blocked
    // outright. Sexual content and hate have no such exception (payment partners and the app stores forbid them).
    const contextual = f.context !== "none" && f.category !== "sexual" && f.category !== "hate";
    return contextual && !o.teen ? "hold" : "block";
  }
  return f.confidence >= review ? "hold" : "pass";
}

// The most serious outcome across everything found (ties: the surer finding).
export function decide(findings: Finding[], o: { teen: boolean; settings: CheckSettings }): Decision {
  let best: Decision = { outcome: "pass" };
  for (const f of findings) {
    const out = decideOne(f, o);
    if (out === "pass") continue;
    if (RANK[out] > RANK[best.outcome] || (RANK[out] === RANK[best.outcome] && f.confidence > (best.finding?.confidence ?? -1))) best = { outcome: out, finding: f };
  }
  return best;
}

// The checker's answer, tidied: unknown categories become "unclear", confidence is kept between 0 and 1, an item the post doesn't have
// becomes the first item.
export function parseFindings(raw: unknown, items: string[]): Finding[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { findings?: unknown }).findings) ? (raw as { findings: unknown[] }).findings : [];
  return list.slice(0, 40).map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const category = (FOUND as readonly string[]).includes(String(o.category)) ? (String(o.category) as FoundCategory) : "unclear";
    const c = Number(o.confidence);
    const item = items.includes(String(o.item)) ? String(o.item) : items[0] ?? "text";
    const context = (CONTEXTS as readonly string[]).includes(String(o.context)) ? (String(o.context) as CheckContext) : "none";
    return { category, confidence: Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0, item, reason: String(o.reason ?? "").slice(0, 300), context };
  });
}

// ── Strikes ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Strike = { flagId: string; at: string; category: string; kind: ContentKind; removed?: boolean };
// contentStanding/{uid}: the member's strikes, and whether posting is paused or the account was banned for content.
export type Standing = { strikes: Strike[]; postingSuspendedUntil?: string; suspensions?: number; lastSuspendedAt?: string; banned?: boolean; appeal?: { text: string; at: string; status: "pending" | "upheld" | "rejected" } };

const DAY = 86_400_000;
export const activeStrikes = (strikes: Strike[], now: Date, windowDays: number) =>
  strikes.filter((s) => !s.removed && now.getTime() - Date.parse(s.at) < windowDays * DAY);

// What a new strike leads to. `standing` already holds the new strike. After a suspension, any further strike is a ban.
export function afterStrike(standing: Standing, now: Date, s: CheckSettings): "none" | "suspend" | "ban" {
  if (standing.banned) return "ban";
  if ((standing.suspensions ?? 0) >= 1) return "ban";
  return activeStrikes(standing.strikes, now, s.windowDays).length >= s.strikesToSuspend ? "suspend" : "none";
}

export const postingPausedUntil = (st: Standing | undefined, now: Date): string | null =>
  st?.postingSuspendedUntil && Date.parse(st.postingSuspendedUntil) > now.getTime() ? st.postingSuspendedUntil : null;

// A community: strikes on its owner or moderators for content in it. First the members are warned, then it is closed.
export function communityStep(modStrikes: number, warned: boolean, threshold: number): "none" | "warn" | "close" {
  if (modStrikes < threshold) return "none";
  return warned ? "close" : "warn";
}

// ── Words ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function itemWords(item: string): string {
  const pic = /^picture (\d+)$/.exec(item);
  if (pic) return `photo ${pic[1]}`;
  const vid = /^video (\d+)$/.exec(item);
  if (vid) return vid[1] === "1" ? "the video" : `video ${vid[1]}`;
  return "the text";
}
export const findingWords = (f: Pick<Finding, "category" | "item">) =>
  f.category === "none" ? "nothing" : `${CATEGORY_LABEL[f.category]} in ${itemWords(f.item)}`;
export const blockedTitle = (item: string) =>
  item.startsWith("picture") ? "This photo can't be posted" : item.startsWith("video") ? "This video can't be posted" : "This can't be published";

export const dayWords = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

// ── The error a create path throws, and how a browser reads it ───────────────────────────────────────────────────────────────────
export type CheckDetail = {
  outcome: "blocked" | "held" | "paused" | "banned";
  title: string;
  message: string;
  flagId?: string;
  category?: FoundCategory;
  item?: string;
  url?: string; // the picture that was found (so "Remove the photo" knows which one)
  strike?: { n: number; of: number; windowDays: number };
  until?: string;
};

export class ContentCheckError extends Error {
  constructor(public status: number, public detail: CheckDetail) {
    super(detail.message);
    this.name = "ContentCheckError";
  }
}
export const isContentCheckError = (e: unknown): e is ContentCheckError =>
  e instanceof ContentCheckError || (!!e && typeof e === "object" && (e as { name?: string }).name === "ContentCheckError" && "detail" in (e as object));

// The response body for one (routes add it to their usual { error }).
export const contentCheckBody = (e: ContentCheckError) => ({ error: e.message, contentCheck: e.detail });

// In the browser: an Error from an API reply, carrying the check's detail when there is one.
export type CheckedError = Error & { contentCheck?: CheckDetail };
export function apiError(data: { error?: unknown; contentCheck?: unknown } | null | undefined, fallback: string): CheckedError {
  const e = new Error(typeof data?.error === "string" && data.error ? data.error : fallback) as CheckedError;
  if (data?.contentCheck && typeof data.contentCheck === "object") e.contentCheck = data.contentCheck as CheckDetail;
  return e;
}
export const contentCheckOf = (e: unknown): CheckDetail | null => (e && typeof e === "object" && "contentCheck" in e ? ((e as CheckedError).contentCheck ?? null) : null);

// The full message a member sees when a post is blocked (also the error text, for screens that show only words).
export function blockedMessage(f: Pick<Finding, "category" | "item">, strike: { n: number; of: number; windowDays: number } | null, consequence: "none" | "suspend" | "ban", until?: string): string {
  const head = `Our check found ${findingWords(f)}. Your post was not published and nobody saw it.`;
  if (consequence === "ban") return `${head} Your account has been suspended because this happened again after a suspension. You can appeal on your account page.`;
  if (consequence === "suspend") return `${head} That is ${strike?.n ?? ""} strikes, so posting is paused${until ? ` until ${dayWords(until)}` : ""}. You can still read and message, and you can appeal on your account page.`;
  return `${head}${strike ? ` This is strike ${strike.n} of ${strike.of}. Strikes clear after ${strike.windowDays} days.` : ""} Think we got it wrong? Ask for a review.`;
}
export const heldMessage = (f: Pick<Finding, "category" | "item">) =>
  f.category === "unclear"
    ? "Our check couldn't decide about this, so a person on our Trust & safety team will look at it. It isn't published yet, and it isn't a strike."
    : `Our check thinks there may be ${findingWords(f)}. A person on our Trust & safety team will look at it before it is published. It isn't a strike.`;
export const pausedMessage = (until: string) => `Posting is paused on your account until ${dayWords(until)}. You can still read and message. See your account page to appeal.`;

// A short, plain excerpt for queues and bells.
export const excerpt = (s: string, n = 90) => {
  const t = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/[#*_>`~]/g, "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

// Picture links written into a journal's Markdown (![alt](url)), so they are checked too.
export function markdownImages(md: string, max = 8): string[] {
  const out: string[] = [];
  for (const m of md.matchAll(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
    if (out.length >= max) break;
  }
  return out;
}
