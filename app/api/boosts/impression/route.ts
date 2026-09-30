import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Validated impression / click for a boost. The browser only calls this
// after the card has been on screen ~1 s. Server-side validation:
//   • known bots ignored; the boost's own publisher never counts
//   • one impression (and one click) per visitor per boost per day —
//     visitor = hash(IP + user-agent), stored as a short-lived seen-doc
//   • a per-day delivery cap (maxPerDay) so a package spreads over days
//   • counting stops when purchased impressions are used up or the
//     window ends
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (!ua || /bot|crawl|spider|preview|facebookexternalhit|slurp|headless/i.test(ua)) {
      return NextResponse.json({ counted: false });
    }
    const ip = clientIp(req);
    if (rateLimit(req, "boost-imp", ip, 120, 600)) return NextResponse.json({ counted: false });

    const { boostId, type } = await req.json();
    if (typeof boostId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(boostId) || (type !== "impression" && type !== "click")) {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }

    const db = getAdminDb();
    const boostRef = db.doc(`boosts/${boostId}`);
    const today = new Date().toISOString().slice(0, 10);
    const visitor = createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 32);
    const seenRef = boostRef.collection("seen").doc(`${type}_${today}_${visitor}`);

    // Signed-in publisher viewing their own boost shouldn't count.
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const viewerUid = token ? await getAuth(getAdminApp()).verifyIdToken(token).then((d) => d.uid).catch(() => null) : null;

    const counted = await db.runTransaction(async (t) => {
      const [boostSnap, seen] = await Promise.all([t.get(boostRef), t.get(seenRef)]);
      const b = boostSnap.data();
      if (!b || b.status !== "active" || seen.exists) return false;
      if (viewerUid && viewerUid === b.publisherUid) return false;
      if (new Date(b.endsAt).getTime() <= Date.now()) return false;
      if (type === "impression") {
        if (b.impressionsDelivered >= b.impressionsPurchased) return false;
        if ((b.daily?.[today] || 0) >= b.maxPerDay) return false;
        const done = b.impressionsDelivered + 1 >= b.impressionsPurchased;
        t.update(boostRef, {
          impressionsDelivered: FieldValue.increment(1),
          [`daily.${today}`]: FieldValue.increment(1),
          ...(done ? { status: "completed", completedAt: new Date().toISOString() } : {}),
        });
      } else {
        t.update(boostRef, { clicks: FieldValue.increment(1) });
      }
      t.set(seenRef, { at: new Date().toISOString(), expireAt: new Date(Date.now() + 3 * 86_400_000) }); // set a Firestore TTL policy on `expireAt`
      return true;
    });
    return NextResponse.json({ counted });
  } catch (err) {
    console.error("boost impression failed:", err);
    return NextResponse.json({ counted: false }, { status: 500 });
  }
}
