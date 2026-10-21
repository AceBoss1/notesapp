// The basket's rules (lib/cart.ts). Run: npm run test:cart → "ALL OK".
import assert from "node:assert/strict";
import { CART_MAX_LINES, cartAmounts, cartChildRef, cleanCartLines } from "../../lib/cart";

assert.equal(cleanCartLines([]), "Your basket is empty.");
assert.equal(cleanCartLines("x"), "Your basket is empty.");
assert.equal(typeof cleanCartLines([{ itemId: "a/b", quantity: 1 }]), "string", "odd ids are refused");
assert.equal(typeof cleanCartLines([{ itemId: "a", quantity: 0 }]), "string");
assert.equal(typeof cleanCartLines([{ itemId: "a", quantity: 1.5 }]), "string");
// the same item with the same options becomes one line; different options stay apart
assert.deepEqual(cleanCartLines([{ itemId: "a", quantity: 1, variant: ["M", "Red"] }, { itemId: "a", quantity: 2, variant: ["M", "Red"] }, { itemId: "a", quantity: 1, variant: ["L", "Red"] }, { itemId: "b", quantity: 1, variant: [] }]),
  [{ itemId: "a", quantity: 3, variant: ["M", "Red"] }, { itemId: "a", quantity: 1, variant: ["L", "Red"] }, { itemId: "b", quantity: 1 }]);
assert.match(String(cleanCartLines([{ itemId: "a", quantity: 6 }, { itemId: "a", quantity: 6 }])), /up to 10/);
assert.match(String(cleanCartLines(Array.from({ length: CART_MAX_LINES + 1 }, (_, i) => ({ itemId: `i${i}`, quantity: 1 })))), /up to 20 different/);

assert.equal(cartChildRef("NA-123", 0), "NA-123_1");
assert.equal(cartChildRef("NA-123", 2), "NA-123_3");
// delivery is charged once, on the first order; the orders add up to the basket
const amounts = cartAmounts([{ unitKobo: 500000, quantity: 2 }, { unitKobo: 300000, quantity: 1 }], 250000);
assert.deepEqual(amounts, [1250000, 300000]);
assert.equal(amounts.reduce((a, b) => a + b, 0), 2 * 500000 + 300000 + 250000);
console.log("ALL OK");
