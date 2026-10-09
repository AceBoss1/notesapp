import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { refundTransaction } from "@/lib/paystack";
import { sendEmail } from "@/lib/email";
import { formatNaira } from "@/lib/booking-time";
import { deliveredByAd } from "@/lib/ads-server";
import type { AdCampaign } from "@/lib/ad-packages";

export const dynamic = "force-dynamic";

const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng";
const lagosMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }).slice(0, 7);

// Admin-only decisions on paid ad campaigns:
//   approve            — goes live (adCreatives) and the money is recorded as ad revenue
//   reject             — full refund, campaign closed
//   refund_undelivered — after it ends: refund the impressions never delivered
export async function POST(req: NextRequest) {
  try {
    const adminUid = await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["growth", "finance"]);
    const { action, id, reason } = await req.json();
    const db = getAdminDb();
    const ref = db.doc(`adCampaigns/${String(id)}`);
    const c = (await ref.get()).data() as AdCampaign | undefined;
    if (!c) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    const now = new Date().toISOString();

    if (action === "approve") {
      if (c.status !== "in_review") return NextResponse.json({ error: `This campaign is ${c.status}.` }, { status: 409 });
      const endsAt = new Date(Date.now() + c.windowDays * 86_400_000).toISOString();
      const batch = db.batch();
      batch.update(ref, { status: "live", approvedAt: now, endsAt });
      batch.set(db.doc(`adCreatives/${c.id}`), {
        title: c.creative.title, text: c.creative.text, image: c.creative.image, href: c.creative.href,
        placements: c.placements, weight: 5, active: true, provider: "notesapp",
        campaignId: c.id, impressionsBudget: c.impressionsBudget, endsAt, advertiser: c.advertiserName, createdAt: now,
      });
      // The money is ad revenue from the day the ad goes live (a rejection would have refunded it).
      batch.set(db.doc(`adRevenue/campaign_${c.id}`), {
        month: lagosMonth(), source: "notesapp", label: `Campaign: ${c.advertiserName}`, amountKobo: c.amountKobo,
        note: `${c.packageName} · ${c.id}`, campaignId: c.id, createdAt: now, createdBy: adminUid,
      });
      await batch.commit();
      await sendEmail({ to: c.email, bell: { uid: c.uid, type: "ad", linkHref: "/advertise/campaigns" }, subject: "Your #NotesApp ad is live", text: `Your ad "${c.creative.title}" was approved and is now running (up to ${c.impressionsBudget.toLocaleString()} impressions over ${c.windowDays} days). Track it at ${site()}/advertise/campaigns.\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    if (action === "reject") {
      if (c.status !== "in_review") return NextResponse.json({ error: `This campaign is ${c.status}.` }, { status: 409 });
      const why = String(reason || "").trim().slice(0, 300);
      if (!why) return NextResponse.json({ error: "Give a reason — it's sent to the advertiser." }, { status: 400 });
      await refundTransaction(c.id);
      const batch = db.batch();
      batch.update(ref, { status: "rejected", rejectedReason: why, refundedKobo: c.amountKobo });
      batch.update(db.doc(`payments/${c.id}`), { status: "refunded" });
      await batch.commit();
      await sendEmail({ to: c.email, bell: { uid: c.uid, type: "ad", linkHref: "/advertise/campaigns" }, subject: "Your #NotesApp ad wasn't approved", text: `We couldn't run "${c.creative.title}": ${why}\n\nYour ${formatNaira(c.amountKobo)} is being refunded in full. We've started the refund and Paystack handles the rest of the process; it can take several business days to reach your bank or card. You're welcome to submit a revised ad at ${site()}/advertise/new.\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    if (action === "refund_undelivered") {
      const ended = c.status === "completed" || (c.status === "live" && c.endsAt && new Date(c.endsAt).getTime() < Date.now());
      if (!ended) return NextResponse.json({ error: "The campaign is still running." }, { status: 409 });
      if (c.refundedKobo) return NextResponse.json({ error: "Already settled." }, { status: 409 });
      const delivered = (await deliveredByAd([c.id]))[c.id]?.impressions ?? 0;
      const shortfall = Math.max(0, c.impressionsBudget - delivered);
      const refundKobo = Math.floor((c.amountKobo * shortfall) / c.impressionsBudget);
      const batch = db.batch();
      if (refundKobo > 0) {
        await refundTransaction(c.id, refundKobo);
        // Keep the revenue books honest: a negative entry for the refunded part.
        batch.set(db.doc(`adRevenue/refund_${c.id}`), {
          month: lagosMonth(), source: "notesapp", label: `Refund (undelivered): ${c.advertiserName}`, amountKobo: -refundKobo,
          note: c.id, campaignId: c.id, createdAt: now, createdBy: adminUid,
        });
      }
      batch.update(ref, { status: "completed", refundedKobo: refundKobo, impressionsDelivered: delivered, completedAt: c.completedAt ?? now });
      batch.update(db.doc(`adCreatives/${c.id}`), { active: false });
      await batch.commit();
      if (refundKobo > 0) await sendEmail({ to: c.email, bell: { uid: c.uid, type: "ad", linkHref: "/advertise/campaigns" }, subject: "Refund for undelivered ad impressions", text: `Your campaign delivered ${delivered.toLocaleString()} of ${c.impressionsBudget.toLocaleString()} impressions, so ${formatNaira(refundKobo)} is being refunded. We've started the refund and Paystack handles the rest of the process; it can take several business days to reach your bank or card.\n\n#NotesApp` }).catch(() => {});
      return NextResponse.json({ ok: true, refundKobo });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("Ad campaign action failed:", err);
    const f = friendlyMessage(err, "Couldn't update the campaign");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
