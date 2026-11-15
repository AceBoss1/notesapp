// The month grid and day labels behind components/MonthCalendar.tsx, kept pure (no React, no "use client") so server code can use
// them too: My Calendar's week-ahead email and the agenda (lib/my-calendar.ts). Dates are "YYYY-MM-DD" strings, counted as
// calendar days (no time zone maths).

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Written out by hand (not toLocaleDateString), so the server and every browser print the same words.
export function dayLabel(day: string, short = false): string {
  const d = new Date(`${day}T12:00:00Z`);
  const wd = WEEKDAYS[d.getUTCDay()], mo = MONTHS[d.getUTCMonth()];
  return short ? `${wd.slice(0, 3)} ${d.getUTCDate()} ${mo.slice(0, 3)}` : `${wd} ${d.getUTCDate()} ${mo}`;
}

// The cells of a month, Monday first: null for the blanks before the 1st.
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 = Sunday
  const lead = (first + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => isoDay(year, month, i + 1))];
}
