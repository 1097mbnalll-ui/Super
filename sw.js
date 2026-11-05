// متاجر أحد: إشعارات الطلبات بس. ما يحفظ نسخة من الموقع، عشان التحديثات توصل على طول.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "متاجر أحد", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag, icon: "icon-192.png", badge: "icon-192.png",
    dir: "rtl", lang: "ar", data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.split("#")[0] === url.split("#")[0] && "focus" in c) return c.navigate(url).then((w) => (w || c).focus()).catch(() => c.focus());
    return self.clients.openWindow(url);
  }));
});
