# Nana's avatar maker

Owner, 17 Nov 2026: members turn a photo of themselves into an illustrated portrait, in the flat editorial style of the approved
example, and use it as their profile picture with a "Made with Nana AI" mark.

## What it does

On **Edit profile**, under the avatar field, **✨ Make an avatar with Nana**: choose a photo (JPEG, PNG or WebP, up to 8 MB), wait up
to a minute, and **Use this picture** puts the result in the avatar field. Saving the profile makes it the profile picture, like any
upload. The picture is 1024 × 1024 with the [na] icon and "Made with Nana AI" in the bottom left corner, drawn by our server.

## How it works

- `lib/avatar-maker.ts`: the rules (gate, daily number, sizes, the prompt). Pure.
- `lib/avatar-providers.ts`: the image models. **Claude does not make pictures**, so the portrait comes from an image model:
  OpenAI (`/v1/images/edits`, default model `gpt-image-1`) or Google (`generateContent`, default `gemini-2.5-flash-image`).
- `lib/avatar-render.tsx`: the mark, drawn with next/og like course covers, then WebP.
- `lib/avatar-maker-server.ts`: checks who may use it, the day's count (`avatarCounts/{uid}_{day}`, server-only), draws, marks and
  stores the picture in the media bucket under `avatars/{uid}/`.
- `POST /api/avatar-maker` (form field `photo`), `GET /api/avatar-maker` (who may use it, how many are left today).
- `components/AvatarMaker.tsx` on `app/(main)/profile/edit/page.tsx`.

The member's photo is sent to the image provider and is not stored by us. Only the finished avatar is kept.

## Settings (Vercel → Environment Variables)

| Setting | What |
| --- | --- |
| `AVATAR_IMAGE_PROVIDER` | `openai` or `gemini` |
| `AVATAR_IMAGE_KEY` | that account's API key |
| `AVATAR_IMAGE_MODEL` | only to change the model |

Without the first two the panel says it isn't set up.

## Gate

Team-only: the #NotesApp team while the **staff test pass** is on (Admin → Limits). `AVATAR_MAKER_FOR_EVERYONE` in
`lib/avatar-maker.ts` opens it. While it is team-only each person may make 10 a day (`AVATAR_PER_DAY`), counted only when a picture
was made.

## Before it opens (not done yet)

1. **It has never been run against a real image model.** The owner asked for a provider-neutral build; the two adapters are tested
   with stand-ins only. Add a key, make a few avatars on the staff pass, and compare the two providers' results and prices.
2. **Paying for it.** Each avatar costs us an image-model call. Decide: charged to Nana credit, or a daily number per plan in
   Admin → Pricing (as course covers are).
3. **Safeguards.** "Use your own photo" is a request, not a check. Decide what applies to young members' accounts and to photos of
   other people before it is open to everyone, and whether avatars go through the content checks that uploads get.
4. **Screenshots** of the panel on phone and desktop, for approval.

## Tests

`npm run test:avatar` (the rules and both providers, with a stand-in fetch) and `npm run test:avatar-server` (the gate, the daily
number and the real mark, on the Firestore emulator).

## Shared with the portrait studio (v0.184.0)

Nana AI's portrait studio (`docs/NANA_PORTRAIT_STUDIO.md`) runs on this engine: the same image models, gate and daily number
(`makePortrait`). `drawAvatar` takes the prompt as an argument; the avatar maker still sends `AVATAR_PROMPT`.
