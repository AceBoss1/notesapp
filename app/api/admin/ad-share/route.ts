import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { getTierConfig } from "@/lib/tiers";
import { AD_SHARE_HOLD_DAYS, AD_SHARE_MIN_KOBO, AdRevenueEntry, AdShareStatement, adFlags, isMonth } from "@/lib/ad-share";

export const dynamic = "force-dynamic";

const dayRange = (m: string) => ({ first: `${m.replace("-", "")}01`, last: `${m.replace("-", "")}31` });
const SOURCES = ["notesapp", "google", "meta", "admob"];

// Admin-only ad-share + ad revenue accounting. GET ?month=YYYY-MM returns the
// month's revenue entries, impression totals and statements.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const month = req.nextUrl.searchParams.get("month");
    if (!isMonth(month)) return NextResponse.json({ error: "Invalid month." }, { status: 400 });
    const db = getAdminDb();
    const { first, last } = dayRange(month);
    const [rev, stats, st] = await Promise.all([
      db.collection("adRevenue").where("month", "==", month).get(),
      db.collection("adStats").where("day", ">=", first).where("day", "<=", last).get(),
      db.collection("adShareStatements").where("month", "==", month).get(),
    ]);
    const entries = rev.docs.map((d) => ({ ...(d.data() as AdRevenueEntry), id: d.id })).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const totalImpressions = stats.docs.reduce((n, d) => n + (Number(d.data().impressions) || 0), 0);
    const revenueKobo = entries.reduce((n, e) => n + e.amountKobo, 0);
    const statements = st.docs.map((d) => d.data() as AdShareStatement).sort((a, b) => b.shareKobo - a.shareKobo);
    return NextResponse.json({ entries, totalImpressions, revenueKobo, rpmKobo: totalImpressions ? revenueKobo / totalImpressions : 0, statements });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load ad share");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUid = await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    const now = new Date().toISOString();

    // ------------------------------------------------------ revenue entries
    if (body.action === "add_revenue") {
      const amountKobo = Math.round(Number(body.amountNaira) * 100);
      if (!isMonth(body.month) || !SOURCES.includes(body.source) || !(amountKobo > 0) || amountKobo > 100_000_000_00) {
        return NextResponse.json({ error: "Check the month, source and amount." }, { status: 400 });
      }
      const label = String(body.label || "").trim().slice(0, 120);
      if (!label) return NextResponse.json({ error: "Add a label (advertiser or network)." }, { status: 400 });
      await db.collection("adRevenue").add({ month: body.month, source: body.source, label, amountKobo, note: String(body.note || "").slice(0, 300), createdAt: now, createdBy: adminUid });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete_revenue") {
      const ref = db.doc(`adRevenue/${String(body.id)}`);
      const e = (await ref.get()).data();
      if (!e) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const locked = await db.collection("adShareStatements").where("month", "==", e.month).where("status", "in", ["approved", "paid", "rolled_over", "rolled_forward"]).limit(1).get();
      if (!locked.empty) return NextResponse.json({ error: "This month already has decided statements — revenue can't be removed." }, { status: 409 });
      await ref.delete();
      return NextResponse.json({ ok: true });
    }

    // ---------------------------------------------------- compute statements
    if (body.action === "compute") {
      if (!isMonth(body.month)) return NextResponse.json({ error: "Invalid month." }, { status: 400 });
      const month: string = body.month;
      const { first, last } = dayRange(month);
      const [rev, stats, pubStats] = await Promise.all([
        db.collection("adRevenue").where("month", "==", month).get(),
        db.collection("adStats").where("day", ">=", first).where("day", "<=", last).get(),
        db.collection("adPublisherStats").where("day", ">=", first).where("day", "<=", last).get(),
      ]);
      const revenueKobo = rev.docs.reduce((n, d) => n + (Number(d.data().amountKobo) || 0), 0);
      const totalImpressions = stats.docs.reduce((n, d) => n + (Number(d.data().impressions) || 0), 0);
      if (revenueKobo <= 0) return NextResponse.json({ error: "Record the month's ad revenue first." }, { status: 409 });
      if (totalImpressions <= 0) return NextResponse.json({ error: "No ad impressions were counted in that month." }, { status: 409 });
      const rpmKobo = revenueKobo / totalImpressions;

      const byPub = new Map<string, { impressions: number; clicks: number; days: Set<string> }>();
      for (const d of pubStats.docs) {
        const x = d.data();
        const t = byPub.get(x.publisherUid) ?? { impressions: 0, clicks: 0, days: new Set<string>() };
        t.impressions += Number(x.impressions) || 0;
        t.clicks += Number(x.clicks) || 0;
        if (Number(x.impressions) > 0) t.days.add(x.day);
        byPub.set(x.publisherUid, t);
      }

      let created = 0;
      for (const [uid, t] of byPub) {
        const u = (await db.doc(`users/${uid}`).get()).data();
        if (!u || u.suspended) continue;
        const rate = getTierConfig(u.accountTier).adRevenueShare ?? 0;
        if (!(rate > 0) || u.adsOptIn !== true) continue; // free journals carry ads but earn no share
        const id = `${month}_${uid}`;
        const ref = db.doc(`adShareStatements/${id}`);
        const existing = (await ref.get()).data();
        if (existing && existing.status !== "pending_review") continue; // decided statements are locked
        const grossKobo = Math.floor(t.impressions * rpmKobo);
        const statement: AdShareStatement = {
          id, uid, username: u.username, month,
          impressions: t.impressions, clicks: t.clicks, rpmKobo, grossKobo, rate,
          shareKobo: Math.floor(grossKobo * rate),
          flags: adFlags(t.impressions, t.clicks, t.days.size),
          status: "pending_review",
          createdAt: existing?.createdAt ?? now,
        };
        await ref.set(statement);
        created++;
      }
      return NextResponse.json({ ok: true, statements: created, rpmKobo });
    }

    // ------------------------------------------------------------- decisions
    if (body.action === "approve" || body.action === "withhold" || body.action === "approve_unflagged") {
      const ids: string[] =
        body.action === "approve_unflagged"
          ? (await db.collection("adShareStatements").where("month", "==", String(body.month)).where("status", "==", "pending_review").get()).docs
              .filter((d) => !(d.data().flags || []).length)
              .map((d) => d.id)
          : [String(body.id)];
      let done = 0;
      for (const id of ids) {
        const ref = db.doc(`adShareStatements/${id}`);
        const s = (await ref.get()).data() as AdShareStatement | undefined;
        if (!s || s.status !== "pending_review") continue;
        if (body.action === "withhold") {
          await ref.update({ status: "withheld", decidedAt: now, note: String(body.note || "").slice(0, 300) });
          done++;
          continue;
        }
        // Approve: roll in any earlier below-minimum amount (at most one per publisher).
        const carryDocs = (await db.collection("adShareStatements").where("uid", "==", s.uid).where("status", "==", "rolled_over").get()).docs.filter((d) => d.id !== id);
        const carry = carryDocs.reduce((n, d) => n + (Number(d.data().payableKobo) || 0), 0);
        const payable = s.shareKobo + carry;
        const batch = db.batch();
        carryDocs.forEach((d) => batch.update(d.ref, { status: "rolled_forward" }));
        if (payable < AD_SHARE_MIN_KOBO) {
          batch.update(ref, { status: "rolled_over", payableKobo: payable, decidedAt: now });
        } else {
          batch.update(ref, { status: "approved", payableKobo: payable, decidedAt: now });
          batch.set(db.doc(`ledger/adshare_${id}`), {
            reference: `adshare_${id}`,
            kind: "adshare",
            publisherUid: s.uid,
            publisherUsername: s.username,
            payerUid: "platform",
            grossKobo: payable,
            commissionKobo: 0, // the share is already net of the plan's rate
            netKobo: payable,
            status: "held",
            releaseAfter: new Date(Date.now() + AD_SHARE_HOLD_DAYS * 86_400_000).toISOString(),
            createdAt: now,
          });
        }
        await batch.commit();
        done++;
      }
      return NextResponse.json({ ok: true, done });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("Ad share action failed:", err);
    const f = friendlyMessage(err, "Couldn't update ad share");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
