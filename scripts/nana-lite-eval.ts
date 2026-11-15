// Nana Lite evaluation (docs/NANA_LITE.md): how often our small model gets published Exam Prep questions right WITHOUT being told the
// answer, how long it takes, and how often it fails to answer. It's the honest measure for the pilot and for grant applications.
//
// Run on a computer that can reach the model server and Firestore:
//   NANA_LITE_URL=https://lite.example NANA_LITE_MODEL=phi-3.5-mini-instruct FIREBASE_SERVICE_ACCOUNT_KEY='…' \
//     npx -y tsx scripts/nana-lite-eval.ts --exam waec --limit 200 [--subject biology] [--out nana-lite-eval]
// Writes <out>.json (every row) and <out>.md (the summary). Reads questions only; writes nothing to Firestore.
import { writeFileSync } from "fs";
import { SOLVE_SYSTEM, parseChoice, solvePrompt, summarise, type EvalRow } from "../lib/nana-lite";
import type { Question } from "../lib/exam-prep";

const arg = (name: string, fallback = "") => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? String(process.argv[i + 1] ?? "") : fallback; };

async function main() {
  const base = (process.env.NANA_LITE_URL || "").replace(/\/+$/, "");
  if (!base) throw new Error("Set NANA_LITE_URL to the model server.");
  const model = process.env.NANA_LITE_MODEL || "phi-3.5-mini-instruct";
  const exam = arg("exam", "waec"), subject = arg("subject"), limit = Math.max(1, Math.min(2000, Number(arg("limit", "100")) || 100)), out = arg("out", "nana-lite-eval");

  const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId: process.env.GCLOUD_PROJECT || "demo-notesapp" } : { credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
  let qy = getFirestore().collection("prepQuestions").where("status", "==", "published").where("exam", "==", exam);
  if (subject) qy = qy.where("subject", "==", subject);
  const qs = (await qy.limit(limit).get()).docs.map((d) => d.data() as Question);
  console.log(`Evaluating ${model} on ${qs.length} ${exam}${subject ? `/${subject}` : ""} questions…`);

  const rows: EvalRow[] = [];
  for (const q of qs) {
    const started = Date.now();
    let text = "";
    try {
      const r = await fetch(`${base}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.NANA_LITE_KEY ? { Authorization: `Bearer ${process.env.NANA_LITE_KEY}` } : {}) },
        body: JSON.stringify({ model, messages: [{ role: "system", content: SOLVE_SYSTEM }, { role: "user", content: solvePrompt(q) }], max_tokens: 300, temperature: 0 }),
        signal: AbortSignal.timeout(60_000),
      });
      text = String((await r.json())?.choices?.[0]?.message?.content ?? "");
    } catch (e) { text = ""; console.error(q.id, e instanceof Error ? e.message : e); }
    const got = parseChoice(text, q.options.map((o) => o.key));
    rows.push({ id: q.id, subject: q.subject, expected: q.answer, got, ok: got === q.answer, ms: Date.now() - started });
    process.stdout.write(got === q.answer ? "." : "x");
  }
  const s = summarise(rows);
  writeFileSync(`${out}.json`, JSON.stringify({ model, exam, subject: subject || null, at: new Date().toISOString(), summary: s, rows }, null, 1));
  const md = [`# Nana Lite evaluation: ${model}`, "", `${exam.toUpperCase()}${subject ? ` · ${subject}` : ""} · ${new Date().toISOString().slice(0, 10)}`, "",
    `- Questions: ${s.n}`, `- Right without the answer: ${s.right} (${(s.accuracy * 100).toFixed(1)}%)`, `- No answer given: ${s.unanswered}`, `- Median time: ${(s.medianMs / 1000).toFixed(1)} s`, "",
    "| Subject | Questions | Right | % |", "|---|---|---|---|",
    ...Object.entries(s.bySubject).sort().map(([k, v]) => `| ${k} | ${v.n} | ${v.right} | ${((v.right / v.n) * 100).toFixed(0)}% |`)].join("\n");
  writeFileSync(`${out}.md`, md + "\n");
  console.log(`\n\n${md}\n\nWrote ${out}.json and ${out}.md`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
