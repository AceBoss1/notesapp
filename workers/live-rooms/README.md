# Live rooms worker

Chat and live signals for #NotesApp's big audio rooms (v0.127.0): a Cloudflare Worker with one Durable Object (`LiveRoom`) per room,
using the WebSocket Hibernation API. The design is in `lib/live-rooms.ts`; the owner's steps are HANDOVER item 99. This folder is not
part of the Next.js build (the app's `tsconfig.json` excludes `workers/`); wrangler bundles `src/index.ts` together with the shared
`lib/live-token.ts`, `lib/live-rooms.ts` and `lib/rooms.ts`.

- `GET /health` → `ok` once `LIVE_ROOMS_SECRET` is set.
- `GET /rooms/<id>/ws?t=<token>` → the room's WebSocket (a 10-minute token from `/api/community/rooms`, action `livetoken`).
- `POST /rooms/<id>/server` → our server's signed calls (config, stage moves, chat sent through the server, removals, the end).
- The room reports to our server (`/api/community/rooms/edge`, signed) with the chat in batches, removals, bans and the count.

## Deploying

Normally: GitHub → Actions → **Deploy live rooms** → Run workflow (it also runs on pushes to `main` that change this folder). It needs
the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and skips (green) without them.

By hand, from this folder (Node 20+):

```
npx wrangler@4.40.0 login            # or: export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…
npx wrangler@4.40.0 deploy           # prints the workers.dev address
npx wrangler@4.40.0 secret put LIVE_ROOMS_SECRET   # paste the same value as LIVE_ROOMS_SECRET on Vercel
curl https://notesapp-live-rooms.YOUR-SUBDOMAIN.workers.dev/health   # → ok
```

Then on Vercel: `NEXT_PUBLIC_LIVE_ROOMS_URL` = `wss://notesapp-live-rooms.YOUR-SUBDOMAIN.workers.dev`, redeploy. Logs:
`npx wrangler@4.40.0 tail`. Checks: `npm run test:live-rooms` from the repository root (type-checks this folder too).
