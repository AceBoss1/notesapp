// Registers #NotesApp's webhook with Dojah for hosted identity checks (kyc_widget).
//   DOJAH_SECRET_KEY=<secret key> DOJAH_APP_ID=<app id> \
//     [DOJAH_API_BASE=https://sandbox.dojah.io]   # sandbox keys use Dojah's sandbox host; default is production
//     node scripts/dojah-subscribe.mjs https://www.notesapp.name.ng/api/dojah/webhook
// Run it once per environment (sandbox, then production with your live keys). Never commit keys.
// Afterwards copy the subscription's webhook SECRET (Dojah dashboard → Developers → Webhooks, eye icon)
// into Vercel as DOJAH_WEBHOOK_SECRET and redeploy — the endpoint rejects events until it's set.
const url = process.argv[2];
const secret = process.env.DOJAH_SECRET_KEY;
const appId = process.env.DOJAH_APP_ID;
const base = (process.env.DOJAH_API_BASE || "https://api.dojah.io").replace(/\/$/, "");
if (!url || !/^https:\/\//.test(url) || !secret || !appId) {
  console.error("Usage: DOJAH_SECRET_KEY=… DOJAH_APP_ID=… node scripts/dojah-subscribe.mjs https://<your-site>/api/dojah/webhook");
  process.exit(1);
}
const res = await fetch(`${base}/api/v1/webhook/subscribe`, {
  method: "POST",
  headers: { Authorization: secret, AppId: appId, "Content-Type": "application/json" },
  body: JSON.stringify({ webhook: url, service: "kyc_widget" }),
});
const text = await res.text();
console.log(res.status, text);
process.exit(res.ok ? 0 : 1);
