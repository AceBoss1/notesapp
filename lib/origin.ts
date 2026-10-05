import type { NextRequest } from "next/server";
import { getAdminDb } from "./firebase-admin";
import { isMainHost } from "./host";

// Where Paystack sends the buyer back to. Normally the main site; when the payment was started on a member's own domain
// (an active customDomains record), it's that domain, so they finish where they began.
export async function callbackOrigin(req: NextRequest): Promise<string> {
  const main = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
  const host = (req.headers.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  if (!host || isMainHost(host)) return main;
  try {
    const d = (await getAdminDb().doc(`customDomains/${host}`).get()).data();
    return d?.status === "active" ? `https://${host}` : main;
  } catch {
    return main;
  }
}
