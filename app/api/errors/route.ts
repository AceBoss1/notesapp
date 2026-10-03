import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

// Browser-side errors (a page crashed, an unhandled promise rejection). Public by necessity, so it is
// rate-limited per IP, ignores bots, caps every field and scrubs personal data before storing.
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (!ua || /bot|crawl|spider|preview|headless|lighthouse/i.test(ua)) return NextResponse.json({ ok: true });
    if (rateLimit(req, "client-error", clientIp(req), 20, 600)) return NextResponse.json({ ok: true });
    const text = await req.text();
    if (text.length > 6000) return NextResponse.json({ ok: true });
    const b = JSON.parse(text) as { message?: unknown; stack?: unknown; url?: unknown };
    if (typeof b.message !== "string" || !b.message.trim()) return NextResponse.json({ ok: true });
    let path = "";
    try {
      path = new URL(String(b.url || ""), "https://x.invalid").pathname;
    } catch {
      /* no usable url */
    }
    const err = new Error(String(b.message));
    err.stack = typeof b.stack === "string" ? b.stack : "";
    await reportError(err, { source: "client", route: path, url: path });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
