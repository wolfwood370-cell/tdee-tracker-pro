// NC Nutrition - Service Worker for Web Push Notifications
// Minimal SW: only handles push events (no caching, no fetch interception)
// to avoid breaking live updates in the Lovable preview.

self.addEventListener("install", (event) => {
  // Activate immediately on first install
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "NC Nutrition", body: "", icon: "/placeholder.svg", url: "/" };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: payload.icon || "/placeholder.svg",
    badge: payload.icon || "/placeholder.svg",
    data: { url: payload.url || "/" },
    tag: payload.tag || "nc-nutrition",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
