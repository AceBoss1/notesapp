// The room recorder (docs/RECORDER.md). A small HTTP service that our app calls, signed with RECORDER_SECRET, when a recorded audio room
// starts and ends. For each recording it opens the app's hidden recorder page (/rooms/record/<room>?token=…) in headless Chromium; the
// page joins the room through the relay as a silent, receive-only participant and records with MediaRecorder. This process takes each
// ~10-second chunk from the page, signs it and uploads it to the app (/api/rooms/recorder), which writes it to the private bucket with a
// multipart upload; when the room ends (or the longest length is reached) it finalizes. It never runs on anyone's phone.
//
//   POST /start  { rid, roomId, pageUrl, uploadUrl, maxSeconds, chunkSeconds }   (signed)  → 202
//   POST /stop   { rid }                                                          (signed)  → 202
//   GET  /health                                                                            → { ok, recording }
//
// Settings (environment): RECORDER_SECRET (the same as the app's), PORT (Cloud Run sets it), APP_ORIGIN (optional: the only origin the
// recorder will open and upload to, e.g. https://www.example.com; without it, pageUrl and uploadUrl must at least share an origin),
// MAX_RECORDINGS (at once on one instance, default 4).
import http from "node:http";
import { chromium } from "playwright";
import { SIGNATURE_HEADER, signBody, verifySignature } from "./sign.mjs";

const SECRET = (process.env.RECORDER_SECRET || "").trim();
const PORT = Number(process.env.PORT || 8080);
const APP_ORIGIN = (process.env.APP_ORIGIN || "").trim().replace(/\/$/, "");
const MAX = Math.max(1, Number(process.env.MAX_RECORDINGS || 4));
if (!SECRET) { console.error("RECORDER_SECRET is required"); process.exit(1); }

const log = (...a) => console.log(new Date().toISOString(), ...a);
const running = new Map(); // rid → { page, context, uploadUrl, done, stopTimer }
let browser = null;
const getBrowser = async () => {
  if (browser?.isConnected()) return browser;
  browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream", "--disable-dev-shm-usage"] });
  return browser;
};

// Signed calls to the app, with a few tries (a chunk is never dropped quietly: after the tries the page is told and the app's cron
// finishes the recording from what arrived).
async function toApp(url, body, contentType) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": contentType, [SIGNATURE_HEADER]: signBody(SECRET, body) }, body, signal: AbortSignal.timeout(30_000) });
      if (r.ok) return await r.json().catch(() => ({}));
      const text = await r.text().catch(() => "");
      if (r.status < 500 && r.status !== 429) throw new Error(`app answered ${r.status}: ${text.slice(0, 200)}`);
    } catch (e) {
      if (i === 3 || /app answered 4/.test(String(e))) throw e;
    }
    await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
  }
}
const appJson = (rec, obj) => toApp(rec.uploadUrl, JSON.stringify(obj), "application/json");

async function startRecording(job) {
  const ctx = await (await getBrowser()).newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = { page, context: ctx, uploadUrl: job.uploadUrl, finished: false };
  running.set(job.rid, rec);
  const finish = async (info) => {
    if (rec.finished) return;
    rec.finished = true;
    clearTimeout(rec.stopTimer);
    try { await appJson(rec, { action: "finalize", rid: job.rid, hadVideo: !!info?.hadVideo, seconds: Number(info?.seconds) || 0 }); log("finalized", job.rid); }
    catch (e) { log("finalize failed", job.rid, String(e)); }
    running.delete(job.rid);
    await ctx.close().catch(() => {});
  };
  rec.finish = finish;
  await page.exposeFunction("recorderChunk", async (file, seq, b64) => {
    const bytes = Buffer.from(b64, "base64");
    const u = new URL(job.uploadUrl); u.searchParams.set("rid", job.rid); u.searchParams.set("file", file); u.searchParams.set("seq", String(seq));
    await toApp(u.toString(), bytes, "application/octet-stream");
  });
  await page.exposeFunction("recorderEvent", async (type, detail) => {
    log("page", job.rid, type, detail || "");
    if (type === "recording") await appJson(rec, { action: "status", rid: job.rid, status: "recording" }).catch((e) => log("status failed", String(e)));
  });
  await page.exposeFunction("recorderDone", (info) => finish(info));
  page.on("crash", async () => {
    log("page crashed", job.rid);
    await appJson(rec, { action: "status", rid: job.rid, status: "failed", why: "the recorder's page crashed" }).catch(() => {});
    await finish({});
  });
  // The longest length (Admin → Limits → Live recording): stop, send the rest, finalize.
  rec.stopTimer = setTimeout(() => stopRecording(job.rid), Math.max(60, Number(job.maxSeconds) || 4 * 3600) * 1000);
  await page.goto(job.pageUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  log("recording", job.rid, "room", job.roomId);
}
async function stopRecording(rid) {
  const rec = running.get(rid);
  if (!rec || rec.finished) return;
  await rec.page.evaluate(() => window.recorderStop?.()).catch(() => {});
  // The page finalizes through recorderDone; if it can't within two minutes, finalize from what arrived.
  setTimeout(() => rec.finish?.({}), 120_000).unref();
}

const sameOrigin = (a, b) => { try { return new URL(a).origin === new URL(b).origin; } catch { return false; } };
function okJob(j) {
  if (!j || typeof j.rid !== "string" || !/^[A-Za-z0-9_-]{6,80}$/.test(j.rid) || typeof j.pageUrl !== "string" || typeof j.uploadUrl !== "string") return false;
  if (!/^https?:\/\//.test(j.pageUrl) || !sameOrigin(j.pageUrl, j.uploadUrl)) return false;
  return !APP_ORIGIN || new URL(j.pageUrl).origin === APP_ORIGIN;
}

http.createServer(async (req, res) => {
  const send = (status, obj) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === "GET" && req.url === "/health") return send(200, { ok: true, recording: running.size });
    if (req.method !== "POST") return send(404, { error: "not found" });
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > 64 * 1024) return send(413, { error: "too big" }); chunks.push(c); }
    const raw = Buffer.concat(chunks);
    if (!verifySignature(SECRET, req.headers[SIGNATURE_HEADER], raw)) return send(401, { error: "bad signature" });
    const body = JSON.parse(raw.toString() || "{}");
    if (req.url === "/start") {
      if (!okJob(body)) return send(400, { error: "bad job" });
      if (running.has(body.rid)) return send(202, { ok: true, already: true });
      if (running.size >= MAX) return send(503, { error: "busy: this recorder is full" });
      startRecording(body).catch(async (e) => {
        log("start failed", body.rid, String(e));
        const rec = running.get(body.rid);
        await toApp(body.uploadUrl, JSON.stringify({ action: "status", rid: body.rid, status: "failed", why: "the recorder couldn't open the room" }), "application/json").catch(() => {});
        if (rec) await rec.finish?.({}); else running.delete(body.rid);
      });
      return send(202, { ok: true });
    }
    if (req.url === "/stop") { await stopRecording(String(body.rid || "")); return send(202, { ok: true }); }
    return send(404, { error: "not found" });
  } catch (e) {
    log("request failed", String(e));
    return send(500, { error: "failed" });
  }
}).listen(PORT, () => log(`room recorder on :${PORT}`));

// Cloud Run sends SIGTERM before it stops an instance: every recording is stopped and finalized first (it has ten seconds).
process.on("SIGTERM", async () => {
  log("SIGTERM: stopping", running.size);
  await Promise.all([...running.keys()].map((rid) => stopRecording(rid)));
  await new Promise((r) => setTimeout(r, 8000));
  await Promise.all([...running.values()].map((rec) => rec.finish?.({})));
  process.exit(0);
});
