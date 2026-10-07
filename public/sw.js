// #NotesApp service worker: shows web-push notifications (new messages and replies to moments) and opens the right page on tap.
// A push carries only who it's from, never the message text.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* not JSON */ }
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/messages";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.indexOf(self.location.origin) === 0 && "focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
