// Tournament times as players read them: Lagos time, e.g. "Sat, 29 Nov, 10:00 am". Its own file so the public tournament pages can use
// it without loading lib/arcade/tournaments.ts (which reaches the game registry and every game's replay code).
export const lagosWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });
