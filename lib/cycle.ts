// My Cycle (docs/MY_CYCLE.md): the pure rules, shared by the server (lib/cycle-server.ts), the page and the tests. Nothing here
// reads or writes data. Days are "YYYY-MM-DD" strings in the member's own calendar, worked out in UTC so a day is always 24 hours.
//
// Predictions are estimates from her own logs, never medical advice and never contraception:
// - cycle length: the average of her last 6 logged cycles, else the length she set, else 28; always 21 to 45 days
// - ovulation: 14 days before the next period; the fertile window runs from 5 days before ovulation to 1 day after
// - four phases (menstrual, follicular, ovulation, luteal); pill mode shows Active and Break days instead
// - "early guess" until 3 periods are logged
// Teens (13 to 17) get periods only: forTeen() takes out ovulation, the fertile window and pill mode, and the server applies it.

export const MIN_LENGTH = 21;
export const MAX_LENGTH = 45;
export const DEFAULT_LENGTH = 28;
export const DEFAULT_PERIOD_DAYS = 5;
export const AVERAGE_OF = 6; // cycles
export const CONFIDENT_AFTER = 3; // periods logged
export const LUTEAL_DAYS = 14;
export const PILL_ACTIVE = 21;
export const PILL_PACK = 28;
export const LATE_AFTER_DAYS = 5; // the "your period may be late" bell, this many days after the expected day
export const NOTE_MAX = 500; // characters in a check-in's free text
export const CHAT_MAX = 600; // characters in one question to Nana
export const CHAT_KEEP = 40; // messages kept in her private chat

// The consent line on the first screen (NDPA 2023: health data is sensitive personal data and needs explicit consent).
export const CONSENT_TEXT = "I agree that #NotesApp keeps what I log in My Cycle (periods, symptoms, moods and notes), encrypted, to show my predictions and so Nana can advise me. Only I can see it. It is never used for ads, and I can download or delete it at any time.";

export class CycleError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

// ── Days ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const addDays = (d: string, n: number) => new Date(ms(d) + n * 86_400_000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 86_400_000); // b - a
export const clampLength = (n: number) => Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(n)));

// ── Shapes ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Period = { start: string; end?: string };
export type Settings = { cycleLength: number | null; pill: boolean; pillStart?: string | null };
export type Mood = "happy" | "calm" | "tired" | "anxious" | "irritable" | "sad" | "energetic" | "unwell";
export type Flow = "spotting" | "light" | "medium" | "heavy";
export type Log = {
  day: string; moods: Mood[]; symptoms: string[]; energy: "low" | "ok" | "high" | null; pain: number | null;
  water: number | null; sleep: number | null; flow: Flow | null; note: string;
};

export const MOODS: { id: Mood; label: string; emoji: string; score: number }[] = [
  { id: "happy", label: "Happy", emoji: "😊", score: 1 }, { id: "calm", label: "Calm", emoji: "😌", score: 1 },
  { id: "tired", label: "Tired", emoji: "🥱", score: -1 }, { id: "anxious", label: "Anxious", emoji: "😟", score: -1 },
  { id: "irritable", label: "Irritable", emoji: "😤", score: -1 }, { id: "sad", label: "Sad", emoji: "😢", score: -1 },
  { id: "energetic", label: "Energetic", emoji: "⚡", score: 1 }, { id: "unwell", label: "Unwell", emoji: "🤒", score: -1 },
];
export const SYMPTOMS = ["Bloating", "Cramps", "Headache", "Tender breasts", "Acne", "Nausea", "Back pain", "Cravings", "Spotting", "Dizziness"];
export const FLOWS: { id: Flow; label: string }[] = [{ id: "spotting", label: "Spotting" }, { id: "light", label: "Light" }, { id: "medium", label: "Medium" }, { id: "heavy", label: "Heavy" }];
export const WATER_MAX = 8; // glasses
export const SLEEP_MAX = 12; // hours

// ── Cleaning what the page sends ─────────────────────────────────────────────────────────────────────────────────────────────────
export function cleanLength(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < MIN_LENGTH || n > MAX_LENGTH) throw new CycleError(`Choose a length from ${MIN_LENGTH} to ${MAX_LENGTH} days, or "I don't know".`);
  return n;
}

export function cleanLog(b: Record<string, unknown>, today: string): Log {
  if (!isDay(b.day)) throw new CycleError("Choose a day.");
  if (daysBetween(b.day, today) < 0) throw new CycleError("You can't log a day that hasn't come yet.");
  if (daysBetween(b.day, today) > 400) throw new CycleError("That day is too far back.");
  const moodIds = new Set(MOODS.map((m) => m.id));
  const moods = Array.isArray(b.moods) ? Array.from(new Set(b.moods.filter((m): m is Mood => moodIds.has(m as Mood)))) : [];
  const symptoms = Array.isArray(b.symptoms)
    ? Array.from(new Set(b.symptoms.map((s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 30)).filter(Boolean))).slice(0, 12)
    : [];
  const energy = b.energy === "low" || b.energy === "ok" || b.energy === "high" ? b.energy : null;
  const num = (v: unknown, max: number) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Math.min(max, Math.max(0, Math.round(Number(v) * 2) / 2)) : null);
  const flow = FLOWS.some((f) => f.id === b.flow) ? (b.flow as Flow) : null;
  const note = String(b.note ?? "").replace(/\u0000/g, "").trim();
  if (note.length > NOTE_MAX) throw new CycleError(`Keep the note under ${NOTE_MAX} characters.`);
  return { day: b.day, moods, symptoms, energy, pain: num(b.pain, 5), water: num(b.water, WATER_MAX), sleep: num(b.sleep, SLEEP_MAX), flow, note };
}

// Period starts, newest last, one per day, never two within 10 days (a second tap fixes the first).
export function sortPeriods(periods: Period[]): Period[] {
  const seen = new Map<string, Period>();
  for (const p of periods) if (isDay(p.start)) seen.set(p.start, { start: p.start, ...(p.end && isDay(p.end) && daysBetween(p.start, p.end) >= 0 && daysBetween(p.start, p.end) < 15 ? { end: p.end } : {}) });
  return Array.from(seen.values()).sort((a, b) => a.start.localeCompare(b.start));
}

export function addPeriod(periods: Period[], start: string, today: string): Period[] {
  if (!isDay(start)) throw new CycleError("Choose the day your period started.");
  if (daysBetween(start, today) < 0) throw new CycleError("You can't log a period that hasn't started yet.");
  if (daysBetween(start, today) > 400) throw new CycleError("That day is too far back.");
  // A start within 10 days of another is the same period, moved.
  const others = periods.filter((p) => Math.abs(daysBetween(p.start, start)) >= 10);
  return sortPeriods([...others, { start }]);
}

export const removePeriod = (periods: Period[], start: string) => sortPeriods(periods.filter((p) => p.start !== start));

export function endPeriod(periods: Period[], start: string, end: string): Period[] {
  const p = periods.find((x) => x.start === start);
  if (!p) throw new CycleError("That period isn't in your log.");
  if (!isDay(end) || daysBetween(start, end) < 0 || daysBetween(start, end) > 14) throw new CycleError("A period ends 0 to 14 days after it starts.");
  return sortPeriods(periods.map((x) => (x.start === start ? { start, end } : x)));
}

// ── Lengths ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Each logged cycle: the days from one period start to the next. Gaps far outside a cycle (a missed log) are left out.
export function cycleLengths(periods: Period[]): number[] {
  const s = sortPeriods(periods);
  const out: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const n = daysBetween(s[i - 1].start, s[i].start);
    if (n >= 15 && n <= 60) out.push(n);
  }
  return out;
}

export function averageLength(periods: Period[], setting: number | null | undefined): number {
  const last = cycleLengths(periods).slice(-AVERAGE_OF);
  if (last.length) return clampLength(last.reduce((a, b) => a + b, 0) / last.length);
  if (typeof setting === "number" && Number.isFinite(setting)) return clampLength(setting);
  return DEFAULT_LENGTH;
}

// How long her periods last: the average of the ones with an end day, else 5.
export function periodDays(periods: Period[]): number {
  const ended = periods.filter((p) => p.end).map((p) => daysBetween(p.start, p.end!) + 1).slice(-AVERAGE_OF);
  return ended.length ? Math.min(10, Math.max(2, Math.round(ended.reduce((a, b) => a + b, 0) / ended.length))) : DEFAULT_PERIOD_DAYS;
}

// ── Phases and today ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Phase = "menstrual" | "follicular" | "ovulation" | "luteal" | "active" | "break";
export const PHASE_LABEL: Record<Phase, string> = {
  menstrual: "Period", follicular: "Follicular phase", ovulation: "Ovulation phase", luteal: "Luteal phase", active: "Active pill days", break: "Break days",
};
export const PHASE_COLOUR: Record<Phase | "fertile", string> = {
  menstrual: "#E0123E", follicular: "#F6B3C3", fertile: "#2FA37A", ovulation: "#F2C14E", luteal: "#C9A7E8", active: "#C9A7E8", break: "#E0123E",
};

export type Segment = { phase: Phase | "fertile"; from: number; to: number }; // cycle days, 1-based, inclusive

export type Today = {
  today: string;
  setUp: boolean; // at least one period start logged
  day: number | null; // day of the cycle (or of the pill pack)
  length: number;
  periodDays: number;
  phase: Phase | null;
  nextPeriod: string | null;
  daysToNext: number | null;
  late: number; // days past the expected start (0 when not late)
  earlyGuess: boolean;
  logged: number; // periods logged
  pill: boolean;
  ring: Segment[];
  // Adults only (forTeen takes them out):
  ovulation?: string | null;
  fertileStart?: string | null;
  fertileEnd?: string | null;
};

// Where a cycle day sits, for a cycle of `length` with periods of `pdays`.
export function phaseOfDay(day: number, length: number, pdays: number, teen = false): Phase {
  if (day <= pdays) return "menstrual";
  const ov = length - LUTEAL_DAYS; // the cycle day of ovulation
  if (!teen && day >= ov - 1 && day <= ov + 1) return "ovulation";
  return day < ov ? "follicular" : "luteal";
}

export function ringOf(length: number, pdays: number, pill: boolean, teen: boolean): Segment[] {
  if (pill && !teen) return [{ phase: "active", from: 1, to: PILL_ACTIVE }, { phase: "break", from: PILL_ACTIVE + 1, to: PILL_PACK }];
  const ov = length - LUTEAL_DAYS;
  if (teen) return [{ phase: "menstrual", from: 1, to: pdays }, { phase: "follicular", from: pdays + 1, to: ov - 1 }, { phase: "luteal", from: ov, to: length }];
  const all: Segment[] = [
    { phase: "menstrual", from: 1, to: pdays },
    { phase: "follicular", from: pdays + 1, to: ov - 6 },
    { phase: "fertile", from: ov - 5, to: ov - 1 },
    { phase: "ovulation", from: ov, to: ov },
    { phase: "fertile", from: ov + 1, to: ov + 1 },
    { phase: "luteal", from: ov + 2, to: length },
  ];
  return all.filter((s) => s.to >= s.from);
}

export function todayView(periods: Period[], settings: Settings, today: string, teen = false): Today {
  const s = sortPeriods(periods).filter((p) => daysBetween(p.start, today) >= 0);
  const length = averageLength(s, settings.cycleLength);
  const pdays = periodDays(s);
  const pill = settings.pill && !teen;
  const base: Today = {
    today, setUp: s.length > 0, day: null, length, periodDays: pdays, phase: null, nextPeriod: null, daysToNext: null, late: 0,
    earlyGuess: s.length < CONFIDENT_AFTER, logged: s.length, pill, ring: ringOf(length, pdays, pill, teen),
    ...(teen ? {} : { ovulation: null, fertileStart: null, fertileEnd: null }),
  };
  const last = s[s.length - 1];
  if (pill) {
    const start = settings.pillStart && isDay(settings.pillStart) && daysBetween(settings.pillStart, today) >= 0 ? settings.pillStart : last?.start;
    if (!start) return base;
    const day = (daysBetween(start, today) % PILL_PACK) + 1;
    const nextBreak = addDays(today, day <= PILL_ACTIVE ? PILL_ACTIVE + 1 - day : PILL_PACK + PILL_ACTIVE + 1 - day);
    return { ...base, setUp: true, day, length: PILL_PACK, phase: day <= PILL_ACTIVE ? "active" : "break", nextPeriod: nextBreak, daysToNext: daysBetween(today, nextBreak), ring: ringOf(PILL_PACK, pdays, true, false) };
  }
  if (!last) return base;
  const day = daysBetween(last.start, today) + 1;
  const expected = addDays(last.start, length);
  const late = Math.max(0, daysBetween(expected, today));
  // Late: the next period is "any day now" (today); the cycle day keeps counting.
  const next = late > 0 ? today : expected;
  const ov = addDays(expected, -LUTEAL_DAYS);
  const lastDays = last.end ? daysBetween(last.start, last.end) + 1 : pdays;
  const phase: Phase = day <= lastDays ? "menstrual" : phaseOfDay(Math.min(day, length), length, lastDays, teen);
  const view: Today = { ...base, day, phase, nextPeriod: next, daysToNext: daysBetween(today, next), late };
  return teen ? view : { ...view, ovulation: ov, fertileStart: addDays(ov, -5), fertileEnd: addDays(ov, 1) };
}

// ── The calendar ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type DayKind = "period" | "predicted" | "fertile" | "ovulation" | "active" | "break";
// What each day from `from` to `to` shows: logged periods, predicted periods (up to 3 cycles ahead), and, for adults, the fertile
// window and the ovulation estimate; in pill mode, Active and Break days.
export function calendar(periods: Period[], settings: Settings, today: string, from: string, to: string, teen = false): Record<string, DayKind> {
  const out: Record<string, DayKind> = {};
  const inRange = (d: string) => daysBetween(from, d) >= 0 && daysBetween(d, to) >= 0;
  const put = (d: string, k: DayKind) => { if (inRange(d) && !out[d]) out[d] = k; };
  const s = sortPeriods(periods).filter((p) => daysBetween(p.start, today) >= 0);
  const pdays = periodDays(s);
  for (const p of s) {
    const end = p.end ?? addDays(p.start, pdays - 1);
    for (let d = p.start; daysBetween(d, end) >= 0; d = addDays(d, 1)) put(d, "period");
  }
  const t = todayView(s, settings, today, teen);
  if (t.pill && t.nextPeriod && t.day) {
    const packStart = addDays(today, 1 - t.day);
    for (let k = -2; k <= 4; k++) {
      const st = addDays(packStart, k * PILL_PACK);
      for (let i = 0; i < PILL_PACK; i++) put(addDays(st, i), i < PILL_ACTIVE ? "active" : "break");
    }
    return out;
  }
  if (!t.nextPeriod) return out;
  for (let k = 0; k < 3; k++) {
    const st = addDays(t.nextPeriod, k * t.length);
    for (let i = 0; i < pdays; i++) put(addDays(st, i), "predicted");
    if (!teen) {
      const ov = addDays(st, -LUTEAL_DAYS);
      put(ov, "ovulation");
      for (let i = -5; i <= 1; i++) if (i !== 0) put(addDays(ov, i), "fertile");
    }
  }
  return out;
}

// ── Teens ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// What a teen's page may show: no ovulation, no fertile window, no pill mode. The server runs every view through this.
export function forTeen<T extends Partial<Today>>(v: T): Omit<T, "ovulation" | "fertileStart" | "fertileEnd"> {
  const { ovulation: _o, fertileStart: _fs, fertileEnd: _fe, ...rest } = v; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...rest, ...(rest.pill ? { pill: false } : {}), ...(rest.ring ? { ring: rest.ring.filter((r) => r.phase !== "fertile" && r.phase !== "ovulation" && r.phase !== "active" && r.phase !== "break") } : {}), ...(rest.phase === "ovulation" ? { phase: "follicular" as Phase } : {}) };
}
export const teenCalendar = (c: Record<string, DayKind>) =>
  Object.fromEntries(Object.entries(c).filter(([, k]) => k === "period" || k === "predicted"));

// ── Insights ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Insights = {
  lengths: number[]; average: number | null; spread: number | null; regular: boolean | null;
  moodCurve: { day: number; score: number }[]; // average mood score (-1 to 1) by cycle day
  topSymptoms: { name: string; count: number }[];
  beforePeriod: string[]; // the moods logged most in the 5 days before a period
  checkIns: number;
};

export function cycleDayOf(periods: Period[], day: string): number | null {
  const s = sortPeriods(periods);
  let start: string | null = null;
  for (const p of s) if (daysBetween(p.start, day) >= 0) start = p.start;
  if (!start) return null;
  const n = daysBetween(start, day) + 1;
  return n <= MAX_LENGTH + 15 ? n : null;
}

export function insights(periods: Period[], logs: Log[]): Insights {
  const lengths = cycleLengths(periods).slice(-AVERAGE_OF);
  const average = lengths.length ? Math.round((lengths.reduce((a, b) => a + b, 0) / lengths.length) * 10) / 10 : null;
  const spread = lengths.length > 1 ? Math.max(...lengths) - Math.min(...lengths) : null;
  const score = new Map(MOODS.map((m) => [m.id, m.score]));
  const byDay = new Map<number, number[]>();
  const sym = new Map<string, number>();
  const before = new Map<string, number>();
  const starts = sortPeriods(periods).map((p) => p.start);
  for (const l of logs) {
    for (const s of l.symptoms) sym.set(s, (sym.get(s) ?? 0) + 1);
    const cd = cycleDayOf(periods, l.day);
    if (cd && l.moods.length) {
      const v = l.moods.reduce((a, m) => a + (score.get(m) ?? 0), 0) / l.moods.length;
      byDay.set(cd, [...(byDay.get(cd) ?? []), v]);
    }
    if (starts.some((st) => { const n = daysBetween(l.day, st); return n >= 1 && n <= 5; })) for (const m of l.moods) before.set(m, (before.get(m) ?? 0) + 1);
  }
  // Days in groups of 4, so a few check-ins make a readable line.
  const buckets = new Map<number, number[]>();
  for (const [d, v] of byDay) { const b = Math.floor((d - 1) / 4); buckets.set(b, [...(buckets.get(b) ?? []), ...v]); }
  const moodCurve = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).map(([b, v]) => ({ day: b * 4 + 2, score: Math.round((v.reduce((a, c) => a + c, 0) / v.length) * 100) / 100 }));
  const topSymptoms = Array.from(sym.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([name, count]) => ({ name, count }));
  const beforePeriod = Array.from(before.entries()).filter(([m]) => (score.get(m as Mood) ?? 0) < 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m]) => m);
  return { lengths, average, spread, regular: spread === null ? null : spread <= 7, moodCurve, topSymptoms, beforePeriod, checkIns: logs.length };
}

// ── When to see a doctor ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// Signs in her own logs that Nana should point to a doctor or clinic for. Plain sentences, never a diagnosis.
export function redFlags(periods: Period[], logs: Log[], today: string): string[] {
  const out: string[] = [];
  const s = sortPeriods(periods);
  const last = s[s.length - 1];
  if (last && daysBetween(last.start, today) > 90) out.push("no period logged for more than 3 months");
  const recent = logs.filter((l) => daysBetween(l.day, today) <= 60);
  const heavy = recent.filter((l) => l.flow === "heavy").map((l) => l.day).sort();
  let run = 0, best = 0;
  for (let i = 0; i < heavy.length; i++) { run = i && daysBetween(heavy[i - 1], heavy[i]) === 1 ? run + 1 : 1; best = Math.max(best, run); }
  if (best >= 7) out.push("heavy flow for 7 days or more");
  if (recent.filter((l) => (l.pain ?? 0) >= 5).length >= 2) out.push("severe pain (5 out of 5) on more than one day");
  const lengths = cycleLengths(s).slice(-3);
  if (lengths.length >= 2 && lengths.every((n) => n < MIN_LENGTH)) out.push("cycles shorter than 21 days");
  if (lengths.length >= 2 && lengths.every((n) => n > MAX_LENGTH)) out.push("cycles longer than 45 days");
  if (recent.some((l) => l.symptoms.includes("Dizziness") && l.flow === "heavy")) out.push("dizziness with heavy bleeding");
  return out;
}

// ── For Nana ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The only thing Nana is told: her phase and a short summary of her own logs. Never her name or anything else on her account.
export function nanaSummary(t: Today, logs: Log[], flags: string[], teen: boolean): string {
  const lines: string[] = [];
  lines.push(teen ? "Age group: 13 to 17 (teen version: periods only)." : "Age group: adult.");
  if (!t.setUp) lines.push("She hasn't logged a period yet.");
  else if (t.pill) lines.push(`Pill mode: day ${t.day} of a ${PILL_PACK}-day pack (${t.phase === "active" ? "active pill days" : "break days"}).`);
  else {
    lines.push(`Cycle day ${t.day} of about ${t.length} (${t.phase ? PHASE_LABEL[t.phase] : "unknown"}).`);
    lines.push(t.late > 0 ? `Her period is ${t.late} day${t.late === 1 ? "" : "s"} later than the estimate.` : `Next period in about ${t.daysToNext} days.`);
    lines.push(t.earlyGuess ? `Only ${t.logged} period${t.logged === 1 ? "" : "s"} logged, so this is an early guess.` : `${t.logged} periods logged.`);
  }
  const recent = [...logs].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 3);
  for (const l of recent) {
    const ago = daysBetween(l.day, t.today);
    const bits = [
      l.moods.length ? `mood ${l.moods.join(", ")}` : "", l.symptoms.length ? `symptoms ${l.symptoms.join(", ").toLowerCase()}` : "",
      l.energy ? `energy ${l.energy}` : "", l.pain !== null ? `pain ${l.pain}/5` : "", l.sleep !== null ? `slept ${l.sleep} h` : "",
      l.water !== null ? `${l.water} glasses of water` : "", l.flow ? `flow ${l.flow}` : "", l.note ? `her note: "${l.note.slice(0, 200)}"` : "",
    ].filter(Boolean);
    if (bits.length) lines.push(`${ago === 0 ? "Today" : ago === 1 ? "Yesterday" : `${ago} days ago`}: ${bits.join("; ")}.`);
  }
  if (flags.length) lines.push(`Worth a doctor or clinic: ${flags.join("; ")}.`);
  return lines.join("\n");
}

// ── Our own tips by phase (used on Today, and when no AI is available) ───────────────────────────────────────────────────────────
export type Tips = { food: string[]; move: string[]; moveLevel: string; note: string };
export const TIPS: Record<Phase | "none", Tips> = {
  menstrual: {
    food: ["Iron to make up for what you lose: ugu or efo riro, beans, liver or fish", "Warm pap (ogi) or a light pepper soup on heavy days", "Oranges or garden eggs with meals help your body take in iron", "Plenty of water, and go easy on very salty or fizzy drinks"],
    move: ["Gentle stretches or a slow walk", "A hot water bottle and rest are fine too", "Skip hard training on a heavy or painful day"],
    moveLevel: "Gentle", note: "Your period is here. Rest when you need to, keep warm and drink plenty of water. Iron-rich food such as ugu, beans or fish helps you feel stronger.",
  },
  follicular: {
    food: ["Fresh fruit and vegetables: pawpaw, garden eggs, carrots", "Protein for energy: eggs, moi moi, chicken or fish", "Whole grains such as ofada rice, millet or oats"],
    move: ["A good time for brisk walks, dancing or a workout you enjoy", "Try something new: energy often rises now", "Strength moves like squats and push-ups"],
    moveLevel: "Moderate to high", note: "Energy often lifts after a period. A good time to plan, try something new and move a bit more.",
  },
  ovulation: {
    food: ["Light, fresh meals: salads, fruit and grilled fish", "Zinc from pumpkin seeds (egusi), groundnuts and beans", "Keep drinking water, especially in the heat"],
    move: ["A good time for your most active days: running, dancing, sport", "Warm up well before you push hard"],
    moveLevel: "High", note: "Many people feel their best around now. Make the most of your energy, and keep drinking water.",
  },
  luteal: {
    food: ["Warm meals with beans or ugu (iron and fibre)", "Bananas, groundnuts and dark leafy greens for magnesium", "Less salt and sugar to ease bloating", "Sweet potato or plantain for steady energy"],
    move: ["A gentle 20 to 30 minute walk", "Stretching or yoga", "Lighter workouts as your period gets closer"],
    moveLevel: "Low to moderate", note: "Energy often dips before a period, and bloating or mood changes are common. Warm meals, less salt, a gentle walk and good sleep help.",
  },
  active: {
    food: ["Regular meals with protein, vegetables and whole grains", "Plenty of water"],
    move: ["Move as you feel: walks, dancing or a workout you enjoy"],
    moveLevel: "As you feel", note: "Active pill days. Take your pill at the same time each day, and set a reminder if it helps.",
  },
  break: {
    food: ["Iron-rich food: ugu, beans, fish", "Warm drinks and plenty of water"],
    move: ["Gentle walks and stretches"],
    moveLevel: "Gentle", note: "Break days. A light bleed is usual now. Start your next pack on time.",
  },
  none: {
    food: ["Balanced meals with vegetables, protein and whole grains", "Plenty of water"],
    move: ["A daily walk or a dance to music you like"],
    moveLevel: "As you feel", note: "Log the day your last period started, and My Cycle will start to learn your pattern.",
  },
};

export const tipsFor = (phase: Phase | null) => TIPS[phase ?? "none"];

// The note shown when no AI is available: our own words for the phase, plus a doctor line for any red flag.
export function fallbackNote(t: Today, flags: string[], teen: boolean): string {
  const base = tipsFor(t.phase).note;
  const late = !t.pill && t.late >= LATE_AFTER_DAYS ? ` Your period is a few days later than the estimate. Stress, illness and travel can all move it.${teen ? " If you're worried, talk to a trusted adult or a clinic." : " If it's very late or you might be pregnant, a test or a clinic can tell you."}` : "";
  const doc = flags.length ? ` You logged ${flags[0]}. Please see a doctor or clinic${teen ? ", and tell a trusted adult" : ""}.` : "";
  return `${base}${late}${doc}`;
}

// ── Reminders ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The bells never say what they're about.
export const REMINDER_TEXT = "A reminder from My Cycle";
export const isLateForBell = (t: Today) => !t.pill && t.setUp && t.late >= LATE_AFTER_DAYS;
