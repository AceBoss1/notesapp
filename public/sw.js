// #NotesApp service worker: shows web-push notifications (new messages, replies to moments, calls) and opens the right page on tap.
// A push carries only who it's from, never the message text.
// Calls ring even when #NotesApp isn't open: the notification stays until answered, buzzes and sounds again every few seconds while
// the call is still ringing (checked with /api/calls/ring), and offers Answer and Decline. "call_end" closes it.
const RING_EVERY_MS = 4000, RING_FOR_MS = 44000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* not JSON */ }
  if (data.kind === "call_end") {
    event.waitUntil(self.registration.getNotifications({ tag: `call-${data.callId}` }).then((list) => list.forEach((n) => n.close())));
    return;
  }
  if (data.kind === "call") {
    // #NotesApp open on screen: it rings there already.
    event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => (list.some((c) => c.visibilityState === "visible" && c.focused) ? undefined : ring(data))));
    return;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "#NotesApp", {
      body: data.body || "",
      icon: "/images/brand/notesapp-icon.webp",
      badge: "/images/brand/notesapp-icon.webp",
      tag: data.url || "notesapp", // one notification per conversation
      data: { url: data.url || "/messages" },
    })
  );
});

async function ring(data) {
  const tag = `call-${data.callId}`;
  const show = (again) => self.registration.showNotification(data.title || "Incoming call", {
    body: `${data.body || "Someone"} is calling you on #NotesApp`,
    icon: "/images/brand/notesapp-icon.webp",
    badge: "/images/brand/notesapp-icon.webp",
    tag, renotify: again, requireInteraction: true, silent: false,
    vibrate: [700, 300, 700, 300, 700],
    actions: [{ action: "answer", title: "Answer" }, { action: "decline", title: "Decline" }],
    data: { url: data.url || "/messages", callId: data.callId, token: data.token, call: true },
  });
  await show(false);
  const until = Date.now() + RING_FOR_MS;
  while (Date.now() < until) {
    await sleep(RING_EVERY_MS);
    const open = await self.registration.getNotifications({ tag });
    if (!open.length) return; // answered, declined or closed
    const still = await fetch(`/api/calls/ring?id=${encodeURIComponent(data.callId)}&token=${encodeURIComponent(data.token || "")}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ ringing: true }));
    if (!still.ringing) { open.forEach((n) => n.close()); return; }
    await show(true); // sound and buzz again
  }
  (await self.registration.getNotifications({ tag })).forEach((n) => n.close());
}

self.addEventListener("notificationclick", (event) => {
  const d = event.notification.data || {};
  event.notification.close();
  if (d.call && event.action === "decline") {
    event.waitUntil(fetch("/api/calls/ring", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.callId, token: d.token }) }).catch(() => {}));
    return;
  }
  const url = d.url || "/messages"; // a call's url carries ?answer=<id>, so the app answers it as soon as it opens
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.indexOf(self.location.origin) === 0 && "focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Business books offline (/profile/books; docs/BUSINESS-BOOKS.md, step 8). The page itself: the network first, then the copy saved the
// last time it opened with a connection. Its scripts and styles: the saved copy first (file names change with each release). The data
// (the day's home, items, prices and customers) and the outbox of entries made offline are kept by the page in IndexedDB
// (components/books/outbox.tsx); no API answer is cached here.
const BOOKS_CACHE = "books-pages-v1";
const booksPage = (url) => url.origin === self.location.origin && url.pathname === "/profile/books";
const fromBooks = (req) => { try { return new URL(req.referrer).pathname === "/profile/books"; } catch (e) { return false; } };

// Background Sync (Chrome on Android): when the connection comes back, send the outbox. With Books open, the page does it (it has a
// fresh sign-in); with it closed, the worker sends it with the last sign-in the page left (an hour at most) and leaves anything it can't
// send for the page. The server saves each entry once (its clientId), so both trying is safe.
const OUTBOX_DB = "notesapp-books";
const idb = () => new Promise((res, rej) => { const r = indexedDB.open(OUTBOX_DB, 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("outbox")) d.createObjectStore("outbox", { keyPath: "clientId" }); if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbReq = (d, store, mode, fn) => new Promise((res, rej) => { const t = d.transaction(store, mode); const q = fn(t.objectStore(store)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); });
async function flushOutbox() {
  const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const books = open.filter((c) => { try { return new URL(c.url).pathname === "/profile/books"; } catch (e) { return false; } });
  if (books.length) { books.forEach((c) => c.postMessage({ type: "books-sync" })); return; }
  const d = await idb();
  const tok = await idbReq(d, "kv", "readonly", (s) => s.get("token"));
  if (!tok || !tok.token || Date.now() - tok.at > 55 * 60 * 1000) return; // no fresh sign-in: the page sends it next time it opens
  const all = (await idbReq(d, "outbox", "readonly", (s) => s.getAll())) || [];
  const waiting = all.filter((x) => (x.state === "waiting" || x.state === "sending") && x.nextTryAt <= Date.now());
  const byOwner = {};
  waiting.forEach((x) => { (byOwner[x.owner] = byOwner[x.owner] || []).push(x); });
  for (const owner of Object.keys(byOwner)) {
    const batch = byOwner[owner].sort((a, b) => (a.at < b.at ? -1 : 1)).slice(0, 25);
    const res = await fetch("/api/books", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok.token}` }, body: JSON.stringify({ action: "sync", owner, items: batch.map((x) => ({ clientId: x.clientId, action: x.action, at: x.at, body: x.body })) }) });
    if (!res.ok) throw new Error(`sync ${res.status}`); // Background Sync tries again later
    const results = ((await res.json()).results) || [];
    await idbReq(d, "outbox", "readwrite", (s) => {
      for (const r of results) {
        const x = batch.find((y) => y.clientId === r.clientId);
        if (!x) continue;
        if (r.status === "saved" || r.status === "duplicate") s.put(Object.assign({}, x, { state: "done", result: r, doneAt: new Date().toISOString() }));
        else if (r.retry) s.put(Object.assign({}, x, { state: "waiting", tries: x.tries + 1, nextTryAt: Date.now() + 60000, result: r, lastError: r.error }));
        else s.put(Object.assign({}, x, { state: "stuck", result: r, lastError: r.error }));
      }
    });
  }
  const after = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  after.forEach((c) => c.postMessage({ type: "books-synced" }));
}
self.addEventListener("sync", (event) => {
  if (event.tag === "books-outbox") event.waitUntil(flushOutbox());
});

// Naija Exam Prep offline (prep.<domain>, or /exam-prep on one host). Nothing else on #NotesApp is touched: other pages and every
// API call go to the network as usual. Prep pages: the network first, then the copy saved when a pack was saved (lib/exam-prep-
// local.ts cachePages), then the offline hub. Their scripts and styles: the saved copy first (file names change with each release).
const PREP_CACHE = "prep-pages-v1";
const isPrepHost = () => self.location.hostname.startsWith("prep.");
const prepPage = (url) => url.origin === self.location.origin && (url.pathname === "/exam-prep" || url.pathname.startsWith("/exam-prep/") || (isPrepHost() && !url.pathname.startsWith("/api/")));
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (booksPage(url) && req.mode === "navigate") {
    event.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(BOOKS_CACHE).then((c) => c.put("/profile/books", copy)); } return res; })
      .catch(() => caches.open(BOOKS_CACHE).then(async (c) => (await c.match("/profile/books")) || new Response("<h1>You're offline</h1><p>Open Business books once with a connection, and it works offline after that.</p>", { headers: { "Content-Type": "text/html" } }))));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") && fromBooks(req)) {
    event.respondWith(caches.open(BOOKS_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    let fromPrep = isPrepHost();
    try { fromPrep = fromPrep || new URL(req.referrer).pathname.startsWith("/exam-prep"); } catch (e) { /* no referrer */ }
    if (!fromPrep) return;
    event.respondWith(caches.open(PREP_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  if (req.mode !== "navigate" || !prepPage(url)) return;
  const hub = isPrepHost() ? "/saved" : "/exam-prep/saved";
  event.respondWith(
    fetch(req).catch(() => caches.open(PREP_CACHE).then(async (c) => (await c.match(url.pathname, { ignoreSearch: true })) || (await c.match(hub)) || new Response("<h1>You're offline</h1><p>Save a pack on Naija Exam Prep while you have data to use it offline.</p>", { headers: { "Content-Type": "text/html" } })))
  );
});
