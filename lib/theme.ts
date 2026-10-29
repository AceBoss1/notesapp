// Day, Night or Auto for the whole #NotesApp app (not members' sites, which have their own look, nor Exam Prep or the Notes Life game).
// Day is the warm ivory paper; Night is the #NotesApp maroon with ivory text; Auto follows the clock: Night from 6:30 in the evening
// to 6:30 in the morning, the member's own time. The choice is kept on the device (localStorage), and a small script in the page's
// <head> (THEME_SCRIPT) applies it before the first paint, so the page never flashes the wrong colours.

export type ThemeChoice = "day" | "night" | "auto";
export type Theme = "day" | "night";

export const THEME_KEY = "notesapp:theme";
export const THEME_CHOICES: { id: ThemeChoice; icon: string; label: string; note: string }[] = [
  { id: "day", icon: "☀", label: "Day", note: "Warm ivory paper" },
  { id: "night", icon: "☽", label: "Night", note: "#NotesApp maroon" },
  { id: "auto", icon: "◐", label: "Auto", note: "Night from 6:30 pm to 6:30 am" },
];
export const DEFAULT_THEME_CHOICE: ThemeChoice = "day";

// Night starts and ends at these minutes past midnight (18:30 and 06:30), close to sunset and sunrise across Nigeria all year.
export const NIGHT_FROM = 18 * 60 + 30;
export const NIGHT_UNTIL = 6 * 60 + 30;

export const isThemeChoice = (v: unknown): v is ThemeChoice => v === "day" || v === "night" || v === "auto";

export function themeFor(choice: ThemeChoice, now: Date = new Date()): Theme {
  if (choice !== "auto") return choice;
  const m = now.getHours() * 60 + now.getMinutes();
  return m >= NIGHT_FROM || m < NIGHT_UNTIL ? "night" : "day";
}

// The same rule as themeFor, written out for the <head> script (it runs before any of our code loads). Kept in step by
// tests/theme.test.ts.
export const THEME_SCRIPT = `try{var c=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(c!=="day"&&c!=="night"&&c!=="auto")c=${JSON.stringify(DEFAULT_THEME_CHOICE)};var t=c;if(c==="auto"){var d=new Date(),m=d.getHours()*60+d.getMinutes();t=m>=${NIGHT_FROM}||m<${NIGHT_UNTIL}?"night":"day"}document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-theme-choice",c)}catch(e){}`;

// ── In the browser ──

export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isThemeChoice(v) ? v : DEFAULT_THEME_CHOICE;
  } catch {
    return DEFAULT_THEME_CHOICE;
  }
}

export function applyTheme(choice: ThemeChoice = readThemeChoice()): Theme {
  const t = themeFor(choice);
  const el = document.documentElement;
  el.setAttribute("data-theme", t);
  el.setAttribute("data-theme-choice", choice);
  return t;
}

export const THEME_EVENT = "notesapp:theme";

export function saveThemeChoice(choice: ThemeChoice) {
  try { localStorage.setItem(THEME_KEY, choice); } catch { /* private mode: still applies for this visit */ }
  applyTheme(choice);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: choice }));
}
