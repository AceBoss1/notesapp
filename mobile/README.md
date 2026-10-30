# #NotesApp mobile apps (scaffold)

The iOS and Android apps wrap the app address with [Capacitor](https://capacitorjs.com). The plan, the store rules and the release
steps are in `docs/MOBILE-APPS.md`; this folder is the starting point, not a finished app.

- `capacitor.config.json`: the app ID (`tech.naapp.app`, confirmed 30 Oct 2026: it can't change after release), the name, the address
  it opens (`server.url`), the hosts it may open inside the app (checkout pages too), the splash and status bar colours.
- `www/index.html`: the offline page, shown only when the app address can't be reached.
- `store/listing.md`: draft store texts.
- `package.json`: its own packages, separate from the web app's, so the web build and CI don't change.

## First run (on a Mac with Xcode, and Android Studio)

```bash
cd mobile
npm install
npm run add:ios        # creates mobile/ios (commit it)
npm run add:android    # creates mobile/android (commit it)
npm run sync
npm run open:ios       # or open:android, then run on a device
```

Then, before any store upload (docs/MOBILE-APPS.md §1 and §4):

1. Icons and splash from `public/images/brand/` (`npx @capacitor/assets generate`).
2. Push: an APNs key in the Apple account and `google-services.json` from our Firebase project; the app sends its device token to
   the same place web push tokens go.
3. Sign in with Apple, the share sheet, the camera, biometrics for the wallet.
4. The web app hides "Install the app" when it runs inside the store app (Capacitor sets `window.Capacitor`).
5. No digital purchases inside the first release (docs/MOBILE-APPS.md §2).
