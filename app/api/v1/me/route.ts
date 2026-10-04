import { NextResponse } from "next/server";
import { v1, SITE_URL } from "@/lib/api-v1";
import { getAdminDb } from "@/lib/firebase-admin";
import { effectiveTier } from "@/lib/users";

export const dynamic = "force-dynamic";

// Any valid key can ask who it belongs to.
export const GET = v1("any", async (_req, { uid, user }) => {
  const settings = (await getAdminDb().doc(`publisherSettings/${uid}`).get()).data();
  return NextResponse.json({
    id: uid, username: user.username, display_name: user.displayName, plan: effectiveTier(user as never),
    profile_url: `${SITE_URL()}/u/${user.username}`, payouts_ready: !!settings?.payoutReady,
  });
});
