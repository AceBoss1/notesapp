import { ageOn, cleanBirth, TEEN_FROM, YoungError } from "./young";

// Kids mode (under 13; docs/YOUNG_MEMBERS.md). The owner's rules (23 Oct 2026):
//   - A child never has a login of their own. The account stays the parent's: the child gets a profile on it, which the parent
//     opens on their device. Getting back to the parent's account takes the parent's PIN.
//   - What a child can use is the parent's choice: Naija Exam Prep practice, free Academy courses, reading journals (no comments),
//     and Notes Life in kids' Notesville (only residents, no real players, no invites or Bonus Credits), with a daily play time.
//     Never messages, moments, comments, a public profile, buying, or ads chosen for them.
//   - The parent consents before anything is kept, and gets a weekly email of what the child practised.
// Under the hood a child profile is its own Firebase identity, `kid_<id>`, signed in with a custom token the server mints only for
// the parent who owns it; it carries the claims { kid: true, parentUid, kidId }. Pure, client-safe.

export const KID_PREFIX = "kid_";
export const isKidUid = (uid: string | null | undefined) => typeof uid === "string" && uid.startsWith(KID_PREFIX);
export const kidUid = (kidId: string) => `${KID_PREFIX}${kidId}`;
export const MAX_KIDS = 6;
export const PLAY_MINUTES = [15, 30, 45, 60, 90];
export const DEFAULT_PLAY = 30;
export const PIN_TRIES = 5; // then a 15-minute wait

export type KidAllow = { prep: boolean; academy: boolean; reading: boolean; life: boolean };
export type KidProfile = { id: string; parentUid: string; nickname: string; birth: string; allow: KidAllow; playMinutes: number; createdAt: string; consentAt: string };
export const ALLOW_LABEL: Record<keyof KidAllow, string> = { prep: "Naija Exam Prep practice", academy: "Free Academy courses", reading: "Reading journals (no comments)", life: "Notes Life, kids' Notesville" };

// Where a child profile may go: the kids' home, then only the areas the parent switched on. Everything else sends them home.
export function kidMayOpen(path: string, allow: KidAllow): boolean {
  const p = path.split("?")[0];
  if (p === "/kids" || p.startsWith("/kids/")) return true;
  if (allow.prep && (p === "/exam-prep" || p.startsWith("/exam-prep/"))) return !/\/exam-prep\/(paid|pay)(\/|$)/.test(p);
  if (allow.academy && (p === "/academy" || p.startsWith("/academy/"))) return !/\/academy\/(teach|checkout|pay)/.test(p);
  if (allow.reading && (p === "/journals" || p.startsWith("/journals/"))) return true;
  if (allow.life && (p === "/life" || p.startsWith("/life/"))) return true;
  return false;
}

const NICK = /^[A-Za-z][A-Za-z0-9 _-]{1,19}$/;
export const cleanPin = (v: unknown): string => {
  const s = String(v ?? "").trim();
  if (!/^\d{4}$/.test(s)) throw new YoungError("The PIN is 4 digits.");
  if (/^(\d)\1{3}$/.test(s) || s === "1234" || s === "4321") throw new YoungError("Pick a PIN that's harder to guess than that.");
  return s;
};

export function cleanKid(b: Record<string, unknown>, today: string, partial = false): Partial<Omit<KidProfile, "id" | "parentUid" | "createdAt" | "consentAt">> & { pin?: string } {
  const out: ReturnType<typeof cleanKid> = {};
  if (!partial || b.nickname !== undefined) {
    const n = String(b.nickname ?? "").trim();
    if (!NICK.test(n)) throw new YoungError("A nickname of 2 to 20 letters and numbers, starting with a letter. Not their full name.");
    out.nickname = n;
  }
  if (!partial || b.birthMonth !== undefined || b.birthYear !== undefined) {
    const birth = cleanBirth(b.birthMonth, b.birthYear);
    const age = ageOn(birth, today);
    if (age < 3) throw new YoungError("Check the month and year they were born.");
    if (age >= TEEN_FROM) throw new YoungError("13 or older: they can have their own account in teen mode instead.");
    out.birth = birth;
  }
  if (!partial || b.pin !== undefined) out.pin = cleanPin(b.pin);
  if (!partial || b.allow !== undefined) {
    const a = (b.allow ?? {}) as Record<string, unknown>;
    out.allow = { prep: a.prep !== false, academy: a.academy !== false, reading: a.reading === true, life: a.life === true };
  }
  if (!partial || b.playMinutes !== undefined) {
    const m = Number(b.playMinutes ?? DEFAULT_PLAY);
    if (!PLAY_MINUTES.includes(m)) throw new YoungError("Choose a daily play time.");
    out.playMinutes = m;
  }
  if (!partial && b.consent !== true) throw new YoungError("Tick that you're their parent or guardian and agree.");
  return out;
}

// Notes Life play time: each action counts the time since the one before, at most 2 minutes (a pause doesn't count).
export const PLAY_STEP_MAX_MS = 2 * 60_000;
export const playAdd = (lastAt: number | undefined, now: number) => (lastAt && now > lastAt ? Math.min(PLAY_STEP_MAX_MS, now - lastAt) : 0);
export const playLeft = (usedMs: number, limitMinutes: number) => Math.max(0, limitMinutes * 60_000 - usedMs);

// The weekly email to the parent, from the child's Exam Prep progress: answers this week, how many right, by topic, and mocks.
export type WeekReport = { answered: number; right: number; topics: { topic: string; answered: number; right: number }[]; mocks: { subject: string; score: number; total: number }[] };
export function weekReport(p: { byQuestion: Record<string, { ok: boolean; at: string; t: string }>; mocks: { subject: string; score: number; total: number; at: string }[] }, sinceIso: string): WeekReport {
  const recent = Object.values(p.byQuestion).filter((a) => a.at >= sinceIso);
  const byTopic = new Map<string, { answered: number; right: number }>();
  for (const a of recent) { const x = byTopic.get(a.t) ?? { answered: 0, right: 0 }; x.answered++; if (a.ok) x.right++; byTopic.set(a.t, x); }
  return {
    answered: recent.length, right: recent.filter((a) => a.ok).length,
    topics: Array.from(byTopic.entries()).map(([t, x]) => ({ topic: t.split("/").pop() ?? t, ...x })).sort((a, b) => b.answered - a.answered).slice(0, 8),
    mocks: p.mocks.filter((m) => m.at >= sinceIso).map(({ subject, score, total }) => ({ subject, score, total })),
  };
}
