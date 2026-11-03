# Room recorder

Records #NotesApp audio rooms whose host switched recording on. Our app calls `POST /start` and `POST /stop` (signed with
`RECORDER_SECRET`); the service opens the app's hidden recorder page in headless Chromium, which joins the room through the relay as a
silent, receive-only participant, and uploads ~10-second chunks back to the app, which stores them in the private R2 bucket.

How to deploy it on Google Cloud Run, and the protocol, are in [docs/RECORDER.md](../../docs/RECORDER.md).

Run locally: `npm install && RECORDER_SECRET=… node server.mjs` (port 8080).
