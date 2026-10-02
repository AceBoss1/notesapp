import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getUserEmail } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { summarizeDojahEvent, verifyDojahSignature } from "@/lib/dojah";

export const dynamic = "force-dynamic";
const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng";

// Dojah → us: the result of a hosted identity check (kyc_widget). We verify the signature on
// the RAW body, find the application from reference_id (we launch the widget with `na_<uid>`),
// and record only a pass/fail summary on badgeRequests/{uid}.dojah for the admin to see.
// By default nothing is approved automatically ("Completed" only means the session finished);
// set DOJAH_AUTO_APPROVE=true to approve applications whose every step passed.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyDojahSignature(raw, req.headers.get("x-dojah-signature"), process.env.DOJAH_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  try {
    const event = JSON.parse(raw);
    const ref = String(event?.reference_id ?? "");
    const m = ref.match(/^na_([A-Za-z0-9]{10,64})$/);
    if (!m) return NextResponse.json({ ok: true, ignored: "unknown reference" }); // acknowledge so Dojah doesn't retry
    const uid = m[1];
    const db = getAdminDb();
    const reqRef = db.doc(`badgeRequests/${uid}`);
    const request = (await reqRef.get()).data();
    if (!request || request.kind !== "identity") return NextResponse.json({ ok: true, ignored: "no identity application" });

    const s = summarizeDojahEvent(event);
    // Don't let a late "Ongoing" event overwrite a terminal result we already have.
    if (request.dojah?.terminal && !s.terminal) return NextResponse.json({ ok: true });
    await reqRef.update({ dojah: s });

    // Opt-in automatic approval: only for an application that is waiting for review.
    if (s.passed && request.status === "pending" && process.env.DOJAH_AUTO_APPROVE === "true") {
      await reqRef.update({ status: "approved", resolvedAt: new Date().toISOString(), resolvedByUid: "dojah" });
      const to = await getUserEmail(uid);
      if (to) await sendEmail({ to, subject: "Your identity check passed", text: `Your identity check with our verification partner passed and your gold badge application is approved. Subscribe to switch the badge on: ${site()}/badges\n\n#NotesApp` }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Dojah webhook failed:", err);
    // A real processing error: let Dojah retry.
    return NextResponse.json({ error: "Couldn't process the event." }, { status: 500 });
  }
}
