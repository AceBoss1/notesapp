# Nana Lite: a small exam tutor for students

> Status: **phase 1 built (v0.166.0, 15 November 2026)**: the tutor in Exam Prep practice, the server connection, the daily limit
> and the evaluation script. **It switches on when `NANA_LITE_URL` points at our model server** (below); until then Exam Prep shows
> only the written explanation, as before. The owner asked for it on 14 November 2026, after checking Mozilla's Human-Scale AI call
> (FUNDING.md §24).

## What it is

Nana runs on large hosted models. **Nana Lite runs a small open model on our own server** (and, in phase 3, on the student's phone,
offline). It does one job well: when a student gets a WAEC, NECO or JAMB practice question wrong, or isn't sure, they tap **Still
unsure? Ask Nana Lite** and get a short explanation another way, in English or Pidgin, and can ask follow-up questions.

It is **grounded**: every answer is built from the question, its options, the correct answer and the **reviewed explanation** our
reviewers wrote (plus the teacher's note on the student's wrong choice). The model is told to add no facts of its own and to say "ask
your teacher" when the explanation doesn't cover something. A small model can explain well when it's given the facts; it shouldn't be
trusted to supply them.

## How it maps to Human-Scale AI (Mozilla)

| Principle | Nana Lite |
|---|---|
| **Small** | A 1.5 to 3.8 billion parameter open model, 4-bit quantised (about 1 to 2.5 GB), on one CPU server; phone-sized in phase 3 |
| **Intentional** | Nothing a student types is stored (only a daily count, deleted after two days, and the day's total); paid questions open only to those with the pack; the model never sees who the student is |
| **Tailored** | Built for Nigerian students preparing for WAEC, NECO and JAMB, from 2,150+ reviewed questions, in English and Pidgin, Kiswahili next |

## The models (licences checked for a paid product)

Listed in `lib/nana-lite.ts` (`LITE_MODELS`); the server refuses any other name and falls back to the default.

| Model | Size | Licence | Use |
|---|---|---|---|
| Phi-3.5-mini-instruct | 3.8B | MIT | **Server default**: the best reasoning at this size |
| Qwen2.5-1.5B-Instruct | 1.5B | Apache-2.0 | **Phone default** (phase 3); also a fast server option |
| SmolLM2-1.7B-Instruct | 1.7B | Apache-2.0 | A fully open fallback |

Check each model card's licence again before switching (licences change between versions; for example, some Qwen2.5 sizes use a
research licence, which is why only 1.5B is listed).

## Phase 1: switch it on (our server)

1. **A server:** any Linux VPS with 4 vCPUs and 8 GB RAM is enough for Phi-3.5-mini at 4-bit (a few seconds an answer for one student
   at a time). Start in Lagos or Johannesburg for low latency. Expect roughly the cost of a small VPS a month; no GPU needed to start.
2. **The model file:** download the GGUF build of the model at `Q4_K_M` from its official Hugging Face page (for example
   `Phi-3.5-mini-instruct-Q4_K_M.gguf`).
3. **Run llama.cpp's server** (OpenAI-compatible), with a key:
   ```
   docker run -d --name nana-lite --restart unless-stopped -p 8080:8080 -v /srv/models:/models \
     ghcr.io/ggml-org/llama.cpp:server -m /models/Phi-3.5-mini-instruct-Q4_K_M.gguf \
     --host 0.0.0.0 --port 8080 -c 4096 --api-key <a long random key> --alias phi-3.5-mini-instruct
   ```
   (Ollama or vLLM work too: anything that serves `POST /v1/chat/completions`.)
4. **HTTPS in front** (Caddy or Cloudflare Tunnel), at an address such as `https://lite.notesapp.name.ng`.
5. **Vercel settings:** `NANA_LITE_URL` (that address), `NANA_LITE_MODEL` (`phi-3.5-mini-instruct`), `NANA_LITE_KEY` (the same key);
   redeploy. `GET /api/exam-prep/lite` now says `on: true`, and the button appears under marked questions.
6. **Firestore:** `firebase deploy --only firestore` (the `prepLiteDaily` rule and its two-day TTL).

## Phase 2: measure it (before the pilot, and for grant applications)

```
NANA_LITE_URL=… NANA_LITE_MODEL=phi-3.5-mini-instruct NANA_LITE_KEY=… FIREBASE_SERVICE_ACCOUNT_KEY='…' \
  npx -y tsx scripts/nana-lite-eval.ts --exam waec --limit 300 --out waec-phi35
```

It asks the model to solve published questions **without the answer** and writes `waec-phi35.md` (accuracy overall and by subject, how
often it didn't answer, the median time) and `.json` (every row). This is a hard test: in the app the model is given the answer and the
explanation, and only has to explain. Run it per model and keep the reports; quote them as they are.

**The pilot:** two or three schools or exam-prep centres for a term. Measure, from the daily totals only: practice sessions, Nana Lite
asks, and (with the school's consent and its own records) mock-exam scores before and after. Ask students and teachers what helped.

## Phase 3: on the phone, offline

Run Qwen2.5-1.5B (4-bit) in the browser with WebGPU (WebLLM) or in the Android app (MediaPipe LLM Inference / llama.cpp), using the
questions already saved on the phone for offline practice. The student's questions then never leave the phone. Only on devices that
can run it; others keep the server.

## Limits and safety

- **40 asks a day** per account (or per device, by a hash of its address, when signed out), and 30 per 10 minutes at the API.
- **Short answers** (350 tokens at most), so they're fast and readable on a phone.
- **Only questions the student can already see:** published, and free or in a pack they have.
- **It can be wrong:** the page says so, and the teacher has the last word. "Report a problem" stays under every question.
- **No student content kept;** the model server keeps no logs of prompts (run llama-server without `--log-file`, and keep the reverse
  proxy's request bodies out of its logs).

## Code

- `lib/nana-lite.ts`: models, prompts (explain and solve), parsing, evaluation summary.
- `lib/nana-lite-server.ts`: the call to our server, the access check, the daily limit.
- `app/api/exam-prep/lite/route.ts`: `GET` (on or off), `POST` (explain).
- `components/exam-prep/AskNanaLite.tsx`: the button and the follow-ups in practice.
- `scripts/nana-lite-eval.ts`: the evaluation.
- Tests: `npm run test:nana-lite`.
