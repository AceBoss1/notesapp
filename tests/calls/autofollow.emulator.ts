// Calls with an auto-followed account (a founder) against the Firestore emulator: every member follows those accounts, so a missing
// follow record (members who joined outside the sign-up form's follow step) doesn't block a call. Run: npm run test:calls-server.
import assert from "node:assert/strict";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { startCall, type CallDeps } from "../../lib/calls-server";
import { MANDATORY_USERNAMES } from "../../lib/journals-directory";

if (!getApps().length) initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const deps = { push: async () => 1, bell: async () => {} } as unknown as CallDeps;
const fails = async (p: Promise<unknown>, re: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof Error && re.test(e.message)); };

(async () => {
  const founder = MANDATORY_USERNAMES.find((u) => u !== "notesapp")!;
  await db.doc("users/af_founder").set({ username: founder, displayName: "Founder" });
  await db.doc("users/af_cofounder").set({ username: "af_cofounder", displayName: "Co-founder" });
  await db.doc("users/af_stranger").set({ username: "af_stranger", displayName: "Stranger" });
  // The founder follows the co-founder; the co-founder's auto-follow of the founder was never written.
  await db.doc("follows/af_founder_af_cofounder").set({ followerUid: "af_founder", username: "af_cofounder", followedAt: new Date().toISOString(), mandatory: false });

  assert.ok((await startCall(db, "af_cofounder", "af_founder", "audio", new Date(), deps)).id, "co-founder can call the founder");
  assert.ok((await startCall(db, "af_founder", "af_cofounder", "video", new Date(), deps)).id, "founder can call the co-founder");
  // Without the founder's own follow, it's still refused: auto-follow covers one direction only.
  await fails(startCall(db, "af_founder", "af_stranger", "audio", new Date(), deps), /follow each other/);
  await fails(startCall(db, "af_cofounder", "af_stranger", "audio", new Date(), deps), /follow each other/);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
