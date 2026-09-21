/**
 * scripts/migrate-to-own-infra.mjs
 *
 * NotesApp → independent infrastructure migration
 *
 * SOURCE:
 *   Old shared Firebase / Firestore project
 *   (previously shared with Precheks)
 *
 * DESTINATION:
 *   NotesApp's own Firebase / Firestore project
 *   + Cloudflare R2 bucket
 *
 * IMPORTANT:
 *   - SOURCE IS READ-ONLY.
 *   - Nothing is deleted from the old project.
 *   - The migration can safely be rerun.
 *
 * WHAT THIS MIGRATES:
 *
 * Firestore:
 *   /notes
 *     ├── /comments
 *     │     └── /commentLikes
 *     └── /likes
 *
 *   /users
 *   /follows
 *   /subscriptions
 *   /leads
 *   /notifications
 *
 * MEDIA:
 *   Cloudinary URLs encountered in migrated data are downloaded
 *   and uploaded to R2.
 *
 *   Existing R2 URLs are left alone.
 *   Local /images/... URLs are left alone.
 *   Other URLs are left alone.
 *
 * FLAGS:
 *
 *   --dry-run
 *     Read source and report what would happen.
 *     Does not write Firestore or R2.
 *
 *   --skip-media
 *     Migrates Firestore only.
 *     Cloudinary URLs are left unchanged.
 *
 * REQUIRED ENVIRONMENT VARIABLES:
 *
 *   SOURCE_SERVICE_ACCOUNT
 *   DEST_SERVICE_ACCOUNT
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   NEXT_PUBLIC_R2_PUBLIC_URL
 *
 * Example:
 *
 *   export MSYS_NO_PATHCONV=1
 *
 *   export SOURCE_SERVICE_ACCOUNT="C:/Users/ezuru/Downloads/precheks-source.json"
 *   export DEST_SERVICE_ACCOUNT="C:/Users/ezuru/Downloads/notesapp-destination.json"
 *
 *   export R2_ACCOUNT_ID="YOUR_ACCOUNT_ID"
 *   export R2_ACCESS_KEY_ID="YOUR_ACCESS_KEY"
 *   export R2_SECRET_ACCESS_KEY="YOUR_SECRET_KEY"
 *   export R2_BUCKET_NAME="notesapp-media"
 *   export NEXT_PUBLIC_R2_PUBLIC_URL="https://media.notesapp.name.ng"
 *
 * Then:
 *
 *   node scripts/migrate-to-own-infra.mjs
 *
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { readFileSync } from "fs";
import crypto from "crypto";

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";


// ============================================================
// FLAGS
// ============================================================

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_MEDIA = process.argv.includes("--skip-media");


// ============================================================
// CONFIGURATION
// ============================================================

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Required environment variable ${name} is not set.`);
  }

  return value;
}


function loadServiceAccount(envVar) {
  const path = requireEnv(envVar);

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read ${envVar} from:\n${path}\n\n${error.message}`
    );
  }
}


// ============================================================
// FIREBASE
// ============================================================

const sourceApp = initializeApp(
  {
    credential: cert(
      loadServiceAccount("SOURCE_SERVICE_ACCOUNT")
    ),
  },
  "notesapp-migration-source"
);


const destinationApp = initializeApp(
  {
    credential: cert(
      loadServiceAccount("DEST_SERVICE_ACCOUNT")
    ),
  },
  "notesapp-migration-destination"
);


const sourceDb = getFirestore(sourceApp);
const destinationDb = getFirestore(destinationApp);


// ============================================================
// R2
// ============================================================

const R2_ACCOUNT_ID = requireEnv("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = requireEnv("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = requireEnv("R2_SECRET_ACCESS_KEY");

const R2_BUCKET_NAME =
  process.env.R2_BUCKET_NAME || "notesapp-media";

const R2_PUBLIC_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL;


const r2 = SKIP_MEDIA
  ? null
  : new S3Client({
      region: "auto",

      endpoint:
        `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,

      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });


// ============================================================
// STATISTICS
// ============================================================

const stats = {
  notes: 0,
  comments: 0,
  commentLikes: 0,
  likes: 0,

  users: 0,
  follows: 0,
  subscriptions: 0,
  leads: 0,
  notifications: 0,

  mediaFound: 0,
  mediaMigrated: 0,
  mediaReused: 0,
  mediaSkipped: 0,
  mediaFailures: 0,
};


// ============================================================
// HELPERS
// ============================================================

function isCloudinaryUrl(value) {
  return (
    typeof value === "string" &&
    value.includes("cloudinary.com")
  );
}


function isR2Url(value) {
  return (
    typeof value === "string" &&
    (
      value.includes(".r2.cloudflarestorage.com") ||
      (
        R2_PUBLIC_URL &&
        value.startsWith(R2_PUBLIC_URL)
      )
    )
  );
}


/**
 * Generate a deterministic filename from the original URL.
 *
 * This is important because the migration can be rerun.
 *
 * Instead of:
 *
 *   migrated-123456.png
 *   migrated-789123.png
 *
 * every time we run it, the same Cloudinary URL gets the same
 * R2 object.
 */
function makeStableR2Key(originalUrl, contentType) {
  const hash = crypto
    .createHash("sha256")
    .update(originalUrl)
    .digest("hex");

  let extension = "jpg";

  if (contentType) {
    const cleanType = contentType
      .split(";")[0]
      .trim()
      .toLowerCase();

    const extensionMap = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
      "image/avif": "avif",
      "image/bmp": "bmp",
      "image/tiff": "tiff",
    };

    extension =
      extensionMap[cleanType] ||
      cleanType.split("/")[1] ||
      "jpg";
  }

  return `migrated/${hash}.${extension}`;
}


/**
 * Check whether an R2 object already exists.
 *
 * This makes the migration idempotent.
 */
async function r2ObjectExists(key) {
  try {
    await r2.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    return true;
  } catch (error) {
    const status =
      error?.$metadata?.httpStatusCode;

    if (status === 404 || error?.name === "NotFound") {
      return false;
    }

    return false;
  }
}


// ============================================================
// CLOUDINARY → R2
// ============================================================

async function migrateImageUrl(url, location = "unknown") {
  if (!url || typeof url !== "string") {
    return url;
  }


  // Already R2.
  if (isR2Url(url)) {
    stats.mediaReused++;

    console.log(
      `  ↻ ${location}: already R2`
    );

    return url;
  }


  // Not Cloudinary.
  if (!isCloudinaryUrl(url)) {
    stats.mediaSkipped++;

    return url;
  }


  stats.mediaFound++;


  if (SKIP_MEDIA) {
    console.log(
      `  → ${location}: Cloudinary URL preserved (--skip-media)`
    );

    return url;
  }


  if (!R2_PUBLIC_URL) {
    throw new Error(
      "NEXT_PUBLIC_R2_PUBLIC_URL is not set."
    );
  }


  console.log(
    `  → ${location}: Cloudinary → R2`
  );


  // Download original image.
  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    stats.mediaFailures++;

    console.warn(
      `  ⚠ ${location}: failed to download Cloudinary image`
    );

    console.warn(
      `    ${error.message}`
    );

    return url;
  }


  if (!response.ok) {
    stats.mediaFailures++;

    console.warn(
      `  ⚠ ${location}: Cloudinary returned HTTP ${response.status}`
    );

    return url;
  }


  const contentType =
    response.headers.get("content-type") ||
    "image/jpeg";


  const buffer =
    Buffer.from(
      await response.arrayBuffer()
    );


  const key =
    makeStableR2Key(
      url,
      contentType
    );


  const newUrl =
    `${R2_PUBLIC_URL}/${key}`;


  // Dry run.
  if (DRY_RUN) {
    console.log(
      `  [dry-run] would upload ${buffer.length} bytes`
    );

    console.log(
      `  [dry-run] ${newUrl}`
    );

    return newUrl;
  }


  // See if this exact migrated object already exists.
  try {
    const exists =
      await r2ObjectExists(key);

    if (exists) {
      stats.mediaReused++;

      console.log(
        `  ✓ ${location}: R2 object already exists`
      );

      console.log(
        `    ${newUrl}`
      );

      return newUrl;
    }
  } catch {
    // If HEAD fails unexpectedly, continue and attempt upload.
  }


  // Upload to R2.
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    stats.mediaMigrated++;

    console.log(
      `  ✓ ${location}: uploaded to R2`
    );

    console.log(
      `    ${newUrl}`
    );

    return newUrl;
  } catch (error) {
    stats.mediaFailures++;

    console.warn(
      `  ✗ ${location}: R2 upload failed`
    );

    console.warn(
      `    ${error.name || "Error"}: ${error.message}`
    );

    // IMPORTANT:
    // Do not stop the entire migration because one image failed.
    // Leave the original Cloudinary URL intact.
    return url;
  }
}


// ============================================================
// DEEP MEDIA MIGRATION
// ============================================================

/**
 * Recursively walk through Firestore data.
 *
 * This catches Cloudinary URLs even when they are not stored
 * in the exact fields we expected.
 *
 * Example:
 *
 * {
 *   avatar: "...cloudinary...",
 *   profile: {
 *     photo: "...cloudinary..."
 *   }
 * }
 *
 * Both can be migrated.
 */
async function migrateMediaDeep(
  value,
  location = "data"
) {
  if (typeof value === "string") {
    return await migrateImageUrl(
      value,
      location
    );
  }


  if (Array.isArray(value)) {
    const result = [];

    for (let i = 0; i < value.length; i++) {
      result.push(
        await migrateMediaDeep(
          value[i],
          `${location}[${i}]`
        )
      );
    }

    return result;
  }


  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Date)
  ) {
    const result = {};

    for (const [key, childValue] of Object.entries(value)) {
      result[key] =
        await migrateMediaDeep(
          childValue,
          `${location}.${key}`
        );
    }

    return result;
  }


  return value;
}


// ============================================================
// MIGRATE NOTES
// ============================================================

async function migrateNotes() {
  const snapshot =
    await sourceDb
      .collection("notes")
      .get();


  console.log(
    `\nFound ${snapshot.size} note(s).`
  );


  for (
    let index = 0;
    index < snapshot.docs.length;
    index++
  ) {
    const noteDoc =
      snapshot.docs[index];

    const note =
      noteDoc.data();


    const label =
      note.slug ||
      note.title ||
      noteDoc.id;


    console.log(
      `\n[${index + 1}/${snapshot.size}] ${label}`
    );


    console.log(
      `  Document ID: ${noteDoc.id}`
    );


    // --------------------------------------------------------
    // Migrate ALL Cloudinary URLs inside the note.
    //
    // This includes:
    //   featured_image
    //   author_avatar
    //   any nested image/media field
    // --------------------------------------------------------

    const migratedNote =
      await migrateMediaDeep(
        note,
        `/notes/${noteDoc.id}`
      );


    // --------------------------------------------------------
    // Write note
    // --------------------------------------------------------

    if (!DRY_RUN) {
      await destinationDb
        .collection("notes")
        .doc(noteDoc.id)
        .set(migratedNote);
    }


    // --------------------------------------------------------
    // COMMENTS
    // --------------------------------------------------------

    const commentsSnapshot =
      await noteDoc.ref
        .collection("comments")
        .get();


    console.log(
      `  Comments: ${commentsSnapshot.size}`
    );


    for (
      const commentDoc
      of commentsSnapshot.docs
    ) {
      const comment =
        commentDoc.data();


      const migratedComment =
        await migrateMediaDeep(
          comment,
          `/notes/${noteDoc.id}/comments/${commentDoc.id}`
        );


      if (!DRY_RUN) {
        await destinationDb
          .collection("notes")
          .doc(noteDoc.id)
          .collection("comments")
          .doc(commentDoc.id)
          .set(migratedComment);
      }


      stats.comments++;


      // ------------------------------------------------------
      // COMMENT LIKES
      // ------------------------------------------------------

      const commentLikesSnapshot =
        await commentDoc.ref
          .collection("commentLikes")
          .get();


      for (
        const likeDoc
        of commentLikesSnapshot.docs
      ) {
        const like =
          likeDoc.data();


        const migratedLike =
          await migrateMediaDeep(
            like,
            `/notes/${noteDoc.id}/comments/${commentDoc.id}/commentLikes/${likeDoc.id}`
          );


        if (!DRY_RUN) {
          await destinationDb
            .collection("notes")
            .doc(noteDoc.id)
            .collection("comments")
            .doc(commentDoc.id)
            .collection("commentLikes")
            .doc(likeDoc.id)
            .set(migratedLike);
        }


        stats.commentLikes++;
      }
    }


    // --------------------------------------------------------
    // NOTE LIKES
    // --------------------------------------------------------

    const likesSnapshot =
      await noteDoc.ref
        .collection("likes")
        .get();


    for (
      const likeDoc
      of likesSnapshot.docs
    ) {
      const like =
        likeDoc.data();


      const migratedLike =
        await migrateMediaDeep(
          like,
          `/notes/${noteDoc.id}/likes/${likeDoc.id}`
        );


      if (!DRY_RUN) {
        await destinationDb
          .collection("notes")
          .doc(noteDoc.id)
          .collection("likes")
          .doc(likeDoc.id)
          .set(migratedLike);
      }


      stats.likes++;
    }


    stats.notes++;


    console.log(
      `  ✓ Note migrated`
    );

    console.log(
      `  → ${commentsSnapshot.size} comment(s)`
    );

    console.log(
      `  → ${likesSnapshot.size} like(s)`
    );
  }
}


// ============================================================
// MIGRATE FLAT COLLECTION
// ============================================================

async function migrateFlatCollection(name) {
  const snapshot =
    await sourceDb
      .collection(name)
      .get();


  console.log(
    `\nFound ${snapshot.size} doc(s) in /${name}.`
  );


  if (DRY_RUN) {
    console.log(
      `  [dry-run] would migrate ${snapshot.size} document(s)`
    );

    return;
  }


  /**
   * Firestore allows up to 500 writes per batch.
   *
   * We use 400 to leave a safety margin.
   */
  const BATCH_SIZE = 400;

  let batch =
    destinationDb.batch();

  let batchCount = 0;


  for (
    const document
    of snapshot.docs
  ) {
    const data =
      document.data();


    /**
     * IMPORTANT:
     *
     * Users are processed through migrateMediaDeep().
     *
     * This means if a user document contains:
     *
     *   avatar
     *   photoURL
     *   profileImage
     *   image
     *   etc.
     *
     * and the value is a Cloudinary URL,
     * it can be moved to R2.
     *
     * Existing R2 URLs remain untouched.
     */
    const migratedData =
      await migrateMediaDeep(
        data,
        `/${name}/${document.id}`
      );


    batch.set(
      destinationDb
        .collection(name)
        .doc(document.id),
      migratedData
    );


    batchCount++;


    if (batchCount >= BATCH_SIZE) {
      await batch.commit();

      batch =
        destinationDb.batch();

      batchCount = 0;
    }
  }


  if (batchCount > 0) {
    await batch.commit();
  }


  // Update statistics.
  stats[name] =
    snapshot.size;


  console.log(
    `  ✓ /${name} migrated`
  );
}


// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(
    "\n========================================"
  );

  console.log(
    "NotesApp → Own Infrastructure Migration"
  );

  console.log(
    "========================================\n"
  );


  if (DRY_RUN) {
    console.log(
      "MODE: DRY RUN"
    );
  } else {
    console.log(
      "MODE: LIVE MIGRATION"
    );
  }


  if (SKIP_MEDIA) {
    console.log(
      "MEDIA: SKIPPED"
    );
  } else {
    console.log(
      "MEDIA: Cloudinary → R2"
    );
  }


  console.log(
    `Source: ${process.env.SOURCE_SERVICE_ACCOUNT}`
  );

  console.log(
    `Destination: ${process.env.DEST_SERVICE_ACCOUNT}`
  );

  console.log(
    `R2 bucket: ${R2_BUCKET_NAME}`
  );

  console.log(
    `R2 public URL: ${R2_PUBLIC_URL}`
  );


  // ----------------------------------------------------------
  // NOTES
  // ----------------------------------------------------------

  await migrateNotes();


  // ----------------------------------------------------------
  // NOTESAPP-ONLY COLLECTIONS
  // ----------------------------------------------------------

  for (
    const collectionName
    of [
      "users",
      "follows",
      "subscriptions",
      "leads",
      "notifications",
    ]
  ) {
    await migrateFlatCollection(
      collectionName
    );
  }


  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------

  console.log(
    "\n========================================"
  );

  console.log(
    "Migration run finished"
  );

  console.log(
    "========================================"
  );


  console.log(
    `Notes: ${stats.notes}`
  );

  console.log(
    `Comments: ${stats.comments}`
  );

  console.log(
    `Comment likes: ${stats.commentLikes}`
  );

  console.log(
    `Note likes: ${stats.likes}`
  );


  console.log(
    `Users: ${stats.users || 0}`
  );

  console.log(
    `Follows: ${stats.follows || 0}`
  );

  console.log(
    `Subscriptions: ${stats.subscriptions || 0}`
  );

  console.log(
    `Leads: ${stats.leads || 0}`
  );

  console.log(
    `Notifications: ${stats.notifications || 0}`
  );


  console.log(
    "\nMedia:"
  );

  console.log(
    `  Cloudinary URLs found: ${stats.mediaFound}`
  );

  console.log(
    `  Uploaded to R2: ${stats.mediaMigrated}`
  );

  console.log(
    `  Already existed/reused: ${stats.mediaReused}`
  );

  console.log(
    `  Non-Cloudinary/unchanged: ${stats.mediaSkipped}`
  );

  console.log(
    `  Failures: ${stats.mediaFailures}`
  );


  if (DRY_RUN) {
    console.log(
      "\nDRY RUN ONLY."
    );

    console.log(
      "Nothing was written."
    );

    console.log(
      "Run without --dry-run to perform the migration."
    );
  } else {
    console.log(
      "\nThe source Firebase project was not modified."
    );

    console.log(
      "The destination Firebase project now contains the migrated data."
    );
  }


  console.log(
    "\nIMPORTANT NEXT STEP:"
  );

  console.log(
    "Point NotesApp itself at the NEW Firebase project."
  );

  console.log(
    "Configure NotesApp uploads to use the R2 bucket."
  );

  console.log(
    "Deploy the Firestore rules to the NEW Firebase project."
  );

  console.log(
    "Then test creating a NEW note and uploading a NEW image."
  );

  console.log(
    "The new image should be stored in R2, not Cloudinary."
  );


  console.log(
    "\nMigration complete."
  );
}


// ============================================================
// ERROR HANDLING
// ============================================================

main().catch((error) => {
  console.error(
    "\n========================================"
  );

  console.error(
    "MIGRATION FAILED"
  );

  console.error(
    "========================================"
  );

  console.error(
    error
  );

  process.exit(1);
});