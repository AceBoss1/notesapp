# #NotesApp hand-over note

**Date:** 16 October 2026 · **Latest version:** v0.37.0 (on branch `claude/notesapp-tech-and-digest`, not merged yet) · **Repository:** `AceBoss1/notesapp`
**Owner:** the founder and CEO of NotesApp Technologies Ltd (product decisions, approvals, deploys that need console access).

Start with `README.md` → "Where things stand": it lists what is live, the environment variables and the deploy checklist.
This note covers how the work is done, what's in flight, and what to watch.

---

## 1. Where the code is right now

| | State |
|---|---|
| `main` | **v0.36.0** (merged 16 Oct 2026, with this note and the updated README): Notes Life hotel stays (11 AM checkout, room service, 100% needs in the suite), the calm sound in the suite / VIP bar / classes, site-wide links, chat link previews and the @mention picker; before it, #145 and #146 (Digital Witch landing cards, the partner card, the VIP bar 360° view, the pool shape, the street billboard). Vercel deploys `main` on merge. |
| `claude/pensive-allen-5tvypx` | The previous session's working branch, reset to `main` after each merge. |
| `claude/notesapp-tech-and-digest` | **v0.37.0, waiting for review:** one setting for the primary address (`NEXT_PUBLIC_ROOT_DOMAIN`, every domain serves the site under its own name), the link-preview rebinding fix, @mention bells in public places, and the weekly digest (off until `WEEKLY_DIGEST=on`). |

Working branch convention: each session works on its own `claude/…` branch (Vercel doesn't deploy `claude/*`); it was `claude/pensive-allen-5tvypx` before. After each squash merge the branch is reset to `main`
(`git fetch origin main && git checkout -B <branch> origin/main && git push -f -u origin <branch>`).

## 2. Waiting on the owner

1. **`firebase deploy --only firestore`.** The rules that let Notes Life presence use the Digital Witch hub (`dw`) are merged
   but not deployed. Until they are, players at the hub don't appear to each other.
2. **Firestore index suggestions** (Query insights, e.g. `ledger WHERE status = ? COUNT`): create them with the console's one-click
   "Create index" when they appear.
3. **The agent-layer scope PDF**: attach it to the staff library entry "Where AI agents meet #NotesApp".
4. **Legal draft set** (counsel pack, fixed documents 1.2–3.2, equity plan, five-director consent): drafts are **kept out of the
   repository on purpose** and are still open.
5. **Dojah live mode** and **Paylony live keys**: both are still on test/sandbox (README "Going live with Dojah"; `lib/paylony.ts`).
6. **notesapp.tech (the .tech No Excuses Fund, applications close 15 Dec 2026):** register it in the company's name, then
   follow `docs/DOMAIN_SWITCH.md` (Vercel domains, Firebase authorised domains, Resend, webhooks, LinkedIn/X callbacks,
   then `NEXT_PUBLIC_ROOT_DOMAIN=notesapp.tech`). The fund wants the **primary** site on .tech: every link we publish should use it.
7. **Before the fund's code review** (terms 4.5: read-only repository access may be asked for): decide what reviewers should
   not see (company numbers, counsel's advice, partner details in the README and this note) and move it out. Removing it
   from the files is not enough: git history keeps it, so share a clean copy of the repository (a fresh repo from the current
   files) rather than this one.
8. **Weekly digest:** set `EMAIL_LINK_SECRET`, preview it (`POST /api/admin/digest {action:"send_test"}`), check the Resend
   plan (free = 100 emails a day for everything), then `WEEKLY_DIGEST=on`.

## 3. How the work is done (please keep these)

- **Never open a PR unless asked.** "Open the PR and merge" means: stop any running build → start the Firestore emulator
  (`npx firebase-tools@13 emulators:start --only firestore --project demo-notesapp`) → `rm -rf .next` → `next build` with the
  emulator env (Firebase demo project, a dummy service-account JSON, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`) → confirm
  **"Compiled successfully"** and **`ƒ Middleware`** in the output → create the PR (no PR template in the repo) → **squash-merge** →
  reset the branch to main.
- **One build at a time.** Two `next build`s in parallel exhaust the container.
- **Commit messages** end with the Co-Authored-By and session lines; **no AI model names or IDs** in commits, PRs, code or docs.
- **Legal drafts are never committed.** The **Vision** page stays out of the changelog, the roadmap and public docs; it is served only to the
  people it concerns (`lib/vision-server.ts`, `VISION_PEOPLE`).
- **Screenshots before shipping:** every major UI build (a new page, a new email, a redesigned panel) is shown as phone and
  desktop screenshots for approval before it ships, rendered from the real code (Chromium is in the container:
  `/opt/pw-browsers/chromium`).
- **Game features: mockups first.** Show phone and desktop mockups of important Notes Life features for approval before building
  (they are rendered from the real `components/life/world.ts` scenes).
- **Every feature ships with its docs:** a `lib/changelog.ts` entry (Added / Changed / Fixed, version bump), the help article in
  `lib/kb-articles.ts` (Nana answers from these), the README, and tests where there is server logic.
- Writing style for anything people read: short, plain sentences; British spelling; prices in N$ (game) or ₦ (real money).

## 4. Map of the code

| Area | Where |
|---|---|
| Pages | `app/(main)` (the site and app), `app/(site)`, `app/life` (Notes Life landing and partners), `app/api` (all server routes) |
| Hosts | `middleware.ts`: `app.notesapp.name.ng` (welcome screen, then the feed), `life.notesapp.name.ng` (the game), members' own domains |
| Firebase | client `lib/firebase.ts`; admin `lib/firebase-admin.ts` (`verifySignedInRequest`, `verifyAdminRequest`, departments) ; rules `firestore.rules`; TTLs `firestore.indexes.json` |
| Messaging | `components/messages/*`, `lib/messages-server.ts`, `lib/groups-server.ts`, calls `lib/calls-server.ts` + `components/calls/*` |
| Links and @mentions | `lib/linkify.ts` (tokenizer + `remarkLinkify`), `components/LinkedText.tsx`, `components/MentionPicker.tsx`, `components/LinkPreview.tsx`, `app/api/link-preview/route.ts` |
| Addresses | `lib/host.ts` (the primary address and every domain's family), `middleware.ts`, `lib/use-family-url.ts` + `components/FamilyLink.tsx`, `docs/DOMAIN_SWITCH.md` |
| Mention bells | `lib/mentions-server.ts`, `app/api/notify/mentions/route.ts` (comments, journals); reviews, recommendations and moments call it on the server |
| Weekly digest | template `lib/digest.ts`, sending `lib/digest-server.ts`, cron job `weeklyDigest`, `app/api/digest/unsubscribe`, `app/api/account/email-prefs`, `app/api/admin/digest`, `components/EmailSettings.tsx` |
| Money | Paystack `app/api/paystack/*`, `lib/payments.ts`; wallet `lib/wallet*.ts`; Paylony (in progress) `lib/paylony.ts`; team ledger in the admin area |
| Nana AI | `lib/nana-*.ts`, `components/Nana*.tsx`, help articles `lib/kb-articles.ts` |
| Platform numbers | `lib/stat-cache.ts` (snapshots in `statCache/{key}`: traction hourly, revenue every 15 minutes), `lib/traction-server.ts` |
| Notes Life | rules and catalogue `lib/life/catalog.ts` · server economy `lib/life/server.ts` (`act`, `mutate`, `LifeError`) · needs, activities, saves `lib/life/play.ts`, `components/life/save.ts` · 3D scenes `components/life/world.ts` (three.js) · UI `components/life/LifeGame.tsx` · sound `components/life/sound.ts` (Web Audio, no files) · friend chat `components/life/FriendChat.tsx` · presence `components/life/presence.ts` · VIP bar view `components/life/VipPano.tsx` |
| Game time | a game day is 48 real minutes, a game hour 2 real minutes (`worldTime`, `WORLD_EPOCH`, `GAME_HOUR_MS`) |

## 5. Tests and checks

```
npx tsc --noEmit -p .          # types (there is no ESLint config in this repo)
npm run test:rules             # Firestore rules, 54 tests (needs Java)
npm run test:life              # Notes Life economy; prints "ALL OK"
npm run test:messages          # message edit/delete rules
npm run test:mentions          # @mention bells; prints "ALL OK"
npm run test:digest            # weekly digest; prints "ALL OK"
npm run test:preview           # link-preview safety (no emulator; listens on port 80)
```
The emulator-based tests start their own emulator on port 8080, so stop any emulator you started yourself first.

## 6. Known gaps and things to check

- **v0.36.0 was not tried in the live game.** Check once deployed: check in to the suite, leave and come back before 11 AM,
  room service, the checkout message, the calm tune.
- **Link previews were tested on a local page only** (the build container has no direct internet). Check a few real addresses
  in Messages after deploy.
- The **VIP bar 360° view** was tested on its own in a browser, not inside the running game.
- Rate limits (`lib/rate-limit.ts`) and the link-preview cache are **in memory per server instance**, not global.
- **Mention bells** are built (v0.37.0) but only tested against the emulator; check a real comment with an @mention after deploy.
- **The weekly digest** was tested against the emulator and with sample stories in a browser, not yet sent through Resend.
  `getUsers` (emails) needs the real Auth, so the batch send itself is untested until the first `send_test`.
- **Interests:** the digest ranks by `users/{uid}.interests`, but nothing fills it yet: the hashtag picker is next.
- The `/life` landing screenshots still show the old rectangular pool and the old Chef Adams street board; re-capture them.
- The hotel suite has no interior 3D scene; time in the room plays at the hotel front.
- Vercel cost: keep public pages on ISR (`revalidate` + `generateStaticParams`), keep admin auto-refresh slow and only while
  the tab is visible, and keep whole-collection reads behind `lib/stat-cache.ts`.

## 7. Partners in Notes Life (real businesses)

Chef Adams (food, @chef_adams), itel Energy (through @clickam), Candellux Imperial Hotel & Suites (Garki; WhatsApp and
website in `CANDELLUX`), Digital Witch (Ekwutosi Cynthia Okeh; `DIGITAL_WITCH`). Their details live in `lib/life/catalog.ts`;
their pictures in `public/images/life/partners/` and `public/images/life/billboards/`. In-game prices are game prices;
Notesville Naira is never cashed out.
