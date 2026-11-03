// Partner API image uploads (POST /api/v1/uploads): request checks and storage key. Run: npm run test:uploads → "ALL OK".
import assert from "node:assert/strict";
import { apiUploadKey, checkApiUpload } from "../../lib/upload-rules";

const ok = checkApiUpload({ filename: " cover.jpg ", content_type: "image/jpeg", size: 1234 });
assert.deepEqual(ok, { ok: true, req: { filename: "cover.jpg", contentType: "image/jpeg", size: 1234 } });
for (const t of ["image/png", "image/webp", "image/gif", "image/avif"]) assert.equal(checkApiUpload({ filename: "a", content_type: t, size: 1 }).ok, true, t);

// refused: no body, no name, not an image (videos have their own route), bad or too-big size
for (const bad of [
  null, "x", {},
  { content_type: "image/png", size: 1 },
  { filename: "a.mp4", content_type: "video/mp4", size: 1 },
  { filename: "a.html", content_type: "text/html", size: 1 },
  { filename: "a.png", content_type: "image/png" },
  { filename: "a.png", content_type: "image/png", size: 0 },
  { filename: "a.png", content_type: "image/png", size: 1.5 },
  { filename: "a.png", content_type: "image/png", size: "12" },
  { filename: "a.png", content_type: "image/png", size: 10 * 1024 * 1024 + 1 },
]) assert.equal(checkApiUpload(bad).ok, false, JSON.stringify(bad));
assert.equal(checkApiUpload({ filename: "a.png", content_type: "image/png", size: 10 * 1024 * 1024 }).ok, true);

// each account's files stay in its own folder, with a safe name
assert.equal(apiUploadKey("uid_1", "my cover (1).jpg", 1700000000000), "api/uid_1/1700000000000-my_cover__1_.jpg");
assert.equal(apiUploadKey("uid_1", "../../etc/passwd", 1), "api/uid_1/1-.._.._etc_passwd");

console.log("ALL OK");
