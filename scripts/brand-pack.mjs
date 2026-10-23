// Builds public/brand/notesapp-logo-pack.zip (the logo pack on /brand): the icon, the wordmark, app icons, the campaign graphic and
// GUIDELINES.txt with the same words as the page (lib/brand-guidelines.ts). Run: npx -y tsx scripts/brand-pack.mjs (needs `zip`).
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BRAND_FAQ, BRAND_GENERAL, BRAND_INTRO, BRAND_LEGAL, BRAND_PACK, BRAND_PROHIBITED } from "../lib/brand-guidelines.ts";

const root = new URL("..", import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), "brand-")), pack = join(work, "NotesApp-logo-pack");
const files = {
  "icon/notesapp-icon.png": "notesapp-icon.png", "icon/notesapp-icon.webp": "notesapp-icon.webp", "icon/notesapp-icon-512.png": "icon-512.png",
  "wordmark/notesapp-logo-full.png": "logo-full.png", "wordmark/notesapp-logo-full.webp": "notesapp-logo-full.webp", "wordmark/notesapp-wordmark.png": "NotesApp-full.png",
  "app-icons/apple-touch-icon.png": "apple-touch-icon.png", "app-icons/icon-192.png": "icon-192.png", "app-icons/icon-maskable-512.png": "icon-maskable-512.png",
  "campaign/1MillionNairaNotesAppChallenge.webp": "challenge-graphic.webp",
};
const products = { "naija-exam-prep/naija-exam-prep-512.png": "exam-prep/icon-512.png", "naija-exam-prep/naija-exam-prep-wordmark.png": "exam-prep/wordmark.png" };
for (const [to, from] of Object.entries(files)) { mkdirSync(join(pack, to, ".."), { recursive: true }); cpSync(join(root, "public/images/brand", from), join(pack, to)); }
for (const [to, from] of Object.entries(products)) { mkdirSync(join(pack, to, ".."), { recursive: true }); cpSync(join(root, "public/images", from), join(pack, to)); }
const text = [
  `NotesApp brand guidelines (logo pack ${BRAND_PACK.version})`, "Full guidelines: https://www.notesapp.name.ng/brand", "",
  "INTRODUCTION", ...BRAND_INTRO, "",
  "GENERAL GUIDELINES", ...BRAND_GENERAL.map((g) => `- ${g.t}: ${g.d}`), "",
  "COLOURS", "Crimson #7A0328 · Crimson Bright #A6093D · Ink #1A1210 · Paper #FBF6F2", "",
  "PROHIBITED USES", ...BRAND_PROHIBITED.map((p) => `- ${p}`), "",
  "FAQ", ...BRAND_FAQ.flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`, ""]),
  "LEGAL", ...BRAND_LEGAL, "",
].join("\n");
writeFileSync(join(pack, "GUIDELINES.txt"), text);
mkdirSync(join(root, "public/brand"), { recursive: true });
const out = join(root, "public", BRAND_PACK.file);
rmSync(out, { force: true });
execFileSync("zip", ["-qrX", out, "NotesApp-logo-pack"], { cwd: work });
rmSync(work, { recursive: true });
console.log(`written ${BRAND_PACK.file}`);
