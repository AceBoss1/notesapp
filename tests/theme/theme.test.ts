// Day, Night and Auto (lib/theme.ts): the clock rule, and the <head> script agreeing with it.
// Run: npm run test:theme
import assert from "node:assert/strict";
import { THEME_KEY, THEME_SCRIPT, themeFor, type ThemeChoice } from "../../lib/theme";

const at = (h: number, m: number) => new Date(2026, 9, 29, h, m);

assert.equal(themeFor("day", at(23, 0)), "day", "Day is always day");
assert.equal(themeFor("night", at(12, 0)), "night", "Night is always night");
for (const [h, m, want] of [[6, 29, "night"], [6, 30, "day"], [12, 0, "day"], [18, 29, "day"], [18, 30, "night"], [0, 0, "night"], [23, 59, "night"]] as const)
  assert.equal(themeFor("auto", at(h, m)), want, `Auto at ${h}:${m}`);

// Run the <head> script against a stand-in page, for each saved choice and a spread of times.
function runScript(saved: string | null, now: Date) {
  const attrs: Record<string, string> = {};
  const RealDate = Date;
  const FakeDate = function (this: unknown, ...a: unknown[]) { return a.length ? new (RealDate as unknown as new (...x: unknown[]) => Date)(...a) : new RealDate(now); } as unknown as DateConstructor;
  const fn = new Function("localStorage", "document", "Date", THEME_SCRIPT);
  fn({ getItem: (k: string) => (k === THEME_KEY ? saved : null) }, { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } }, FakeDate);
  return attrs;
}
for (const saved of ["day", "night", "auto", null, "rubbish"]) {
  for (let h = 0; h < 24; h++) for (const m of [0, 29, 30, 59]) {
    const now = at(h, m);
    const choice = (saved === "day" || saved === "night" || saved === "auto" ? saved : "day") as ThemeChoice;
    const got = runScript(saved, now);
    assert.equal(got["data-theme"], themeFor(choice, now), `script and themeFor agree (${saved} at ${h}:${m})`);
    assert.equal(got["data-theme-choice"], choice);
  }
}
console.log("THEME OK");
