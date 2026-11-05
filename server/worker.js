// خادم إدارة متاجر أحد (Cloudflare Worker)
// يستقبل التعديلات من صفحة الإدارة، يتأكد من الرقم السري، ويحفظها في GitHub.
// مفتاح GitHub يبقى هنا في الخادم، وما يوصل لأي جوال.
//
// المتغيرات المطلوبة في إعدادات الـ Worker:
//   GITHUB_TOKEN   (Secret) مفتاح GitHub بصلاحية Contents: Read and write على المستودع
//   ADMIN_PIN      (Secret) الرقم السري الأول للإدارة. بعدها يتغير من صفحة الإدارة
//   SECRET         (Secret) نص عشوائي طويل يُستخدم في تشفير الرقم السري
//   REPO           (Text)   مثال: 1097mbnalll-ui/Super
//   BRANCH         (Text)   gh-pages
//   ALLOWED_ORIGIN (Text)   https://1097mbnalll-ui.github.io
//   TELEGRAM_BOT_TOKEN (Secret) مفتاح بوت تيليجرام اللي توصله الطلبات (من @BotFather)
// والربط:
//   LOCKS          (KV namespace) لحفظ الرقم السري الجديد وعدد المحاولات الغلط
//   DB             (D1 database) الطلبات وحالاتها، المخزون، التحليل، واشتراكات الإشعارات
// الإشعارات (Web Push) ما تحتاج مفاتيح منك: الخادم يسوي مفاتيحه أول مرة ويحفظها في LOCKS.

const MAX_FAILS_PER_IP = 5;        // محاولات غلط لكل جهاز
const IP_LOCK_SECONDS = 15 * 60;   // مدة القفل لكل جهاز
const MAX_FAILS_GLOBAL = 40;       // محاولات غلط من كل الأجهزة مع بعض
const GLOBAL_LOCK_SECONDS = 60 * 60;
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export default {
  async fetch(request, env, ctx) {
    const later = (p) => { const q = Promise.resolve(p).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(q); return q; };
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    if (request.method === "GET" && (path === "" || path === "/ping")) return reply(200, { ok: true, service: "ohod-admin" });
    // المخزون للزبائن: كم باقي من كل منتج عليه عدّ
    if (request.method === "GET" && path === "/stock") {
      const stock = env.DB ? await readStock(env) : {};
      return new Response(JSON.stringify({ ok: true, stock }), { headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=10" } });
    }
    if (request.method === "GET" && path === "/push/key") {
      if (!env.LOCKS || !env.DB) return reply(404, { ok: false, code: "no_push" });
      return reply(200, { ok: true, key: (await vapidKeys(env)).pub });
    }
    if (request.method !== "POST") return reply(405, { ok: false, code: "method" });
    if (!allowed.includes(origin)) return reply(403, { ok: false, code: "origin" });
    for (const k of ["GITHUB_TOKEN", "ADMIN_PIN", "SECRET", "REPO", "BRANCH"]) {
      if (!env[k]) return reply(500, { ok: false, code: "config", missing: k });
    }

    const len = Number(request.headers.get("Content-Length") || 0);
    if (len > MAX_BODY_BYTES) return reply(413, { ok: false, code: "too_large" });
    let body;
    try { body = await request.json(); } catch { return reply(400, { ok: false, code: "bad_json" }); }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    // طلب من زبون: ما يحتاج رقم سري
    if (path === "/order") {
      if (!env.LOCKS) return reply(500, { ok: false, code: "config", missing: "LOCKS" });
      const chat = env.TELEGRAM_BOT_TOKEN ? await env.LOCKS.get("tg_chat") : null;
      if (!env.DB && !chat) return reply(503, { ok: false, code: "no_receiver" });
      if (env.DB ? await rateHit(env, "ord:" + ip, 6, 600) : await tooManyOrders(env, ip)) return reply(429, { ok: false, code: "slow_down" });
      let data;
      try { data = await loadData(env); } catch { return reply(502, { ok: false, code: "data" }); }
      const priced = priceOrder(data, body);
      if (priced.error) return reply(400, { ok: false, code: priced.error });
      const record = orderRecord(priced, body);
      let orderNo, stockBefore = {};
      if (env.DB) {
        try {
          await ensureSchema(env);
          stockBefore = await readStock(env);
          const need = needOf(record);
          for (const id of Object.keys(need)) {
            if (stockBefore[id] != null && stockBefore[id] < need[id]) return reply(409, { ok: false, code: "unavailable", id, left: stockBefore[id] });
          }
          orderNo = await dbInsertOrder(env, record, (data.store || {}).keepDays);
          await moveStock(env, need, -1, stockBefore);
        } catch { return reply(502, { ok: false, code: "db" }); }
        later(afterOrder(env, data, record, orderNo, stockBefore, Date.now()));
      } else {
        orderNo = await nextOrderNo(env);
      }
      if (chat) {
        const sent = await tgSend(env, chat, orderText(data, priced, body, orderNo), {
          inline_keyboard: [[{ text: "افتح الموقع في قوقل ماب", url: mapsUrl(body.lat, body.lng) }]],
        });
        if (!sent.ok && !env.DB) return reply(502, { ok: false, code: "telegram" });
      }
      return reply(200, { ok: true, orderNo, subtotal: priced.subtotal, fee: priced.fee, total: priced.total, count: priced.count, track: !!env.DB });
    }

    // الزبون يتابع حالة طلبه (رقم الطلب + نفس رقم الجوال)
    if (path === "/track") {
      if (!env.DB) return reply(404, { ok: false, code: "no_tracking" });
      const n = Number(String(body.no || "").replace(/\D/g, "")) - 1000;
      const phone = normPhone(body.phone);
      if (!(n > 0) || !phone) return reply(400, { ok: false, code: "bad_request" });
      await ensureSchema(env);
      const row = await env.DB.prepare("SELECT status, updated FROM orders WHERE no = ? AND phone = ?").bind(n, phone).first();
      if (!row) return reply(404, { ok: false, code: "not_found" });
      return reply(200, { ok: true, status: row.status, updated: row.updated });
    }

    // تحليل التصفح: مشاهدات المنتجات، الإضافة للسلة، البحث (بدون أي بيانات شخصية)
    if (path === "/ev") {
      if (!env.DB) return reply(200, { ok: true });
      if (await rateHit(env, "ev:" + ip, 40, 3600)) return reply(429, { ok: false, code: "slow_down" });
      await recordEvents(env, body).catch(() => {});
      return reply(200, { ok: true });
    }

    // الزبون يفعّل إشعارات حالة طلبه
    if (path === "/push/order") {
      if (!env.DB || !env.LOCKS) return reply(404, { ok: false, code: "no_push" });
      const n = Number(String(body.no || "").replace(/\D/g, "")) - 1000;
      const phone = normPhone(body.phone);
      if (!(n > 0) || !phone) return reply(400, { ok: false, code: "bad_request" });
      await ensureSchema(env);
      const row = await env.DB.prepare("SELECT status FROM orders WHERE no = ? AND phone = ?").bind(n, phone).first();
      if (!row) return reply(404, { ok: false, code: "not_found" });
      if (!(await saveSub(env, body.sub, "customer", String(n)))) return reply(400, { ok: false, code: "bad_sub" });
      later(pushTo(env, [body.sub], { title: "تم تفعيل الإشعارات", body: "بنبلغك أول ما تتغير حالة طلبك #" + (1000 + n), url: "./", tag: "order" + n }));
      return reply(200, { ok: true });
    }
    if (path === "/push/unsub") {
      if (env.DB && body.endpoint) { await ensureSchema(env); await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(String(body.endpoint)).run(); }
      return reply(200, { ok: true });
    }

    const locked = await isLocked(env, ip);
    if (locked) return reply(429, { ok: false, code: "locked", retryAfter: locked });

    // صفحة المندوب: رقم المندوب أو رقم الإدارة
    if (path.startsWith("/driver/")) {
      const who = await checkDriver(env, String(body.pin || ""));
      if (!who) { await recordFail(env, ip); return reply(401, { ok: false, code: "bad_pin" }); }
      await clearFails(env, ip);
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      if (path === "/driver/login") return reply(200, { ok: true, role: who });
      if (path === "/driver/push") {
        if (!env.LOCKS) return reply(404, { ok: false, code: "no_push" });
        if (!(await saveSub(env, body.sub, "driver", ""))) return reply(400, { ok: false, code: "bad_sub" });
        later(pushTo(env, [body.sub], { title: "تم تفعيل إشعارات المندوب", body: "بيوصلك تنبيه مع كل طلب جديد، حتى لو الصفحة مقفلة.", url: "./#driver", tag: "test" }));
        return reply(200, { ok: true });
      }
      if (path === "/driver/orders") {
        const since = Date.now() - 3 * 864e5;
        const rs = await env.DB.prepare("SELECT no, created, updated, status, data FROM orders WHERE created > ? OR status IN ('new','accepted','onway') ORDER BY no DESC LIMIT 150").bind(since).all();
        const orders = (rs.results || []).map((r) => ({ ...JSON.parse(r.data), no: "#" + (1000 + r.no), created: r.created, updated: r.updated, status: r.status }));
        return reply(200, { ok: true, orders, now: Date.now() });
      }
      if (path === "/driver/status") {
        const n = Number(String(body.no || "").replace(/\D/g, "")) - 1000;
        const st = String(body.status || "");
        if (!(n > 0) || !["new", "accepted", "onway", "delivered", "canceled"].includes(st)) return reply(400, { ok: false, code: "bad_request" });
        const old = await env.DB.prepare("SELECT status, data, created FROM orders WHERE no = ?").bind(n).first();
        if (!old) return reply(404, { ok: false, code: "not_found" });
        await env.DB.prepare("UPDATE orders SET status = ?, updated = ? WHERE no = ?").bind(st, Date.now(), n).run();
        if (old.status !== st) {
          // الإلغاء يرجّع الكميات للمخزون، والتراجع عن الإلغاء يخصمها مرة ثانية
          let rec = null; try { rec = JSON.parse(old.data); } catch {}
          if (rec && (st === "canceled") !== (old.status === "canceled")) {
            const back = st === "canceled";
            await moveStock(env, needOf(rec), back ? 1 : -1);
            // الطلب الملغي ينشال من المبيعات والتحليل، ويرجع لو تراجعت عن الإلغاء
            if (rec.st) await applyStats(env, rec, old.created, back ? -1 : 1, back ? 1 : -1).catch(() => {});
          }
          if (st === "delivered" && old.status !== "delivered") {
            await env.DB.prepare("UPDATE st_day SET deliv_ms = deliv_ms + ?, deliv_n = deliv_n + 1 WHERE day = ?").bind(Math.max(0, Date.now() - old.created), riyadhDateAt(old.created)).run().catch(() => {});
          }
          const msg = STATUS_MSG[st];
          if (msg) later(notifyRole(env, "customer", String(n), { title: "طلبك #" + (1000 + n), body: msg, url: "./", tag: "order" + n }));
        }
        return reply(200, { ok: true });
      }
      return reply(404, { ok: false, code: "not_found" });
    }

    const pinOk = await checkPin(env, String(body.pin || ""));
    if (!pinOk) {
      await recordFail(env, ip);
      return reply(401, { ok: false, code: "bad_pin" });
    }
    await clearFails(env, ip);

    if (path === "/login") return reply(200, { ok: true });

    if (path === "/admin/stock") {
      if (!env.DB) return reply(200, { ok: true, stock: {}, hasDB: false });
      return reply(200, { ok: true, stock: await readStock(env), hasDB: true });
    }
    if (path === "/admin/orders") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      const lim = Math.min(5000, Math.max(1, Math.floor(Number(body.limit) || 300)));
      const rs = await env.DB.prepare("SELECT no, created, updated, status, data FROM orders ORDER BY no DESC LIMIT ?").bind(lim).all();
      const orders = (rs.results || []).map((r) => ({ ...JSON.parse(r.data), no: "#" + (1000 + r.no), created: r.created, updated: r.updated, status: r.status }));
      return reply(200, { ok: true, orders, now: Date.now() });
    }
    if (path === "/admin/stats") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      return reply(200, { ok: true, ...(await readStats(env, Number(body.days) || 30)) });
    }
    if (path === "/push/sub") {
      if (!env.DB || !env.LOCKS) return reply(404, { ok: false, code: "no_push" });
      if (!(await saveSub(env, body.sub, "admin", ""))) return reply(400, { ok: false, code: "bad_sub" });
      later(pushTo(env, [body.sub], { title: "تم تفعيل إشعارات الإدارة", body: "بيوصلك تنبيه مع كل طلب جديد، ولما منتج يقرب يخلص أو يخلص.", url: "./", tag: "test" }));
      return reply(200, { ok: true });
    }
    if (path === "/push/status") {
      if (!env.DB) return reply(200, { ok: true, admin: 0, driver: 0, customer: 0, ready: false });
      await ensureSchema(env);
      const rs = await env.DB.prepare("SELECT role, COUNT(*) n FROM subs GROUP BY role").all();
      const out = { ok: true, admin: 0, driver: 0, customer: 0, ready: !!env.LOCKS };
      for (const r of rs.results || []) out[r.role] = r.n;
      return reply(200, out);
    }
    if (path === "/push/test") {
      if (!env.DB || !env.LOCKS) return reply(404, { ok: false, code: "no_push" });
      const sent = await notifyRole(env, body.role === "driver" ? "driver" : "admin", null, { title: "رسالة تجربة ✅", body: "الإشعارات شغالة على هذا الجهاز.", url: "./", tag: "test" });
      return reply(200, { ok: true, sent });
    }

    if (path === "/tg-status") {
      const title = env.LOCKS ? await env.LOCKS.get("tg_title") : null;
      const driverSet = !!((env.LOCKS && (await env.LOCKS.get("driver_pin"))) || env.DRIVER_PIN);
      return reply(200, { ok: true, hasToken: !!env.TELEGRAM_BOT_TOKEN, linked: !!title, title: title || "", hasDB: !!env.DB, driverSet });
    }

    // ربط تيليجرام: أرسل أي رسالة للبوت (أو في القروب اللي فيه البوت) ثم اضغط الزر في الإدارة
    if (path === "/tg-link") {
      if (!env.TELEGRAM_BOT_TOKEN) return reply(400, { ok: false, code: "no_token" });
      if (!env.LOCKS) return reply(500, { ok: false, code: "config", missing: "LOCKS" });
      const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?limit=50`);
      const j = await r.json().catch(() => ({}));
      if (!j.ok) return reply(400, { ok: false, code: "bad_token" });
      const msgs = (j.result || []).map((u) => u.message || u.channel_post || u.my_chat_member).filter((m) => m && m.chat);
      const last = msgs[msgs.length - 1];
      if (!last) return reply(404, { ok: false, code: "no_message" });
      const c = last.chat;
      const title = c.title || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || String(c.id);
      await env.LOCKS.put("tg_chat", String(c.id));
      await env.LOCKS.put("tg_title", title);
      await tgSend(env, String(c.id), "تم ربط طلبات متاجر أحد هنا ✅\nأي طلب جديد من الموقع بيوصل في هذي المحادثة.");
      return reply(200, { ok: true, title });
    }

    if (path === "/tg-test") {
      const chat = env.LOCKS ? await env.LOCKS.get("tg_chat") : null;
      if (!chat || !env.TELEGRAM_BOT_TOKEN) return reply(400, { ok: false, code: "not_linked" });
      const s = await tgSend(env, chat, "رسالة تجربة من صفحة الإدارة ✅ الطلبات بتوصل هنا.");
      return reply(s.ok ? 200 : 502, { ok: !!s.ok });
    }

    if (path === "/save") {
      const data = body.data;
      const problem = validate(data);
      if (problem) return reply(400, { ok: false, code: "bad_data", detail: problem });
      if (body.newPin != null && body.newPin !== "") {
        const np = String(body.newPin);
        if (!/^\d{4,12}$/.test(np)) return reply(400, { ok: false, code: "bad_new_pin" });
        if (!env.LOCKS) return reply(500, { ok: false, code: "config", missing: "LOCKS" });
      }
      if (body.newDriverPin != null && body.newDriverPin !== "") {
        const dp = String(body.newDriverPin);
        if (!/^\d{4,12}$/.test(dp)) return reply(400, { ok: false, code: "bad_driver_pin" });
        if (!env.LOCKS) return reply(500, { ok: false, code: "config", missing: "LOCKS" });
        if (await checkPin(env, dp)) return reply(400, { ok: false, code: "driver_pin_same" });
      }
      if (data.store) delete data.store.pinHash; // الرقم السري ما ينحفظ في الموقع العام
      const stockSet = body.stock && typeof body.stock === "object" ? body.stock : null;
      if (stockSet && !env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      try {
        await saveToGitHub(env, "data.json", JSON.stringify(data), "تحديث المتجر من صفحة الإدارة");
      } catch (e) {
        return reply(502, { ok: false, code: e.code || "github", status: e.status || 0 });
      }
      if (body.newPin) await env.LOCKS.put("pin", await hashPin(env, String(body.newPin)));
      if (body.newDriverPin) await env.LOCKS.put("driver_pin", await hashPin(env, "driver:" + String(body.newDriverPin)));
      if (stockSet) await setStock(env, stockSet);
      dataCache = { at: 0, data: null };
      return reply(200, { ok: true, stock: stockSet ? await readStock(env) : undefined });
    }
    return reply(404, { ok: false, code: "not_found" });
  },
};

// ---------- قاعدة الطلبات (D1) ----------
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    "CREATE TABLE IF NOT EXISTS orders (no INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER NOT NULL, updated INTEGER NOT NULL, status TEXT NOT NULL, phone TEXT NOT NULL, data TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS stock (id TEXT PRIMARY KEY, qty INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS subs (endpoint TEXT NOT NULL, role TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', p256dh TEXT NOT NULL, auth TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (endpoint, role, ref))",
    "CREATE TABLE IF NOT EXISTS st_day (day TEXT PRIMARY KEY, orders INTEGER NOT NULL, revenue REAL NOT NULL)",
    "CREATE TABLE IF NOT EXISTS st_hour (day TEXT NOT NULL, hour INTEGER NOT NULL, orders INTEGER NOT NULL, revenue REAL NOT NULL, PRIMARY KEY (day, hour))",
    "CREATE TABLE IF NOT EXISTS st_cust (h TEXT PRIMARY KEY, tail TEXT NOT NULL, first TEXT NOT NULL, last TEXT NOT NULL, orders INTEGER NOT NULL, revenue REAL NOT NULL)",
    "CREATE TABLE IF NOT EXISTS st_view (day TEXT NOT NULL, id TEXT NOT NULL, views INTEGER NOT NULL, carts INTEGER NOT NULL, PRIMARY KEY (day, id))",
    "CREATE TABLE IF NOT EXISTS st_search (day TEXT NOT NULL, q TEXT NOT NULL, n INTEGER NOT NULL, miss INTEGER NOT NULL, PRIMARY KEY (day, q))",
    "CREATE TABLE IF NOT EXISTS rl (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS st_item (day TEXT NOT NULL, id TEXT NOT NULL, qty INTEGER NOT NULL, revenue REAL NOT NULL, orders INTEGER NOT NULL, PRIMARY KEY (day, id))",
    "CREATE TABLE IF NOT EXISTS st_pair (a TEXT NOT NULL, b TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (a, b))",
  ].map((q) => env.DB.prepare(q)));
  // أعمدة إضافية للتحليل (تنضاف مرة وحدة للقاعدة القديمة بدون ما تمس بياناتها)
  const have = ((await env.DB.prepare("PRAGMA table_info(st_day)").all()).results || []).map((r) => r.name);
  const add = ["items", "card", "fees", "canceled", "newc", "deliv_ms", "deliv_n", "visits", "carts", "checkouts"].filter((c) => !have.includes(c));
  if (add.length) await env.DB.batch(add.map((c) => env.DB.prepare(`ALTER TABLE st_day ADD COLUMN ${c} REAL NOT NULL DEFAULT 0`)));
  schemaReady = true;
}
function orderRecord(o, body) {
  return {
    lines: o.lines.map((l) => ({ id: l.p.id, name: l.p.name, unit: l.p.unit, qty: l.qty, price: l.price, tag: l.tag || "" })),
    subtotal: o.subtotal, fee: o.fee, total: o.total, count: o.count, phone: o.phone,
    name: String(body.name || "").slice(0, 60), details: String(body.details || "").slice(0, 200), note: String(body.note || "").slice(0, 300),
    pay: body.pay === "card" ? "card" : "cash", lat: Number(body.lat), lng: Number(body.lng), map: mapsUrl(body.lat, body.lng),
    st: 1, // انحسب في التحليل
  };
}
async function dbInsertOrder(env, rec, keepDays) {
  await ensureSchema(env);
  const now = Date.now();
  // نحذف تفاصيل الطلبات المنتهية الأقدم من المدة اللي تحددها الإدارة (الافتراضي ٩٠ يوم).
  // أرقام التحليل ما تنحذف، لأنها محفوظة في جداول لحالها بدون بيانات الزبائن.
  const keep = Math.min(730, Math.max(7, Math.floor(Number(keepDays) || 90)));
  await env.DB.prepare("DELETE FROM orders WHERE created < ? AND status IN ('delivered','canceled')").bind(now - keep * 864e5).run();
  const row = await env.DB.prepare("INSERT INTO orders (created, updated, status, phone, data) VALUES (?, ?, 'new', ?, ?) RETURNING no")
    .bind(now, now, rec.phone, JSON.stringify(rec)).first();
  return "#" + (1000 + row.no);
}
async function checkDriver(env, pin) {
  if (!pin || pin.length > 12) return "";
  if (await checkPin(env, pin)) return "admin";
  const stored = env.LOCKS ? await env.LOCKS.get("driver_pin") : null;
  const expected = stored || (env.DRIVER_PIN ? await hashPin(env, "driver:" + String(env.DRIVER_PIN)) : "");
  if (!expected) return "";
  return sameText(await hashPin(env, "driver:" + pin), expected) ? "driver" : "";
}

// ---------- الطلبات ----------
let dataCache = { at: 0, data: null };
async function loadData(env) {
  if (dataCache.data && Date.now() - dataCache.at < 30000) return dataCache.data;
  const r = await fetch(`https://api.github.com/repos/${env.REPO}/contents/data.json?ref=${encodeURIComponent(env.BRANCH)}`, {
    headers: { "Authorization": "Bearer " + env.GITHUB_TOKEN, "Accept": "application/vnd.github.raw", "User-Agent": "ohod-admin-worker" },
  });
  if (!r.ok) throw new Error("data " + r.status);
  dataCache = { at: Date.now(), data: await r.json() };
  return dataCache.data;
}

// يوم الرياض (UTC+3) عشان عرض اليوم يتطابق مع اللي يشوفه الزبون
function riyadhDayNo() { return Math.floor((Date.now() + 3 * 3600e3) / 864e5); }

function priceOrder(data, body) {
  const S = data.store || {};
  const byId = {};
  for (const p of data.products || []) byId[p.id] = p;
  const items = body.items && typeof body.items === "object" ? body.items : {};
  const phone = normPhone(body.phone);
  if (!phone) return { error: "bad_phone" };
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!(lat >= 16 && lat <= 33 && lng >= 34 && lng <= 56)) return { error: "bad_location" };

  const DEAL = S.deal95 && S.deal95.on ? S.deal95 : null;
  const DAILY = S.daily && S.daily.on ? S.daily : null;
  let daily = null;
  if (DAILY && Array.isArray(DAILY.list)) {
    const l = DAILY.list.filter((x) => byId[x.id] && byId[x.id].stock && x.price > 0);
    if (l.length) { const x = l[riyadhDayNo() % l.length]; daily = { id: x.id, price: Number(x.price) }; }
  }
  const lines = [];
  let base = 0, dealSum = 0, count = 0;
  const dealLines = [];
  const used = {};
  for (const [key, rawQty] of Object.entries(items)) {
    let qty = Math.floor(Number(rawQty));
    if (!(qty > 0 && qty <= 200)) continue;
    const parts = String(key).split(":");
    const kind = parts.length > 1 ? parts[0] : "r";
    const p = byId[parts.length > 1 ? parts[1] : parts[0]];
    if (!p || !p.stock) return { error: "unavailable", id: key };
    const max = Math.floor(Number(p.max || 0));
    if (max > 0) { qty = Math.min(qty, max - (used[p.id] || 0)); if (qty <= 0) continue; }
    used[p.id] = (used[p.id] || 0) + qty;
    if (kind === "t") {
      if (!daily || daily.id !== p.id) { lines.push({ p, qty, price: Number(p.price), tag: "" }); base += qty * p.price; count += qty; continue; }
      const lim = Number(DAILY.limit || 0);
      const q = lim ? Math.min(qty, lim) : qty;
      lines.push({ p, qty: q, price: daily.price, tag: "عرض اليوم" }); base += q * daily.price; count += q;
    } else if (kind === "d") {
      if (!DEAL || !(DEAL.ids || []).includes(p.id)) continue;
      const lim = Number(DEAL.limit || 0);
      const q = lim ? Math.min(qty, lim) : qty;
      dealLines.push({ p, qty: q, price: Number(DEAL.price || 0.95), tag: "عرض " + DEAL.price });
    } else {
      lines.push({ p, qty, price: Number(p.price), tag: "" }); base += qty * p.price; count += qty;
    }
  }
  if (DEAL && base >= Number(DEAL.min || 0)) for (const d of dealLines) { lines.push(d); dealSum += d.qty * d.price; count += d.qty; }
  if (!count) return { error: "empty" };
  if (S.closed) return { error: "closed" };
  if (Number(S.minOrder) > 0 && base + dealSum < Number(S.minOrder)) return { error: "min_order", min: Number(S.minOrder) };
  const subtotal = round2(base + dealSum);
  const fee = S.freeOver && subtotal >= S.freeOver ? 0 : Number(S.fee || 0);
  return { lines, subtotal, fee, total: round2(subtotal + fee), count, phone };
}

function round2(n) { return Math.round(n * 100) / 100; }
function normPhone(v) {
  let s = String(v || "").replace(/[^\d+]/g, "").replace(/^\+?966/, "").replace(/^0/, "");
  return /^5\d{8}$/.test(s) ? "0" + s : "";
}
function mapsUrl(lat, lng) { return `https://www.google.com/maps?q=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function money(n) { return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "") + " ر.س"; }

function orderText(data, o, body, orderNo) {
  const pay = body.pay === "card" ? "شبكة عند الاستلام" : "كاش عند الاستلام";
  const lines = o.lines.map((l) => `• ${esc(l.p.name)} (${esc(l.p.unit)}) × ${l.qty} = ${money(l.qty * l.price)}${l.tag ? " [" + esc(l.tag) + "]" : ""}`).join("\n");
  const t = new Date(Date.now() + 3 * 3600e3).toISOString().slice(11, 16);
  return [
    `🛒 <b>طلب جديد ${esc(orderNo)}</b>  · ${t}`,
    "",
    lines,
    "",
    `المنتجات: ${money(o.subtotal)}`,
    `التوصيل: ${o.fee ? money(o.fee) : "مجاني"}`,
    `<b>الإجمالي: ${money(o.total)}</b>`,
    `الدفع: ${pay}`,
    "",
    `📞 الجوال: ${esc(o.phone)}`,
    body.name ? `الاسم: ${esc(String(body.name).slice(0, 60))}` : null,
    `📍 الموقع: ${mapsUrl(body.lat, body.lng)}`,
    body.details ? `🏠 تفاصيل البيت: ${esc(String(body.details).slice(0, 200))}` : null,
    body.note ? `📝 ملاحظات: ${esc(String(body.note).slice(0, 300))}` : null,
  ].filter((x) => x !== null).join("\n");
}

async function tgSend(env, chat, text, markup) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) }),
  });
  return r.json().catch(() => ({ ok: false }));
}

async function nextOrderNo(env) {
  const n = Number((await env.LOCKS.get("order_seq")) || 1000) + 1;
  await env.LOCKS.put("order_seq", String(n));
  return "#" + n;
}

async function tooManyOrders(env, ip) {
  const key = "ord:" + ip, now = Date.now();
  const cur = (await env.LOCKS.get(key, "json")) || { n: 0, until: now + 600000 };
  const fresh = cur.until > now ? cur : { n: 0, until: now + 600000 };
  if (fresh.n >= 6) return true;
  fresh.n += 1;
  await env.LOCKS.put(key, JSON.stringify(fresh), { expirationTtl: 600 });
  return false;
}

async function hashPin(env, pin) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("pin:" + pin));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function checkPin(env, pin) {
  if (!pin || pin.length > 12) return false;
  const given = await hashPin(env, pin);
  const stored = env.LOCKS ? await env.LOCKS.get("pin") : null;
  const expected = stored || (await hashPin(env, String(env.ADMIN_PIN)));
  return sameText(given, expected);
}

async function isLocked(env, ip) {
  if (!env.LOCKS) return 0;
  const [mine, all] = await Promise.all([env.LOCKS.get("fail:" + ip, "json"), env.LOCKS.get("fail:all", "json")]);
  const now = Date.now();
  if (mine && mine.n >= MAX_FAILS_PER_IP && mine.until > now) return Math.ceil((mine.until - now) / 1000);
  if (all && all.n >= MAX_FAILS_GLOBAL && all.until > now) return Math.ceil((all.until - now) / 1000);
  return 0;
}

async function bump(env, key, seconds) {
  const now = Date.now();
  const cur = (await env.LOCKS.get(key, "json")) || { n: 0, until: 0 };
  const fresh = cur.until > now ? cur : { n: 0, until: now + seconds * 1000 };
  fresh.n += 1;
  await env.LOCKS.put(key, JSON.stringify(fresh), { expirationTtl: Math.max(60, seconds) });
}

async function recordFail(env, ip) {
  if (!env.LOCKS) return;
  await Promise.all([bump(env, "fail:" + ip, IP_LOCK_SECONDS), bump(env, "fail:all", GLOBAL_LOCK_SECONDS)]);
}

async function clearFails(env, ip) {
  if (env.LOCKS) await env.LOCKS.delete("fail:" + ip);
}

function validate(d) {
  if (!d || typeof d !== "object") return "no data";
  if (!d.store || typeof d.store !== "object") return "store";
  if (!Array.isArray(d.cats) || !Array.isArray(d.products)) return "lists";
  if (!d.imgs || typeof d.imgs !== "object" || !d.imgs.logo) return "imgs";
  if (d.products.length > 5000 || d.cats.length > 200) return "too many";
  for (const p of d.products) {
    if (!p || typeof p.id !== "string" || typeof p.name !== "string" || !(Number(p.price) >= 0)) return "product";
  }
  for (const v of Object.values(d.imgs)) {
    if (typeof v !== "string" || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(v)) return "image";
  }
  return "";
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function saveToGitHub(env, file, text, message) {
  const url = `https://api.github.com/repos/${env.REPO}/contents/${file}`;
  const headers = {
    "Authorization": "Bearer " + env.GITHUB_TOKEN,
    "Accept": "application/vnd.github+json",
    "User-Agent": "ohod-admin-worker",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await fetch(`${url}?ref=${encodeURIComponent(env.BRANCH)}`, { headers });
    if (cur.status === 401 || cur.status === 403) throw { code: "github_auth", status: cur.status };
    const sha = cur.ok ? (await cur.json()).sha : undefined;
    const put = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message, content: toBase64(text), branch: env.BRANCH, ...(sha ? { sha } : {}) }),
    });
    if (put.ok) return;
    if (put.status === 409 && attempt === 0) continue; // تعارض بسيط: نعيد مرة وحدة
    if (put.status === 401 || put.status === 403 || put.status === 404) throw { code: "github_auth", status: put.status };
    throw { code: "github", status: put.status };
  }
  throw { code: "github_conflict", status: 409 };
}

// ---------- المخزون ----------
const STATUS_MSG = {
  accepted: "انقبل طلبك وجاري تجهيزه",
  onway: "المندوب طلع لك وفي الطريق 🚚",
  delivered: "وصل طلبك. بالعافية عليك!",
  canceled: "انلغى طلبك. للاستفسار اتصل على المحل.",
};
function needOf(rec) {
  const need = {};
  for (const l of rec.lines || []) if (l.id) need[l.id] = (need[l.id] || 0) + Number(l.qty || 0);
  return need;
}
async function readStock(env) {
  await ensureSchema(env);
  const rs = await env.DB.prepare("SELECT id, qty FROM stock").all();
  const out = {};
  for (const r of rs.results || []) out[r.id] = r.qty;
  return out;
}
async function moveStock(env, need, sign, known) {
  const cur = known || (await readStock(env));
  const st = Object.keys(need).filter((id) => cur[id] != null)
    .map((id) => env.DB.prepare("UPDATE stock SET qty = MAX(qty + ?, 0) WHERE id = ?").bind(sign * need[id], id));
  if (st.length) await env.DB.batch(st);
}
async function setStock(env, map) {
  await ensureSchema(env);
  const st = [];
  for (const [id, v] of Object.entries(map).slice(0, 5000)) {
    if (v === null || v === "") st.push(env.DB.prepare("DELETE FROM stock WHERE id = ?").bind(String(id)));
    else {
      const q = Math.floor(Number(v));
      if (q >= 0 && q <= 1e6) st.push(env.DB.prepare("INSERT INTO stock (id, qty) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET qty = excluded.qty").bind(String(id), q));
    }
  }
  if (st.length) await env.DB.batch(st);
}

// بعد الطلب: التحليل + إشعار الإدارة والمندوب + تنبيه المخزون
async function afterOrder(env, data, rec, orderNo, before, created) {
  await applyStats(env, rec, created, 1, 0).catch(() => {});
  if (!env.LOCKS) return;
  const n = Number(String(orderNo).replace(/\D/g, ""));
  const msg = { title: "طلب جديد " + orderNo, body: rec.count + " منتج · " + money(rec.total) + " · " + (rec.pay === "card" ? "شبكة" : "كاش") + (rec.name ? " · " + rec.name : ""), url: "./#driver", tag: "new" + n };
  await Promise.all([notifyRole(env, "admin", null, msg), notifyRole(env, "driver", null, msg)]);
  const lowAt = Math.max(0, Number((data.store || {}).lowAt ?? 3));
  const need = needOf(rec), names = {};
  for (const p of data.products || []) names[p.id] = p.name;
  const alerts = [];
  for (const id of Object.keys(need)) {
    if (before[id] == null) continue;
    const was = before[id], now = Math.max(0, was - need[id]);
    if (now === 0) alerts.push({ title: "نفد: " + (names[id] || id), body: "المنتج خلص من المخزون وصار يطلع «نفد» للزبائن.", url: "./", tag: "stock-" + id });
    else if (now <= lowAt && was > lowAt) alerts.push({ title: "قرب يخلص: " + (names[id] || id), body: "باقي " + now + " بس في المخزون.", url: "./", tag: "stock-" + id });
  }
  for (const a of alerts) await notifyRole(env, "admin", null, a);
}

// ---------- التحليل ----------
function riyadhDate(offsetDays = 0) { return riyadhDateAt(Date.now() + offsetDays * 864e5); }
function riyadhDateAt(ms) { return new Date(Number(ms) + 3 * 3600e3).toISOString().slice(0, 10); }
function riyadhHour(ms) { return new Date(Number(ms) + 3 * 3600e3).getUTCHours(); }

// sign = 1 طلب جديد، -1 إلغاء. cancelDelta يعدّ الطلبات الملغية.
async function applyStats(env, rec, created, sign, cancelDelta) {
  await ensureSchema(env);
  const day = riyadhDateAt(created), hour = riyadhHour(created);
  const per = {};
  let items = 0;
  for (const l of rec.lines || []) {
    const q = Number(l.qty || 0); items += q;
    if (!l.id) continue;
    const x = per[l.id] || (per[l.id] = { qty: 0, rev: 0 });
    x.qty += q; x.rev += q * Number(l.price || 0);
  }
  const total = Number(rec.total || 0), fee = Number(rec.fee || 0), card = rec.pay === "card" ? 1 : 0;
  const ids = Object.keys(per).sort().slice(0, 40);
  let newc = 0, ck = "";
  if (rec.phone) {
    ck = (await hashPin(env, "cust:" + rec.phone)).slice(0, 32);
    if (sign > 0 && !cancelDelta) newc = (await env.DB.prepare("SELECT 1 x FROM st_cust WHERE h = ?").bind(ck).first()) ? 0 : 1;
  }
  const P = (q, ...a) => env.DB.prepare(q).bind(...a);
  const st = [
    P("INSERT INTO st_day (day, orders, revenue, items, card, fees, canceled, newc) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET orders = orders + excluded.orders, revenue = revenue + excluded.revenue, items = items + excluded.items, card = card + excluded.card, fees = fees + excluded.fees, canceled = canceled + excluded.canceled, newc = newc + excluded.newc",
      day, sign, round2(sign * total), sign * items, sign * card, round2(sign * fee), cancelDelta, newc),
    P("INSERT INTO st_hour (day, hour, orders, revenue) VALUES (?, ?, ?, ?) ON CONFLICT(day, hour) DO UPDATE SET orders = orders + excluded.orders, revenue = revenue + excluded.revenue", day, hour, sign, round2(sign * total)),
  ];
  for (const id of ids) st.push(P("INSERT INTO st_item (day, id, qty, revenue, orders) VALUES (?, ?, ?, ?, ?) ON CONFLICT(day, id) DO UPDATE SET qty = qty + excluded.qty, revenue = revenue + excluded.revenue, orders = orders + excluded.orders", day, id, sign * per[id].qty, round2(sign * per[id].rev), sign));
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
    st.push(P("INSERT INTO st_pair (a, b, n) VALUES (?, ?, ?) ON CONFLICT(a, b) DO UPDATE SET n = n + excluded.n", ids[i], ids[j], sign));
  if (ck) st.push(P("INSERT INTO st_cust (h, tail, first, last, orders, revenue) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(h) DO UPDATE SET orders = orders + excluded.orders, revenue = revenue + excluded.revenue, last = CASE WHEN excluded.orders > 0 AND excluded.last > last THEN excluded.last ELSE last END",
    ck, String(rec.phone).slice(-4), day, day, sign, round2(sign * total)));
  await env.DB.batch(st);
}

async function rateHit(env, key, max, secs) {
  await ensureSchema(env);
  const now = Date.now();
  const row = await env.DB.prepare("INSERT INTO rl (k, n, until) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN until < ? THEN 1 ELSE n + 1 END, until = CASE WHEN until < ? THEN excluded.until ELSE until END RETURNING n")
    .bind(key, now + secs * 1000, now, now).first();
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM rl WHERE until < ?").bind(now).run();
  return !!row && row.n > max;
}

async function recordEvents(env, b) {
  await ensureSchema(env);
  const day = riyadhDate(), P = (q, ...a) => env.DB.prepare(q).bind(...a);
  const okId = (k) => typeof k === "string" && /^[\w-]{1,40}$/.test(k);
  const num = (v, m) => Math.max(0, Math.min(m, Math.floor(Number(v) || 0)));
  const views = b.v && typeof b.v === "object" ? Object.entries(b.v).filter(([k]) => okId(k)).slice(0, 60) : [];
  const carts = b.c && typeof b.c === "object" ? b.c : {};
  const ids = new Set(views.map(([k]) => k).concat(Object.keys(carts).filter(okId).slice(0, 60)));
  const st = [P("INSERT INTO st_day (day, orders, revenue, visits, carts, checkouts) VALUES (?, 0, 0, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET visits = visits + excluded.visits, carts = carts + excluded.carts, checkouts = checkouts + excluded.checkouts",
    day, b.visit ? 1 : 0, Object.keys(carts).length ? 1 : 0, b.co ? 1 : 0)];
  for (const id of ids) {
    const v = num(b.v && b.v[id], 30), c = num(carts[id], 30);
    if (v || c) st.push(P("INSERT INTO st_view (day, id, views, carts) VALUES (?, ?, ?, ?) ON CONFLICT(day, id) DO UPDATE SET views = views + excluded.views, carts = carts + excluded.carts", day, id, v, c));
  }
  const seen = {};
  for (const x of Array.isArray(b.s) ? b.s.slice(0, 15) : []) {
    const q = String((x && x.q) || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
    if (q.length < 2 || seen[q]) continue; seen[q] = 1;
    st.push(P("INSERT INTO st_search (day, q, n, miss) VALUES (?, ?, 1, ?) ON CONFLICT(day, q) DO UPDATE SET n = n + 1, miss = miss + excluded.miss", day, q, Number(x.f) > 0 ? 0 : 1));
  }
  await env.DB.batch(st);
}

async function readStats(env, days) {
  await ensureSchema(env);
  days = Math.min(365, Math.max(1, Math.floor(days)));
  const from = riyadhDate(-(days - 1)), prev = riyadhDate(-(2 * days - 1));
  const Q = (q, ...a) => env.DB.prepare(q).bind(...a).all().then((r) => r.results || []);
  const [daily, items, all, pairs, sts, hours, views, searches, cust, top] = await Promise.all([
    Q("SELECT * FROM st_day WHERE day >= ? ORDER BY day", prev),
    Q("SELECT id, SUM(CASE WHEN day >= ? THEN qty ELSE 0 END) qty, SUM(CASE WHEN day >= ? THEN revenue ELSE 0 END) revenue, SUM(CASE WHEN day >= ? THEN orders ELSE 0 END) orders, SUM(CASE WHEN day < ? THEN qty ELSE 0 END) prev FROM st_item WHERE day >= ? GROUP BY id ORDER BY qty DESC", from, from, from, from, prev),
    Q("SELECT id, SUM(orders) orders FROM st_item GROUP BY id"),
    Q("SELECT a, b, n FROM st_pair WHERE n >= 2 ORDER BY n DESC LIMIT 120"),
    Q("SELECT status, COUNT(*) n FROM orders WHERE created > ? GROUP BY status", Date.now() - days * 864e5),
    Q("SELECT day, hour, orders FROM st_hour WHERE day >= ? AND orders > 0", from),
    Q("SELECT id, SUM(views) views, SUM(carts) carts FROM st_view WHERE day >= ? GROUP BY id", from),
    Q("SELECT q, SUM(n) n, SUM(miss) miss FROM st_search WHERE day >= ? GROUP BY q ORDER BY n DESC LIMIT 80", from),
    Q("SELECT COUNT(*) total, SUM(CASE WHEN first >= ? THEN 1 ELSE 0 END) fresh, SUM(CASE WHEN last >= ? THEN 1 ELSE 0 END) active, SUM(CASE WHEN orders >= 2 THEN 1 ELSE 0 END) loyal, SUM(CASE WHEN orders >= 2 AND last < ? THEN 1 ELSE 0 END) gone FROM st_cust WHERE orders > 0", from, from, riyadhDate(-30)),
    Q("SELECT tail, first, last, orders, revenue FROM st_cust WHERE orders > 0 ORDER BY revenue DESC LIMIT 15"),
  ]);
  const withId = {};
  for (const r of all) withId[r.id] = r.orders;
  return { days, from, prevFrom: prev, daily, items, ordersWith: withId, pairs, statuses: sts, hours, views, searches, customers: cust[0] || {}, topCustomers: top };
}

// ---------- الإشعارات (Web Push) ----------
async function saveSub(env, sub, role, ref) {
  if (!sub || typeof sub !== "object" || !sub.keys) return false;
  const ep = String(sub.endpoint || ""), p = String(sub.keys.p256dh || ""), a = String(sub.keys.auth || "");
  if (!/^https:\/\/[^\s]{10,900}$/.test(ep) || !/^[\w-]{80,100}$/.test(p) || !/^[\w-]{16,30}$/.test(a)) return false;
  await ensureSchema(env);
  if (role === "customer") await env.DB.prepare("DELETE FROM subs WHERE role = 'customer' AND created < ?").bind(Date.now() - 3 * 864e5).run();
  await env.DB.prepare("INSERT INTO subs (endpoint, role, ref, p256dh, auth, created) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint, role, ref) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, created = excluded.created")
    .bind(ep, role, ref || "", p, a, Date.now()).run();
  return true;
}
async function notifyRole(env, role, ref, msg) {
  if (!env.DB || !env.LOCKS) return 0;
  await ensureSchema(env);
  const rs = ref == null
    ? await env.DB.prepare("SELECT endpoint, p256dh, auth FROM subs WHERE role = ? LIMIT 50").bind(role).all()
    : await env.DB.prepare("SELECT endpoint, p256dh, auth FROM subs WHERE role = ? AND ref = ? LIMIT 10").bind(role, ref).all();
  return pushTo(env, (rs.results || []).map((r) => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } })), msg);
}
async function pushTo(env, subs, msg) {
  let ok = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const st = await webPush(env, s, msg);
      if (st >= 200 && st < 300) ok++;
      else if (st === 404 || st === 410) await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(s.endpoint).run();
    } catch {}
  }));
  return ok;
}
let vapidCache = null;
async function vapidKeys(env) {
  if (vapidCache) return vapidCache;
  let v = await env.LOCKS.get("vapid", "json");
  if (!v) {
    const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    v = { pub: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey))), jwk: await crypto.subtle.exportKey("jwk", k.privateKey) };
    await env.LOCKS.put("vapid", JSON.stringify(v));
  }
  vapidCache = { pub: v.pub, key: await crypto.subtle.importKey("jwk", v.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]) };
  return vapidCache;
}
async function webPush(env, sub, msg) {
  const v = await vapidKeys(env);
  const aud = new URL(sub.endpoint).origin;
  const site = ((env.ALLOWED_ORIGIN || "").split(",")[0] || "").trim() || "https://example.com";
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: site });
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.key, new TextEncoder().encode(unsigned)));
  const body = await encryptPush(sub.keys.p256dh, sub.keys.auth, new TextEncoder().encode(JSON.stringify(msg)));
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: { "TTL": "86400", "Urgency": "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", "Authorization": `vapid t=${unsigned}.${b64u(sig)}, k=${v.pub}` },
    body,
  });
  return r.status;
}
// تشفير الرسالة حسب RFC 8291 (aes128gcm)
async function encryptPush(p256dh, auth, plain) {
  const uaPub = unb64u(p256dh), secret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const te = (t) => new TextEncoder().encode(t);
  const ikm = await hmac(await hmac(secret, shared), cat(te("WebPush: info\0"), uaPub, asPub, [1]));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(te("Content-Encoding: aes128gcm\0"), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, cat(te("Content-Encoding: nonce\0"), [1]))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(plain, [2])));
  const head = new Uint8Array(86);
  head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65; head.set(asPub, 21);
  return cat(head, ct);
}
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
function cat(...parts) {
  const arrs = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
function b64u(bytes) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64u(s) { const b = atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); }
