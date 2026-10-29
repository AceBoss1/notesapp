# The #NotesApp mobile apps: release plan

> Status: **scaffolded, not built.** Written 29 October 2026. The apps follow NotesApp Inc (Delaware, due in about two weeks), which
> will own the App Store and Google Play accounts. The starting files are in `mobile/` (see its README).

## 1. The approach: one codebase, wrapped

#NotesApp already installs from the browser (`app/manifest.ts`, the welcome screen at the app address, `public/sw.js` for push and
calls). The store apps wrap that same app with **Capacitor**, so every change we ship on the web reaches the apps the same day, with
no second codebase to keep in step.

The wrapper opens the app address (`app.notesapp.name.ng`, later on `notesapp.tech`) and adds what only a store app can do. Apple
turns down apps that are only a website in a frame, so these come in the first release, not later:

| Native piece | Why |
|---|---|
| Push notifications (APNs and FCM) | Messages, calls ringing, bookings, reminders; iPhones don't take web push reliably |
| Camera and photo picker | Moments, posts, chat pictures, chat backgrounds |
| The share sheet | Share posts and profiles into WhatsApp and the rest |
| Sign in with Apple | Apple asks for it when other sign-ins are offered |
| Biometrics (Face ID, fingerprint) | Opening the wallet and confirming payments |
| Offline: drafts and Exam Prep packs | The pack already works offline on the web |
| A native splash screen, icons and status bar in Day or Night | It should feel like an app from the first tap |

## 2. Paying inside the apps (the store rules)

Apple and Google take a share of **digital** things sold inside an app (plans, add-ons, Nana credit, emoji packs, chat backgrounds,
boosts), and ask that they go through their own billing. **Physical goods and real-world services are exempt:** shop orders, merch,
and booked sessions with a person can keep using Paystack and Paylony.

The plan for the first release:

- **Bookings, shop orders and merch:** Paystack and Paylony, as on the web.
- **Plans and other digital purchases:** not sold inside the first release. The app says "Manage your plan on notesapp.name.ng";
  where the store allows a link out to the web (the US App Store does today), it links to it.
- **Later, if it pays:** add store billing for plans, priced to cover the store's share.

Check the stores' current rules with the release, since they keep changing.

## 3. The accounts (after NotesApp Inc exists)

1. **D-U-N-S number** for NotesApp Inc (free from Dun & Bradstreet; can take a few weeks, so start the day the company exists).
2. **Apple Developer Program** as an organisation ($99 a year), in NotesApp Inc's name, with the D-U-N-S number.
3. **Google Play Console** as an organisation ($25 once), in NotesApp Inc's name.
4. **Firebase Cloud Messaging and an APNs key** for push (our Firebase project already exists).
5. **App IDs:** `tech.notesapp.app` on both stores (it follows the notesapp.tech domain we're moving to, `docs/DOMAIN_SWITCH.md`).
   An app ID can never change after release, so the owner confirms it first.

## 4. Release steps

| Step | What | Who |
|---|---|---|
| 1 | NotesApp Inc incorporated; D-U-N-S applied for | Owner |
| 2 | Apple and Google accounts opened in the Inc's name | Owner |
| 3 | `mobile/`: install Capacitor, add the iOS and Android projects, icons and splash (from `public/images/brand/`) | Engineering |
| 4 | Native pieces in §1; the app address detects it's inside the app and hides "Install the app" | Engineering |
| 5 | Store listings (drafts in `mobile/store/`), screenshots in Day and Night, the privacy answers | Engineering and owner |
| 6 | Internal testing: TestFlight (iPhone) and Google Play internal testing, the team first | Team |
| 7 | Closed test with members (Google asks for 12 testers over 14 days for a new personal account; an organisation account skips this) | Team |
| 8 | Release in Nigeria first, then Ghana and Kenya with Flutterwave (`docs/PAYMENTS.md` §4), then everywhere | Owner |

## 5. What the owner decides

1. The app ID (`tech.notesapp.app` suggested).
2. The store name: "#NotesApp" may not be allowed with the "#"; "NotesApp" with the subtitle "Publish. Book. Get paid." is the
   suggestion.
3. Whether plans are sold in the apps through store billing later, or only on the web.
