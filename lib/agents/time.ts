import type { AgentSettings } from "./config";

// Lagos time for the agent layer (WAT, UTC+1, no daylight saving): the day an agent's action count belongs to (it resets at midnight
// Lagos), and when the weekly summary is due. Pure.
const LAGOS_MS = 3_600_000;
export const dayKey = (now: Date) => new Date(now.getTime() + LAGOS_MS).toISOString().slice(0, 10);
export function nextLagosMidnight(now: Date): Date {
  const d = new Date(now.getTime() + LAGOS_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - LAGOS_MS);
}
// ISO week of the Lagos date, "2026-W45": one summary per member per week.
export function isoWeekKey(now: Date): string {
  const d = new Date(now.getTime() + LAGOS_MS);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86_400_000 + 1) / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}
// The summary goes on its day (Monday) from its hour (07:00 Lagos) onwards; the week key keeps it to once.
export function isSummaryTime(now: Date, s: AgentSettings): boolean {
  const d = new Date(now.getTime() + LAGOS_MS);
  return d.getUTCDay() === s.weeklySummaryWeekday && d.getUTCHours() >= s.weeklySummaryHour;
}
