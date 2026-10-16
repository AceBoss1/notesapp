// Writes docs/ENVIRONMENT.md from lib/config.ts (the one list of settings), and with --check fails when it's out of date or
// when code reads process.env outside lib/config.ts. Run: npm run docs:settings (CI runs it with --check).
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { SETTINGS } from "../lib/config";

const groups = new Map<string, [string, (typeof SETTINGS)[keyof typeof SETTINGS]][]>();
for (const [name, def] of Object.entries(SETTINGS)) groups.set(def.group, [...(groups.get(def.group) ?? []), [name, def]]);
const md = [
  "# Settings (environment variables)",
  "",
  "Made from `lib/config.ts` by `npm run docs:settings`: change the list there, not here. Set them in Vercel → Settings →",
  "Environment Variables (mark secrets Sensitive), then redeploy: `NEXT_PUBLIC_*` values are built into the pages.",
  "",
  ...Array.from(groups).flatMap(([group, rows]) => [
    `## ${group}`, "", "| Setting | Secret | What it does |", "|---|---|---|",
    ...rows.map(([n, d]) => `| \`${n}\` | ${d.secret ? "**yes**" : "no"} | ${d.about.replace(/\|/g, "\\|")} |`), "",
  ]),
].join("\n");

const path = "docs/ENVIRONMENT.md";
if (process.argv.includes("--check")) {
  const stray = execSync("grep -rnE 'process\\.env\\.[A-Z]|process\\.env\\[' app lib components middleware.ts --include=*.ts --include=*.tsx || true").toString()
    .split("\n").filter((l) => l && !l.startsWith("lib/config.ts"));
  if (stray.length) { console.error("Read settings with setting() from lib/config.ts, not process.env:\n" + stray.join("\n")); process.exit(1); }
  let current = ""; try { current = readFileSync(path, "utf8"); } catch { /* missing */ }
  if (current !== md) { console.error(`${path} is out of date: run npm run docs:settings`); process.exit(1); }
  console.log("settings OK");
} else {
  writeFileSync(path, md);
  console.log(`wrote ${path}`);
}
