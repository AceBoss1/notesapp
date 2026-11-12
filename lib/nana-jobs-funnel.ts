// Nana Jobs: the funnel. Remove duplicates → hard filters → keyword prescore → the AI rubric on the top N → link check → the shortlist.
// Everything here is pure (no Firestore); the link check takes `fetch` as an argument.
//
// Adapted from Shortlist (github.com/vicintel/shortlist-engine: src/util.js, src/filter.js, src/prescore.js, src/llmScore.js,
// src/providers/schema.js and src/verify.js), generalised from one engineer's profile to any member's scoring profile.
// MIT License. Copyright (c) 2026 Victor Dickson. Permission is hereby granted, free of charge, to any person obtaining a copy of this
// software and associated documentation files (the "Software"), to deal in the Software without restriction, subject to the conditions
// in the full notice in THIRD_PARTY_NOTICES at the root of this repository. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
import { createHash } from "node:crypto";
import type { CvReview, NjProfile, PoolJob, Seniority, ShortJob } from "./nana-jobs";
import { SENIORITY, SHORTLIST } from "./nana-jobs";
import type { Fetch } from "./ai-providers";

// ---- text ----
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", mdash: "—", ndash: "–", hellip: "…", bull: "•" };
// HTML to readable plain text: job descriptions arrive as HTML from most sources.
export function toText(html: unknown): string {
  if (!html) return "";
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, e: string) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}
export const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();
const words = (s: unknown) => norm(s).replace(/[^a-z0-9+#.]+/g, " ").trim().split(" ").filter(Boolean);
const has = (hay: string, term: string) => { const t = norm(term); if (!t) return false; const i = hay.indexOf(t); if (i < 0) return false; const before = hay[i - 1], after = hay[i + t.length]; return !(before && /[a-z0-9]/.test(before)) && !(after && /[a-z0-9]/.test(after)); };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// The same role listed on a company board and mirrored by a feed must collapse to one, so the source isn't part of the identity:
// company + title + the first part of the location. Punctuation becomes a space ("Full-Stack" and "Full Stack" are one role).
export function jobHash(j: { company: string; title: string; location: string }): string {
  const t = norm(j.title).replace(/[^a-z0-9]+/g, " ").trim();
  const key = [norm(j.company), t, norm(j.location).split(/[,(]/)[0].trim()].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export const daysAgo = (iso: string | null | undefined, now = Date.now()) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.floor((now - t) / 86_400_000);
};

// A posting link that is a bare domain is a company homepage, not a vacancy.
export function hasPostingUrl(url: string): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try { return new URL(url).pathname.replace(/\/+$/, "") !== ""; } catch { return false; }
}

// Keep one of each opening; a Notes Jobs one wins (it has the Apply on #NotesApp button), then the first seen.
export function dedupe(jobs: PoolJob[]): PoolJob[] {
  const by = new Map<string, PoolJob>();
  for (const j of jobs) {
    const prev = by.get(j.hash);
    if (!prev || (!prev.notesJobId && j.notesJobId)) by.set(j.hash, j);
  }
  return [...by.values()];
}

// Trim a posting to a budget without losing the requirements: keep the opening, then the paragraphs that state requirements.
const REQUIREMENT_MARKERS = ["requirement", "qualification", "you have", "you'll have", "you will have", "you bring", "must have", "should have", "we're looking for", "we are looking for", "what you'll need", "what you need", "experience with", "years of", "proficien", "familiar with", "skills", "nice to have", "preferred", "ideal candidate", "responsibilities", "what you'll do", "tech stack", "location", "remote"];
export function fitToBudget(text: string, max = 2500): string {
  const body = String(text ?? "");
  if (body.length <= max) return body;
  const paras = body.split(/\n{2,}|\n(?=•)/);
  const kept = new Set<number>();
  let used = 0;
  for (let i = 0; i < paras.length && used + paras[i].length <= max * 0.45; i++) { kept.add(i); used += paras[i].length + 2; }
  const scored = paras.map((p, i) => ({ i, p, hits: REQUIREMENT_MARKERS.filter((m) => p.toLowerCase().includes(m)).length }))
    .filter((x) => !kept.has(x.i) && x.hits > 0).sort((a, b) => b.hits - a.hits || a.p.length - b.p.length);
  for (const { i, p } of scored) { if (used + p.length > max) continue; kept.add(i); used += p.length + 2; }
  if (!kept.size) return body.slice(0, max);
  const out: string[] = [];
  let prev = -1;
  for (const i of [...kept].sort((a, b) => a - b)) { if (prev >= 0 && i > prev + 1) out.push("[…]"); out.push(paras[i]); prev = i; }
  return out.join("\n\n").slice(0, max);
}

// ---- places ----
type Country = { name: string; re: RegExp; region: "africa" | "europe" | "other" };
const C = (name: string, region: Country["region"], alias = ""): Country => ({ name, region, re: new RegExp(`(^|[^a-z])(${[name, ...alias.split("|").filter(Boolean)].map((x) => x.replace(/[.]/g, "\\.")).join("|")})($|[^a-z])`) });
export const COUNTRIES: Country[] = [
  C("united states", "other", "usa|u.s.a.|u.s.|us|san francisco|new york|seattle|austin|boston|los angeles|chicago|denver|atlanta|miami|washington, dc"), C("canada", "other", "toronto|vancouver|montreal"), C("united kingdom", "europe", "uk|england|scotland|wales|britain|london|manchester|edinburgh"), C("ireland", "europe", "dublin"),
  C("germany", "europe", "deutschland|berlin|munich|münchen|hamburg|frankfurt|cologne"), C("france", "europe", "paris"), C("spain", "europe", "madrid|barcelona"), C("portugal", "europe", "lisbon|porto"), C("netherlands", "europe", "amsterdam|rotterdam"), C("belgium", "europe"),
  C("poland", "europe", "warsaw|krakow|kraków"), C("romania", "europe"), C("ukraine", "europe"), C("italy", "europe"), C("sweden", "europe", "stockholm"), C("norway", "europe"), C("denmark", "europe"),
  C("finland", "europe"), C("switzerland", "europe"), C("austria", "europe"), C("czech", "europe"), C("greece", "europe"), C("hungary", "europe"), C("estonia", "europe"),
  C("india", "other", "bangalore|bengaluru|mumbai|hyderabad|pune|delhi|chennai"), C("pakistan", "other"), C("bangladesh", "other"), C("philippines", "other"), C("vietnam", "other"), C("indonesia", "other"), C("singapore", "other"),
  C("malaysia", "other"), C("japan", "other", "tokyo"), C("china", "other"), C("australia", "other", "sydney|melbourne"), C("new zealand", "other"), C("brazil", "other"), C("mexico", "other"),
  C("argentina", "other"), C("colombia", "other"), C("chile", "other"), C("israel", "other", "tel aviv"), C("turkey", "other"), C("korea", "other"), C("taiwan", "other"),
  C("united arab emirates", "other", "uae|dubai"), C("saudi arabia", "other", "saudi"), C("qatar", "other"),
  C("nigeria", "africa", "lagos|abuja|port harcourt|ibadan|kano|enugu|kaduna|benin city|owerri|uyo|calabar|jos|ilorin|abeokuta|warri"), C("ghana", "africa", "accra|kumasi"), C("kenya", "africa", "nairobi|mombasa"), C("south africa", "africa", "cape town|johannesburg|durban|pretoria"), C("egypt", "africa", "cairo"), C("rwanda", "africa", "kigali"), C("uganda", "africa"),
  C("tanzania", "africa"), C("ethiopia", "africa"), C("senegal", "africa"), C("ivory coast", "africa", "côte d'ivoire|cote d'ivoire"), C("cameroon", "africa"),
  C("morocco", "africa"), C("tunisia", "africa"), C("zambia", "africa"), C("zimbabwe", "africa"), C("botswana", "africa"), C("benin", "africa"),
];
const GLOBAL_TOKENS = ["worldwide", "anywhere", "global", "international", "any location", "all countries", "distributed"];
const REGION_TOKENS: Record<Country["region"], string[]> = { africa: ["africa", "emea"], europe: ["europe", "emea", "eu"], other: [] };
const countryOf = (name: string) => COUNTRIES.find((c) => c.re.test(norm(name)));

function homeOf(p: Pick<NjProfile, "country" | "cities">) {
  const home = countryOf(p.country);
  const places = [...p.cities.map(norm), ...(home ? [] : [norm(p.country)].filter(Boolean))];
  const regions = home ? REGION_TOKENS[home.region] : [];
  // A region counts only on its own: "South Africa" names a country, it doesn't mean "anywhere in Africa".
  const withoutCountries = (s: string) => COUNTRIES.reduce((acc, c) => acc.replace(new RegExp(c.re.source, "g"), " "), s);
  const strict = (s: string) => (!!home && home.re.test(s)) || places.some((t) => has(s, t));
  return { home, strict, matches: (s: string) => strict(s) || regions.some((t) => has(withoutCountries(s), t)) };
}
// Legal locks that make a role useless to someone outside that country.
const LOCKS: { phrase: string; country: string }[] = [
  ...["security clearance", "ts/sci", "must be a us citizen", "u.s. citizenship is required", "us citizens only", "must reside in the united states", "must be located in the us", "us-based only", "authorized to work in the united states without sponsorship"].map((phrase) => ({ phrase, country: "united states" })),
  ...["uk-based only", "must have the right to work in the uk"].map((phrase) => ({ phrase, country: "united kingdom" })),
  { phrase: "eu residents only", country: "germany" },
];
const JUNK_TITLES = ["werkstudent", "praktikant", "praktikum", "ausbildung", "working student", "stagiaire", "becario"];
const STOP = new Set(["and", "the", "of", "for", "with", "a", "an", "in", "to", "or", "senior", "junior", "lead", "mid", "level", "role", "job", "remote", "sr", "jr", "i", "ii", "iii"]);
const roleWords = (roles: string[]) => [...new Set(roles.flatMap((r) => words(r.replace(/-/g, " ")).filter((w) => w.length > 2 && !STOP.has(w))))];
const BAND_ABOVE: Record<Seniority, RegExp | null> = {
  junior: /^(senior|sr\.?|staff|principal|distinguished|fellow|director|head|chief|vp|lead)\b/,
  mid: /^(staff|principal|distinguished|fellow|director|head|chief|vp)\b/,
  senior: /^(distinguished|fellow|director|head|chief|vp)\b/,
  lead: null,
};

export type Kept = PoolJob & { ageDays: number | null; locationFit: "eligible" | "unclear" };
// The free hard filters: freshness, the title gate, deal-breakers and where the member can work. Rejections are counted by reason.
export function hardFilter(jobs: PoolJob[], p: NjProfile, now = Date.now(), freshnessDays = 60): { kept: Kept[]; reasons: Record<string, number> } {
  const reasons: Record<string, number> = {};
  const bump = (r: string) => { reasons[r] = (reasons[r] || 0) + 1; };
  const gate = roleWords(p.roles);
  const deal = p.dealBreakers.map(norm).filter(Boolean);
  const { home, matches, strict } = homeOf(p);
  const band = BAND_ABOVE[(SENIORITY as readonly string[]).includes(p.seniority) ? p.seniority : "mid"];
  const kept: Kept[] = [];
  for (const job of jobs) {
    if (!job.title || !job.url || !job.company) { bump("incomplete"); continue; }
    const age = daysAgo(job.postedAt, now);
    if (age !== null && age > freshnessDays) { bump(`older than ${freshnessDays} days`); continue; }
    const title = norm(job.title).replace(/-/g, " ");
    if (JUNK_TITLES.some((t) => title.includes(t))) { bump("student or trainee post"); continue; }
    if (band && band.test(title)) { bump("above the level you want"); continue; }
    if (gate.length && !gate.some((w) => has(title, w))) { bump("title isn't a role you want"); continue; }
    const desc = norm(job.description);
    const hay = `${title} ${desc}`;
    const hit = deal.find((d) => hay.includes(d));
    if (hit) { bump(`deal-breaker: ${hit}`); continue; }
    const lock = LOCKS.find((l) => hay.includes(l.phrase) && home?.name !== l.country && !(l.country === "germany" && home?.region === "europe"));
    if (lock) { bump("needs citizenship or residence you don't have"); continue; }
    // "Remote" in the location, then a list of the countries they can hire in that leaves the member's out.
    const hireList = desc.match(/(?:able to hire in|can only hire in|hire in the following|eligible to work in one of|we can hire in)[^.]{0,600}/);
    if (hireList && !strict(hireList[0])) { bump("hires only in other countries"); continue; }
    const loc = norm(job.location);
    const remote = job.remoteHint === true || /(^|[^a-z])remote([^a-z]|$)/.test(loc) || job.tags.some((t) => norm(t) === "remote")
      || (job.remoteHint !== false && /(fully remote|100% remote|remote-first|remote first|work from anywhere)/.test(desc));
    const atHome = matches(loc);
    const global = GLOBAL_TOKENS.some((t) => has(loc, t));
    const locked = !atHome && !global ? COUNTRIES.find((c) => c !== home && c.re.test(loc)) : undefined;
    if (locked && remote) { bump("remote, but only from another country"); continue; }
    if (locked) { bump("on-site in another country"); continue; }
    if (remote && !p.remote && !atHome) { bump("remote (you chose on-site)"); continue; }
    // A city we don't know, with no country, passes as "unclear": the AI's location score judges it.
    kept.push({ ...job, ageDays: age, locationFit: atHome || global ? "eligible" : "unclear" });
  }
  return { kept, reasons };
}

// ---- the keyword prescore: free, crude on purpose. It decides which openings the member's AI reads, not who gets shortlisted. ----
const evidenceWords = (shipped: string[]) => [...new Set(shipped.flatMap((s) => words(s)).filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d/.test(w)))];
export type Prescored = Kept & { prescore: number; hits: string[] };
export function prescore(job: Kept, p: NjProfile): Prescored {
  const title = norm(job.title).replace(/-/g, " ");
  const body = `${title}\n${norm(job.description)}\n${job.tags.map(norm).join(" ")}`;
  const hits: string[] = [];
  let skills = 0;
  for (const s of p.skills) if (has(body, s)) { skills += 6; hits.push(s); }
  const roleFull = p.roles.some((r) => has(title, norm(r).replace(/-/g, " ")));
  const roleWord = roleWords(p.roles).some((w) => has(title, w));
  let ev = 0;
  for (const w of evidenceWords(p.shipped)) if (has(body, w)) ev += 3;
  const fresh = job.ageDays !== null && job.ageDays <= 14 ? 10 : job.ageDays !== null && job.ageDays <= 30 ? 5 : 0;
  const score = clamp(skills, 0, 36) + (roleFull ? 25 : roleWord ? 12 : 0) + clamp(ev, 0, 15) + fresh + (job.locationFit === "eligible" ? 8 : 0) + (job.notesJobId ? 6 : 0);
  return { ...job, prescore: clamp(Math.round(score), 0, 100), hits };
}
export const prescoreAll = (jobs: Kept[], p: NjProfile) => jobs.map((j) => prescore(j, p)).sort((a, b) => b.prescore - a.prescore);

// ---- the AI rubric: domain 25, stack 25, seniority 15, location 20, signal 15, a reason and the strongest risk ----
const bullets = (xs: string[], none = "(none given)") => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : none);
export function scoringSystem(p: NjProfile): string {
  return `You score job openings for one person. You are a hiring filter, not a cheerleader: a score that flatters them wastes their time.

WHO THEY ARE
Roles they want: ${p.roles.join(", ") || "(not given)"}
Level: ${p.seniority}
Lives in: ${p.country || "(not given)"}${p.cities.length ? `; can work on site in ${p.cities.join(", ")}` : ""}. ${p.remote ? "Happy to work remotely." : "Wants on-site work only."}
Lowest pay they'll take: ${p.payFloor || "(not given)"}
Skills: ${p.skills.join(", ") || "(not given)"}

WHAT THEY HAVE ACTUALLY SHIPPED (judge them on this and nothing else)
${bullets(p.shipped)}
A posting that names a technology or experience not in this list is naming a gap, not a match. Never credit them with something the
posting asks for just because the posting asks for it.

DEAL-BREAKERS
${bullets(p.dealBreakers)}

SCORING, for each job:
- domain 0-25: how close the work is to what they have shipped.
- stack 0-25: the tools and skills, against their real skills and shipped work.
- seniority 0-15: the level against theirs. Far above or below scores low.
- location 20 max: can someone living in ${p.country || "their country"} legally hold this role? "Remote, but only from the US" (or any other country that isn't theirs) is 0-4.
- signal 0-15: a clear description, a real product, pay stated, a named company.
- reason: one sentence, at most 25 words, on why it fits or doesn't. Concrete: name the shipped work it matches.
- risk: the single strongest reason they might not get it or would be unhappy in it. Blunt. Empty only if there is truly none.
Do not inflate for a famous company.

Answer with JSON only, exactly this shape, one entry per job id you were given:
{"results":[{"id":"j1","domain":0,"stack":0,"seniority":0,"location":0,"signal":0,"reason":"","risk":""}]}`;
}
export function scoringUser(jobs: (Pick<PoolJob, "company" | "title" | "location" | "salaryText" | "tags" | "description"> & { ageDays: number | null })[]): string {
  return jobs.map((j, i) => `### JOB j${i + 1}
COMPANY: ${j.company}
TITLE: ${j.title}
LOCATION: ${j.location || "(not stated)"}
POSTED: ${j.ageDays === null ? "unknown" : `${j.ageDays} days ago`}
PAY: ${j.salaryText || "(not stated)"}
TAGS: ${j.tags.slice(0, 10).join(", ") || "(none)"}
DESCRIPTION
${fitToBudget(j.description, 2500) || "(no description)"}`).join("\n\n");
}
export type Verdict = { domain: number; stack: number; seniority: number; location: number; signal: number; score: number; reason: string; risk: string };
const PARTS = { domain: 25, stack: 25, seniority: 15, location: 20, signal: 15 } as const;
// Guard against a plausible shape with nonsense in it: each part must be a number in its range; the score is their sum.
export function validateVerdicts(data: Record<string, unknown>, count: number): Map<number, Verdict> {
  const out = new Map<number, Verdict>();
  const rows = Array.isArray(data.results) ? data.results : [];
  for (const r of rows as Record<string, unknown>[]) {
    const m = /^j?(\d+)$/.exec(String(r?.id ?? "").trim());
    const i = m ? Number(m[1]) - 1 : -1;
    if (i < 0 || i >= count || out.has(i)) continue;
    const parts = {} as Record<keyof typeof PARTS, number>;
    let ok = true;
    for (const [k, max] of Object.entries(PARTS) as [keyof typeof PARTS, number][]) {
      const n = Number(r[k]);
      if (!Number.isFinite(n) || n < 0 || n > max) { ok = false; break; }
      parts[k] = Math.round(n);
    }
    if (!ok) continue;
    const score = parts.domain + parts.stack + parts.seniority + parts.location + parts.signal;
    out.set(i, { ...parts, score, reason: String(r.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 240), risk: String(r.risk ?? "").replace(/\s+/g, " ").trim().slice(0, 240) });
  }
  return out;
}

// ---- the shortlist ----
export type Candidate = Prescored & { verdict?: Verdict };
// AI-read openings that score well, best first; an opening the AI couldn't read keeps its keyword score, marked rough. Openings the
// member said aren't for them never come back.
export function pickShortlist(cands: Candidate[], hidden: Set<string>, max: number = SHORTLIST.max): Candidate[] {
  const pool = cands.filter((c) => !hidden.has(c.hash));
  const ai = pool.filter((c) => c.verdict).sort((a, b) => b.verdict!.score - a.verdict!.score);
  const strong = ai.filter((c) => c.verdict!.score >= SHORTLIST.threshold);
  const rough = pool.filter((c) => !c.verdict).sort((a, b) => b.prescore - a.prescore);
  const out = [...strong];
  // Never quietly short: fill up to the minimum with the best of the rest (the AI's weaker picks first, then rough ones).
  for (const c of [...ai.filter((c) => c.verdict!.score < SHORTLIST.threshold), ...rough]) { if (out.length >= SHORTLIST.min) break; out.push(c); }
  // Rough openings ride along after the AI's picks when the AI failed for some of them.
  for (const c of rough) { if (out.length >= max) break; if (!out.includes(c) && c.prescore >= 40) out.push(c); }
  return out.slice(0, max);
}
export function toShort(c: Candidate, link: ShortJob["link"]): ShortJob {
  const v = c.verdict;
  return {
    hash: c.hash, title: c.title, company: c.company, location: c.location, url: c.url, source: c.source, sourceLabel: c.sourceLabel, postedAt: c.postedAt,
    ...(c.notesJobId ? { notesJobId: c.notesJobId } : {}),
    score: v ? v.score : c.prescore, rough: !v, reason: v ? v.reason : c.hits.length ? `Mentions ${c.hits.slice(0, 4).join(", ")}.` : "", risk: v ? v.risk : "", link,
    ...(v ? { parts: { domain: v.domain, stack: v.stack, seniority: v.seniority, location: v.location, signal: v.signal } } : {}),
  };
}

// ---- the link check: open each page and make sure the job is still there. It fails OPEN: a timeout, a blocked robot or a server having
// a bad day never hides a job; only a definite "gone" does. ----
const UA = "Mozilla/5.0 (compatible; NotesAppJobs/1.0; link check)";
const CLOSED_PHRASES = ["no longer accepting applications", "this job is no longer available", "this position is no longer available", "position has been filled", "this posting is no longer active", "job posting not found"];
// Never match a bare "404" in the body: it collides with SVG path data such as `13.3404`. Only the page title is read for these.
const DEAD_TITLES = ["404", "not found", "page unavailable", "job not found"];
const titleOf = (html: string) => (html.match(/<title[^>]*>([^<]*)/i)?.[1] || "").trim();
export function ashbyVerdict(html: string): string | null {
  const m = html.match(/window\.__appData\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  try { const d = JSON.parse(m[1]); return d.organization === null && d.posting === null ? "the board didn't find this posting" : null; } catch { return null; }
}
export function mentionsJob(title: string, html: string): boolean {
  const distinctive = words(title).filter((w) => w.length > 3);
  if (!distinctive.length) return true;
  const body = ` ${words(html.replace(/<[^>]+>/g, " ")).join(" ")} `;
  return distinctive.filter((w) => body.includes(` ${w} `) || body.includes(w)).length / distinctive.length >= 0.6;
}
export type LinkState = { state: "live" | "dead" | "unknown"; reason: string };
export async function verifyOne(job: { url: string; title: string }, o: { fetch: Fetch; timeoutMs?: number }): Promise<LinkState> {
  if (!hasPostingUrl(job.url)) return { state: "dead", reason: "not a link to a posting" };
  let res: Response, html: string;
  try {
    res = await o.fetch(job.url, { redirect: "follow", headers: { "user-agent": UA, accept: "text/html,*/*" }, signal: AbortSignal.timeout(o.timeoutMs ?? 8_000) });
    html = (await res.text()).slice(0, 600_000);
  } catch (e) { return { state: "unknown", reason: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "couldn't reach it" }; }
  if (res.status >= 500 || res.status === 429 || res.status === 403 || res.status === 999) return { state: "unknown", reason: `HTTP ${res.status} (blocked, not closed)` };
  if (!res.ok) return { state: "dead", reason: `HTTP ${res.status}` };
  const ashby = ashbyVerdict(html);
  if (ashby) return { state: "dead", reason: ashby };
  const t = titleOf(html).toLowerCase();
  if (DEAD_TITLES.some((d) => t.includes(d))) return { state: "dead", reason: `the page title says "${titleOf(html)}"` };
  const lower = html.toLowerCase();
  const phrase = CLOSED_PHRASES.find((p) => lower.includes(p));
  if (phrase) return { state: "dead", reason: `the page says "${phrase}"` };
  if (!mentionsJob(job.title, html)) return { state: "dead", reason: "the page no longer names this job" };
  return { state: "live", reason: "" };
}
export async function verifyAll<T extends { url: string; title: string }>(jobs: T[], o: { fetch: Fetch; timeoutMs?: number; concurrency?: number }): Promise<LinkState[]> {
  const out: LinkState[] = new Array(jobs.length);
  let next = 0;
  const worker = async () => { while (next < jobs.length) { const i = next++; out[i] = await verifyOne(jobs[i], o).catch(() => ({ state: "unknown" as const, reason: "check failed" })); } };
  await Promise.all(Array.from({ length: Math.min(o.concurrency ?? 6, jobs.length) }, worker));
  return out;
}

// ---- the CV review (owner, 12 Nov 2026: "ask for cv, review it with connected ai then have something to start with") ----
export function cvSystem(country: string): string {
  return `You review one person's CV, honestly and briefly, and set up the job search profile they will start from. They live in ${country || "Nigeria"}.

Answer with JSON only, exactly this shape:
{"strengths":["..."],"gaps":["..."],"fixes":["..."],"roles":["..."],
 "profile":{"roles":["..."],"shipped":["..."],"skills":["..."],"cities":["..."],"country":"...","remote":true,"seniority":"mid"}}

- strengths: 2 to 4 short points an employer would value, each naming something specific in the CV.
- gaps: 1 to 4 honest gaps (missing results, an unexplained break, skills a target role needs that the CV doesn't show). Blunt and kind.
- fixes: 2 to 5 quick fixes to the CV itself, each one sentence ("Put the 40k payouts a month figure in the first line of the Kora role").
- roles: 2 to 5 job titles that fit what the CV shows, as a job board would write them.
- profile.roles: the 1 to 3 best of those.
- profile.shipped: up to 8 things the person has actually built, run or delivered, each one line, with the real figure if the CV gives one.
  ONLY things written in the CV. Never invent a project, a number or a technology. Fewer is better than made up.
- profile.skills: up to 15 tools and skills the CV shows them using.
- profile.cities: cities named as where they live or work now. profile.country: the country they live in.
- profile.remote: true unless the CV says they want on-site work only.
- profile.seniority: exactly one of junior, mid, senior, lead.`;
}
const strs = (v: unknown, n: number, len = 220) => (Array.isArray(v) ? v : []).map((x) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, len)).filter(Boolean).slice(0, n);
// A "shipped" line is kept only when most of its distinctive words (and every figure in it) are in the CV itself.
export function inCv(line: string, cv: string): boolean {
  const text = ` ${words(cv).join(" ")} `;
  const ws = words(line).filter((w) => w.length > 3 && !STOP.has(w));
  const nums = line.match(/\d[\d,.]*/g) ?? [];
  if (nums.some((n) => !cv.replace(/\s+/g, " ").includes(n.replace(/[.,]$/, "")))) return false;
  if (!ws.length) return false;
  return ws.filter((w) => text.includes(` ${w} `) || text.includes(` ${w.replace(/s$/, "")}`)).length / ws.length >= 0.6;
}
export function validateCvReview(data: Record<string, unknown>, cv: string, fallbackCountry: string): Omit<CvReview, "provider" | "at"> & { dropped: number } {
  const p = (data.profile && typeof data.profile === "object" ? data.profile : {}) as Record<string, unknown>;
  const shipped = strs(p.shipped, 8);
  const grounded = shipped.filter((s) => inCv(s, cv));
  const seniority = (SENIORITY as readonly string[]).includes(String(p.seniority)) ? (p.seniority as Seniority) : "mid";
  const review = {
    strengths: strs(data.strengths, 4), gaps: strs(data.gaps, 4), fixes: strs(data.fixes, 5), roles: strs(data.roles, 5, 60),
    profile: {
      roles: strs(p.roles, 3, 60), shipped: grounded, skills: strs(p.skills, 15, 40), cities: strs(p.cities, 4, 50),
      country: String(p.country ?? "").trim().slice(0, 50) || fallbackCountry, remote: p.remote !== false, seniority,
    },
    dropped: shipped.length - grounded.length,
  };
  if (!review.strengths.length && !review.roles.length) throw new Error("the AI's review came back empty");
  if (!review.profile.roles.length) review.profile.roles = review.roles.slice(0, 3);
  return review;
}

// ---- the cover note: written from the "shipped" list only ----
export function coverSystem(): string {
  return `You help one person write a short cover note for a job. You may ONLY use the experience in their "shipped" list. Never claim a
project, a number, a technology, a title or a year of experience that isn't written there; if the job asks for something they don't have,
say plainly what they have that is closest. 120-180 words, first person, plain sentences, British spelling. Open with the most relevant thing
they shipped for this job. No "I am writing to apply", no "passionate". End with one concrete line about what they'd like to work on there.
Answer with JSON only: {"note":"..."}`;
}
export function coverUser(job: Pick<PoolJob, "company" | "title" | "location" | "description">, p: NjProfile): string {
  return `THE JOB
${job.title} at ${job.company} (${job.location || "location not stated"})
${fitToBudget(job.description, 3000)}

WHAT THEY HAVE SHIPPED (the only experience you may use)
${bullets(p.shipped)}

SKILLS THEY LISTED
${p.skills.join(", ") || "(none)"}`;
}
// Belt and braces: a sentence with a figure that appears in neither the shipped list nor the job is taken out.
export function groundCoverNote(note: string, shipped: string[], jobText: string): string {
  const src = `${shipped.join(" ")} ${jobText}`.replace(/\s+/g, " ");
  const sentences = String(note ?? "").replace(/\r/g, "").split(/(?<=[.!?])\s+/);
  return sentences.filter((s) => (s.match(/\d[\d,.]*\d|\d/g) ?? []).every((n) => src.includes(n))).join(" ").trim().slice(0, 2000);
}
