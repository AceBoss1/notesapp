# Nana Lite worker

Three small open models on Cloudflare, behind one Worker: **Phi-3.5-mini** (default), **Qwen2.5-1.5B** and **SmolLM2-1.7B**, each served
by llama.cpp in its own Cloudflare Container, answering at `https://lite.naapp.tech` and `https://lite.notesapp.name.ng`. The app
calls it from `lib/nana-lite-server.ts`. Full guide: `docs/NANA_LITE.md`.

- `POST /v1/chat/completions` with `Authorization: Bearer <NANA_LITE_KEY>`; `"model"` picks the container (an unknown one gets Phi).
- `GET /health` → `{ ok: true, models: […] }`.
- Each container sleeps after 30 minutes idle; the first answer after that waits while the model loads.
- Nothing a student types is logged (no body logging; observability off).

Deploy: Actions → **Deploy Nana Lite** (needs `CLOUDFLARE_API_TOKEN` with Workers Scripts: Edit and Containers: Edit, and
`CLOUDFLARE_ACCOUNT_ID`; optional `NANA_LITE_KEY`), or by hand with Docker running:

```
cd workers/nana-lite
npm install --legacy-peer-deps
npx wrangler deploy
npx wrangler secret put NANA_LITE_KEY
```
