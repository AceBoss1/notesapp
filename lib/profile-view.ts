// What the public profile (/u/<username>) shows under the name and in its About sections, worked out from the profile alone.
// Pure and client-safe, so the page and its tests agree (tests/profile/profile-view.test.ts). Only fields the profile really has:
// nothing here invents a city, school or birthday; an empty field is simply left out.
import { cleanExperience, experienceDates, experienceHeadline, headline, INDUSTRY_LABEL, isIndustry } from "./profile-work";

// 999 → "999", 1 234 → "1.2K", 18 000 → "18K", 1 250 000 → "1.3M" (one decimal, dropped when it is .0).
export function compactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(Math.floor(n));
  const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, unit] of units) {
    if (n >= size) {
      const v = Math.floor((n / size) * 10) / 10; // never rounds up past what they have (9 999 is 9.9K, not 10K)
      return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}${unit}`;
    }
  }
  return String(n);
}

// "1 follower", "7.1K followers"; "posts" likewise.
export const countText = (n: number, one: string, many: string) => `${compactCount(n)} ${n === 1 ? one : many}`;

// "Joined October 2026" from the account's creation time; empty when unknown.
export function joinedText(createdAt: string | undefined | null): string {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? "" : `Joined ${d.toLocaleDateString("en-NG", { month: "long", year: "numeric" })}`;
}

export type WorkLike = { industry?: string; jobTitle?: string; workplace?: string; experience?: unknown };

// The Work section's rows: "CEO at Acme" (or either alone) and what they do. Empty when they gave none.
// Then the other roles (lib/profile-work.ts Experience), current ones first, each with its dates.
export type WorkRow = { kind: "role" | "industry" | "now" | "past"; text: string; sub?: string; key: string };
export function workRows(w: WorkLike | null | undefined): WorkRow[] {
  const rows: WorkRow[] = [];
  const h = headline(w);
  if (h) rows.push({ kind: "role", text: h, key: "role" });
  if (w && isIndustry(w.industry) && w.industry !== "other") rows.push({ kind: "industry", text: INDUSTRY_LABEL[w.industry], key: "industry" });
  cleanExperience(w?.experience).forEach((e, i) => {
    const dates = experienceDates(e);
    rows.push({ kind: e.current ? "now" : "past", text: experienceHeadline(e), key: `x${i}`, ...(dates ? { sub: e.current ? dates : `Past · ${dates}` } : e.current ? {} : { sub: "Past" }) });
  });
  return rows;
}

// Is a bio long enough to cut to two lines with "See more"? Measured on the page when it can be; this is the guess before it can
// (and for tests): more than about two phone lines, or more than two lines typed.
export const bioIsLong = (bio: string) => bio.trim().length > 110 || bio.trim().split(/\n/).length > 2;
