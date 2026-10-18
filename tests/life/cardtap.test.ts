// Paylony CardTap in Notes Life (lib/life/cardtap.ts): what the terminal shows for each payment, and when no tap is needed.
// Run: npm run test:cardtap → "ALL OK". The economy emulator test checks the same amounts against what the server charges.
import assert from "node:assert/strict";
import { cardLast4, tapCharge } from "../../lib/life/cardtap";
import { FUEL_NAIRA, ITEM, OUTLET_BACKUP } from "../../lib/life/catalog";

const none = { jobId: null };

// shop items: market or itel, staff price for itel staff
assert.deepEqual(tapCharge({ action: "buy", item: "cooker" }, none), { payee: "Wuse market", what: ITEM("cooker")!.name, amount: ITEM("cooker")!.price });
assert.equal(tapCharge({ action: "buy", item: "power_go" }, none)?.payee, "itel Energy");
assert.equal(tapCharge({ action: "buy", item: "power_go" }, { jobId: "itel_sales" })?.amount, Math.round(ITEM("power_go")!.price * 0.8), "itel staff pay 20% less");
assert.equal(tapCharge({ action: "buy", item: "phone_basic" }, none), null, "starter items aren't sold");
assert.equal(tapCharge({ action: "buy", item: "home_kit" }, none), null, "coming-soon items aren't sold");
assert.equal(tapCharge({ action: "buy", item: "nope" }, none), null);

// Chef Adams: the menu plus the delivery fee; nothing for an empty, oversized or unknown order
const food = tapCharge({ action: "food", mode: "delivery", items: [{ id: "combo", qty: 2 }] }, none);
assert.equal(food?.payee, "Chef Adams"); assert.equal(food?.what, "Delivery · 2 items");
assert.equal(tapCharge({ action: "food", mode: "takeaway", items: [{ id: "combo", qty: 0 }] }, none), null);
assert.equal(tapCharge({ action: "food", mode: "takeaway", items: [{ id: "combo", qty: 9 }] }, none), null);
assert.equal(tapCharge({ action: "food", mode: "takeaway", items: [{ id: "lobster", qty: 1 }] }, none), null);
assert.equal(tapCharge({ action: "food", mode: "teleport", items: [{ id: "combo", qty: 1 }] }, none), null);

// fares: your own bicycle, e-bike or car is free, so no tap
assert.deepEqual(tapCharge({ action: "travel", mode: "bus", to: "work" }, none), { payee: "Abuja Metro", what: "Metro bus fare", amount: 200 });
assert.equal(tapCharge({ action: "travel", mode: "taxi" }, none)?.amount, 1_500);
for (const m of ["bicycle", "ebike", "ev"]) assert.equal(tapCharge({ action: "travel", mode: m }, none), null, m);

// the Candellux: half price at the pool for its staff, nothing for what isn't open
assert.equal(tapCharge({ action: "hotel", service: "pool" }, { jobId: "hotel_house" })?.amount, 12_500);
assert.equal(tapCharge({ action: "hotel", service: "pool" }, none)?.amount, 25_000);
assert.equal(tapCharge({ action: "hotel", service: "conference" }, none), null);

// petrol, deals, outlets, courses
assert.equal(tapCharge({ action: "fuel", litres: 3 }, none)?.amount, 3 * FUEL_NAIRA);
assert.equal(tapCharge({ action: "fuel", litres: 0 }, none), null);
const deal = { who: "Mama Nkechi", cost: 20_000, state: "offered" };
assert.deepEqual(tapCharge({ action: "deal_answer", answer: "accept" }, { jobId: null, deal }), { payee: "Mama Nkechi", what: "Goods for the deal", amount: 20_000 });
assert.equal(tapCharge({ action: "deal_answer", answer: "negotiate" }, { jobId: null, deal })?.amount, 20_000);
assert.equal(tapCharge({ action: "deal_answer", answer: "decline" }, { jobId: null, deal }), null, "declining costs nothing");
assert.equal(tapCharge({ action: "deal_answer", answer: "accept" }, { jobId: null, deal: { ...deal, state: "active" } }), null);
assert.deepEqual(tapCharge({ action: "outlet_open", outlet: "chef_kiosk" }, none), { payee: "Chef Adams", what: "Chef Adams Takeaway Kiosk", amount: 2_500_000 });
assert.equal(tapCharge({ action: "outlet_open", outlet: "chef_kiosk", area: "garki" }, none)?.amount, 2_800_000, "Garki costs more");
assert.equal(tapCharge({ action: "outlet_backup", outlet: "chef_kiosk" }, none)?.amount, OUTLET_BACKUP.price);
assert.equal(tapCharge({ action: "dw_enroll", course: "nope" }, none), null);

// things that aren't payments never show the terminal
for (const action of ["shift_start", "shift_finish", "job_apply", "outlet_collect", "deal_collect", "dw_class", "dw_giveaway"]) assert.equal(tapCharge({ action }, none), null, action);

// the card's last four digits: four digits, the same every time for the same player
assert.match(cardLast4("abc123"), /^\d{4}$/);
assert.equal(cardLast4("abc123"), cardLast4("abc123"));
assert.notEqual(cardLast4("abc123"), cardLast4("abc124"));

console.log("ALL OK");
