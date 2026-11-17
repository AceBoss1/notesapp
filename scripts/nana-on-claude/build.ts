// Builds the Nana on Claude page (docs/NANA_ON_CLAUDE.md) from a copy file downloaded at Admin → Help & Nana → Nana on Claude.
//   npx -y tsx scripts/nana-on-claude/build.ts <copy.json> <out.html>
// The result is one HTML file to publish on claude.ai as an artifact with the capabilities sample (with images), downloads and
// artifact. Day to day the page updates itself from a copy file; build it again only when page.html or the bundled lib code changes.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readCopy } from "../../lib/nana-claude";

const [copyPath, outPath] = process.argv.slice(2);
if (!copyPath || !outPath) { console.error("usage: build.ts <copy.json> <out.html>"); process.exit(1); }
const here = path.join(process.cwd(), "scripts/nana-on-claude");
const copy = readCopy(JSON.parse(readFileSync(copyPath, "utf8")));
const host = new URL(copy.siteUrl).hostname.replace(/^www\./, "");
const bundle = path.join(mkdtempSync(path.join(tmpdir(), "nana-claude-")), "client.js");
// The page has no `process`; the one setting the bundled code reads is the site's own domain, for links back to it.
execFileSync("npx", ["-y", "esbuild", path.join(here, "client.ts"), "--bundle", "--format=iife", "--global-name=NanaLib", "--minify", "--target=es2019", `--outfile=${bundle}`, "--log-level=warning", `--banner:js=var process={env:{NEXT_PUBLIC_ROOT_DOMAIN:${JSON.stringify(host)}}};`], { stdio: "inherit" });
const dataUri = (file: string, type: string) => `data:${type};base64,${readFileSync(path.join(process.cwd(), file)).toString("base64")}`;
const data = { siteUrl: copy.siteUrl, version: "", date: copy.copiedAt.slice(0, 10), system: copy.system, articles: copy.articles, copied: copy.copied };
const page = readFileSync(path.join(here, "page.html"), "utf8")
  .replace("__MARK__", () => dataUri("public/images/brand/icon-192.png", "image/png"))
  .replace("__AVATAR__", () => dataUri("public/images/nana/nana-sm.webp", "image/webp"))
  .replace("/*__DATA__*/", () => JSON.stringify(data).replace(/</g, "\\u003c"))
  .replace("/*__LIB__*/", () => readFileSync(bundle, "utf8").replace(/<\/script/gi, "<\\/script"));
writeFileSync(outPath, page);
console.log(`${outPath}: ${page.length} bytes, ${copy.articles.length} articles copied ${copy.copied}`);
