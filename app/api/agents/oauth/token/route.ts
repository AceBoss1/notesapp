import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { exchangeCode, pollDevice } from "@/lib/agents/grants-server";
import { oauthFail, oauthJson, preflight, readBody } from "@/lib/agents/oauth-http";

export const dynamic = "force-dynamic";
// The token endpoint: an authorization code with its PKCE verifier, or a device code being polled. The token is handed out once and
// lasts as long as the member chose (90 days by default); after that the assistant asks again. There are no refresh tokens.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "agent-token", clientIp(req), 60, 60);
  if (limited) return oauthJson({ error: "slow_down", error_description: "Polling too fast." }, 429);
  try {
    const b = await readBody(req);
    const db = getAdminDb();
    if (b.grant_type === "authorization_code") return oauthJson(await exchangeCode(db, b));
    if (b.grant_type === "urn:ietf:params:oauth:grant-type:device_code") {
      const r = await pollDevice(db, b.device_code);
      if (r.status === "connected") return oauthJson(r.token);
      return oauthJson({ error: r.status === "waiting" ? "authorization_pending" : r.status === "denied" ? "access_denied" : "expired_token" }, 400);
    }
    return oauthJson({ error: "unsupported_grant_type", error_description: "Use authorization_code or the device code grant." }, 400);
  } catch (e) { return oauthFail(e); }
}
export const OPTIONS = preflight;
