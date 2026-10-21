# Settings (environment variables)

Made from `lib/config.ts` by `npm run docs:settings`: change the list there, not here. Set them in Vercel → Settings →
Environment Variables (mark secrets Sensitive), then redeploy: `NEXT_PUBLIC_*` values are built into the pages.

## Addresses

| Setting | Secret | What it does |
|---|---|---|
| `NEXT_PUBLIC_ROOT_DOMAIN` | no | The primary address (lib/host.ts): notesapp.name.ng when unset, notesapp.tech after the move. Emails, share links, webhooks, sign-in callbacks and search engines use it; every domain on the Vercel project still shows the site under its own name. See docs/DOMAIN_SWITCH.md. |
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
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **yes** | Service-account JSON as one line; every server route needs it. |
| `GOOGLE_APPLICATION_CREDENTIALS` | no | Local only: path to a service-account file, instead of FIREBASE_SERVICE_ACCOUNT_KEY. |

## Storage

| Setting | Secret | What it does |
|---|---|---|
| `R2_ACCOUNT_ID` | no | Cloudflare account id for R2 (and Stream, unless CLOUDFLARE_ACCOUNT_ID is set). |
| `R2_ACCESS_KEY_ID` | **yes** | R2 key id. The token must cover both buckets (media and private) with Object Read & Write. |
| `R2_SECRET_ACCESS_KEY` | **yes** | R2 secret. |
| `R2_BUCKET_NAME` | no | Public media bucket (default notesapp-media): images, avatars, post videos. |
| `R2_PRIVATE_BUCKET` | no | Private bucket for paid downloads and message files (a name). |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | no | Public URL of the media bucket (https://media.notesapp.name.ng). |
| `CLOUDFLARE_STREAM_TOKEN` | **yes** | Cloudflare API token with Stream: Edit, for video lessons of view-only items and courses. Without it only PDF lessons work. |
| `CLOUDFLARE_ACCOUNT_ID` | no | Cloudflare account for Stream when it isn't R2_ACCOUNT_ID. |

## Payments

| Setting | Secret | What it does |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | **yes** | Paystack API key (also verifies webhook signatures). |
| `PAYLONY_SECRET_KEY` | **yes** | Paylony (virtual accounts and payouts, being added): sk_test_… or sk_live_…. |
| `PAYLONY_WEBHOOK_KEY` | **yes** | Paylony webhook key. |
| `PAYLONY_ENCRYPTION_KEY` | **yes** | Paylony encryption key. |
| `PAYLONY_CARDTAP_TERMINAL_ID` | no | Our CardTap terminal ID (Paylony dashboard): wallet top-ups with CardTap are offered only when this and PAYLONY_SECRET_KEY are set. |
| `AUTO_PAYOUTS` | no | off pauses automatic payout release. |
| `ACCOUNT_DATA_KEY` | **yes** | Encrypts stored bank details, Granola and social tokens: base64 of 32 random bytes, made once. |

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
| `LINKEDIN_CLIENT_ID` | no | Publish to a member's LinkedIn (appears when both LinkedIn values are set; needs ACCOUNT_DATA_KEY). |
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
| `TURN_URLS` | no | Our own TURN server instead: comma-separated addresses. |
| `TURN_USERNAME` | no | Our own TURN server's username. |
| `TURN_CREDENTIAL` | **yes** | Our own TURN server's password. |

## Feature switches

| Setting | Secret | What it does |
|---|---|---|
| `NEXT_PUBLIC_MESSAGES_LIVE` | no | Messages, group chats and the Conversation button: off unless set to true (also on when moments are). |
| `NEXT_PUBLIC_MOMENTS_LIVE` | no | Moments: off unless set to true (turns messages on too). |
| `NEXT_PUBLIC_CALLS_LIVE` | no | Voice and video calls: on whenever messages are, unless set to false. |
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
