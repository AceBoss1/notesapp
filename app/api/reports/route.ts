import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { createReport } from "@/lib/reports-server";
import { authed, fail } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// POST { kind: "moment" | "conversation", targetId, reason, note? }
export async function POST(req: NextRequest) {
  try {
    const me = await authed(req, "messages", true);
    const limited = rateLimit(req, "report", me.uid, 10, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    await createReport(getAdminDb(), me.uid, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't send the report");
  }
}
