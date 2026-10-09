// Grants (or with --revoke, removes) the `admin` custom claim. A bare `admin` claim is a super admin (see lib/admin-access.ts); use this to
// bootstrap the first one, then manage everyone else from Admin → Team access.
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json one line>' \
//     node scripts/set-admin-claims.mjs ezurukam@gmail.com precheks.info@gmail.com
// (or GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json)
// Users must sign out and back in afterwards to pick up the claim.
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const revoke = process.argv.includes("--revoke");
const emails = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!emails.length) {
  console.error("Usage: node scripts/set-admin-claims.mjs [--revoke] <email> [<email>...]");
  process.exit(1);
}
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
const auth = getAuth();
for (const email of emails) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: !revoke });
    console.log(`${revoke ? "Revoked" : "Granted"} admin: ${email} (${user.uid})`);
  } catch (e) {
    console.error(`FAILED ${email}: ${e.message}`);
    process.exitCode = 1;
  }
}
