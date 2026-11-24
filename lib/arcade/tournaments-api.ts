import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "../api-errors";
import { verifySignedInRequest } from "../firebase-admin";
import { TournamentError } from "./tournaments-server";
import { createHash } from "crypto";
import { clientIp } from "../rate-limit";
import { setting } from "../config";

// Shared bits of the tournament API routes (app/api/arcade/tournaments/**, app/api/admin/arcade/tournaments), done the way /api/promos does them.
export const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
/** The signed-in member from the Bearer token, or null for a guest (or a bad token). */
export const signedIn = async (req: NextRequest) => {
  const me = await verifySignedInRequest(bearer(req)).catch(() => null);
  return me ? { uid: me.uid, emailVerified: !!me.emailVerified } : null;
};
export function tournamentFail(err: unknown, fallback: string) {
  if (err instanceof TournamentError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
}
export const NO_STORE = { "Cache-Control": "no-store" };

// Counting views and the sponsor's takeover (…/sponsor, …/view, and the list's POST): link previews, crawlers and headless browsers are
// left out, and a visitor is a salted hash of IP and browser, as /api/ads/track does it, so no IP is ever stored.
export const isBot = (ua: string) => /bot|crawler|spider|headless|preview|facebookexternalhit|whatsapp|slurp/i.test(ua);
export const visitorOf = (req: NextRequest) =>
  createHash("sha256").update(`${clientIp(req)}|${req.headers.get("user-agent") || ""}|${setting("AD_HASH_SALT") || "notesapp"}`).digest("hex").slice(0, 24);
