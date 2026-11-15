# Nana Lite: a small exam tutor for students

> Status: **phase 1 built (v0.176.0, 15 November 2026)**: the tutor in Exam Prep practice, the server connection, the daily limit
> and the evaluation script. **It runs on Cloudflare only** (owner, 15 November 2026): three small models in Cloudflare Containers behind our
> `workers/nana-lite` worker, on its `workers.dev` address. It switches on when `NANA_LITE_URL` points there; until then Exam Prep shows
> only the written explanation, as before. The owner asked for it on 14 November 2026, after checking Mozilla's Human-Scale AI call
> (FUNDING.md §24).

## What it is

Nana runs on large hosted models. **Nana Lite runs small open models we deploy ourselves, in containers on Cloudflare** (and, in phase 3, on the student's phone,
offline). It does one job well: when a student gets a WAEC, NECO or JAMB practice question wrong, or isn't sure, they tap **Still
unsure? Ask Nana Lite** and get a short explanation another way, in English or Pidgin, and can ask follow-up questions.

It is **grounded**: every answer is built from the question, its options, the correct answer and the **reviewed explanation** our
reviewers wrote (plus the teacher's note on the student's wrong choice). The model is told to add no facts of its own and to say "ask
your teacher" when the explanation doesn't cover something. A small model can explain well when it's given the facts; it shouldn't be
trusted to supply them.

## How it maps to Human-Scale AI (Mozilla)

| Principle | Nana Lite |
|---|---|
| **Small** | A 1.5 to 3.8 billion parameter open model, 4-bit quantised (about 1 to 2.5 GB), each in its own CPU container on Cloudflare; phone-sized in phase 3 |
| **Intentional** | Nothing a student types is stored (only a daily count, deleted after two days, and the day's total); paid questions open only to those with the pack; the model never sees who the student is |
| **Tailored** | Built for Nigerian students preparing for WAEC, NECO and JAMB, from 2,150+ reviewed questions, in English and Pidgin, Kiswahili next |

## The models (licences checked for a paid product)

Listed in `lib/nana-lite.ts` (`LITE_MODELS`); the server refuses any other name and falls back to the default.

| Model | Size | Licence | Use |
|---|---|---|---|
| Phi-3.5-mini-instruct | 3.8B | MIT | **The default**: the best reasoning at this size |
| Qwen2.5-1.5B-Instruct | 1.5B | Apache-2.0 | Fastest; the **phone default** in phase 3 |
| SmolLM2-1.7B-Instruct | 1.7B | Apache-2.0 | A fully open fallback |

All three run at once (one container each); `NANA_LITE_MODEL` picks which answers students, and the evaluation compares them. No Llama
model is used.

Check each model card's licence again before switching (licences change between versions; for example, some Qwen2.5 sizes use a
research licence, which is why only 1.5B is listed).

## Phase 1: switch it on (Cloudflare)

Nana Lite runs on **Cloudflare only**: a Worker (`workers/nana-lite`) checks the key and passes each request to one of three
**Cloudflare Containers**, each running llama.cpp's OpenAI-compatible server with one model baked into its image (no internet needed
inside the container). Containers sleep after 30 minutes idle and wake on the next ask (the first answer then waits 10 to 30 seconds
while the model loads; the app allows 50).

1. **Credits and plan.** Apply for the Cloudflare Startup Program and choose **Atlas** (USD 100k of credits on the NotesApp Inc
   account). Containers need the **Workers Paid** plan; switch it on (the credits cover usage).
2. **The address.** The worker answers on `https://notesapp-nana-lite.<your account's subdomain>.workers.dev` (Cloudflare →
   Workers & Pages → the worker shows it). That's all the app needs: students never see this address. `naapp.tech` stays on Vercel's
   nameservers, because Vercel's `*.naapp.tech` wildcard (app., prep., life., mcp. and members' sites) needs them; moving it to
   Cloudflare would break those. A custom domain such as `lite.<domain>` is optional and only for a domain whose DNS is on Cloudflare.
3. **The key.** Make one: `openssl rand -hex 32`. Keep it for steps 4 and 6.
4. **Deploy.** GitHub → Actions → **Deploy Nana Lite** → Run workflow (it uses the `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID` secrets the live-rooms deploy already uses; the token also needs **Containers: Edit**). Add a
   `NANA_LITE_KEY` repository secret first and the workflow sets it on the worker too. Or by hand, with Docker running:
   ```
   cd workers/nana-lite
   npm install --legacy-peer-deps
   npx wrangler deploy
   npx wrangler secret put NANA_LITE_KEY
   ```
   The first deploy builds the three images (it downloads each model file once, about 1 to 2.5 GB each) and pushes them to Cloudflare.
5. **Check it:**
   ```
   curl -s https://notesapp-nana-lite.<subdomain>.workers.dev/health
   curl -s https://notesapp-nana-lite.<subdomain>.workers.dev/v1/chat/completions -H "Authorization: Bearer <the key>" -H "Content-Type: application/json" \
     -d '{"model":"qwen2.5-1.5b-instruct","messages":[{"role":"user","content":"Say hello in Pidgin."}],"max_tokens":40}'
   ```
   Repeat with each model name. The first call to each model may take up to 30 seconds.
6. **Connect NotesApp.** Vercel: `NANA_LITE_URL=https://notesapp-nana-lite.<subdomain>.workers.dev`,
   `NANA_LITE_MODEL=phi-3.5-mini-instruct`, `NANA_LITE_KEY=<the key>`; redeploy. Then `firebase deploy --only firestore`.
7. **Measure** (Phase 2) all three, and set `NANA_LITE_MODEL` to the one that does best for students.

**Sizes.** `wrangler.jsonc` gives each container the `standard` instance type and at most two instances. If Cloudflare offers a larger
instance type (more CPU), use it for Phi first: answers come faster. Check Cloudflare's current Containers limits and prices before
changing them.

## Reserved for other work (not used for Nana Lite)

The owner's decision, 15 November 2026: Nana Lite uses Cloudflare only. The **OpenRouter** (USD 500) and **AWS Activate** (USD 5,000)
perks are kept for other projects. The steps below stay for reference if that changes.

### Our own server on AWS (reserved)

**Apply for the credits first** (Atlas → Perks → AWS): use the same email as the Atlas account, choose **Portfolio Package**, enter the
org ID Atlas gives; approval takes 7 to 10 business days. Credits are for organisations new to AWS Activate, expire (often after one
to two years) and don't cover everything (AWS Marketplace, for one).

**1. The account and region.** Sign in as the root user once, turn on MFA, then create an admin IAM user for daily work. Account →
**AWS Regions → Africa (Cape Town) `af-south-1` → Enable** (it's off by default; it's the closest AWS region to Lagos and Nairobi).
Billing → **Budgets → Create budget**: monthly cost budget, USD 150, email alerts at 80% and 100%.

**2. The server.** EC2 (Cape Town) → **Launch instance**:
- Name `nana-lite`; image **Ubuntu Server 24.04 LTS (64-bit Arm)**; type **`c7g.xlarge`** (4 vCPU, 8 GB, Graviton). If the
  llama.cpp image below won't run on Arm, use Ubuntu 24.04 (x86) on **`c7i.xlarge`** instead.
- A new key pair (download the `.pem`; keep it safe).
- Storage: **30 GB gp3**.
- Security group `nana-lite`: allow **SSH 22 from My IP only**, **HTTP 80** and **HTTPS 443 from anywhere** (80 is needed once, for
  the HTTPS certificate). Nothing else; the model's port 8080 is never opened.
- EC2 → **Elastic IPs → Allocate → Associate** with the instance, so its address never changes.

Check the price in the AWS pricing calculator for Cape Town (about USD 100 to 150 a month for `c7g.xlarge`).

**3. Both addresses.** Add the same record in each domain's DNS:
- `lite.notesapp.name.ng` → **A** → the Elastic IP
- `lite.naapp.tech` → **A** → the Elastic IP

If a domain's DNS is on Cloudflare, set these two records to **DNS only** (grey cloud) so Caddy can get its certificates; switch the
proxy on later if wanted. Both names serve the same Nana Lite.

**4. Log in and install Docker:**
```
ssh -i nana-lite.pem ubuntu@<elastic ip>
sudo apt update && sudo apt -y upgrade
sudo apt -y install docker.io
sudo usermod -aG docker ubuntu && exit
```
(log in again so the group applies)

**5. The model file:**
```
sudo mkdir -p /srv/models && cd /srv/models
sudo wget -O Phi-3.5-mini-instruct-Q4_K_M.gguf "<the Q4_K_M GGUF download link from the model's official Hugging Face page>"
```

**6. Run the model, private to the server** (only Caddy on the same machine can reach it):
```
openssl rand -hex 32        # the key; keep it for Vercel too
docker run -d --name nana-lite --restart unless-stopped -p 127.0.0.1:8080:8080 -v /srv/models:/models \
  ghcr.io/ggml-org/llama.cpp:server -m /models/Phi-3.5-mini-instruct-Q4_K_M.gguf \
  --host 0.0.0.0 --port 8080 -c 4096 --threads 4 --api-key <the key> --alias phi-3.5-mini-instruct
curl -s http://127.0.0.1:8080/health     # {"status":"ok"} once the model has loaded
```

**7. Caddy for HTTPS on both names:**
```
sudo apt -y install caddy
sudo tee /etc/caddy/Caddyfile > /dev/null <<'CADDY'
lite.notesapp.name.ng, lite.naapp.tech {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8080
	log {
		output file /var/log/caddy/nana-lite.log
		format filter {
			request>headers>Authorization delete
		}
	}
}
CADDY
sudo systemctl reload caddy
```
Caddy gets and renews a certificate for each name by itself. Its access log records only the request line and status, never the
body (what students type), and the filter drops the key.

**8. Check from your computer:**
```
curl -s https://lite.naapp.tech/v1/chat/completions -H "Authorization: Bearer <the key>" -H "Content-Type: application/json" \
  -d '{"model":"phi-3.5-mini-instruct","messages":[{"role":"user","content":"Say hello in Pidgin."}],"max_tokens":40}'
```
Do the same with `https://lite.notesapp.name.ng`.

**9. Connect NotesApp.** Vercel: `NANA_LITE_URL=https://lite.notesapp.name.ng` (or `https://lite.naapp.tech` once naapp.tech is the main
domain; either works), `NANA_LITE_MODEL=phi-3.5-mini-instruct`, `NANA_LITE_KEY=<the key>`; redeploy. Then `firebase deploy --only
firestore`, and run Phase 2.

**10. Keep it healthy.** `sudo apt -y install unattended-upgrades` for security updates; `docker logs nana-lite` if it misbehaves; to change model,
download the new file and re-run step 6 with its name (and update `NANA_LITE_MODEL`). Busy pilot later: a GPU instance (`g4dn.xlarge`,
about USD 380+ a month) answers much faster for many students at once.

## Phase 2: measure it (before the pilot, and for grant applications)

```
NANA_LITE_URL=https://notesapp-nana-lite.<subdomain>.workers.dev NANA_LITE_MODEL=phi-3.5-mini-instruct NANA_LITE_KEY=… FIREBASE_SERVICE_ACCOUNT_KEY='…' \
  npx -y tsx scripts/nana-lite-eval.ts --exam waec --limit 300 --out waec-phi35
```
Then the same with `NANA_LITE_MODEL=qwen2.5-1.5b-instruct --out waec-qwen15` and `NANA_LITE_MODEL=smollm2-1.7b-instruct --out
waec-smol17`, and compare the three reports.

It asks the model to solve published questions **without the answer** and writes `waec-phi35.md` (accuracy overall and by subject, how
often it didn't answer, the median time) and `.json` (every row). This is a hard test: in the app the model is given the answer and the
explanation, and only has to explain. Run it per model and keep the reports; quote them as they are.

**The pilot:** two or three schools or exam-prep centres for a term. Measure, from the daily totals only: practice sessions, Nana Lite
asks, and (with the school's consent and its own records) mock-exam scores before and after. Ask students and teachers what helped.

## Phase 3: on the phone, offline

Run Qwen2.5-1.5B (4-bit) in the browser with WebGPU (WebLLM) or in the Android app (MediaPipe LLM Inference / llama.cpp), using the
questions already saved on the phone for offline practice. The student's questions then never leave the phone. Only on devices that
can run it; others keep the server.

## Where else Nana Lite works

The same worker answers any OpenAI-compatible call, so other Nana features use it as a cheaper fallback. Each still prefers the
member's own AI, or our large models where the answer must be right.

- **Nana Jobs** (`lib/nana-jobs-server.ts`): when the member has no AI connected, Nana Lite scores their **top 10** openings, one per
  request (a small model handles one job at a time better than a batch). The run says "read by Nana Lite"; the CV review and cover notes
  still need the member's own AI. `LITE_JOBS_PER_RUN` in `lib/nana-jobs.ts`.
- **Business books, Tell Nana** (`lib/books-nana-server.ts`): drafts entries on Nana Lite first (JSON only, `temperature 0`), free and off
  the owner's allowance, 300 a day per shop. Pearl answers when Nana Lite's reply can't be read or finds nothing, when it's busy, or when
  the catalogue makes the prompt too long (over 9,000 characters). The seller checks every draft before saving, as always.
- **Main Nana chat** (`lib/nana-server.ts`): members can choose **Nana Lite** in the model picker (free, nothing from the allowance;
  if it's busy, the help centre answers, never a paid model). It also answers when Pearl can't for a member: the allowance and credit
  are used up, our daily cap is reached, or our AI is down. 60 answers a day per member; short answers from the help articles for that
  question only. Never for visitors or the team hub, and never put in the answer bank. `GET /api/nana/account` says `lite: true` when it
  can be chosen.
- Daily counts for all of these share the TTL'd `prepLiteDaily` collection, keyed by feature (`books_<uid>`, `nana_<uid>`); see
  `liteCount` in `lib/nana-lite-server.ts`.

## Limits and safety

- **40 asks a day** per account (or per device, by a hash of its address, when signed out), and 30 per 10 minutes at the API.
- **Short answers** (350 tokens at most), so they're fast and readable on a phone.
- **Only questions the student can already see:** published, and free or in a pack they have.
- **It can be wrong:** the page says so, and the teacher has the last word. "Report a problem" stays under every question.
- **No student content kept:** the worker never logs request bodies and has observability off; llama.cpp in the containers runs without
  a log file.

## Code

- `lib/nana-lite.ts`: models, prompts (explain and solve), parsing, evaluation summary.
- `lib/nana-lite-server.ts`: the call to our worker, the access check, the daily limit.
- `workers/nana-lite/`: the Cloudflare Worker (`src/index.ts`), its three model images (`Dockerfile.phi`, `.qwen`, `.smol`) and
  `wrangler.jsonc`; deployed by `.github/workflows/deploy-nana-lite.yml`.
- `app/api/exam-prep/lite/route.ts`: `GET` (on or off), `POST` (explain).
- `components/exam-prep/AskNanaLite.tsx`: the button and the follow-ups in practice.
- `scripts/nana-lite-eval.ts`: the evaluation.
- Tests: `npm run test:nana-lite`.
