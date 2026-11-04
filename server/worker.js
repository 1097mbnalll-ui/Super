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
    const locked = await isLocked(env, ip);
    if (locked) return reply(429, { ok: false, code: "locked", retryAfter: locked });

    const pinOk = await checkPin(env, String(body.pin || ""));
    if (!pinOk) {
      await recordFail(env, ip);
      return reply(401, { ok: false, code: "bad_pin" });
    }
    await clearFails(env, ip);

    if (path === "/login") return reply(200, { ok: true });

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
