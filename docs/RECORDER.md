# The room recorder: deploying it, and how it talks to the app

The room recorder (`services/room-recorder`) records audio rooms whose host switched **Record this live** on (lib/live-recording.ts).
It is a small Node service with Playwright's headless Chromium. It is off until `RECORDER_URL` and `RECORDER_SECRET` are set in Vercel:
until then the switch is hidden from hosts and nothing is recorded.

## How it works

1. A host starts a relay room with recording on. The app creates `roomRecordings/{rid}` and calls the recorder:
   `POST {RECORDER_URL}/start { rid, roomId, pageUrl, uploadUrl, maxSeconds, chunkSeconds }`.
2. The recorder opens `pageUrl` (the app's hidden page `/rooms/record/{room}?token=…`) in headless Chromium. The token is for one
   room and one recording, expires after the longest recording plus an hour, and only lets the page **receive** (pull, answer, close)
   on the relay; the server refuses anything else. The page mixes the stage's microphones, draws the picture on a canvas (the host's
   video when there is a video track, the room's poster otherwise, or a title card), and records two files with MediaRecorder:
   `stage` (picture and sound, WebM) and `audio` (sound only, WebM/Opus).
3. Every ~10 seconds the page hands each file's chunk to the service, which signs it and uploads it to `uploadUrl`
   (`POST /api/rooms/recorder?rid=&file=stage|audio&seq=n`). The app keeps it in the private R2 bucket (`R2_PRIVATE_BUCKET`), joining
   chunks into 5 MiB multipart parts.
4. When the room ends the app calls `POST {RECORDER_URL}/stop { rid }` (the page also notices the room ended). The page stops, the
   last chunks go, and the service calls `POST /api/rooms/recorder { action: "finalize", rid, hadVideo, seconds }`. At the longest
   recording length (Admin → Limits → Live recording) the service stops by itself.
5. If anything dies mid-way, the app's cron finishes the recording from what arrived a couple of hours later.

Every request in both directions carries `X-Recorder-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(RECORDER_SECRET, "<t>.<sha256 hex
of the body>")>`, refused when older than five minutes (`lib/recorder-sign.ts`, `services/room-recorder/sign.mjs`).

## Deploy on Google Cloud Run

You need the gcloud CLI signed in to the Google Cloud project that has the credits, with billing linked.

```sh
# Once: pick the project and region (Johannesburg is the nearest region to Lagos), and turn on the services.
gcloud config set project YOUR_PROJECT_ID
gcloud config set run/region africa-south1
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com

# The shared secret (keep a copy: the same value goes into Vercel).
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create recorder-secret --data-file=-

# Build and deploy from the repository root.
gcloud run deploy room-recorder \
  --source services/room-recorder \
  --allow-unauthenticated \
  --set-secrets RECORDER_SECRET=recorder-secret:latest \
  --set-env-vars APP_ORIGIN=https://YOUR-SITE-ADDRESS,MAX_RECORDINGS=3 \
  --cpu 2 --memory 2Gi \
  --no-cpu-throttling \
  --min-instances 0 --max-instances 3 \
  --concurrency 10 \
  --timeout 3600
```

- **`--allow-unauthenticated`** is needed because the app calls it over the internet; every request is still checked against the
  signature, and an unsigned one is refused.
- **`--no-cpu-throttling`** (CPU always allocated) is required: a recording runs long after the `/start` request has been answered,
  and Cloud Run would otherwise freeze the instance between requests. You pay for the instance while it is up.
- **`APP_ORIGIN`**: the site's own address (the same origin as `NEXT_PUBLIC_SITE_URL`). The recorder refuses to open or upload to any
  other origin, so a leaked secret can't make it browse elsewhere.
- **`MAX_RECORDINGS`**: recordings one instance runs at once (each is a Chromium tab; about 300 to 500 MB and half a CPU with video).
  With `--max-instances 3` and `MAX_RECORDINGS=3`, nine lives can be recorded at once; a tenth gets "busy" and its host sees that the
  recorder couldn't join (the room goes on unrecorded).
- **`--min-instances 0`** costs nothing while nobody records, but the first recording after a quiet spell waits for a cold start
  (Chromium takes 5 to 15 seconds), so the first seconds of a live may be missed. Set `--min-instances 1` before a big scheduled live.
- **Shutdowns:** Cloud Run sends SIGTERM before it stops an instance (a new deploy, scaling in); the service stops every recording and
  finalizes it first. Deploy a new version only when nobody is recording.

Then:

1. Copy the service URL (`gcloud run services describe room-recorder --format='value(status.url)'`).
2. Vercel → Settings → Environment Variables, Production: `RECORDER_URL` = that URL, `RECORDER_SECRET` = the same secret (Sensitive).
   Check `R2_PRIVATE_BUCKET` and `CLOUDFLARE_STREAM_TOKEN` are set. Redeploy.
3. `curl $RECORDER_URL/health` should answer `{"ok":true,"recording":0}`.
4. Start a test relay room with **Record this live** on, talk for a minute, end it, and check **My account → Media**: the recording
   should be Ready, and Play should play it. The Cloud Run logs (`gcloud run services logs read room-recorder`) show each step.

## Changing the secret

Make a new secret version (`gcloud secrets versions add recorder-secret --data-file=-`), redeploy the service
(`gcloud run services update room-recorder --set-secrets RECORDER_SECRET=recorder-secret:latest`), then change `RECORDER_SECRET` in
Vercel and redeploy. Recordings running at that moment stop uploading; the cron finishes them from what arrived.

## Costs

Cloud Run bills CPU and memory while an instance is up (with CPU always allocated): roughly 2 vCPU and 2 GiB for the length of each
live, plus a few minutes. R2 stores recordings at its usual rate with no egress charge; Cloudflare Stream bills minutes stored and
delivered for published replays only.
