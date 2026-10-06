import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getAdminDb } from "./firebase-admin";
import { getR2Client } from "./r2";
import { deleteObject, privateBucket, privateFilesConfigured } from "./private-files";
import { deleteVideo, listVideos, streamConfigured } from "./stream";
import type { StoredLesson } from "./view-access";

// Server-only. Finds (and removes) paid-content files nothing points at any more: videos in Cloudflare Stream and objects in
// the private bucket left behind by deleted items and abandoned uploads. Nothing a buyer can still reach is touched: a file
// is "in use" while a storeFiles record names it, and a storeFiles record whose item was deleted is only removed when no
// one bought that item. Anything younger than a day is left alone (it may be an upload in progress).
const GRACE_MS = 24 * 3_600_000;

export type Orphans = {
  records: { itemId: string }[]; // storeFiles records of deleted items that nobody bought
  videos: { uid: string; name?: string; minutes: number }[];
  objects: { key: string; size: number }[];
  streamChecked: boolean;
  bucketChecked: boolean;
};

type FileDoc = { key?: string; lessons?: StoredLesson[] };

export async function scanOrphans(): Promise<Orphans> {
  const db = getAdminDb();
  const [files, items] = await Promise.all([db.collection("storeFiles").get(), db.collection("storeItems").select().get()]);
  const itemIds = new Set(items.docs.map((d) => d.id));

  // Records of deleted items: removable only if no one bought it (buyers keep their access).
  const records: { itemId: string }[] = [];
  const inUse = (d: FileDoc) => ({ keys: [d.key, ...(d.lessons ?? []).map((l) => l.key)].filter(Boolean) as string[], uids: (d.lessons ?? []).map((l) => l.uid).filter(Boolean) as string[] });
  const keepKeys = new Set<string>();
  const keepUids = new Set<string>();
  for (const f of files.docs) {
    const used = inUse(f.data() as FileDoc);
    let keep = itemIds.has(f.id);
    if (!keep) keep = !(await db.collection("digitalPurchases").where("itemId", "==", f.id).limit(1).get()).empty;
    if (keep) {
      used.keys.forEach((k) => keepKeys.add(k));
      used.uids.forEach((u) => keepUids.add(u));
    } else records.push({ itemId: f.id });
  }

  const cutoff = Date.now() - GRACE_MS;
  const videos: Orphans["videos"] = [];
  const objects: Orphans["objects"] = [];
  if (streamConfigured()) {
    for (const v of await listVideos()) {
      if (!keepUids.has(v.uid) && (!v.created || new Date(v.created).getTime() < cutoff)) videos.push({ uid: v.uid, name: v.name, minutes: Math.round((v.duration ?? 0) / 60) });
    }
  }
  if (privateFilesConfigured()) {
    for (const prefix of ["lessons/", "digital/"]) {
      let token: string | undefined;
      do {
        const r = await getR2Client().send(new ListObjectsV2Command({ Bucket: privateBucket(), Prefix: prefix, ContinuationToken: token }));
        for (const o of r.Contents ?? []) {
          if (o.Key && !keepKeys.has(o.Key) && (o.LastModified?.getTime() ?? 0) < cutoff) objects.push({ key: o.Key, size: o.Size ?? 0 });
        }
        token = r.IsTruncated ? r.NextContinuationToken : undefined;
      } while (token);
    }
  }
  return { records, videos, objects, streamChecked: streamConfigured(), bucketChecked: privateFilesConfigured() };
}

export async function cleanOrphans(): Promise<{ videos: number; objects: number; records: number }> {
  const found = await scanOrphans();
  const db = getAdminDb();
  for (const v of found.videos) await deleteVideo(v.uid);
  for (const o of found.objects) await deleteObject(o.key);
  for (const r of found.records) await db.doc(`storeFiles/${r.itemId}`).delete();
  return { videos: found.videos.length, objects: found.objects.length, records: found.records.length };
}
