// Pictures to WebP before upload (lib/upload-rules.ts): which ones, how big, and the new name. Run: npm run test:uploads → "ALL OK".
import assert from "node:assert/strict";
import { fitWithin, webpName, webpPlan } from "../../lib/upload-rules";

// JPEG and PNG become WebP; GIF (may move), WebP and AVIF stay; academy logos and signatures stay PNG for the certificate picture
assert.deepEqual(webpPlan("image/jpeg", "journal"), { maxSide: 2560 });
assert.deepEqual(webpPlan("image/png", "moment"), { maxSide: 2560 });
assert.deepEqual(webpPlan("image/jpeg", "ad"), { maxSide: 2560 });
assert.deepEqual(webpPlan("image/png", "avatar"), { maxSide: 1024 });
for (const t of ["image/gif", "image/webp", "image/avif", "video/mp4", "application/pdf"]) assert.equal(webpPlan(t, "journal"), null, t);
assert.equal(webpPlan("image/png", "academy"), null);
assert.equal(webpPlan("image/jpeg", "academy"), null);

// the long side is cut to fit, never enlarged, shape kept
assert.deepEqual(fitWithin(4032, 3024, 2560), { width: 2560, height: 1920 });
assert.deepEqual(fitWithin(3024, 4032, 2560), { width: 1920, height: 2560 });
assert.deepEqual(fitWithin(800, 600, 2560), { width: 800, height: 600 });
assert.deepEqual(fitWithin(5000, 10, 1024), { width: 1024, height: 2 });
assert.deepEqual(fitWithin(0, 0, 1024), { width: 1, height: 1 });

// the name keeps its stem
assert.equal(webpName("IMG_2041.JPG"), "IMG_2041.webp");
assert.equal(webpName("my.cake.photo.png"), "my.cake.photo.webp");
assert.equal(webpName("noext"), "noext.webp");
assert.equal(webpName(".png"), "picture.webp");

console.log("ALL OK");
