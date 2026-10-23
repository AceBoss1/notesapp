// Checks one subject's question file before scripts/exam-prep-starter.mjs builds it in.
// Run: node scripts/exam-prep-questions/check.mjs physics
import { DEFAULT_TOPICS } from "./topics.mjs";

const name = process.argv[2];
const mod = (await import(`./${name}.mjs`)).default;
const topics = DEFAULT_TOPICS[name];
if (!topics) throw new Error(`No topics for ${name}.`);
const problems = [];
const warn = [];
const stems = new Map();
for (const exam of ["jamb", "waec", "neco"]) {
  const set = mod[exam];
  if (!set) { problems.push(`${exam}: missing`); continue; }
  const { list, free } = set;
  if (list.length !== 20) problems.push(`${exam}: ${list.length} questions, want 20`);
  for (const tp of topics) { const n = list.filter((q) => q.t === tp).length; if (n < 3) problems.push(`${exam}: only ${n} in ${tp}, want 3 or more`); }
  if (new Set(free).size < 8 || free.some((i) => i < 0 || i >= list.length)) problems.push(`${exam}: free needs 8 different indices into the list`);
  list.forEach((q, i) => {
    const at = `${exam} #${i + 1}`;
    if (!topics.includes(q.t)) problems.push(`${at}: unknown topic ${q.t}`);
    if (!q.stem || q.stem.length < 10) problems.push(`${at}: stem too short`);
    if (!Array.isArray(q.o) || q.o.length !== 4) problems.push(`${at}: needs exactly 4 options`);
    else if (new Set(q.o.map((x) => x.toLowerCase())).size !== 4) problems.push(`${at}: two options are the same`);
    if (q.ans !== 0) problems.push(`${at}: write the correct option first (ans: 0)`);
    if (!q.e || q.e.length < 40) problems.push(`${at}: explanation too short`);
    if (q.check !== undefined && q.check !== true) problems.push(`${at}: the working doesn't give option A (${q.stem})`);
    if (q.d !== undefined && ![1, 2, 3].includes(q.d)) problems.push(`${at}: difficulty 1, 2 or 3`);
    for (const k of Object.keys(q.why ?? {})) if (!["B", "C", "D"].includes(k)) problems.push(`${at}: why keys are B, C or D (wrong options)`);
    if (q.check === undefined && q.o?.every((x) => /\d/.test(x))) warn.push(`${at}: every option has a number but there's no check`);
    const key = q.stem.toLowerCase().replace(/\W+/g, " ").trim();
    if (stems.has(key)) problems.push(`${at}: same question as ${stems.get(key)}`);
    stems.set(key, at);
  });
}
for (const w of warn) console.log("warning:", w);
if (problems.length) { for (const p of problems) console.log("problem:", p); process.exit(1); }
console.log(`${name}: OK, 60 questions`);
