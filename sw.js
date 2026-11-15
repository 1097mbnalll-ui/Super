// متاجر أحد: إشعارات الطلبات، وصفحة «ما فيه نت» لو انقطع النت. ما يحفظ نسخة من الموقع، عشان التحديثات توصل على طول:
// فتح الصفحة يروح للشبكة دايماً، وما نرجع للنسخة المحفوظة (offline.html) إلا لو الشبكة فشلت.
const OFFLINE = "ohod-offline-v1";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(OFFLINE).then((c) => c.add(new Request("offline.html", { cache: "reload" }))).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.open(OFFLINE).then((c) => c.match("offline.html")).then((r) => r || Response.error())));
});
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.indexOf("ohod-offline-") === 0 && k !== OFFLINE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "متاجر أحد", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag, icon: "icon-192.png", badge: "favicon-64.png",
    dir: "rtl", lang: "ar", data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (new URL(c.url).pathname === new URL(url).pathname && "focus" in c) return c.navigate(url).then((w) => (w || c).focus()).catch(() => c.focus());
    return self.clients.openWindow(url);
  }));
});
