/**
 * scripts/migrate-to-own-infra.mjs
 *
 * One-time migration off shared infrastructure:
 *   SOURCE = precheks-cms (Firestore + Cloudinary), the project
 *            NotesApp used to share with Precheks.
 *   DEST   = NotesApp's own, independent Firebase project + R2 bucket.
 *
 * What it moves, and why:
 *   - notes (+ comments, + commentLikes, + likes subcollections) —
 *     "journals," the actual content. Every note's featured_image is
 *     checked: if it's a Cloudinary URL, the image is downloaded and
 *     re-uploaded to R2, and the note is written to the destination
 *     with the NEW url. If it's already something else (a local
 *     /images/ path, already-R2, etc.), left untouched.
 *   - users, follows, subscriptions, leads, notifications — these
 *     were never Precheks' data to begin with (they're NotesApp-only
 *     collections that happened to live in the shared project) — left
 *     behind, they'd just be orphaned. Migrated as-is, no image
 *     rewriting needed for these today (avatars are static /images/
 *     paths in this app, not Cloudinary uploads).
 *
 * What it deliberately does NOT touch: Precheks' own /notes documents
 * remain in the SOURCE project, untouched — this only ever reads from
 * source, never writes or deletes there.
 *
 * Setup (one time):
 *   1. Service account key for the SOURCE (precheks-cms) project —
 *      you should already have this from earlier migration work this
 *      session.
 *   2. Service account key for the DEST (NotesApp's new) project —
 *      Firebase Console → new project → Project settings → Service
 *      accounts → Generate new private key.
 *   3. R2 credentials for the NEW bucket (same ones in .env.local).
 *   4. npm install (picks up firebase-admin + @aws-sdk/client-s3,
 *      already in package.json).
 *
 * Run:
 *   SOURCE_SERVICE_ACCOUNT=/path/to/source-key.json \
 *   DEST_SERVICE_ACCOUNT=/path/to/dest-key.json \
 *   R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx \
 *   R2_BUCKET_NAME=notesapp-media \
 *     node scripts/migrate-to-own-infra.mjs
 *
 * Flags:
 *   --dry-run    Log what would happen, write and upload nothing.
 *   --skip-media Copy Firestore data but leave Cloudinary URLs as-is
 *                (useful for a fast structural test run first).
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_MEDIA = process.argv.includes("--skip-media");

function loadServiceAccount(envVar) {
  const path = process.env[envVar];
  if (!path) throw new Error(`${envVar} is not set`);
  return JSON.parse(readFileSync(path, "utf8"));
}

const sourceApp = initializeApp(
  { credential: cert(loadServiceAccount("SOURCE_SERVICE_ACCOUNT")) },
  "source"
);
const destApp = initializeApp(
  { credential: cert(loadServiceAccount("DEST_SERVICE_ACCOUNT")) },
  "dest"
);
const sourceDb = getFirestore(sourceApp);
const destDb = getFirestore(destApp);

const r2 = SKIP_MEDIA
  ? null
  : new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
const R2_BUCKET = process.env.R2_BUCKET_NAME || "notesapp-media";
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

// Downloads a Cloudinary-hosted image and re-uploads it to R2,
// returning the new public URL. Any URL that isn't recognizably
// Cloudinary is returned unchanged — nothing to migrate.
async function migrateImageUrl(url) {
  if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) return url;
  if (SKIP_MEDIA) return url;
  if (!R2_PUBLIC_URL) throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL is not set");

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ⚠ couldn't download ${url} (${res.status}) — leaving URL as-is`);
    return url;
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
  const key = `journals/migrated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  if (DRY_RUN) {
    console.log(`  [dry-run] would upload ${url} → ${key} (${buffer.length} bytes)`);
    return `${R2_PUBLIC_URL}/${key}`;
  }

  await r2.send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType })
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

async function migrateNotes() {
  const snap = await sourceDb.collection("notes").get();
  console.log(`\nFound ${snap.size} note(s).`);

  for (const noteDoc of snap.docs) {
    const note = noteDoc.data();
    console.log(`- ${note.slug || noteDoc.id}`);

    const newImageUrl = await migrateImageUrl(note.featured_image);
    const newAuthorAvatar = await migrateImageUrl(note.author_avatar);

    const migratedNote = { ...note, featured_image: newImageUrl, author_avatar: newAuthorAvatar };

    if (!DRY_RUN) {
      await destDb.collection("notes").doc(noteDoc.id).set(migratedNote);
    }

    // Subcollections — comments (+ nested commentLikes) and likes.
    const commentsSnap = await noteDoc.ref.collection("comments").get();
    for (const c of commentsSnap.docs) {
      if (!DRY_RUN) {
        await destDb
          .collection("notes")
          .doc(noteDoc.id)
          .collection("comments")
          .doc(c.id)
          .set(c.data());
      }
      const likesSnap = await c.ref.collection("commentLikes").get();
      for (const cl of likesSnap.docs) {
        if (!DRY_RUN) {
          await destDb
            .collection("notes")
            .doc(noteDoc.id)
            .collection("comments")
            .doc(c.id)
            .collection("commentLikes")
            .doc(cl.id)
            .set(cl.data());
        }
      }
    }
    console.log(`  → ${commentsSnap.size} comment(s) migrated`);

    const likesSnap = await noteDoc.ref.collection("likes").get();
    for (const l of likesSnap.docs) {
      if (!DRY_RUN) {
        await destDb.collection("notes").doc(noteDoc.id).collection("likes").doc(l.id).set(l.data());
      }
    }
    console.log(`  → ${likesSnap.size} like(s) migrated`);
  }
}

// Plain top-level collections, no subcollections, no image rewriting
// needed — copied as-is, same doc IDs.
async function migrateFlatCollection(name) {
  const snap = await sourceDb.collection(name).get();
  console.log(`\nFound ${snap.size} doc(s) in /${name}.`);
  if (DRY_RUN) return;
  const batchSize = 400; // Firestore batch limit is 500
  let batch = destDb.batch();
  let count = 0;
  for (const d of snap.docs) {
    batch.set(destDb.collection(name).doc(d.id), d.data());
    count++;
    if (count % batchSize === 0) {
      await batch.commit();
      batch = destDb.batch();
    }
  }
  if (count % batchSize !== 0) await batch.commit();
}

async function main() {
  console.log(`Migrating NotesApp → its own infrastructure ${DRY_RUN ? "(DRY RUN)" : ""}${SKIP_MEDIA ? " (skipping media)" : ""}`);

  await migrateNotes();
  for (const name of ["users", "follows", "subscriptions", "leads", "notifications"]) {
    await migrateFlatCollection(name);
  }

  console.log("\nDone.");
  if (DRY_RUN) console.log("Re-run without --dry-run to actually write and upload.");
  console.log(
    "\nNext step: update .env.local to point at the NEW Firebase project and R2 bucket, redeploy firestore.rules there, and verify a few journals load correctly before treating the old project as retired."
  );
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
