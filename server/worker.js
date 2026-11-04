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

const MAX_FAILS_PER_IP = 5;        // محاولات غلط لكل جهاز
const IP_LOCK_SECONDS = 15 * 60;   // مدة القفل لكل جهاز
const MAX_FAILS_GLOBAL = 40;       // محاولات غلط من كل الأجهزة مع بعض
const GLOBAL_LOCK_SECONDS = 60 * 60;
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export default {
  async fetch(request, env) {
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
      if (!env.TELEGRAM_BOT_TOKEN) return reply(503, { ok: false, code: "no_telegram" });
      const chat = await env.LOCKS.get("tg_chat");
      if (!chat) return reply(503, { ok: false, code: "no_telegram" });
      if (await tooManyOrders(env, ip)) return reply(429, { ok: false, code: "slow_down" });
      let data;
      try { data = await loadData(env); } catch { return reply(502, { ok: false, code: "data" }); }
      const priced = priceOrder(data, body);
      if (priced.error) return reply(400, { ok: false, code: priced.error });
      const orderNo = await nextOrderNo(env);
      const sent = await tgSend(env, chat, orderText(data, priced, body, orderNo), {
        inline_keyboard: [[{ text: "افتح الموقع في قوقل ماب", url: mapsUrl(body.lat, body.lng) }]],
      });
      if (!sent.ok) return reply(502, { ok: false, code: "telegram" });
      return reply(200, { ok: true, orderNo, subtotal: priced.subtotal, fee: priced.fee, total: priced.total, count: priced.count });
    }

    const locked = await isLocked(env, ip);
    if (locked) return reply(429, { ok: false, code: "locked", retryAfter: locked });

    const pinOk = await checkPin(env, String(body.pin || ""));
    if (!pinOk) {
      await recordFail(env, ip);
      return reply(401, { ok: false, code: "bad_pin" });
    }
    await clearFails(env, ip);

    if (path === "/login") return reply(200, { ok: true });

    if (path === "/tg-status") {
      const title = env.LOCKS ? await env.LOCKS.get("tg_title") : null;
      return reply(200, { ok: true, hasToken: !!env.TELEGRAM_BOT_TOKEN, linked: !!title, title: title || "" });
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
      if (data.store) delete data.store.pinHash; // الرقم السري ما ينحفظ في الموقع العام
      try {
        await saveToGitHub(env, "data.json", JSON.stringify(data), "تحديث المتجر من صفحة الإدارة");
      } catch (e) {
        return reply(502, { ok: false, code: e.code || "github", status: e.status || 0 });
      }
      if (body.newPin) await env.LOCKS.put("pin", await hashPin(env, String(body.newPin)));
      return reply(200, { ok: true });
    }
    return reply(404, { ok: false, code: "not_found" });
  },
};

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
  for (const [key, rawQty] of Object.entries(items)) {
    const qty = Math.floor(Number(rawQty));
    if (!(qty > 0 && qty <= 200)) continue;
    const parts = String(key).split(":");
    const kind = parts.length > 1 ? parts[0] : "r";
    const p = byId[parts.length > 1 ? parts[1] : parts[0]];
    if (!p || !p.stock) return { error: "unavailable", id: key };
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
