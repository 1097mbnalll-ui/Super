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
    let principal = null;
    const reply = (status, body) =>
      new Response(JSON.stringify(principal?.role === "orders" ? withoutCosts(body) : body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

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
    // أي عملية ممكن تغيّر المخزون (طلب، تعديل، إلغاء، حفظ) تفضّي ذاكرة المخزون؛ الاستعلامات الدورية (التتبع، قائمة المندوب…) ما تفضيها
    if (request.method === "POST" && !/^\/(?:track|ev|stats|driver\/(?:orders|pending|loc|loc-off|cash|login|push)|admin\/(?:orders|alerts|today|stats|log|team|prep|pos-orders|openitems|driver-loc|staff|cash|day-report|settlement-requests))$/.test(path)) stockCache.at = 0;
    if (request.method === "GET" && path === "/stock") {
      // كل زائر يسأل عن المخزون كل دقيقة؛ مع آلاف المنتجات نخزن النتيجة ١٥ ثانية بدل ما نقرأ القاعدة كل مرة
      if (!stockCache.body || Date.now() - stockCache.at > 15000) stockCache = { at: Date.now(), body: JSON.stringify({ ok: true, stock: env.DB ? await readStock(env) : {} }) };
      return new Response(stockCache.body, { headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=10" } });
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
    if (body.pin != null) body.pin = asciiDigits(String(body.pin));

    // طلب من زبون: ما يحتاج رقم سري
    if (path === "/order") {
      if (!env.LOCKS) return reply(500, { ok: false, code: "config", missing: "LOCKS" });
      const chat = env.TELEGRAM_BOT_TOKEN ? await env.LOCKS.get("tg_chat") : null;
      if (!env.DB && !chat) return reply(503, { ok: false, code: "no_receiver" });
      if(body.requestId && body.walletRequestId && body.requestId!==body.walletRequestId)return reply(400,{ok:false,code:'bad_request_id'});
      const requestId = body.requestId || body.walletRequestId || null;
      if (requestId && !operationId({requestId})) return reply(400,{ok:false,code:'bad_request_id'});
      if (requestId && !env.DB) return reply(503,{ok:false,code:'idempotency_unavailable'});
      let checkout = null;
      if (requestId) {
        await ensureSchema(env);
        checkout = { id: requestId, fingerprint: await checkoutFingerprint(body) };
        const repeated = await checkoutResult(env, checkout);
        if (repeated) return reply(repeated.ok ? 200 : 409, repeated);
      }
      if (env.DB ? await rateHit(env, "ord:" + ip, 6, 600) : await tooManyOrders(env, ip)) return reply(429, { ok: false, code: "slow_down" });
      let data;
      try { data = await loadData(env); } catch { return reply(502, { ok: false, code: "data" }); }
      const priced = priceOrder(data, body);
      if (priced.error) return reply(400, { ok: false, code: priced.error, id: priced.id, max: priced.max, min: priced.min });
      // منطقة التوصيل: لو المحل حدد أقصى مسافة
      const S0 = data.store || {}, shop = Array.isArray(S0.shop) && S0.shop.length === 2 ? S0.shop.map(Number) : null, maxKm = Number(S0.maxKm) || 0;
      const zone = zoneOf(S0), hasLoc = isFinite(Number(body.lat)) && isFinite(Number(body.lng)) && body.lat !== null && body.lng !== null && body.lat !== "" && body.lng !== "";
      if (zone && hasLoc && !inPolygon(zone, Number(body.lat), Number(body.lng))) return reply(400, { ok: false, code: "out_of_zone" });
      if (!zone && shop && maxKm > 0 && hasLoc) {
        const km = distM(shop[0], shop[1], Number(body.lat), Number(body.lng)) / 1000;
        if (km > maxKm) return reply(400, { ok: false, code: "too_far", km: Math.round(km * 10) / 10, max: maxKm });
      }
      const record = orderRecord(priced, body);
      const walletPart = moneyCents(body.walletAmount || 0);
      if (walletPart === null || walletPart > moneyCents(record.total)) return reply(400,{ok:false,code:'bad_payment'});
      if (walletPart) {
        if(!env.DB) return reply(503,{ok:false,code:'wallet_unavailable'});
        const account=await walletSession(env,body.walletToken);
        if(!account || account.phone !== record.phone) return reply(401,{ok:false,code:'wallet_login'});
        if(!operationId({requestId:body.walletRequestId}))return reply(400,{ok:false,code:'bad_payment'});
        const previous=await env.DB.prepare('SELECT o.no,o.total,o.phone FROM wallet_order_keys k JOIN orders o ON o.no=k.no WHERE k.request_id=?').bind(body.walletRequestId).first();
        if(previous){if(previous.phone!==account.phone)return reply(409,{ok:false,code:'conflict'});return reply(200,{ok:true,orderNo:'#'+(1000+previous.no),total:previous.total,track:true,repeated:true});}
        if(account.balance < walletPart) return reply(409,{ok:false,code:'wallet_balance'});
        record.walletCents=walletPart;record.walletRequestId=body.walletRequestId;
      }
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
            orderNo = await dbInsertOrder(env, record, need, Date.now(), false, null, { checkout });
          } catch (e) {
            if (checkout) { const repeated = await checkoutResult(env, checkout); if (repeated) return reply(repeated.ok ? 200 : 409, repeated); }
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
      const row = await env.DB.prepare("SELECT status, updated, data, drv FROM orders WHERE no = ? AND phone = ?").bind(n, phone).first();
      if (!row) return reply(404, { ok: false, code: "not_found" });
      const out = { ok: true, status: row.status, updated: row.updated };
      if (["new", "accepted", "onway"].includes(row.status)) {
        const offs = (await env.DB.prepare("SELECT id, line_id, to_id, created FROM sub_offers WHERE no = ? AND state = 'pending' ORDER BY id").bind(n).all()).results || [];
        if (offs.length) {
          let data1 = null; try { data1 = await loadData(env); } catch { /* بدون بيانات: ما نعرض البدائل */ }
          const rec = safeJson(row.data), byId = {}; for (const p of (data1 && data1.products) || []) byId[p.id] = p;
          out.subs = offs.map((o) => { const l = (rec.lines || []).find((x) => x.id === o.line_id), t = byId[o.to_id]; return l && t ? { id: o.id, name: l.name, qty: l.qty, price: l.price, to: { id: t.id, name: t.name, unit: t.unit || "", price: Number(t.price), img: t.img || "" }, diff: round2((Number(t.price) - Number(l.price)) * l.qty), at: o.created } : null; }).filter(Boolean);
        }
      }
      if (row.status === "onway") { try { out.driver = await driverFor(env, n, safeJson(row.data), row.drv); } catch { /* التتبع إضافة، ما يوقف الحالة */ } }
      return reply(200, out);
    }

    // الزبون يلغي طلبه (رقم الطلب + نفس الجوال). السماح حسب إعداد المحل: قبل التجهيز (الافتراضي)، قبل ما يطلع المندوب، أو ما يلغي.
    if (path === "/cancel") {
      if (!env.DB) return reply(404, { ok: false, code: "no_tracking" });
      const n = Number(String(body.no || "").replace(/\D/g, "")) - 1000, phone = normPhone(body.phone);
      if (!(n > 0) || !phone) return reply(400, { ok: false, code: "bad_request" });
      if (await rateHit(env, "cx:" + ip, 8, 600)) return reply(429, { ok: false, code: "slow_down" });
      await ensureSchema(env);
      const row = await env.DB.prepare("SELECT status, data FROM orders WHERE no = ? AND phone = ?").bind(n, phone).first();
      if (!row) return reply(404, { ok: false, code: "not_found" });
      let data0 = {}; try { data0 = await loadData(env); } catch { /* الإعداد الافتراضي */ }
      const policy = (data0.store || {}).custCancel || "new";
      const allowed = policy === "off" ? [] : policy === "accepted" ? ["new", "accepted"] : ["new"];
      if (row.status === "canceled") return reply(200, { ok: true, already: true });
      if (!allowed.includes(row.status)) return reply(409, { ok: false, code: row.status === "accepted" || row.status === "onway" ? "too_late" : "closed", status: row.status });
      let r;
      try { r = await changeStatus(env, n, "canceled", Date.now(), "الزبون", null); } catch { return reply(502, { ok: false, code: "db" }); }
      if (r && r.conflict) return reply(409, { ok: false, code: "too_late" });
      const reason = String(body.reason || "").trim().slice(0, 60);
      await env.DB.batch([
        env.DB.prepare("UPDATE orders SET data = json_set(data, '$.cancel', json(?)) WHERE no = ?").bind(JSON.stringify({ by: "customer", at: Date.now(), reason }), n),
        env.DB.prepare("UPDATE sub_offers SET state = 'withdrawn', answered = ? WHERE no = ? AND state = 'pending'").bind(Date.now(), n),
        logStmt(env, "الزبون", "cancel_order", "#" + (1000 + n), { reason, from: row.status }),
      ]);
      later(notifyRole(env, "driver", null, { title: "الزبون ألغى الطلب #" + (1000 + n), body: reason ? "السبب: " + reason : "", url: "./#driver", tag: "cancel" + n }));
      return reply(200, { ok: true });
    }
    // الزبون يرد على بديل اقترحه المندوب: يوافق (ينبدل المنتج) أو يرفض (ينشال المنتج من الطلب)
    if (path === "/sub-answer") {
      if (!env.DB) return reply(404, { ok: false, code: "no_tracking" });
      const n = Number(String(body.no || "").replace(/\D/g, "")) - 1000, phone = normPhone(body.phone), oid = Number(body.offer) || 0;
      if (!(n > 0) || !phone || !oid) return reply(400, { ok: false, code: "bad_request" });
      if (await rateHit(env, "sa:" + ip, 20, 600)) return reply(429, { ok: false, code: "slow_down" });
      await ensureSchema(env);
      const row = await env.DB.prepare("SELECT status, data, drv FROM orders WHERE no = ? AND phone = ?").bind(n, phone).first();
      if (!row) return reply(404, { ok: false, code: "not_found" });
      const off = await env.DB.prepare("SELECT * FROM sub_offers WHERE id = ? AND no = ?").bind(oid, n).first();
      if (!off || off.state !== "pending" || !["new", "accepted", "onway"].includes(row.status)) return reply(409, { ok: false, code: "stale" });
      const done = body.accept === true || body.accept === "yes";
      let data;
      try { data = await loadData(env); } catch { return reply(502, { ok: false, code: "data" }); }
      const rec = safeJson(row.data), line = (rec.lines || []).find((l) => l.id === off.line_id);
      if (!line) { await env.DB.prepare("UPDATE sub_offers SET state = 'withdrawn', answered = ? WHERE id = ?").bind(Date.now(), oid).run(); return reply(409, { ok: false, code: "stale" }); }
      const toP = (data.products || []).find((p) => p.id === off.to_id);
      let lines = (rec.lines || []).map((l) => ({ id: l.id, qty: l.qty, price: l.price }));
      if (done) {
        if (!toP || !toP.stock) return reply(409, { ok: false, code: "bad_swap" });
        const ex = lines.find((l) => l.id === toP.id && l.price === Number(toP.price));
        lines = lines.filter((l) => l.id !== off.line_id);
        if (ex) ex.qty += line.qty * (Number(line.per) || 1); else lines.push({ id: toP.id, qty: line.qty * (Number(line.per) || 1), price: Number(toP.price) });
      } else lines = lines.filter((l) => l.id !== off.line_id);
      if (!lines.length) return reply(409, { ok: false, code: "last_item" });
      let r;
      try { r = await editOrder(env, data, { no: body.no, fee: rec.fee, lines }, "الزبون"); } catch { return reply(502, { ok: false, code: "db" }); }
      if (r.error) return reply(409, { ok: false, code: r.error });
      await env.DB.prepare("UPDATE sub_offers SET state = ?, answered = ? WHERE id = ?").bind(done ? "accepted" : "rejected", Date.now(), oid).run();
      later(notifyRole(env, "admin", null, { title: (done ? "الزبون وافق على البديل" : "الزبون رفض البديل") + " · #" + (1000 + n), body: done ? `«${line.name}» ← «${toP.name}»` : `«${line.name}» انشال من الطلب`, url: "./", tag: "sub" + n }));
      return reply(200, { ok: true, order: { total: r.order.total } });
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
      later(pushTo(env, [normSub(body.sub)], { title: "تم تفعيل الإشعارات", body: "بنبلغك أول ما تتغير حالة طلبك #" + (1000 + n), url: "./", tag: "order" + n }));
      return reply(200, { ok: true });
    }
    if (path === "/push/unsub") {
      if (env.DB && body.endpoint) { await ensureSchema(env); await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(String(body.endpoint)).run(); }
      return reply(200, { ok: true });
    }

    if (path === '/wallet/login' || path === '/wallet/me' || path === '/wallet/logout') {
      if (!env.DB) return reply(503, { ok: false, code: 'unavailable' });
      await ensureSchema(env);
      if (path === '/wallet/login') {
        const locked = await isLocked(env, ip); if (locked) return reply(429, { ok:false, code:'locked', retryAfter:locked });
        const phone = normPhone(body.phone), password = String(body.password || '');
        const account = phone ? await env.DB.prepare('SELECT * FROM wallets WHERE phone = ?').bind(phone).first() : null;
        const hash = await staffPassword(password.length <= 128 ? password : '', account?.salt || 'unknown-wallet-salt');
        if (!account?.password_hash || !sameText(hash, account.password_hash)) { await recordFail(env, ip); return reply(401,{ok:false,code:'bad_credentials'}); }
        await clearFails(env, ip); const token=randomHex(32), expires=Date.now()+8*3600e3;
        await env.DB.batch([env.DB.prepare('DELETE FROM wallet_sessions WHERE expires <= ?').bind(Date.now()),env.DB.prepare('INSERT INTO wallet_sessions(token_hash,phone,expires) VALUES(?,?,?)').bind(await tokenHash(token),phone,expires)]);
        return reply(200,{ok:true,token,phone,balance:Math.max(0,account.balance)/100});
      }
      const account=await walletSession(env,body.token);
      if(!account) return reply(401,{ok:false,code:'session_expired'});
      if(path==='/wallet/logout'){await env.DB.prepare('DELETE FROM wallet_sessions WHERE token_hash=?').bind(await tokenHash(body.token)).run();return reply(200,{ok:true});}
      const history=(await env.DB.prepare('SELECT at, delta, kind, note FROM wallet_ledger WHERE phone = ? ORDER BY id DESC LIMIT 30').bind(account.phone).all()).results || [];
      return reply(200,{ok:true,phone:account.phone,balance:Math.max(0,account.balance)/100,history});
    }
    const locked = await isLocked(env, ip);
    if (locked) return reply(429, { ok: false, code: "locked", retryAfter: locked });

    // الدخول الموحد: رقم سري واحد، والرقم نفسه يحدد وين يروح صاحبه (إدارة، مندوب، كاشير المحل، مجهز، مدير…)
    if (path === "/enter") {
      const pin = String(body.pin == null ? "" : body.pin);
      if (/^\d{4,12}$/.test(pin)) {
        const me = await whoIs(env, pin, body);
        // كاشير المحل ما عاد له صفحة (البيع في المحل انشال من الموقع)، فرقمه ما يفتح شي
        if (me && me.role !== "cashier") {
          await clearFails(env, ip);
          return reply(200, { ok: true, go: me.role === "admin" ? "admin" : "driver", name: me.role === "admin" ? "" : me.name });
        }
        if (env.DB) {
          await ensureStaffSchema(env);
          const user = await env.DB.prepare("SELECT u.* FROM staff_pins p JOIN staff_users u ON u.id = p.user_id WHERE p.pin_hash = ? AND u.active = 1").bind(await staffPinHash(env, pin)).first();
          if (user) { await clearFails(env, ip); return reply(200, { ok: true, go: "staff", ...(await openStaffSession(env, user)) }); }
        }
      }
      await recordFail(env, ip);
      return reply(401, { ok: false, code: "bad_pin" });
    }

    // Employee sessions are checked on every request; disabling an account revokes access immediately.
    if (path === "/staff/login") {
      if (!env.DB) return reply(503, { ok: false, code: "staff_unavailable" });
      await ensureStaffSchema(env);
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const user = await env.DB.prepare("SELECT * FROM staff_users WHERE username = ?").bind(username).first();
      const validInput = password.length >= 10 && password.length <= 128;
      const hash = await staffPassword(validInput ? password : "invalid-password", user?.salt || "unknown-account-salt");
      if (!validInput || !user || !user.active || !sameText(hash, user.password_hash)) {
        await recordFail(env, ip);
        return reply(401, { ok: false, code: "bad_credentials" });
      }
      await clearFails(env, ip);
      return reply(200, { ok: true, ...(await openStaffSession(env, user)) });
    }
    if (body.session) {
      if (!env.DB || !/^[a-f0-9]{64}$/.test(String(body.session))) return reply(401, { ok: false, code: "session_expired" });
      await ensureStaffSchema(env);
      principal = await env.DB.prepare("SELECT u.* FROM staff_sessions s JOIN staff_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ? AND u.active = 1")
        .bind(await tokenHash(body.session), Date.now()).first();
      if (!principal) return reply(401, { ok: false, code: "session_expired" });
      if (path === "/staff/logout") {
        await env.DB.prepare("DELETE FROM staff_sessions WHERE token_hash = ?").bind(await tokenHash(body.session)).run();
        return reply(200, { ok: true });
      }
      body.by = "موظف #" + principal.id + " · " + principal.name;
      if (!staffMay(principal.role, path, body)) return reply(403, { ok: false, code: "forbidden" });
    }

    // صفحة المندوب: رقم المندوب (كل مندوب له رقمه) أو رقم الإدارة
    if (path.startsWith("/driver/")) {
      const me = principal ? { role: "admin", id: "admin", name: body.by || principal.name } : await whoIs(env, body.pin, body);
      if (!me || (me.role !== "driver" && me.role !== "admin")) { await recordFail(env, ip); return reply(401, { ok: false, code: "bad_pin" }); }
      await clearFails(env, ip);
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      const who = me.role === "admin" ? "admin" : "driver";
      // الإدارة لما تفتح صفحة المندوب وتوصّل بنفسها: تتصرف كمندوب اسمه «الإدارة»
      const actor = me.role === "driver" ? me : body.as === "driver" ? { role: "driver", id: "admin", name: me.name, admin: true } : null;
      const myId = actor ? actor.id : "admin";
      if (path === "/driver/login") return reply(200, { ok: true, role: who, id: me.id, name: me.name });
      if (path === "/driver/push") {
        if (!env.LOCKS) return reply(404, { ok: false, code: "no_push" });
        if (!(await saveSub(env, body.sub, "driver", me.role === "driver" ? me.id : ""))) return reply(400, { ok: false, code: "bad_sub" });
        later(pushTo(env, [body.sub], { title: "تم تفعيل إشعارات المندوب", body: "بيوصلك تنبيه مع كل طلب جديد، حتى لو الصفحة مقفلة.", url: "./#driver", tag: "test" }));
        return reply(200, { ok: true });
      }
      if (path === "/driver/orders") {
        const since = Date.now() - 3 * 864e5;
        const rs = await env.DB.prepare("SELECT no, created, updated, status, data, drv FROM orders WHERE src != 'pos' AND (created > ? OR status IN ('new','accepted','onway')) ORDER BY no DESC LIMIT 150").bind(since).all();
        const team = await staffList(env, "driver");
        const nm = staffNames(team);
        const orders = await enrichOperations(env, (rs.results || []).map((r) => ({ ...JSON.parse(r.data), no: "#" + (1000 + r.no), created: r.created, updated: r.updated, status: r.status, drv: r.drv || "", drvName: r.drv ? nm[r.drv] || "" : "" })));
        const offs = (await env.DB.prepare("SELECT id, no, line_id, to_id, state, created FROM sub_offers WHERE created > ? ORDER BY id").bind(since).all()).results || [];
        const subMap = {}; for (const o of offs) (subMap["#" + (1000 + o.no)] ||= []).push({ id: o.id, line: o.line_id, to: o.to_id, state: o.state, at: o.created });
        for (const o of orders) if (subMap[o.no]) o.subs = subMap[o.no];
        return reply(200, { ok: true, orders, mode: (await prepMode(env)) ? "ready" : "pick", now: Date.now(), me: { id: myId, name: actor ? actor.name : me.name, role: who }, team: team.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name })) });
      }
      const solo = await soleDriver(env);
      if (path === '/driver/settlement-request') {
        const did = me.role === "driver" ? me.id : (solo || "admin");
        const cash = await readCash(env, did), day = riyadhDate(), expected = Math.round(cash.balance * 100);
        if (expected < 0) return reply(409, { ok: false, code: 'negative_balance' });
        const prior = await env.DB.prepare('SELECT * FROM driver_settlements2 WHERE day=? AND drv=?').bind(day, did).first();
        if (prior?.state === 'confirmed') return reply(409, { ok: false, code: 'already_settled' });
        await env.DB.prepare("INSERT INTO driver_settlements2(day,drv,requested_at,who,expected,state,revision) VALUES(?,?,?,?,?,'pending',1) ON CONFLICT(day,drv) DO UPDATE SET requested_at=excluded.requested_at,who=excluded.who,expected=excluded.expected,revision=driver_settlements2.revision+1 WHERE driver_settlements2.state='pending'").bind(day, did, Date.now(), me.name, expected).run();
        return reply(200, { ok: true, settlement: await env.DB.prepare('SELECT * FROM driver_settlements2 WHERE day=? AND drv=?').bind(day, did).first() });
      }
      if (path === "/driver/cash") return reply(200, { ok: true, ...(await readCash(env, me.role === "driver" ? me.id : (solo || "admin"))) });
      // تطبيق الأندرويد يسأل كل ثواني: آخر رقم طلب، كم طلب جديد، كم طلب في الطريق معي أنا (خفيف: بدون قراءة الطلبات نفسها)
      if (path === "/driver/pending") {
        const a = await env.DB.prepare("SELECT COALESCE(MAX(no), 0) AS last FROM orders WHERE src != 'pos'").first();
        const b = await env.DB.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'new'").first();
        const c = me.role === "driver"
          ? await env.DB.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'onway' AND drv = ?").bind(me.id).first()
          : await env.DB.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'onway' AND (drv IS NULL OR drv = 'admin')").first();
        const last = (a && a.last) || 0;
        if (await prepMode(env)) {
          later(lateCheck(env));
          // الجاهز اللي ما مسكه أحد، أو محوّل لي أنا. readyAt يكبر مع كل طلب يصير جاهز، والتطبيق ينبّه عليه
          const mineQ = me.role === "driver" ? "(o.drv IS NULL OR o.drv = ?)" : "(o.drv IS NULL OR o.drv = 'admin')";
          const q = "SELECT COUNT(*) c, COALESCE(MAX(p.updated), 0) at, COALESCE(MAX(o.no), 0) mx FROM orders o JOIN prep_orders p ON p.no = o.no WHERE p.stage = 'ready' AND o.status IN ('new','accepted') AND " + mineQ;
          const r = me.role === "driver" ? await env.DB.prepare(q).bind(me.id).first() : await env.DB.prepare(q).first();
          return reply(200, { ok: true, mode: "ready", last: r && r.mx ? 1000 + r.mx : 0, new: (r && r.c) || 0, ready: (r && r.c) || 0, readyAt: (r && r.at) || 0, onway: (c && c.c) || 0, now: Date.now() });
        }
        return reply(200, { ok: true, last: last ? 1000 + last : 0, new: (b && b.c) || 0, onway: (c && c.c) || 0, now: Date.now() });
      }
      // تتبع المندوب: آخر نقطة بس لكل مندوب (بدون سجل تحركات)، وتنمسح لما يخلص التوصيل
      if (path === "/driver/loc") {
        if (me.role === "admin" && body.share !== true) return reply(200, { ok: true, skipped: "admin" });
        const lat = Number(body.lat), lng = Number(body.lng), acc = Math.min(5000, Math.max(0, Number(body.acc) || 0));
        if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) || (!lat && !lng)) return reply(400, { ok: false, code: "bad_loc" });
        const now = Date.now(), did = me.role === "driver" ? me.id : "admin";
        const up = await env.DB.prepare("INSERT INTO dlocs (drv, lat, lng, acc, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(drv) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, acc = excluded.acc, at = excluded.at WHERE excluded.at - dlocs.at >= 2500")
          .bind(did, lat, lng, acc, now).run();
        const near = [];
        if (up.meta && up.meta.changes) {
          const rs = did === "admin"
            ? await env.DB.prepare("SELECT no, data FROM orders WHERE status = 'onway' AND (drv IS NULL OR drv = 'admin') LIMIT 20").all()
            : await env.DB.prepare("SELECT no, data FROM orders WHERE status = 'onway' AND drv = ? LIMIT 20").bind(did).all();
          for (const r of rs.results || []) {
            const d = safeJson(r.data);
            if (d.lat == null || d.lng == null || !isFinite(d.lat) || !isFinite(d.lng)) continue;
            if (distM(lat, lng, d.lat, d.lng) > NEAR_M) continue;
            const ins = await env.DB.prepare("INSERT OR IGNORE INTO onear (no, at) VALUES (?, ?)").bind(r.no, now).run();
            if (ins.meta && ins.meta.changes) {
              near.push("#" + (1000 + r.no));
              later(notifyRole(env, "customer", String(r.no), { title: "المندوب قريب منك", body: "طلبك #" + (1000 + r.no) + " بيوصلك خلال دقايق. جهّز نفسك.", url: "./", tag: "order" + r.no }));
            }
          }
        }
        return reply(200, { ok: true, near });
      }
      if (path === "/driver/loc-off") {
        await env.DB.batch([env.DB.prepare("DELETE FROM dlocs WHERE drv = ?").bind(me.role === "driver" ? me.id : "admin"), env.DB.prepare("DELETE FROM onear WHERE at < ?").bind(Date.now() - 2 * 864e5)]);
        return reply(200, { ok: true });
      }
      if (path === "/driver/status") {
        const n = Number(String(body.no || "").replace(/\D/g, "")) - 1000;
        const st = String(body.status || "");
        if (!(n > 0) || !["new", "accepted", "onway", "delivered", "canceled"].includes(st)) return reply(400, { ok: false, code: "bad_request" });
        if(st === 'onway' || (st === 'accepted' && actor && await prepMode(env))) { const prep=await env.DB.prepare('SELECT stage FROM prep_orders WHERE no=?').bind(n).first(); if(st === 'onway' ? prep && prep.stage!=='ready' : !prep || prep.stage!=='ready')return reply(409,{ok:false,code:'not_ready'}); }
        let res;
        try { res = await changeStatus(env, n, st, Date.now(), me.name, actor); } catch (e) { return reply(e.message === "pos_required" ? 409 : 502, { ok: false, code: e.message === "pos_required" ? "pos_required" : "db" }); }
        if (!res) return reply(404, { ok: false, code: "not_found" });
        if (res.conflict) return reply(409, { ok: false, code: res.conflict, by: res.by || "", state: res.status || "" });
        if (res.changed) {
          const msg = STATUS_MSG[st];
          if (msg) later(notifyRole(env, "customer", String(n), { title: "طلبك #" + (1000 + n), body: msg, url: "./", tag: "order" + n }));
        }
        return reply(200, { ok: true, drv: res.drv || "" });
      }
      return reply(404, { ok: false, code: "not_found" });
    }

    // نقاط البيع في المحل: رقم الكاشير أو رقم الإدارة
    if (path.startsWith("/pos/")) {
      // موظفينك بجلسة: المدير بصلاحية الإدارة، وموظف الطلبات بصلاحية كاشير
      const me = principal ? { role: principal.role === "manager" ? "admin" : "cashier", id: "u" + principal.id, name: principal.name } : await whoIs(env, body.pin, body);
      if (!me || (me.role !== "cashier" && me.role !== "admin")) { await recordFail(env, ip); return reply(401, { ok: false, code: "bad_pin" }); }
      await clearFails(env, ip);
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      const cid = me.role === "admin" ? "admin" : me.id;
      if(['/pos/delivery-orders','/pos/delivery-receipt','/pos/delivery-issue'].includes(path)){
        const result=await posRoute(env,path.replace('/pos/delivery-','/admin/pos-'),body,me.name,me.role==='admin'?'owner':'cashier');
        return reply(result.status||200,result);
      }
      if (path === "/pos/login") return reply(200, { ok: true, role: me.role, id: cid, name: me.name });
      if (path === "/pos/sale") {
        const key = /^[\w-]{8,40}$/.test(String(body.cid || "")) ? String(body.cid) : null;
        const dup = async () => {
          if (!key) return null;
          const ex = await env.DB.prepare("SELECT no, data FROM orders WHERE cid = ?").bind(key).first();
          return ex ? reply(200, { ok: true, dup: true, no: "#" + (1000 + ex.no), total: safeJson(ex.data).total }) : null;
        };
        const d0 = await dup(); if (d0) return d0;   // نفس البيعة انرسلت مرتين (النت قطع وراجع)
        let data;
        try { data = await loadData(env); } catch { return reply(502, { ok: false, code: "data" }); }
        const s = posSale(data, body, me);
        if (s.error) return reply(400, { ok: false, code: s.error });
        await withCost(env, s.rec);
        // بيعة انحفظت في الجهاز والنت مقطوع: نسجلها بوقتها الحقيقي (لين ٣ أيام)
        const now = Date.now(), at = Number(body.at), when = at > now - 3 * 864e5 && at <= now + 60000 ? Math.min(at, now) : now;
        const before = await readStock(env);
        let no;
        try {
          no = await dbInsertOrder(env, s.rec, needOf(s.rec), when, true,
            { who: me.name, act: "pos_sale", info: JSON.stringify({ total: s.rec.total, count: s.rec.count, pay: s.rec.pay, open: s.open.length }) },
            { status: "sold", src: "pos", drv: cid, cid: key });
        } catch (e) {
          const d1 = await dup(); if (d1) return d1;
          return reply(502, { ok: false, code: "db" });
        }
        if (s.open.length) later(env.DB.batch(s.open.map((o) => env.DB.prepare("INSERT INTO openitems (bc, name, price, n, last) VALUES (?, ?, ?, ?, ?) ON CONFLICT(bc, name) DO UPDATE SET price = excluded.price, n = n + excluded.n, last = excluded.last").bind(o.bc, o.name, o.price, o.qty, when))));
        later(afterOrder(env, data, s.rec, no, before, true));
        return reply(200, { ok: true, no, total: s.rec.total, at: when });
      }
      // الوردية: مبيعات الكاشير من آخر إقفال للصندوق
      if (path === "/pos/shift") return reply(200, { ok: true, ...(await readShift(env, cid, me.role === "admin" && body.all === true)) });
      if (path === "/pos/close") {
        const counted = round2(Number(body.counted));
        if (!(counted >= 0 && counted < 1e7)) return reply(400, { ok: false, code: "bad_amount" });
        const sh = await readShift(env, cid, false);
        const info = { from: sh.since, to: Date.now(), sales: sh.count, total: sh.total, cash: sh.cash, card: sh.card, counted, diff: round2(counted - sh.cash), note: String(body.note || "").slice(0, 100) };
        await logStmt(env, me.name, "pos_close", cid, info).run();
        return reply(200, { ok: true, closed: info });
      }
      return reply(404, { ok: false, code: "not_found" });
    }

    const pinOk = !!principal || await checkPin(env, String(body.pin || ""));
    if (!pinOk) {
      await recordFail(env, ip);
      return reply(401, { ok: false, code: "bad_pin" });
    }
    await clearFails(env, ip);

    // Legacy owner PIN remains available; staff cannot grant themselves privileges.
    if (path === "/login") return reply(200, { ok: true, role: principal?.role || "owner" });
    if (path === '/admin/catalog') {
      const current = await readCatalog(env);
      return reply(200,{ok:true,data:current.data,version:await dataVersion(current.data)});
    }
    if (path === "/admin/staff" || path === "/admin/staff-save") {
      if (principal) return reply(403, { ok: false, code: "forbidden" });
      if (!env.DB) return reply(503, { ok: false, code: "staff_unavailable" });
      await ensureStaffSchema(env);
      if (path === "/admin/staff") {
        const rows = await env.DB.prepare("SELECT u.id, u.username, u.name, u.role, u.active, (p.user_id IS NOT NULL) AS hasPin FROM staff_users u LEFT JOIN staff_pins p ON p.user_id = u.id ORDER BY u.name").all();
        return reply(200, { ok: true, users: rows.results || [] });
      }
      const id = Number(body.id) || 0;
      const name = String(body.name || "").trim(), password = String(body.password || ""), pin = String(body.loginPin || "");
      const existing = id ? await env.DB.prepare("SELECT id, username FROM staff_users WHERE id = ?").bind(id).first() : null;
      if (id && !existing) return reply(404, { ok: false, code: "not_found" });
      // اسم المستخدم وكلمة المرور صاروا اختياريين: يكفي رقم سري للدخول الموحد
      const username = String(body.username || "").trim().toLowerCase() || (existing ? existing.username : "staff-" + randomHex(4));
      if (pin && !/^\d{4,12}$/.test(pin)) return reply(400, { ok: false, code: "bad_pin_format" });
      if (!/^[a-z0-9._-]{3,32}$/.test(username) || !name || name.length > 30 || !["manager", "orders", "preparer", "cashier"].includes(body.role) ||
          (password && (password.length < 10 || password.length > 128)) || (!id && !password && !pin)) {
        return reply(400, { ok: false, code: "bad_staff" });
      }
      if (pin && await pinTaken(env, pin, { user: id })) return reply(409, { ok: false, code: "pin_taken" });
      const duplicate = await env.DB.prepare("SELECT id FROM staff_users WHERE username = ? AND id != ?").bind(username, id).first();
      if (duplicate) return reply(409, { ok: false, code: "username_taken" });
      const active = body.active === false ? 0 : 1;
      if (id) {
        const statements = [env.DB.prepare("UPDATE staff_users SET username = ?, name = ?, role = ?, active = ? WHERE id = ?").bind(username, name, body.role, active, id),
          env.DB.prepare("DELETE FROM staff_sessions WHERE user_id = ?").bind(id)];
        if (password) {
          const salt = randomHex(16);
          statements.push(env.DB.prepare("UPDATE staff_users SET password_hash = ?, salt = ? WHERE id = ?").bind(await staffPassword(password, salt), salt, id));
        }
        if (pin) statements.push(env.DB.prepare("INSERT INTO staff_pins (user_id, pin_hash) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET pin_hash = excluded.pin_hash").bind(id, await staffPinHash(env, pin)));
        await env.DB.batch(statements);
      } else {
        const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM staff_users").first();
        if (count.n >= 100) return reply(400, { ok: false, code: "staff_limit" });
        const salt = randomHex(16);
        // بدون كلمة مرور: نحط كلمة عشوائية ما أحد يعرفها، والدخول يكون بالرقم السري بس
        const r = await env.DB.prepare("INSERT INTO staff_users (username, name, role, active, password_hash, salt) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(username, name, body.role, active, await staffPassword(password || randomHex(24), salt), salt).run();
        if (pin) await env.DB.prepare("INSERT INTO staff_pins (user_id, pin_hash) VALUES (?, ?)").bind(r.meta.last_row_id, await staffPinHash(env, pin)).run();
      }
      await ensureSchema(env);
      await logStmt(env, "صاحب المتجر", "staff_account", username, { role: body.role, active: !!active, reset: !!password, pin: !!pin }).run();
      return reply(200, { ok: true });
    }
    // التكاليف التشغيلية والمصروفات (سرية: تنحفظ بالقاعدة مو بملف المتجر العام)
    if (path === "/admin/opex" || path === "/admin/opex-save") {
      if (principal) return reply(403, { ok: false, code: "forbidden" });
      if (!env.DB) return reply(503, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      if (path === "/admin/opex-save") {
        const o = cleanOpex(body.opex);
        if (!o) return reply(400, { ok: false, code: "bad_opex" });
        o.confirmed = body.confirm === true && opexMissing(o).length === 0;
        await env.DB.batch([env.DB.prepare("INSERT INTO opex (id, data, updated) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated").bind(JSON.stringify(o), Date.now()),
          logStmt(env, staff(body), "opex", "", { confirmed: o.confirmed, fixed: opexFixed(o) })]);
        return reply(200, { ok: true, opex: o, missing: opexMissing(o) });
      }
      const o = await readOpex(env);
      return reply(200, { ok: true, opex: o, missing: opexMissing(o), fields: OPEX_FIELDS });
    }
    // مفتاح إشعارات آبل (APNs .p8) يرفعه صاحب المتجر من الإدارة: ينحفظ في KV ولا يرجع للواجهة أبداً
    if (path === "/admin/apns-key") {
      if (principal) return reply(403, { ok: false, code: "forbidden" });
      if (!env.LOCKS) return reply(503, { ok: false, code: "config", missing: "LOCKS" });
      if (body.key) {
        const pem = String(body.key).trim();
        if (pem.length > 4000 || !/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(pem)) return reply(400, { ok: false, code: "bad_key" });
        try { await crypto.subtle.importKey("pkcs8", pemDer(pem), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]); } catch { return reply(400, { ok: false, code: "bad_key" }); }
        const kid = String(body.keyId || "").trim().toUpperCase();
        if (kid && !/^[A-Z0-9]{10}$/.test(kid)) return reply(400, { ok: false, code: "bad_key_id" });
        await env.LOCKS.put("apns_key", pem);
        if (kid) await env.LOCKS.put("apns_kid", kid);
        apnsJwt = null;
        if (env.DB) { await ensureSchema(env); await logStmt(env, staff(body), "apns_key", "", { keyId: kid || null }).run(); }
      }
      const c = await apnsCreds(env);
      return reply(200, { ok: true, ready: !!(c.pem && c.kid && c.team), hasKey: !!c.pem, keyId: c.kid || "", team: !!c.team });
    }
    if (path === "/admin/offers-advice") {
      if (principal) return reply(403, { ok: false, code: "forbidden" });
      if (!env.DB) return reply(503, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      const o = await readOpex(env), missing = opexMissing(o);
      if (missing.length || !o.confirmed) return reply(200, { ok: true, ready: false, missing, confirmed: !!o.confirmed });
      let data;
      try { data = await loadData(env); } catch { return reply(502, { ok: false, code: "data" }); }
      const adv = await offersAdvice(env, data, o);
      if (adv.error) return reply(200, { ok: true, ready: false, error: adv.error });
      return reply(200, { ok: true, ready: true, ...adv });
    }
    if (path === "/admin/alerts") {
      if (!env.DB) return reply(503, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      const now = Date.now();
      const rs = await env.DB.prepare(`SELECT o.no, o.created, o.updated, o.status, o.data,
        (SELECT MAX(a.at) FROM alog a WHERE a.act = 'status' AND a.ref = '#' || (1000 + o.no) AND json_extract(a.info, '$.to') = o.status) AS stage_started
        FROM orders o WHERE o.status IN ('new', 'accepted', 'onway') ORDER BY o.created`).all();
      const orders = (rs.results || []).map(r => ({ ...safeJson(r.data), no: "#" + (1000 + r.no), created: r.created, updated: r.updated, stageStarted: r.stage_started ?? (r.status === "new" ? r.created : r.updated), status: r.status }))
        .map(o => ({ ...o, ...orderDelay(o, now) })).filter(o => o.late);
      return reply(200, { ok: true, orders, now, thresholds: { new: 10, accepted: 30, onway: 45 } });
    }

    if (['/admin/pos-orders','/admin/pos-receipt','/admin/pos-issue','/admin/pos-settings', '/admin/settlement-requests', '/admin/settlement-confirm', '/admin/payment', '/admin/day-close', '/admin/day-report', '/admin/prep', '/admin/prep-save', '/admin/prep-sub', '/admin/prep-mode', '/admin/wallet', '/admin/wallet-credit', '/admin/wallet-account', '/admin/cashback'].includes(path)) {
      if (!env.DB) return reply(503, { ok: false, code: 'config', missing: 'DB' });
      await ensureSchema(env);
      const result = await operationsRoute(env, path, body, principal ? staff(body) : staff(body), principal?.role || 'owner', later);
      return reply(result.status || 200, result);
    }
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
        const who = staff(body), note = String(body.note || "").slice(0, 100), dv = String(body.drv || "d0").slice(0, 40);
        await env.DB.batch([env.DB.prepare("INSERT INTO cash (at, day, who, amount, note, drv) VALUES (?, ?, ?, ?, ?, ?)").bind(Date.now(), riyadhDate(), who, amt, note, dv),
          logStmt(env, who, "cash_in", dv, { amount: amt, note, drv: await staffName(env, dv) })]);
      }
      return reply(200, { ok: true, ...(await readCash(env)) });
    }
    // زبائن ما رجعوا: قائمة للمراسلة بالواتساب، ومتابعة مين رجع بعد الرسالة
    if (path === "/admin/winback") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      const days = Math.min(365, Math.max(7, Math.floor(Number(body.days) || 30)));
      const kind = ["once", "loyal", "all"].includes(body.kind) ? body.kind : "once";
      const cut = Date.now() - days * 864e5;
      const rs = await env.DB.prepare(`SELECT a.ch, a.n, a.rev, a.last, a.first, o.phone, json_extract(o.data, '$.name') name, w.at cat, w.who cwho, w.n cn
        FROM (SELECT ch, COUNT(*) n, ROUND(SUM(total), 2) rev, MAX(created) last, MIN(created) first, MAX(CASE WHEN phone != '' THEN no END) pno FROM orders WHERE status != 'canceled' AND ch != '' GROUP BY ch) a
        LEFT JOIN orders o ON o.no = a.pno LEFT JOIN winback w ON w.ch = a.ch
        WHERE a.last < ? AND (? = 'all' OR (? = 'once' AND a.n = 1) OR (? = 'loyal' AND a.n >= 2))
        ORDER BY a.rev DESC LIMIT 400`).bind(cut, kind, kind, kind).all();
      const all = rs.results || [], list = all.filter((r) => r.phone);
      const st = await env.DB.prepare(`SELECT COUNT(*) contacted,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM orders o WHERE o.ch = w.ch AND o.created > w.at AND o.status != 'canceled') THEN 1 ELSE 0 END) back,
        ROUND(IFNULL(SUM((SELECT IFNULL(SUM(total), 0) FROM orders o WHERE o.ch = w.ch AND o.created > w.at AND o.status != 'canceled')), 0), 2) rev
        FROM winback w WHERE w.at > ?`).bind(Date.now() - 120 * 864e5).first();
      return reply(200, { ok: true, days, kind, list: list.slice(0, 300), noPhone: all.length - list.length, stats: st || {} });
    }
    if (path === "/admin/winback-mark") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      const ch = String(body.ch || "");
      if (!/^[0-9a-f]{32}$/.test(ch)) return reply(400, { ok: false, code: "bad_request" });
      const who = staff(body);
      await env.DB.batch([env.DB.prepare("INSERT INTO winback (ch, at, who, n) VALUES (?, ?, ?, 1) ON CONFLICT(ch) DO UPDATE SET at = excluded.at, who = excluded.who, n = n + 1").bind(ch, Date.now(), who),
        logStmt(env, who, "winback", "", { tail: String(body.tail || "").slice(-4) })]);
      return reply(200, { ok: true });
    }
    if (path === "/admin/report-test") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      return reply(200, { ok: true, report: await dailyReport(env) });
    }
    // المناديب والكاشيرية (كل واحد له اسم ورقم سري سريع)
    if (path === "/admin/team" || path === "/admin/team-save") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      if (path === "/admin/team-save") {
        const id0 = String(body.id || ""), role = body.role === "cashier" ? "cashier" : "driver";
        const name = String(body.name || "").trim().slice(0, 30), pin = String(body.newPin || "");
        const cur = id0 ? await env.DB.prepare("SELECT * FROM staff WHERE id = ?").bind(id0).first() : null;
        if (id0 && !cur) return reply(404, { ok: false, code: "not_found" });
        if (!name) return reply(400, { ok: false, code: "bad_name" });
        if (pin && !/^\d{4,12}$/.test(pin)) return reply(400, { ok: false, code: "bad_pin_format" });
        if (!cur && !pin) return reply(400, { ok: false, code: "pin_required" });
        let h = cur ? cur.pin : "";
        if (pin) {
          if (await pinTaken(env, pin, { staff: id0 })) return reply(400, { ok: false, code: "pin_taken" });
          h = await staffHash(env, pin);
        }
        const active = body.active === false ? 0 : 1, who = staff(body);
        const id = cur ? cur.id : (role === "cashier" ? "c" : "d") + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        await env.DB.batch([
          env.DB.prepare("INSERT INTO staff (id, name, role, pin, active, created) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, pin = excluded.pin, active = excluded.active")
            .bind(id, name, cur ? cur.role : role, h, active, cur ? cur.created : Date.now()),
          logStmt(env, who, cur ? "staff_edit" : "staff_add", id, { name, role: cur ? cur.role : role, pin: !!pin, active: !!active }),
        ]);
        if (id === "d0" && pin && env.LOCKS) await env.LOCKS.put("driver_pin", h);
      }
      const list = await staffList(env, "");
      const day = riyadhDate();
      const rs = await env.DB.prepare("SELECT drv, status, COUNT(*) n, ROUND(SUM(total), 2) t FROM orders WHERE drv IS NOT NULL AND ((day = ? AND status IN ('delivered', 'sold')) OR status IN ('accepted', 'onway')) GROUP BY drv, status").bind(day).all();
      const st = {};
      for (const r of rs.results || []) { const x = st[r.drv] || (st[r.drv] = { done: 0, total: 0, open: 0 }); if (r.status === "accepted" || r.status === "onway") x.open += r.n; else { x.done += r.n; x.total = round2(x.total + r.t); } }
      return reply(200, { ok: true, staff: list.map((s) => ({ ...s, today: st[s.id] || { done: 0, total: 0, open: 0 } })) });
    }
    // الإدارة تعطي الطلب لمندوب (أو ترجّعه للكل)
    if (path === "/admin/assign") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      const n = Number(String(body.no || "").replace(/\D/g, "")) - 1000, to = String(body.drv || "");
      if (!(n > 0)) return reply(400, { ok: false, code: "bad_request" });
      const d = to ? await env.DB.prepare("SELECT id, name FROM staff WHERE id = ? AND role = 'driver' AND active = 1").bind(to).first() : null;
      if (to && !d) return reply(400, { ok: false, code: "bad_driver" });
      const row = await env.DB.prepare("SELECT status, drv FROM orders WHERE no = ?").bind(n).first();
      if (!row) return reply(404, { ok: false, code: "not_found" });
      if (!["new", "accepted", "onway"].includes(row.status)) return reply(400, { ok: false, code: "closed" });
      const who = staff(body), now = Date.now();
      const status = to ? (row.status === "new" ? "accepted" : row.status) : (row.status === "accepted" ? "new" : row.status);
      await env.DB.batch([
        env.DB.prepare("UPDATE orders SET drv = ?, status = ?, updated = ? WHERE no = ?").bind(to || null, status, now, n),
        logStmt(env, who, "assign", "#" + (1000 + n), { from: await staffName(env, row.drv), to: d ? d.name : "", status }),
      ]);
      if (d) later(notifyRole(env, "driver", d.id, { title: "طلب لك #" + (1000 + n), body: (await prepMode(env)) ? "الإدارة حوّلت لك هالطلب. بيوصلك تنبيه أول ما يصير جاهز." : "الإدارة حوّلت لك هالطلب. افتح التطبيق وابدأ التجهيز.", url: "./#driver", tag: "assign" + n }));
      return reply(200, { ok: true, state: status, drv: to });
    }
    // أصناف انباعت في المحل وهي مو مسجلة في المتجر (باركود جديد)
    if (path === "/admin/openitems") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      if (body.del) await env.DB.prepare("DELETE FROM openitems WHERE bc = ? AND name = ?").bind(String(body.del.bc || ""), String(body.del.name || "")).run();
      const rs = await env.DB.prepare("SELECT bc, name, price, n, last FROM openitems ORDER BY last DESC LIMIT 200").all();
      return reply(200, { ok: true, items: rs.results || [] });
    }
    if (path === "/admin/driver-loc") {
      if (!env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      await ensureSchema(env);
      const now = Date.now(), nm = staffNames(await staffList(env, "driver"));
      const lr = await env.DB.prepare("SELECT drv, lat, lng, acc, at FROM dlocs WHERE at > ? ORDER BY at DESC").bind(now - LOC_FRESH_MS).all();
      const locs = (lr.results || []).map((l) => ({ ...l, name: nm[l.drv] || l.drv }));
      const rs = await env.DB.prepare("SELECT no, data, drv FROM orders WHERE status = 'onway' ORDER BY no LIMIT 30").all();
      const onway = (rs.results || []).map((r) => { const d = safeJson(r.data); return { no: "#" + (1000 + r.no), name: d.name || "", lat: d.lat, lng: d.lng, total: d.total, drv: r.drv || "", drvName: r.drv ? nm[r.drv] || "" : "" }; });
      return reply(200, { ok: true, locs, loc: locs[0] || null, onway, now });
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
      const srcQ = body.src === "pos" ? " AND src = 'pos'" : body.src === "online" ? " AND src != 'pos'" : "";
      const rs = await env.DB.prepare("SELECT no, created, updated, status, data, anon, drv, src FROM orders WHERE no < ? AND created >= ?" + srcQ + " ORDER BY no DESC LIMIT ?").bind(before, since, lim).all();
      const nm = staffNames(await staffList(env, ""));
      const orders = await enrichOperations(env, (rs.results || []).map((r) => ({ ...JSON.parse(r.data), no: "#" + (1000 + r.no), created: r.created, updated: r.updated, status: r.status, anon: !!r.anon, drv: r.drv || "", drvName: r.drv ? nm[r.drv] || "" : "", src: r.src || "web" })));
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
      const prepRole = principal && principal.role === "preparer";
      if (!(await saveSub(env, body.sub, prepRole ? "prep" : "admin", ""))) return reply(400, { ok: false, code: "bad_sub" });
      later(pushTo(env, [body.sub], prepRole ? { title: "تم تفعيل إشعارات التجهيز", body: "بيوصلك تنبيه مع كل طلب جديد يحتاج تجهيز.", url: "./", tag: "test" } : { title: "تم تفعيل إشعارات الإدارة", body: "بيوصلك تنبيه مع كل طلب جديد، ولما منتج يقرب يخلص أو يخلص.", url: "./", tag: "test" }));
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
      let driverSet = !!((env.LOCKS && (await env.LOCKS.get("driver_pin"))) || env.DRIVER_PIN);
      if (!driverSet && env.DB) { await ensureSchema(env); driverSet = !!(await env.DB.prepare("SELECT 1 x FROM staff WHERE role = 'driver' AND active = 1 LIMIT 1").first()); }
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
        if (await pinTaken(env, dp, { staff: "d0" })) return reply(400, { ok: false, code: "driver_pin_same" });
      }
      if (body.newPin && await pinTaken(env, String(body.newPin), { owner: true })) return reply(400, { ok: false, code: "pin_taken" });
      if (data.store) delete data.store.pinHash; // الرقم السري ما ينحفظ في الموقع العام
      const stockSet = body.stock && typeof body.stock === "object" ? body.stock : null;
      const costSet = body.costs && typeof body.costs === "object" ? body.costs : null;
      if ((stockSet || costSet) && !env.DB) return reply(500, { ok: false, code: "config", missing: "DB" });
      let oldData = null; try { oldData = await loadData(env); } catch {}
      const oldStock = env.DB && stockSet ? await readStock(env).catch(() => ({})) : {};
      try {
        await saveToGitHub(env, "data.json", JSON.stringify(data), "تحديث المتجر من صفحة الإدارة", body.baseVersion);
      } catch (e) {
        return reply(e.code === "data_conflict" ? 409 : 502, { ok: false, code: e.code || "github", status: e.status || 0 });
      }
      if (body.newPin) await env.LOCKS.put("pin", await hashPin(env, String(body.newPin)));
      if (body.newDriverPin) {
        const h = await staffHash(env, String(body.newDriverPin));
        await env.LOCKS.put("driver_pin", h);
        if (env.DB) await env.DB.prepare("INSERT INTO staff (id, name, role, pin, active, created) VALUES ('d0', 'المندوب', 'driver', ?, 1, ?) ON CONFLICT(id) DO UPDATE SET pin = excluded.pin, active = 1").bind(h, Date.now()).run();
      }
      if (stockSet) { try { await setStock(env, stockSet); } catch { return reply(502, { ok: false, code: "stock" }); } }
      if (costSet) { try { await setCosts(env, costSet); } catch { return reply(502, { ok: false, code: "stock" }); } }
      if (env.DB) await logSave(env, staff(body), oldData, data, stockSet, oldStock, costSet, body).catch(() => {});
      dataCache = { at: 0, data: null };
      return reply(200, { ok: true, version: await dataVersion(data), stock: stockSet ? await readStock(env) : undefined });
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
    "CREATE TABLE IF NOT EXISTS sub_offers (id INTEGER PRIMARY KEY AUTOINCREMENT, no INTEGER NOT NULL, line_id TEXT NOT NULL, to_id TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','accepted','rejected','withdrawn')), created INTEGER NOT NULL, answered INTEGER, who TEXT NOT NULL DEFAULT '')",
    "CREATE INDEX IF NOT EXISTS sub_offers_no ON sub_offers (no, state)",
    "CREATE TABLE IF NOT EXISTS opex (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL, updated INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS winback (ch TEXT PRIMARY KEY, at INTEGER NOT NULL, who TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 1)",
    "CREATE TABLE IF NOT EXISTS alog (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, who TEXT NOT NULL, act TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', info TEXT NOT NULL DEFAULT '{}')",
    "CREATE INDEX IF NOT EXISTS alog_order_status ON alog(ref, act, at)",
    "CREATE TABLE IF NOT EXISTS cash (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, day TEXT NOT NULL, who TEXT NOT NULL, amount REAL NOT NULL, note TEXT NOT NULL DEFAULT '')",
    "CREATE TABLE IF NOT EXISTS st_item (day TEXT NOT NULL, id TEXT NOT NULL, qty INTEGER NOT NULL, revenue REAL NOT NULL, orders INTEGER NOT NULL, PRIMARY KEY (day, id))",
    "CREATE TABLE IF NOT EXISTS st_pair (a TEXT NOT NULL, b TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (a, b))",
  ].map((q) => env.DB.prepare(q)));
  // أعمدة إضافية للتحليل (تنضاف مرة وحدة للقاعدة القديمة بدون ما تمس بياناتها)
  const have = ((await env.DB.prepare("PRAGMA table_info(st_day)").all()).results || []).map((r) => r.name);
  const add = ["items", "card", "fees", "canceled", "newc", "deliv_ms", "deliv_n", "deliv_rev", "visits", "carts", "checkouts", "cost", "pos_n", "pos_rev"].filter((c) => !have.includes(c));
  if (add.length) await env.DB.batch(add.map((c) => env.DB.prepare(`ALTER TABLE st_day ADD COLUMN ${c} REAL NOT NULL DEFAULT 0`)));
  // سجل الطلبات هو المرجع: أعمدة للأرقام + جدول لسطور كل طلب
  const oh = ((await env.DB.prepare("PRAGMA table_info(orders)").all()).results || []).map((r) => r.name);
  const ocols = { cost: "REAL NOT NULL DEFAULT 0", day: "TEXT", hour: "INTEGER", total: "REAL", fee: "REAL", items: "INTEGER", pay: "TEXT", ch: "TEXT", tail: "TEXT", dms: "INTEGER NOT NULL DEFAULT 0", anon: "INTEGER NOT NULL DEFAULT 0", drv: "TEXT", src: "TEXT NOT NULL DEFAULT 'web'", cid: "TEXT" };
  const oadd = Object.keys(ocols).filter((c) => !oh.includes(c));
  const more = oadd.map((c) => `ALTER TABLE orders ADD COLUMN ${c} ${ocols[c]}`).concat([
    "CREATE TABLE IF NOT EXISTS oline (no INTEGER NOT NULL, k INTEGER NOT NULL, id TEXT NOT NULL, qty INTEGER NOT NULL, price REAL NOT NULL, PRIMARY KEY (no, k))",
    "CREATE TABLE IF NOT EXISTS oline (no INTEGER NOT NULL, k INTEGER NOT NULL, id TEXT NOT NULL, qty INTEGER NOT NULL, price REAL NOT NULL, PRIMARY KEY (no, k))",
    "CREATE INDEX IF NOT EXISTS orders_day ON orders (day)",
    "CREATE TABLE IF NOT EXISTS dloc (id INTEGER PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL, acc REAL NOT NULL DEFAULT 0, at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS onear (no INTEGER PRIMARY KEY, at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS orders_ch ON orders (ch)",
    "CREATE INDEX IF NOT EXISTS oline_id ON oline (id)",
    "CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, pin TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS staff_pin ON staff (pin)",
    "CREATE TABLE IF NOT EXISTS dlocs (drv TEXT PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL, acc REAL NOT NULL DEFAULT 0, at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS openitems (bc TEXT NOT NULL, name TEXT NOT NULL, price REAL NOT NULL, n INTEGER NOT NULL, last INTEGER NOT NULL, PRIMARY KEY (bc, name))",
  ].concat(oadd.includes("src") ? ["UPDATE orders SET src = json_extract(data, '$.source') WHERE json_extract(data, '$.source') IN ('phone', 'whatsapp', 'store')"] : [])
   .concat(oadd.includes("drv") ? ["UPDATE orders SET drv = 'd0' WHERE status IN ('accepted', 'onway', 'delivered')"] : []));
  await env.DB.batch(more.map((q) => env.DB.prepare(q)));
  // سعر الشراء في سطور الطلب وتحليل المنتجات
  const extra = [];
  for (const [t, c] of [["oline", "cost"], ["st_item", "cost"]]) {
    const cols = ((await env.DB.prepare(`PRAGMA table_info(${t})`).all()).results || []).map((r) => r.name);
    if (!cols.includes(c)) extra.push(env.DB.prepare(`ALTER TABLE ${t} ADD COLUMN ${c} REAL NOT NULL DEFAULT 0`));
  }
  extra.push(env.DB.prepare("CREATE INDEX IF NOT EXISTS orders_upd ON orders (status, updated)"));
  extra.push(env.DB.prepare("CREATE INDEX IF NOT EXISTS orders_src ON orders (src, created)"));
  extra.push(env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS orders_cid ON orders (cid) WHERE cid IS NOT NULL"));
  const ccols = ((await env.DB.prepare("PRAGMA table_info(cash)").all()).results || []).map((r) => r.name);
  if (!ccols.includes("drv")) extra.push(env.DB.prepare("ALTER TABLE cash ADD COLUMN drv TEXT NOT NULL DEFAULT 'd0'"));
  // حساب كاش المندوب يبدأ من يوم تركيب هالميزة (الطلبات القديمة ما تنحسب عليه)
  const now0 = Date.now();
  extra.push(env.DB.prepare("INSERT INTO cash (at, day, who, amount, note) SELECT ?, ?, 'النظام', 0, 'بداية الحساب' WHERE NOT EXISTS (SELECT 1 FROM cash)").bind(now0, riyadhDateAt(now0)));
  await env.DB.batch(extra);
  // رقم المندوب القديم يصير أول حساب مندوب (نفس الرقم يشتغل بدون تغيير)
  const anyStaff = await env.DB.prepare("SELECT COUNT(*) n FROM staff").first();
  if (!anyStaff || !anyStaff.n) {
    const old = (env.LOCKS ? await env.LOCKS.get("driver_pin") : null) || (env.DRIVER_PIN ? await staffHash(env, String(env.DRIVER_PIN)) : "");
    if (old) await env.DB.prepare("INSERT OR IGNORE INTO staff (id, name, role, pin, active, created) VALUES ('d0', 'المندوب', 'driver', ?, 1, ?)").bind(old, Date.now()).run();
  }
  await ensureOperations(env);
  // التسوية صارت لكل مندوب: جدول جديد (يوم + مندوب)، والتسويات القديمة تنتقل للمندوب الحالي كما هي
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS driver_settlements2(day TEXT NOT NULL,drv TEXT NOT NULL,requested_at INTEGER NOT NULL,who TEXT NOT NULL,expected INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','confirmed')),revision INTEGER NOT NULL,actual INTEGER,confirmed_at INTEGER,confirmed_by TEXT,note TEXT,PRIMARY KEY(day,drv))"),
    env.DB.prepare("INSERT OR IGNORE INTO driver_settlements2(day,drv,requested_at,who,expected,state,revision,actual,confirmed_at,confirmed_by,note) SELECT day,'d0',requested_at,who,expected,state,revision,actual,confirmed_at,confirmed_by,note FROM driver_settlements WHERE NOT EXISTS (SELECT 1 FROM driver_settlements2)"),
  ]);
  schemaReady = true;
}
function orderRecord(o, body) {
  return {
    lines: o.lines.map((l) => ({ id: l.p.id, name: l.p.name, unit: l.p.unit, qty: l.qty, price: l.price, regularPrice: Math.max(Number(l.price), Number(l.p.price)||0, Number(l.p.old)||0), tag: l.tag || "", ...(l.p.per ? { per: l.p.per } : {}) })),
    subtotal: o.subtotal, fee: o.fee, total: o.total, count: o.count, phone: o.phone,
    name: String(body.name || "").slice(0, 60), details: String(body.details || "").slice(0, 200), note: String(body.note || "").slice(0, 300),
    pay: body.pay === "card" ? "card" : "cash", lat: Number(body.lat), lng: Number(body.lng), map: mapsUrl(body.lat, body.lng),
    st: 1, // انحسب في التحليل
    sub: ["swap", "remove", "call"].includes(body.sub) ? body.sub : "call", // لو منتج ناقص: بدّله، شيله، أو اتصلوا
  };
}
// يحفظ الطلب وسطوره والمخزون والتحليل في خطوة وحدة (يا كلها تنحفظ، يا ولا شي)
async function dbInsertOrder(env, rec, need, now, force, log, opt = {}) {
  const P = (q, ...a) => env.DB.prepare(q).bind(...a);
  const day = riyadhDateAt(now), hour = riyadhHour(now);
  const ch = rec.phone ? (await hashPin(env, "cust:" + rec.phone)).slice(0, 32) : "";
  const items = (rec.lines || []).reduce((n, l) => n + Number(l.qty || 0), 0);
  const NO = "(SELECT MAX(no) FROM orders)";
  const src = opt.src || (["phone", "whatsapp", "store"].includes(rec.source) ? rec.source : "web");
  const st = [P("INSERT INTO orders (created, updated, status, phone, data, day, hour, total, fee, items, pay, ch, tail, cost, src, drv, cid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    now, now, opt.status || "new", rec.phone || "", JSON.stringify(rec), day, hour, Number(rec.total), Number(rec.fee || 0), items, rec.pay, ch, String(rec.phone || "").slice(-4), costOf(rec), src, opt.drv || null, opt.cid || null)];
  (rec.lines || []).forEach((l, k) => st.push(P(`INSERT INTO oline (no, k, id, qty, price, cost) VALUES (${NO}, ?, ?, ?, ?, ?)`, k, l.id || "", Number(l.qty), Number(l.price), Number(l.cost || 0))));
  if (log) st.push(env.DB.prepare(`INSERT INTO alog (at, who, act, ref, info) VALUES (?, ?, ?, '#' || (1000 + ${NO}), ?)`).bind(now, log.who, log.act, log.info));
  // المخزون: لو ما يكفي، هالسطر يوقف كل الحفظ (الطلب ما ينحفظ)
  for (const id of Object.keys(need)) {
    if (force) { st.push(P("UPDATE stock SET qty = MAX(qty - ?, 0) WHERE id = ?", need[id], id)); continue; }
    st.push(P("SELECT CASE WHEN qty < ? THEN json('stock') ELSE 1 END x FROM stock WHERE id = ?", need[id], id));
    st.push(P("UPDATE stock SET qty = qty - ? WHERE id = ?", need[id], id));
  }
  if (opt.checkout) st.push(P(`INSERT INTO checkout_keys(request_id,no,fingerprint) VALUES(?,${NO},?)`,opt.checkout.id,opt.checkout.fingerprint));
  if (rec.walletCents) {
    st.push(P(`INSERT INTO wallet_order_keys(request_id,no) VALUES(?,${NO})`,rec.walletRequestId));
    st.push(...walletMove(env, rec.phone, -rec.walletCents, 'payment', null, 'العميل', 'دفع طلب', 'checkout_'+rec.walletRequestId));
    st.push(P(`UPDATE wallet_ledger SET no=${NO} WHERE request_id=?`,'checkout_'+rec.walletRequestId));
    const cash=rec.pay==='cash' ? moneyCents(rec.total)-rec.walletCents : 0, card=rec.pay==='card' ? moneyCents(rec.total)-rec.walletCents : 0;
    st.push(P(`INSERT INTO payment_splits(no,cash,card,wallet,revision,at,who) VALUES(${NO},?,?,?,?,?,?)`,cash,card,rec.walletCents,1,now,'العميل'));
  }
  st.push(...statsStmts(env, rec, day, hour, 1, 0));
  await env.DB.batch(st);
  const row = opt.checkout ? await env.DB.prepare('SELECT no FROM checkout_keys WHERE request_id = ?').bind(opt.checkout.id).first()
    : opt.cid ? await env.DB.prepare("SELECT no FROM orders WHERE cid = ?").bind(opt.cid).first()
    : await env.DB.prepare("SELECT MAX(no) no FROM orders WHERE created = ? AND ch = ?").bind(now, ch).first();
  return "#" + (1000 + row.no);
}
// تفاصيل الزبون (الجوال والعنوان) تنمسح بعد المدة، والطلب نفسه وأرقامه تبقى دايم
async function cleanupOld(env, keepDays) {
  const keep = Math.min(730, Math.max(7, Math.floor(Number(keepDays) || 90)));
  await env.DB.prepare("UPDATE orders SET phone = '', anon = 1, data = json_set(json_remove(data, '$.name', '$.details', '$.note', '$.lat', '$.lng', '$.map'), '$.phone', '') WHERE anon = 0 AND created < ? AND status IN ('delivered','canceled')")
    .bind(Date.now() - keep * 864e5).run();
}
async function changeStatus(env, n, st, now = Date.now(), who = "", actor = null) {
  await ensureSchema(env);
  const old = await env.DB.prepare("SELECT status, data, created, day, hour, total, dms, drv FROM orders WHERE no = ?").bind(n).first();
  if (!old) return null;
  let drv = old.drv || null;
  if (actor) {
    if (drv && drv !== actor.id) return { conflict: "not_yours", by: await staffName(env, drv), status: old.status };
    drv = st === "new" ? null : actor.id;
  }
  const P = (q, ...a) => env.DB.prepare(q).bind(...a);
  // لو أحد غيّر الطلب بعد ما قريناه (مندوب ثاني مسكه بنفس اللحظة): كل الخطوة تنلغي
  const guard = P("SELECT CASE WHEN (SELECT status FROM orders WHERE no = ?) = ? AND IFNULL((SELECT drv FROM orders WHERE no = ?), '') = ? THEN 1 ELSE json('conflict') END", n, old.status, n, old.drv || "");
  const lost = async () => {
    const cur = await env.DB.prepare("SELECT status, drv FROM orders WHERE no = ?").bind(n).first();
    return { conflict: "taken", by: await staffName(env, cur && cur.drv), status: cur ? cur.status : "" };
  };
  if (old.status === st) {
    if ((old.drv || null) === drv) return { changed: false, drv };
    try { await env.DB.batch([guard, P("UPDATE orders SET drv = ?, updated = ? WHERE no = ?", drv, now, n), logStmt(env, who, "claim", "#" + (1000 + n), { status: st })]); }
    catch (e) { return lost(); }
    return { changed: false, drv };
  }
  let rec = {}; try { rec = JSON.parse(old.data); } catch {}
  const day = old.day || riyadhDateAt(old.created), hour = old.hour ?? riyadhHour(old.created), counted = !!rec.st;
  const dms = st === "delivered" ? Math.max(0, now - old.created) : 0;
  if(st==='onway'){
    const policy=await env.DB.prepare('SELECT require_receipt FROM pos_settings WHERE id=1').first();
    if(policy?.require_receipt){const receipt=await latestPosReceipt(env,n);if(!receipt||receipt.fingerprint!==await tokenHash(JSON.stringify(posDocument(old.data,n))))throw new Error('pos_required');}
  }
  const finance = await statusFinance(env,n,old.status,st,rec,who,now);
  const handoff = st === 'onway' ? [P("SELECT CASE WHEN EXISTS(SELECT 1 FROM prep_orders WHERE no=? AND stage!='ready') THEN json('not_ready') ELSE 1 END",n)] : [];
  const stmts = [guard, ...handoff, P("SELECT CASE WHEN status != ? OR data != ? THEN json('concurrent_status') ELSE 1 END FROM orders WHERE no = ?",old.status,old.data,n), ...finance, P("UPDATE orders SET status = ?, updated = ?, dms = ?, drv = ? WHERE no = ?", st, now, dms, drv, n)];
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
  try { await env.DB.batch(stmts); }
  catch (e) {
    const cur = await env.DB.prepare("SELECT status, drv FROM orders WHERE no = ?").bind(n).first();
    if (cur && (cur.status !== old.status || (cur.drv || "") !== (old.drv || ""))) return lost();
    throw e;
  }
  return { changed: true, drv };
}
// تعديل الطلب بعد اتصال الزبون: المبالغ والمخزون والتحليل تتعدل مع بعض
// منتج ناقص وقت التجهيز (المجهز أو الإدارة): يقترح بديل والزبون يوافق من صفحة طلبه
// (لو اختار الزبون «بدّلوه بمشابه» ينبدل مباشرة)، أو يشيله من الطلب، أو يسحب الاقتراح. الأسعار من المتجر، مو من الجوال
async function prepSub(env, body, who, later) {
  const n = Number(String(body.no || "").replace(/\D/g, "")) - 1000, op = String(body.op || "");
  if (!["propose", "withdraw", "remove"].includes(op)) return { code: "bad_request", status: 400 };
  const row = n > 0 ? await env.DB.prepare("SELECT status, data FROM orders WHERE no = ?").bind(n).first() : null;
  if (!row) return { code: "not_found", status: 404 };
  if (!["new", "accepted"].includes(row.status)) return { code: "closed", status: 400 };
  if (op === "withdraw") {
    await env.DB.prepare("UPDATE sub_offers SET state = 'withdrawn', answered = ? WHERE no = ? AND id = ? AND state = 'pending'").bind(Date.now(), n, Number(body.offer) || 0).run();
    return { ok: true };
  }
  let data;
  try { data = await loadData(env); } catch { return { code: "data", status: 502 }; }
  const rec = safeJson(row.data), id = String(body.id || ""), line = (rec.lines || []).find((l) => l.id === id);
  if (!line) return { code: "bad_line", status: 400 };
  let lines = (rec.lines || []).map((l) => ({ id: l.id, qty: l.qty, price: l.price }));
  const withdrawLine = () => env.DB.prepare("UPDATE sub_offers SET state = 'withdrawn', answered = ? WHERE no = ? AND line_id = ? AND state = 'pending'").bind(Date.now(), n, id).run();
  if (op === "remove") {
    lines = lines.filter((l) => l.id !== id);
    if (!lines.length) return { code: "last_item", status: 400 };
    let r;
    try { r = await editOrder(env, data, { no: body.no, fee: rec.fee, lines }, who); } catch { return { code: "db", status: 502 }; }
    if (r.error) return { code: r.error, status: 400 };
    await withdrawLine();
    later(notifyRole(env, "customer", String(n), { title: "تعديل على طلبك #" + (1000 + n), body: `«${line.name}» ما كان متوفر وشلناه من طلبك. الإجمالي الجديد ${money(r.order.total)}`, url: "./", tag: "order" + n }));
    return { ok: true, removed: true, total: r.order.total };
  }
  const toP = (data.products || []).find((p) => p.id === String(body.to || ""));
  if (!toP || !toP.stock || toP.id === id) return { code: "bad_swap", status: 400 };
  if (rec.sub === "swap") {
    const ex = lines.find((l) => l.id === toP.id && l.price === Number(toP.price));
    lines = lines.filter((l) => l.id !== id);
    if (ex) ex.qty += line.qty * (Number(line.per) || 1); else lines.push({ id: toP.id, qty: line.qty * (Number(line.per) || 1), price: Number(toP.price) });
    let r;
    try { r = await editOrder(env, data, { no: body.no, fee: rec.fee, lines }, who); } catch { return { code: "db", status: 502 }; }
    if (r.error) return { code: r.error, status: 400 };
    await withdrawLine();
    later(notifyRole(env, "customer", String(n), { title: "تعديل على طلبك #" + (1000 + n), body: `«${line.name}» ما كان متوفر، وبدّلناه بـ «${toP.name}» (اخترت وقت الطلب نبدّل بمشابه). الإجمالي الجديد ${money(r.order.total)}`, url: "./", tag: "order" + n }));
    return { ok: true, applied: true, total: r.order.total };
  }
  const pending = (await env.DB.prepare("SELECT COUNT(*) c FROM sub_offers WHERE no = ? AND state = 'pending'").bind(n).first()).c;
  if (pending >= 8) return { code: "too_many", status: 429 };
  await env.DB.batch([env.DB.prepare("UPDATE sub_offers SET state = 'withdrawn', answered = ? WHERE no = ? AND line_id = ? AND state = 'pending'").bind(Date.now(), n, id),
    env.DB.prepare("INSERT INTO sub_offers (no, line_id, to_id, state, created, who) VALUES (?, ?, ?, 'pending', ?, ?)").bind(n, id, toP.id, Date.now(), who),
    logStmt(env, who, "sub_propose", "#" + (1000 + n), { from: line.name, to: toP.name })]);
  const diff = round2((Number(toP.price) - Number(line.price)) * line.qty);
  later(notifyRole(env, "customer", String(n), { title: "بديل مقترح لطلبك #" + (1000 + n), body: `«${line.name}» مو متوفر. نقترح «${toP.name}»${diff ? " (" + (diff > 0 ? "+" : "") + money(diff) + ")" : ""}. افتح طلبك ووافق أو ارفض.`, url: "./", tag: "sub" + n }));
  return { ok: true, pending: true };
}

async function editOrder(env, data, body, who) {
  await ensureSchema(env);
  const n = Number(String(body.no || "").replace(/\D/g, "")) - 1000;
  const old = n > 0 ? await env.DB.prepare("SELECT status, data, created, day, hour FROM orders WHERE no = ?").bind(n).first() : null;
  if (!old) return { error: "not_found" };
  if (old.status === "canceled") return { error: "canceled" };
  let rec; try { rec = JSON.parse(old.data); } catch { return { error: "bad_order" }; }
  const split = await env.DB.prepare('SELECT * FROM payment_splits WHERE no = ?').bind(n).first();
  if (old.status === 'delivered') return {error:'payment_locked'};
  if(old.status==='onway' && (await env.DB.prepare('SELECT require_receipt FROM pos_settings WHERE id=1').first())?.require_receipt)return {error:'pos_locked'};
  const byId = {}; for (const p of data.products || []) byId[p.id] = p;
  const oldBy = {}; for (const l of rec.lines || []) oldBy[l.id] = l;
  const lines = [];
  for (const x of Array.isArray(body.lines) ? body.lines.slice(0, 200) : []) {
    const id = String(x.id || ""), q = Math.floor(Number(x.qty)), pr = Number(x.price);
    const p = byId[id] || oldBy[id];
    if (!p || !(q > 0 && q <= (p.print || oldBy[id] ? 5000 : 500)) || !(pr >= 0 && pr < 100000)) return { error: "bad_line" };
    lines.push({ id, name: p.name, unit: p.unit || "", qty: q, price: round2(pr), regularPrice: Math.max(round2(pr), Number(oldBy[id]?.regularPrice ?? p.price) || 0, Number(p.old) || 0), tag: (oldBy[id] && oldBy[id].price === round2(pr) && oldBy[id].tag) || "", cost: oldBy[id] && oldBy[id].cost != null ? Number(oldBy[id].cost) : undefined, ...(oldBy[id] && oldBy[id].per ? { per: Number(oldBy[id].per) } : {}) });
  }
  if (!lines.length) return { error: "empty" };
  const fee = Math.max(0, Number(body.fee ?? rec.fee) || 0);
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.price, 0));
  const nr = { ...rec, lines, subtotal, fee, total: round2(subtotal + fee), count: lines.reduce((s, l) => s + l.qty, 0), st: 1,
    edits: (rec.edits || []).concat([{ at: Date.now(), before: rec.total, after: round2(subtotal + fee) }]).slice(-20) };
  await withCost(env, nr, true);
  const P = (q, ...a) => env.DB.prepare(q).bind(...a);
  const day = old.day || riyadhDateAt(old.created), hour = old.hour ?? riyadhHour(old.created);
  // تجهيز الطلب: نحفظ اللي أخذه المجهز (نفس المنتج ونفس الكمية)، والمنتج الجديد أو المتغيّر يرجع «ما تجهّز». الطلب يرجع «يتجهز» عشان يأكده المجهز قبل المندوب
  const prepRow = await env.DB.prepare("SELECT checks, version FROM prep_orders WHERE no = ?").bind(n).first().catch(() => null);
  let prepKeep = null;
  if (prepRow) {
    const oc = safeJson(prepRow.checks || "{}"), was = {};
    (rec.lines || []).forEach((l, i) => { if (oc[String(i)]) was[l.id] = { v: oc[String(i)], q: l.qty }; });
    const nc = {}; lines.forEach((l, i) => { const w = was[l.id]; if (w && w.q === l.qty) nc[String(i)] = w.v; });
    prepKeep = P("INSERT INTO prep_orders(no,stage,checks,updated,who,version) VALUES(?,?,?,?,?,?) ON CONFLICT(no) DO UPDATE SET stage=excluded.stage,checks=excluded.checks,updated=excluded.updated,who=excluded.who,version=excluded.version", n, "preparing", JSON.stringify(nc), Date.now(), String(who || "تعديل"), (prepRow.version || 0) + 1);
  }
  const stmts = [P("SELECT CASE WHEN status != ? OR data != ? THEN json('order_conflict') ELSE 1 END FROM orders WHERE no=?",old.status,old.data,n), P("UPDATE orders SET data = ?, total = ?, fee = ?, items = ?, updated = ?, day = ?, hour = ?, cost = ? WHERE no = ?", JSON.stringify(nr), nr.total, fee, nr.count, Date.now(), day, hour, costOf(nr), n),
    P("DELETE FROM oline WHERE no = ?", n), prepKeep || P("DELETE FROM prep_orders WHERE no = ?", n)];
  if (split) {
    const nextWallet=Math.min(split.wallet,moneyCents(nr.total));
    stmts.unshift(P("SELECT CASE WHEN (SELECT revision FROM payment_splits WHERE no=?) != ? THEN json('payment_conflict') ELSE 1 END",n,split.revision));
    if(nextWallet<split.wallet)stmts.push(...walletMove(env,normPhone(rec.phone),split.wallet-nextWallet,'refund',n,who,'تخفيض إجمالي الطلب',randomHex(16)));
    stmts.push(paymentStatement(env,n,{wallet:nextWallet,cash:rec.pay==='cash'?moneyCents(nr.total)-nextWallet:0,card:rec.pay==='card'?moneyCents(nr.total)-nextWallet:0},split.revision+1,who));
    nr.walletCents=nextWallet;
    stmts.push(P("UPDATE orders SET data=? WHERE no=?",JSON.stringify(nr),n));
  }
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

// مواعيد استقبال الطلبات اليومية (توقيت الرياض): store.openAt / store.closeAt مثل "12:00" و "01:00"
function openNow(S, now = Date.now()) {
  const hm = (x) => { const q = String(x || "").split(":"); return (Number(q[0]) || 0) * 60 + (Number(q[1]) || 0); };
  if (!S || !S.openAt || !S.closeAt) return true;
  const m = Math.floor((now / 60000 + 180) % 1440), o = hm(S.openAt), c = hm(S.closeAt);
  return o === c ? true : o < c ? (m >= o && m < c) : (m >= o || m < c);
}

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
  const bund = {};
  for (const [key, rawQty] of Object.entries(items)) {
    let qty = Math.floor(Number(rawQty));
    if (!(qty > 0 && qty <= 5000)) continue;   // الطباعة بالصفحة: ١٢٠ صفحة × ٣ نسخ = ٣٦٠ سطر واحد؛ الباقي أقصاه ٢٠٠ (تحت)
    const parts = String(key).split(":");
    if (!(parts.length === 1 || (parts.length === 2 && ['r','t','d'].includes(parts[0])) || (parts.length === 3 && parts[0] === 'x'))) return {error:'bad_items'};
    // باقة: x:<رقم البنر>:<المنتج>. سعرها من بيانات المتجر، مو من الجوال
    if (parts[0] === "x" && parts.length === 3) {
      if (qty > 200) continue;
      const ban = (S.bans || []).find((b) => b.id === parts[1]), bp = byId[parts[2]];
      if (!bp || !bp.stock) return { error: "unavailable", id: key };
      const al = ban && bundleAlloc(ban, byId);
      if (!al || al.alloc[bp.id] == null) continue;
      (bund[ban.id] || (bund[ban.id] = { al, q: {} })).q[bp.id] = qty;
      continue;
    }
    const kind = parts.length > 1 ? parts[0] : "r";
    const p = kind === "r" && String(parts[0]).includes("~") ? packProduct(byId, parts[0]) : byId[parts.length > 1 ? parts[1] : parts[0]];
    if (!p || !p.stock) return { error: "unavailable", id: key };
    if (qty > (p.print ? 5000 : 200)) continue;
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
  // الباقات: عدد الباقات الكاملة بسعر الباقة، والزايد بالسعر العادي
  for (const { al, q } of Object.values(bund)) {
    const n = Math.min(...al.ids.map((id) => q[id] || 0));
    for (const id of al.ids) {
      const p = byId[id];
      if (n > 0) { lines.push({ p, qty: n, price: al.alloc[id], tag: "باقة" }); base += n * al.alloc[id]; count += n; }
      const extra = (q[id] || 0) - n;
      if (extra > 0) { lines.push({ p, qty: extra, price: Number(p.price), tag: "" }); base += extra * p.price; count += extra; }
    }
  }
  if (DEAL && base >= Number(DEAL.min || 0)) for (const d of dealLines) { lines.push(d); dealSum += d.qty * d.price; count += d.qty; }
  // الحد لكل طلب بالحبات: الكرتون يحسب بعدد حباته
  const quantities = {};
  for (const l of lines) { const b = l.p.base || l.p.id; quantities[b] = (quantities[b] || 0) + l.qty * (l.p.per || 1); }
  for (const [id, qty] of Object.entries(quantities)) {
    const max = Math.floor(Number((byId[id] || {}).max || 0));
    if (max > 0 && qty > max) return {error:'item_limit',id,max};
  }
  if (!count) return { error: "empty" };
  if (S.closed || !openNow(S)) return { error: "closed" };
  const onlyPrint = lines.length > 0 && lines.every((l) => l.p.print), PR = S.print && typeof S.print === "object" ? S.print : null;
  const minOrder = onlyPrint && PR && PR.minOrder != null ? Number(PR.minOrder) || 0 : Number(S.minOrder) || 0;
  if (minOrder > 0 && base + dealSum < minOrder) return { error: "min_order", min: minOrder };
  const subtotal = round2(base + dealSum);
  const fee = S.freeOver && subtotal >= S.freeOver ? 0 : Number(S.fee || 0);
  return { lines, subtotal, fee, total: round2(subtotal + fee), count, phone };
}

// وحدة بيع ثانية لنفس المنتج: «<المنتج>~<رقم الخيار>»، سعرها من بيانات المتجر، والمخزون ينخصم بعدد حباتها من المنتج الأساسي
function packProduct(byId, key) {
  const [pid, k] = String(key).split("~"), base = byId[pid], pk = base && Array.isArray(base.packs) ? base.packs[Number(k)] : null;
  if (!pk || !/^\d{1,2}$/.test(String(k)) || !(Number(pk.price) > 0)) return null;
  return { ...base, id: pid + "~" + Number(k), unit: String(pk.u || ""), price: Number(pk.price), old: undefined, max: undefined, base: pid, per: Math.max(1, Math.floor(Number(pk.n) || 1)) };
}
function baseOf(id) { return String(id || "").split("~")[0]; }
function round2(n) { return Math.round(n * 100) / 100; }
function normPhone(v) {
  let s = asciiDigits(v).replace(/[^\d+]/g, "").replace(/^\+?966/, "").replace(/^0/, "");
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
  const mine = await env.LOCKS.get("fail:" + ip, "json");
  const now = Date.now();
  if (mine && mine.n >= MAX_FAILS_PER_IP && mine.until > now) return Math.ceil((mine.until - now) / 1000);
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
  await bump(env, "fail:" + ip, IP_LOCK_SECONDS);
}

async function clearFails(env, ip) {
  if (!env.LOCKS) return;
  // كل delete في KV يُحسب كتابة (الحد المجاني ١٠٠٠ باليوم)، وهالدالة تنادى مع كل طلب ناجح من المندوب والإدارة،
  // فنمسح بس لو فيه محاولات غلط مسجلة. القراءة رخيصة (١٠٠ ألف باليوم).
  if (await env.LOCKS.get("fail:" + ip)) await env.LOCKS.delete("fail:" + ip);
}

function validate(d) {
  if (!d || typeof d !== "object") return "no data";
  if (!d.store || typeof d.store !== "object") return "store";
  if (!Array.isArray(d.cats) || !Array.isArray(d.products)) return "lists";
  if (!d.imgs || typeof d.imgs !== "object" || !d.imgs.logo) return "imgs";
  if (d.products.length > 12000 || d.cats.length > 200) return "too many";
  for (const p of d.products) {
    if (!p || typeof p.id !== "string" || typeof p.name !== "string" || !(Number(p.price) >= 0)) return "product";
  }
  for (const v of Object.values(d.imgs)) {
    if (typeof v !== "string" || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(v)) return "image";
  }
  for (const p of d.products) if (p.packs != null && (!Array.isArray(p.packs) || p.packs.length > 5 || !p.packs.every((x) => x && typeof x.u === "string" && x.u.length <= 40 && Number(x.n) >= 1 && Number(x.n) <= 999 && Number(x.price) > 0))) return "packs";
  const z = d.store.zone;
  if (z != null && (!Array.isArray(z) || z.length > 40 || (z.length && z.length < 3) || !z.every((p) => Array.isArray(p) && p.length === 2 && Math.abs(Number(p[0])) <= 90 && Math.abs(Number(p[1])) <= 180))) return "zone";
  if (d.store.custCancel != null && !["off", "new", "accepted"].includes(d.store.custCancel)) return "cancel_policy";
  return "";
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function canonical(value) {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
async function dataVersion(data) { return tokenHash(canonical(data)); }
function githubHeaders(env) { return {Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json','User-Agent':'ohod-admin-worker','X-GitHub-Api-Version':'2022-11-28'}; }
async function readCatalog(env) {
  const url=`https://api.github.com/repos/${env.REPO}/contents/data.json`;
  const response=await fetch(url+'?ref='+encodeURIComponent(env.BRANCH),{headers:githubHeaders(env)});
  if (!response.ok) throw {code:response.status===401||response.status===403?'github_auth':'github',status:response.status};
  const file=await response.json();
  if (!file.sha) throw {code:'github',status:502};
  let content=file.content;
  // Contents omits inline base64 for larger files. Read the immutable blob, never another branch snapshot.
  if(file.encoding==='none'||typeof content!=='string'||!content){
    const blobResponse=await fetch(`https://api.github.com/repos/${env.REPO}/git/blobs/${encodeURIComponent(file.sha)}`,{headers:githubHeaders(env)});
    if(!blobResponse.ok)throw {code:'github',status:blobResponse.status};
    const blob=await blobResponse.json();if(blob.sha!==file.sha||typeof blob.content!=='string')throw {code:'github',status:502};content=blob.content;
  }
  const bytes=Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0));
  return {url,sha:file.sha,data:JSON.parse(new TextDecoder().decode(bytes))};
}
async function saveToGitHub(env, file, text, message, baseVersion) {
  const current=await readCatalog(env);
  if (typeof baseVersion!=='string' || baseVersion!==await dataVersion(current.data)) throw {code:'data_conflict',status:409};
  const response=await fetch(current.url,{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify({message,content:toBase64(text),branch:env.BRANCH,sha:current.sha})});
  if (response.status===409) throw {code:'data_conflict',status:409};
  if (!response.ok) throw {code:[401,403,404].includes(response.status)?'github_auth':'github',status:response.status};
}

function asciiDigits(value) { return String(value??'').replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<='٩'?0x660:0x6f0))); }
async function checkoutFingerprint(body) {
  return dataVersion({items:body.items||{},phone:normPhone(body.phone),pay:body.pay==='card'?'card':'cash',name:String(body.name||''),details:String(body.details||''),note:String(body.note||''),sub:body.sub||'call',lat:Number(body.lat),lng:Number(body.lng),wallet:moneyCents(body.walletAmount||0)});
}
async function checkoutResult(env, checkout) {
  const old=await env.DB.prepare('SELECT k.fingerprint,o.no,o.total FROM checkout_keys k JOIN orders o ON o.no=k.no WHERE k.request_id=?').bind(checkout.id).first();
  if (!old) return null;
  if (old.fingerprint!==checkout.fingerprint) return {ok:false,code:'request_conflict'};
  return {ok:true,orderNo:'#'+(1000+old.no),total:old.total,track:true,repeated:true};
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
  for (const l of rec.lines || []) if (l.id) { const b = baseOf(l.id); need[b] = (need[b] || 0) + Number(l.qty || 0) * (Number(l.per) || 1); }
  return need;
}
let stockCache = { at: 0, body: "" };
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
  stockCache = { at: 0, body: "" };
  const st = [], put = {};
  for (const [id, v] of Object.entries(map).slice(0, 12000)) {
    if (v === null || v === "") st.push(env.DB.prepare("DELETE FROM stock WHERE id = ?").bind(String(id)));
    else {
      const q = Math.floor(Number(v));
      if (q >= 0 && q <= 1e6) put[String(id)] = q;
    }
  }
  // كل القيم في جملة وحدة (استيراد ٣٠٠٠ صنف = استعلام واحد بدل ٣٠٠٠)
  if (Object.keys(put).length) st.push(env.DB.prepare("INSERT INTO stock (id, qty) SELECT key, value FROM json_each(?) WHERE true ON CONFLICT(id) DO UPDATE SET qty = excluded.qty").bind(JSON.stringify(put)));
  if (st.length) await env.DB.batch(st);
}

// وضع «المندوب للتوصيل بس»: الطلب يوصل المندوب بعد ما يعلّمه المجهز «جاهز».
// الإعداد: on = شغّال دايماً، off = متوقف، وبدونه (auto) يشتغل لما يكون فيه مجهز مفعّل
async function prepSettings(env) {
  try {
    const r = await env.DB.prepare("SELECT (SELECT v FROM app_settings WHERE k = 'prep_mode') m, (SELECT v FROM app_settings WHERE k = 'prep_late_min') l, (SELECT COUNT(*) FROM staff_users WHERE role = 'preparer' AND active = 1) p").first();
    const mode = r && (r.m === "on" || r.m === "off") ? r.m : "auto", preparers = (r && r.p) || 0, lateMin = Math.min(60, Math.max(3, Number(r && r.l) || 10));
    return { mode, preparers, lateMin, on: mode === "on" || (mode === "auto" && preparers > 0) };
  } catch { return { mode: "auto", preparers: 0, lateMin: 10, on: false }; }
}
async function prepMode(env) { return (await prepSettings(env)).on; }

// طلب ينتظر المجهز أكثر من المهلة: تنبيه للإدارة والمجهز مرة وحدة لكل طلب (يُستدعى من استعلامات المندوب والمجهز، مو أكثر من مرة بالدقيقة)
let lateCheckedAt = 0;
async function lateCheck(env, force) {
  const now = Date.now();
  if (!force && now - lateCheckedAt < Number(env.LATE_CHECK_MS ?? 60000)) return 0;
  lateCheckedAt = now;
  const st = await prepSettings(env);
  if (!st.on) return 0;
  const rs = (await env.DB.prepare("SELECT o.no, o.created, o.data FROM orders o LEFT JOIN prep_orders p ON p.no = o.no LEFT JOIN late_alerts a ON a.no = o.no WHERE o.status IN ('new','accepted') AND o.src != 'pos' AND o.created < ? AND (p.stage IS NULL OR p.stage != 'ready') AND a.no IS NULL ORDER BY o.no LIMIT 10").bind(now - st.lateMin * 60000).all()).results || [];
  for (const r of rs) {
    const ins = await env.DB.prepare("INSERT OR IGNORE INTO late_alerts (no, at) VALUES (?, ?)").bind(r.no, now).run();
    if (!(ins.meta && ins.meta.changes)) continue;
    const mins = Math.round((now - r.created) / 60000), msg = { title: "طلب متأخر #" + (1000 + r.no), body: "ينتظر التجهيز من " + mins + " دقيقة" + (safeJson(r.data).name ? " · " + safeJson(r.data).name : ""), url: "./", tag: "late" + r.no };
    await Promise.all([notifyRole(env, "admin", null, msg), notifyRole(env, "prep", null, msg)]);
  }
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM late_alerts WHERE at < ?").bind(now - 3 * 864e5).run().catch(() => {});
  return rs.length;
}

// بعد الطلب: التحليل + إشعار الإدارة والمندوب + تنبيه المخزون
async function afterOrder(env, data, rec, orderNo, before, quiet) {
  if (!env.LOCKS) return;
  const n = Number(String(orderNo).replace(/\D/g, ""));
  if (!quiet) {
  const msg = { title: "طلب جديد " + ({ phone: "(اتصال) ", whatsapp: "(واتساب) ", store: "(من المحل) " }[rec.source] || "") + orderNo, body: rec.count + " منتج · " + money(rec.total) + " · " + (rec.pay === "card" ? "شبكة" : "كاش") + (rec.name ? " · " + rec.name : ""), url: "./#driver", tag: "new" + n };
  const pm = env.DB ? await prepMode(env) : false;
  await Promise.all([notifyRole(env, "admin", null, msg), pm ? notifyRole(env, "prep", null, { ...msg, title: "طلب جديد للتجهيز " + orderNo, tag: "prep" + orderNo }) : notifyRole(env, "driver", null, msg)]);
  }
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
  const total = Number(rec.total || 0), fee = Number(rec.fee || 0), card = rec.pay === "card" ? 1 : 0, cost = costOf(rec), pos = rec.src === "pos" ? 1 : 0;
  const ids = Object.keys(per).sort();
  const P = (q, ...a) => env.DB.prepare(q).bind(...a);
  const st = [
    P("INSERT INTO st_day (day, orders, revenue, items, card, fees, canceled, cost, pos_n, pos_rev) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET orders = orders + excluded.orders, revenue = revenue + excluded.revenue, items = items + excluded.items, card = card + excluded.card, fees = fees + excluded.fees, canceled = canceled + excluded.canceled, cost = cost + excluded.cost, pos_n = pos_n + excluded.pos_n, pos_rev = pos_rev + excluded.pos_rev",
      day, sign, round2(sign * total), sign * items, sign * card, round2(sign * fee), cancelDelta, round2(sign * cost), sign * pos, round2(sign * pos * total)),
    P("INSERT INTO st_hour (day, hour, orders, revenue) VALUES (?, ?, ?, ?) ON CONFLICT(day, hour) DO UPDATE SET orders = orders + excluded.orders, revenue = revenue + excluded.revenue", day, hour, sign, round2(sign * total)),
  ];
  for (const id of ids) st.push(P("INSERT INTO st_item (day, id, qty, revenue, orders, cost) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(day, id) DO UPDATE SET qty = qty + excluded.qty, revenue = revenue + excluded.revenue, orders = orders + excluded.orders, cost = cost + excluded.cost", day, id, sign * per[id].qty, round2(sign * per[id].rev), sign, round2(sign * (per[id].cost || 0))));
  if (!pos) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
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
  const TRUTH_DAY = "SELECT day, SUM(status != 'canceled') orders, ROUND(SUM(CASE WHEN status != 'canceled' THEN total ELSE 0 END), 2) revenue, SUM(CASE WHEN status != 'canceled' THEN items ELSE 0 END) items, SUM(status != 'canceled' AND pay = 'card') card, ROUND(SUM(CASE WHEN status != 'canceled' THEN fee ELSE 0 END), 2) fees, SUM(status = 'canceled') canceled, SUM(status = 'delivered') deliv_n, SUM(CASE WHEN status = 'delivered' THEN dms ELSE 0 END) deliv_ms, ROUND(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 2) deliv_rev, ROUND(SUM(CASE WHEN status != 'canceled' THEN cost ELSE 0 END), 2) cost, SUM(status != 'canceled' AND src = 'pos') pos_n, ROUND(SUM(CASE WHEN status != 'canceled' AND src = 'pos' THEN total ELSE 0 END), 2) pos_rev FROM orders WHERE total IS NOT NULL AND day BETWEEN ? AND ? GROUP BY day";
  const TRUTH_ITEM = "SELECT o.day day, l.id id, SUM(l.qty) qty, ROUND(SUM(l.qty * l.price), 2) revenue, COUNT(DISTINCT l.no) orders, ROUND(SUM(l.qty * l.cost), 2) cost FROM oline l JOIN orders o ON o.no = l.no WHERE o.status != 'canceled' AND l.id != '' AND o.day BETWEEN ? AND ? GROUP BY o.day, l.id";
  const TRUTH_HOUR = "SELECT day, hour, SUM(status != 'canceled') orders, ROUND(SUM(CASE WHEN status != 'canceled' THEN total ELSE 0 END), 2) revenue FROM orders WHERE total IS NOT NULL AND day BETWEEN ? AND ? GROUP BY day, hour";
  const [td, sd, ti, si, th, sh] = await Promise.all([
    Q(TRUTH_DAY, from, to), Q("SELECT * FROM st_day WHERE day BETWEEN ? AND ?", from, to),
    Q(TRUTH_ITEM, from, to), Q("SELECT * FROM st_item WHERE day BETWEEN ? AND ? AND (qty != 0 OR orders != 0)", from, to),
    Q(TRUTH_HOUR, from, to), Q("SELECT * FROM st_hour WHERE day BETWEEN ? AND ? AND orders != 0", from, to),
  ]);
  const F = ["orders", "revenue", "items", "card", "fees", "canceled", "deliv_n", "deliv_ms", "deliv_rev", "cost", "pos_n", "pos_rev"];
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
  const tp = await Q("SELECT a.id a, b.id b, COUNT(*) n FROM (SELECT DISTINCT no, id FROM oline WHERE id != '') a JOIN (SELECT DISTINCT no, id FROM oline WHERE id != '') b ON a.no = b.no AND a.id < b.id JOIN orders o ON o.no = a.no WHERE o.status != 'canceled' AND o.src != 'pos' GROUP BY a.id, b.id");
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
      P("INSERT INTO st_pair (a, b, n) SELECT a.id, b.id, COUNT(*) FROM (SELECT DISTINCT no, id FROM oline WHERE id != '') a JOIN (SELECT DISTINCT no, id FROM oline WHERE id != '') b ON a.no = b.no AND a.id < b.id JOIN orders o ON o.no = a.no WHERE o.status != 'canceled' AND o.src != 'pos' GROUP BY a.id, b.id"),
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
    Q(`SELECT a.tail, a.first, a.last, a.orders, a.revenue, o.phone, json_extract(o.data, '$.name') AS name
      FROM (SELECT ch, MAX(tail) tail, MIN(day) first, MAX(day) last, COUNT(*) orders, ROUND(SUM(total), 2) revenue FROM orders WHERE status != 'canceled' AND ch != '' GROUP BY ch ORDER BY revenue DESC LIMIT 15) a
      LEFT JOIN orders o ON o.no = (SELECT MAX(r.no) FROM orders r WHERE r.ch = a.ch AND r.phone != '' AND r.anon = 0)
      ORDER BY a.revenue DESC`),
  ]);
  const withId = {};
  for (const r of all) withId[r.id] = r.orders;
  return { days, from, prevFrom: prev, daily, items, ordersWith: withId, pairs, statuses: sts, hours, views, searches, customers: cust[0] || {}, topCustomers: top };
}

// ---------- الإشعارات (Web Push) ----------
// اشتراك أصلي من تطبيق الزبائن: {native:'ios'|'android', token}. نخزّنه بنفس جدول subs بعنوان apns:… أو fcm:…
function normSub(sub) {
  if (sub && typeof sub === "object" && sub.native !== undefined && sub.native !== "ios" && sub.native !== "android") return null;
  if (sub && typeof sub === "object" && (sub.native === "ios" || sub.native === "android")) {
    const t = String(sub.token || "");
    if (sub.native === "ios" ? !/^[0-9a-fA-F]{64,200}$/.test(t) : !/^[\w:.-]{40,500}$/.test(t)) return null;
    return { endpoint: (sub.native === "ios" ? "apns:" : "fcm:") + t, keys: { p256dh: "", auth: "" }, native: sub.native };
  }
  return sub;
}
async function saveSub(env, sub0, role, ref) {
  const sub = normSub(sub0);
  if (!sub || typeof sub !== "object") return false;
  if (sub.native && role !== "customer") return false;   // التطبيق الأصلي للزبائن بس (الإدارة والمندوب والمجهز ما فيهم)
  if (!sub.native && !sub.keys) return false;
  const ep = String(sub.endpoint || ""), p = String((sub.keys || {}).p256dh || ""), a = String((sub.keys || {}).auth || "");
  if (!sub.native && (!/^https:\/\/[^\s]{10,900}$/.test(ep) || !/^[\w-]{80,100}$/.test(p) || !/^[\w-]{16,30}$/.test(a))) return false;
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
      const ep = String(s.endpoint || "");
      const st = ep.startsWith("apns:") ? await apnsPush(env, ep.slice(5), msg) : ep.startsWith("fcm:") ? await fcmPush(env, ep.slice(4), msg) : await webPush(env, s, msg);
      if (st >= 200 && st < 300) ok++;
      else if (st === 404 || st === 410 || st === -410) await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(s.endpoint).run();
    } catch {}
  }));
  return ok;
}
// ---- إشعارات التطبيق الأصلي ----
// آيفون: APNs مباشرة (مفتاح .p8). أندرويد: FCM v1 (حساب خدمة). المفاتيح أسرار في Cloudflare، ولو ناقصة نتجاوز بدون خطأ.
// الأسرار: APNS_KEY (نص ملف .p8)، APNS_KEY_ID، APNS_TEAM_ID، اختياري APNS_TOPIC (الافتراضي sa.ohod.store) و APNS_ENV=sandbox للتجارب؛ FCM_SERVICE_ACCOUNT (نص JSON).
const pemDer = (pem) => Uint8Array.from(atob(String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
const b64uText = (o) => b64u(new TextEncoder().encode(typeof o === "string" ? o : JSON.stringify(o)));
let apnsJwt = null, fcmTok = null;
// المفتاح من أسرار Cloudflare، أو اللي رفعه المالك من الإدارة (KV)
async function apnsCreds(env) {
  const kv = env.LOCKS;
  const pem = env.APNS_KEY || (kv ? await kv.get("apns_key") : null);
  const kid = env.APNS_KEY_ID || (kv ? await kv.get("apns_kid") : null);
  return { pem, kid, team: env.APNS_TEAM_ID || null };
}
async function apnsPush(env, token, msg) {
  const c = await apnsCreds(env);
  if (!c.pem || !c.kid || !c.team) return 0;
  const now = Math.floor(Date.now() / 1000);
  if (!apnsJwt || now - apnsJwt.at > 45 * 60 || apnsJwt.kid !== c.kid) {   // آبل تطلب تجديد الرمز كل أقل من ساعة، وما يزيد على مرة كل ٢٠ دقيقة
    const key = await crypto.subtle.importKey("pkcs8", pemDer(c.pem), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const unsigned = b64uText({ alg: "ES256", kid: c.kid }) + "." + b64uText({ iss: c.team, iat: now });
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)));
    apnsJwt = { jwt: unsigned + "." + b64u(sig), at: now, kid: c.kid };
  }
  const host = env.APNS_ENV === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const r = await fetch("https://" + host + "/3/device/" + token, {
    method: "POST",
    headers: { "authorization": "bearer " + apnsJwt.jwt, "apns-topic": env.APNS_TOPIC || "sa.ohod.store", "apns-push-type": "alert", "apns-priority": "10", "apns-expiration": String(now + 86400), "content-type": "application/json" },
    body: JSON.stringify({ aps: { alert: { title: String(msg.title || ""), body: String(msg.body || "") }, sound: "default", "thread-id": String(msg.tag || "") }, url: msg.url || "./", tag: msg.tag || "" }),
  });
  if (r.status === 410 || r.status === 400) { const j = await r.json().catch(() => ({})); if (r.status === 410 || j.reason === "BadDeviceToken" || j.reason === "Unregistered" || j.reason === "DeviceTokenNotForTopic") return -410; }
  return r.status;
}
async function fcmAccess(env, sa) {
  const now = Math.floor(Date.now() / 1000);
  if (fcmTok && fcmTok.exp - 120 > now && fcmTok.mail === sa.client_email) return fcmTok.v;
  const key = await crypto.subtle.importKey("pkcs8", pemDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const unsigned = b64uText({ alg: "RS256", typ: "JWT" }) + "." + b64uText({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + unsigned + "." + b64u(sig) });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error("fcm_auth");
  fcmTok = { v: j.access_token, exp: now + (Number(j.expires_in) || 3600), mail: sa.client_email };
  return fcmTok.v;
}
async function fcmPush(env, token, msg) {
  if (!env.FCM_SERVICE_ACCOUNT) return 0;
  let sa; try { sa = JSON.parse(env.FCM_SERVICE_ACCOUNT); } catch { return 0; }
  if (!sa.project_id || !sa.client_email || !sa.private_key) return 0;
  const access = await fcmAccess(env, sa);
  const r = await fetch("https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(sa.project_id) + "/messages:send", {
    method: "POST", headers: { "authorization": "Bearer " + access, "content-type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title: String(msg.title || ""), body: String(msg.body || "") }, data: { url: String(msg.url || "./"), tag: String(msg.tag || "") }, android: { priority: "HIGH", notification: { tag: String(msg.tag || "") } } } }),
  });
  if (r.status === 404 || r.status === 410) return -410;   // الجهاز ما عاد مسجّل
  if (r.status === 400) { const j = await r.json().catch(() => ({})); if (/UNREGISTERED/.test(JSON.stringify(j))) return -410; }
  return r.status;
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
    if (same) same.qty += q; else lines.push({ id: p.id, name: p.name, unit: p.unit || "", qty: q, price: round2(pr), regularPrice: Math.max(round2(pr),Number(p.price)||0,Number(p.old)||0), tag: "" });
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
    source: src, st: 1, sub: ["swap", "remove", "call"].includes(body.sub) ? body.sub : "call",
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
  const st = [], put = {};
  for (const [id, v] of Object.entries(map).slice(0, 12000)) {
    if (v === null || v === "") st.push(env.DB.prepare("DELETE FROM pcost WHERE id = ?").bind(String(id)));
    else { const c = round2(Number(v)); if (c >= 0 && c < 1e6) put[String(id)] = c; }
  }
  if (Object.keys(put).length) st.push(env.DB.prepare("INSERT INTO pcost (id, cost) SELECT key, value FROM json_each(?) WHERE true ON CONFLICT(id) DO UPDATE SET cost = excluded.cost").bind(JSON.stringify(put)));
  if (st.length) await env.DB.batch(st);
}
// يحط سعر الشراء وقت الطلب على كل سطر، عشان الربح القديم ما يتغير لو تغيّر سعر الشراء بعدين
async function withCost(env, rec, keepOld) {
  const costs = await readCosts(env);
  for (const l of rec.lines || []) { if (keepOld && l.cost != null) continue; l.cost = round2(Number(costs[baseOf(l.id)] || 0) * (Number(l.per) || 1)); }
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
  const st = [], keep = [], byOld = {}, byNew = {};
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
    if (!!os.closed !== !!ns.closed) keep.push(logStmt(env, who, ns.closed ? "store_close" : "store_open", "", {}));
    if (Number(os.fee || 0) !== Number(ns.fee || 0) || Number(os.freeOver || 0) !== Number(ns.freeOver || 0)) keep.push(logStmt(env, who, "fees", "", { fee: Number(ns.fee || 0), freeOver: Number(ns.freeOver || 0) }));
  }
  for (const [id, v] of Object.entries(stockSet || {})) {
    const was = oldStock[id] == null ? null : oldStock[id], now = v === null || v === "" ? null : Math.floor(Number(v));
    if (was !== now) st.push(logStmt(env, who, "stock", id, { name: (byNew[id] || {}).name || id, from: was, to: now }));
  }
  for (const id of Object.keys(costSet || {})) st.push(logStmt(env, who, "cost", id, { name: (byNew[id] || {}).name || id }));
  if (body.newPin) keep.push(logStmt(env, who, "pin_admin", "", {}));
  if (body.newDriverPin) keep.push(logStmt(env, who, "pin_driver", "", {}));
  if (Math.random() < 0.05) keep.push(env.DB.prepare("DELETE FROM alog WHERE at < ?").bind(Date.now() - 400 * 864e5));
  // استيراد كبير: سطر ملخص بدل آلاف الأسطر (كل سطر استعلام، والخطة المجانية لها حد)
  if (st.length > 120) {
    const sum = { added: 0, removed: 0, prices: 0, stock: 0, costs: Object.keys(costSet || {}).length };
    if (oldD) { for (const p of newD.products) { const o = byOld[p.id]; if (!o) sum.added++; else if (Number(o.price) !== Number(p.price)) sum.prices++; } for (const id of Object.keys(byOld)) if (!byNew[id]) sum.removed++; }
    sum.stock = Object.keys(stockSet || {}).length;
    st.length = 0; st.push(logStmt(env, who, "bulk_import", "", sum));
  }
  st.push(...keep);
  for (let i = 0; i < st.length; i += 80) await env.DB.batch(st.slice(i, i + 80));
}

// ---------- كاش المندوب ----------
// كل طلب كاش تم توصيله = فلوس عند المندوب. كل استلام تسجله الإدارة ينقص منها.
// كاش المناديب: الكاش اللي حصّله المندوب (بعد المحفظة والشبكة) يزيد اللي عنده، وكل استلام تسجله الإدارة له ينقص
async function readCash(env, drvId) {
  await ensureSchema(env);
  const one = drvId != null && drvId !== "";
  const rows=(await env.DB.prepare("SELECT o.no,o.total,o.pay,o.updated,IFNULL(o.drv,'') drv,COALESCE(d.at,o.updated) delivered_at,p.cash FROM orders o LEFT JOIN payment_splits p ON p.no=o.no LEFT JOIN delivery_times d ON d.no=o.no WHERE o.status='delivered'").all()).results||[];
  const transfers=(await env.DB.prepare('SELECT * FROM cash ORDER BY id DESC').all()).results||[];
  const team = await staffList(env, "driver"), nm = staffNames(team), solo = await soleDriver(env);
  const keyOf = (d) => solo && (d === '' || d === 'admin') ? solo : d;
  const openings=transfers.filter(t=>Number(t.amount)===0 && t.who==='النظام' && t.note==='بداية الحساب');
  const since=openings.length ? Math.min(...openings.map(x=>x.at)) : 0, daily={}, owed={}, got={};
  for(const o of rows){const cash=o.cash==null?(o.pay==='cash'?moneyCents(o.total):0):o.cash; const k0=keyOf(o.drv); if(o.delivered_at>=since) owed[k0]=(owed[k0]||0)+cash;
    if(one && k0!==drvId) continue;
    if(o.delivered_at<Date.now()-14*864e5)continue; const day=riyadhDateAt(o.delivered_at); const r=daily[day]||(daily[day]={day,n:0,cash:0,got:0});if(cash){r.n++;r.cash=round2(r.cash+cash/100);}}
  for(const t of transfers){ const k=keyOf(t.drv||'d0'); got[k]=round2((got[k]||0)+t.amount); if((!one||k===drvId)&&daily[t.day])daily[t.day].got=round2(daily[t.day].got+t.amount);}
  const bal=(id)=>round2((owed[id]||0)/100-(got[id]||0));
  const ids=new Set(team.filter((t)=>t.active).map((t)=>t.id).concat(Object.keys(owed),Object.keys(got)));
  const drivers=[...ids].map((id)=>({id,name:id===''?'بدون مندوب':nm[id]||id,balance:bal(id),active:id===''||id==='admin'||!!team.find((t)=>t.id===id&&t.active)})).filter((x)=>x.active||Math.abs(x.balance)>0.009).filter((x)=>x.id!==''||Math.abs(x.balance)>0.009);
  const balance=one?bal(drvId):round2(drivers.reduce((v,x)=>v+x.balance,0));
  const day=riyadhDate();
  const settlement=one?await env.DB.prepare('SELECT * FROM driver_settlements2 WHERE day=? AND drv=?').bind(day,drvId).first()||null:null;
  const hist=transfers.filter((t)=>t.amount&&(!one||keyOf(t.drv||'d0')===drvId)).slice(0,30).map((t)=>({...t,drvName:nm[t.drv||'d0']||t.drv}));
  return {settlement,today:await dayReport(env,day,one&&!solo?drvId:null),days:Object.values(daily).sort((a,b)=>b.day.localeCompare(a.day)),balance,since:since||null,history:hist,drivers};
}

// ---------- اليوم حتى الحين ----------
async function readToday(env) {
  await ensureSchema(env);
  const now = Date.now(), today = riyadhDate(), last = riyadhDate(-7), hr = riyadhHour(now);
  const Q = (q, ...a) => env.DB.prepare(q).bind(...a).all().then((r) => r.results || []);
  const [rows, open, cash] = await Promise.all([
    Q("SELECT day, SUM(status != 'canceled') orders, ROUND(SUM(CASE WHEN status != 'canceled' THEN total ELSE 0 END), 2) revenue, ROUND(SUM(CASE WHEN status != 'canceled' THEN cost ELSE 0 END), 2) cost, SUM(status = 'canceled') canceled, SUM(status != 'canceled' AND pay = 'card') card, SUM(status != 'canceled' AND src = 'pos') pos_n, ROUND(SUM(CASE WHEN status != 'canceled' AND src = 'pos' THEN total ELSE 0 END), 2) pos_rev FROM orders WHERE (day = ? OR (day = ? AND hour <= ?)) GROUP BY day", today, last, hr),
    Q("SELECT status, COUNT(*) n FROM orders WHERE status IN ('new','accepted','onway') GROUP BY status"),
    readCash(env),
  ]);
  const m = {}; for (const r of rows) m[r.day] = r;
  const hours = await Q("SELECT day, hour, SUM(status != 'canceled') orders FROM orders WHERE day IN (?, ?) GROUP BY day, hour", today, last);
  const z = { orders: 0, revenue: 0, cost: 0, canceled: 0, card: 0, pos_n: 0, pos_rev: 0 };
  return { today: m[today] || z, lastWeek: m[last] || z, hour: hr, open, hours, cashBalance: cash.balance, cashSince: cash.since, drivers: cash.drivers };
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

// يوزّع سعر الباقة على منتجاتها بنسبة أسعارها (نفس الحساب في المتجر بالضبط)
function bundleAlloc(b, byId) {
  if (!b || b.style !== "bundle") return null;
  const ids = [...new Set((b.ids || []).filter(Boolean))].slice(0, 4);
  if (ids.length < 2) return null;
  const ps = ids.map((id) => byId[id]);
  if (ps.some((p) => !p || !p.stock)) return null;
  const sum = Math.round(ps.reduce((a, p) => a + Number(p.price), 0) * 100) / 100, bp = Number(b.bprice);
  if (!(bp > 0 && bp < sum)) return null;
  const alloc = {}; let acc = 0;
  ps.forEach((p, i) => { if (i < ps.length - 1) { const v = Math.round(Number(p.price) * bp / sum * 100) / 100; alloc[p.id] = v; acc += v; } });
  alloc[ps[ps.length - 1].id] = Math.round((bp - acc) * 100) / 100;
  return { ids, alloc, sum, price: bp };
}

// ---------- تتبع المندوب ----------
const NEAR_M = 600;           // «المندوب قريب منك» تنرسل مرة وحدة لكل طلب
const LOC_FRESH_MS = 10 * 60e3; // آخر موقع أقدم من كذا ما ينعرض
// منطقة التوصيل المرسومة (مضلع). النقطة داخل المضلع؟ (ray casting)
function inPolygon(poly, lat, lng) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((xi > lng) !== (xj > lng) && lat < ((yj - yi) * (lng - xi)) / (xj - xi) + yi) inside = !inside;
  }
  return inside;
}
function zoneOf(S0) {
  const z = S0 && S0.zone;
  return Array.isArray(z) && z.length >= 3 && z.every((p) => Array.isArray(p) && isFinite(Number(p[0])) && isFinite(Number(p[1]))) ? z.map((p) => [Number(p[0]), Number(p[1])]) : null;
}
function distM(a1, o1, a2, o2) {
  const R = 6371000, r = Math.PI / 180, da = (a2 - a1) * r, dn = (o2 - o1) * r;
  const h = Math.sin(da / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// الطريق أطول من الخط المستقيم (×1.4) وسرعة الحي تقريباً ٢٥ كم/س، وكل توصيلة قبلك تزيد ٤ دقايق
function etaMin(m, before) { return Math.max(1, Math.round((m * 1.4) / (25000 / 60) + before * 4)); }
async function driverFor(env, n, d, drv) {
  const key = drv || "admin";
  const loc = await env.DB.prepare("SELECT lat, lng, acc, at FROM dlocs WHERE drv = ?").bind(key).first();
  if (!loc || Date.now() - loc.at > LOC_FRESH_MS) return null;
  const out = { lat: loc.lat, lng: loc.lng, acc: loc.acc, at: loc.at };
  if (d.lat != null && d.lng != null && isFinite(d.lat) && isFinite(d.lng)) {
    const mine = distM(loc.lat, loc.lng, d.lat, d.lng);
    // كم توصيلة قبلك: طلبات نفس المندوب اللي في الطريق وأقرب له منك
    const rs = await env.DB.prepare("SELECT data FROM orders WHERE status = 'onway' AND no != ? AND IFNULL(drv, 'admin') = ? LIMIT 20").bind(n, key).all();
    let before = 0;
    for (const r of rs.results || []) { const o = safeJson(r.data); if (o.lat != null && isFinite(o.lat) && distM(loc.lat, loc.lng, o.lat, o.lng) < mine) before++; }
    Object.assign(out, { m: Math.round(mine), before, eta: etaMin(mine, before), near: mine <= NEAR_M });
  }
  return out;
}

// ---------- الموظفين: كل مندوب وكل كاشير له اسم ورقم سري ----------
// الرقم ينحفظ مشفّر (نفس طريقة رقم المندوب القديم، فالرقم القديم يشتغل بدون تغيير)
async function staffHash(env, pin) { return hashPin(env, "driver:" + pin); }
async function whoIs(env, pin, body) {
  pin = String(pin == null ? "" : pin);
  if (!pin || pin.length > 12) return null;
  if (await checkPin(env, pin)) return { role: "admin", id: "admin", name: staff(body) };
  if (env.DB) {
    await ensureSchema(env);
    const r = await env.DB.prepare("SELECT id, name, role FROM staff WHERE pin = ? AND active = 1").bind(await staffHash(env, pin)).first();
    return r ? { role: r.role, id: r.id, name: r.name } : null;
  }
  const stored = env.LOCKS ? await env.LOCKS.get("driver_pin") : null;
  const expected = stored || (env.DRIVER_PIN ? await staffHash(env, String(env.DRIVER_PIN)) : "");
  return expected && sameText(await staffHash(env, pin), expected) ? { role: "driver", id: "d0", name: "المندوب" } : null;
}
// لو المحل عنده مندوب واحد بس: كل الطلبات بدون مندوب محدد (أو اللي وصّلتها الإدارة) تنحسب عليه، مثل قبل
async function soleDriver(env) {
  const r = await env.DB.prepare("SELECT id FROM staff WHERE role = 'driver' AND active = 1 LIMIT 2").all();
  const l = r.results || [];
  return l.length <= 1 ? (l[0] ? l[0].id : "d0") : null;
}
async function staffList(env, role) {
  const rs = await env.DB.prepare("SELECT id, name, role, active, created FROM staff WHERE (? = '' OR role = ?) ORDER BY created, id").bind(role || "", role || "").all();
  return rs.results || [];
}
function staffNames(list) {
  const m = { admin: "الإدارة", d0: "المندوب" };
  for (const s of list || []) m[s.id] = s.name;
  return m;
}
async function staffName(env, id) {
  if (!id) return "";
  if (id === "admin") return "الإدارة";
  const r = await env.DB.prepare("SELECT name FROM staff WHERE id = ?").bind(id).first();
  return r ? r.name : id === "d0" ? "المندوب" : "";
}

// ---------- نقاط البيع ----------
// الأسعار من المتجر نفسه (نفس أسعار الموقع). الكاشير ما يغيّر سعر ولا يعطي خصم؛ الإدارة بس.
function posSale(data, body, me) {
  const byId = {};
  for (const p of data.products || []) byId[p.id] = p;
  const lines = [], open = [];
  for (const x of Array.isArray(body.lines) ? body.lines.slice(0, 300) : []) {
    const q = Math.floor(Number(x && x.qty));
    if (!(q > 0 && q <= 999)) return { error: "bad_line" };
    if (x.id) {
      const p = byId[String(x.id)];
      if (!p) return { error: "bad_line" };
      let pr = Number(p.price);
      if (x.price != null && x.price !== "" && round2(Number(x.price)) !== round2(pr)) {
        if (me.role !== "admin") return { error: "price_locked" };
        pr = Number(x.price);
      }
      if (!(pr >= 0 && pr < 100000)) return { error: "bad_line" };
      const same = lines.find((l) => l.id === p.id && l.price === round2(pr));
      if (same) same.qty += q; else lines.push({ id: p.id, name: p.name, unit: p.unit || "", qty: q, price: round2(pr), tag: "" });
    } else {
      // صنف مو مسجّل في المتجر (باركود جديد): الكاشير يكتب اسمه وسعره، ويطلع للإدارة عشان تضيفه
      const name = String(x.name || "").trim().slice(0, 60) || "صنف", bc = String(x.bc || "").replace(/[^\w-]/g, "").slice(0, 40), pr = Number(x.price);
      if (!(pr > 0 && pr < 100000)) return { error: "bad_line" };
      lines.push({ id: "", name, unit: "", qty: q, price: round2(pr), tag: "صنف يدوي", bc });
      open.push({ bc, name, price: round2(pr), qty: q });
    }
  }
  if (!lines.length) return { error: "empty" };
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.price, 0));
  const disc = round2(Number(body.discount) || 0);
  if (disc < 0 || disc > subtotal) return { error: "bad_discount" };
  if (disc && me.role !== "admin") return { error: "price_locked" };
  const total = round2(subtotal - disc), pay = body.pay === "card" ? "card" : "cash";
  const paid = pay === "cash" ? round2(body.paid == null || body.paid === "" ? total : Number(body.paid)) : total;
  if (!(paid >= total - 0.001 && paid < 1e6)) return { error: "paid_short" };
  return { rec: {
    lines, subtotal, fee: 0, discount: disc, total, count: lines.reduce((s, l) => s + l.qty, 0), phone: "",
    name: "", details: "", note: "", pay, paid, change: round2(paid - total), src: "pos", source: "pos", cashier: me.name, st: 1,
  }, open };
}
function riyadhDayStart(ms) { const d = riyadhDateAt(ms); return Date.parse(d + "T00:00:00+03:00"); }
// الوردية: من آخر إقفال صندوق (أو من بداية اليوم)
async function readShift(env, cid, all) {
  const now = Date.now(), dayStart = riyadhDayStart(now);
  const last = all ? null : await env.DB.prepare("SELECT at FROM alog WHERE act = 'pos_close' AND ref = ? ORDER BY id DESC LIMIT 1").bind(cid).first();
  const since = last && last.at > now - 24 * 3600e3 ? last.at : dayStart;
  const rs = all
    ? await env.DB.prepare("SELECT no, created, total, pay, status, items, drv, data FROM orders WHERE src = 'pos' AND created >= ? ORDER BY no DESC LIMIT 1000").bind(since).all()
    : await env.DB.prepare("SELECT no, created, total, pay, status, items, drv, data FROM orders WHERE src = 'pos' AND created >= ? AND drv = ? ORDER BY no DESC LIMIT 1000").bind(since, cid).all();
  const rows = rs.results || [];
  const ok = rows.filter((r) => r.status !== "canceled");
  const sum = (a) => round2(a.reduce((s, r) => s + Number(r.total || 0), 0));
  const closes = await env.DB.prepare("SELECT at, who, info FROM alog WHERE act = 'pos_close' AND (? = '' OR ref = ?) ORDER BY id DESC LIMIT 10").bind(all ? "" : cid, all ? "" : cid).all();
  return {
    since, count: ok.length, total: sum(ok), cash: sum(ok.filter((r) => r.pay === "cash")), card: sum(ok.filter((r) => r.pay !== "cash")),
    canceled: rows.length - ok.length,
    sales: rows.slice(0, 60).map((r) => { const d = safeJson(r.data); return { no: "#" + (1000 + r.no), at: r.created, total: r.total, pay: r.pay, status: r.status, items: r.items, by: d.cashier || "", lines: (d.lines || []).map((l) => ({ name: l.name, qty: l.qty, price: l.price })), paid: d.paid, change: d.change, discount: d.discount || 0 }; }),
    closes: (closes.results || []).map((c) => ({ at: c.at, who: c.who, ...safeJson(c.info) })),
  };
}

// ---------- التكاليف التشغيلية ومستشار العروض ----------
const OPEX_FIELDS = [
  { k: "rent", g: "fixed", n: "إيجار المحل (شهرياً)" }, { k: "salaries", g: "fixed", n: "رواتب الموظفين والمناديب الثابتة (شهرياً)" },
  { k: "utilities", g: "fixed", n: "كهرباء وماء وإنترنت (شهرياً)" }, { k: "vehicles", g: "fixed", n: "سيارات: وقود وصيانة وتأمين (شهرياً)" },
  { k: "marketing", g: "fixed", n: "تسويق وإعلانات (شهرياً)" }, { k: "software", g: "fixed", n: "اشتراكات: دومين، خادم، تطبيقات (شهرياً)" },
  { k: "other", g: "fixed", n: "مصروفات ثانية: تراخيص، صيانة، متفرقات (شهرياً)" },
  { k: "driverPerOrder", g: "order", n: "تكلفة توصيل الطلب الواحد (أجرة مندوب، وقود)" }, { k: "packPerOrder", g: "order", n: "تغليف الطلب الواحد (أكياس، ثلج)" },
  { k: "cardFeePct", g: "pct", n: "عمولة الشبكة (% من مبلغ الدفع بالشبكة)" }, { k: "wastePct", g: "pct", n: "تلف وهالك (% من المبيعات)" },
  { k: "expectedOrders", g: "plan", n: "عدد الطلبات المتوقع شهرياً" }, { k: "expectedBasket", g: "plan", n: "متوسط قيمة الطلب المتوقع (ر.س)" },
];
function cleanOpex(src) {
  if (!src || typeof src !== "object") return null;
  const o = {};
  for (const f of OPEX_FIELDS) {
    const v = src[f.k];
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v), max = f.g === "pct" ? 100 : 1e7;
    if (!isFinite(n) || n < 0 || n > max) return null;
    o[f.k] = Math.round(n * 100) / 100;
  }
  if (src.repeatOrders !== undefined && src.repeatOrders !== "") { const r = Number(src.repeatOrders); if (!(r >= 1 && r <= 50)) return null; o.repeatOrders = Math.round(r * 10) / 10; }
  return o;
}
const opexMissing = (o) => OPEX_FIELDS.filter((f) => typeof o[f.k] !== "number" || ((f.k === "expectedOrders" || f.k === "expectedBasket") && !(o[f.k] > 0))).map((f) => f.k);
const opexFixed = (o) => OPEX_FIELDS.filter((f) => f.g === "fixed").reduce((s, f) => s + (Number(o[f.k]) || 0), 0);
async function readOpex(env) {
  const r = await env.DB.prepare("SELECT data FROM opex WHERE id = 1").first();
  return r ? safeJson(r.data) : {};
}
const to025 = (n) => Math.round(n * 4) / 4;
async function offersAdvice(env, data, o) {
  const S0 = data.store || {}, now = Date.now(), since = now - 30 * 864e5;
  const agg = (await env.DB.prepare("SELECT COUNT(*) n, IFNULL(SUM(total), 0) rev, IFNULL(SUM(fee), 0) fees, IFNULL(SUM(items), 0) items, IFNULL(SUM(CASE WHEN pay = 'card' THEN total ELSE 0 END), 0) card FROM orders WHERE status != 'canceled' AND src != 'pos' AND created > ?").bind(since).first()) || {};
  const lines = (await env.DB.prepare("SELECT l.id id, SUM(l.qty) qty, SUM(l.qty * l.price) rev, SUM(l.qty * l.cost) cost FROM oline l JOIN orders o ON o.no = l.no WHERE o.status != 'canceled' AND o.src != 'pos' AND o.created > ? GROUP BY l.id ORDER BY qty DESC LIMIT 600").bind(since).all()).results || [];
  const costRows = (await env.DB.prepare("SELECT id, cost FROM pcost").all()).results || [], cost = {}; for (const r of costRows) cost[r.id] = r.cost;
  const stock = await readStock(env), sold = {}; for (const l of lines) sold[l.id] = l;
  const hist = agg.n >= 15, warnings = [], assumptions = [];
  const fixed = opexFixed(o), ordersMonth = hist ? agg.n : o.expectedOrders;
  assumptions.push(hist ? `الطلبات: ${agg.n} آخر ٣٠ يوم (من سجل الطلبات)` : `الطلبات: ${o.expectedOrders} شهرياً (توقعك؛ السجل أقل من ١٥ طلب)`);
  const fee = hist ? agg.fees / agg.n : Number(S0.fee) || 0;
  let basket = hist ? Math.max(1, (agg.rev - agg.fees) / agg.n) : o.expectedBasket;
  assumptions.push(hist ? `متوسط السلة ${money(round2(basket))} (فعلي)` : `متوسط السلة ${money(round2(basket))} (توقعك)`);
  const withCost = lines.filter((l) => l.cost > 0), revAll = lines.reduce((s, l) => s + l.rev, 0), revCost = withCost.reduce((s, l) => s + l.rev, 0);
  let gmPct;
  if (hist && revAll > 0 && revCost / revAll >= 0.5) { gmPct = 1 - withCost.reduce((s, l) => s + l.cost, 0) / revCost; assumptions.push(`هامش الربح الإجمالي ${(gmPct * 100).toFixed(1)}٪ (فعلي)`); if (revCost / revAll < 0.9) warnings.push("تكلفة بعض المنتجات المباعة ناقصة، فالهامش الفعلي ممكن يكون أقل."); }
  else {
    const ms = (data.products || []).filter((p) => cost[p.id] > 0 && Number(p.price) > 0).map((p) => 1 - cost[p.id] / Number(p.price));
    if (!ms.length) return { ok: false, error: "no_costs" };
    ms.sort((a, b) => a - b); gmPct = ms[Math.floor(ms.length / 2)];
    assumptions.push(`هامش الربح ${(gmPct * 100).toFixed(1)}٪ (وسيط هوامش منتجاتك، ما فيه سجل كافي)`);
  }
  const cardShare = hist && agg.rev > 0 ? agg.card / agg.rev : 0.5;
  assumptions.push(`طلبات الشبكة ${(cardShare * 100).toFixed(0)}٪${hist ? " (فعلي)" : " (افتراض)"}`);
  const items = hist && agg.items > 0 ? agg.items / agg.n : 8;
  const pctVar = (o.cardFeePct / 100) * cardShare + o.wastePct / 100, fixedVarOrder = o.driverPerOrder + o.packPerOrder;
  const varOrder = fixedVarOrder + pctVar * (basket + fee);
  const gmOrder = basket * gmPct, contribution = gmOrder + fee - varOrder, fixedPerOrder = fixed / ordersMonth, net = contribution - fixedPerOrder;
  const eco = { orders30: agg.n, ordersMonth, basket: round2(basket), fee: round2(fee), gmPct: round2(gmPct * 100), gmOrder: round2(gmOrder), varOrder: round2(varOrder), contribution: round2(contribution), fixedMonthly: round2(fixed), fixedPerOrder: round2(fixedPerOrder), net: round2(net), netMonthly: round2(net * ordersMonth), breakEvenOrders: contribution > 0 ? Math.ceil(fixed / contribution) : null, items: round2(items), history: hist };
  const unitVar = (price) => price * pctVar + fixedVarOrder / items;
  const unitNet = (price, c) => round2(price - c - unitVar(price));
  const repeat = o.repeatOrders || 3, budget = Math.max(0, round2(contribution * repeat)); // أقصى خسارة نتحملها لجلب زبون جديد
  eco.acquisitionBudget = budget; eco.repeatOrders = repeat;
  const monthlyBudget = net > 0 ? round2(net * ordersMonth * 0.3) : 0; eco.offersBudgetMonthly = monthlyBudget;
  const byId = {}; for (const p of data.products || []) byId[p.id] = p;
  const verdictOf = (nu, lim) => nu >= 0 ? "safe" : -nu * (lim || 1) <= budget ? "bait" : "loss"; // الخسارة × أقصى كمية للطلب مقابل ميزانية جلب الزبون
  // عروض المتجر الحالية
  const cur = [], seen = {};
  const addCur = (p, price, kind, extra) => { if (!p || seen[kind + p.id]) return; seen[kind + p.id] = 1; const c = cost[p.id]; if (!(c > 0)) { cur.push({ id: p.id, name: p.name, kind, price: round2(price), regular: Number(p.price), noCost: true }); return; } const nu = unitNet(price, c); cur.push({ id: p.id, name: p.name, kind, price: round2(price), regular: Number(p.price), cost: round2(c), unitNet: nu, marginPct: round2(((price - c) / price) * 100), verdict: verdictOf(nu, extra && extra.limit), ...extra }); };
  if (S0.deal95 && S0.deal95.on) for (const id of S0.deal95.ids || []) addCur(byId[id], Number(S0.deal95.price) || 0.95, "deal", { limit: Number(S0.deal95.limit) || 1 });
  if (S0.daily && S0.daily.on) for (const x of S0.daily.list || []) addCur(byId[x.id], Number(x.price), "daily", { limit: Number(S0.daily.limit) || 1 });
  for (const p of data.products || []) if (Number(p.old) > Number(p.price)) addCur(p, Number(p.price), "sale", {});
  // عرض «كل منتج بسعر موحد»: أسوأ حالة للطلب الواحد (كل المنتجات بأقصى كمية) مقابل ربح الحد الأدنى للسلة اللي يفتحه
  let dealSummary = null;
  if (S0.deal95 && S0.deal95.on) {
    const ds = cur.filter((x) => x.kind === "deal" && !x.noCost), minB = Number(S0.deal95.min) || 0;
    const worst = round2(ds.reduce((t, x) => t + Math.max(0, -x.unitNet) * (x.limit || 1), 0)), cover = round2(minB * gmPct - (fixedVarOrder + pctVar * minB));
    dealSummary = { products: ds.length, price: Number(S0.deal95.price) || 0.95, minBasket: minB, worstLoss: worst, marginAtMin: cover, covered: cover >= worst };
  }
  // اقتراحات: الأكثر حركة (مبيعات ٣٠ يوم، وإلا المخزون) والهامش يسمح
  const cands = (data.products || []).filter((p) => cost[p.id] > 0 && Number(p.price) > 0 && p.stock !== false).map((p) => {
    const price = Number(p.price), c = cost[p.id], sl = sold[p.id], vel = sl ? sl.qty : 0, stk = stock[p.id] || 0;
    return { p, price, c, vel, stk, nu: unitNet(price, c) };
  }).sort((a, b) => (b.vel - a.vel) || (b.stk - a.stk));
  const safe = [], strong = [];
  for (const x of cands) {
    if (safe.length < 12 && x.nu > 0.25) {
      const cut = Math.min(0.12 * x.price, 0.4 * x.nu), np = to025(x.price - cut);
      if (np < x.price && x.price - np >= 0.25 && unitNet(np, x.c) >= 0) safe.push({ id: x.p.id, name: x.p.name, price: x.price, offer: np, unitNet: unitNet(np, x.c), cut: round2(x.price - np), vel: x.vel });
    }
    if (strong.length < 6 && budget > 0 && x.price >= 2) {
      const be = to025(x.c + unitVar(x.c) / (1 - pctVar)), lossAllowed = Math.min(budget / 2, 0.25 * x.price), bait = Math.max(0.25, to025(be - lossAllowed));
      if (bait < x.price) strong.push({ id: x.p.id, name: x.p.name, price: x.price, cost: round2(x.c), breakEven: be, offer: bait, unitNet: unitNet(bait, x.c), vel: x.vel });
    }
  }
  // التوصيل المجاني: أقل سلة تغطي تكلفة التوصيل بدون رسوم
  const den = gmPct - pctVar, minFree = den > 0 ? round2(fixedVarOrder / den) : null;
  const free = { freeOver: Number(S0.freeOver) || 0, fee: Number(S0.fee) || 0, minBasket: minFree, safe: minFree != null && (Number(S0.freeOver) || 0) >= minFree, suggested: minFree != null ? Math.ceil((minFree * 1.15) / 5) * 5 : null };
  if (net < 0) warnings.push(`حالياً كل طلب يخسر ${money(round2(-net))} بعد المصروفات الثابتة. تحتاج ${eco.breakEvenOrders == null ? "رفع الهامش" : "تقريباً " + eco.breakEvenOrders + " طلب شهرياً"} عشان تغطي مصروفاتك، فركّز على عروض آمنة بس.`);
  if (S0.freeOver > 0 && minFree != null && S0.freeOver < minFree) warnings.push(`التوصيل المجاني فوق ${S0.freeOver} ر.س يخسر: أقل سلة تغطي التوصيل بدون رسوم حوالي ${money(minFree)}.`);
  if (dealSummary && !dealSummary.covered) warnings.push(`عرض «كل منتج بـ ${dealSummary.price}» خطر: أسوأ طلب يخسر ${money(dealSummary.worstLoss)} وربح الحد الأدنى للسلة (${dealSummary.minBasket} ر.س) ${money(dealSummary.marginAtMin)} بس.`);
  return { eco, assumptions, warnings, current: cur, safe, strong, freeDelivery: free, dealSummary };
}

// ---------- Staff accounts and overdue orders ----------
const staffSchemas = new WeakSet();
async function ensureStaffSchema(env) {
  if (staffSchemas.has(env.DB)) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS staff_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('manager','orders','preparer','cashier')), active INTEGER NOT NULL DEFAULT 1, password_hash TEXT NOT NULL, salt TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS staff_sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS staff_session_user ON staff_sessions(user_id)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS staff_pins (user_id INTEGER PRIMARY KEY, pin_hash TEXT NOT NULL UNIQUE)"),
  ]);
  const definition = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'staff_users'").first();
  if (!definition.sql.includes("'cashier'")) await env.DB.batch([
    env.DB.prepare("CREATE TABLE staff_users_next (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('manager','orders','preparer','cashier')), active INTEGER NOT NULL DEFAULT 1, password_hash TEXT NOT NULL, salt TEXT NOT NULL)"),
    env.DB.prepare("INSERT INTO staff_users_next SELECT * FROM staff_users"), env.DB.prepare("DROP TABLE staff_users"), env.DB.prepare("ALTER TABLE staff_users_next RENAME TO staff_users")
  ]);
  staffSchemas.add(env.DB);
}
function randomHex(n) { return Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join(''); }
async function tokenHash(token) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2, '0')).join(''); }
async function staffPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}
async function staffPinHash(env, pin) { return hashPin(env, "staff:" + pin); }
async function openStaffSession(env, user) {
  const token = randomHex(32), expires = Date.now() + 8 * 3600e3;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM staff_sessions WHERE expires <= ?").bind(Date.now()),
    env.DB.prepare("INSERT INTO staff_sessions (token_hash, user_id, expires) VALUES (?, ?, ?)").bind(await tokenHash(token), user.id, expires),
  ]);
  return { token, expires, user: publicStaff(user) };
}
// كل رقم سري لازم يكون لشخص واحد بس، عشان الرقم نفسه يحدد صاحبه في الدخول الموحد
async function pinTaken(env, pin, self) {
  self = self || {};
  if (!self.owner && await checkPin(env, pin)) return true;
  if (!env.DB) return false;
  await ensureSchema(env);
  if (await env.DB.prepare("SELECT id FROM staff WHERE pin = ? AND active = 1 AND id != ?").bind(await staffHash(env, pin), self.staff || "").first()) return true;
  await ensureStaffSchema(env);
  return !!(await env.DB.prepare("SELECT user_id FROM staff_pins WHERE pin_hash = ? AND user_id != ?").bind(await staffPinHash(env, pin), Number(self.user) || 0).first());
}
function publicStaff(u) { return { id: u.id, username: u.username, name: u.name, role: u.role }; }
function staffMay(role, path, body) {
  if (path === '/admin/staff' || path === '/admin/staff-save' || path === '/admin/team-save' || path === '/admin/apns-key' || path === '/admin/opex' || path === '/admin/opex-save' || path === '/admin/offers-advice') return false;
  if(role==='cashier')return ['/pos/login','/pos/delivery-orders','/pos/delivery-receipt','/pos/delivery-issue','/login','/admin/pos-orders','/admin/pos-receipt','/admin/pos-issue','/admin/settlement-requests','/admin/settlement-confirm','/admin/payment','/admin/day-report'].includes(path);
  if (role === 'preparer') return ['/login','/admin/prep','/admin/prep-save','/admin/prep-sub','/push/sub'].includes(path);
  if (role === 'manager') return !(path === '/save' && (body.newPin || body.newDriverPin));
  return role === 'orders' && ['/login', '/admin/orders', '/admin/alerts', '/driver/status', '/driver/pending', '/admin/assign', '/admin/team', '/pos/login', '/pos/sale', '/pos/shift', '/pos/close', '/pos/delivery-orders', '/pos/delivery-receipt', '/pos/delivery-issue'].includes(path);
}
function withoutCosts(value) {
  if (Array.isArray(value)) return value.map(withoutCosts);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !['cost', 'costs', 'profit'].includes(k)).map(([k,v]) => [k, withoutCosts(v)]));
}
function orderDelay(o, now) {
  const limit = { new: 10, accepted: 30, onway: 45 }[o.status];
  const elapsed = Math.max(0, now - (o.stageStarted ?? (o.status === 'new' ? o.created : o.updated)));
  return { late: !!limit && elapsed >= limit * 60000, waitingMinutes: Math.floor(elapsed / 60000), limitMinutes: limit || 0 };
}

// All monetary balances below use integer halalas. Sales and collection remain separate.
const operationSchemas = new WeakSet();
async function ensureOperations(env) {
  if(operationSchemas.has(env.DB)) return;
  await env.DB.batch([
    "CREATE TABLE IF NOT EXISTS pos_receipts(id INTEGER PRIMARY KEY AUTOINCREMENT,no INTEGER NOT NULL,revision INTEGER NOT NULL,fingerprint TEXT NOT NULL,document TEXT NOT NULL,issued INTEGER NOT NULL,who TEXT NOT NULL,UNIQUE(no,revision))",
    "CREATE TABLE IF NOT EXISTS pos_settings(id INTEGER PRIMARY KEY CHECK(id=1),require_receipt INTEGER NOT NULL DEFAULT 0)",
    "INSERT OR IGNORE INTO pos_settings(id,require_receipt) VALUES(1,0)",
    "CREATE TABLE IF NOT EXISTS driver_settlements(day TEXT PRIMARY KEY,requested_at INTEGER NOT NULL,who TEXT NOT NULL,expected INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','confirmed')),revision INTEGER NOT NULL,actual INTEGER,confirmed_at INTEGER,confirmed_by TEXT,note TEXT)",
    "CREATE TABLE IF NOT EXISTS payment_splits(no INTEGER PRIMARY KEY,cash INTEGER NOT NULL CHECK(cash>=0),card INTEGER NOT NULL CHECK(card>=0),wallet INTEGER NOT NULL CHECK(wallet>=0),revision INTEGER NOT NULL,at INTEGER NOT NULL,who TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS wallet_order_keys(request_id TEXT PRIMARY KEY,no INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS checkout_keys(request_id TEXT PRIMARY KEY,no INTEGER NOT NULL,fingerprint TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS delivery_times(no INTEGER PRIMARY KEY,at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS app_settings(k TEXT PRIMARY KEY,v TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS late_alerts(no INTEGER PRIMARY KEY,at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS collection_changes(id INTEGER PRIMARY KEY AUTOINCREMENT,request_id TEXT UNIQUE NOT NULL,no INTEGER NOT NULL,at INTEGER NOT NULL,who TEXT NOT NULL,note TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS day_closures(day TEXT PRIMARY KEY,at INTEGER NOT NULL,who TEXT NOT NULL,expected INTEGER NOT NULL,actual INTEGER NOT NULL,cash_total INTEGER NOT NULL,card_total INTEGER NOT NULL,wallet_total INTEGER NOT NULL,sales INTEGER NOT NULL,orders INTEGER NOT NULL,note TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS prep_orders(no INTEGER PRIMARY KEY,stage TEXT NOT NULL CHECK(stage IN ('preparing','ready')),checks TEXT NOT NULL,updated INTEGER NOT NULL,who TEXT NOT NULL,version INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS wallets(phone TEXT PRIMARY KEY,balance INTEGER NOT NULL DEFAULT 0,password_hash TEXT,salt TEXT)",
    "CREATE TABLE IF NOT EXISTS wallet_sessions(token_hash TEXT PRIMARY KEY,phone TEXT NOT NULL,expires INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS wallet_ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,request_id TEXT UNIQUE NOT NULL,phone TEXT NOT NULL,delta INTEGER NOT NULL,kind TEXT NOT NULL,no INTEGER,at INTEGER NOT NULL,who TEXT NOT NULL,note TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS cashback_policy(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL,basis_points INTEGER NOT NULL,cap INTEGER NOT NULL)",
    "INSERT OR IGNORE INTO cashback_policy VALUES(1,0,0,0)",
    "CREATE TABLE IF NOT EXISTS cashback_awards(no INTEGER PRIMARY KEY,amount INTEGER NOT NULL,phone TEXT NOT NULL,basis_points INTEGER NOT NULL,cap INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS wallet_history ON wallet_ledger(phone,id)",
  ].map(q=>env.DB.prepare(q)));
  operationSchemas.add(env.DB);
}
function moneyCents(value) {
  if(typeof value==='boolean'||value===null||typeof value==='object')return null;
  const n=Number(value); if(!Number.isFinite(n)||n<0||n>1e7)return null;
  const cents=Math.round(n*100);return Math.abs(n*100-cents)>1e-6?null:cents;
}
function operationId(body){return typeof body.requestId==='string'&&/^[a-zA-Z0-9_-]{12,100}$/.test(body.requestId)?body.requestId:null;}
function paymentOf(row,split){return split||{cash:row.pay==='cash'?moneyCents(row.total):0,card:row.pay==='card'?moneyCents(row.total):0,wallet:0,revision:0};}
function paymentStatement(env,no,payment,revision,who){return env.DB.prepare('INSERT INTO payment_splits(no,cash,card,wallet,revision,at,who) VALUES(?,?,?,?,?,?,?) ON CONFLICT(no) DO UPDATE SET cash=excluded.cash,card=excluded.card,wallet=excluded.wallet,revision=excluded.revision,at=excluded.at,who=excluded.who').bind(no,payment.cash,payment.card,payment.wallet,revision,Date.now(),who);}
function walletMove(env,phone,delta,kind,no,who,note,requestId,allowDebt=false){
  const P=(q,...a)=>env.DB.prepare(q).bind(...a);
  const statements=[P('INSERT OR IGNORE INTO wallets(phone,balance) VALUES(?,0)',phone)];
  if(delta<0&&!allowDebt)statements.push(P("SELECT CASE WHEN balance < ? THEN json('wallet_balance') ELSE 1 END FROM wallets WHERE phone=?",-delta,phone));
  statements.push(P('UPDATE wallets SET balance=balance+? WHERE phone=?',delta,phone),P('INSERT INTO wallet_ledger(request_id,phone,delta,kind,no,at,who,note) VALUES(?,?,?,?,?,?,?,?)',requestId,phone,delta,kind,no,Date.now(),who,note));return statements;
}
async function walletSession(env,token){
  if(!token||!/^[a-f0-9]{64}$/.test(String(token)))return null;
  await ensureOperations(env);
  return env.DB.prepare('SELECT w.phone,w.balance FROM wallet_sessions s JOIN wallets w ON w.phone=s.phone WHERE s.token_hash=? AND s.expires>?').bind(await tokenHash(token),Date.now()).first();
}
async function cashbackStatements(env,no,rec,payment,delivered,who,firstDelivery=false){
  const prior=await env.DB.prepare('SELECT * FROM cashback_awards WHERE no=?').bind(no).first();
  const policy=prior||(firstDelivery?await env.DB.prepare('SELECT * FROM cashback_policy WHERE id=1').first():{enabled:0,basis_points:0,cap:0});
  const rate=prior?prior.basis_points:policy.enabled?policy.basis_points:0, cap=policy.cap;
  const phone=prior?.phone||normPhone(rec.phone); if(!phone)return [];
  const base=Math.max(0,payment.cash+payment.card-(moneyCents(rec.fee)||0));
  const target=delivered?Math.min(cap,Math.floor(base*rate/10000)):0;
  const delta=target-(prior?.amount||0), statements=[];
  if(delta)statements.push(...walletMove(env,phone,delta,delta>0?'cashback':'cashback_reversal',no,who,'تسوية كاش باك',randomHex(16),true));
  statements.push(env.DB.prepare('INSERT INTO cashback_awards(no,amount,phone,basis_points,cap) VALUES(?,?,?,?,?) ON CONFLICT(no) DO UPDATE SET amount=excluded.amount').bind(no,target,phone,rate,cap));return statements;
}
async function statusFinance(env,no,oldStatus,newStatus,rec,who,now){
  const split=await env.DB.prepare('SELECT * FROM payment_splits WHERE no=?').bind(no).first();const p=paymentOf(rec,split), st=[env.DB.prepare("SELECT CASE WHEN COALESCE((SELECT revision FROM payment_splits WHERE no=?),0) != ? THEN json('payment_conflict') ELSE 1 END").bind(no,split?.revision||0)];
  if(p.wallet && (oldStatus==='canceled')!==(newStatus==='canceled')){
    const phone=await walletOrderPhone(env,no,rec.phone);if(!phone)throw Error('wallet_phone');
    st.push(...walletMove(env,phone,newStatus==='canceled'?p.wallet:-p.wallet,newStatus==='canceled'?'refund':'payment',no,who,'تغيير حالة الطلب',randomHex(16)));
  }
  if(newStatus==='delivered'){
    st.push(env.DB.prepare('INSERT INTO delivery_times(no,at) VALUES(?,?) ON CONFLICT(no) DO UPDATE SET at=excluded.at').bind(no,now));
    if(!split)st.push(paymentStatement(env,no,p,1,who));
  }
  if(oldStatus==='delivered'||newStatus==='delivered')st.push(...await cashbackStatements(env,no,rec,p,newStatus==='delivered',who,newStatus==='delivered'));
  return st;
}
async function dayReport(env,day,drvId){
  const dq=drvId!=null?" AND IFNULL(o.drv,'')=?":"", dargs=drvId!=null?[drvId]:[];
  const valid=/^\d{4}-\d{2}-\d{2}$/.test(day)&&!isNaN(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;if(!valid)return null;
  const rows=(await env.DB.prepare("SELECT o.no,o.total,o.pay,o.data,COALESCE(d.at,o.updated) delivered_at,p.cash,p.card,p.wallet FROM orders o LEFT JOIN payment_splits p ON p.no=o.no LEFT JOIN delivery_times d ON d.no=o.no WHERE o.status='delivered' AND date((COALESCE(d.at,o.updated)+10800000)/1000,'unixepoch')=?"+dq+" ORDER BY delivered_at DESC").bind(day,...dargs).all()).results||[];
  const report={day,count:rows.length,sales:0,cash:0,card:0,wallet:0,orders:[]};
  for(const r of rows){const p=paymentOf(r,r.cash==null?null:r);report.sales+=moneyCents(r.total);report.cash+=p.cash;report.card+=p.card;report.wallet+=p.wallet;report.orders.push({no:'#'+(1000+r.no),total:r.total,at:r.delivered_at,cash:p.cash,card:p.card,wallet:p.wallet});}
  const transfers=drvId!=null?await env.DB.prepare("SELECT COALESCE(SUM(amount),0) n FROM cash WHERE day=? AND drv=?").bind(day,drvId).first():await env.DB.prepare('SELECT COALESCE(SUM(amount),0) n FROM cash WHERE day=?').bind(day).first();
  const rewards=await env.DB.prepare("SELECT COALESCE(SUM(a.amount),0) n FROM cashback_awards a JOIN orders o ON o.no=a.no LEFT JOIN delivery_times d ON d.no=o.no WHERE o.status='delivered' AND date((COALESCE(d.at,o.updated)+10800000)/1000,'unixepoch')=?").bind(day).first();report.cashback=rewards.n;
  report.received=Math.round(transfers.n*100);report.outstanding=report.cash-report.received;
  report.closure=await env.DB.prepare('SELECT * FROM day_closures WHERE day=?').bind(day).first()||null;
  report.adjustment=report.closure?report.cash-report.closure.cash_total:0;report.adjustments=report.closure?{cash:report.adjustment,card:report.card-report.closure.card_total,wallet:report.wallet-report.closure.wallet_total,sales:report.sales-report.closure.sales,count:report.count-report.closure.orders}:{cash:0,card:0,wallet:0,sales:0,count:0};return report;
}
async function operationsRoute(env,path,body,who,role,later=(p)=>p){
  const fail=(code,status=400)=>({ok:false,code,status});const P=(q,...a)=>env.DB.prepare(q).bind(...a);
  if(path.startsWith('/admin/pos-'))return posRoute(env,path,body,who,role);
  if(path==='/admin/settlement-requests'){
    const nm=staffNames(await staffList(env,'driver'));
    const requests=((await P('SELECT * FROM driver_settlements2 ORDER BY day DESC, requested_at DESC LIMIT 30').all()).results||[]).map((r)=>({...r,drvName:nm[r.drv]||r.drv}));
    return {ok:true,cash:await readCash(env),requests};
  }
  if(path==='/admin/settlement-confirm'){
    const did=body.drv?String(body.drv):(await soleDriver(env))||((await P('SELECT drv FROM driver_settlements2 WHERE day=? ORDER BY requested_at DESC LIMIT 1',String(body.day||'')).first())||{}).drv||'d0';
    const request=await P('SELECT * FROM driver_settlements2 WHERE day=? AND drv=?',String(body.day||''),did).first();
    if(!request)return fail('not_found',404);
    if(request.state==='confirmed')return {ok:true,repeated:true};
    if(Number(body.revision)!==request.revision)return fail('conflict',409);
    const actual=moneyCents(body.actual),note=String(body.note||'').trim().slice(0,200);
    if(actual===null)return fail('bad_amount');
    if(actual!==request.expected&&!note)return fail('reason_required');
    const cash=await readCash(env,did),snapshot=Math.round(cash.balance*100),soloC=await soleDriver(env);
    // رصيد هالمندوب لازم ما يتغير بين القراءة والتأكيد (طلب انوصّل أو استلام انسجّل بنفس اللحظة)
    const guard=P("SELECT CASE WHEN (SELECT state FROM driver_settlements2 WHERE day=? AND drv=?)!='pending' OR (SELECT revision FROM driver_settlements2 WHERE day=? AND drv=?)!=? OR ((SELECT COALESCE(SUM(COALESCE(p.cash,CASE WHEN o.pay='cash' THEN CAST(ROUND(o.total*100) AS INTEGER) ELSE 0 END)),0) FROM orders o LEFT JOIN payment_splits p ON p.no=o.no LEFT JOIN delivery_times d ON d.no=o.no WHERE o.status='delivered' AND (?=1 OR IFNULL(o.drv,'')=?) AND COALESCE(d.at,o.updated)>=COALESCE((SELECT MIN(at) FROM cash WHERE amount=0 AND who='النظام' AND note='بداية الحساب'),0))-(SELECT CAST(ROUND(COALESCE(SUM(amount),0)*100) AS INTEGER) FROM cash WHERE (?=1 OR drv=?)))!=? THEN json('settlement_conflict') ELSE 1 END",request.day,did,request.day,did,request.revision,soloC?1:0,did,soloC?1:0,did,snapshot);
    try{await env.DB.batch([guard,P('INSERT INTO cash(at,day,who,amount,note,drv) VALUES(?,?,?,?,?,?)',Date.now(),riyadhDate(),who,actual/100,'تسوية المندوب ليوم '+request.day+(note?' — '+note:''),did),P("UPDATE driver_settlements2 SET state='confirmed',actual=?,confirmed_at=?,confirmed_by=?,note=? WHERE day=? AND drv=?",actual,Date.now(),who,note,request.day,did),logStmt(env,who,'driver_settlement',request.day,{expected:request.expected,actual,difference:actual-request.expected})]);}catch{return fail('conflict',409);}
    return {ok:true,difference:actual-request.expected};
  }
  if(path==='/admin/payment'){
    const no=Number(String(body.no||'').replace(/\D/g,''))-1000;
    const row=await P('SELECT * FROM orders WHERE no=?',no).first();if(!row)return fail('not_found',404);
    const old=await P('SELECT * FROM payment_splits WHERE no=?',no).first();const current=paymentOf(row,old);
    const history=(await P('SELECT at,who,note,before_json,after_json FROM collection_changes WHERE no=? ORDER BY id DESC LIMIT 30',no).all()).results||[];
    if(!body.save)return {ok:true,payment:current,total:moneyCents(row.total),history};
    const id=operationId(body),note=String(body.note||'').trim().slice(0,200);if(!id||!note)return fail('reason_required');
    const repeated=await P('SELECT no,after_json FROM collection_changes WHERE request_id=?',id).first();
    if(repeated){const actual=safeJson(repeated.after_json);return repeated.no===no&&actual.cash===moneyCents(body.cash)&&actual.card===moneyCents(body.card)&&actual.wallet===moneyCents(body.wallet)?{ok:true,repeated:true}:fail('conflict',409);}
    if(row.status!=='delivered')return fail('not_delivered');
    const next={cash:moneyCents(body.cash),card:moneyCents(body.card),wallet:moneyCents(body.wallet)};
    if(Object.values(next).some(v=>v===null)||next.cash+next.card+next.wallet!==moneyCents(row.total))return fail('payment_total');
    if(Number(body.revision)!==current.revision)return fail('conflict',409);
    const rec=safeJson(row.data),phone=await walletOrderPhone(env,no,row.phone);if(next.wallet!==current.wallet&&!phone)return fail('wallet_phone');
    const statements=[P("SELECT CASE WHEN COALESCE((SELECT revision FROM payment_splits WHERE no=?),0) != ? OR (SELECT status FROM orders WHERE no=?) != 'delivered' THEN json('payment_conflict') ELSE 1 END",no,current.revision,no)];
    const delta=current.wallet-next.wallet;
    if(delta<0){const balance=await P('SELECT balance FROM wallets WHERE phone=?',phone).first();if(!balance||balance.balance < -delta)return fail('wallet_balance',409);}
    if(delta)statements.push(...walletMove(env,phone,delta,delta<0?'payment':'refund',no,who,note,'pay_'+id));
    statements.push(paymentStatement(env,no,next,current.revision+1,who),P('INSERT INTO collection_changes(request_id,no,at,who,note,before_json,after_json) VALUES(?,?,?,?,?,?,?)',id,no,Date.now(),who,note,JSON.stringify(current),JSON.stringify(next)),...await cashbackStatements(env,no,rec,next,true,who));
    try{await env.DB.batch(statements);}catch(e){return fail(String(e.message).includes('wallet_balance')?'wallet_balance':'conflict',409);}
    return {ok:true,payment:{...next,revision:current.revision+1}};
  }
  if(path==='/admin/day-report'||path==='/admin/day-close'){
    const day=String(body.day||riyadhDate()),report=await dayReport(env,day);if(!report)return fail('bad_day');
    if(path==='/admin/day-report')return {ok:true,...report};
    if(day>riyadhDate())return fail('future_day');
    if(report.closure)return fail('already_closed',409);
    const actual=moneyCents(body.actual),note=String(body.note||'').trim().slice(0,200);if(actual===null||!note)return fail('bad_amount');
    if(Number(body.expected)!==report.outstanding)return fail('conflict',409);
    // أكثر من مندوب: الاستلام ينسجل لكل مندوب لحاله، والمجموع لازم يساوي المبلغ
    const parts=Array.isArray(body.parts)?body.parts.slice(0,20).map((p)=>({drv:String(p&&p.drv||''),c:moneyCents(p&&p.amount)})):null;
    if(parts&&(parts.some((p)=>p.c===null||!p.drv)||parts.reduce((v,p)=>v+p.c,0)!==actual))return fail('bad_amount');
    const receipts=parts&&parts.some((p)=>p.c)?parts.filter((p)=>p.c).map((p)=>P('INSERT INTO cash(at,day,who,amount,note,drv) VALUES(?,?,?,?,?,?)',Date.now(),day,who,p.c/100,'إقفال اليوم: '+note,p.drv)):[P('INSERT INTO cash(at,day,who,amount,note) VALUES(?,?,?,?,?)',Date.now(),day,who,actual/100,'إقفال اليوم: '+note)];
    const snapshotGuard=P("SELECT CASE WHEN (SELECT COALESCE(SUM(COALESCE(p.cash,CASE WHEN o.pay='cash' THEN CAST(ROUND(o.total*100) AS INTEGER) ELSE 0 END)),0) FROM orders o LEFT JOIN payment_splits p ON p.no=o.no LEFT JOIN delivery_times d ON d.no=o.no WHERE o.status='delivered' AND date((COALESCE(d.at,o.updated)+10800000)/1000,'unixepoch')=?) != ? OR (SELECT CAST(ROUND(COALESCE(SUM(amount),0)*100) AS INTEGER) FROM cash WHERE day=?) != ? THEN json('closure_conflict') ELSE 1 END",day,report.cash,day,report.received);
    try{await env.DB.batch([snapshotGuard,P('INSERT INTO day_closures(day,at,who,expected,actual,cash_total,card_total,wallet_total,sales,orders,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',day,Date.now(),who,report.outstanding,actual,report.cash,report.card,report.wallet,report.sales,report.count,note),...receipts]);}catch{return fail('conflict',409);}
    return {ok:true,difference:actual-report.outstanding};
  }
  if(path==='/admin/prep-mode'){
    if(role==='preparer')return fail('forbidden',403);
    if(body.mode!==undefined||body.lateMin!==undefined){
      const st0=await prepSettings(env),ops=[];
      if(body.mode!==undefined){if(!['on','off','auto'].includes(body.mode))return fail('bad_request');ops.push(body.mode==='auto'?P("DELETE FROM app_settings WHERE k='prep_mode'"):P("INSERT INTO app_settings(k,v) VALUES('prep_mode',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",body.mode));}
      if(body.lateMin!==undefined){const m=Math.floor(Number(body.lateMin));if(!(m>=3&&m<=60))return fail('bad_request');ops.push(P("INSERT INTO app_settings(k,v) VALUES('prep_late_min',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",String(m)));}
      ops.push(logStmt(env,who,'prep_mode','',{mode:body.mode??st0.mode,lateMin:body.lateMin??st0.lateMin}));
      await env.DB.batch(ops);
    }
    const st=await prepSettings(env);return {ok:true,mode:st.mode,on:st.on,preparers:st.preparers,lateMin:st.lateMin};
  }
  if(path==='/admin/prep'){
    later(lateCheck(env));
    const rows=(await P("SELECT o.no,o.status,o.created,o.updated AS order_updated,o.data,p.stage,p.checks,p.updated,p.who,p.version FROM orders o LEFT JOIN prep_orders p ON p.no=o.no WHERE o.status IN ('new','accepted') ORDER BY o.created").all()).results||[];
    const nos=rows.map(r=>r.no),offs=nos.length?((await P('SELECT id,no,line_id,to_id,state,created,answered FROM sub_offers WHERE no IN ('+nos.map(()=>'?').join(',')+') ORDER BY id',...nos).all()).results||[]):[],om={};for(const x of offs)(om[x.no]||=[]).push({id:x.id,line:x.line_id,to:x.to_id,state:x.state,at:x.answered||x.created});
    const lm=(await prepSettings(env)).lateMin;
    return {ok:true,lateMin:lm,orders:rows.map(r=>{const d=safeJson(r.data);return {no:'#'+(1000+r.no),status:r.status,created:r.created,orderUpdated:r.order_updated,stage:r.stage||'waiting',checks:safeJson(r.checks||'{}'),version:r.version||0,who:r.who||'',updated:r.updated,lines:(d.lines||[]).map((l,i)=>({key:String(i),id:l.id,name:l.name,unit:l.unit,qty:l.qty})),note:d.note||'',sub:d.sub||'call',subs:om[r.no]||[]};})};
  }
  if(path==='/admin/prep-sub'){const r=await prepSub(env,body,who,later);return r.ok?r:fail(r.code,r.status||400);}
  if(path==='/admin/prep-save'){
    const no=Number(String(body.no||'').replace(/\D/g,''))-1000,row=await P('SELECT status,data,updated FROM orders WHERE no=?',no).first();
    if(!row)return fail('not_found',404);if(!['new','accepted'].includes(row.status))return fail('closed');if(Number(body.orderUpdated)!==row.updated)return fail('conflict',409);
    if(!['preparing','ready'].includes(body.stage))return fail('bad_stage');
    const prior=await P('SELECT * FROM prep_orders WHERE no=?',no).first();if((prior?.version||0)!==Number(body.version))return fail('conflict',409);
    const lines=safeJson(row.data).lines||[],checks={};let complete=true;
    lines.forEach((l,i)=>{const v=body.checks?.[String(i)];if(['picked','missing'].includes(v))checks[String(i)]=v;if(v!=='picked')complete=false;});
    if(body.stage==='ready'&&!complete)return fail('missing_items');
    try{await env.DB.batch([P("SELECT CASE WHEN COALESCE((SELECT version FROM prep_orders WHERE no=?),0) != ? OR (SELECT status FROM orders WHERE no=?) NOT IN ('new','accepted') OR (SELECT updated FROM orders WHERE no=?) != ? THEN json('prep_conflict') ELSE 1 END",no,prior?.version||0,no,no,row.updated),P('INSERT INTO prep_orders(no,stage,checks,updated,who,version) VALUES(?,?,?,?,?,?) ON CONFLICT(no) DO UPDATE SET stage=excluded.stage,checks=excluded.checks,updated=excluded.updated,who=excluded.who,version=excluded.version',no,body.stage,JSON.stringify(checks),Date.now(),who,(prior?.version||0)+1),logStmt(env,who,'prep','#'+(1000+no),{stage:body.stage,missing:Object.values(checks).filter(v=>v==='missing').length})]);}catch{return fail('conflict',409);}
    if(body.stage==='ready'&&prior?.stage!=='ready'){const d=safeJson(row.data),drvId=(await P('SELECT drv FROM orders WHERE no=?',no).first())?.drv||null;
      later(notifyRole(env,'driver',drvId&&drvId!=='admin'?drvId:null,{title:'طلب جاهز للتوصيل #'+(1000+no),body:[d.name,d.details,money(d.total)].filter(Boolean).join(' · '),url:'./#driver',tag:'ready'+no}));}
    return {ok:true};
  }
  if(path==='/admin/cashback'){
    if(body.save){const rate=Number(body.rate),cap=moneyCents(body.cap);if(!Number.isFinite(rate)||rate<0||rate>25||Math.abs(Math.round(rate*100)-rate*100)>1e-6||cap===null)return fail('bad_policy');
      await env.DB.batch([P('UPDATE cashback_policy SET enabled=?,basis_points=?,cap=? WHERE id=1',body.enabled?1:0,Math.round(rate*100),cap),logStmt(env,who,'cashback_policy','',{rate,cap,enabled:!!body.enabled})]);}
    return {ok:true,policy:await P('SELECT * FROM cashback_policy WHERE id=1').first()};
  }
  if(path.startsWith('/admin/wallet')){
    const phone=normPhone(body.phone);if(!phone)return fail('bad_phone');
    if(path==='/admin/wallet-account'){
      const password=String(body.password||'');if(!/^\d{6,12}$/.test(password) && (password.length<10||password.length>128))return fail('bad_password');
      const salt=randomHex(16);await env.DB.batch([P('INSERT INTO wallets(phone,balance,password_hash,salt) VALUES(?,0,?,?) ON CONFLICT(phone) DO UPDATE SET password_hash=excluded.password_hash,salt=excluded.salt',phone,await staffPassword(password,salt),salt),P('DELETE FROM wallet_sessions WHERE phone=?',phone),logStmt(env,who,'wallet_account',phone.slice(-4),{})]);
      return {ok:true};
    }
    if(path==='/admin/wallet-credit'){
      const amount=moneyCents(body.amount),id=operationId(body),note=String(body.note||'').trim().slice(0,200);if(!amount||!id||!note)return fail('bad_amount');
      const repeated=await P('SELECT phone,delta FROM wallet_ledger WHERE request_id=?','credit_'+id).first();if(repeated)return repeated.phone===phone&&repeated.delta===amount?{ok:true,repeated:true}:fail('conflict',409);
      await env.DB.batch(walletMove(env,phone,amount,'credit',null,who,note,'credit_'+id));
    }
    const account=await P('SELECT balance FROM wallets WHERE phone=?',phone).first();
    const ledger=(await P('SELECT at,delta,kind,no,who,note FROM wallet_ledger WHERE phone=? ORDER BY id DESC LIMIT 100',phone).all()).results||[];
    return {ok:true,phone,balance:account?.balance||0,ledger};
  }
  return fail('not_found',404);
}

async function enrichOperations(env,orders){
  if(!orders.length)return orders;
  const ids=orders.map(o=>Number(o.no.replace('#',''))-1000), marks=ids.map(()=>'?').join(',');
  const prep=(await env.DB.prepare('SELECT no,stage,checks,who,updated FROM prep_orders WHERE no IN ('+marks+')').bind(...ids).all()).results||[],splits=(await env.DB.prepare('SELECT * FROM payment_splits WHERE no IN ('+marks+')').bind(...ids).all()).results||[];
  const pm=new Map(prep.map(x=>[x.no,x.stage])),pi=new Map(prep.map(x=>[x.no,x])),sm=new Map(splits.map(x=>[x.no,x]));
  return orders.map(o=>{const n=Number(o.no.replace('#',''))-1000;const px=pi.get(n),ck=px?Object.values(safeJson(px.checks||'{}')):[];return {...o,prepStage:pm.get(n)||'waiting',prepBy:px?px.who:'',prepAt:px?px.updated:0,prepPicked:ck.filter(v=>v==='picked').length,prepMissing:ck.filter(v=>v==='missing').length,payment:sm.get(n)||null};});
}

async function walletOrderPhone(env,no,phone){
  const live=normPhone(phone);if(live)return live;
  const saved=await env.DB.prepare('SELECT phone FROM wallet_ledger WHERE no=? ORDER BY id DESC LIMIT 1').bind(no).first();
  return saved?.phone||null;
}


// Delivery POS prints the order's accepted prices, never the current catalogue price.
function posDocument(raw,no){
  const order=safeJson(raw),lines=(order.lines||[]).map(l=>{
    const price=moneyCents(l.price),qty=Number(l.qty),regular=moneyCents(l.regularPrice??l.price);
    if(price===null||regular===null||!Number.isInteger(qty)||qty<=0)throw Error('bad_order');
    return {id:String(l.id||''),name:String(l.name||''),unit:String(l.unit||''),qty,price,regular:Math.max(price,regular),total:price*qty,tag:String(l.tag||'')};
  });
  const subtotal=moneyCents(order.subtotal),fee=moneyCents(order.fee||0),total=moneyCents(order.total),gross=lines.reduce((s,l)=>s+l.regular*l.qty,0);
  if(!lines.length||subtotal===null||fee===null||total===null||lines.reduce((s,l)=>s+l.total,0)!==subtotal||subtotal+fee!==total)throw Error('bad_order');
  return {orderNo:'#'+(1000+no),lines,gross,discount:gross-subtotal,subtotal,fee,total};
}
async function latestPosReceipt(env,no){return env.DB.prepare('SELECT * FROM pos_receipts WHERE no=? ORDER BY revision DESC LIMIT 1').bind(no).first();}
async function posRoute(env,path,body,who,role){
  const fail=(code,status=400)=>({ok:false,code,status}),P=(q,...a)=>env.DB.prepare(q).bind(...a);
  if(path==='/admin/pos-settings'){
    if(body.save){if(role!=='owner')return fail('forbidden',403);await env.DB.batch([P('UPDATE pos_settings SET require_receipt=? WHERE id=1',body.requireReceipt?1:0),logStmt(env,who,'pos_policy','',{requireReceipt:!!body.requireReceipt})]);}
    return {ok:true,settings:await P('SELECT * FROM pos_settings WHERE id=1').first()};
  }
  if(path==='/admin/pos-orders'){
    const rows=(await P("SELECT o.no,o.status,o.created,o.updated,o.data,p.id receipt_id,p.revision receipt_revision,p.fingerprint receipt_fingerprint FROM orders o LEFT JOIN pos_receipts p ON p.id=(SELECT id FROM pos_receipts q WHERE q.no=o.no ORDER BY q.revision DESC LIMIT 1) WHERE o.src!='pos' AND (o.status IN ('new','accepted','onway') OR o.updated>?) ORDER BY o.no DESC LIMIT 200",Date.now()-2*864e5).all()).results||[];
    const orders=[];
    for(const r of rows){const d=safeJson(r.data),receipt=r.receipt_id?{id:r.receipt_id,revision:r.receipt_revision,fingerprint:r.receipt_fingerprint}:null,document=posDocument(r.data,r.no);orders.push({no:document.orderNo,status:r.status,created:r.created,name:d.name||'',phone:d.phone||'',count:d.count,total:document.total,receipt:receipt?{number:'OH-'+receipt.id,revision:receipt.revision,current:r.status!=='canceled'&&receipt.fingerprint===await tokenHash(JSON.stringify(document))}:null});}
    return {ok:true,orders};
  }
  const no=Number(String(body.no||'').replace(/\D/g,''))-1000,row=await P('SELECT no,status,created,data,src FROM orders WHERE no=?',no).first();
  if(!row)return fail('not_found',404);if(row.src==='pos')return fail('not_delivery');if(row.status==='canceled')return fail('canceled');
  const document=posDocument(row.data,no),fingerprint=await tokenHash(JSON.stringify(document)),prior=await latestPosReceipt(env,no);
  if(path==='/admin/pos-issue'){
    if(body.fingerprint!==fingerprint)return fail('conflict',409);
    if(!body.reviewed)return fail('review_required');
    const prep=await P('SELECT stage FROM prep_orders WHERE no=?',no).first();if(prep&&prep.stage!=='ready')return fail('not_ready',409);
    if(prior&&prior.fingerprint===fingerprint)return {ok:true,repeated:true,receipt:{...prior,document:safeJson(prior.document),number:'OH-'+prior.id},fingerprint,current:true};
    if(row.status==='onway'||row.status==='delivered')return fail('closed');
    try{await env.DB.batch([P("SELECT CASE WHEN data != ? OR status IN ('canceled','onway','delivered') THEN json('pos_conflict') ELSE 1 END FROM orders WHERE no=?",row.data,no),P('INSERT INTO pos_receipts(no,revision,fingerprint,document,issued,who) VALUES(?,?,?,?,?,?)',no,(prior?.revision||0)+1,fingerprint,JSON.stringify(document),Date.now(),who),logStmt(env,who,'pos_issue',document.orderNo,{revision:(prior?.revision||0)+1,total:document.total})]);}catch{return fail('conflict',409);}
  }
  const receipt=await latestPosReceipt(env,no);
  return {ok:true,document,fingerprint,orderStatus:row.status,receipt:receipt?{number:'OH-'+receipt.id,revision:receipt.revision,issued:receipt.issued,who:receipt.who,document:safeJson(receipt.document)}:null,current:!!receipt&&receipt.fingerprint===fingerprint,payment:paymentOf(safeJson(row.data),await P('SELECT * FROM payment_splits WHERE no=?',no).first())};
}
