// The Hotel kit's rules (lib/hotel.ts): tiers on the plans, the order lifecycle (paid only from a payment), holds and availability, prices
// from the menu, the room bill, cash-up, reports and Nana's price guard; and the Admin settings (lib/pricing.ts hotel). Run: npm run test:hotel → "ALL OK".
import assert from "node:assert/strict";
import {
  addonOn, addonUntil, billOwed, branchLimit, canMove, cashUp, checkDates, cleanDept, cleanMenuItem, cleanRoom, cleanTarget, cleanUnits, departmentLimit, hasFeature,
  holdsRoom, hotelTierOf, isCode, isLate, makeCode, moneyFigures, monthReport, naira, nightsBetween, orderNumber, priceLines, pricesGrounded, accountsGrounded,
  roleCan, roomsLeft, seesDept, spoken, type MenuItem,
} from "../../lib/hotel";
import { DEFAULT_PRICING, cleanPricing } from "../../lib/pricing";
import { randomBytes } from "node:crypto";

const now = new Date("2026-11-12T10:00:00Z");
const later = (min: number) => new Date(now.getTime() + min * 60_000).toISOString();

// Tiers ride on the plans: Starter = Pro, Standard = Business, Grand = Enterprise; nothing below Pro.
assert.equal(hotelTierOf("pro"), "starter"); assert.equal(hotelTierOf("business"), "standard"); assert.equal(hotelTierOf("enterprise"), "grand");
assert.equal(hotelTierOf("basic"), null); assert.equal(hotelTierOf("standard"), null);
assert.equal(hasFeature("starter", "kitchen"), false); assert.equal(hasFeature("standard", "kitchen"), true); assert.equal(hasFeature("standard", "nana"), false);
assert.equal(hasFeature("grand", "branches"), true); assert.equal(hasFeature(null, "board"), false);
assert.equal(departmentLimit("starter", 6), 1, "Starter has one department"); assert.equal(departmentLimit("standard", 6), 6); assert.equal(departmentLimit(null, 6), 0);
assert.equal(branchLimit("standard", 10), 1); assert.equal(branchLimit("grand", 10), 10);

// Admin settings: defaults, a config saved before the Hotel kit keeps them, and silly numbers are refused.
assert.equal(DEFAULT_PRICING.hotel.holdMinutes, 30); assert.equal(DEFAULT_PRICING.hotel.lateMinutes, 20); assert.ok(DEFAULT_PRICING.hotel.departmentsMax >= 2);
const { hotel: _h, ...older } = DEFAULT_PRICING;
assert.deepEqual(cleanPricing(older).hotel, DEFAULT_PRICING.hotel);
assert.equal(cleanPricing({ ...DEFAULT_PRICING, hotel: { ...DEFAULT_PRICING.hotel, holdMinutes: 45 } }).hotel.holdMinutes, 45);
assert.throws(() => cleanPricing({ ...DEFAULT_PRICING, hotel: { ...DEFAULT_PRICING.hotel, holdMinutes: 0 } }), /held/);
assert.throws(() => cleanPricing({ ...DEFAULT_PRICING, hotel: { ...DEFAULT_PRICING.hotel, whatsappMonthlyKobo: -1 } }), /WhatsApp/);

// Add-ons: on while paid; a paid month runs on from what's left.
assert.equal(addonOn({ account: later(60) }, "account", now), true); assert.equal(addonOn({ account: later(-1) }, "account", now), false); assert.equal(addonOn(undefined, "whatsapp", now), false);
assert.equal(addonUntil(later(60 * 24), now), new Date(now.getTime() + 86_400_000 + 31 * 86_400_000).toISOString());

// Staff roles: a department role sees only its own departments; only the owner moves money.
assert.equal(roleCan("department", "orders"), true); assert.equal(roleCan("department", "bookings"), false); assert.equal(roleCan("front_desk", "money"), false); assert.equal(roleCan("owner", "money"), true);
assert.equal(seesDept("department", { role: "department", depts: ["grill"], name: "x" }, "grill"), true);
assert.equal(seesDept("department", { role: "department", depts: ["grill"], name: "x" }, "bar"), false);
assert.equal(seesDept("manager", undefined, "bar"), true);

// Cleaning
assert.deepEqual(cleanUnits("201, 202,202 ; 203"), ["201", "202", "203"]); assert.equal(cleanUnits(3).length, 3); assert.deepEqual(cleanUnits("2"), ["1", "2"]);
assert.equal(typeof cleanRoom({ name: "Deluxe", priceKobo: 0, units: "1" }, "h"), "string");
const room = cleanRoom({ name: "Deluxe double", priceKobo: 4_500_000, units: "201,202" }, "h");
assert.ok(typeof room !== "string" && room.units.length === 2);
assert.equal(cleanDept({ name: "Grill" }, [])!.prefix, "G"); assert.equal(cleanDept({ name: "Grill" }, ["grill"])!.id, "grill-2"); assert.equal(cleanDept({ name: "" }), null);
assert.equal(typeof cleanMenuItem({ name: "Suya", priceKobo: 650_000, deptId: "bar" }, "h", ["grill"]), "string", "a department the hotel doesn't have");
assert.deepEqual(cleanTarget({ kind: "room", value: "204" }), { kind: "room", value: "204" }); assert.equal(cleanTarget({ kind: "room", value: "" }), null); assert.equal(cleanTarget({ kind: "boat" }), null);

// Dates
assert.equal(nightsBetween("2026-11-20", "2026-11-22"), 2);
assert.equal(checkDates("2026-11-20", "2026-11-22", now).ok, true);
assert.equal(checkDates("2026-11-01", "2026-11-03", now).ok, false, "not in the past");
assert.equal(checkDates("2026-11-22", "2026-11-20", now).ok, false);
assert.equal(checkDates("2026-11-20", "2027-03-01", now).ok, false, "too long");

// Holds and availability: a held booking keeps its room only until the hold runs out; the busiest night decides.
const held = { status: "held" as const, holdUntil: later(30), checkIn: "2026-11-20", checkOut: "2026-11-22" };
assert.equal(holdsRoom(held, now), true); assert.equal(holdsRoom(held, new Date(later(31))), false, "an expired hold frees the room at once");
assert.equal(holdsRoom({ ...held, status: "expired" }, now), false); assert.equal(holdsRoom({ ...held, status: "confirmed", holdUntil: later(-999) }, now), true);
assert.equal(roomsLeft(2, [held], "2026-11-20", "2026-11-22", now), 1);
assert.equal(roomsLeft(2, [held, { ...held, status: "confirmed" }], "2026-11-21", "2026-11-23", now), 0);
assert.equal(roomsLeft(2, [held, { ...held, status: "confirmed" }], "2026-11-22", "2026-11-24", now), 2, "check-out day is free");
assert.equal(roomsLeft(1, [{ ...held, checkIn: "2026-11-20", checkOut: "2026-11-21" }, { ...held, checkIn: "2026-11-21", checkOut: "2026-11-22" }], "2026-11-20", "2026-11-22", now), 0);
assert.equal(roomsLeft(2, [{ ...held, checkIn: "2026-11-20", checkOut: "2026-11-21" }, { ...held, checkIn: "2026-11-21", checkOut: "2026-11-22" }], "2026-11-20", "2026-11-22", now), 1);

// Orders: priced from the menu only, sold-out and other departments refused; quantities merged.
const menu: MenuItem[] = [
  { id: "suya", hotelId: "h", deptId: "grill", name: "Suya platter", note: "", priceKobo: 650_000, group: "", image: "", soldOut: false, stockItemId: "", order: 0 },
  { id: "asun", hotelId: "h", deptId: "grill", name: "Asun", note: "", priceKobo: 700_000, group: "", image: "", soldOut: false, stockItemId: "st1", order: 1 },
  { id: "soup", hotelId: "h", deptId: "grill", name: "Catfish pepper soup", note: "", priceKobo: 500_000, group: "", image: "", soldOut: true, stockItemId: "", order: 2 },
  { id: "beer", hotelId: "h", deptId: "bar", name: "Beer", note: "", priceKobo: 150_000, group: "", image: "", soldOut: false, stockItemId: "", order: 0 },
];
const p = priceLines([{ itemId: "suya", qty: 1, unitKobo: 1 }, { itemId: "asun", qty: 1 }, { itemId: "asun", qty: 1 }], menu, "grill");
assert.ok(p.ok && p.totalKobo === 2_050_000, "₦20,500 as drawn, whatever price was sent"); assert.ok(p.ok && p.lines[1].qty === 2 && p.lines[1].stockItemId === "st1");
assert.equal(priceLines([{ itemId: "soup", qty: 1 }], menu, "grill").ok, false);
assert.equal(priceLines([{ itemId: "beer", qty: 1 }], menu, "grill").ok, false);
assert.equal(priceLines([], menu, "grill").ok, false);
assert.equal(orderNumber("G", 18), "#G-118");

// The lifecycle: nobody moves an order to paid; no skipping steps.
assert.equal(canMove("awaiting_payment", "paid"), false); assert.equal(canMove("pending", "paid"), false);
assert.equal(canMove("paid", "preparing"), true); assert.equal(canMove("preparing", "ready"), true); assert.equal(canMove("ready", "completed"), true);
assert.equal(canMove("awaiting_payment", "preparing"), false, "unpaid orders never reach the kitchen"); assert.equal(canMove("on_bill", "preparing"), true);
assert.equal(canMove("completed", "preparing"), false); assert.equal(canMove("awaiting_payment", "cancelled"), true); assert.equal(canMove("paid", "cancelled"), false);
assert.equal(isLate({ status: "preparing", paidAt: later(-22), createdAt: later(-25) }, 20, now), true);
assert.equal(isLate({ status: "ready", paidAt: later(-40), createdAt: later(-40) }, 20, now), false);
assert.equal(spoken({ kind: "table", value: "4" }), "New order, table four"); assert.equal(spoken({ kind: "pickup", value: "" }), "New order, for pick-up");

// The room bill: the room if not paid ahead, plus unsettled room-bill orders.
assert.equal(billOwed(0, [{ status: "on_bill", totalKobo: 2_050_000, payMethod: "room_bill" }, { status: "on_bill", totalKobo: 300_000, payMethod: "room_bill", billSettledAt: "x" }, { status: "paid", totalKobo: 9, payMethod: "online" }]), 2_050_000);
assert.equal(billOwed(9_000_000, []), 9_000_000);

// Cash-up: cash counted against cash sales (less the float); card sales against the machine.
const cu = cashUp([{ method: "cash", totalKobo: 3_800_000 }, { method: "pos", totalKobo: 4_000_000 }, { method: "machine", totalKobo: 2_150_000 }, { method: "transfer", totalKobo: 2_200_000 }], 3_800_000, 6_150_000);
assert.deepEqual([cu.cashGapKobo, cu.cardKobo, cu.cardGapKobo, cu.transferKobo], [0, 6_150_000, 0, 2_200_000]);
assert.equal(cashUp([{ method: "cash", totalKobo: 1000 }], 900, null).cashGapKobo, -100); assert.equal(cashUp([], 0, null).cardGapKobo, null);

// Monthly report by branch and department (Grand): paid in the month, room bills when settled; nothing cancelled.
const rep = monthReport(
  [{ hotelId: "h", deptId: "grill", deptName: "Grill", totalKobo: 1000, status: "completed", paidAt: "2026-11-02T10:00:00Z", payMethod: "online" },
    { hotelId: "h_2", deptId: "bar", deptName: "Bar", totalKobo: 500, status: "completed", paidAt: "2026-10-30T10:00:00Z", billSettledAt: "2026-11-01T09:00:00Z", payMethod: "room_bill" },
    { hotelId: "h", deptId: "grill", deptName: "Grill", totalKobo: 999, status: "cancelled", paidAt: "2026-11-02T10:00:00Z", payMethod: "online" }],
  [{ hotelId: "h", totalKobo: 9000, status: "confirmed", paidAt: "2026-11-03T10:00:00Z" }], { h: "Osogbo", h_2: "Ikeja" }, "2026-11");
assert.equal(rep.totalKobo, 10_500); assert.equal(rep.rows.length, 2); assert.equal(rep.rooms.h.bookings, 1);

// Nana: every money figure in a reply must have come from a tool. "N17,000" or "₦17,000" or "17000 naira" style figures are caught.
assert.deepEqual(moneyFigures("Asun (₦14,000) and Chapman (N3,000). Total ₦17,000.50"), [1_400_000, 300_000, 1_700_050]);
assert.equal(pricesGrounded("Total ₦17,000.", "2 × Asun (₦7,000). Total ₦17,000."), true);
assert.equal(pricesGrounded("That's ₦15,000 for you.", "Total ₦17,000."), false, "an invented price is caught");
assert.equal(pricesGrounded("No wahala, e don enter!", ""), true);
assert.equal(accountsGrounded("Pay to 0123456789", "account 0123456789"), true); assert.equal(accountsGrounded("Pay to 9999999999", "account 0123456789"), false);
assert.equal(naira(2_050_000), "₦20,500"); assert.equal(naira(150), "₦1.50");

// Codes guests read out: no 0, O, 1, I or L.
const code = makeCode((n) => randomBytes(n));
assert.ok(isCode(code) && !/[01OIL]/.test(code)); assert.equal(isCode("ABC0EFGH"), false);
console.log("ALL OK");
