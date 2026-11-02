import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { stopReminders } from "@/lib/books-server";

// A customer's statement link (/statement/<code>, no sign-in): POST { code, off } stops (or restarts) reminders about what they owe.
// The seller hears about it in the bell (lib/books-server.ts stopReminders).
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "books-statement", clientIp(req), 20, 3600);
  if (limited) return limited;
  const b = await req.json().catch(() => ({}));
  const ok = await stopReminders(getAdminDb(), String(b.code ?? "").toUpperCase(), b.off !== false).catch(() => false);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "That link isn't working." }, { status: 404 });
}
