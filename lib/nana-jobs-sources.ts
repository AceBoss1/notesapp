// Nana Jobs: where openings come from. Open job feeds (RemoteOK, Remotive, Himalayas, Arbeitnow) and the public board APIs of companies
// members watch (Greenhouse, Lever, Ashby). Notes Jobs is added by lib/nana-jobs-server.ts. No LinkedIn or Indeed scraping: both forbid it.
// Every fetch has a timeout and fails open: a source that's down is skipped and named in the run, never fatal. `fetch` is injected.
//
// Adapted from Shortlist (github.com/vicintel/shortlist-engine: src/sources/feeds.js, src/sources/ats.js and getJSON in src/util.js).
// MIT License. Copyright (c) 2026 Victor Dickson. Permission is hereby granted, free of charge, to any person obtaining a copy of this
// software and associated documentation files (the "Software"), to deal in the Software without restriction, subject to the conditions
// in the full notice in THIRD_PARTY_NOTICES at the root of this repository. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
import type { Fetch } from "./ai-providers";
import { ATS, ATS_LABEL, type Ats, type Board, type PoolJob } from "./nana-jobs";
import { hasPostingUrl, jobHash, toText } from "./nana-jobs-funnel";

const UA = "NotesApp-Jobs/1.0 (job search for members; once a day)";
export async function getJSON(f: Fetch, url: string, timeoutMs = 15_000): Promise<unknown> {
  const res = await f(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText || ""}`.trim());
  return res.json();
}

type Raw = Omit<PoolJob, "hash" | "source" | "sourceLabel">;
type J = Record<string, unknown>;
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const arr = (v: unknown): J[] => (Array.isArray(v) ? (v as J[]) : []);
const tags = (...xs: unknown[]) => xs.flat().map((x) => s(typeof x === "object" && x ? (x as J).name : x)).filter(Boolean).slice(0, 15);
const iso = (v: unknown) => { if (v === undefined || v === null || v === "") return null; const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v)); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
// When a posting was last confirmed live: a board's "updated" date when it is later than "first published".
const freshest = (...ds: unknown[]) => { const t = ds.map(iso).filter(Boolean).map((d) => new Date(d!).getTime()); return t.length ? new Date(Math.max(...t)).toISOString() : null; };
const DESC_MAX = 6000;
const desc = (v: unknown) => toText(v).slice(0, DESC_MAX);

export const FEEDS: Record<string, { label: string; url: string; read: (d: unknown) => Raw[] }> = {
  remoteok: {
    label: "RemoteOK", url: "https://remoteok.com/api",
    // The first element is a legal notice, not a job.
    read: (d) => arr(d).slice(1).map((j) => ({ company: s(j.company), title: s(j.position), location: s(j.location) || "Remote", url: s(j.url || j.apply_url), postedAt: iso(j.date) ?? iso(j.epoch), description: desc(j.description), salaryText: j.salary_min && j.salary_max ? `$${j.salary_min}–$${j.salary_max}` : "", tags: tags(j.tags), remoteHint: true })),
  },
  remotive: {
    label: "Remotive", url: "https://remotive.com/api/remote-jobs?limit=400",
    read: (d) => arr((d as J)?.jobs).map((j) => ({ company: s(j.company_name), title: s(j.title), location: s(j.candidate_required_location) || "Remote", url: s(j.url), postedAt: iso(j.publication_date), description: desc(j.description), salaryText: s(j.salary), tags: tags(j.tags, j.job_type, j.category), remoteHint: true })),
  },
  himalayas: {
    label: "Himalayas", url: "https://himalayas.app/jobs/api?limit=100",
    // No company-page fallback: a link to /companies/<slug> is not a posting.
    read: (d) => arr((d as J)?.jobs).map((j) => ({ company: s(j.companyName), title: s(j.title), location: (Array.isArray(j.locationRestrictions) ? (j.locationRestrictions as unknown[]).map(s).join(", ") : "") || "Remote (worldwide)", url: s(j.applicationLink), postedAt: iso(j.pubDate), description: desc(j.description || j.excerpt), salaryText: j.minSalary && j.maxSalary ? `${s(j.currency)}${j.minSalary}–${j.maxSalary}/${s(j.salaryPeriod) || "year"}` : "", tags: tags(j.categories, j.employmentType, j.seniority), remoteHint: true })),
  },
  arbeitnow: {
    label: "Arbeitnow", url: "https://www.arbeitnow.com/api/job-board-api",
    read: (d) => arr((d as J)?.data).map((j) => ({ company: s(j.company_name), title: s(j.title), location: s(j.location) || (j.remote ? "Remote" : ""), url: s(j.url), postedAt: iso(j.created_at), description: desc(j.description), salaryText: "", tags: tags(j.tags, j.job_types), remoteHint: j.remote === true ? true : null })),
  },
};

const BOARD: Record<Ats, { url: (slug: string) => string; read: (d: unknown, name: string) => Raw[] | null }> = {
  greenhouse: {
    url: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
    read: (d, name) => (Array.isArray((d as J)?.jobs) ? arr((d as J).jobs).map((j) => ({ company: s(j.company_name) || name, title: s(j.title), location: s((j.location as J)?.name), url: s(j.absolute_url), postedAt: freshest(j.updated_at, j.first_published), description: desc(j.content), salaryText: "", tags: tags(j.departments), remoteHint: null })) : null),
  },
  lever: {
    url: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
    read: (d, name) => (Array.isArray(d) ? arr(d).map((j) => { const c = (j.categories ?? {}) as J; return { company: name, title: s(j.text), location: s(c.location || j.country), url: s(j.hostedUrl), postedAt: freshest(j.updatedAt, j.createdAt), description: [s(j.descriptionPlain), s(j.additionalPlain)].filter(Boolean).join("\n\n").slice(0, DESC_MAX), salaryText: "", tags: tags(c.department, c.team, c.commitment, j.workplaceType), remoteHint: j.workplaceType === "remote" ? true : j.workplaceType ? false : null }; }) : null),
  },
  ashby: {
    url: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
    // `isRemote` can say true for a hybrid office role; workplaceType is the field the board keeps, so it wins.
    read: (d, name) => (Array.isArray((d as J)?.jobs) ? arr((d as J).jobs).map((j) => ({ company: name, title: s(j.title), location: [s(j.location), ...arr(j.secondaryLocations).map((l) => s(l.location))].filter(Boolean).join(", "), url: s(j.jobUrl || j.applyUrl), postedAt: freshest(j.updatedAt, j.publishedAt), description: s(j.descriptionPlain).slice(0, DESC_MAX) || desc(j.descriptionHtml), salaryText: s((j.compensation as J)?.compensationTierSummary), tags: tags(j.department, j.team, j.employmentType), remoteHint: j.workplaceType === "Remote" ? true : j.workplaceType ? false : j.isRemote === true ? true : j.isRemote === false ? false : null })) : null),
  },
};

const finish = (rows: Raw[], source: string, sourceLabel: string): PoolJob[] =>
  rows.filter((r) => r.title && r.company && hasPostingUrl(r.url)).map((r) => ({ ...r, title: r.title.trim().slice(0, 160), company: r.company.trim().slice(0, 100), location: r.location.trim().slice(0, 160), hash: jobHash(r), source, sourceLabel }));

export type Fetched = { jobs: PoolJob[]; counts: Record<string, number>; errors: Record<string, string> };
async function settle(tasks: { key: string; run: () => Promise<PoolJob[]> }[]): Promise<Fetched> {
  const out: Fetched = { jobs: [], counts: {}, errors: {} };
  const rs = await Promise.allSettled(tasks.map((t) => t.run()));
  rs.forEach((r, i) => {
    const k = tasks[i].key;
    if (r.status === "fulfilled") { out.jobs.push(...r.value); out.counts[k] = r.value.length; }
    else out.errors[k] = (r.reason instanceof Error ? r.reason.message : String(r.reason)).slice(0, 160);
  });
  return out;
}

export function fetchFeeds(f: Fetch, timeoutMs?: number): Promise<Fetched> {
  return settle(Object.entries(FEEDS).map(([key, feed]) => ({ key, run: async () => finish(feed.read(await getJSON(f, feed.url, timeoutMs)), key, feed.label) })));
}
export function fetchBoards(f: Fetch, boards: { ats: Ats; slug: string; name: string }[], timeoutMs?: number): Promise<Fetched> {
  return settle(boards.map((b) => ({
    key: `${b.ats}:${b.slug}`,
    run: async () => { const rows = BOARD[b.ats].read(await getJSON(f, BOARD[b.ats].url(b.slug), timeoutMs), b.name); if (!rows) throw new Error("not a job board"); return finish(rows, `${b.ats}:${b.slug}`, ATS_LABEL[b.ats]); },
  })));
}

// "paystack", "Moniepoint Inc." → the slugs a board might use.
export function slugsFor(name: string): string[] {
  const base = name.toLowerCase().replace(/\b(inc|ltd|limited|llc|plc|gmbh|co)\b\.?/g, "").replace(/&/g, "and").trim();
  const joined = base.replace(/[^a-z0-9]+/g, "");
  const dashed = base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [...new Set([joined, dashed].filter((x) => x.length >= 2 && x.length <= 60))];
}
// Before a company is added: does it have a public Greenhouse, Lever or Ashby board? The first that answers with a job list wins. A board
// with no openings today still counts. Nothing found → { ok: false } and the member sees "no public board".
export async function checkBoard(f: Fetch, rawName: string, timeoutMs = 8_000): Promise<Board> {
  const name = String(rawName ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  for (const slug of slugsFor(name)) {
    const found = await Promise.all(ATS.map(async (ats) => { try { return BOARD[ats].read(await getJSON(f, BOARD[ats].url(slug), timeoutMs), name) ? ats : null; } catch { return null; } }));
    const ats = found.find(Boolean);
    if (ats) return { name, ats, slug, ok: true };
  }
  return { name, ats: null, slug: slugsFor(name)[0] ?? "", ok: false };
}
