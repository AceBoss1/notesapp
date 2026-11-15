import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { FEED_TOKEN_RE, tokenFromPath } from "@/lib/my-calendar";
import { feedFor, hashToken } from "@/lib/my-calendar-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A member's private calendar feed (webcal://…/api/calendar/<token>.ics), which iPhone, Google and Outlook calendars subscribe to and
// refresh themselves (lib/my-calendar-server.ts feedFor): titles and times only, the kinds she chose. The token is found by its SHA-256;
// an unknown or replaced one gets 404. Calendar apps check about hourly, so a token is allowed 30 reads an hour and an address 300.
const notFound = () => new NextResponse("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = tokenFromPath(params.token);
  const byIp = await rateLimit(req, "calendar-feed-ip", clientIp(req), 300, 3600);
  if (byIp) return byIp;
  if (!FEED_TOKEN_RE.test(token)) return notFound();
  const byToken = await rateLimit(req, "calendar-feed", hashToken(token).slice(0, 32), 30, 3600);
  if (byToken) return byToken;
  try {
    const ics = await feedFor(getAdminDb(), token);
    if (ics === null) return notFound();
    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="notesapp.ics"',
        "Cache-Control": "private, max-age=900",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    console.error("calendar feed failed", err);
    return new NextResponse("Try again later\n", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "600" } });
  }
}
