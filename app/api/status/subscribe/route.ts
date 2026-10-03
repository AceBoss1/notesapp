import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { addSubscriber, removeSubscriber } from "@/lib/status-incidents";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "status-subscribe", clientIp(req), 5, 600);
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL.test(email) || email.length > 200) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  await addSubscriber(email);
  return NextResponse.json({ ok: true });
}

// One-click unsubscribe link from the incident emails.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const t = req.nextUrl.searchParams.get("t") || "";
  const ok = /^[a-f0-9]{24}$/.test(id) && (await removeSubscriber(id, t));
  const msg = ok ? "You're unsubscribed from #NotesApp status updates." : "That unsubscribe link isn't valid or was already used.";
  return new NextResponse(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:3rem 1.5rem;text-align:center"><p>${msg}</p><p><a href="/status">Back to status</a></p>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
