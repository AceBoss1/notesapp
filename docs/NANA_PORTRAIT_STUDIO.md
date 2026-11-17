# Nana AI, the portrait studio

`nana.notesapp.name.ng` and `nana.naapp.tech`: a member uploads a photo, picks one of three looks, and gets a polished professional
portrait for a journal byline or a profile. The design came from the owner's own v0 project (`nana-ai-av`), which ran as a separate
Vercel project. Its sign-in never worked: it asked its own server for `/api/auth/firebase-config`, which didn't exist, and its
"Sign in with NotesApp" sent people to the main site's login, which only hands a signed-in session back to members' own domains.

The owner chose **Option B** on 17 Nov 2026: move it into the main app, the way Exam Prep (`prep.*`) and Notes Life (`life.*`) live
on their own addresses. Built in v0.184.0.

## How it works

- **Address.** `lib/host.ts` gives `nana.<domain>` its own role (`roleOf` → `"nana"`, `NANA_HOST`, `isNanaHost`). `middleware.ts` shows
  the studio at `/`, signing in at `/signin`, `/login` and `/signup`, passes the app's files and `/api/*`, and sends anything else to
  the main site in the visitor's own family. On the main site and the app, `/nana-studio` redirects to the Nana address. (`/nana` is
  Nana chat, a different thing, and stays on the main site.)
- **Sign-in on its own address.** `app/nana-studio/signin` uses the app's own sign-in and sign-up forms, like Exam Prep. A Firebase
  session belongs to one address, so this is what makes sign-in work; no hand-off and no config route are needed.
- **The page.** `app/nana-studio` and `components/nana/PortraitStudio.tsx`, with the design's stylesheet ported to
  `components/nana/nana-studio.css` (every rule inside `.nana-app`, so it can't touch the rest of NotesApp; Night mode is switched off
  for it with `data-theme-off`). The photo is made smaller in the browser (1280 px, JPEG) before it is sent.
- **The server.** `GET /api/portrait/access` (the plan, whether the member may make portraits, how many are left today) and
  `POST /api/portrait/generate` (form: `image`, `style`, `prompt`, `intensity`) → `{ image: "data:image/…", marked, left }`. They run on
  **Nana's avatar maker's engine** (`docs/AVATAR_MAKER.md`): the same image models (`AVATAR_IMAGE_PROVIDER`, `AVATAR_IMAGE_KEY`), the
  same gate, and **one daily number shared with avatars** (`avatarCounts`). `lib/nana-portrait.ts` holds the three looks and builds
  the prompt (the look, how strongly from the slider, and the member's own words, fenced in so they can't change who the person is).
- **The mark.** Free plans (Free, Free Basic) get "Made with Nana AI" and the [na] icon drawn into the picture **on our server**
  (`markAvatar`). Pro, Business and Enterprise get the picture as the model drew it. In the v0 version the mark was added only when
  the picture was downloaded, in the browser, so it was easy to strip; here it is part of the picture.
- **Nothing kept.** The photo goes to the image model and is not stored; the portrait comes back to the page and the member
  downloads it (Export).

## Gate

The same as the avatar maker: the #NotesApp team while the **staff test pass** is on (Admin → Limits), 10 Nana pictures a day each.
`AVATAR_MAKER_FOR_EVERYONE` in `lib/avatar-maker.ts` opens both. Everyone else can open the page and sign in, and is told it opens soon.

## Differences from the v0 version

- No "Try our family photo sample": the sample photo lived on v0's own storage, which couldn't be reached from here. Add one to
  `public/images/nana/` to bring it back.
- The mascot is the app's own Nana picture (`/images/nana/nana-sm.webp`).
- The mark is drawn by our server (above), and the daily number and gate are the avatar maker's.

## Owner steps

1. **Move the two domains to the NotesApp Vercel project.** In Vercel, remove `nana.notesapp.name.ng` and `nana.naapp.tech` from the
   v0 project and add them to the NotesApp project. Until then they keep showing the old v0 version.
2. **Firebase → Authentication → Settings → Authorized domains:** add `nana.notesapp.name.ng` and `nana.naapp.tech` (sign-in is refused
   on an address that isn't listed).
3. **To try it:** set `AVATAR_IMAGE_PROVIDER` and `AVATAR_IMAGE_KEY` in Vercel (if not already done for the avatar maker), switch the
   staff test pass on, and sign in with a team account. **Free:** `AVATAR_IMAGE_PROVIDER=cloudflare` with a Cloudflare API token that
   has the Workers AI permission (`docs/AVATAR_MAKER.md` "The free option"). `openai` and `gemini` need a paid API key.
4. Nothing to deploy in Firestore: `avatarCounts` is already server-only.

The storage upload list (`scripts/r2-cors.json`) doesn't need the Nana addresses: the studio never uploads to storage from the browser.

## Before it opens to everyone

Everything in `docs/AVATAR_MAKER.md` "Before it opens" applies: run it against a real image model and compare results and prices,
decide what a portrait costs (or a number per plan), and the safeguards for young members and photos of other people. Also: the
v0 project can be retired once the domains have moved.

## Tests

`npm run test:nana-portrait` (the address, looks, prompt and plans) and `npm run test:nana-portrait-server` (the gate, the shared daily
number, the prompt reaching the model, the mark for free plans and none for paid plans, on the Firestore emulator).
