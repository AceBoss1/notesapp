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
  OpenAI (`/v1/images/edits`, default model `gpt-image-1`), Google (`generateContent`, default `gemini-2.5-flash-image`), or
  **Cloudflare Workers AI** (`/accounts/{account}/ai/run/{model}`, default `@cf/black-forest-labs/flux-2-klein-4b`; v0.184.0).
- `lib/avatar-render.tsx`: the mark, drawn with next/og like course covers, then WebP.
- `lib/avatar-maker-server.ts`: checks who may use it, the day's count (`avatarCounts/{uid}_{day}`, server-only), draws, marks and
  stores the picture in the media bucket under `avatars/{uid}/`.
- `POST /api/avatar-maker` (form field `photo`), `GET /api/avatar-maker` (who may use it, how many are left today).
- `components/AvatarMaker.tsx` on `app/(main)/profile/edit/page.tsx`.

The member's photo is sent to the image provider and is not stored by us. Only the finished avatar is kept.

## Settings (Vercel → Environment Variables)

| Setting | What |
| --- | --- |
| `AVATAR_IMAGE_PROVIDER` | `openai`, `gemini` or `cloudflare` |
| `AVATAR_IMAGE_KEY` | that account's API key (for `cloudflare`: an API token with the Workers AI permission) |
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

## The free option: Cloudflare Workers AI (v0.184.0)

Owner, 17 Nov 2026: no OpenAI or Google key, "any free option". Neither OpenAI's nor Google's image models have a free API tier, but
Cloudflare Workers AI gives every account a free daily allowance (10,000 "neurons", reset at midnight UTC) and hosts FLUX.2 models
that take a photo as a reference picture. Set:

| Setting | Value |
| --- | --- |
| `AVATAR_IMAGE_PROVIDER` | `cloudflare` |
| `AVATAR_IMAGE_KEY` | a Cloudflare API token: dash.cloudflare.com → My Profile → API Tokens → Create Token → **Workers AI** template (or a custom token with Account → Workers AI → Read and Edit), for the NotesApp account |
| `CLOUDFLARE_ACCOUNT_ID` | only if Workers AI is on a different account from R2; otherwise `R2_ACCOUNT_ID` is used |
| `AVATAR_IMAGE_MODEL` | only to change the model, e.g. `@cf/black-forest-labs/flux-2-klein-9b` or `@cf/black-forest-labs/flux-2-dev` |

How it works: the photo is made at most 512 pixels a side on our server first (FLUX.2 takes reference pictures that small;
`fitPhoto`, with the encoder Next.js already ships), then sent as a form (`prompt`, `input_image_0`, `width`, `height`). The answer's
base64 picture is marked and used like the others. When the day's free allowance is used up, members are told "Nana has made all
the pictures it can for today. Please try again tomorrow." (429), not that something broke.

Not checked from here (Cloudflare's own pages couldn't be reached from the build environment; the request and answer shapes come from
Cloudflare's published type definitions): how many neurons one picture costs, whether these models are still on the free plan (some
models left it on 28 Jul 2026), and how well FLUX.2 keeps a person's likeness compared with OpenAI's model. Try a few before opening it.
Open models filter less than OpenAI's and Google's, which makes the safeguards in "Before it opens" more important. If the allowance
runs out often, a Workers Paid plan ($5 a month) charges for use beyond it.

