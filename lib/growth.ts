// Growth measurement (docs/GROWTH.md, step 1 of the growth plan). Pure: no database here, so the middleware, the pages, the server
// and the tests share it.
//
// - First touch: where a visitor first came from, worked out once from first-party data only (?by=<username>, ?src=, utm_* tags, the
//   referring site's host name and the landing page) and kept in the FIRST_TOUCH_COOKIE (httpOnly, like the referral cookie). At
//   sign-up it is attached to the account as a channel name and a small detail (a creator's username or a campaign tag), never a
//   full address, an IP or anything for ad networks.
// - First value: the first time a member does what they came for (FIRST_VALUES), recorded once per kind.
// - Returns: whether they come back in weeks 1 to 4 after joining, and what brought them (?r=<trigger> on our bells, emails and
//   reminders; "came back on their own" is the rest).
// - computeGrowth: the numbers on Admin → Growth, from the rows lib/growth-server.ts reads once an hour.
import { REFERRAL_COOKIE_DAYS } from "./referrals";
import { sourceOf, type Source } from "./analytics";

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;
// The first-touch cookie lives as long as a referral link does: a visitor who comes back after that starts again.
export const FIRST_TOUCH_COOKIE = "na_src";
export const FIRST_TOUCH_DAYS = REFERRAL_COOKIE_DAYS;
// A short-lived, readable flag the middleware sets so the page reports the visit once (one small server write): "v" a new visitor,
// "o" a creator's link opened. The browser can't read the first-touch cookie itself.
export const PING_COOKIE = "na_ping";
// An install counted before the visitor had an account, so the account gets it when they join.
export const INSTALL_COOKIE = "na_inst";
// "Still active": seen in the last ACTIVE_DAYS days.
export const ACTIVE_DAYS = 14;
// How far back the growth snapshot reads: the longest range plus the five weeks it takes to see week 4.
export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];
export const MATURE_DAYS = 35;
export const LOOKBACK_DAYS = 90 + MATURE_DAYS;

// ── Channels ──
export const CHANNELS = [
  { key: "creators", label: "Creators' links", icon: "👤" },
  { key: "exam-prep", label: "Exam Prep", icon: "📝" },
  { key: "jobs", label: "Jobs", icon: "💼" },
  { key: "academy", label: "Academy", icon: "🎓" },
  { key: "life", label: "Notes Life", icon: "🎮" },
  { key: "install", label: "Install page", icon: "📲" },
  { key: "search", label: "Search", icon: "🔎" },
  { key: "whatsapp", label: "WhatsApp shares", icon: "💬" },
  { key: "social", label: "Social", icon: "📣" },
  { key: "ads", label: "Ads", icon: "📢" },
  { key: "direct", label: "Direct", icon: "🔗" },
] as const;
export type Channel = (typeof CHANNELS)[number]["key"];
export const CHANNEL_KEYS = CHANNELS.map((c) => c.key) as Channel[];
export const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.key, c.label])) as Record<Channel, string>;
export const CHANNEL_ICON = Object.fromEntries(CHANNELS.map((c) => [c.key, c.icon])) as Record<Channel, string>;
export const isChannel = (c: unknown): c is Channel => typeof c === "string" && (CHANNEL_KEYS as string[]).includes(c);

export type Touch = { channel: Channel; detail: string; via: Source; day: string }; // day: yyyy-mm-dd

const SOCIAL: Source[] = ["facebook", "instagram", "x", "linkedin", "tiktok", "youtube"];
const ADS_MEDIUM = /^(cpc|ppc|paid|paid[-_ ]?social|paid[-_ ]?search|display|ads?)$/;
const USERNAME = /^[a-z0-9_-]{2,30}$/;
// A detail is a username, a campaign tag or a host name: short, lower case, nothing that could carry personal data.
export function cleanDetail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9._-]/g, "").slice(0, 40);
}
const viaChannel = (s: Source): Channel => (s === "search" ? "search" : s === "whatsapp" ? "whatsapp" : SOCIAL.includes(s) ? "social" : "direct");

// The product a landing page belongs to. `role` is the host's (lib/host.ts roleOf): Notes Life and Exam Prep have their own addresses.
export function productOf(path: string, role: import("./host").HostRole = "main"): { channel: Channel; detail: string } | null {
  if (role === "life") return { channel: "life", detail: "" };
  if (role === "prep") return { channel: "exam-prep", detail: "" };
  const p = String(path || "/").toLowerCase();
  const who = /^\/(?:r|u|s)\/([^/?#]+)/.exec(p);
  if (who && USERNAME.test(decodeURIComponent(who[1]))) return { channel: "creators", detail: decodeURIComponent(who[1]) };
  if (/^\/(jobs|nana-jobs)(\/|$)/.test(p)) return { channel: "jobs", detail: "" };
  if (/^\/academy(\/|$)/.test(p)) return { channel: "academy", detail: "" };
  if (/^\/exam-prep(\/|$)/.test(p)) return { channel: "exam-prep", detail: "" };
  if (/^\/life(\/|$)/.test(p)) return { channel: "life", detail: "" };
  if (/^\/install(\/|$)/.test(p)) return { channel: "install", detail: "" };
  return null;
}

// Where this first visit came from. Order: a creator's name (?by= or their link), a paid ad (utm_medium), a ?src= naming a channel,
// the product the visitor landed on, then the referring site (search, WhatsApp, social), else Direct.
export function classifyTouch(input: {
  path: string; role?: import("./host").HostRole; params: Record<string, string | null | undefined>; refHost?: string | null; ownHosts: string[]; now: Date;
}): Touch {
  const q = (k: string) => String(input.params[k] ?? "").trim();
  const via = sourceOf(input.refHost ?? "", q("utm_source"), input.ownHosts);
  const day = input.now.toISOString().slice(0, 10);
  const campaign = cleanDetail(q("utm_campaign") || q("src") || q("utm_source"));
  const by = cleanDetail(q("by"));
  if (USERNAME.test(by)) return { channel: "creators", detail: by, via, day };
  if (ADS_MEDIUM.test(q("utm_medium").toLowerCase())) return { channel: "ads", detail: campaign, via, day };
  const src = cleanDetail(q("src"));
  if (isChannel(src)) return { channel: src, detail: cleanDetail(q("utm_campaign")), via, day };
  const product = productOf(input.path, input.role);
  if (product) return { channel: product.channel, detail: product.detail || campaign, via, day };
  const ch = viaChannel(via);
  const host = cleanDetail(String(input.refHost ?? "").replace(/^www\./, ""));
  return { channel: ch, detail: campaign || (via === "inside" ? "" : host), via, day };
}

const SOURCES_OK = ["direct", "inside", "search", "whatsapp", "facebook", "instagram", "x", "linkedin", "tiktok", "youtube", "other"];
export const encodeTouch = (t: Touch) => ["1", t.channel, cleanDetail(t.detail), t.via, t.day.replace(/-/g, "")].join("|");
export function decodeTouch(v: unknown): Touch | null {
  const parts = String(v ?? "").split("|");
  if (parts.length !== 5 || parts[0] !== "1" || !isChannel(parts[1]) || !SOURCES_OK.includes(parts[3]) || !/^\d{8}$/.test(parts[4])) return null;
  const d = parts[4];
  return { channel: parts[1], detail: cleanDetail(parts[2]), via: parts[3] as Source, day: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` };
}
// What the account keeps: the channel and a small detail. Teens and children keep the channel only, so no creator ever sees them.
export function signupSource(t: Touch | null, young: boolean): { channel: Channel; detail: string; via: Source } {
  const touch = t ?? { channel: "direct" as Channel, detail: "", via: "direct" as Source, day: "" };
  return { channel: touch.channel, detail: young ? "" : touch.detail, via: young ? "direct" : touch.via };
}

// ── Returns: what brought a member back ──
export const TRIGGERS = [
  { key: "bell", label: "Bell (reply, gift, follow)", icon: "🔔" },
  { key: "push", label: "Phone notification", icon: "📳" },
  { key: "digest", label: "Weekly digest email", icon: "✉️" },
  { key: "nana-jobs", label: "Nana Jobs shortlist", icon: "🧭" },
  { key: "reminder", label: "Booking or event reminder", icon: "📅" },
  { key: "own", label: "Came back on their own", icon: "" },
] as const;
export type Trigger = (typeof TRIGGERS)[number]["key"];
export const TRIGGER_KEYS = TRIGGERS.map((t) => t.key) as Trigger[];
export const cleanTrigger = (r: unknown): Trigger => {
  const s = String(r ?? "").trim().toLowerCase();
  return (TRIGGER_KEYS as string[]).includes(s) ? (s as Trigger) : "own";
};
// A link we send (a bell, an email, a reminder) tagged with what it is, so a return through it is counted against it. Links that
// already say, links to other sites and our API addresses are left alone.
export function withReturn(href: string, trigger: Exclude<Trigger, "own">, ourOrigin?: string): string {
  const h = String(href ?? "");
  if (!h) return h;
  const relative = h.startsWith("/") && !h.startsWith("//");
  if (!relative && !(ourOrigin && h.startsWith(ourOrigin.replace(/\/$/, "") + "/")) && !(ourOrigin && h === ourOrigin)) return h;
  const [base, hash] = h.split("#", 2);
  const path = relative ? base : base.slice(ourOrigin!.replace(/\/$/, "").length) || "/";
  if (path.startsWith("/api/") || /[?&]r=/.test(base)) return h;
  return `${base}${base.includes("?") ? "&" : "?"}r=${trigger}${hash !== undefined ? `#${hash}` : ""}`;
}

// ── First value ──
export const FIRST_VALUES = [
  { key: "read", label: "Read a journal to the end" },
  { key: "journal", label: "Published a journal" },
  { key: "job", label: "Applied for a job" },
  { key: "shortlist", label: "Viewed a Nana Jobs shortlist" },
  { key: "lesson", label: "Finished an Academy lesson" },
  { key: "exam", label: "Finished an Exam Prep practice test" },
  { key: "life", label: "Played a Notes Life day" },
  { key: "sale", label: "Recorded a Business books sale" },
  { key: "booking", label: "Made a booking" },
  { key: "community", label: "Posted or replied in a community" },
] as const;
export type FirstValue = (typeof FIRST_VALUES)[number]["key"];
export const FIRST_VALUE_KEYS = FIRST_VALUES.map((f) => f.key) as FirstValue[];
export const isFirstValue = (k: unknown): k is FirstValue => typeof k === "string" && (FIRST_VALUE_KEYS as string[]).includes(k);
// Each member is judged on what they came for: a product channel counts that product's first value; everyone else any of them.
export const VALUE_FOR: Partial<Record<Channel, FirstValue[]>> = {
  "exam-prep": ["exam"], jobs: ["job", "shortlist"], academy: ["lesson"], life: ["life"],
};
export const VALUE_TEXT: Partial<Record<Channel, string>> = {
  "exam-prep": "finished one practice test", jobs: "applied for a job or viewed a Nana Jobs shortlist", academy: "finished one lesson", life: "played one Notes Life day",
};
export const ANY_VALUE_TEXT = "a journal read to the end or published, a job applied for, a lesson or practice test finished, a Notes Life day played, a sale recorded, a booking made, or a community post or reply";
export function reachedValue(channel: Channel, kinds: Iterable<string>): boolean {
  const want = VALUE_FOR[channel];
  for (const k of kinds) if (isFirstValue(k) && (!want || want.includes(k))) return true;
  return false;
}

// ── Weeks after joining ──
// Week n is days 7n to 7n+6 after joining (week 1 is the second week). A visit on the day they joined is not a return.
export function weekOf(joinedMs: number, atMs: number): number {
  return Math.floor((atMs - joinedMs) / WEEK_MS);
}
// Whether week n is over for someone who joined at joinedMs, so whether they came back in it is final.
export const weekOver = (joinedMs: number, n: number, nowMs: number) => nowMs >= joinedMs + (n + 1) * WEEK_MS;
export const isActive = (lastSeenDay: string | undefined, now: Date) => !!lastSeenDay && Date.parse(lastSeenDay) >= now.getTime() - ACTIVE_DAYS * DAY_MS;
export const monthKey = (d: Date) => d.toISOString().slice(0, 7).replace("-", "");

// ── The snapshot ──
export type MemberRow = {
  uid: string; joinedAt: string; channel: Channel; detail?: string; young?: boolean; installedAt?: string;
  weeks?: number[]; lastSeenDay?: string; returns?: Partial<Record<Trigger, number>>;
};
export type FirstRow = { uid: string; kind: string; at: string };
export type PaymentRow = { uid: string; at: string };
export type DailyRow = { day: string; visits?: Partial<Record<Channel, number>>; installs?: Partial<Record<Channel, number>> };
export type ReferralRow = { uid: string; by: string; at: string }; // referrals/{uid}: referredByUsername, referredAt
export type GrowthInput = { members: MemberRow[]; firsts: FirstRow[]; payments: PaymentRow[]; daily: DailyRow[]; referrals: ReferralRow[] };

export type FunnelStep = { key: "visited" | "signed" | "value" | "week1" | "week4" | "paid"; label: string; count: number };
export type Funnel = { steps: FunnelStep[]; drop: { from: string; to: string; pct: number } | null; notYet: { week1: number; week4: number } };
export type ChannelRow = { channel: Channel; visits: number; signups: number; installs: number; valuePct: number | null; week4Pct: number | null };
export type RangeReport = {
  days: RangeDays; visits: number; signups: number; installs: number; valuePct: number | null; week4Pct: number | null; week4Base: number;
  channels: ChannelRow[]; funnels: Partial<Record<Channel | "all", Funnel>>;
  creators: { username: string; joined: number; installed: number; active: number; week4Pct: number | null }[];
};
export type CohortRow = { week: string; joined: number; back: (number | null)[] }; // back[0..3]: % back in weeks 1 to 4, null until that week is over
export type TriggerRow = { trigger: Trigger; label: string; icon: string; returns: number; pct: number };
export type GrowthReport = { generatedAt: string; ranges: Record<string, RangeReport>; cohorts: CohortRow[]; triggers: TriggerRow[] };

export const pct = (n: number, of: number): number | null => (of > 0 ? Math.round((n / of) * 100) : null);
const sumMap = (rows: DailyRow[], field: "visits" | "installs", ch?: Channel) =>
  rows.reduce((a, r) => a + (ch ? Number(r[field]?.[ch] ?? 0) : Object.values(r[field] ?? {}).reduce((x, y) => x + Number(y ?? 0), 0)), 0);
const backIn = (m: MemberRow, n: number) => (m.weeks ?? []).includes(n);

// Monday (UTC) of the week a date falls in, as yyyy-mm-dd: the weekly cohorts.
export function cohortWeek(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}

// The step where most people leave: the biggest share lost between two steps. The week steps count only members whose week is over.
export function funnelFor(members: MemberRow[], visits: number, values: Map<string, Set<string>>, paid: Map<string, number>, now: Date): Funnel {
  const nowMs = now.getTime();
  const j = (m: MemberRow) => Date.parse(m.joinedAt);
  const hasValue = (m: MemberRow) => reachedValue(m.channel, values.get(m.uid) ?? []);
  const valued = members.filter(hasValue);
  const w1 = valued.filter((m) => backIn(m, 1));
  const w4 = w1.filter((m) => backIn(m, 4));
  const paying = members.filter((m) => (paid.get(m.uid) ?? -Infinity) >= j(m));
  const steps: FunnelStep[] = [
    { key: "visited", label: "Visited", count: Math.max(visits, members.length) },
    { key: "signed", label: "Signed up", count: members.length },
    { key: "value", label: "First value", count: valued.length },
    { key: "week1", label: "Back in week 1", count: w1.length },
    { key: "week4", label: "Back in week 4", count: w4.length },
    { key: "paid", label: "Paid", count: paying.length },
  ];
  // Rates between steps, on the members who could have made the step.
  const rates: { from: string; to: string; kept: number; base: number }[] = [
    { from: "Visited", to: "Signed up", kept: members.length, base: visits },
    { from: "Signed up", to: "First value", kept: valued.length, base: members.length },
    { from: "First value", to: "Back in week 1", kept: valued.filter((m) => weekOver(j(m), 1, nowMs) && backIn(m, 1)).length, base: valued.filter((m) => weekOver(j(m), 1, nowMs)).length },
    { from: "Back in week 1", to: "Back in week 4", kept: w1.filter((m) => weekOver(j(m), 4, nowMs) && backIn(m, 4)).length, base: w1.filter((m) => weekOver(j(m), 4, nowMs)).length },
  ];
  let drop: Funnel["drop"] = null;
  for (const r of rates) {
    if (r.base <= 0 || r.kept > r.base) continue;
    const lost = Math.round(((r.base - r.kept) / r.base) * 100);
    if (lost > 0 && (!drop || lost > drop.pct)) drop = { from: r.from, to: r.to, pct: lost };
  }
  return {
    steps, drop,
    notYet: { week1: members.filter((m) => !weekOver(j(m), 1, nowMs)).length, week4: members.filter((m) => !weekOver(j(m), 4, nowMs)).length },
  };
}

// Week 4 for a range: the members who joined in a range as long, ending five weeks ago, so everyone's week 4 is over.
function week4Of(members: MemberRow[], days: number, nowMs: number): { pct: number | null; base: number } {
  const end = nowMs - MATURE_DAYS * DAY_MS, start = end - days * DAY_MS;
  const base = members.filter((m) => { const t = Date.parse(m.joinedAt); return t >= start && t < end; });
  return { pct: pct(base.filter((m) => backIn(m, 4)).length, base.length), base: base.length };
}

export function computeGrowth(input: GrowthInput, now = new Date()): GrowthReport {
  const nowMs = now.getTime();
  const values = new Map<string, Set<string>>();
  for (const f of input.firsts) { const s = values.get(f.uid) ?? new Set<string>(); s.add(f.kind); values.set(f.uid, s); }
  const paid = new Map<string, number>(); // the member's latest successful payment
  for (const p of input.payments) { const t = Date.parse(p.at); if (Number.isFinite(t) && t > (paid.get(p.uid) ?? -Infinity)) paid.set(p.uid, t); }
  const members = input.members.filter((m) => Number.isFinite(Date.parse(m.joinedAt)) && isChannel(m.channel));
  const byUid = new Map(members.map((m) => [m.uid, m]));
  const valueOf = (m: MemberRow) => reachedValue(m.channel, values.get(m.uid) ?? []);

  // Everyone each creator brought, for their week 4 (never teens or children).
  const everyone = new Map<string, MemberRow[]>();
  const bring = (u: string, m: MemberRow | undefined) => { if (!m || m.young) return; const l = everyone.get(u) ?? []; if (!l.includes(m)) l.push(m); everyone.set(u, l); };
  for (const r of input.referrals) bring(r.by, byUid.get(r.uid));
  for (const m of members) if (m.channel === "creators" && m.detail) bring(m.detail, m);

  const ranges: Record<string, RangeReport> = {};
  for (const days of RANGES) {
    const since = nowMs - days * DAY_MS;
    const inRange = members.filter((m) => Date.parse(m.joinedAt) >= since);
    const daily = input.daily.filter((d) => Date.parse(d.day) >= since - DAY_MS + 1);
    const w4 = week4Of(members, days, nowMs);
    const channels: ChannelRow[] = CHANNEL_KEYS.map((ch) => {
      const mine = inRange.filter((m) => m.channel === ch);
      return {
        channel: ch, visits: sumMap(daily, "visits", ch), signups: mine.length, installs: sumMap(daily, "installs", ch),
        valuePct: pct(mine.filter(valueOf).length, mine.length), week4Pct: week4Of(members.filter((m) => m.channel === ch), days, nowMs).pct,
      };
    }).filter((c) => c.signups || c.visits || c.installs).sort((a, b) => b.signups - a.signups || b.visits - a.visits);
    const funnels: RangeReport["funnels"] = { all: funnelFor(inRange, sumMap(daily, "visits"), values, paid, now) };
    for (const c of channels) funnels[c.channel] = funnelFor(inRange.filter((m) => m.channel === c.channel), c.visits, values, paid, now);

    // Creators' links: who joined through each creator, from the referral programme and from first touch, never teens or children.
    const byCreator = new Map<string, Set<string>>();
    const add = (u: string, uid: string) => { const s = byCreator.get(u) ?? new Set<string>(); s.add(uid); byCreator.set(u, s); };
    for (const r of input.referrals) if (Date.parse(r.at) >= since && !byUid.get(r.uid)?.young) add(r.by, r.uid);
    for (const m of inRange) if (m.channel === "creators" && m.detail && !m.young) add(m.detail, m.uid);
    const creators = [...byCreator.entries()].map(([username, uids]) => {
      const ms = [...uids].map((u) => byUid.get(u)).filter((m): m is MemberRow => !!m);
      // Week 4 needs five weeks, so it's over everyone the creator brought whose week 4 is over (as far back as the snapshot reads).
      const ripe = (everyone.get(username) ?? []).filter((m) => weekOver(Date.parse(m.joinedAt), 4, nowMs));
      return {
        username, joined: uids.size, installed: ms.filter((m) => !!m.installedAt).length, active: ms.filter((m) => isActive(m.lastSeenDay, now)).length,
        week4Pct: pct(ripe.filter((m) => backIn(m, 4)).length, ripe.length),
      };
    }).sort((a, b) => b.joined - a.joined || a.username.localeCompare(b.username)).slice(0, 20);

    ranges[String(days)] = {
      days, visits: sumMap(daily, "visits"), signups: inRange.length, installs: sumMap(daily, "installs"),
      valuePct: pct(inRange.filter(valueOf).length, inRange.length), week4Pct: w4.pct, week4Base: w4.base, channels, funnels, creators,
    };
  }

  // Weekly cohorts: the last eight weeks people joined in, newest last.
  const weeks = new Map<string, MemberRow[]>();
  for (const m of members) { const w = cohortWeek(m.joinedAt); weeks.set(w, [...(weeks.get(w) ?? []), m]); }
  const cohorts: CohortRow[] = [...weeks.keys()].sort().slice(-8).map((week) => {
    const ms = weeks.get(week)!;
    const start = Date.parse(week);
    return {
      week, joined: ms.length,
      // A week counts once it is over for the whole cohort (the cohort's last day plus that week).
      back: [1, 2, 3, 4].map((n) => (nowMs >= start + 6 * DAY_MS + (n + 1) * WEEK_MS ? pct(ms.filter((m) => backIn(m, n)).length, ms.length) : null)),
    };
  });

  // What brings them back: every return (a day seen after the day they joined, up to week 4) in the last 90 days' members.
  const since90 = nowMs - 90 * DAY_MS;
  const totals = new Map<Trigger, number>();
  for (const m of members) if (Date.parse(m.joinedAt) >= since90 - MATURE_DAYS * DAY_MS) for (const [k, n] of Object.entries(m.returns ?? {})) totals.set(cleanTrigger(k), (totals.get(cleanTrigger(k)) ?? 0) + Number(n || 0));
  const all = [...totals.values()].reduce((a, b) => a + b, 0);
  const triggers: TriggerRow[] = TRIGGERS.map((t) => ({ trigger: t.key, label: t.label, icon: t.icon, returns: totals.get(t.key) ?? 0, pct: pct(totals.get(t.key) ?? 0, all) ?? 0 }))
    .sort((a, b) => Number(a.trigger === "own") - Number(b.trigger === "own") || b.returns - a.returns);

  return { generatedAt: now.toISOString(), ranges, cohorts, triggers };
}

// A member's own invite link counts (Your invite link on the Referrals page).
export type InviteStats = { opened: number; joined: number; installed: number; active: number };
export function inviteLink(appOrigin: string, username: string): string {
  return `${appOrigin.replace(/\/$/, "")}/install?by=${encodeURIComponent(username)}`;
}
