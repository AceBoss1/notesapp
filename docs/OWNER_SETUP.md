# Owner set-up guide (things to do outside the code)

**For:** the founder. **Updated:** 5 November 2026. **Covers:** HANDOVER items 91 to 118 (live audio and video, recording and
replays, Media and watermarked video downloads, sign in with Google and LinkedIn, stage seats and moderators, gifting) and the
earlier owner steps still waiting (item 93's agent layer, teen mode, Business books, the TURN keys for calls).

This guide lists every step that has to be done by hand in a dashboard or a console, in the order to do them. Nothing here changes the
code. Every secret in this guide is a placeholder like `YOUR_…`: never paste a real key into a document, a chat or a screenshot.

The main address in the examples is **naapp.tech** (`NEXT_PUBLIC_ROOT_DOMAIN=naapp.tech` is set). Where a step needs both domain
families, **notesapp.name.ng** is named too.

All the code for these steps is now on `main`:

| Feature | HANDOVER item | Version | Where it is now |
|---|---|---|---|
| Audio rooms on the Cloudflare relay | 96 | v0.124.0 | On `main` |
| Calls: earpiece, speaker and Sound picker | 97 | v0.124.3 | On `main` |
| Pricing table without repeats | 101 | v0.124.2 | On `main` |
| Live mode (video, poster, Audio only) | 98 | v0.126.0 | On `main` |
| Live chat on a Cloudflare worker | 99 | v0.127.0 | On `main` |
| Live recording and replays | 100 | v0.128.0 | On `main` |

---

## Start here: live video and sign-in, step by step

Work down this list once, in this order. Each line says where to click and links to the detailed steps. **Nothing is switched on
until its settings are in Vercel and you have redeployed** (see B below), so you can stop between blocks and come back.

**What you need open:** dash.cloudflare.com (the NotesApp account), vercel.com (the NotesApp project), console.firebase.google.com and
console.cloud.google.com (project `notesapp-a1402`), github.com/AceBoss1/notesapp, linkedin.com/developers/apps, and a password
manager to keep every secret in.

### Block 1: sign in with Google and LinkedIn (about 20 minutes)

1. [ ] **Firebase → Authentication → Settings → Authorised domains**: add every address in [11.1](#111-firebase-google-already-on-and-the-authorised-domains) step 4 that is missing.
2. [ ] **Firebase → Authentication → Sign-in method → Google**: Enabled, with the public-facing name and support email set ([11.1](#111-firebase-google-already-on-and-the-authorised-domains) step 2).
3. [ ] **Firebase → Authentication → Settings → User account linking**: "Link accounts that use the same email" ([11.1](#111-firebase-google-already-on-and-the-authorised-domains) step 3).
4. [ ] **LinkedIn developer app → Products**: "Sign In with LinkedIn using OpenID Connect" added; **Auth** tab: scopes `openid`, `profile`, `email` and the two redirect URLs ([11.3](#113-linkedin-the-redirect-urls)).
5. [ ] **Vercel**: `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are there (they are if Publish to LinkedIn works). Optional: `NEXT_PUBLIC_FIREBASE_AUTH_ON_SITE` = `on` after doing [11.2](#112-optional-google-by-redirect-on-our-own-addresses-phones-and-in-app-browsers).
6. [ ] **Firestore rules**: `firebase deploy --only firestore` ([1.3](#13-deploy-the-rules-and-indexes)).
7. [ ] **Redeploy** Vercel (B), then do the five checks at the end of [11.5](#115-firestore).

### Block 2: storage and video (about 20 minutes)

8. [ ] **Cloudflare Stream** has storage to spare and its token is in Vercel: [5](#5-cloudflare-stream). This is what failed in the
   "We're at capacity" video upload: Stream refused the upload because the account's stored minutes were used up.
9. [ ] **The private R2 bucket** for recordings, paid downloads and message files is set: [5.6](#56-the-private-r2-bucket-recordings-paid-downloads-message-files).
9a. [ ] **Upload permission (CORS) on both R2 buckets** lists every address, naapp.tech included: [5.7](#57-upload-permission-cors-on-both-r2-buckets). Without it, picture and avatar uploads fail on that address.

### Block 3: live audio and video (about 1 hour 30 minutes)

10. [ ] **Cloudflare → Realtime → Serverless SFU**: create the app; App ID and App Token into Vercel ([2.1](#21-serverless-sfu-app-audio-rooms)).
11. [ ] **Cloudflare → Realtime → TURN Server**: create a key; both values into Vercel ([2.2](#22-turn-key-calls)). Redeploy, then check /status ([2.3](#23-how-to-check-it-worked)).
12. [ ] **Cloudflare → Workers & Pages**: Workers Paid, a workers.dev subdomain, the Account ID ([3.1](#31-workers-paid-plan), [3.2](#32-pick-a-workersdev-subdomain-first-time-only)).
13. [ ] **Cloudflare API token** from the "Edit Cloudflare Workers" template ([3.3](#33-api-token-for-github)), and a new `LIVE_ROOMS_SECRET` ([3.4](#34-make-the-shared-secret-live_rooms_secret)).
14. [ ] **GitHub → Settings → Secrets and variables → Actions**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `LIVE_ROOMS_SECRET` ([3.5](#35-github-repository-secrets)).
15. [ ] **GitHub → Actions → Deploy live rooms → Run workflow** on `main`; copy the worker's address ([3.6](#36-run-the-deploy-live-rooms-workflow)), open its `/health` ([3.8](#38-check-the-worker)).
16. [ ] **Vercel**: `LIVE_ROOMS_SECRET` and `NEXT_PUBLIC_LIVE_ROOMS_URL` (`wss://…`); redeploy; /status → Live room chat ([3.9](#39-vercel-settings), [3.10](#310-how-to-check-it-worked)).
17. [ ] **Test** an audio room, live video and calls on three phones ([10](#10-testing-checklist)).

### Block 4: recording and replays (after counsel, about 1 hour)

18. [ ] **Counsel** reviews the recording wording and privacy paragraph ([9](#9-legal-and-counsel-review)).
19. [ ] **Google Cloud Run** recorder: services, secret, deploy, then `RECORDER_URL` and `RECORDER_SECRET` in Vercel ([4](#4-google-cloud-run-room-recorder)).
20. [ ] **Test** recording and replay ([10](#10-testing-checklist)), and optionally transcripts ([8](#8-optional-replay-transcripts-with-nkenneai)).

### Every time a branch with rules is merged

- Run `firebase deploy --only firestore` again ([1.3](#13-deploy-the-rules-and-indexes)). Gifting everywhere (item 118), paid lives (item 119) and pay-per-minute (item 120) need it.
- The live-rooms worker redeploys **by itself** when a merge changes it (stage seats, item 117, does), once the GitHub secrets from
  step 14 exist. Check the run is green under **Actions → Deploy live rooms**.

### Every setting in this guide, in one table

| Where | Name | Secret | From | Section |
|---|---|---|---|---|
| Vercel | `CLOUDFLARE_REALTIME_APP_ID` | no | Cloudflare → Realtime → Serverless SFU | 2.1 |
| Vercel | `CLOUDFLARE_REALTIME_APP_TOKEN` | **yes** | same app (shown once) | 2.1 |
| Vercel | `CLOUDFLARE_TURN_KEY_ID` | no | Cloudflare → Realtime → TURN Server | 2.2 |
| Vercel | `CLOUDFLARE_TURN_API_TOKEN` | **yes** | same TURN key (shown once) | 2.2 |
| Vercel | `LIVE_ROOMS_SECRET` | **yes** | you make it (3.4) | 3.9 |
| Vercel | `NEXT_PUBLIC_LIVE_ROOMS_URL` | no | the worker's address, `wss://…workers.dev` | 3.9 |
| Vercel | `CLOUDFLARE_STREAM_TOKEN` | **yes** | Cloudflare API token with Stream: Edit | 5 |
| Vercel | `CLOUDFLARE_ACCOUNT_ID` | no | Cloudflare account id (only if Stream isn't on the R2 account) | 5 |
| Vercel | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `NEXT_PUBLIC_R2_PUBLIC_URL` | key id and secret: **yes** | Cloudflare → R2 (already set: uploads work) | 5.6 |
| Vercel | `R2_PRIVATE_BUCKET` | no | the private bucket's name | 5.6 |
| Vercel | `RECORDER_URL` | no | `gcloud run services describe …` | 4.5 |
| Vercel | `RECORDER_SECRET` | **yes** | Secret Manager (4.3) | 4.5 |
| Vercel | `REPLAY_TRANSCRIBE` | no | `nkenne-english` or `nkenne-swahili` (optional) | 8 |
| Vercel | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | secret: **yes** | LinkedIn app → Auth (already set for publishing) | 11.4 |
| Vercel | `LINKEDIN_LOGIN_CLIENT_ID`, `LINKEDIN_LOGIN_CLIENT_SECRET` | secret: **yes** | optional separate LinkedIn app | 11.4 |
| Vercel | `NEXT_PUBLIC_FIREBASE_AUTH_ON_SITE` | no | `on` (optional) | 11.2 |
| GitHub | `CLOUDFLARE_API_TOKEN` | yes | Cloudflare → API Tokens → Edit Cloudflare Workers | 3.5 |
| GitHub | `CLOUDFLARE_ACCOUNT_ID` | no | Workers & Pages → Overview | 3.5 |
| GitHub | `LIVE_ROOMS_SECRET` | yes | the same value as in Vercel | 3.5 |
| Secret Manager | `recorder-secret` | yes | 4.3 | 4.3 |
| Cloud Run | `APP_ORIGIN`, `MAX_RECORDINGS` | no | the deploy command | 4.4 |

---

## Order to do things

Tick each one off. Times are rough, for someone doing it the first time. Costs are from our own docs; anything marked
"estimate" must be checked on the provider's pricing page.

| # | Step | Section | Time | Cost |
|---|---|---|---|---|
| 1 | Deploy Firestore rules and indexes (once now, again after each pending branch is merged) | [1](#1-firebase-rules-indexes-and-ttl-policies) | 20 min (first time), 2 min after | Free |
| 2 | Add three Firestore TTL policies in Google Cloud | [1](#1-firebase-rules-indexes-and-ttl-policies) | 10 min | Free to set up |
| 3 | Add the cron-job.org job for Nana's agent jobs | [6](#6-cron-joborg-scheduled-jobs) | 10 min | Free |
| 4 | Add `mcp.` addresses to Firebase authorised domains (and to Vercel if missing) | [7](#7-firebase-authentication-authorised-domains) | 10 min | Free |
| 5 | Cloudflare Realtime: Serverless SFU app and TURN key into Vercel, redeploy | [2](#2-cloudflare-realtime-audio-room-relay-and-call-relay) | 20 min | First 1,000 GB a month free, then pay per GB |
| 6 | Cloudflare Stream: token, storage plan with room to spare, private R2 bucket (courses, replays, Media videos, downloads) | [5](#5-cloudflare-stream) | 15 min | Per minute stored and watched |
| 7 | Run the first test: audio room on the relay, and calls on two phones | [10](#10-testing-checklist) | 30 min | Free |
| 8 | Live rooms worker: Workers Paid, API token, GitHub secrets, run the workflow, Vercel settings | [3](#3-cloudflare-workers-live-rooms-chat-for-big-rooms) | 45 min | $5 a month, plus use |
| 9 | Counsel review of the recording wording and privacy paragraph | [9](#9-legal-and-counsel-review) | Counsel's time | Counsel's fee |
| 10 | **(after 9)** Room recorder on Google Cloud Run, then Vercel settings | [4](#4-google-cloud-run-room-recorder) | 60 min | Pay while recording (estimate below); can use Google credits |
| 11 | Optional: replay transcripts with NKENNEAi | [8](#8-optional-replay-transcripts-with-nkenneai) | 5 min | NKENNEAi usage |
| 12 | Full testing checklist and /status check | [10](#10-testing-checklist) | 60 min | Free |
| 13 | Sign in with Google and LinkedIn: authorised domains, the LinkedIn redirect URLs, deploy the rules | [11](#11-sign-in-with-google-and-linkedin) | 20 min | Free |

---

## Before you start: two things you will use again and again

### A. Adding a setting in Vercel

1. Go to **vercel.com** and sign in.
2. Open the **NotesApp project** → **Settings** → **Environment Variables**.
3. Click **Add New** (or **Add Environment Variable**).
4. **Key:** the exact name from this guide, for example `CLOUDFLARE_REALTIME_APP_ID`. Capital letters and underscores, no spaces.
5. **Value:** paste the value. Check there is no space or line break at the start or end.
6. **Environments:** tick **Production** only (unless this guide says otherwise).
7. If this guide says **Sensitive**, switch **Sensitive** on. A Sensitive value can't be read again in Vercel, so keep a copy in your
   password manager.
8. Click **Save**.

### B. Redeploying so the new settings take effect

Settings only reach the live site in a new deployment. Settings that start with `NEXT_PUBLIC_` are built into the pages, so they
need a full new build.

1. Vercel → the project → **Deployments**.
2. Find the top deployment marked **Production** (and **Current**).
3. Click the **⋯** menu on its row → **Redeploy** → **Redeploy** again to confirm.
4. Wait until it says **Ready** (usually a few minutes).

You can add several settings and redeploy once at the end.

### C. The status page

Open **https://www.naapp.tech/status**. Each row shows one of: **Operational** (green), **Slow** (amber), **Down** (red) or
**Not enabled yet** (grey). The rows used in this guide:

| Row on /status | What it checks | What you want to see |
|---|---|---|
| **Calls and audio rooms** | The TURN relay for calls | Operational, text ends "(relay ready)" |
| **Audio rooms relay** | The Cloudflare Realtime SFU app | Operational, text ends "(relay ready)" |
| **Live room chat** | The live rooms worker | Operational, text ends "(worker ready)" |
| **Video courses** | Cloudflare Stream | Operational |
| **Digital downloads** | The private R2 bucket (recordings are kept there) | Operational |
| **Scheduled jobs** | That cron-job.org is calling the reminders job | Operational |

The recorder has no row on /status. You check it with its own `/health` address (section 4).

---

## 1. Firebase: rules, indexes and TTL policies

One command publishes **all** waiting rules and indexes at once. It covers teen mode on Moments and Notes Life (item 91), Business
books, the agent layer (item 93), the audio rooms relay (item 96), Live mode (98) and recording and replays (100), and, once they are merged, Media and animated gifts.
Item 99 (the worker) has no rules of its own.

**Important:** the command publishes what is on `main` at that moment. Run it now, and **run it again after each pending branch is
merged**. Running it twice is safe.

The Firebase project is **`notesapp-a1402`**.

### 1.1 The easiest place to run it: Google Cloud Shell

Cloud Shell is a free terminal in your browser with Node, git and gcloud already installed. You don't need to install anything on
your computer.

1. Go to **console.cloud.google.com** and sign in with the Google account that owns the Firebase project.
2. At the top, pick the project **notesapp-a1402**.
3. Click the **Activate Cloud Shell** icon (a `>_` square, top right). A terminal opens at the bottom.
4. Get the code (the repository is private, so GitHub will ask you to sign in; use a GitHub personal access token as the password, or
   run `gh auth login` first if it's available):

   ```sh
   git clone https://github.com/AceBoss1/notesapp.git
   cd notesapp
   git checkout main && git pull
   ```

5. Install the Firebase command-line tool and sign in:

   ```sh
   npm install -g firebase-tools
   firebase login --no-localhost
   ```

   It prints a link. Open it, sign in with the same Google account, copy the code it shows, and paste it back into Cloud Shell.

6. Choose the project:

   ```sh
   firebase use notesapp-a1402
   ```

### 1.2 On your own computer instead

1. Install **Node.js** (the LTS version) from nodejs.org.
2. Open a terminal (on Windows, Git Bash or PowerShell).
3. Run `npm install -g firebase-tools`, then `firebase login` (a browser window opens; sign in).
4. Get the code as in 1.1 step 4, then `firebase use notesapp-a1402`.

### 1.3 Deploy the rules and indexes

From the `notesapp` folder:

```sh
git pull
firebase deploy --only firestore
```

- If it asks whether to **delete** indexes or field overrides that aren't in the file (for example for `adSeen` or `seen`), answer
  **N** (no).
- New indexes take a few minutes to build. You can watch them in Firebase console → Firestore Database → **Indexes** (they go from
  "Building" to "Enabled").
- This also creates the TTL policies that are already listed in the code (`agentActions.expireAt`, `nanaBank.expireAt`,
  `errorLogs`, `webhookDeliveries`, `apiIdempotency`, `videoUploads`, `adSeen`, `seen`).

**How to check it worked:** the command ends with **"Deploy complete!"**. In Firebase console → Firestore Database → **Rules**, the
"last published" time is now.

### 1.4 The three TTL policies you add by hand

These tell Firestore to delete old records by themselves. Three are not in the code's list yet, so add them in the console (from
item 93):

| Collection group | Timestamp field |
|---|---|
| `agentProposals` | `purgeAt` |
| `agentUsage` | `expireAt` |
| `agentEvents` | `expireAt` |

Clicks:

1. Go to **console.cloud.google.com**, project **notesapp-a1402**.
2. Menu (☰) → **Firestore** → choose the **(default)** database.
3. In the left menu, click **Time-to-live (TTL)**.
4. Click **Create policy**.
5. **Collection group:** `agentProposals`. **Timestamp field:** `purgeAt`. Click **Create**.
6. Repeat for `agentUsage` / `expireAt` and `agentEvents` / `expireAt`.

Or in Cloud Shell, one line each:

```sh
gcloud firestore fields ttls update purgeAt  --collection-group=agentProposals --enable-ttl --database='(default)' --project=notesapp-a1402
gcloud firestore fields ttls update expireAt --collection-group=agentUsage     --enable-ttl --database='(default)' --project=notesapp-a1402
gcloud firestore fields ttls update expireAt --collection-group=agentEvents    --enable-ttl --database='(default)' --project=notesapp-a1402
```

**How to check it worked:** the TTL page lists all three with state **Serving** (it can show "Creating" for a while first). Records
are removed within about a day after their date.

---

## 2. Cloudflare Realtime: audio room relay and call relay

This turns on two things:

- **Audio rooms for hundreds of listeners** (item 96). Without it every room runs phone to phone, with 20 listeners at most.
- **The TURN relay for calls.** Without it, calls on some mobile networks can't connect.

Both are in the same place in Cloudflare.

### 2.1 Serverless SFU app (audio rooms)

1. Go to **dash.cloudflare.com** and sign in to the NotesApp account.
2. In the left menu, open **Realtime** → **Serverless SFU**.
3. Click **Create application**. Name it, for example, `notesapp-audio-rooms`. Click **Create**.
4. You now see two values:
   - **App ID** (not secret).
   - **App Token** (secret). **It is shown only once:** copy it into your password manager straight away.
5. In Vercel (see A), add:

   | Key | Value | Sensitive |
   |---|---|---|
   | `CLOUDFLARE_REALTIME_APP_ID` | `YOUR_APP_ID` | no |
   | `CLOUDFLARE_REALTIME_APP_TOKEN` | `YOUR_APP_TOKEN` | **yes** |

### 2.2 TURN key (calls)

1. Still in Cloudflare → **Realtime** → **TURN Server**.
2. Click **Create** (or **Create TURN key**). Give it a name, for example `notesapp-calls`.
3. You see a **Turn Token ID** and an **API Token**. Copy both. The API token is secret.
4. In Vercel, add:

   | Key | Value | Sensitive |
   |---|---|---|
   | `CLOUDFLARE_TURN_KEY_ID` | `YOUR_TURN_TOKEN_ID` | no |
   | `CLOUDFLARE_TURN_API_TOKEN` | `YOUR_TURN_API_TOKEN` | **yes** |

5. **Redeploy** (see B).
6. Make sure the rules are deployed (section 1): the relay needs them.

### 2.3 How to check it worked

1. Open **/status**:
   - **Calls and audio rooms**: Operational, "(relay ready)".
   - **Audio rooms relay**: Operational, "(relay ready)". This check opens a free test session with Cloudflare.
2. Admin → **Limits** → **Audio rooms**: "Use the Cloudflare relay" is on (it is on by default). Listeners per room with the relay is
   500 by default.
3. Start a test room in a community. The room line says **"through the relay"**.
4. The Team hub reminder "Audio rooms past 20 listeners" disappears once both keys are set.

---

## 3. Cloudflare Workers: live rooms chat for big rooms

**(Item 99, on `main`.)** Needs section 2 done first.

In a relay room, every chat message is read by everyone in the room through Firestore. With thousands of listeners that gets
expensive. This moves the chat, the listener count and raised hands onto a small Cloudflare program (a "worker"). Until it is set
up, rooms keep using Firestore exactly as before.

### 3.1 Workers Paid plan

1. dash.cloudflare.com → **Workers & Pages** → **Plans** (or **Overview** → **Upgrade**).
2. Choose **Workers Paid** ($5 a month) and confirm with the company card.

### 3.2 Pick a workers.dev subdomain (first time only)

1. **Workers & Pages** → **Overview**. If Cloudflare asks you to choose a **workers.dev subdomain**, choose one, for example
   `notesapp`. The worker's address will then be `notesapp-live-rooms.YOUR-SUBDOMAIN.workers.dev`.
2. On the same page, note the **Account ID** (right-hand side). It is not secret.

### 3.3 API token for GitHub

1. Click your profile icon (top right) → **My Profile** → **API Tokens**.
2. Click **Create Token**.
3. Next to the template **Edit Cloudflare Workers**, click **Use template**.
4. Under **Account Resources**, choose **Include** → **your NotesApp account** (only that one).
5. Under **Zone Resources**, choose **Include** → **All zones from an account** → your account (or leave the template's choice).
6. Click **Continue to summary** → **Create Token**.
7. Copy the token (shown once) into your password manager.

### 3.4 Make the shared secret `LIVE_ROOMS_SECRET`

The site and the worker share one secret. Make it once and keep it in your password manager.

- **With Node** (Cloud Shell or your computer):

  ```sh
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```

- **Without Node** (Cloud Shell, Mac or Git Bash all have `openssl`):

  ```sh
  openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n'; echo
  ```

- **Without any terminal:** use your password manager's generator for a random password of 43 or more characters, letters and
  numbers only (no spaces).

### 3.5 GitHub repository secrets

1. Go to **github.com/AceBoss1/notesapp** → **Settings** → **Secrets and variables** → **Actions**.
2. Under **Repository secrets**, click **New repository secret** for each:

   | Name | Value |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | the token from 3.3 |
   | `CLOUDFLARE_ACCOUNT_ID` | the Account ID from 3.2 |
   | `LIVE_ROOMS_SECRET` | the secret from 3.4 (recommended: the workflow then sets it on the worker for you) |

### 3.6 Run the "Deploy live rooms" workflow

1. On GitHub, open the **Actions** tab.
2. In the left list, click **Deploy live rooms**.
3. Click **Run workflow** → branch **main** → **Run workflow**.
4. Wait for the green tick (a few minutes). Open the run → the **Deploy** step: it prints the worker's address,
   `https://notesapp-live-rooms.YOUR-SUBDOMAIN.workers.dev`. Copy it.

If the run is green but says **"Live rooms not deployed"**, one of the two Cloudflare secrets is missing or misspelt.

### 3.7 Only if you did not add `LIVE_ROOMS_SECRET` to GitHub: `wrangler secret put`

In Cloud Shell, from the `notesapp` folder (Cloud Shell can't do the browser sign-in, so give the token instead):

```sh
cd workers/live-rooms
export CLOUDFLARE_API_TOKEN=YOUR_CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID
npx wrangler@4.40.0 secret put LIVE_ROOMS_SECRET
```

Paste the secret from 3.4 when it asks, then press Enter.

### 3.8 Check the worker

Open `https://notesapp-live-rooms.YOUR-SUBDOMAIN.workers.dev/health` in a browser. It should say **`ok`**.

### 3.9 Vercel settings

In Vercel (see A), add:

| Key | Value | Sensitive |
|---|---|---|
| `LIVE_ROOMS_SECRET` | the same secret as 3.4 | **yes** |
| `NEXT_PUBLIC_LIVE_ROOMS_URL` | `wss://notesapp-live-rooms.YOUR-SUBDOMAIN.workers.dev` | no |

Note the address starts with **`wss://`**, not `https://`. Then **redeploy** (see B).

### 3.10 How to check it worked

1. **/status** → **Live room chat**: Operational, "(worker ready)". This proves the site reaches the worker and both secrets match.
2. Start a test relay room. The host sees **"Slow mode (automatic: off)"** under the chat, and the help shows the "Chat in big rooms"
   paragraph.
3. Later changes to the worker deploy by themselves when they are merged into `main` (stage seats and moderators, item 117, is one).
   After such a merge, **Actions → Deploy live rooms** shows a new run: check it is green. If it isn't, run it by hand (3.6).

---

## 4. Google Cloud Run: room recorder

**(Item 100, on `main`; after counsel's review in section 9.)** Needs sections 2 and 5 done.

The recorder is a small service that joins a live room as a silent listener and records it. Until it is set up, the **Record this
live** switch is hidden from hosts and nothing is recorded. The full technical notes are in `docs/RECORDER.md`.

### 4.1 Credits first

If you have **Google for Startups Cloud Program** credits (or other Google Cloud credits), make sure they sit on the **billing
account** linked to the project you use. Google Cloud console → **Billing** → **Credits** shows them. Cloud Run, Cloud Build,
Artifact Registry and Secret Manager can all be paid from credits.

Use the project **notesapp-a1402** if its billing account holds the credits, or create a separate project for the recorder.

### 4.2 Turn on the services

1. console.cloud.google.com → pick the project → open **Cloud Shell** (see 1.1).
2. Choose the project and a region. `docs/RECORDER.md` suggests **africa-south1** (Johannesburg). **europe-west1** (Belgium) is a
   common choice for Lagos too and is often cheaper. The recorder talks to Cloudflare and Vercel, not to members, so either works.
   Check the Cloud Run price for the region before you choose.

   ```sh
   gcloud config set project YOUR_PROJECT_ID
   gcloud config set run/region europe-west1
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
   ```

### 4.3 The secret, kept in Secret Manager

```sh
RECORDER_SECRET_VALUE=$(openssl rand -hex 32)
printf '%s' "$RECORDER_SECRET_VALUE" | gcloud secrets create recorder-secret --data-file=-
echo "$RECORDER_SECRET_VALUE"
```

Copy what the last line prints into your password manager. You will paste the same value into Vercel.

Let Cloud Run read the secret (Cloud Run uses the project's default compute service account):

```sh
PROJECT_NUMBER=$(gcloud projects describe "$(gcloud config get-value project)" --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding recorder-secret \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
```

### 4.4 Build and deploy

From the `notesapp` folder in Cloud Shell, on an up-to-date `main` (`git pull`):

```sh
gcloud run deploy room-recorder \
  --source services/room-recorder \
  --allow-unauthenticated \
  --set-secrets RECORDER_SECRET=recorder-secret:latest \
  --set-env-vars APP_ORIGIN=https://www.naapp.tech,MAX_RECORDINGS=3 \
  --cpu 2 --memory 2Gi \
  --no-cpu-throttling \
  --min-instances 0 --max-instances 3 \
  --concurrency 10 \
  --timeout 3600
```

If it asks to create an Artifact Registry repository, answer **Y**. The first build takes 5 to 10 minutes.

What the important parts mean:

- `--allow-unauthenticated`: the site calls it over the internet. Every request is still checked against the secret.
- `--no-cpu-throttling`: **required.** A recording runs long after the first request; without it Cloud Run freezes the recorder.
- `--memory 2Gi` and `--cpu 2`: each recording is a headless browser tab.
- `APP_ORIGIN`: the site's main address. The recorder refuses any other address.
- `--min-instances 0`: costs nothing while nobody records, but the first recording after a quiet spell starts 5 to 15 seconds late.
  **Before a big scheduled live**, set it to 1, and back to 0 afterwards:

  ```sh
  gcloud run services update room-recorder --min-instances 1
  gcloud run services update room-recorder --min-instances 0
  ```

- `MAX_RECORDINGS=3` with `--max-instances 3`: up to nine lives recorded at once.
- Deploy a new version only when nobody is recording.

### 4.5 Vercel settings

1. Get the service address:

   ```sh
   gcloud run services describe room-recorder --format='value(status.url)'
   ```

2. In Vercel (see A), add:

   | Key | Value | Sensitive |
   |---|---|---|
   | `RECORDER_URL` | the address from step 1 (`https://room-recorder-….run.app`) | no |
   | `RECORDER_SECRET` | the same value as in 4.3 | **yes** |

3. Check these are already set: `R2_PRIVATE_BUCKET` (recordings are kept there) and `CLOUDFLARE_STREAM_TOKEN` (section 5).
4. **Redeploy** (see B).
5. Deploy the Firestore rules again (section 1.3): recording adds rules for `roomRecordings` and `replays`.

### 4.6 How to check it worked

1. Open `RECORDER_URL/health` in a browser (the address from 4.5 with `/health` on the end). It should show
   `{"ok":true,"recording":0}`.
2. Start a relay room: the host now sees **Record this live**.
3. Do the recording test in section 10.
4. Logs, if something goes wrong: `gcloud run services logs read room-recorder`.

### 4.7 Settings to look at

Admin → **Limits** → **Live recording**: days to keep (30), longest recording (4 hours), record every relay room (off). In the limits
table under **Audio rooms and live**: who can record and who can publish replays (every plan by default).

---

## 5. Cloudflare Stream

Stream plays course videos, live replays (item 100) and Media videos (item 102), and makes the watermarked copies for video downloads
(item 104). It is paid by **minutes stored** and **minutes watched**: when the stored minutes you have paid for are used up, Stream
refuses new uploads. That is what members saw as "We're at capacity" before v0.136.1; they now see "our video storage is full", and
the error is in **Admin → Errors**.

### 5.1 The token

1. Vercel → **Settings** → **Environment Variables**: check **`CLOUDFLARE_STREAM_TOKEN`** exists (Sensitive).
2. If it is missing: dash.cloudflare.com → profile icon → **My Profile** → **API Tokens** → **Create Token** → **Create Custom
   Token** → name `notesapp-stream` → **Permissions**: **Account** → **Stream** → **Edit** → **Account Resources**: Include → the
   NotesApp account → **Continue to summary** → **Create Token**. Copy it (shown once) into your password manager, put it in Vercel
   as `CLOUDFLARE_STREAM_TOKEN` (Sensitive), and redeploy.

### 5.2 The account id

Stream uses **`CLOUDFLARE_ACCOUNT_ID`** if it is set, otherwise **`R2_ACCOUNT_ID`**. One of them must be the Cloudflare account that
has Stream (the Account ID on the right of dash.cloudflare.com → **Workers & Pages** → **Overview**, or on the R2 page).

### 5.3 The plan: stored minutes

1. dash.cloudflare.com → **Stream** (left menu; under **Media** in newer menus).
2. If it offers **Purchase Stream** or **Get started**, Stream isn't subscribed yet: buy it. If it is, the page shows **minutes
   stored** against the minutes you have.
3. To add room: **Manage Account** → **Billing** → **Subscriptions** → **Stream** → **Change** (or the **Upgrade** / **Add minutes**
   button on the Stream page), and pick a larger block of stored minutes.
4. Leave room for growth: every Media video and course lesson counts its full length, each **published** replay counts, and every video
   with downloads switched on counts **twice** (the watermarked copy is a second video).
5. Cloudflare's price is per 1,000 minutes stored and per 1,000 minutes delivered (estimate, verify on Cloudflare's Stream pricing
   page before budgeting).

### 5.4 Settings in Admin

- **Admin → Stream** → **Test connection**: says "Connected. N video(s), M minutes stored." Compare M with your plan.
- **Admin → Limits → Media**: videos a week, longest video, storage per member. These protect the Stream plan.
- **Admin → Limits → Video download watermark**: how see-through (never solid), how big and which corner. The mark is transparent,
  with @username and NotesApp.

### 5.5 How to check it worked

1. /status → **Video courses**: Operational.
2. Admin → Stream → **Test connection**: "Connected".
3. Post a short video in the **Media studio** (`/profile/media`): it reaches "Ready". Switch **Allow watermarked downloads** on: after a few minutes the download
   button gives an MP4 with the transparent mark in the corner.

### 5.6 The private R2 bucket (recordings, paid downloads, message files)

1. Vercel → **Environment Variables**: check `R2_PRIVATE_BUCKET` is set (a bucket name). If it is, skip to step 5.
2. dash.cloudflare.com → **R2 Object Storage** → **Create bucket** → name `notesapp-private` → location **Automatic** → **Create**.
   Do **not** connect a public domain or switch on public access: this bucket is private.
3. **R2** → **Manage R2 API Tokens** (or **API** → **Manage API tokens**): open the token whose key id is `R2_ACCESS_KEY_ID` in
   Vercel. It must have **Object Read & Write** on **both** buckets (the public media one and the private one). If it is limited to
   the media bucket, add the private bucket, or make a new token with both and replace `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`
   in Vercel (both Sensitive).
4. Vercel: add `R2_PRIVATE_BUCKET` = `notesapp-private` (not Sensitive).
5. Redeploy. /status → **Digital downloads**: Operational.

### 5.7 Upload permission (CORS) on both R2 buckets

The browser uploads pictures, avatars, files and recordings straight to R2. R2 only accepts them from the addresses in the bucket's
**CORS policy**, so every address the site is served on must be listed. The full list is kept in the repository as
`scripts/r2-cors.json` (both domains with their www., app., life., prep. and mcp. addresses, plus notesapp.ng).

1. On GitHub, open `scripts/r2-cors.json` on `main` and click **Copy raw file** (the copy icon above the file).
2. dash.cloudflare.com → **R2 Object Storage** → `notesapp-media` → **Settings** → **CORS policy** → **Edit** (or **Add CORS policy**).
3. Select everything in the box, paste the copied file over it, **Save**.
4. Do the same on the private bucket (the name in `R2_PRIVATE_BUCKET`).
5. No redeploy is needed: it works at once.

**How to check it worked:** on `https://www.naapp.tech/profile/edit`, change your profile picture. It saves, and the browser console
shows no "blocked by CORS policy" error. Paste the file again whenever it changes (a new domain or subdomain).

---

## 6. cron-job.org: scheduled jobs

cron-job.org calls our scheduled jobs. Every job sends the header `Authorization: Bearer YOUR_CRON_SECRET`, where `YOUR_CRON_SECRET`
is the same value as `CRON_SECRET` in Vercel.

| Job | Address | How often | Status |
|---|---|---|---|
| Reminders and clean-up | `https://www.naapp.tech/api/cron/reminders` | Every 15 minutes | Should already exist: check it uses the new address |
| Status check | `https://www.naapp.tech/api/status` | Every 5 minutes (no header needed) | Should already exist |
| **Nana's agent jobs (new, item 93)** | `https://www.naapp.tech/api/cron/agents` | **Every 15 minutes** | **Add it** |

The reminders job also deletes old unpublished recordings and makes queued replay transcripts (item 100). Nothing
else needs adding for that.

Adding the agents job:

1. Go to **console.cron-job.org** and sign in.
2. Click **Create cronjob**.
3. **Title:** `NotesApp agents`. **URL:** `https://www.naapp.tech/api/cron/agents`.
4. **Execution schedule:** **Every 15 minutes**.
5. Open the **Advanced** tab:
   - **Request method:** `GET`.
   - **Headers** → **Add**: Key `Authorization`, Value `Bearer YOUR_CRON_SECRET` (the word Bearer, one space, then the secret).
   - **Timeout:** the longest it allows (the job may take up to 60 seconds).
6. Click **Create** (or **Save**).
7. Open the job and click **Test run** (or wait 15 minutes and look at **History**).

`vercel.json` also runs this job once a day at 06:05 UTC through Vercel Cron. That is a back-up, not a replacement.

**How to check it worked:** the job's history shows **200 OK**. A **401 Unauthorized** means the header is wrong (see
Troubleshooting). For the reminders job, /status → **Scheduled jobs** is Operational.

---

## 7. Firebase Authentication: authorised domains

Members sign in on the **Connect NotesApp** screen at `mcp.` addresses (item 93). Firebase only allows sign-in on listed addresses.

1. **console.firebase.google.com** → project **notesapp-a1402**.
2. **Authentication** → **Settings** tab → **Authorised domains**.
3. Click **Add domain** for each one that is missing:
   - `mcp.naapp.tech`
   - `mcp.notesapp.name.ng`
   - and, if not there yet from the domain move: `naapp.tech`, `www.naapp.tech`, `app.naapp.tech`, `life.naapp.tech`.
4. Keep every existing `notesapp.name.ng` entry.

The `mcp.` addresses must also reach the site:

1. Vercel → the project → **Settings** → **Domains**.
2. If `mcp.naapp.tech` or `mcp.notesapp.name.ng` is missing, click **Add**, type it, and set the DNS record Vercel shows (a CNAME
   to `cname.vercel-dns.com`) at the domain's DNS provider.

**How to check it worked:** open `https://mcp.naapp.tech` in a private window and sign in on the Connect screen. It should not say
the domain is unauthorised.

---

## 8. Optional: replay transcripts with NKENNEAi

**(Item 100.)** Transcripts let Share to Journal add a transcript and Nana's summary to the draft.

1. Check `NKENNE_API_KEY` is set in Vercel (it already is if the Kiswahili buttons show).
2. In Vercel, add `REPLAY_TRANSCRIBE` (not Sensitive) with one of:
   - `nkenne-english`
   - `nkenne-swahili`
3. Redeploy.

Limits to know: NKENNEAi takes one file of up to 25 MB, so only recordings under about an hour and a half get a transcript. Whether
NKENNEAi accepts our recording format (WebM/Opus) has **not been checked**: try it with one real replay. Without this setting,
transcripts are simply off.

---

## 9. Legal and counsel review

Please have counsel check these **before** switching recording on (sections 4 and 8). This is a list for counsel, not legal advice.

1. **The recording notice:** the words "This live is being recorded" shown to everyone in a recorded room.
2. **The speaker's agreement:** the one-tap agreement a speaker gives before their microphone (and camera) is recorded.
3. **The help article** `live-recording-and-replays` (what we record, who sees it, how long we keep it, how to ask for removal).
4. **The new privacy paragraph** on recordings and replays. It was added **without** raising `LEGAL_VERSION`, so members were not
   asked to accept again. If counsel says the change is material, we raise it and members accept again.
5. **NDPA 2023 (Nigeria Data Protection Act):** the lawful basis for recording, the 30-day keep period for unpublished recordings,
   members' rights (access, deletion), and transfers outside Nigeria (the recorder runs on Google Cloud in the region chosen in
   section 4; files are kept on Cloudflare R2 and Stream; transcripts go to NKENNEAi).
6. **Teen mode:** a host or speaker in teen mode keeps the replay inside the community and off every list. Counsel should confirm
   that is enough for under-18s.
7. **Safety review:** staff can play any recording in Admin → **Live recordings** for Trust & safety and Legal. The privacy notice
   should say so.

---

## 10. Testing checklist

Do this after each part is set up. You need **three phones** (ideally one iPhone and one Android among them) and a computer.

### Audio room on the relay (after section 2)

- [ ] /status → **Audio rooms relay**: Operational, "(relay ready)".
- [ ] Phone 1 starts a room in a community. The room line says **"through the relay"**.
- [ ] Phones 2 and 3 join as listeners. Both hear the host clearly.
- [ ] Phone 1 brings phone 2 up as a speaker. Phone 3 hears both.
- [ ] Phone 3 sees the listener count and opens **People here**.
- [ ] Send a few chat messages from each phone.
- [ ] End the room. Everyone leaves cleanly.

### Live mode (after section 2)

- [ ] The host turns **video** on. Listeners see it. Turn it off again.
- [ ] Tick **Speakers can turn video on**; the speaker turns their camera on and off.
- [ ] A listener switches **Audio only** on: video stops for them, sound continues.
- [ ] Set a **poster** before going live. It shows while every camera is off.

### Live chat on the worker (after section 3)

- [ ] /status → **Live room chat**: Operational, "(worker ready)".
- [ ] In a new relay room the host sees **"Slow mode (automatic: off)"** under the chat.
- [ ] Chat from three phones arrives on all three at once. The count updates. Raise a hand from a listener; the host sees it.
- [ ] The host removes a message: it disappears for everyone.

### Recording and replay (after section 4)

- [ ] Start a relay room with **Record this live** on. Everyone sees the recording notice.
- [ ] Bring a speaker up: they are asked to agree first.
- [ ] Talk for a minute (with and without the camera), then end the room.
- [ ] **My account → Media → Recordings**: the recording is **Ready** and **Play** works.
- [ ] **Publish** a replay. Open it from **Explore → Replays**.
- [ ] Tap **Share to Journal**: a draft opens (with a transcript and summary only if section 8 is on).
- [ ] **Unpublish** the replay: it disappears from Explore.

### Calls (after section 2; item 97 is already live)

- [ ] /status → **Calls and audio rooms**: Operational, "(relay ready)".
- [ ] **iPhone to Android voice call**, no headphones: both hear the other through the **earpiece** (phone at the ear), not the
      loudspeaker.
- [ ] In the same call, tap **Sound** → **Speaker**: sound moves to the loudspeaker. Back to earpiece.
- [ ] Plug in or connect headphones: sound moves to them.
- [ ] **Video call**: sound plays on the **speaker** by default, and only once (no echo of the same voice).
- [ ] Try one call on mobile data, not Wi-Fi.

Known limits (not faults): on iPhone, AirPods and Bluetooth are chosen in Control Centre; iPads have no earpiece; on Android only
Chrome can choose the route.

### What /status should say at the end

| Row | State |
|---|---|
| Calls and audio rooms | Operational (relay ready) |
| Audio rooms relay | Operational (relay ready) |
| Live room chat | Operational (worker ready) |
| Video courses | Operational |
| Digital downloads | Operational |
| Scheduled jobs | Operational |

---

## 11. Sign in with Google and LinkedIn

**(Item 115, v0.138.0.)** "Continue with Google" and "Continue with LinkedIn" on sign-in and sign-up, and Account settings →
Sign-in methods to link and unlink them. Google is Firebase's own provider (already switched on); LinkedIn is our own OpenID Connect
flow through the LinkedIn app we already use for publishing.

### 11.1 Firebase: Google (already on) and the authorised domains

1. **console.firebase.google.com** → project **notesapp-a1402** → **Authentication** → **Sign-in method**.
2. **Google** shows **Enabled**. Click it and check the **Public-facing name** (people see it on Google's account chooser; use
   `#NotesApp` or `NotesApp`) and the **Project support email**. Save.
3. Still in **Authentication** → **Settings** tab → **User account linking**: keep **Link accounts that use the same email**
   (one account per email). Our code relies on it: it stops Google making a second account for an email that already has one.
4. **Settings** tab → **Authorised domains**. Google sign-in only works on listed addresses. Make sure every address the app is served
   on is there (click **Add domain** for any that are missing):
   - `notesapp.name.ng`, `www.notesapp.name.ng`, `app.notesapp.name.ng`, `life.notesapp.name.ng`, `prep.notesapp.name.ng`, `mcp.notesapp.name.ng`
   - `naapp.tech`, `www.naapp.tech`, `app.naapp.tech`, `life.naapp.tech`, `prep.naapp.tech`, `mcp.naapp.tech`
   - `notesapp.ng`, `www.notesapp.ng` (the short app address)
   - `localhost` (there by default) and the Firebase ones (`notesapp-a1402.firebaseapp.com`, `notesapp-a1402.web.app`): leave them.
5. Optional, for a nicer Google screen: **console.cloud.google.com** → project **notesapp-a1402** → **APIs & Services** →
   **OAuth consent screen** (or **Google Auth Platform → Branding**): app name `#NotesApp`, the logo, support email, and under
   **Authorised domains** `notesapp.name.ng`, `naapp.tech` and `notesapp.ng`, plus the privacy and terms links
   (`https://www.naapp.tech/privacy`, `https://www.naapp.tech/terms`).

**How to check it worked:** on `https://www.naapp.tech/login` and `https://app.naapp.tech`, tap **Continue with Google**: a Google
window opens and doesn't say "unauthorised domain".

### 11.2 Optional: Google by redirect on our own addresses (phones and in-app browsers)

Google opens in a pop-up. In in-app browsers (Instagram, Facebook, LinkedIn, X) and where pop-ups are blocked it goes by redirect
instead, and Safari and in-app browsers can't always finish a redirect through `notesapp-a1402.firebaseapp.com`. This makes the
redirect go through our own addresses (`/__/auth`, already proxied by the site):

1. **console.cloud.google.com** → **APIs & Services** → **Credentials** → the OAuth client **Web client (auto created by Google
   Service)** → **Authorised redirect URIs** → **Add URI** for each address below, then **Save**:
   - `https://www.notesapp.name.ng/__/auth/handler`, `https://app.notesapp.name.ng/__/auth/handler`, `https://life.notesapp.name.ng/__/auth/handler`, `https://prep.notesapp.name.ng/__/auth/handler`
   - `https://www.naapp.tech/__/auth/handler`, `https://app.naapp.tech/__/auth/handler`, `https://life.naapp.tech/__/auth/handler`, `https://prep.naapp.tech/__/auth/handler`
   - `https://notesapp.ng/__/auth/handler`, `https://www.notesapp.ng/__/auth/handler`
   - Keep `https://notesapp-a1402.firebaseapp.com/__/auth/handler`.
2. Vercel → **Settings** → **Environment Variables** → add `NEXT_PUBLIC_FIREBASE_AUTH_ON_SITE` = `on` (not Sensitive), then
   redeploy (section B).

Skip this and Google still works everywhere a pop-up opens (desktop browsers, Chrome and Safari on phones).

### 11.3 LinkedIn: the redirect URLs

1. **linkedin.com/developers/apps** → the NotesApp app (the one used for Publish to LinkedIn).
2. **Products** tab: **Sign In with LinkedIn using OpenID Connect** should be listed as added (publishing already uses it). If it
   isn't, click **Request access** next to it and accept (it is granted straight away).
3. **Auth** tab → **OAuth 2.0 scopes**: check `openid`, `profile` and `email` are listed (they come with that product).
4. **Auth** tab → **OAuth 2.0 settings** → **Authorized redirect URLs for your app** → pencil → **Add redirect URL**, one each, then
   **Update**:
   - `https://www.notesapp.name.ng/api/auth/linkedin/callback`
   - `https://www.naapp.tech/api/auth/linkedin/callback`
   - for local testing only: `http://localhost:3000/api/auth/linkedin/callback`
   Keep the existing `/api/social/callback/linkedin` ones (publishing). Every page of a domain family (app., life., prep.) comes
   back through its www. address, so these two cover them. A new domain family later needs its own `https://www.<domain>/api/auth/linkedin/callback`.

### 11.4 Vercel settings

- Nothing new is needed if `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are already set (publishing): the **Continue with
  LinkedIn** button appears by itself.
- Only if you want a separate LinkedIn app for sign-in: add `LINKEDIN_LOGIN_CLIENT_ID` (not Sensitive) and
  `LINKEDIN_LOGIN_CLIENT_SECRET` (Sensitive) from that app's **Auth** tab, with the same redirect URLs and product as 11.3.
- Optional: `NEXT_PUBLIC_FIREBASE_AUTH_ON_SITE` = `on` (11.2).
- Redeploy.

### 11.5 Firestore

Run `firebase deploy --only firestore` (section 1.3). It adds the server-only rules for `authLinks`, `authStates`, `authTickets` and
`authAudit`, and the TTL policies on `authStates.expireAt` and `authTickets.expireAt`.

**How to check it all worked:**

1. In a private window, `https://www.naapp.tech/signup` → **Sign up with Google** with a Google account that has no NotesApp account:
   you're asked for a username and the Terms, then journals to follow, and land on your new profile.
2. Sign out; **Continue with Google** again signs you straight in.
3. With a Google account whose email already has a NotesApp account (made with a password): you're told to sign in with your
   password first; do it on the same page, and Google is linked (an email arrives).
4. Account settings → **Sign-in methods** → **Link LinkedIn** → LinkedIn asks you to allow → back on Sign-in methods with LinkedIn
   linked and an email. Sign out, **Continue with LinkedIn** signs you in.
5. Try **Unlink** on your only sign-in method: it's refused.

---

## Costs at a glance

Figures marked **(docs)** come from our own documents. Figures marked **(estimate, verify)** must be checked on the provider's
current pricing page before you budget with them.

| Service | What we pay for | Figure |
|---|---|---|
| Firebase rules, indexes, TTL set-up | Nothing to set up | Free (docs) |
| Firestore reads in big rooms | Every change to a room is read by everyone in it | ~200 reads a second in a 500-listener relay room; ~160,000 reads a minute in a 10,000-listener room on the worker (docs). Watch Firebase console → Firestore → Usage |
| Cloudflare Realtime SFU (rooms) | Data sent out (egress) only | First 1,000 GB a month free (docs). A 500-listener hour is roughly 500 × 25 MB ≈ 12.5 GB (docs, worked out). Price after the free 1,000 GB: (estimate, verify) |
| Cloudflare TURN (calls) | Only traffic that goes through the relay | Getting credentials is free (code). Per-GB price and whether it shares the 1,000 GB: (estimate, verify) |
| Cloudflare Workers Paid (live chat) | The plan, plus Durable Object requests and time | $5 a month (docs). A WebSocket message counts as 1/20 of a request; a quiet room costs nothing between messages (docs). Usage above the plan's allowance: (estimate, verify) |
| Google Cloud Run (recorder) | CPU and memory while an instance is up | About 2 vCPU and 2 GiB for the length of each live, plus a few minutes (docs). Nothing while idle with min instances 0 (docs). Per-hour price: (estimate, verify for your region). Can be paid from Google credits |
| Cloudflare R2 (recordings) | Storage | Usual R2 rate, no egress charge (docs) |
| Cloudflare Stream (replays, courses) | Minutes stored and minutes watched | Published replays only (docs). Rates: (estimate, verify) |
| cron-job.org | Calling our jobs | Free |
| Vercel Cron (daily agents run) | Inside the Hobby plan's once a day | Free (docs) |
| NKENNEAi transcripts (optional) | Speech to text | Per NKENNEAi's plan (verify) |

---

## Troubleshooting

The messages below are quoted from the code, so you will see these exact words on /status, in a room, or in the logs.

### Firebase

| You see | What it means | Fix |
|---|---|---|
| `firebase: command not found` | The Firebase tool isn't installed | `npm install -g firebase-tools` (section 1.1) |
| `Failed to authenticate` or `not logged in` | Not signed in, or signed in as the wrong Google account | `firebase logout`, then `firebase login --no-localhost` |
| `Permission denied` or `does not have permission` | Your Google account isn't an owner/editor of `notesapp-a1402` | Sign in with the owner account |
| It asks to delete indexes or field overrides | Some exist in the console but not in the file | Answer **N** |
| A page says "The query requires an index" | The new indexes are still building | Wait until Firestore → Indexes shows Enabled |
| Something in a room or recording fails with "Missing or insufficient permissions" | Rules from a newly merged branch aren't deployed | Run section 1.3 again |

### Cloudflare Realtime (audio rooms relay)

| You see (/status or the host's screen) | Fix |
|---|---|
| "not set up: rooms run phone to phone until CLOUDFLARE_REALTIME_APP_ID and CLOUDFLARE_REALTIME_APP_TOKEN are set in Vercel" | Add both in Vercel and redeploy (section 2.1) |
| "Cloudflare refused the token: CLOUDFLARE_REALTIME_APP_TOKEN must be the App Token (secret) of that same Realtime SFU application" | The token is wrong or from another app. Make a new app if the token is lost, and put both its values in Vercel |
| "Cloudflare can't find that app: CLOUDFLARE_REALTIME_APP_ID must be the App ID from Realtime → Serverless SFU" | Copy the App ID again; check for spaces |
| "switched off in Admin → Limits → Audio rooms: new rooms run phone to phone" | Switch "Use the Cloudflare relay" back on |
| "Cloudflare is limiting us for a moment (too many requests)" | Wait a minute; it clears by itself |
| "Cloudflare's Realtime service is having trouble" | Cloudflare's side: check cloudflarestatus.com. Rooms fall back to phone to phone |
| "could not reach Cloudflare in time" | Usually passing. If it stays, check cloudflarestatus.com |
| "Cloudflare no longer has that session (it may have expired): leave the room and join again" | Shown to a member: leaving and joining again fixes it |

### Cloudflare TURN (calls)

| You see (/status → Calls and audio rooms) | Fix |
|---|---|
| "relay not set up: add CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN in Vercel; some mobile networks can't connect without it" | Section 2.2 |
| "Cloudflare can't find that TURN key: CLOUDFLARE_TURN_KEY_ID must be the Turn Token ID from Realtime → TURN Server" | Copy the Turn Token ID again |
| "Cloudflare refused the token: CLOUDFLARE_TURN_API_TOKEN must be the API token made with that same TURN key" | The two values come from different TURN keys. Use the pair from one key |
| Voice calls still play on the loudspeaker on iPhone | Check the phone is on iOS 16.4 or later and the site was reloaded after the update. Tell us the phone model |

### Cloudflare Workers (live room chat)

| You see | Fix |
|---|---|
| /status: "not set up: rooms use the Firestore chat until the worker is deployed and NEXT_PUBLIC_LIVE_ROOMS_URL and LIVE_ROOMS_SECRET are set in Vercel" | Sections 3.6 and 3.9 |
| /status: "the worker has no LIVE_ROOMS_SECRET yet: run npx wrangler secret put LIVE_ROOMS_SECRET in workers/live-rooms" | Add the GitHub secret `LIVE_ROOMS_SECRET` and run the workflow again, or do 3.7 |
| /status: "LIVE_ROOMS_SECRET on Vercel and on the worker are different: set the same value in both" | Set the same value in Vercel and on the worker, then redeploy Vercel |
| /status: "can't reach the worker at NEXT_PUBLIC_LIVE_ROOMS_URL: check the address and that the deploy workflow ran" | Check the address starts `wss://` and ends `.workers.dev`, and the workflow run is green |
| /status: "the worker answered 404 at NEXT_PUBLIC_LIVE_ROOMS_URL" (or another number) | Wrong address or the worker isn't deployed |
| The workflow run is green but says "Live rooms not deployed" | `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` is missing in GitHub (names must match exactly) |
| The workflow fails with "Authentication error" or a 10000 code | The API token lacks Workers permissions or is for another account. Make it again from the **Edit Cloudflare Workers** template |
| The workflow fails mentioning Durable Objects or a plan | The account isn't on **Workers Paid** (section 3.1) |
| No "Run workflow" button | Open the **Actions** tab on `main`; if it's still missing, the workflow file `.github/workflows/deploy-live-rooms.yml` isn't on `main` |

### Google Cloud Run (recorder)

| You see | Fix |
|---|---|
| The host doesn't see **Record this live** | `RECORDER_URL` or `RECORDER_SECRET` is missing in Vercel, or not redeployed. Also check the host's plan in the limits table |
| Host: "Recording isn't available yet, so this live isn't recorded." | Same as above |
| Host: "This room runs phone to phone, which can't be recorded, so this live isn't recorded." | The relay is off or failing: see section 2 |
| Host: "The recorder couldn't join, so this live isn't being recorded." | Open `RECORDER_URL/health`. If it doesn't answer, read the logs (`gcloud run services logs read room-recorder`). A "bad signature" in the logs means `RECORDER_SECRET` differs between Vercel and Secret Manager. "busy: this recorder is full" means too many lives at once |
| Host: "The recorder stopped, so the rest of this live isn't being recorded." | Usually a new deploy or scaling during a live. The part already recorded is kept. Only deploy when nobody is recording |
| Deploy fails with "Permission denied on secret" | Do the `add-iam-policy-binding` command in 4.3 |
| Deploy fails during the build with a permission error | New Google projects may need the build service account given the **Cloud Run Builder** or **Cloud Build Service Account** role (IAM & Admin → IAM). Then deploy again |
| The service crashes at start with "RECORDER_SECRET is required" | The `--set-secrets` part is missing: run the deploy command again exactly as in 4.4 |
| The first seconds of a live are missing | Cold start. Set `--min-instances 1` before a big live (4.4) |
| "R2_PRIVATE_BUCKET isn't set: recordings are kept in the private bucket." | Set `R2_PRIVATE_BUCKET` in Vercel and redeploy |

### Cloudflare Stream (replays and courses)

| You see | Fix |
|---|---|
| "Replays need Cloudflare Stream (CLOUDFLARE_STREAM_TOKEN), which isn't set up yet." | Section 5 |
| /status → Video courses: Not enabled yet | `CLOUDFLARE_STREAM_TOKEN` or the account id is missing |
| /status → Video courses: Down | The token is wrong or lacks **Stream: Edit**, or the account id is for another account. Vercel → Logs shows "Cloudflare Stream storage-usage failed" with the reason |

### cron-job.org

| You see | Fix |
|---|---|
| History shows **401 Unauthorized** (`{"error":"Unauthorized"}`) | The header is wrong. It must be exactly `Authorization` = `Bearer ` + the same value as `CRON_SECRET` in Vercel, with one space and no quotes |
| History shows a timeout | Raise the job's timeout to the most allowed. The work still finishes on our side |
| /status → Scheduled jobs: Slow or Down | The reminders job stopped running. Check it is enabled and its address is `https://www.naapp.tech/api/cron/reminders` |

### Firebase authorised domains

| You see | Fix |
|---|---|
| Sign-in on `mcp.` says the domain is not authorised (`auth/unauthorized-domain`) | Section 7 |
| `mcp.naapp.tech` doesn't load at all | Add it in Vercel → Domains and set the DNS record (section 7) |

---

## Things this guide could not confirm

- Cloudflare's per-GB prices after the free allowance, the Workers Paid usage allowance, and Cloud Run's hourly price per region:
  check the providers' pricing pages.
- The exact button names in the Cloudflare, Google Cloud and cron-job.org dashboards can change; the steps follow the names in our
  docs at the time of writing.
- Not yet run for real: the relay with real phones (Safari especially), video through the relay, the worker on Cloudflare, the
  recorder on Cloud Run, Stream's copy of a recording, Stream's watermarked download copy, and NKENNEAi with WebM files. The tests in
  section 10 are the first real run.
- Sign in with Google and LinkedIn end to end: it needs a real person signing in with a real account on the live site after section
  11. LinkedIn's published OpenID settings and signing key were checked against the code on 5 November 2026 and match.
- Stream's plan names and buttons (5.3) change from time to time; if they don't match, look for Stream under **Billing →
  Subscriptions**.
