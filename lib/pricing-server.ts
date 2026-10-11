import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { DEFAULT_PRICING, PricingError, applyPricing, cleanPricing, currentPricing, describeChanges, type PricingConfig } from "./pricing";

// Server side of the pricing settings. Collections (server-only in firestore.rules): platformSettings/pricing (the saved config) and
// pricingLog (who changed what, never edited). Money paths call ensurePricing() first so a change takes effect within seconds.
const DOC = "platformSettings/pricing";
const TTL_MS = 20_000;
let loadedAt = 0;

// Reads the saved config (if any) and applies it to this server instance. Cheap: at most one read every 20 seconds per instance.
export async function ensurePricing(db: Firestore = getAdminDb(), now = Date.now()): Promise<void> {
  if (now - loadedAt < TTL_MS) return;
  loadedAt = now;
  try {
    const saved = (await db.doc(DOC).get()).data()?.config;
    const cfg = saved ? cleanPricing(saved) : DEFAULT_PRICING;
    applyPricing(cfg); // idempotent and cheap, so no need to compare first
  } catch (e) {
    loadedAt = 0; // try again next time; the values already applied (or the defaults) stay in force
    console.error("pricing load failed", e);
  }
}

export async function pricingView(db: Firestore) {
  await ensurePricing(db, Date.now() + TTL_MS);
  const snap = (await db.doc(DOC).get()).data();
  const log = (await db.collection("pricingLog").orderBy("at", "desc").limit(30).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  return { config: currentPricing(), defaults: DEFAULT_PRICING, customised: !!snap?.config, updatedAt: snap?.updatedAt ?? null, updatedBy: snap?.updatedByEmail ?? null, log };
}

export type PricingCaller = { uid: string; email: string; owner: boolean; super: boolean };

// Only the owner and super admins change prices. Every change is checked, saved, applied here and logged (the log is on the pricing page).
export async function savePricing(db: Firestore, c: PricingCaller, input: unknown, reset = false, now = new Date()): Promise<{ changes: string[] }> {
  if (!c.owner && !c.super) throw new PricingError("Only the owner and super admins can change prices.", 403);
  await ensurePricing(db, Date.now() + TTL_MS); // compare with what is really saved, not with this instance's possibly stale copy
  const before = currentPricing();
  const next: PricingConfig = reset ? DEFAULT_PRICING : cleanPricing(input);
  const changes = describeChanges(before, next);
  if (!changes.length) throw new PricingError("Nothing changed.");
  const at = now.toISOString();
  if (reset) await db.doc(DOC).delete(); else await db.doc(DOC).set({ config: next, updatedAt: at, updatedByUid: c.uid, updatedByEmail: c.email });
  await db.collection("pricingLog").add({ at, byUid: c.uid, byEmail: c.email, reset, changes: changes.slice(0, 60) });
  applyPricing(next);
  loadedAt = Date.now();
  return { changes };
}
