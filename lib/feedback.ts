// The one-month feedback form (owner, 1 Nov 2026: "a 1 month feedback connecting to contact options >> feedback, then admins get it
// in the Leads page"). Pure: shared by the form (components/FeedbackForm.tsx) and the server (/api/feedback, lib/leads-server.ts).
// A reply is saved as a lead of category "feedback" (leads/{id}.feedback) and shown with its scores on Admin → Leads → Feedback.

export const FEEDBACK_PATH = "/contact?topic=feedback";

// How the first month felt, as a 1 to 5 face scale.
export const MOOD_SCALE = [
  { value: 1, emoji: "😞", label: "Poor" },
  { value: 2, emoji: "😕", label: "Not great" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😍", label: "Love it" },
] as const;

export type FeedbackAnswers = {
  mood: number; // 1 to 5
  love: string; // what they love
  missing: string; // what's missing or broken
  recommend: number; // 0 to 10, would they recommend us
  contactOk: boolean; // can we contact them about it
};

export const FEEDBACK_TEXT_MAX = 2000;
const text = (v: unknown, max = FEEDBACK_TEXT_MAX) => String(v ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const int = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

export type CheckedFeedback = { ok: true; value: FeedbackAnswers & { name: string; email: string } } | { ok: false; error: string };

// What the server keeps from a submission, or why it can't.
export function checkFeedback(raw: unknown): CheckedFeedback {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = text(o.name, 100).replace(/\s+/g, " ");
  const email = text(o.email, 200).toLowerCase();
  const mood = int(o.mood), recommend = int(o.recommend);
  if (!name) return { ok: false, error: "Tell us your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter your email address." };
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) return { ok: false, error: "Choose how your first month has been, from 1 to 5." };
  if (!Number.isInteger(recommend) || recommend < 0 || recommend > 10) return { ok: false, error: "Choose how likely you are to recommend us, from 0 to 10." };
  const love = text(o.love), missing = text(o.missing);
  if (typeof o.contactOk !== "boolean") return { ok: false, error: "Can we contact you about your answers? Choose yes or no." };
  return { ok: true, value: { name, email, mood, love, missing, recommend, contactOk: o.contactOk } };
}

// The lead's message: the answers as plain words, so the reply reads well anywhere a lead is shown (and in a search).
export function feedbackMessage(f: FeedbackAnswers): string {
  const mood = MOOD_SCALE.find((m) => m.value === f.mood);
  return [
    `First month: ${f.mood}/5${mood ? ` (${mood.label})` : ""}`,
    `Would recommend: ${f.recommend}/10`,
    f.love ? `Loves: ${f.love}` : "",
    f.missing ? `Missing or broken: ${f.missing}` : "",
    `Can we contact them: ${f.contactOk ? "yes" : "no"}`,
  ].filter(Boolean).join("\n");
}

// Net Promoter Score from 0 to 10 answers: % promoters (9 and 10) less % detractors (0 to 6). null with no answers.
export function nps(scores: number[]): number | null {
  if (!scores.length) return null;
  const promoters = scores.filter((s) => s >= 9).length, detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}
export const average = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
