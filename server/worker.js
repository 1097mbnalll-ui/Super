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
  // تقرير آخر اليوم: يشتغل من Cron Trigger في Cloudflare
  async scheduled(event, env, ctx) {
    if (!env.DB) return;
    ctx.waitUntil(dailyReport(env).catch(() => {}));
  },
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
    try {
      return await route();
    } catch (e) {
      return reply(500, { ok: false, code: "server" });
    }
    async function route() {
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
          await withCost(env, record);
          stockBefore = await readStock(env);
          const need = needOf(record);
          const short = () => Object.keys(need).find((id) => stockBefore[id] != null && stockBefore[id] < need[id]);
          let sid = short();
          if (sid) return reply(409, { ok: false, code: "unavailable", id: sid, left: stockBefore[sid] });
          try {
            orderNo = await dbInsertOrder(env, record, need, Date.now());
          } catch (e) {
            // ممكن طلب ثاني سبقه على آخر حبة: نشيّك المخزون مرة ثانية
            stockBefore = await readStock(env); sid = short();
            if (sid) return reply(409, { ok: false, code: "unavailable", id: sid, left: stockBefore[sid] });
            throw e;
          }
          later(cleanupOld(env, (data.store || {}).keepDays));
        } catch { return reply(502, { ok: false, code: "db" }); }
        later(afterOrder(env, data, record, orderNo, stockBefore));
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
        let res;
        try { res = await changeStatus(env, n, st, Date.now(), who === "admin" ? staff(body) : "المندوب"); } catch { return reply(502, { ok: false, code: "db" }); }
        if (!res) return reply(404, { ok: false, code: "not_found" });
        if (res.changed) {
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
      if (!env.DB) return reply(200, { ok: true, stock: {}, costs: {}, hasDB: false });
      return reply(200, { ok: true, stock: await readStock(env), costs: await readCosts(env), hasDB: true });
    }
    if (path === "/admin/log") {
      if (!env.DB) return reply(200, { ok: true, log: [] });
      await ensureSchema(env);
      const before = Number(body.before) || 1e15;
      const rs = await env.DB.prepare("SELECT id, at, who, act, ref, info FROM alog WHERE id < ? ORDER BY id DESC LIMIT 200").bind(before).all();
      return reply(200, { ok: true, log: (rs.results || []).map((r) => ({ ...r, info: safeJson(r.info) })) });
    }
    if (path === "/admin/cash") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      if (body.add != null) {
        const amt = round2(Number(body.add));
        if (!(Math.abs(amt) > 0 && Math.abs(amt) < 1e6)) return reply(400, { ok: false, code: "bad_amount" });
        const who = staff(body), note = String(body.note || "").slice(0, 100);
        await env.DB.batch([env.DB.prepare("INSERT INTO cash (at, day, who, amount, note) VALUES (?, ?, ?, ?, ?)").bind(Date.now(), riyadhDate(), who, amt, note),
          logStmt(env, who, "cash_in", "", { amount: amt, note })]);
      }
      return reply(200, { ok: true, ...(await readCash(env)) });
    }
    if (path === "/admin/report-test") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      return reply(200, { ok: true, report: await dailyReport(env) });
    }
    if (path === "/admin/today") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      return reply(200, { ok: true, ...(await readToday(env)) });
    }
    if (path === "/admin/orders") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      // صفحات: كل طلب ٥٠٠ طلب كحد أعلى عشان الخادم ما يتعب
      const lim = Math.min(500, Math.max(1, Math.floor(Number(body.limit) || 300)));
      const bn = Number(String(body.before || "").replace(/\D/g, ""));
      const before = bn > 1000 ? bn - 1000 : 1e12;
      const since = Number(body.since) || 0;
      const rs = await env.DB.prepare("SELECT no, created, updated, status, data, anon FROM orders WHERE no < ? AND created >= ? ORDER BY no DESC LIMIT ?").bind(before, since, lim).all();
      const orders = (rs.results || []).map((r) => ({ ...JSON.parse(r.data), no: "#" + (1000 + r.no), created: r.created, updated: r.updated, status: r.status, anon: !!r.anon }));
      return reply(200, { ok: true, orders, more: orders.length === lim, now: Date.now() });
    }
    // طلب جاء بالاتصال أو الواتساب أو في المحل: الموظف يدخله من الإدارة
    if (path === "/admin/order-new") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      let data;
      try { data = await loadData(env); } catch { return reply(502, { ok: false, code: "data" }); }
      const made = manualOrder(data, body);
      if (made.error) return reply(400, { ok: false, code: made.error });
      const rec = made.rec, need = needOf(rec);
      let orderNo, before = {};
      try {
        await ensureSchema(env);
        before = await readStock(env);
        const sid = Object.keys(need).find((id) => before[id] != null && before[id] < need[id]);
        if (sid && !body.force) return reply(409, { ok: false, code: "unavailable", id: sid, left: before[sid] });
        await withCost(env, rec);
        orderNo = await dbInsertOrder(env, rec, need, Date.now(), !!body.force, { who: staff(body), act: "order_new", info: JSON.stringify({ src: rec.source, total: rec.total, count: rec.count, force: !!body.force }) });
      } catch { return reply(502, { ok: false, code: "db" }); }
      later(afterOrder(env, data, rec, orderNo, before));
      return reply(200, { ok: true, order: { ...rec, no: orderNo, status: "new", created: Date.now(), updated: Date.now() } });
    }
    if (path === "/admin/order-edit") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      let data;
      try { data = await loadData(env); } catch { return reply(502, { ok: false, code: "data" }); }
      let r;
      try { r = await editOrder(env, data, body, staff(body)); } catch { return reply(502, { ok: false, code: "db" }); }
      if (r.error) return reply(400, { ok: false, code: r.error });
      return reply(200, { ok: true, order: r.order });
    }
    if (path === "/admin/verify") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      try { return reply(200, { ok: true, ...(await verifyStats(env, String(body.from || ""), String(body.to || ""), !!body.fix)) }); } catch { return reply(502, { ok: false, code: "db" }); }
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
      const costSet = body.costs && typeof body.costs === "object" ? body.costs : null;
      if ((stockSet || costSet) && !env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      let oldData = null; try { oldData = await loadData(env); } catch {}
      const oldStock = env.DB && stockSet ? await readStock(env).catch(() => ({})) : {};
      try {
        await saveToGitHub(env, "data.json", JSON.stringify(data), "تحديث المتجر من صفحة الإدارة");
      } catch (e) {
        return reply(502, { ok: false, code: e.code || "github", status: e.status || 0 });
      }
      if (body.newPin) await env.LOCKS.put("pin", await hashPin(env, String(body.newPin)));
      if (body.newDriverPin) await env.LOCKS.put("driver_pin", await hashPin(env, "driver:" + String(body.newDriverPin)));
      if (stockSet) { try { await setStock(env, stockSet); } catch { return reply(502, { ok: false, code: "stock" }); } }
      if (costSet) { try { await setCosts(env, costSet); } catch { return reply(502, { ok: false, code: "stock" }); } }
      if (env.DB) await logSave(env, staff(body), oldData, data, stockSet, oldStock, costSet, body).catch(() => {});
      dataCache = { at: 0, data: null };
      return reply(200, { ok: true, stock: stockSet ? await readStock(env) : undefined });
    }
    return reply(404, { ok: false, code: "not_found" });
    }
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
    "CREATE TABLE IF NOT EXISTS pcost (id TEXT PRIMARY KEY, cost REAL NOT NULL)",
    "CREATE TABLE IF NOT EXISTS alog (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, who TEXT NOT NULL, act TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', info TEXT NOT NULL DEFAULT '{}')",
    "CREATE TABLE IF NOT EXISTS cash (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, day TEXT NOT NULL, who TEXT NOT NULL, amount REAL NOT NULL, note TEXT NOT NULL DEFAULT '')",
    "CREATE TABLE IF NOT EXISTS st_item (day TEXT NOT NULL, id TEXT NOT NULL, qty INTEGER NOT NULL, revenue REAL NOT NULL, orders INTEGER NOT NULL, PRIMARY KEY (day, id))",
    "CREATE TABLE IF NOT EXISTS st_pair (a TEXT NOT NULL, b TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (a, b))",
  ].map((q) => env.DB.prepare(q)));
  // أعمدة إضافية للتحليل (تنضاف مرة وحدة للقاعدة القديمة بدون ما تمس بياناتها)
  const have = ((await env.DB.prepare("PRAGMA table_info(st_day)").all()).results || []).map((r) => r.name);
  const add = ["items", "card", "fees", "canceled", "newc", "deliv_ms", "deliv_n", "deliv_rev", "visits", "carts", "checkouts", "cost"].filter((c) => !have.includes(c));
  if (add.length) await env.DB.batch(add.map((c) => env.DB.prepare(`ALTER TABLE st_day ADD COLUMN ${c} REAL NOT NULL DEFAULT 0`)));
  // سجل الطلبات هو المرجع: أعمدة للأرقام + جدول لسطور كل طلب
  const oh = ((await env.DB.prepare("PRAGMA table_info(orders)").all()).results || []).map((r) => r.name);
  const ocols = { cost: "REAL NOT NULL DEFAULT 0", day: "TEXT", hour: "INTEGER", total: "REAL", fee: "REAL", items: "INTEGER", pay: "TEXT", ch: "TEXT", tail: "TEXT", dms: "INTEGER NOT NULL DEFAULT 0", anon: "INTEGER NOT NULL DEFAULT 0" };
  const oadd = Object.keys(ocols).filter((c) => !oh.includes(c));
  const more = oadd.map((c) => `ALTER TABLE orders ADD COLUMN ${c} ${ocols[c]}`).concat([
    "CREATE TABLE IF NOT EXISTS oline (no INTEGER NOT NULL, k INTEGER NOT NULL, id TEXT NOT NULL, qty INTEGER NOT NULL, price REAL NOT NULL, PRIMARY KEY (no, k))",
    "CREATE TABLE IF NOT EXISTS oline (no INTEGER NOT NULL, k INTEGER NOT NULL, id TEXT NOT NULL, qty INTEGER NOT NULL, price REAL NOT NULL, PRIMARY KEY (no, k))",
    "CREATE INDEX IF NOT EXISTS orders_day ON orders (day)",
    "CREATE INDEX IF NOT EXISTS orders_ch ON orders (ch)",
    "CREATE INDEX IF NOT EXISTS oline_id ON oline (id)",
  ]);
  await env.DB.batch(more.map((q) => env.DB.prepare(q)));
  // سعر الشراء في سطور الطلب وتحليل المنتجات
  const extra = [];
  for (const [t, c] of [["oline", "cost"], ["st_item", "cost"]]) {
    const cols = ((await env.DB.prepare(`PRAGMA table_info(${t})`).all()).results || []).map((r) => r.name);
    if (!cols.includes(c)) extra.push(env.DB.prepare(`ALTER TABLE ${t} ADD COLUMN ${c} REAL NOT NULL DEFAULT 0`));
  }
  extra.push(env.DB.prepare("CREATE INDEX IF NOT EXISTS orders_upd ON orders (status, updated)"));
  // حساب كاش المندوب يبدأ من يوم تركيب هالميزة (الطلبات القديمة ما تنحسب عليه)
  const now0 = Date.now();
  extra.push(env.DB.prepare("INSERT INTO cash (at, day, who, amount, note) SELECT ?, ?, 'النظام', 0, 'بداية الحساب' WHERE NOT EXISTS (SELECT 1 FROM cash)").bind(now0, riyadhDateAt(now0)));
  await env.DB.batch(extra);
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
// يحفظ الطلب وسطوره والمخزون والتحليل في خطوة وحدة (يا كلها تنحفظ، يا ولا شي)
async function dbInsertOrder(env, rec, need, now, force, log) {
  const P = (q, ...a) => env.DB.prepare(q).bind(...a);
  const day = riyadhDateAt(now), hour = riyadhHour(now);
  const ch = rec.phone ? (await hashPin(env, "cust:" + rec.phone)).slice(0, 32) : "";
  const items = (rec.lines || []).reduce((n, l) => n + Number(l.qty || 0), 0);
  const NO = "(SELECT MAX(no) FROM orders)";
  const st = [P("INSERT INTO orders (created, updated, status, phone, data, day, hour, total, fee, items, pay, ch, tail, cost) VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    now, now, rec.phone, JSON.stringify(rec), day, hour, Number(rec.total), Number(rec.fee || 0), items, rec.pay, ch, String(rec.phone || "").slice(-4), costOf(rec))];
  (rec.lines || []).forEach((l, k) => st.push(P(`INSERT INTO oline (no, k, id, qty, price, cost) VALUES (${NO}, ?, ?, ?, ?, ?)`, k, l.id || "", Number(l.qty), Number(l.price), Number(l.cost || 0))));
  if (log) st.push(env.DB.prepare(`INSERT INTO alog (at, who, act, ref, info) VALUES (?, ?, ?, '#' || (1000 + ${NO}), ?)`).bind(now, log.who, log.act, log.info));
  // المخزون: لو ما يكفي، هالسطر يوقف كل الحفظ (الطلب ما ينحفظ)
  for (const id of Object.keys(need)) {
    if (force) { st.push(P("UPDATE stock SET qty = MAX(qty - ?, 0) WHERE id = ?", need[id], id)); continue; }
    st.push(P("SELECT CASE WHEN qty < ? THEN json('stock') ELSE 1 END x FROM stock WHERE id = ?", need[id], id));
    st.push(P("UPDATE stock SET qty = qty - ? WHERE id = ?", need[id], id));
  }
  st.push(...statsStmts(env, rec, day, hour, 1, 0));
  await env.DB.batch(st);
  const row = await env.DB.prepare("SELECT MAX(no) no FROM orders WHERE created = ? AND ch = ?").bind(now, ch).first();
  return "#" + (1000 + row.no);
}
// تفاصيل الزبون (الجوال والعنوان) تنمسح بعد المدة، والطلب نفسه وأرقامه تبقى دايم
async function cleanupOld(env, keepDays) {
  const keep = Math.min(730, Math.max(7, Math.floor(Number(keepDays) || 90)));
  await env.DB.prepare("UPDATE orders SET phone = '', anon = 1, data = json_set(json_remove(data, '$.name', '$.details', '$.note', '$.lat', '$.lng', '$.map'), '$.phone', '') WHERE anon = 0 AND created < ? AND status IN ('delivered','canceled')")
    .bind(Date.now() - keep * 864e5).run();
}
async function changeStatus(env, n, st, now = Date.now(), who = "") {
  await ensureSchema(env);
  const old = await env.DB.prepare("SELECT status, data, created, day, hour, total, dms FROM orders WHERE no = ?").bind(n).first();
  if (!old) return null;
  if (old.status === st) return { changed: false };
  const P = (q, ...a) => env.DB.prepare(q).bind(...a);
  let rec = {}; try { rec = JSON.parse(old.data); } catch {}
  const day = old.day || riyadhDateAt(old.created), hour = old.hour ?? riyadhHour(old.created), counted = !!rec.st;
  const dms = st === "delivered" ? Math.max(0, now - old.created) : 0;
  const stmts = [P("UPDATE orders SET status = ?, updated = ?, dms = ? WHERE no = ?", st, now, dms, n)];
  if (who) stmts.push(logStmt(env, who, "status", "#" + (1000 + n), { from: old.status, to: st, total: Number(rec.total || 0) }));
  if ((st === "canceled") !== (old.status === "canceled")) {
    const back = st === "canceled";
    const need = needOf(rec), cur = await readStock(env);
    for (const id of Object.keys(need)) if (cur[id] != null) stmts.push(P("UPDATE stock SET qty = MAX(qty + ?, 0) WHERE id = ?", (back ? 1 : -1) * need[id], id));
    if (counted) stmts.push(...statsStmts(env, rec, day, hour, back ? -1 : 1, back ? 1 : -1));
  }
  const dl = (sign, ms) => P("INSERT INTO st_day (day, orders, revenue, deliv_n, deliv_ms, deliv_rev) VALUES (?, 0, 0, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET deliv_n = deliv_n + excluded.deliv_n, deliv_ms = deliv_ms + excluded.deliv_ms, deliv_rev = deliv_rev + excluded.deliv_rev", day, sign, sign * ms, round2(sign * Number(rec.total || 0)));
  if (counted && old.status === "delivered") stmts.push(dl(-1, Number(old.dms || 0)));
  if (counted && st === "delivered") stmts.push(dl(1, dms));
  await env.DB.batch(stmts);
  return { changed: true };
}
// تعديل الطلب بعد اتصال الزبون: المبالغ والمخزون والتحليل تتعدل مع بعض
async function editOrder(env, data, body, who) {
  await ensureSchema(env);
  const n = Number(String(body.no || "").replace(/\D/g, "")) - 1000;
  const old = n > 0 ? await env.DB.prepare("SELECT status, data, created, day, hour FROM orders WHERE no = ?").bind(n).first() : null;
  if (!old) return { error: "not_found" };
  if (old.status === "canceled") return { error: "canceled" };
  let rec; try { rec = JSON.parse(old.data); } catch { return { error: "bad_order" }; }
  const byId = {}; for (const p of data.products || []) byId[p.id] = p;
  const oldBy = {}; for (const l of rec.lines || []) oldBy[l.id] = l;
  const lines = [];
  for (const x of Array.isArray(body.lines) ? body.lines.slice(0, 200) : []) {
    const id = String(x.id || ""), q = Math.floor(Number(x.qty)), pr = Number(x.price);
    const p = byId[id] || oldBy[id];
    if (!p || !(q > 0 && q <= 500) || !(pr >= 0 && pr < 100000)) return { error: "bad_line" };
    lines.push({ id, name: p.name, unit: p.unit || "", qty: q, price: round2(pr), tag: (oldBy[id] && oldBy[id].price === round2(pr) && oldBy[id].tag) || "", cost: oldBy[id] && oldBy[id].cost != null ? Number(oldBy[id].cost) : undefined });
  }
  if (!lines.length) return { error: "empty" };
  const fee = Math.max(0, Number(body.fee ?? rec.fee) || 0);
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.price, 0));
  const nr = { ...rec, lines, subtotal, fee, total: round2(subtotal + fee), count: lines.reduce((s, l) => s + l.qty, 0), st: 1,
    edits: (rec.edits || []).concat([{ at: Date.now(), before: rec.total, after: round2(subtotal + fee) }]).slice(-20) };
  await withCost(env, nr, true);
  const P = (q, ...a) => env.DB.prepare(q).bind(...a);
  const day = old.day || riyadhDateAt(old.created), hour = old.hour ?? riyadhHour(old.created);
  const stmts = [P("UPDATE orders SET data = ?, total = ?, fee = ?, items = ?, updated = ?, day = ?, hour = ?, cost = ? WHERE no = ?", JSON.stringify(nr), nr.total, fee, nr.count, Date.now(), day, hour, costOf(nr), n),
    P("DELETE FROM oline WHERE no = ?", n)];
  lines.forEach((l, k) => stmts.push(P("INSERT INTO oline (no, k, id, qty, price, cost) VALUES (?, ?, ?, ?, ?, ?)", n, k, l.id, l.qty, l.price, Number(l.cost || 0))));
  if (who) stmts.push(logStmt(env, who, "order_edit", "#" + (1000 + n), { before: Number(rec.total || 0), after: nr.total }));
  if (rec.st) stmts.push(...statsStmts(env, rec, day, hour, -1, 0));
  stmts.push(...statsStmts(env, nr, day, hour, 1, 0));
  if (old.status === "delivered" && rec.st) stmts.push(P("UPDATE st_day SET deliv_rev = deliv_rev + ? WHERE day = ?", round2(nr.total - Number(rec.total || 0)), day));
  const a = needOf(rec), b = needOf(nr), cur = await readStock(env);
  for (const id of new Set(Object.keys(a).concat(Object.keys(b)))) {
    const d = (b[id] || 0) - (a[id] || 0);
    if (d && cur[id] != null) stmts.push(P("UPDATE stock SET qty = MAX(qty - ?, 0) WHERE id = ?", d, id));
  }
  await env.DB.batch(stmts);
  return { order: { ...nr, no: "#" + (1000 + n), status: old.status, created: old.created } };
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
async function afterOrder(env, data, rec, orderNo, before) {
  if (!env.LOCKS) return;
  const n = Number(String(orderNo).replace(/\D/g, ""));
  const msg = { title: "طلب جديد " + ({ phone: "(اتصال) ", whatsapp: "(واتساب) ", store: "(من المحل) " }[rec.source] || "") + orderNo, body: rec.count + " منتج · " + money(rec.total) + " · " + (rec.pay === "card" ? "شبكة" : "كاش") + (rec.name ? " · " + rec.name : ""), url: "./#driver", tag: "new" + n };
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

// أوامر التحليل لطلب واحد. sign = 1 يضيف، -1 يشيل. cancelDelta يعدّ الطلبات الملغية.
// ما تنفّذ لحالها: تنضاف لنفس خطوة حفظ الطلب عشان ما يصير فرق بينهم أبد.
function statsStmts(env, rec, day, hour, sign, cancelDelta) {
  const per = {};
  let items = 0;
  for (const l of rec.lines || []) {
    const q = Number(l.qty || 0); items += q;
    if (!l.id) continue;
    const x = per[l.id] || (per[l.id] = { qty: 0, rev: 0 });
    x.qty += q; x.rev += q * Number(l.price || 0); x.cost = (x.cost || 0) + q * Number(l.cost || 0);
  }
  const total = Number(rec.total || 0), fee = Number(rec.fee || 0), card = rec.pay === "card" ? 1 : 0, cost = costOf(rec);
  const ids = Object.keys(per).sort();
  const P = (q, ...a) => env.DB.prepare(q).bind(...a);
  const st = [
    P("INSERT INTO st_day (day, orders, revenue, items, card, fees, canceled, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET orders = orders + excluded.orders, revenue = revenue + excluded.revenue, items = items + excluded.items, card = card + excluded.card, fees = fees + excluded.fees, canceled = canceled + excluded.canceled, cost = cost + excluded.cost",
      day, sign, round2(sign * total), sign * items, sign * card, round2(sign * fee), cancelDelta, round2(sign * cost)),
    P("INSERT INTO st_hour (day, hour, orders, revenue) VALUES (?, ?, ?, ?) ON CONFLICT(day, hour) DO UPDATE SET orders = orders + excluded.orders, revenue = revenue + excluded.revenue", day, hour, sign, round2(sign * total)),
  ];
  for (const id of ids) st.push(P("INSERT INTO st_item (day, id, qty, revenue, orders, cost) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(day, id) DO UPDATE SET qty = qty + excluded.qty, revenue = revenue + excluded.revenue, orders = orders + excluded.orders, cost = cost + excluded.cost", day, id, sign * per[id].qty, round2(sign * per[id].rev), sign, round2(sign * (per[id].cost || 0))));
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
    st.push(P("INSERT INTO st_pair (a, b, n) VALUES (?, ?, ?) ON CONFLICT(a, b) DO UPDATE SET n = n + excluded.n", ids[i], ids[j], sign));
  return st;
}

// مراجعة: يعيد حساب التحليل من سجل الطلبات ويقارن. fix = يصحّح أي فرق.
async function verifyStats(env, from, to, fix) {
  await ensureSchema(env);
  const okDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!okDay(from)) from = "2000-01-01";
  if (!okDay(to)) to = "2999-12-31";
  await backfillOrders(env);
  const Q = (q, ...a) => env.DB.prepare(q).bind(...a).all().then((r) => r.results || []);
  const TRUTH_DAY = "SELECT day, SUM(status != 'canceled') orders, ROUND(SUM(CASE WHEN status != 'canceled' THEN total ELSE 0 END), 2) revenue, SUM(CASE WHEN status != 'canceled' THEN items ELSE 0 END) items, SUM(status != 'canceled' AND pay = 'card') card, ROUND(SUM(CASE WHEN status != 'canceled' THEN fee ELSE 0 END), 2) fees, SUM(status = 'canceled') canceled, SUM(status = 'delivered') deliv_n, SUM(CASE WHEN status = 'delivered' THEN dms ELSE 0 END) deliv_ms, ROUND(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 2) deliv_rev, ROUND(SUM(CASE WHEN status != 'canceled' THEN cost ELSE 0 END), 2) cost FROM orders WHERE total IS NOT NULL AND day BETWEEN ? AND ? GROUP BY day";
  const TRUTH_ITEM = "SELECT o.day day, l.id id, SUM(l.qty) qty, ROUND(SUM(l.qty * l.price), 2) revenue, COUNT(DISTINCT l.no) orders, ROUND(SUM(l.qty * l.cost), 2) cost FROM oline l JOIN orders o ON o.no = l.no WHERE o.status != 'canceled' AND l.id != '' AND o.day BETWEEN ? AND ? GROUP BY o.day, l.id";
  const TRUTH_HOUR = "SELECT day, hour, SUM(status != 'canceled') orders, ROUND(SUM(CASE WHEN status != 'canceled' THEN total ELSE 0 END), 2) revenue FROM orders WHERE total IS NOT NULL AND day BETWEEN ? AND ? GROUP BY day, hour";
  const [td, sd, ti, si, th, sh] = await Promise.all([
    Q(TRUTH_DAY, from, to), Q("SELECT * FROM st_day WHERE day BETWEEN ? AND ?", from, to),
    Q(TRUTH_ITEM, from, to), Q("SELECT * FROM st_item WHERE day BETWEEN ? AND ? AND (qty != 0 OR orders != 0)", from, to),
    Q(TRUTH_HOUR, from, to), Q("SELECT * FROM st_hour WHERE day BETWEEN ? AND ? AND orders != 0", from, to),
  ]);
  const F = ["orders", "revenue", "items", "card", "fees", "canceled", "deliv_n", "deliv_ms", "deliv_rev", "cost"];
  const diffs = [], sdm = {}, tdm = {};
  for (const r of sd) sdm[r.day] = r;
  for (const r of td) tdm[r.day] = r;
  for (const d of new Set(Object.keys(sdm).concat(Object.keys(tdm)))) for (const k of F) {
    const a = Number((tdm[d] || {})[k] || 0), b = Number((sdm[d] || {})[k] || 0);
    if (Math.abs(a - b) > 0.009) diffs.push({ day: d, field: k, truth: a, stats: b });
  }
  const keyed = (rows, kf) => { const m = {}; for (const r of rows) m[kf(r)] = r; return m; };
  const ti2 = keyed(ti, (r) => r.day + "|" + r.id), si2 = keyed(si, (r) => r.day + "|" + r.id);
  let itemDiffs = 0;
  for (const k of new Set(Object.keys(ti2).concat(Object.keys(si2)))) for (const f of ["qty", "revenue", "orders", "cost"]) if (Math.abs(Number((ti2[k] || {})[f] || 0) - Number((si2[k] || {})[f] || 0)) > 0.009) { itemDiffs++; break; }
  const th2 = keyed(th, (r) => r.day + "|" + r.hour), sh2 = keyed(sh, (r) => r.day + "|" + r.hour);
  let hourDiffs = 0;
  for (const k of new Set(Object.keys(th2).concat(Object.keys(sh2)))) if (Math.abs(Number((th2[k] || {}).orders || 0) - Number((sh2[k] || {}).orders || 0)) > 0 || Math.abs(Number((th2[k] || {}).revenue || 0) - Number((sh2[k] || {}).revenue || 0)) > 0.009) hourDiffs++;
  const tp = await Q("SELECT a.id a, b.id b, COUNT(*) n FROM (SELECT DISTINCT no, id FROM oline WHERE id != '') a JOIN (SELECT DISTINCT no, id FROM oline WHERE id != '') b ON a.no = b.no AND a.id < b.id JOIN orders o ON o.no = a.no WHERE o.status != 'canceled' GROUP BY a.id, b.id");
  const sp = await Q("SELECT a, b, n FROM st_pair WHERE n != 0");
  const tp2 = keyed(tp, (r) => r.a + "|" + r.b), sp2 = keyed(sp, (r) => r.a + "|" + r.b);
  let pairDiffs = 0;
  for (const k of new Set(Object.keys(tp2).concat(Object.keys(sp2)))) if (Number((tp2[k] || {}).n || 0) !== Number((sp2[k] || {}).n || 0)) pairDiffs++;
  const tot = td.reduce((o, r) => { o.orders += r.orders; o.revenue += r.revenue; o.canceled += r.canceled; o.delivered += r.deliv_n; return o; }, { orders: 0, revenue: 0, canceled: 0, delivered: 0 });
  tot.revenue = round2(tot.revenue);
  const legacy = (await env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE total IS NULL").first()).n;
  const clean = !diffs.length && !itemDiffs && !hourDiffs && !pairDiffs;
  let fixed = false;
  if (fix && !clean) {
    const P = (q, ...a) => env.DB.prepare(q).bind(...a);
    await env.DB.batch([
      P("UPDATE st_day SET " + F.map((k) => k + " = 0").join(", ") + " WHERE day BETWEEN ? AND ?", from, to),
      P("INSERT INTO st_day (day, " + F.join(", ") + ") " + TRUTH_DAY + " ON CONFLICT(day) DO UPDATE SET " + F.map((k) => k + " = excluded." + k).join(", "), from, to),
      P("DELETE FROM st_item WHERE day BETWEEN ? AND ?", from, to),
      P("INSERT INTO st_item (day, id, qty, revenue, orders, cost) " + TRUTH_ITEM, from, to),
      P("DELETE FROM st_hour WHERE day BETWEEN ? AND ?", from, to),
      P("INSERT INTO st_hour (day, hour, orders, revenue) " + TRUTH_HOUR, from, to),
      P("DELETE FROM st_pair"),
      P("INSERT INTO st_pair (a, b, n) SELECT a.id, b.id, COUNT(*) FROM (SELECT DISTINCT no, id FROM oline WHERE id != '') a JOIN (SELECT DISTINCT no, id FROM oline WHERE id != '') b ON a.no = b.no AND a.id < b.id JOIN orders o ON o.no = a.no WHERE o.status != 'canceled' GROUP BY a.id, b.id"),
    ]);
    fixed = true;
  }
  return { from, to, clean, fixed, totals: tot, dayDiffs: diffs.slice(0, 50), dayDiffCount: diffs.length, itemDiffs, hourDiffs, pairDiffs, legacy };
}
// الطلبات المسجلة قبل هالتحديث: نعبّي أعمدتها من تفاصيلها
async function backfillOrders(env) {
  const rs = await env.DB.prepare("SELECT no, created, phone, data FROM orders WHERE total IS NULL LIMIT 300").all();
  const st = [];
  for (const r of rs.results || []) {
    let rec; try { rec = JSON.parse(r.data); } catch { continue; }
    const ch = r.phone ? (await hashPin(env, "cust:" + r.phone)).slice(0, 32) : "";
    st.push(env.DB.prepare("UPDATE orders SET day = ?, hour = ?, total = ?, fee = ?, items = ?, pay = ?, ch = ?, tail = ?, cost = ? WHERE no = ?")
      .bind(riyadhDateAt(r.created), riyadhHour(r.created), Number(rec.total || 0), Number(rec.fee || 0), (rec.lines || []).reduce((n, l) => n + Number(l.qty || 0), 0), rec.pay === "card" ? "card" : "cash", ch, String(r.phone || "").slice(-4), costOf(rec), r.no));
    st.push(env.DB.prepare("DELETE FROM oline WHERE no = ?").bind(r.no));
    (rec.lines || []).forEach((l, k) => st.push(env.DB.prepare("INSERT INTO oline (no, k, id, qty, price, cost) VALUES (?, ?, ?, ?, ?, ?)").bind(r.no, k, l.id || "", Number(l.qty || 0), Number(l.price || 0), Number(l.cost || 0))));
  }
  if (st.length) await env.DB.batch(st);
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
    Q("SELECT id, SUM(CASE WHEN day >= ? THEN qty ELSE 0 END) qty, SUM(CASE WHEN day >= ? THEN revenue ELSE 0 END) revenue, SUM(CASE WHEN day >= ? THEN orders ELSE 0 END) orders, SUM(CASE WHEN day < ? THEN qty ELSE 0 END) prev, ROUND(SUM(CASE WHEN day >= ? THEN cost ELSE 0 END), 2) cost FROM st_item WHERE day >= ? GROUP BY id ORDER BY qty DESC", from, from, from, from, from, prev),
    Q("SELECT id, SUM(orders) orders FROM st_item GROUP BY id"),
    Q("SELECT a, b, n FROM st_pair WHERE n >= 2 ORDER BY n DESC LIMIT 120"),
    Q("SELECT status, COUNT(*) n FROM orders WHERE created > ? GROUP BY status", Date.now() - days * 864e5),
    Q("SELECT day, hour, orders FROM st_hour WHERE day >= ? AND orders > 0", from),
    Q("SELECT id, SUM(views) views, SUM(carts) carts FROM st_view WHERE day >= ? GROUP BY id", from),
    Q("SELECT q, SUM(n) n, SUM(miss) miss FROM st_search WHERE day >= ? GROUP BY q ORDER BY n DESC LIMIT 80", from),
    Q("SELECT COUNT(*) total, SUM(f >= ?) fresh, SUM(f >= ? AND f < ?) freshPrev, SUM(l >= ?) active, SUM(n >= 2) loyal, SUM(n >= 2 AND l < ?) gone FROM (SELECT MIN(day) f, MAX(day) l, COUNT(*) n FROM orders WHERE status != 'canceled' AND ch != '' AND day <= ? GROUP BY ch)", from, prev, from, from, riyadhDate(-30), riyadhDate()),
    Q("SELECT MAX(tail) tail, MIN(day) first, MAX(day) last, COUNT(*) orders, ROUND(SUM(total), 2) revenue FROM orders WHERE status != 'canceled' AND ch != '' GROUP BY ch ORDER BY revenue DESC LIMIT 15"),
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

// يبني الطلب اللي أدخله الموظف. الأسعار من المتجر، والموظف يقدر يعدّلها.
function manualOrder(data, body) {
  const S = data.store || {};
  const byId = {}; for (const p of data.products || []) byId[p.id] = p;
  const lines = [];
  for (const x of Array.isArray(body.lines) ? body.lines.slice(0, 200) : []) {
    const p = byId[String(x.id || "")], q = Math.floor(Number(x.qty)), pr = x.price == null ? Number(p && p.price) : Number(x.price);
    if (!p || !(q > 0 && q <= 500) || !(pr >= 0 && pr < 100000)) return { error: "bad_line" };
    const same = lines.find((l) => l.id === p.id && l.price === round2(pr));
    if (same) same.qty += q; else lines.push({ id: p.id, name: p.name, unit: p.unit || "", qty: q, price: round2(pr), tag: "" });
  }
  if (!lines.length) return { error: "empty" };
  const raw = String(body.phone || "").trim(), phone = raw ? normPhone(raw) : "";
  if (raw && !phone) return { error: "bad_phone" };
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.price, 0));
  const autoFee = S.freeOver && subtotal >= S.freeOver ? 0 : Number(S.fee || 0);
  const fee = body.fee == null || body.fee === "" ? autoFee : Math.max(0, Math.min(1000, Number(body.fee) || 0));
  // الموقع: إحداثيات مكتوبة، أو رابط قوقل ماب من الواتساب
  const loc = String(body.loc || "").trim().slice(0, 400);
  let lat = NaN, lng = NaN, map = "";
  const m = /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/.exec(loc);
  if (m) { lat = Number(m[1]); lng = Number(m[2]); }
  if (lat >= 16 && lat <= 33 && lng >= 34 && lng <= 56) map = mapsUrl(lat, lng);
  else if (/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.|maps\.)?google\.[a-z.]+\/maps)[^\s<>"']*$/i.test(loc)) { map = loc; lat = NaN; lng = NaN; }
  else { lat = NaN; lng = NaN; }
  const src = ["phone", "whatsapp", "store"].includes(body.source) ? body.source : "phone";
  return { rec: {
    lines, subtotal, fee, total: round2(subtotal + fee), count: lines.reduce((s, l) => s + l.qty, 0), phone,
    name: String(body.name || "").slice(0, 60), details: String(body.details || "").slice(0, 200), note: String(body.note || "").slice(0, 300),
    pay: body.pay === "card" ? "card" : "cash", lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng, map,
    source: src, st: 1,
  } };
}

// ---------- سعر الشراء (سري، في القاعدة مو في الموقع العام) ----------
async function readCosts(env) {
  await ensureSchema(env);
  const rs = await env.DB.prepare("SELECT id, cost FROM pcost").all();
  const out = {}; for (const r of rs.results || []) out[r.id] = r.cost; return out;
}
async function setCosts(env, map) {
  await ensureSchema(env);
  const st = [];
  for (const [id, v] of Object.entries(map).slice(0, 5000)) {
    if (v === null || v === "") st.push(env.DB.prepare("DELETE FROM pcost WHERE id = ?").bind(String(id)));
    else { const c = round2(Number(v)); if (c >= 0 && c < 1e6) st.push(env.DB.prepare("INSERT INTO pcost (id, cost) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET cost = excluded.cost").bind(String(id), c)); }
  }
  if (st.length) await env.DB.batch(st);
}
// يحط سعر الشراء وقت الطلب على كل سطر، عشان الربح القديم ما يتغير لو تغيّر سعر الشراء بعدين
async function withCost(env, rec, keepOld) {
  const costs = await readCosts(env);
  for (const l of rec.lines || []) { if (keepOld && l.cost != null) continue; l.cost = Number(costs[l.id] || 0); }
  return rec;
}
function costOf(rec) { return round2((rec.lines || []).reduce((s, l) => s + Number(l.qty || 0) * Number(l.cost || 0), 0)); }

// ---------- سجل العمليات ----------
function staff(body) { return String((body && body.by) || "").trim().slice(0, 30) || "الإدارة"; }
function safeJson(t) { try { return JSON.parse(t); } catch { return {}; } }
function logStmt(env, who, act, ref, info) {
  return env.DB.prepare("INSERT INTO alog (at, who, act, ref, info) VALUES (?, ?, ?, ?, ?)").bind(Date.now(), String(who || "").slice(0, 30), act, ref || "", JSON.stringify(info || {}));
}
async function logSave(env, who, oldD, newD, stockSet, oldStock, costSet, body) {
  const st = [], byOld = {}, byNew = {};
  for (const p of (oldD && oldD.products) || []) byOld[p.id] = p;
  for (const p of newD.products || []) byNew[p.id] = p;
  if (oldD) {
    for (const p of newD.products) {
      const o = byOld[p.id];
      if (!o) { st.push(logStmt(env, who, "prod_add", p.id, { name: p.name, price: p.price })); continue; }
      if (Number(o.price) !== Number(p.price)) st.push(logStmt(env, who, "price", p.id, { name: p.name, from: Number(o.price), to: Number(p.price) }));
      if (Number(o.old || 0) !== Number(p.old || 0)) st.push(logStmt(env, who, "sale", p.id, { name: p.name, from: Number(o.old || 0), to: Number(p.old || 0) }));
      if (!!o.stock !== !!p.stock) st.push(logStmt(env, who, p.stock ? "avail_on" : "avail_off", p.id, { name: p.name }));
    }
    for (const id of Object.keys(byOld)) if (!byNew[id]) st.push(logStmt(env, who, "prod_del", id, { name: byOld[id].name }));
    const os = oldD.store || {}, ns = newD.store || {};
    if (!!os.closed !== !!ns.closed) st.push(logStmt(env, who, ns.closed ? "store_close" : "store_open", "", {}));
    if (Number(os.fee || 0) !== Number(ns.fee || 0) || Number(os.freeOver || 0) !== Number(ns.freeOver || 0)) st.push(logStmt(env, who, "fees", "", { fee: Number(ns.fee || 0), freeOver: Number(ns.freeOver || 0) }));
  }
  for (const [id, v] of Object.entries(stockSet || {})) {
    const was = oldStock[id] == null ? null : oldStock[id], now = v === null || v === "" ? null : Math.floor(Number(v));
    if (was !== now) st.push(logStmt(env, who, "stock", id, { name: (byNew[id] || {}).name || id, from: was, to: now }));
  }
  for (const id of Object.keys(costSet || {})) st.push(logStmt(env, who, "cost", id, { name: (byNew[id] || {}).name || id }));
  if (body.newPin) st.push(logStmt(env, who, "pin_admin", "", {}));
  if (body.newDriverPin) st.push(logStmt(env, who, "pin_driver", "", {}));
  if (Math.random() < 0.05) st.push(env.DB.prepare("DELETE FROM alog WHERE at < ?").bind(Date.now() - 400 * 864e5));
  for (let i = 0; i < st.length; i += 80) await env.DB.batch(st.slice(i, i + 80));
}

// ---------- كاش المندوب ----------
// كل طلب كاش تم توصيله = فلوس عند المندوب. كل استلام تسجله الإدارة ينقص منها.
async function readCash(env) {
  const D = "date((updated + 10800000) / 1000, 'unixepoch')";
  const Q = (q, ...a) => env.DB.prepare(q).bind(...a).all().then((r) => r.results || []);
  const [days, got, tot, hist] = await Promise.all([
    Q(`SELECT ${D} day, COUNT(*) n, ROUND(SUM(total), 2) cash FROM orders WHERE status = 'delivered' AND pay = 'cash' AND updated > ? GROUP BY day ORDER BY day DESC`, Date.now() - 14 * 864e5),
    Q("SELECT day, ROUND(SUM(amount), 2) got FROM cash WHERE at > ? GROUP BY day", Date.now() - 14 * 864e5),
    Q("SELECT (SELECT IFNULL(SUM(total), 0) FROM orders WHERE status = 'delivered' AND pay = 'cash' AND updated >= IFNULL((SELECT MIN(at) FROM cash), 0)) owed, (SELECT IFNULL(SUM(amount), 0) FROM cash) got, (SELECT MIN(at) FROM cash) since"),
    Q("SELECT at, who, amount, note FROM cash WHERE amount != 0 ORDER BY id DESC LIMIT 30"),
  ]);
  const gm = {}; for (const g of got) gm[g.day] = g.got;
  const t = tot[0] || {};
  return { days: days.map((d) => ({ ...d, got: gm[d.day] || 0 })), balance: round2(Number(t.owed || 0) - Number(t.got || 0)), since: t.since || null, history: hist };
}

// ---------- اليوم حتى الحين ----------
async function readToday(env) {
  await ensureSchema(env);
  const now = Date.now(), today = riyadhDate(), last = riyadhDate(-7), hr = riyadhHour(now);
  const Q = (q, ...a) => env.DB.prepare(q).bind(...a).all().then((r) => r.results || []);
  const [rows, open, cash] = await Promise.all([
    Q("SELECT day, SUM(status != 'canceled') orders, ROUND(SUM(CASE WHEN status != 'canceled' THEN total ELSE 0 END), 2) revenue, ROUND(SUM(CASE WHEN status != 'canceled' THEN cost ELSE 0 END), 2) cost, SUM(status = 'canceled') canceled, SUM(status != 'canceled' AND pay = 'card') card FROM orders WHERE (day = ? OR (day = ? AND hour <= ?)) GROUP BY day", today, last, hr),
    Q("SELECT status, COUNT(*) n FROM orders WHERE status IN ('new','accepted','onway') GROUP BY status"),
    readCash(env),
  ]);
  const m = {}; for (const r of rows) m[r.day] = r;
  const hours = await Q("SELECT day, hour, SUM(status != 'canceled') orders FROM orders WHERE day IN (?, ?) GROUP BY day, hour", today, last);
  return { today: m[today] || { orders: 0, revenue: 0, cost: 0, canceled: 0, card: 0 }, lastWeek: m[last] || { orders: 0, revenue: 0, cost: 0, canceled: 0, card: 0 }, hour: hr, open, hours, cashBalance: cash.balance, cashSince: cash.since };
}

// ---------- تقرير آخر اليوم ----------
async function dailyReport(env) {
  const t = await readToday(env), d = t.today, lw = t.lastWeek;
  const day = riyadhDate();
  const top = await env.DB.prepare("SELECT l.id id, MAX(json_extract(o.data, '$.lines[0].name')) n, SUM(l.qty) q FROM oline l JOIN orders o ON o.no = l.no WHERE o.day = ? AND o.status != 'canceled' GROUP BY l.id ORDER BY q DESC LIMIT 1").bind(day).first().catch(() => null);
  let topName = "";
  if (top) { const r = await env.DB.prepare("SELECT data FROM orders o JOIN oline l ON l.no = o.no WHERE l.id = ? AND o.day = ? LIMIT 1").bind(top.id, day).first(); const rec = r ? safeJson(r.data) : {}; const ln = (rec.lines || []).find((x) => x.id === top.id); topName = ln ? ln.name + " (" + top.q + ")" : ""; }
  const stock = await readStock(env), low = Object.values(stock).filter((q) => q <= 3).length;
  const profit = d.cost > 0 ? round2(d.revenue - d.cost) : null;
  const chg = lw.revenue ? Math.round((d.revenue - lw.revenue) / lw.revenue * 100) : null;
  const lines = [
    `${d.orders} طلب · ${money(d.revenue)}` + (chg != null ? ` (${chg >= 0 ? "+" : ""}${chg}٪ عن الأسبوع اللي طاف)` : ""),
    profit != null ? `الربح التقريبي: ${money(profit)}` : null,
    t.cashBalance > 0 ? `كاش عند المندوب: ${money(t.cashBalance)}` : null,
    d.canceled ? `ملغي: ${d.canceled}` : null,
    topName ? `الأكثر طلبًا: ${topName}` : null,
    low ? `${low} منتج قرب يخلص` : null,
  ].filter(Boolean);
  const msg = { title: "تقرير اليوم · " + day, body: lines.join("\n"), url: "./", tag: "daily" };
  await notifyRole(env, "admin", null, msg);
  const chat = env.TELEGRAM_BOT_TOKEN && env.LOCKS ? await env.LOCKS.get("tg_chat") : null;
  if (chat) await tgSend(env, chat, "📊 <b>" + esc(msg.title) + "</b>\n" + lines.map(esc).join("\n"));
  return msg;
}
