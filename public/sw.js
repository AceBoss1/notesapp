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
