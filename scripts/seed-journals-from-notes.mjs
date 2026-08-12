/**
 * scripts/seed-journals-from-notes.mjs
 *
 * One-time migration: copies every note from Precheks' `notes`
 * collection — comments and likes included — into this project's
 * `journals` collection, in the shape lib/firestore-journals.ts
 * expects. Same Firebase project as Precheks (see .env.local), a
 * different top-level collection, so nothing on the Precheks side is
 * touched or renamed.
 *
 * Why Admin SDK, not the client SDK already used elsewhere in this
 * app: migrated comments keep their *original* authorUid, and
 * firestore.rules' comment-create rule requires
 * `request.resource.data.authorUid == request.auth.uid` — an admin
 * signed in through the client SDK can't write a comment "as" someone
 * else. The Admin SDK bypasses security rules entirely, which is
 * exactly what a server-side migration is for.
 *
 * Setup (one time):
 *   1. Firebase Console → Project settings → Service accounts →
 *      "Generate new private key". Save the JSON file somewhere NOT
 *      inside this repo, e.g. ~/secrets/precheks-cms-service-account.json
 *   2. npm install firebase-admin --save-dev   (not yet in package.json)
 *
 * Run:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/secrets/precheks-cms-service-account.json \
 *     node scripts/seed-journals-from-notes.mjs
 *
 * Flags:
 *   --dry-run   Log what would be written, write nothing.
 *   --force     Overwrite a journal doc even if that ID already exists
 *               in `journals` (default: skip existing, so the script
 *               is safe to re-run after adding new notes).
 */

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

// Map a note's free-text `author` name to the #NotesApp username it
// should be filed under. Add a row here if a third author ever
// publishes on Precheks before this script is re-run.
const AUTHOR_TO_USERNAME = {
  "Chimdinma Onwuegbu": "chimdinma",
  "Emmanuel Adams": "emmanuel",
};

function resolveUsername(authorName) {
  return AUTHOR_TO_USERNAME[authorName] || "chimdinma"; // safe default: it's her practice
}

function initAdmin() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    // Falls back to gcloud application-default credentials if you've
    // already run `gcloud auth application-default login`.
    initializeApp({ credential: applicationDefault() });
  }
}

async function migrateOneNote(db, noteDoc) {
  const note = noteDoc.data();
  const journalId = noteDoc.id; // keep the same ID across both collections

  const journalRef = db.collection("journals").doc(journalId);
  const existing = await journalRef.get();
  if (existing.exists && !FORCE) {
    console.log(`  skip (already migrated): ${note.slug}`);
    return;
  }

  const commentsSnap = await noteDoc.ref.collection("comments").get();
  const likesSnap = await noteDoc.ref.collection("likes").get();

  const journalDoc = {
    slug: note.slug,
    title: note.title,
    date: note.date,
    visibility: "public", // every migrated note was already public
    featured_image: note.featured_image || "",
    content: note.content,
    author: note.author,
    authorUsername: resolveUsername(note.author),
    status: note.status === "published" ? "published" : "draft",
    bookable: false, // admin can flip this on per-entry from /admin/journals
    viewCount: note.viewCount || 0,
    likeCount: note.likeCount || 0,
    shareCount: note.shareCount || 0,
    commentCount: commentsSnap.size,
    migratedFrom: `notes/${journalId}`,
    migratedAt: new Date().toISOString(),
  };

  console.log(
    `  ${DRY_RUN ? "[dry-run] would write" : "writing"} journals/${journalId} — "${note.title}" (${commentsSnap.size} comments, ${likesSnap.size} likes)`
  );

  if (DRY_RUN) return;

  const batch = db.batch();
  batch.set(journalRef, journalDoc);

  commentsSnap.forEach((c) => {
    batch.set(journalRef.collection("comments").doc(c.id), c.data());
  });
  likesSnap.forEach((l) => {
    batch.set(journalRef.collection("likes").doc(l.id), l.data());
  });

  // Nested commentLikes, one level deeper — Firestore batches don't
  // recurse, so these are fetched and copied per-comment.
  for (const c of commentsSnap.docs) {
    const commentLikesSnap = await c.ref.collection("commentLikes").get();
    commentLikesSnap.forEach((cl) => {
      batch.set(
        journalRef
          .collection("comments")
          .doc(c.id)
          .collection("commentLikes")
          .doc(cl.id),
        cl.data()
      );
    });
  }

  await batch.commit();
}

async function main() {
  initAdmin();
  const db = getFirestore();

  console.log(
    `#NotesApp seed: notes → journals ${DRY_RUN ? "(DRY RUN, nothing will be written)" : ""}`
  );

  const notesSnap = await db.collection("notes").get();
  console.log(`Found ${notesSnap.size} note(s) in Precheks' /notes collection.\n`);

  for (const noteDoc of notesSnap.docs) {
    await migrateOneNote(db, noteDoc);
  }

  console.log("\nDone.");
  if (DRY_RUN) console.log("Re-run without --dry-run to actually write.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
