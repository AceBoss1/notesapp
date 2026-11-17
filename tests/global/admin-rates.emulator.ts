// A subscription paid in another currency takes the commission saved in Admin → Pricing and the VIP share saved in Admin → Limits →
// Subscriptions and fans, on a server that has not loaded either yet (lib/global-pay-server.ts). Before, such a server used the
// built-in rates. Run: npm run test:global → "GLOBAL ADMIN RATES OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
process.env.ACCOUNT_DATA_KEY = Buffer.alloc(32, 7).toString("base64");

(async () => {
  const S = await import("../../lib/global-pay-server");
  const { DEFAULT_PRICING } = await import("../../lib/pricing");
  const { tierRate, fanSettings } = await import("../../lib/fans");
  const t0 = new Date();
  // The admin has set Pro's commission to 15% (built in: something else) and the VIP share to 30% (built in: 10%).
  assert.notEqual(DEFAULT_PRICING.pro.session, 0.15);
  await db.doc("platformSettings/pricing").set({ config: { ...DEFAULT_PRICING, pro: { ...DEFAULT_PRICING.pro, session: 0.15 } }, updatedAt: t0.toISOString() });
  await db.doc("serverConfig/fans").set({ overrides: { vipUpliftPct: 30 } });

  await db.doc("usernames/amina").set({ uid: "p_adm" }); await db.doc("users/p_adm").set({ username: "amina", accountTier: "pro" });
  await db.doc("users/r_adm").set({ username: "r_adm" });
  await S.saveGlobal(db, "p_adm", { currency: "KES", tiers: { premium: { enabled: true, price: 650 }, vip: { enabled: true, price: 2000 } } });
  await S.setRates(db, "fin", { perUsd: { NGN: 1500, KES: 129 }, marginPct: 3, reservePct: 10 }, t0);
  const fake = { checkout: async (p: { reference: string }) => `https://pay.test/${p.reference}` };

  const premium = await S.startCheckout(db, { uid: "r_adm", email: "r@x.test" }, { username: "amina", tier: "premium", currency: "USD" }, fake, t0);
  assert.equal((await db.doc(`globalPayments/${premium.reference}`).get()).data()?.commissionRate, 0.15);
  const vip = await S.startCheckout(db, { uid: "r_adm", email: "r@x.test" }, { username: "amina", tier: "vip", currency: "USD" }, fake, t0);
  assert.equal((await db.doc(`globalPayments/${vip.reference}`).get()).data()?.commissionRate, tierRate(0.15, "vip", fanSettings({ vipUpliftPct: 30 })));
  assert.equal(tierRate(0.15, "vip", fanSettings({ vipUpliftPct: 30 })), 0.195);
  console.log("GLOBAL ADMIN RATES OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
