// خادم عرض محلي لتصوير لقطات الفيلم: يشغّل server/worker.js الحقيقي على قاعدة SQLite في الذاكرة
// ويعبّيها بطلبات وهمية (أسماء وأرقام جوال مختلقة) عشان شاشات الإدارة والتحليل تطلع بأرقام.
// ما يلمس الموقع الحي ولا Cloudflare ولا GitHub. التشغيل: node film/tools/demo-server.mjs  (يحتاج node 22)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { githubMock } from '../../server/test/support/github.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const w = (await import(path.join(root, 'server/worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
delete data.store.closed; data.store.keepDays = 180;

const sq = new DatabaseSync(':memory:');
const mk = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 'demo', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async (u, o = {}) => { u = String(u); if (u.includes('api.github.com') && !o.method) return new Response(JSON.stringify(data)); return new Response('{"ok":true}'); }, true);

const RealNow = Date.now.bind(Date); let NOW = RealNow(), frozen = true; Date.now = () => (frozen ? NOW : RealNow());
let seed = 20261110; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
let ipn = 0;
const call = async (p, body) => {
  if (p === '/save' && body.baseVersion === undefined) body = { ...body, baseVersion: (await call('/admin/catalog', { pin: body.pin })).version };
  const waits = []; const r = await w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '10.' + (++ipn % 250) + '.' + (Math.floor(ipn / 250) % 250) + '.' + (Math.floor(ipn / 62500) % 250), 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, { waitUntil: (x) => waits.push(x) });
  const j = await r.json(); await Promise.all(waits); return j;
};
const A = { pin: '2468', by: 'أبو فهد' };

// ---------- المنتجات اللي تنباع في العرض: اللي لها صورة وسعر ----------
const pool = data.products.filter((p) => p.stock && p.price >= 1 && p.img && !p.packs && p.cat !== 'print').slice(0, 260);
const pick = () => pool[Math.floor(Math.pow(rnd(), 1.9) * pool.length)];
const basket = () => { const it = {}; let sum = 0, guard = 0; const want = 28 + rnd() * 95; while (sum < want && guard++ < 40) { const p = pick(), q = 1 + (rnd() < 0.3 ? 1 : 0) + (rnd() < 0.08 ? 2 : 0); if (p.max && (it[p.id] || 0) + q > p.max) continue; it[p.id] = (it[p.id] || 0) + q; sum += p.price * q; } return it; };
const names = ['أبو فهد', 'أم سعد', 'محمد', 'نورة', 'خالد', 'سارة', 'أبو تركي', 'أم ريان', 'عبدالعزيز', 'هيفاء', 'سلطان', 'منيرة'];
const N = 150, cust = Array.from({ length: N }, (_, i) => ({ phone: '05' + String(50010000 + i * 7919).padStart(8, '0').slice(0, 8), name: names[i % names.length], lat: 24.845 + (rnd() - 0.5) * 0.014, lng: 46.812 + (rnd() - 0.5) * 0.016 }));
const pickCust = () => cust[Math.floor(Math.pow(rnd(), 1.5) * N)];

const realNow = RealNow(), DAY = 86400e3, riyadhMidnight = (ms) => Math.floor((ms + 3 * 3600e3) / DAY) * DAY - 3 * 3600e3;
const today0 = riyadhMidnight(realNow), DAYS = 35;
NOW = today0 - DAYS * DAY - 3600e3; // كل الإعداد (ومنه «بداية حساب» المناديب) قبل أول طلب
// ---------- إعداد: أسعار الشراء، مخزون محدود لبعض الأصناف، مناديب ----------
const costs = {}; pool.forEach((p, i) => { costs[p.id] = Math.round(p.price * (0.7 + (i % 6) * 0.03) * 100) / 100; });
const stock = {}; pool.slice(0, 14).forEach((p, i) => { stock[p.id] = 900 + i * 40; });
let r = await call('/save', { ...A, data, costs, stock }); if (!r.ok) throw new Error('save ' + JSON.stringify(r));
await call('/admin/team-save', { ...A, name: 'سعيد', role: 'driver', newPin: '1111' });
await call('/admin/team-save', { ...A, name: 'فهد', role: 'driver', newPin: '2222' });
const drivers = ['1111', '2222'];

// ---------- سجل ٣٥ يوم ----------
const Q = []; const at = (t, f) => Q.push([t, f]);
const runUntil = async (t) => { for (;;) { Q.sort((a, b) => a[0] - b[0]); if (!Q.length || Q[0][0] > t) break; const [tt, f] = Q.shift(); NOW = Math.max(NOW, tt); await f(); } NOW = Math.max(NOW, t); };
const stats = { placed: 0, delivered: 0, rejected: {} };
async function place(c, opts = {}) {
  const j = await call('/order', { items: opts.items || basket(), phone: c.phone, name: c.name, pay: rnd() < 0.42 ? 'card' : 'cash', sub: ['swap', 'remove', 'call'][Math.floor(rnd() * 3)], lat: c.lat, lng: c.lng, details: 'حي الرمال، بيت ' + (1 + Math.floor(rnd() * 80)), requestId: 'demo-' + (++ipn) + '-' + Math.floor(rnd() * 1e9) });
  if (!j.ok) { stats.rejected[j.code] = (stats.rejected[j.code] || 0) + 1; return null; }
  stats.placed++; return j.orderNo;
}
async function fullCycle(c) {
  const no = await place(c); if (!no) return; const pin = drivers[Math.floor(rnd() * drivers.length)];
  if (rnd() < 0.03) { at(NOW + 4 * 60e3, () => call('/cancel', { no, phone: c.phone })); return; }
  at(NOW + (3 + rnd() * 6) * 60e3, async () => { const a = await call('/driver/status', { pin, no, status: 'accepted' }); if (!a.ok) { stats.rejected['accept:' + a.code] = (stats.rejected['accept:' + a.code] || 0) + 1; return; }
    at(NOW + (6 + rnd() * 9) * 60e3, async () => { const b = await call('/driver/status', { pin, no, status: 'onway' }); if (!b.ok) { stats.rejected['onway:' + b.code] = (stats.rejected['onway:' + b.code] || 0) + 1; return; }
      at(NOW + (9 + rnd() * 16) * 60e3, async () => { const d = await call('/driver/status', { pin, no, status: 'delivered' }); if (d.ok) stats.delivered++; else stats.rejected['deliver:' + d.code] = (stats.rejected['deliver:' + d.code] || 0) + 1; }); }); });
}
const hourPick = () => { const x = rnd(); return x < 0.18 ? 8 + rnd() * 3.5 : x < 0.36 ? 12 + rnd() * 4 : 16.5 + rnd() * 6.3; };
for (let d = DAYS; d >= 1; d--) {
  const day0 = today0 - d * DAY, dow = new Date(day0 + 3 * 3600e3).getUTCDay(), weekend = dow === 4 || dow === 5;
  const n = Math.round((9 + (DAYS - d) * 0.36) * (weekend ? 1.35 : 1) * (0.85 + rnd() * 0.3));
  for (let k = 0; k < n; k++) at(day0 + hourPick() * 3600e3, () => fullCycle(pickCust()));
  for (let k = 0; k < 5; k++) at(day0 + hourPick() * 3600e3, async () => { const v = {}, cc = {}; for (let i = 0; i < 6; i++) v[pick().id] = 1; if (rnd() < 0.4) cc[pick().id] = 1; await call('/ev', { visit: 1, v, c: cc, s: rnd() < 0.45 ? [{ q: ['حليب', 'خبز', 'بيض', 'ماء', 'شاي', 'نودلز'][Math.floor(rnd() * 6)], f: rnd() < 0.15 ? 0 : 3 }] : [], co: rnd() < 0.5 ? 1 : 0 }); });
  // تسليم كاش المناديب آخر اليوم
  at(day0 + 23.7 * 3600e3, async () => { const c = await call('/admin/cash', A); for (const d of (c.drivers || [])) if (d.id && d.balance > 0) await call('/admin/cash', { ...A, drv: d.id, add: d.balance, note: 'تسليم آخر اليوم' }); });
  await runUntil(day0 + DAY - 60e3);
}
// ---------- اليوم: طلبات مسلّمة لين قبل ساعة ----------
const liveStart = realNow - 55 * 60e3;
{ const span = Math.max(1, (liveStart - 100 * 60e3) - (today0 + 7.2 * 3600e3)); const n = Math.max(4, Math.min(19, Math.round(span / 3600e3 * 1.9)));
  for (let k = 0; k < n; k++) at(today0 + 7.2 * 3600e3 + rnd() * span, () => fullCycle(pickCust())); await runUntil(liveStart); }

// ---------- التكاليف (لمستشار العروض) والموظفين ----------
await call('/admin/opex-save', { ...A, opex: { rent: 2500, salaries: 3000, utilities: 400, vehicles: 300, marketing: 200, software: 50, other: 100, driverPerOrder: 3, packPerOrder: 0.4, cardFeePct: 1.5, wastePct: 1, expectedOrders: 600, expectedBasket: 85 }, confirm: true });
await call('/admin/staff-save', { ...A, name: 'علي المجهز', role: 'preparer', loginPin: '5555' });
await call('/admin/staff-save', { ...A, name: 'نواف الكاشير', role: 'cashier', loginPin: '6666' });
await call('/admin/staff-save', { ...A, name: 'خالد المدير', role: 'manager', loginPin: '777777' });
const prep = await call('/enter', { pin: '5555' });
async function prepStage(no, stage) { const l = await call('/admin/prep', { session: prep.token }); const o = (l.orders || []).find((x) => x.no === no); if (!o) return { ok: false, code: 'no_prep_row' }; const checks = {}; o.lines.forEach((_, i) => { checks[i] = stage === 'ready' || i < 2 ? 'picked' : ''; }); let v = o.version; if (stage === 'ready' && o.stage !== 'preparing') { const p = await call('/admin/prep-save', { session: prep.token, no, version: v, orderUpdated: o.orderUpdated, stage: 'preparing', checks: {} }); if (p.ok) v = (p.prep || p.order || {}).version ?? v + 1; }
  const l2 = await call('/admin/prep', { session: prep.token }); const o2 = (l2.orders || []).find((x) => x.no === no) || o; return call('/admin/prep-save', { session: prep.token, no, version: o2.version, orderUpdated: o2.orderUpdated, stage, checks }); }

// ---------- طلبات حيّة الحين ----------
const live = {};
NOW = realNow - 34 * 60e3; live.onway = await place(cust[3]);
NOW = realNow - 21 * 60e3; live.ready = await place(cust[7]);
NOW = realNow - 12 * 60e3; live.preparing = await place(cust[11]);
NOW = realNow - 6 * 60e3; live.new1 = await place(cust[19]);
NOW = realNow - 2 * 60e3; live.new2 = await place(cust[23]);
NOW = realNow - 25 * 60e3; live.r1 = await prepStage(live.onway, 'ready');
NOW = realNow - 22 * 60e3; live.a1 = await call('/driver/status', { pin: '1111', no: live.onway, status: 'accepted' });
NOW = realNow - 18 * 60e3; live.o1 = await call('/driver/status', { pin: '1111', no: live.onway, status: 'onway' });
NOW = realNow - 9 * 60e3; live.r2 = await prepStage(live.ready, 'ready');
NOW = realNow - 5 * 60e3; live.p3 = await prepStage(live.preparing, 'preparing');
frozen = false;
await call('/driver/loc', { pin: '1111', lat: cust[3].lat + 0.004, lng: cust[3].lng - 0.005, acc: 12 });
const v = await call('/admin/verify', A);
console.log('seed', JSON.stringify({ ...stats, live: Object.fromEntries(Object.entries(live).map(([k, x]) => [k, x && typeof x === 'object' ? (x.ok ? 'ok' : x.code) : x])), verify: v.ok ? (v.clean ?? v.diffs ?? 'ok') : v.code }));

// ---------- HTTP: POST → الخادم، GET → ملفات الموقع ----------
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const port = Number(process.env.PORT || 8788);
http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }); return res.end(); }
    if (req.method === 'POST') {
      const chunks = []; for await (const c of req) chunks.push(c);
      const waits = []; const x = await w.fetch(new Request('https://x.dev' + req.url, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': req.headers['x-demo-ip'] || '10.9.9.' + (++ipn % 250), 'content-type': 'application/json' }, body: Buffer.concat(chunks) }), env, { waitUntil: (p) => waits.push(p) });
      const text = await x.text(); await Promise.all(waits); res.writeHead(x.status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); return res.end(text);
    }
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
    if (p === '/data.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(data)); }
    if (p === '/__live') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ live, cust: { onway: cust[3], ready: cust[7], fresh: cust[41] } })); }
    const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(port, '127.0.0.1', () => console.log('demo server on', port));
