// Young members (docs/YOUNG_MEMBERS.md): the age rules shared by teen mode, kids mode and turning 18. Pure, client-safe.
// We keep a birth month and year only (never the day), on the server, never shown: enough to know when someone turns 13 or 18.
// A birthday counts from the first of its month.

export const TEEN_FROM = 13;
export const ADULT_AT = 18;

export class YoungError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export const isBirth = (b: unknown): b is string => typeof b === "string" && /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(b);

// Age in whole years on a date (YYYY-MM-DD), from a birth month (YYYY-MM).
export function ageOn(birth: string, day: string): number {
  const [by, bm] = birth.split("-").map(Number), [y, m] = day.split("-").map(Number);
  return y - by - (m < bm ? 1 : 0);
}

// The first day of the month someone turns `age`.
export const turnsOn = (birth: string, age: number) => `${Number(birth.slice(0, 4)) + age}-${birth.slice(5, 7)}-01`;

export function cleanBirth(month: unknown, year: unknown): string {
  const m = Number(month), y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 1900 || y > 2100) throw new YoungError("Choose the month and year you were born.");
  return `${y}-${String(m).padStart(2, "0")}`;
}

// Teen mode is for 13 to 17. Under 13, a parent sets up a child profile on their own account; 18 or over, it isn't needed.
export function teenBirth(month: unknown, year: unknown, today: string): string {
  const b = cleanBirth(month, year);
  const age = ageOn(b, today);
  if (age >= ADULT_AT) throw new YoungError("You're 18 or older, so teen mode isn't needed. You can use everything as you are.");
  if (age < TEEN_FROM) throw new YoungError("Under 13, a parent or guardian needs to set you up from their own NotesApp account, as a child profile.");
  return b;
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
