import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "./api-errors";
import { getAdminDb, verifySignedInRequest } from "./firebase-admin";
import { effectiveTier } from "./users";
import { getTierConfig } from "./tiers";

export const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

export type ConsoleMember = { uid: string; user: Record<string, any>; apiAccess: boolean; apiPlan: boolean; domainAllowed: boolean };

// The signed-in member behind a /api/console request, plus what their account unlocks:
// API keys & webhooks need an Enterprise plan AND the admin-set `apiAccess` flag; custom domains need a tier that includes
// them (Business and Enterprise).
export async function consoleMember(req: NextRequest): Promise<ConsoleMember> {
  const { uid } = await verifySignedInRequest(bearer(req));
  const user = (await getAdminDb().doc(`users/${uid}`).get()).data();
  if (!user) throw new HttpError(404, "No profile found for this account.");
  if (user.suspended) throw new HttpError(403, "This account is suspended.");
  const tier = getTierConfig(effectiveTier(user as never));
  const apiPlan = !!tier.apiAccess;
  return { uid, user, apiAccess: apiPlan && user.apiAccess === true, apiPlan, domainAllowed: !!tier.customDomain };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function consoleRoute(fallback: string, fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, fallback);
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export const needApi = (m: ConsoleMember) => {
  if (!m.apiAccess) throw new HttpError(403, "API access isn't enabled for this account yet. It's switched on per account — send us a request at /contact?topic=api.");
};
