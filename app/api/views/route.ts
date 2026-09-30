import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Records one visit into a per-day bucket (pageViews/{kind}_{id}_{yyyymmdd})
// so /api/trending can rank by a recent window instead of all-time.
// Best-effort de-duplication: one count per visitor IP per page per
// 30 minutes (in-memory, so per server instance), known bots ignored.
// It's a popularity signal, not audited analytics.
export async function POST(req: NextRequest) {
  try {
    if (/bot|crawl|spider|preview|facebookexternalhit|slurp|headless/i.test(req.headers.get("user-agent") || "")) {
      return NextResponse.json({ ok: true, counted: false });
    }
    const { kind, id } = await req.json();
    if ((kind !== "note" && kind !== "profile") || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }
    if (rateLimit(req, "view-ip", clientIp(req), 120, 600)) return NextResponse.json({ ok: true, counted: false });
    if (rateLimit(req, "view-page", `${clientIp(req)}:${kind}:${id}`, 1, 1800)) {
      return NextResponse.json({ ok: true, counted: false });
    }

    const db = getAdminDb();
    // Only count pages that exist (and published notes), so junk ids can't create docs.
    if (kind === "note") {
      const n = await db.doc(`notes/${id}`).get();
      if (!n.exists || n.data()?.status !== "published") return NextResponse.json({ ok: true, counted: false });
    } else if (!(await db.doc(`usernames/${id}`).get()).exists) {
      return NextResponse.json({ ok: true, counted: false });
    }

    const day = new Date().toISOString().slice(0, 10);
    await db
      .doc(`pageViews/${kind}_${id}_${day.replace(/-/g, "")}`)
      .set({ kind, id, day, count: FieldValue.increment(1) }, { merge: true });
    return NextResponse.json({ ok: true, counted: true });
  } catch (err) {
    console.error("view tracking failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
