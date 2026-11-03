// Builds lib/staff-library-content.ts from the Markdown in content/staff-library/ (the handbook, the SOP manuals and the department
// briefs, as approved) and docs/ENGINEERING_GUIDE.md, so the server can seed the staff library without reading files at run time.
// Run after changing any of them:  node scripts/staff-library-content.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = "content/staff-library";
const text = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) text[f.replace(/\.md$/, "")] = readFileSync(`${dir}/${f}`, "utf8").replace(/\r\n/g, "\n").trim() + "\n";
text["brief-engineering"] = readFileSync("docs/ENGINEERING_GUIDE.md", "utf8").replace(/\r\n/g, "\n").trim() + "\n";
const version = createHash("sha256").update(JSON.stringify(text)).digest("hex").slice(0, 16);
const out = `// Made by scripts/staff-library-content.mjs from content/staff-library/*.md and docs/ENGINEERING_GUIDE.md. Don't edit by hand.
export const STAFF_LIBRARY_VERSION = ${JSON.stringify(version)};
export const STAFF_LIBRARY_TEXT: Record<string, string> = ${JSON.stringify(text, null, 2)};
`;
writeFileSync("lib/staff-library-content.ts", out);
console.log(`lib/staff-library-content.ts: ${Object.keys(text).length} documents, version ${version}`);
