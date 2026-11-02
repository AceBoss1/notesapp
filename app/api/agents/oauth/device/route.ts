import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { startDevice } from "@/lib/agents/grants-server";
import { formatCode } from "@/lib/agents/pairing";
import { agentUrls, requestHost } from "@/lib/agents/urls";
import { oauthFail, oauthJson, preflight, readBody } from "@/lib/agents/oauth-http";

export const dynamic = "force-dynamic";
// Device authorization (RFC 8628): for an assistant that can't open a browser. It shows the member the code and the link (the main site
// of the domain it called, /link); the member types the code there and connects; the assistant polls the token endpoint.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "agent-connect", clientIp(req), 10, 600);
  if (limited) return oauthJson({ error: "slow_down", error_description: "Too many connect requests. Try again in a few minutes." }, 429);
  try {
    const b = await readBody(req);
    const d = await startDevice(getAdminDb(), { clientId: b.client_id, agentName: b.client_name });
    const u = agentUrls(requestHost(req.headers));
    return oauthJson({ device_code: d.deviceCode, user_code: formatCode(d.code), verification_uri: u.link, verification_uri_complete: `${u.connect}?code=${d.code}`, expires_in: Math.round((new Date(d.expiresAt).getTime() - Date.now()) / 1000), interval: 5 });
  } catch (e) { return oauthFail(e); }
}
export const OPTIONS = preflight;
