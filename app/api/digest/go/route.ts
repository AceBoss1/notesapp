import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { lagosDay } from "@/lib/ads-server";
import { setting } from "@/lib/config";
import { SITE_URL } from "@/lib/host";

export const dynamic = "force-dynamic";

// A click on a sponsored slot in the weekly digest: ?b=<boostId> or ?a=<adId>. Counts the click (once per visitor per day,
// a visitor being a hash of IP and browser, as on the site; the email itself already counted as the impression) and sends
// the reader on to the boosted journal or item, or the advert's link. The destination is always looked up here, never
// taken from the address, so the link can't be used to send people anywhere else.
export async function GET(req: NextRequest) {
  const home = NextResponse.redirect(SITE_URL, 302);
  const b = req.nextUrl.searchParams.get("b"), a = req.nextUrl.searchParams.get("a");
  const id = b ?? a ?? "";
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return home;
  const ua = req.headers.get("user-agent") || "";
  const bot = !ua || /bot|crawl|spider|preview|facebookexternalhit|slurp|headless|proofpoint|mimecast|barracuda/i.test(ua);
  const limited = bot ? null : await rateLimit(req, "digest-go", clientIp(req), 60, 600);
  try {
    const db = getAdminDb();
    const visitor = createHash("sha256").update(`${clientIp(req)}|${ua}|${setting("AD_HASH_SALT") || "notesapp"}`).digest("hex").slice(0, 24);
    if (b) {
      const ref = db.doc(`boosts/${id}`);
      const x = (await ref.get()).data();
      if (!x) return home;
      const to = x.itemId ? `${SITE_URL}/shop/${x.itemId}` : `${SITE_URL}/journals/${x.slug}`;
      if (!bot && !limited) {
        const seen = ref.collection("seen").doc(`click_${new Date().toISOString().slice(0, 10)}_${visitor}`);
        await seen.create({ at: new Date().toISOString(), via: "digest", expireAt: new Date(Date.now() + 3 * 86_400_000) })
          .then(() => ref.update({ clicks: FieldValue.increment(1), digestClicks: FieldValue.increment(1) }))
          .catch(() => {}); // already counted today
      }
      return NextResponse.redirect(to, 302);
    }
    const ad = (await db.doc(`adCreatives/${id}`).get()).data();
    if (!ad || !/^https:\/\//i.test(String(ad.href ?? ""))) return home;
    if (!bot && !limited) {
      const day = lagosDay();
      await db.doc(`adSeen/${visitor}_${id}_click_${day}`).create({ at: new Date().toISOString(), via: "digest", expireAt: new Date(Date.now() + 2 * 86_400_000) })
        .then(() => db.doc(`adStats/${id}_${day}`).set({ adId: id, day, clicks: FieldValue.increment(1), byPlacement: { digest: { clicks: FieldValue.increment(1) } } }, { merge: true }))
        .catch(() => {});
    }
    return NextResponse.redirect(String(ad.href), 302);
  } catch {
    return home;
  }
}
