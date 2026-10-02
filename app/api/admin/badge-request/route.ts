import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, getUserEmail, verifyAdminRequest } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { cleanText } from "@/lib/orders";

export const dynamic = "force-dynamic";
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng";

// Admin decision on a gold-badge application. Approving lets the member subscribe; declining
// closes it. Either way the applicant gets a bell notification and an email.
export async function POST(req: NextRequest) {
  try {
    const adminUid = await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const { uid, approve, reason } = await req.json();
    const db = getAdminDb();
    const ref = db.doc(`badgeRequests/${String(uid)}`);
    const r = (await ref.get()).data();
    if (!r) return NextResponse.json({ error: "No application." }, { status: 404 });
    if (r.status !== "pending") return NextResponse.json({ error: `This application is already ${r.status}.` }, { status: 409 });
    const now = new Date().toISOString();
    const note = cleanText(reason, 300);
    await ref.update({ status: approve ? "approved" : "rejected", resolvedAt: now, resolvedByUid: adminUid, ...(note ? { decisionNote: note } : {}) });

    const identity = r.kind === "identity";
    const message = approve
      ? "Your gold badge application was approved — subscribe on the badges page to switch the badge on."
      : `Your gold badge application wasn't approved${note ? `: ${note}` : "."} You can read the details and apply again on the badges page.`;
    await db.collection("notifications").add({ recipientUid: String(uid), type: "badge", message, linkHref: "/badges", read: false, createdAt: now });
    const to = await getUserEmail(String(uid));
    if (to) {
      await sendEmail({
        to,
        subject: approve ? "Your gold badge application was approved" : "Your gold badge application wasn't approved",
        text: approve
          ? `Good news — your ${identity ? "identity-checked" : "endorsed"} gold badge application was approved. Subscribe to switch the badge on: ${site()}/badges\n\n#NotesApp`
          : `We couldn't approve your ${identity ? "identity-checked" : "endorsed"} gold badge application${note ? `: ${note}` : "."}${identity ? " (The identity-check deposit is non-refundable; applying again needs a new deposit.)" : ""} Details and reapplying: ${site()}/badges\n\n#NotesApp`,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't record the decision");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
