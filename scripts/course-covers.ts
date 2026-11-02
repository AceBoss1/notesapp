// Course covers without the AI and without anyone's allowance (lib/covers-server.ts adminCover).
//   npx -y tsx scripts/course-covers.ts --samples
//       draws Notes Academy's sample covers (lib/cover-samples.ts) into public/images/academy/covers/<slug>.webp
//   npx -y tsx scripts/course-covers.ts --course <id> [--course <id> …] [--spec '{"template":"band","palette":"moss",…}']
//       makes a cover for each course with the admin's credentials (FIREBASE_SERVICE_ACCOUNT_KEY, R2 settings) and sets it as the
//       course's cover; with --spec the given design is used (missing fields come from the course), otherwise one is designed from the course
//   --png also writes a PNG beside each sample (for checking by eye; not committed).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SAMPLE_COVERS } from "../lib/cover-samples";
import { renderCover } from "../lib/cover-render";

const args = process.argv.slice(2);
const all = (flag: string) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));

(async () => {
  if (args.includes("--samples")) {
    const dir = path.join(process.cwd(), "public/images/academy/covers");
    mkdirSync(dir, { recursive: true });
    for (const s of SAMPLE_COVERS) {
      const r = await renderCover(s.spec);
      if (r.type !== "image/webp") throw new Error("WebP encoding isn't available here");
      writeFileSync(path.join(dir, `${s.slug}.webp`), r.bytes);
      if (args.includes("--png")) writeFileSync(path.join(dir, `${s.slug}.png`), r.png);
      console.log(`${s.slug}.webp  ${Math.round(r.bytes.length / 1024)} KB  headline ${r.fitted.size}px × ${r.fitted.lines.length} line(s)${r.fitted.ok ? "" : "  (cut to fit)"}`);
    }
    process.exit(0);
  }
  const ids = all("--course");
  if (!ids.length) { console.error("Use --samples, or --course <id> (one or more)."); process.exit(1); }
  const { getAdminDb } = await import("../lib/firebase-admin");
  const { adminCover } = await import("../lib/covers-server");
  const spec = all("--spec")[0];
  for (const id of ids) {
    const item = await adminCover(getAdminDb(), id, { spec: spec ? JSON.parse(spec) : undefined, use: true });
    console.log(`${id}: ${item.url}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
