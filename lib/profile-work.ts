// "What do you do?", the role and the workplace on a member's profile (all optional, all shown publicly on the profile; the industry also
// feeds the admin's picture of who our members are). Pure and client-safe. firestore.rules enforces the same limits.
export const INDUSTRIES = [
  { key: "writing", label: "Writing, journalism or publishing" },
  { key: "coaching", label: "Coaching, consulting or training" },
  { key: "creator", label: "Content creation or influencing" },
  { key: "retail", label: "Retail, fashion or e-commerce" },
  { key: "tech", label: "Technology or software" },
  { key: "finance", label: "Finance, banking or insurance" },
  { key: "education", label: "Education or research" },
  { key: "health", label: "Health or wellness" },
  { key: "legal", label: "Legal or professional services" },
  { key: "media", label: "Media, film, music or the arts" },
  { key: "marketing", label: "Marketing, advertising or PR" },
  { key: "nonprofit", label: "Non-profit or community work" },
  { key: "government", label: "Government or public service" },
  { key: "agriculture", label: "Agriculture or food" },
  { key: "other", label: "Something else" },
] as const;
export type Industry = (typeof INDUSTRIES)[number]["key"];
export const INDUSTRY_LABEL = Object.fromEntries(INDUSTRIES.map((i) => [i.key, i.label])) as Record<Industry, string>;
export const isIndustry = (v: unknown): v is Industry => typeof v === "string" && INDUSTRIES.some((i) => i.key === v);

export const JOB_TITLE_MAX = 60;
export const WORKPLACE_MAX = 80;

export type Work = { industry?: string; jobTitle?: string; workplace?: string };
export type CleanWork = { industry: Industry | ""; jobTitle: string; workplace: string };

const tidy = (v: unknown, max: number) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

// Anything unrecognised becomes empty; nothing here can make a sign-up fail.
export function cleanWork(w: Work | undefined | null): CleanWork {
  return { industry: isIndustry(w?.industry) ? w!.industry as Industry : "", jobTitle: tidy(w?.jobTitle, JOB_TITLE_MAX), workplace: tidy(w?.workplace, WORKPLACE_MAX) };
}

// The line under a name: "CEO at Acme", or just "CEO", or just "Acme". Empty when they gave neither.
export function headline(w: Work | undefined | null): string {
  const t = tidy(w?.jobTitle, JOB_TITLE_MAX), p = tidy(w?.workplace, WORKPLACE_MAX);
  return t && p ? `${t} at ${p}` : t || p;
}

// For the admin: how many members chose each answer, most common first. Members who skipped it are counted separately.
export function industryMix(people: Work[]): { rows: { key: Industry; label: string; count: number }[]; answered: number; total: number } {
  const counts = new Map<Industry, number>();
  for (const p of people) if (isIndustry(p.industry)) counts.set(p.industry, (counts.get(p.industry) ?? 0) + 1);
  const rows = [...counts.entries()].map(([key, count]) => ({ key, label: INDUSTRY_LABEL[key], count })).sort((a, b) => b.count - a.count);
  return { rows, answered: rows.reduce((n, r) => n + r.count, 0), total: people.length };
}

// More roles (owner, 22 Nov 2026: "allow people to add more than 1 job and maybe even past jobs" — for venture founders, job seekers,
// professionals and academics). The main role above stays the line under the name; these are the other roles, now and past, shown in
// the profile's Work section. Months are "YYYY-MM" (an <input type="month">); `current` roles have no end.
export const EXPERIENCE_MAX = 10;
export type Experience = { title: string; org: string; from: string; to: string; current: boolean };
const MONTH = /^(19[5-9]\d|20\d\d)-(0[1-9]|1[0-2])$/;
const month = (v: unknown) => (typeof v === "string" && MONTH.test(v) ? v : "");

// Tidied, empty rows dropped, an end before its start dropped, at most ten; current roles first, then the most recent.
export function cleanExperience(list: unknown): Experience[] {
  if (!Array.isArray(list)) return [];
  const rows = list.slice(0, EXPERIENCE_MAX * 2).map((e): Experience => {
    const r = (e ?? {}) as Record<string, unknown>;
    const current = r.current === true;
    const from = month(r.from);
    let to = current ? "" : month(r.to);
    if (from && to && to < from) to = "";
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    return { title: tidy(str(r.title), JOB_TITLE_MAX), org: tidy(str(r.org), WORKPLACE_MAX), from, to, current };
  }).filter((e) => e.title || e.org);
  const end = (e: Experience) => (e.current ? "9999-99" : e.to || e.from);
  return rows.sort((a, b) => end(b).localeCompare(end(a)) || b.from.localeCompare(a.from)).slice(0, EXPERIENCE_MAX);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthText = (m: string) => (m ? `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}` : "");
// "Jan 2020 – now", "Jan 2018 – Mar 2021", "Until Mar 2021", "Now"; empty for a past role with no dates.
export function experienceDates(e: Experience): string {
  const f = monthText(e.from), t = e.current ? "now" : monthText(e.to);
  if (f && t) return `${f} – ${t}`;
  if (f) return `From ${f}`;
  if (e.current) return "Now";
  return t ? `Until ${t}` : "";
}
export const experienceHeadline = (e: Experience) => headline({ jobTitle: e.title, workplace: e.org });
