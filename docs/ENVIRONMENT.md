# Settings (environment variables)

Made from `lib/config.ts` by `npm run docs:settings`: change the list there, not here. Set them in Vercel → Settings →
Environment Variables (mark secrets Sensitive), then redeploy: `NEXT_PUBLIC_*` values are built into the pages.

## Addresses

| Setting | Secret | What it does |
|---|---|---|
| `NEXT_PUBLIC_ROOT_DOMAIN` | no | The primary address (lib/host.ts): notesapp.name.ng when unset, naapp.tech after the move. Emails, share links, webhooks, sign-in callbacks and search engines use it; every domain on the Vercel project still shows the site under its own name. See docs/DOMAIN_SWITCH.md. |
| `NEXT_PUBLIC_SITE_URL` | no | Only for local development and previews (localhost, *.vercel.app); ignored on the live site, which always uses https://www.<root>. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | no | Public contact address (footer, legal pages, status). Default hello@notesapp.name.ng; change it once mail works on the new domain. |

## Firebase

| Setting | Secret | What it does |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | no | Firebase web config. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | no | Firebase web config. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | no | Firebase web config. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | no | Firebase web config. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | no | Firebase web config. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | no | Firebase web config. |
| `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST` | no | Development, CI and screenshots only: host:port of the Firestore emulator for the browser (127.0.0.1:8080). Never set on the live site. |
| `NEXT_PUBLIC_AUTH_EMULATOR_HOST` | no | Development, CI and screenshots only: host:port of the Auth emulator for the browser (127.0.0.1:9099); the server reads FIREBASE_AUTH_EMULATOR_HOST. Never set on the live site. |
| `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` | no | Which Firestore database the site uses: (default) when unset. Set it to a restored database's id (Admin → Backups) only to switch the whole site over after a recovery, once that database has the rules and indexes (HANDOVER, "Restoring"); then redeploy. |
| `NEXT_PUBLIC_FIREBASE_AUTH_ON_SITE` | no | on: Google sign-in by redirect (phones, in-app browsers) runs through each site's own address (/__/auth, proxied to the Firebase auth domain) instead of the Firebase auth domain, so browsers that block third-party storage (Safari, in-app browsers) can finish it. Needs every https://<host>/__/auth/handler added to the Google OAuth client's redirect URIs first (docs/OWNER_SETUP.md, "Sign in with Google and LinkedIn"). |
| `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` | no | OAuth web client id (Google Cloud → APIs & Services → Credentials) for the owner's Google sign-in on Admin → Backups, which switches on recovery, schedules backups and restores with the owner's own Google rights. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **yes** | Service-account JSON as one line; every server route needs it. |
| `GOOGLE_APPLICATION_CREDENTIALS` | no | Local only: path to a service-account file, instead of FIREBASE_SERVICE_ACCOUNT_KEY. |

## Sign-in

| Setting | Secret | What it does |
|---|---|---|
| `LINKEDIN_LOGIN_CLIENT_ID` | no | Optional: a separate LinkedIn app for Sign In with LinkedIn (product "Sign In with LinkedIn using OpenID Connect"). Unset: the publishing app (LINKEDIN_CLIENT_ID/SECRET) is used. The LinkedIn button appears when either pair is set. |
| `LINKEDIN_LOGIN_CLIENT_SECRET` | **yes** | The secret of LINKEDIN_LOGIN_CLIENT_ID's app. |

## Storage

| Setting | Secret | What it does |
|---|---|---|
| `R2_ACCOUNT_ID` | no | Cloudflare account id for R2 (and Stream, unless CLOUDFLARE_ACCOUNT_ID is set). |
| `R2_ACCESS_KEY_ID` | **yes** | R2 key id. The token must cover both buckets (media and private) with Object Read & Write. |
| `R2_SECRET_ACCESS_KEY` | **yes** | R2 secret. |
| `R2_BUCKET_NAME` | no | Public media bucket (default notesapp-media): images, avatars, post videos. |
| `R2_PRIVATE_BUCKET` | no | Private bucket for paid downloads, message files and live recordings (a name). |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | no | Public URL of the media bucket (https://media.notesapp.name.ng). |
| `CLOUDFLARE_STREAM_TOKEN` | **yes** | Cloudflare API token with Stream: Edit, for video lessons of view-only items and courses. Without it only PDF lessons work. |
| `CLOUDFLARE_ACCOUNT_ID` | no | Cloudflare account for Stream when it isn't R2_ACCOUNT_ID. |

## Payments

| Setting | Secret | What it does |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | **yes** | Paystack API key (also verifies webhook signatures). |
| `STRIPE_SECRET_KEY` | **yes** | Stripe (NotesApp Inc): readers paying in USD, GBP, EUR and CAD (lib/stripe.ts). sk_test_… in the sandbox, sk_live_… once the account is activated. Never in code or chat. |
| `STRIPE_WEBHOOK_SECRET` | **yes** | Stripe webhook signing secret (whsec_…) for https://<site>/api/stripe/webhook, events checkout.session.completed and charge.refunded. |
| `FLUTTERWAVE_SECRET_KEY` | **yes** | Flutterwave (NotesApp Technologies Ltd): readers paying in African currencies other than the naira, and payouts in them (lib/flutterwave.ts). |
| `FLUTTERWAVE_WEBHOOK_HASH` | **yes** | The secret hash set in Flutterwave → Settings → Webhooks for https://<site>/api/flutterwave/webhook; Flutterwave sends it in the verif-hash header. |
| `PAYLONY_SECRET_KEY` | **yes** | Paylony (virtual accounts and payouts, being added): sk_test_… or sk_live_…. |
| `PAYLONY_WEBHOOK_KEY` | **yes** | Paylony webhook key. |
| `PAYLONY_ENCRYPTION_KEY` | **yes** | Paylony encryption key. |
| `PAYLONY_CARDTAP_TERMINAL_ID` | no | Our CardTap terminal ID (Paylony dashboard): wallet top-ups with CardTap are offered only when this and PAYLONY_SECRET_KEY are set. |
| `AUTO_PAYOUTS` | no | off pauses automatic payout release. |
| `ACCOUNT_DATA_KEY` | **yes** | Encrypts stored bank details, Granola and social tokens, connected AI keys and My Cycle (and signs its unlock cookie): base64 of 32 random bytes, made once. Without it My Cycle stays off. |

## Hotel kit

| Setting | Secret | What it does |
|---|---|---|
| `MONIEPOINT_WEBHOOK_SECRET` | **yes** | Moniepoint card machines (the Hotel kit's card-machine link add-on): the secret Moniepoint shows when the webhook https://<site>/api/hotel/moniepoint is added. Every event is checked against it (HMAC-SHA256 over id, timestamp and body). Without it, and the two below, the add-on shows as not set up yet. |
| `MONIEPOINT_CLIENT_ID` | no | Moniepoint push-payment API client ID (the ERP integration switched on for the business): a till sends the exact amount to the counter's machine. |
| `MONIEPOINT_CLIENT_SECRET` | **yes** | Moniepoint push-payment API client secret. |
| `MONIEPOINT_API_URL` | no | Moniepoint push-payment API base address (from Moniepoint when the integration is switched on). Without it, sales can't be sent to a machine, but machine payments still arrive by webhook. |
| `MONIEPOINT_AMOUNT_UNIT` | no | naira (the default) or kobo: how Moniepoint's webhook and API state amounts. Check the first real payment against the machine's receipt. |
| `WHATSAPP_APP_SECRET` | **yes** | WhatsApp Cloud API (the Hotel kit's WhatsApp ordering add-on): the Meta app secret; every webhook to https://<site>/api/hotel/whatsapp is checked against it (X-Hub-Signature-256). Without it, the verify token and the access token, the add-on shows as not set up yet. |
| `WHATSAPP_VERIFY_TOKEN` | **yes** | The verify token typed into Meta's webhook settings for https://<site>/api/hotel/whatsapp. |
| `WHATSAPP_ACCESS_TOKEN` | **yes** | A system-user access token with whatsapp_business_messaging, used to send Nana's replies from each hotel's number. |

## Naija Exam Prep

| Setting | Secret | What it does |
|---|---|---|
| `EXAM_PREP_PASS_KEY` | **yes** | A P-256 private key (PKCS#8 PEM, or its base64) that signs the offline pass for saved packs with paid questions. Make one with: node -e "const{generateKeyPairSync:g}=require('crypto');console.log(g('ec',{namedCurve:'P-256'}).privateKey.export({type:'pkcs8',format:'pem'}))". Without it, only free questions can be saved for offline use. |

## Kiswahili (NKENNEAi)

| Setting | Secret | What it does |
|---|---|---|
| `NKENNE_API_KEY` | **yes** | NKENNEAi developer API key (Developer Tools → API Keys): Kiswahili reading, listening and voice-note translation. Without it the Kiswahili buttons don't show. |
| `NKENNE_API_URL` | no | NKENNEAi API base address; defaults to https://developers-api.nkenne.ai. |

## Email

| Setting | Secret | What it does |
|---|---|---|
| `RESEND_API_KEY` | **yes** | Resend key; without it emails are skipped (bells still arrive). |
| `EMAIL_FROM` | no | Sender, as #NotesApp <address>. |
| `SUPPORT_EMAIL` | no | Where support and error alerts go (default the contact address). |
| `REPORTS_EMAIL` | no | Where reports of members and content are emailed. |
| `OWNER_EMAIL` | no | The owner account (the first admin profile if unset). |
| `WEEKLY_DIGEST` | no | on turns the Sunday weekly digest on (lib/digest-server.ts). Preview first with POST /api/admin/digest. |
| `DIGEST_PER_RUN` | no | Digests sent per cron run (default 40). Resend's free plan is 100 emails a day for everything. |
| `EMAIL_LINK_SECRET` | **yes** | Signs one-click unsubscribe links (falls back to CRON_SECRET; without either the digest doesn't send). |

## Scheduled jobs

| Setting | Secret | What it does |
|---|---|---|
| `CRON_SECRET` | **yes** | Bearer secret for /api/cron/reminders. |
| `DISCORD_CHANGELOG_WEBHOOK_URL` | **yes** | Discord channel webhook (Server Settings → Integrations → Webhooks) for #announcements: each new changelog release is posted once by the cron job (lib/discord.ts). The URL is a password: keep it only here. |

## Shared store

| Setting | Secret | What it does |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | no | Upstash Redis REST address: rate limits and some caches shared by every server instance (lib/shared-store.ts). Without it each instance counts on its own. |
| `UPSTASH_REDIS_REST_TOKEN` | **yes** | Upstash Redis REST token. |

## AI (Nana)

| Setting | Secret | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | **yes** | Switches Nana's AI on for everyone. Without it Nana answers from the help centre and members can connect their own key. |
| `ANTHROPIC_BASE_URL` | no | Only to send Claude calls through a proxy (default https://api.anthropic.com). |
| `NANA_MODEL` | no | The model behind Pearl, the gem everyone uses (default claude-haiku-5-5; lib/nana-gems.ts). |
| `NANA_MODEL_EMERALD` | no | The model behind Emerald, for Business and Enterprise (default claude-sonnet-5-5). |
| `NANA_MODEL_RUBY` | no | The model behind Ruby, for Enterprise (default claude-opus-5-5). |
| `NANA_BANK_DAYS` | no | How many days Nana keeps a general answer in the answer bank to give again for free (default 7; 0 turns the bank off; lib/nana-bank.ts). |
| `NANA_DAILY_LIMIT` | no | Nana's daily answers across the site. |
| `NANA_CHAT_PER_USER_DAILY` | no | Nana chat answers per member a day. |
| `NANA_ASSIST_DAILY` | no | Writing-help uses per member a day. |

## Identity (Dojah)

| Setting | Secret | What it does |
|---|---|---|
| `DOJAH_APP_ID` | no | Dojah identity checks. |
| `DOJAH_SECRET_KEY` | **yes** | Dojah secret key. |
| `DOJAH_WEBHOOK_SECRET` | **yes** | Dojah webhook secret. |
| `DOJAH_API_BASE` | no | Sandbox only: delete for live. |
| `DOJAH_AUTO_APPROVE` | no | Keep off; true auto-approves a gold application whose every step passed. |
| `NEXT_PUBLIC_DOJAH_WIDGET_PERSONAL` | no | Dojah widget id for people. |
| `NEXT_PUBLIC_DOJAH_WIDGET_CORPORATE` | no | Dojah widget id for organisations. |

## Social publishing

| Setting | Secret | What it does |
|---|---|---|
| `LINKEDIN_CLIENT_ID` | no | Publish to a member's LinkedIn (appears when both LinkedIn values are set; needs ACCOUNT_DATA_KEY). Also used for Sign In with LinkedIn unless LINKEDIN_LOGIN_CLIENT_ID is set. |
| `LINKEDIN_CLIENT_SECRET` | **yes** | LinkedIn app secret. |
| `LINKEDIN_API_VERSION` | no | LinkedIn API version, YYYYMM (default 202606). |
| `X_CLIENT_ID` | no | Publish to a member's X account (appears when both X values are set). |
| `X_CLIENT_SECRET` | **yes** | X app secret. |

## Domains

| Setting | Secret | What it does |
|---|---|---|
| `WHOGOHOST_RESELLER_EMAIL` | no | Domain reseller API (Whogohost / go54), production only. |
| `WHOGOHOST_API_KEY` | **yes** | Domain reseller API key. |
| `WHOGOHOST_PROXY_URL` | no | Fixed-IP proxy for the reseller API when it needs an allow-listed address. |
| `VERCEL_API_TOKEN` | **yes** | Optional: connect Enterprise custom domains automatically, and the /status check. |
| `VERCEL_PROJECT_ID` | no | The Vercel project, for the above. |
| `VERCEL_TEAM_ID` | no | Only for a team project. |

## Messaging and calls

| Setting | Secret | What it does |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | no | Device notifications (web push) and call ringing: the public key. |
| `VAPID_PRIVATE_KEY` | **yes** | Web push private key. |
| `VAPID_SUBJECT` | no | mailto: address for web push. |
| `CALL_PUSH_SECRET` | **yes** | Signs the answer and decline links in call notifications (falls back to the VAPID private key). |
| `CLOUDFLARE_TURN_KEY_ID` | no | Cloudflare TURN relay for calls on strict networks. |
| `CLOUDFLARE_TURN_API_TOKEN` | **yes** | Cloudflare TURN token. |
| `CLOUDFLARE_REALTIME_APP_ID` | no | App ID of the Cloudflare Realtime Serverless SFU app (Realtime → Serverless SFU). With the token, new community audio rooms use the relay, for hundreds of listeners (Admin → Limits → Audio rooms sets how many, and can switch it off); without both, rooms run phone to phone. /status shows whether Cloudflare accepts them. |
| `CLOUDFLARE_REALTIME_APP_TOKEN` | **yes** | App Token (secret) of that same Realtime SFU app. Server-only: browsers never see it. |
| `NEXT_PUBLIC_LIVE_ROOMS_URL` | no | The live-rooms worker's address, wss://notesapp-live-rooms.YOUR-SUBDOMAIN.workers.dev (workers/live-rooms; HANDOVER item 99). With LIVE_ROOMS_SECRET, relay audio rooms opened from then on carry their chat, listener count, raised hands and stage signals over one WebSocket per person to a Cloudflare Durable Object, instead of everyone reading Firestore for every message: for rooms of thousands. Empty: the chat and count go through Firestore as before. |
| `LIVE_ROOMS_SECRET` | **yes** | Shared secret between the site and the live-rooms worker (the same value in both: Vercel, and npx wrangler secret put LIVE_ROOMS_SECRET): signs the 10-minute room tokens and every message between the two. Make one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))". Without it the live-rooms worker isn't used. |
| `TURN_URLS` | no | Our own TURN server instead: comma-separated addresses. |
| `TURN_USERNAME` | no | Our own TURN server's username. |
| `TURN_CREDENTIAL` | **yes** | Our own TURN server's password. |

## Live recording

| Setting | Secret | What it does |
|---|---|---|
| `RECORDER_URL` | no | Address of the room recorder service (services/room-recorder, on Cloud Run: docs/RECORDER.md), like https://room-recorder-xxxx.a.run.app. With RECORDER_SECRET, hosts can switch recording on before a live; without both the switch is hidden. |
| `RECORDER_SECRET` | **yes** | The secret shared with the room recorder (the same value in its RECORDER_SECRET): signs every request between the app and the recorder and the recorder page's room tokens. Make one with: openssl rand -hex 32. |
| `REPLAY_TRANSCRIBE` | no | Transcripts for replays: off (the default), nkenne-english or nkenne-swahili (NKENNEAi speech to text, needs NKENNE_API_KEY; only recordings whose sound file is under 25 MB, about an hour and a half). Without it, Share to Journal drafts without a transcript or Nana summary. |

## Feature switches

| Setting | Secret | What it does |
|---|---|---|
| `NEXT_PUBLIC_MESSAGES_LIVE` | no | Messages, group chats and the Conversation button: off unless set to true (also on when moments are). |
| `NEXT_PUBLIC_MOMENTS_LIVE` | no | Moments: off unless set to true (turns messages on too). |
| `NEXT_PUBLIC_CALLS_LIVE` | no | Voice and video calls: on whenever messages are, unless set to false. |
| `NEXT_PUBLIC_MEDIA_LIVE` | no | Media (the Media tab on profiles, /u/{username}/media and the /profile/media studio): on unless set to false. Videos also need CLOUDFLARE_STREAM_TOKEN. |
| `NEXT_PUBLIC_WALLET_LIVE` | no | The NotesApp Credit wallet: on unless set to false. |
| `NEXT_PUBLIC_LIFE_LIVE` | no | Notes Life: on unless set to false. |
| `NEXT_PUBLIC_ACADEMY_LIVE` | no | Notes Academy free courses (/academy, teaching, course pages, the Courses tabs, member sites and the digest): on unless set to false, which brings back the opening-soon page. |

## Other

| Setting | Secret | What it does |
|---|---|---|
| `AD_HASH_SALT` | **yes** | Salt for hashing ad-visitor ids (default notesapp). |
| `GRANOLA_MCP_URL` | no | Granola's MCP address for the team hub (default https://mcp.granola.ai/mcp). |
| `LIFE_BONUS_MONTHLY_CAP_NAIRA` | no | Most NotesApp Bonus Credit Notes Life invites can pay out in a month (default 500,000). |
| `VISION_PEOPLE` | no | Who sees the Vision page: email=name pairs (lib/vision-server.ts). |
