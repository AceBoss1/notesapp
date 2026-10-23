// Client invoice rules (lib/invoices.ts). Run: npm run test:invoices → "ALL OK".
import assert from "node:assert/strict";
import { canDraftFor, dueFrom, invoiceNumber, linesFrom, monthWeeks, overdue, publicView, reminderDue, totals, type Invoice } from "../../lib/invoices";

assert.deepEqual(monthWeeks("2026-10"), ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
const lines = linesFrom({ "2026-09-30": 60, "2026-10-01": 90, "2026-10-02": 30, "2026-10-13": 120, "2026-11-02": 60, "2026-10-20": 0 }, "2026-10", 500000);
assert.deepEqual(lines, [{ week: "2026-09-28", minutes: 120, amountKobo: 1_000_000 }, { week: "2026-10-12", minutes: 120, amountKobo: 1_000_000 }], "only October's days; empty weeks dropped");
assert.deepEqual(totals(lines, 0), { minutes: 240, subtotalKobo: 2_000_000, vatKobo: 0, totalKobo: 2_000_000 });
assert.deepEqual(totals(lines, 75), { minutes: 240, subtotalKobo: 2_000_000, vatKobo: 150_000, totalKobo: 2_150_000 }, "VAT 7.5%");
assert.equal(invoiceNumber(2026, 14), "NA-INV-2026-014"); assert.equal(dueFrom("2026-11-01"), "2026-11-15");
assert.equal(canDraftFor("2026-10", "2026-10-23"), true); assert.equal(canDraftFor("2026-11", "2026-10-23"), false);
const inv = { status: "sent", dueOn: "2026-11-15", remindedAt: undefined } as unknown as Invoice;
assert.equal(overdue(inv, "2026-11-15"), false); assert.equal(overdue(inv, "2026-11-16"), true);
assert.equal(reminderDue(inv, "2026-11-17"), false); assert.equal(reminderDue(inv, "2026-11-18"), true, "3 days after the due date");
assert.equal(reminderDue({ ...inv, remindedAt: "x" }, "2026-12-01"), false, "once");
const pv = publicView({ ...inv, createdBy: "u_fin", ledgerEntryId: "e1", payRef: "r1" } as Invoice) as Record<string, unknown>;
assert.equal("createdBy" in pv || "ledgerEntryId" in pv || "payRef" in pv, false, "nothing internal for the client");
console.log("ALL OK");
