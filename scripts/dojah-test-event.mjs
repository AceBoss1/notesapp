// Sends a SIGNED fake Dojah kyc_widget event to our webhook, so you can check the whole pipeline
// (signature check → application updated → result shown in /admin/users) without running a real check.
//   DOJAH_WEBHOOK_SECRET=<the subscription's secret> \
//     node scripts/dojah-test-event.mjs <member uid> [pass|fail|abandoned] [https://www.notesapp.name.ng/api/dojah/webhook]
// The member must have an identity-check gold application whose deposit is paid (status "pending").
// Never use real ID data here: the sample carries only step names and booleans.
import { createHmac } from "node:crypto";

const [uid, outcome = "pass", url = "https://www.notesapp.name.ng/api/dojah/webhook"] = process.argv.slice(2);
const secret = process.env.DOJAH_WEBHOOK_SECRET;
if (!uid || !secret) {
  console.error("Usage: DOJAH_WEBHOOK_SECRET=… node scripts/dojah-test-event.mjs <uid> [pass|fail|abandoned] [url]");
  process.exit(1);
}
const events = {
  pass: { verification_status: "Completed", status: true, data: { user_data: { status: true }, government_data: { status: true }, selfie: { status: true } } },
  fail: { verification_status: "Completed", status: false, data: { user_data: { status: true }, government_data: { status: false }, selfie: { status: false } } },
  abandoned: { verification_status: "Abandoned" },
};
if (!events[outcome]) {
  console.error("Outcome must be pass, fail or abandoned.");
  process.exit(1);
}
const body = JSON.stringify({ reference_id: `na_${uid}`, ...events[outcome], metadata: { test: true } });
const signature = createHmac("sha256", secret).update(body).digest("hex");
const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-dojah-signature": signature }, body });
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
