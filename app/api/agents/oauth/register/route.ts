import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { registerClient } from "@/lib/agents/grants-server";
import { oauthFail, oauthJson, preflight, readBody } from "@/lib/agents/oauth-http";

export const dynamic = "force-dynamic";
// Dynamic client registration (RFC 7591): an assistant says its name and where to send the member back. Public clients only (PKCE).
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "agent-register", clientIp(req), 20, 3600);
  if (limited) return oauthJson({ error: "slow_down", error_description: "Too many registrations. Try again later." }, 429);
  try { return oauthJson(await registerClient(getAdminDb(), await readBody(req)), 201); }
  catch (e) { return oauthFail(e); }
}
export const OPTIONS = preflight;
