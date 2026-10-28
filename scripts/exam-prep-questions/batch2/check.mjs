// Checks one second-batch subject file (batch2/<subject>.mjs) before scripts/exam-prep-starter.mjs builds it in.
// Run: node scripts/exam-prep-questions/batch2/check.mjs physics
import { readFileSync } from "node:fs";
import { BATCH2, ADD, NUMERIC } from "./topics.mjs";

const name = process.argv[2];
const spec = BATCH2[name];
if (!spec) throw new Error(`Unknown subject ${name}. Known: ${Object.keys(BATCH2).join(", ")}`);
const mod = (await import(`./${name}.mjs`)).default;
const starter = JSON.parse(readFileSync(new URL("../../../content/exam-prep/starter.json", import.meta.url), "utf8")).questions;
const norm = (s) => s.toLowerCase().replace(/\W+/g, " ").trim();
const problems = [], warn = [];
const stems = new Map();
// nothing may repeat a question already in the set, in any exam, for this subject (English counts both its subject ids)
const same = name === "use-of-english" || name === "english-language" ? ["use-of-english", "english-language"] : [name];
for (const q of starter) if (same.includes(q.subject)) stems.set(norm(q.stem) + (q.context ? `|${norm(q.context).slice(0, 60)}` : ""), `starter ${q.id}`);
const want = ADD, freeWant = Math.round(want * 0.4);
for (const [exam, topics] of Object.entries(spec)) {
  const set = mod[exam];
  if (!set) { problems.push(`${exam}: missing`); continue; }
  const { list, free } = set;
  const perTopic = Math.floor(want / topics.length) - 2;
  if (list.length !== want) problems.push(`${exam}: ${list.length} questions, want ${want}`);
  for (const tp of topics) { const n = list.filter((q) => q.t === tp).length; if (n < perTopic) problems.push(`${exam}: only ${n} in ${tp}, want ${perTopic} or more`); }
  if (new Set(free).size !== freeWant || free.some((i) => !Number.isInteger(i) || i < 0 || i >= list.length)) problems.push(`${exam}: free needs ${freeWant} different indices into the list`);
  const diff = [1, 2, 3].map((d) => list.filter((q) => (q.d ?? 2) === d).length);
  if (diff[0] < want * 0.15 || diff[2] < want * 0.15) warn.push(`${exam}: difficulty spread is ${diff.join("/")} (easy/medium/hard); aim for a mix`);
  list.forEach((q, i) => {
    const at = `${exam} #${i + 1}`;
    if (!topics.includes(q.t)) problems.push(`${at}: unknown topic ${q.t} (use ${topics.join(", ")})`);
    if (!q.stem || q.stem.length < 10) problems.push(`${at}: stem too short`);
    if (q.stem && q.stem.length > 1500) problems.push(`${at}: stem too long`);
    if (q.ctx !== undefined && (typeof q.ctx !== "string" || q.ctx.length > 3000)) problems.push(`${at}: ctx must be text up to 3,000 characters`);
    if (!Array.isArray(q.o) || q.o.length !== 4) problems.push(`${at}: needs exactly 4 options`);
    else {
      if (new Set(q.o.map((x) => String(x).toLowerCase().trim())).size !== 4) problems.push(`${at}: two options are the same (case-insensitive)`);
      if (q.o.some((x) => typeof x !== "string" || !x.trim() || x.length > 500)) problems.push(`${at}: options are non-empty text up to 500 characters`);
      if (q.o.some((x) => /^(all|none) of the above$/i.test(x.trim()))) problems.push(`${at}: no "all/none of the above" (options are shuffled)`);
    }
    if (q.ans !== 0) problems.push(`${at}: write the correct option first (ans: 0)`);
    if (!q.e || q.e.length < 40) problems.push(`${at}: explanation too short`);
    if (q.check !== undefined && q.check !== true) problems.push(`${at}: the working doesn't give option A (${q.stem})`);
    if (q.d !== undefined && ![1, 2, 3].includes(q.d)) problems.push(`${at}: difficulty 1, 2 or 3`);
    for (const k of Object.keys(q.why ?? {})) if (!["B", "C", "D"].includes(k)) problems.push(`${at}: why keys are B, C or D (the wrong options)`);
    if (NUMERIC.has(name) && q.check === undefined && q.o?.every((x) => /\d/.test(x))) problems.push(`${at}: every option has a number but there's no check`);
    const key = norm(q.stem ?? "") + (q.ctx ? `|${norm(q.ctx).slice(0, 60)}` : "");
    if (stems.has(key)) problems.push(`${at}: same question as ${stems.get(key)}`);
    stems.set(key, at);
  });
}
for (const w of warn) console.log("warning:", w);
if (problems.length) { for (const p of problems) console.log("problem:", p); process.exit(1); }
console.log(`${name}: OK, ${want * Object.keys(spec).length} questions (${Object.keys(spec).map((e) => `${want} ${e.toUpperCase()}`).join(", ")})`);
