// The shop's crypto rule and the advert flags (lib/money-rules.ts). Run: npm run test:money → "ALL OK".
import assert from "node:assert/strict";
import { adFlags, cryptoListing } from "../../lib/money-rules";

for (const t of ["USDT for sale", "Buy USDT at the best rate", "Instant USDT to naira", "Bitcoin P2P exchange", "Sell your crypto here", "USDC rates today", "Crypto cash out service", "BTC OTC desk"])
  assert.equal(cryptoListing(t), true, t);
for (const t of ["Crypto basics: a beginner's guide", "How to buy Bitcoin safely (ebook)", "Stablecoins explained course", "Ethiopian coffee beans, available now", "A token of love gift box", "Exchange-ready travel adapter", "Leather wallet for sale", "Decorated cake for sale", "Cryptography textbook", "Rate card template"])
  assert.equal(cryptoListing(t), false, t);

assert.deepEqual(adFlags("Trade USDT on our licensed exchange"), { crypto: true, yieldPromise: false });
assert.deepEqual(adFlags("Stake and earn 20% APY"), { crypto: false, yieldPromise: true });
assert.deepEqual(adFlags("Save in USDC and earn 5% monthly returns"), { crypto: true, yieldPromise: true });
assert.deepEqual(adFlags("Fresh Ethiopian coffee, 10% off this week"), { crypto: false, yieldPromise: false });
assert.deepEqual(adFlags("Learn web development in 12 weeks"), { crypto: false, yieldPromise: false });
console.log("ALL OK");
