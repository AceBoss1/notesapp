// Clears up post videos nobody points at any more: files under `videos/` in the media bucket that no post references
// (a post was deleted, a video was removed from a post, or an upload was never attached). Files younger than 2 days
// are always kept so an upload that is still being attached to a draft isn't touched. Dry run by default.
//
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
//     node scripts/clean-orphan-videos.mjs [--apply]
// Reads R2_BUCKET_NAME (default notesapp-media). Run it now and then (monthly is plenty); safe to re-run.
import { pathToFileURL } from "node:url";

const MIN_AGE_MS = 2 * 86_400_000;

// Pure: which stored files are orphans? `objects` = [{ Key, LastModified }], `referenced` = Set of keys in use.
export function findOrphans(objects, referenced, now = Date.now()) {
  return objects.filter((o) => !referenced.has(o.Key) && now - new Date(o.LastModified).getTime() > MIN_AGE_MS);
}

async function main() {
  const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const apply = process.argv.includes("--apply");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
  const db = getFirestore();
  const bucket = process.env.R2_BUCKET_NAME || "notesapp-media";
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });

  const referenced = new Set();
  const notes = await db.collection("notes").where("videoKey", "!=", "").get().catch(() => ({ docs: [] }));
  for (const n of notes.docs) referenced.add(n.data().videoKey);
  // An upload that is verified but not yet on a post is still "in use" until it's old enough (the age rule above).

  const objects = [];
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "videos/", ContinuationToken: token }));
    objects.push(...(page.Contents || []));
    token = page.NextContinuationToken;
  } while (token);

  const orphans = findOrphans(objects, referenced);
  const mb = (n) => (n / 1048576).toFixed(1);
  console.log(`${objects.length} video file(s) in ${bucket}; ${referenced.size} used by posts; ${orphans.length} orphan(s), ${mb(orphans.reduce((s, o) => s + (o.Size || 0), 0))} MB.`);
  for (const o of orphans) {
    console.log(`  ${apply ? "DELETE" : "WOULD DELETE"} ${o.Key} (${mb(o.Size || 0)} MB, ${new Date(o.LastModified).toISOString().slice(0, 10)})`);
    if (apply) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: o.Key }));
      const id = o.Key.split("/").pop()?.replace(/\.[a-z0-9]+$/, "");
      if (id) await db.doc(`videoUploads/${id}`).delete().catch(() => {});
    }
  }
  console.log(apply ? "Done." : "Dry run — nothing deleted. Re-run with --apply.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
