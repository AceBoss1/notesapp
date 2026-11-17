import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { AvatarError } from "@/lib/avatar-maker";
import { effectiveTier } from "@/lib/effective-tier";
import { isPaidTier, TIER_NAME } from "@/lib/nana-portrait";
import type { AccountTier } from "@/lib/users";

// Shared by /api/portrait/access and /api/portrait/generate (Nana AI, the portrait studio: lib/nana-portrait.ts).
export const NO_STORE = { "Cache-Control": "no-store" };
export const fail = (err: unknown, fallback: string) => {
  if (err instanceof AvatarError) return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status, headers: NO_STORE });
};
export const who = (req: NextRequest) => verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
// The member's plan, as the rest of NotesApp sees it (founders and admins count as Business).
export async function planOf(uid: string): Promise<{ tier: AccountTier; name: string; paid: boolean }> {
  const u = (await getAdminDb().doc(`users/${uid}`).get()).data() ?? {};
  const tier = effectiveTier({ username: String(u.username ?? ""), role: u.role ?? "reader", accountTier: (u.accountTier ?? "standard") as AccountTier });
  return { tier, name: TIER_NAME[tier] ?? "Free", paid: isPaidTier(tier) };
}
