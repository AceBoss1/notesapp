// The live-rooms worker's shared pure parts (lib/live-token.ts, lib/live-rooms.ts): tokens and signed bodies, rate limits, slow mode at
// the edge, batching and the count cadence. No network, no Cloudflare. Run: npm run test:live-rooms → "ALL OK".
import assert from "node:assert/strict";
import * as T from "../../lib/live-token";
import * as L from "../../lib/live-rooms";
import { builtInArticles } from "../../lib/kb-articles";
import { DEFAULT_ROOM_FIGURES, listenerPresent, roomFigures, roomSettings } from "../../lib/rooms";

const SECRET = "test-secret-test-secret-test";
(async () => {
  // ── tokens ──
  const now = Date.parse("2026-11-02T10:00:00Z");
  const claims: T.LiveClaims = { r: "room_1", u: "uid1", role: "listener", n: "Ada", a: "https://x/a.png", mod: false, exp: now / 1000 + T.LIVE_TOKEN_TTL_S };
  const tok = await T.signLiveToken(SECRET, claims);
  assert.match(tok, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "base64url, two parts");
  assert.deepEqual(await T.verifyLiveToken(SECRET, tok, now), claims);
  assert.equal(await T.verifyLiveToken("other-secret-other-secret", tok, now), null, "wrong secret");
  assert.equal(await T.verifyLiveToken(SECRET, tok, now + T.LIVE_TOKEN_TTL_S * 1000), null, "expired");
  const [body, sig] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ ...claims, role: "host" })).toString("base64url");
  assert.equal(await T.verifyLiveToken(SECRET, `${forged}.${sig}`, now), null, "a changed role is refused");
  assert.equal(await T.verifyLiveToken(SECRET, `${body}.${sig.slice(0, -2)}AA`, now), null, "a changed signature is refused");
  for (const bad of [null, 42, "", "a.b.c", "nodot", `${body}.`, "!!!.???"]) assert.equal(await T.verifyLiveToken(SECRET, bad, now), null, `refuses ${String(bad)}`);
  assert.equal(await T.verifyLiveToken("", tok, now), null, "no secret, no entry");
  const odd = await T.signLiveToken(SECRET, { ...claims, role: "admin" as T.LiveRole });
  assert.equal(await T.verifyLiveToken(SECRET, odd, now), null, "unknown roles are refused even when signed");
  await assert.rejects(T.signLiveToken("", claims), /LIVE_ROOMS_SECRET/);

  // ── signed bodies ──
  const b = JSON.stringify({ roomId: "room_1", chat: [] });
  const h = await T.signBody(SECRET, b, now);
  assert.match(h, /^t=\d+,s=[0-9a-f]{64}$/);
  assert.equal(await T.verifyBody(SECRET, b, h, now), true);
  assert.equal(await T.verifyBody(SECRET, b, h, now + T.LIVE_SIG_SKEW_MS - 1), true, "within the clock skew");
  assert.equal(await T.verifyBody(SECRET, b, h, now + T.LIVE_SIG_SKEW_MS + 1), false, "too old: a replay later is refused");
  assert.equal(await T.verifyBody(SECRET, b + " ", h, now), false, "a changed body");
  assert.equal(await T.verifyBody("other-secret-other-secret", b, h, now), false);
  assert.equal(await T.verifyBody(SECRET, b, null, now), false);
  assert.equal(await T.verifyBody(SECRET, b, "t=1,s=zz", now), false);

  // ── rate limits: a burst, then the steady rate ──
  let bucket: L.Bucket | undefined;
  const r = L.LIVE_CHAT_RATE;
  let allowed = 0;
  for (let i = 0; i < 10; i++) { const x = L.take(bucket, r, now); bucket = x.bucket; if (x.ok) allowed++; }
  assert.equal(allowed, r.burst, "the burst");
  assert.equal(L.take(bucket, r, now + 1000).ok, false, "half a token a second: not yet");
  const after2s = L.take(bucket, r, now + 2000);
  assert.equal(after2s.ok, true, "one more after 2 s");
  assert.equal(L.take(after2s.bucket, r, now + 2001).ok, false);
  assert.ok(L.take(undefined, r, now + 3_600_000).bucket.tokens <= r.burst, "never more than the burst");

  // ── slow mode at the edge ──
  const cfg = { slowAbove: 200, slowSeconds: 10 };
  assert.equal(L.liveSlow(200, cfg, null), 0, "automatic: at the setting, off");
  assert.equal(L.liveSlow(201, cfg, null), 10, "automatic: past it, on");
  assert.equal(L.liveSlow(5, cfg, true), 10, "the host switched it on");
  assert.equal(L.liveSlow(5000, cfg, false), 0, "the host switched it off");
  assert.equal(L.liveSlow(5, { slowAbove: 200, slowSeconds: 0 }, true), 2, "on means at least 2 s");
  assert.equal(L.liveSlow(5000, null, null), 0, "no settings yet: off");
  assert.equal(L.liveWait("listener", now - 3000, 10, now), 7);
  assert.equal(L.liveWait("listener", now - 10_000, 10, now), 0);
  assert.equal(L.liveWait("listener", undefined, 10, now), 0, "first message");
  assert.equal(L.liveWait("speaker", now, 10, now), 0, "speakers are never slowed");
  assert.equal(L.liveWait("host", now, 10, now), 0);

  // ── text and ids ──
  assert.equal(L.cleanLiveText("  hi  "), "hi");
  assert.equal(L.cleanLiveText("x".repeat(900)).length, 500);
  assert.equal(L.cleanLiveText(42), "");
  const id = L.liveChatId(now, "abc123zz9");
  assert.equal(id, `${now}_abc123zz`);
  assert.ok(L.isLiveChatId(id)); assert.ok(!L.isLiveChatId("../x")); assert.ok(!L.isLiveChatId(`${now}_`));
  assert.ok(L.liveChatId(now, "a") < L.liveChatId(now + 1, "a"), "ids sort by time");

  // ── batching to our server ──
  assert.equal(L.batchDue(0, undefined, now), false);
  assert.equal(L.batchDue(3, now - 1000, now), false, "a few, recent: wait");
  assert.equal(L.batchDue(3, now - L.LIVE_BATCH_MS, now), true, "the oldest has waited long enough");
  assert.equal(L.batchDue(L.LIVE_BATCH_MAX, now, now), true, "a full batch goes at once");
  assert.equal(L.nextFlushAt(0, undefined, now), null);
  assert.equal(L.nextFlushAt(1, now - 1000, now), now - 1000 + L.LIVE_BATCH_MS);
  assert.equal(L.nextFlushAt(L.LIVE_BATCH_MAX, now - 1000, now), now);
  assert.deepEqual([1, 2, 3, 4, 10].map(L.retryDelay), [5_000, 10_000, 20_000, 40_000, 120_000]);
  assert.equal(L.capPending(Array.from({ length: L.LIVE_PENDING_MAX + 5 }, (_, i) => i))[0], 5, "the oldest go first");

  // ── the count to our server ──
  assert.equal(L.countPushDue(undefined, 0, now), true, "first report");
  assert.equal(L.countPushDue({ at: now - 10_000, n: 5 }, 9, now), false, "changed, but within 15 s");
  assert.equal(L.countPushDue({ at: now - 15_000, n: 5 }, 9, now), true, "changed, after 15 s");
  assert.equal(L.countPushDue({ at: now - 30_000, n: 5 }, 5, now), false, "unchanged");
  assert.equal(L.countPushDue({ at: now - L.LIVE_COUNT_KEEPALIVE_MS, n: 5 }, 5, now), true, "keepalive");
  assert.equal(L.edgeFresh({ edge: true, edgeAt: new Date(now - 10_000).toISOString() }, now), true);
  assert.equal(L.edgeFresh({ edge: true, edgeAt: new Date(now - L.EDGE_STALE_MS).toISOString() }, now), false, "stale: our server counts again");
  assert.equal(L.edgeFresh({ edge: false, edgeAt: new Date(now).toISOString() }, now), false);
  // presence of a listener on the worker: their join, or connected while the worker reports (no heartbeats)
  const edgeRoom = { edge: true, edgeAt: new Date(now - 30_000).toISOString() };
  const joinedLongAgo = { name: "A", avatar: "", at: "x", seen: new Date(now - 5 * 60_000).toISOString() };
  assert.equal(listenerPresent({ ...joinedLongAgo, edgeIn: true }, edgeRoom, now), true, "connected, no heartbeat needed");
  assert.equal(listenerPresent({ ...joinedLongAgo, edgeIn: false }, edgeRoom, now), false, "left the worker");
  assert.equal(listenerPresent({ ...joinedLongAgo, edgeIn: true }, { edge: true, edgeAt: new Date(now - L.EDGE_STALE_MS).toISOString() }, now), false, "the worker went quiet: heartbeats count again");
  assert.equal(listenerPresent({ ...joinedLongAgo, seen: new Date(now - 1000).toISOString() }, { edge: false }, now), true, "a heartbeat");
  assert.equal(listenerPresent(undefined, edgeRoom, now), false);

  // ── the browser ──
  assert.equal(L.liveSocketUrl("wss://w.example.workers.dev/", "r 1", "a.b"), "wss://w.example.workers.dev/rooms/r%201/ws?t=a.b");
  assert.equal(L.liveHttpBase("wss://w.example.workers.dev/"), "https://w.example.workers.dev");
  assert.equal(L.liveHttpBase("ws://127.0.0.1:8787"), "http://127.0.0.1:8787");
  assert.deepEqual([1, 2, 3, 6, 20].map((f) => L.reconnectDelay(f, 0.5)), [1000, 2000, 4000, 30_000, 30_000]);
  // ── the help: chat in big rooms and the host's slow mode, only when rooms use the worker, with the live figures ──
  const help = (f = DEFAULT_ROOM_FIGURES) => builtInArticles({ rooms: f }).find((a) => a.slug === "community-audio-rooms")!.body;
  assert.equal(DEFAULT_ROOM_FIGURES.liveChat, undefined);
  assert.equal(roomFigures(roomSettings(), false, true).liveChat, undefined, "phone to phone: no live chat");
  const edge = roomFigures(roomSettings({ chatSlowAbove: 321 }), true, true);
  assert.equal(edge.liveChat, true);
  assert.match(help(edge), /\*\*Chat in big rooms:\*\*/); assert.match(help(edge), /Slow mode is the host's tool/);
  assert.match(help(edge), /Automatic \(on past 321 listeners\)/, "the live setting");
  assert.doesNotMatch(help(roomFigures(roomSettings(), true)), /Chat in big rooms|host's tool/, "without the worker, the help doesn't promise it");
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
