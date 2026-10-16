import type { NextRequest } from "next/server";
import { getAdminDb } from "./firebase-admin";
import { ourRoot, SITE_URL } from "./host";

// Where Paystack sends the buyer back to: the domain they paid on. Our own domains all serve the site under their own name
// (lib/host.ts), so a buyer on www.notesapp.name.ng comes back there; on a member's own domain (an active customDomains record)
// it's that domain, so they finish where they began. Local development and previews use the request's own origin.
export async function callbackOrigin(req: NextRequest): Promise<string> {
  const host = (req.headers.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  if (!host) return SITE_URL;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app")) return req.nextUrl.origin.replace(/\/$/, "");
  if (ourRoot(host)) return `https://${host}`;
  try {
    const d = (await getAdminDb().doc(`customDomains/${host}`).get()).data();
    if (d?.status === "active") return `https://${host}`;
    return d ? SITE_URL : `https://${host}`; // a domain no member added is one of ours (lib/host.ts)
  } catch {
    return SITE_URL;
  }
}
