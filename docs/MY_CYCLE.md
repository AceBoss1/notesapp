# 🌸 My Cycle: a private cycle and wellness companion

A cycle tracker with advice from Nana for women and girls on #NotesApp, built in NotesApp's own web app (Next.js), **not in Flutter**.
It works on phones and laptops. The owner asked for it on 12 Nov 2026, using the Bloom app (github.com/vicintel/bloom-app) as the reference.
**Status: mockups awaiting the owner's approval. Nothing has been built yet.**

Bloom has no licence file, so none of its code is copied. Only the ideas are rebuilt here: phases, check-in, charts, food and fitness by
phase, AI advice, and a biometric lock with a privacy shield.

## Decisions (owner, 12 Nov 2026)

| Question | Decision |
|---|---|
| Ladies only, with no gender on profiles | **Ask once, privately.** On first open she picks "I'm female" or "Not for me". The answer is stored server-only, is never on `users/{uid}` (which is public) and is never shown. "Not for me" hides My Cycle from her menus, and she can undo it in Settings → Privacy. Sign-up does not change. |
| Teen girls (13–17) | **Periods only, no fertility.** Period calendar, symptoms, mood, food and fitness, and Nana in age-appropriate words. No fertile window, ovulation day or pill mode. Her parent never sees her data. Kids mode (under 13) does not get it. |
| Where the data lives | **Encrypted on our server.** Each check-in is encrypted (AES-256-GCM with `ACCOUNT_DATA_KEY`, as in `lib/ai-connect.ts`) in server-only collections, so it works on any device and Nana can read it to advise her. |
| Not medical | It is not contraception and not medical advice. Predictions are estimates from her own logs and say so ("early guess" until 3 periods are logged). |

## The mockups

All screens on one sheet: [all-screens.webp](mockups/my-cycle/all-screens.webp). HTML source: [mockups.html](mockups/my-cycle/mockups.html).

1. **First open:** the private question, the last period date and the usual length ([1-first-open](mockups/my-cycle/1-first-open.webp))
2. **Locked:** unlock with fingerprint, face or passkey; the screen blanks when she switches apps ([2-locked](mockups/my-cycle/2-locked.webp))
3. **Today:** phase ring, next period, Nana's note for the day, food and moving for today ([3-today](mockups/my-cycle/3-today.webp))
4. **Calendar:** logged and predicted periods, fertile window, ovulation estimate, pill mode ([4-calendar](mockups/my-cycle/4-calendar.webp))
5. **Daily check-in:** mood, symptoms, energy, pain, water, sleep, flow ([5-check-in](mockups/my-cycle/5-check-in.webp))
6. **Insights:** cycle lengths, mood through the cycle, top symptoms, Nana's monthly report ([6-insights](mockups/my-cycle/6-insights.webp))
7. **Ask Nana, and the teen version** ([7-ask-nana-teen](mockups/my-cycle/7-ask-nana-teen.webp))

## How it will work

- **Lock (Bloom used local_auth; we use WebAuthn).** Opening My Cycle asks for a passkey check (`lib/passkeys-server.ts`, the same passkeys
  used to sign in). It needs user verification, so the phone asks for her fingerprint, face or screen lock. Success gives a short-lived,
  httpOnly unlock cookie bound to her uid. Every My Cycle route refuses without it. It ends after 2 minutes away or when the tab is
  hidden. A member with no passkey is walked through adding one first. If the check fails, the page stays locked.
- **Privacy shield (Bloom: hidden in the app switcher).** On `visibilitychange` or `pagehide`, the page blanks and drops its data from
  memory. The installed app (Capacitor, `docs/MOBILE-APPS.md`) also sets the secure-window flag, so screenshots and the app switcher show
  nothing.
- **Storage.** `cycleProfiles/{uid}` holds the answer, cycle length, pill mode and teen flag. `cycleLogs/{uid}_{day}` holds encrypted
  check-ins. `cycleChats/{uid}/…` holds the private Nana chat. All are server-only in firestore.rules, written only by
  `lib/cycle-server.ts`, never included in exports, ads, analytics or other Nana features, and never readable by staff in Admin.
  "Download my data" and "Delete everything" are in My Cycle settings, and closing the account deletes it all.
- **Predictions** (`lib/cycle.ts`, pure and tested): cycle length is the average of her last 6 logged cycles, or her setting, or 28.
  Ovulation is estimated at 14 days before the next period. The fertile window runs 5 days before ovulation to 1 day after. Phases are
  Menstrual, Follicular, Ovulation and Luteal. Pill mode shows Active and Break instead. Teens never get ovulation or fertile-window
  fields, and the server leaves them out.
- **Nana.** The daily note, check-in advice, monthly report and chat get her phase plus a short summary of her own logs, never her name
  or other data. They use her own AI key if connected, otherwise Nana's allowance. The prompt keeps Nana to wellness, has her say when
  something needs a doctor, and has her use age-appropriate words for teens.
- **Reminders.** An optional daily check-in reminder and a "your period may be late" note come as bells that never say what they're
  about ("A reminder from My Cycle"). No emails.
- **Who sees the menu item.** Adults and teens who answered "I'm female". It is hidden for "Not for me", kids mode and organisation accounts.

## Legal (for counsel before launch)

Health data is sensitive personal data under NDPA 2023, so it needs explicit consent. That is the first-open screen plus a short consent
line naming what is kept and why. Teens are already under parental consent (`docs/YOUNG_MEMBERS.md`); the parent is told that My Cycle
exists, not what she logs. Add a My Cycle section to the Privacy Policy and the "How we treat young members" page. Not a medical device:
no diagnosis, no contraception claims.

## Build order (after approval)

1. `lib/cycle.ts` (predictions, phases, teen filter) with unit tests, and `lib/cycle-server.ts` (encrypted store, unlock cookie) with emulator tests.
2. Pages: `/cycle` (Today, Calendar, Check-in, Insights, Ask Nana), first open, lock and privacy shield.
3. Nana prompts, the monthly report and bells.
4. Public pages, a help article, the changelog, HANDOVER and BUILD_LOG, then the version bump.
