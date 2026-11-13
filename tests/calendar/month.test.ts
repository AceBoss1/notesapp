// The month grid used by the booking calendars (components/MonthCalendar.tsx). Run: npm run test:calendar
import assert from "node:assert/strict";
import { monthCells } from "../../components/MonthCalendar";

const nov = monthCells(2026, 10); // November 2026 starts on a Sunday
assert.equal(nov.filter((c) => c === null).length, 6, "Monday-first: six blanks before Sunday the 1st");
assert.equal(nov[6], "2026-11-01"); assert.equal(nov.at(-1), "2026-11-30"); assert.equal(nov.length, 36);
const feb = monthCells(2027, 1); // February 2027 starts on a Monday, 28 days
assert.equal(feb[0], "2027-02-01"); assert.equal(feb.length, 28);
assert.equal(monthCells(2028, 1).at(-1), "2028-02-29", "leap year");
const dec = monthCells(2026, 11); // Tuesday the 1st
assert.equal(dec[1], "2026-12-01"); assert.equal(dec.at(-1), "2026-12-31");
console.log("ALL OK");
