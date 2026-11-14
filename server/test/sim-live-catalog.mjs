// محاكاة طويلة بالكتالوج الحقيقي (data.json المنشور، ١١ ألف منتج) ضد كود الخادم الحقيقي:
// ٣٠ يوم × ٤٠ طلب: سلات عشوائية فيها عروض الكمية (تنحوّل مثل الموقع والتطبيق: كل مجموعة كاملة = خيار العرض)،
// مقارنة سعر الجوال بسعر الخادم، رسوم التوصيل والحد الأدنى، المخزون بالحبات، الإلغاء، تكرار الطلب بنفس الرقم،
// مواعيد الاستقبال (١٢ الظهر لين ١ بالليل)، وصحة التحليل في الآخر.
// التشغيل:  node server/test/sim-live-catalog.mjs [مسار data.json]   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const dataPath = process.argv[2] || path.join(here, '../../data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const S = data.store; delete S.closed;
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
let ipn = 0;
const call = async (p, body) => { if (p === '/save' && body.baseVersion === undefined) body = { ...body, baseVersion: (await call('/admin/catalog', { pin: body.pin })).version }; return w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '9.' + (ipn % 200) + '.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json()); };
let fails = 0, checks = 0; const bad = []; const ok = (c, m) => { checks++; if (!c) { fails++; if (bad.length < 25) bad.push(m); } };
const A = { pin: '2468' };
let seed = 20261112; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const r2 = (n) => Math.round(n * 100) / 100;
const realNow = Date.now; const at = (h, m = 0) => Date.UTC(2026, 10, 12, (h - 3 + 24) % 24, m);

// مثل multiOf في الموقع و quantityOffer في التطبيق
const multiOf = (p) => { const L = p.packs || []; for (let i = 0; i < L.length; i++) { const n = Math.floor(Number(L[i].n) || 0), pr = Number(L[i].price) || 0; if (n > 1 && pr > 0 && pr < n * p.price - 0.001) return { i, n, price: pr }; } return null; };
// السلة بالحبات → عناصر الطلب (المجموعات الكاملة خيار العرض) + سعر الجوال
// عرض المجموعة (مثل ديمة: أي ٣ بـ ١١٫٩٥) مثل الخادم: كل N بسعر العرض، والزايد بسعر الحبة من السطور الأكبر كمية
const grpOf = (id) => (S.groups || []).find((g) => g && g.on !== false && Array.isArray(g.ids) && g.ids.includes(id));
const toOrder = (cart) => { const items = {}; let total = 0; const G = {};
  for (const [id, q] of Object.entries(cart)) { const g = grpOf(id); if (g) { items[id] = q; (G[g.id] || (G[g.id] = { g, l: [] })).l.push({ p: byId[id], q }); } }
  for (const { g, l } of Object.values(G)) { const n = Math.max(2, Math.floor(Number(g.n) || 0)), U = l.reduce((a, x) => a + x.q, 0); let rest = U % n;
    l.sort((a, b) => b.q - a.q); for (const x of l) { if (!rest) break; const t = Math.min(rest, x.q); total += t * x.p.price; rest -= t; }
    total += Math.floor(U / n) * Number(g.price); }
  for (const [id, q] of Object.entries(cart)) { if (grpOf(id)) continue; const p = byId[id], mo = multiOf(p);
  if (mo && q >= mo.n) { const b = Math.floor(q / mo.n), loose = q - b * mo.n; items[id + '~' + mo.i] = b; if (loose) items[id] = loose; total += b * mo.price + loose * p.price; }
  else { items[id] = q; total += q * p.price; } } return { items, sub: r2(total) }; };
const pieces = (items) => { const need = {}; for (const [k, q] of Object.entries(items)) { const [id, i] = k.split('~'); const n = i == null ? 1 : byId[id].packs[Number(i)].n; need[id] = (need[id] || 0) + q * n; } return need; };

const byId = {}; for (const p of data.products) byId[p.id] = p;
const sellable = data.products.filter((p) => p.stock && !p.print && !(data.cats.find((c) => c.id === p.cat) || {}).soon);
const offers = sellable.filter((p) => multiOf(p));
console.log('منتجات', data.products.length, 'قابلة للبيع', sellable.length, 'بعرض كمية', offers.length, 'رسوم', S.fee, 'مجاني فوق', S.freeOver, 'أقل طلب', S.minOrder);

// مخزون معروف لعينة كبيرة، والباقي بدون عدد (متوفر)
const tracked = {}; for (const p of sellable) if (rnd() < 0.5) tracked[p.id] = 5 + Math.floor(rnd() * 60);
for (const p of offers) tracked[p.id] = 200;
ok((await call('/save', { ...A, data, stock: tracked })).ok, 'حفظ الكتالوج الحقيقي والمخزون');
const expect = { ...tracked };
await call('/admin/team-save', { ...A, name: 'مندوب', role: 'driver', newPin: '5151' });
const D = { pin: '5151' };

// مواعيد الاستقبال
Date.now = () => at(11, 30); let r = await call('/order', { items: { [offers[0].id]: 1 }, phone: '0550000001', lat: 24.845, lng: 46.815 });
ok(r.code === 'closed', 'الساعة ١١:٣٠ الصبح مقفل: ' + r.code);
Date.now = () => at(3); r = await call('/order', { items: { [offers[0].id]: 1 }, phone: '0550000001', lat: 24.845, lng: 46.815 });
ok(r.code === 'closed', 'الساعة ٣ الفجر مقفل: ' + r.code);
Date.now = realNow;
const openTimes = [at(12, 5), at(15), at(20), at(23, 30), at(0, 40)];

const zone = S.zone && S.zone.length >= 3 ? S.zone : null;
const inZone = () => { if (!zone) return [24.845, 46.815]; const la = zone.reduce((s, p) => s + p[0], 0) / zone.length, ln = zone.reduce((s, p) => s + p[1], 0) / zone.length; return [la, ln]; };
const [LAT, LNG] = inZone();
const orders = []; let placed = 0, rejectedMin = 0, unavailable = 0, priceMismatch = 0, repeatOk = 0;
for (let day = 0; day < 30; day++) {
  for (let k = 0; k < 40; k++) {
    Date.now = () => pick(openTimes) + day * 864e5;
    const cart = {}; const lines = 1 + Math.floor(rnd() * 7);
    for (let i = 0; i < lines; i++) { const p = rnd() < 0.35 ? pick(offers) : pick(sellable); const mo = multiOf(p); cart[p.id] = (cart[p.id] || 0) + (mo && rnd() < 0.6 ? mo.n * (1 + Math.floor(rnd() * 2)) + Math.floor(rnd() * mo.n) : 1 + Math.floor(rnd() * 3)); }
    // نخلي السلة ضمن المخزون المعروف (مثل حد الجوال)
    for (const id of Object.keys(cart)) if (expect[id] != null) { cart[id] = Math.min(cart[id], expect[id]); if (!cart[id]) delete cart[id]; }
    if (!Object.keys(cart).length) continue;
    const { items, sub } = toOrder(cart); const fee = S.freeOver && sub >= S.freeOver ? 0 : Number(S.fee || 0);
    const phone = '05' + String(50000000 + Math.floor(rnd() * 4e7));
    const requestId = 'sim' + day + 'x' + k + 'r' + Math.floor(rnd() * 1e9);
    const body = { items, phone, name: 'زبون', details: 'بيت', pay: rnd() < 0.7 ? 'cash' : 'card', sub: 'swap', lat: LAT, lng: LNG, requestId };
    r = await call('/order', body);
    if (!r.ok) {
      if (r.code === 'min_order') { rejectedMin++; ok(S.minOrder && sub < S.minOrder, 'رفض الحد الأدنى صح: ' + sub); continue; }
      if (r.code === 'unavailable') { unavailable++; continue; }
      ok(false, 'طلب انرفض بدون سبب متوقع: ' + JSON.stringify(r) + ' ' + JSON.stringify(items)); continue;
    }
    placed++;
    if (Math.abs(r.total - r2(sub + fee)) > 0.009) { priceMismatch++; ok(false, 'سعر الجوال ' + r2(sub + fee) + ' ≠ الخادم ' + r.total + ' ' + JSON.stringify(items)); }
    // نفس الطلب بنفس الرقم (النت انقطع وأعاد): ما يتكرر
    if (k % 10 === 0) { const again = await call('/order', body); ok(again.ok && again.repeated && again.orderNo === r.orderNo, 'إعادة الإرسال ما تكرر الطلب'); repeatOk++; }
    for (const [id, n] of Object.entries(pieces(items))) if (expect[id] != null) expect[id] -= n;
    orders.push({ no: r.orderNo, items, phone, total: r.total });
  }
  // نهاية اليوم: أغلب الطلبات تنوصل، بعضها ينلغي من الزبون أو المندوب
  for (const o of orders.filter((x) => !x.done)) {
    const x = rnd();
    if (x < 0.08) { r = await call('/cancel', { no: o.no, phone: o.phone, reason: 'محاكاة' }); ok(r.ok, 'إلغاء الزبون: ' + JSON.stringify(r)); if (r.ok) { for (const [id, n] of Object.entries(pieces(o.items))) if (expect[id] != null) expect[id] += n; o.st = 'canceled'; } }
    else { for (const st of ['accepted', 'onway', 'delivered']) { r = await call('/driver/status', { ...D, no: o.no, status: st }); ok(r.ok, 'المندوب ' + st + ': ' + JSON.stringify(r)); } o.st = 'delivered'; }
    o.done = true;
  }
}
Date.now = realNow;
// المخزون في القاعدة = المتوقع، وما فيه سالب
let stockOk = 0; for (const [id, q] of Object.entries(expect)) { const row = sq.prepare('SELECT qty FROM stock WHERE id = ?').get(id); if (row && row.qty === q) stockOk++; else ok(false, 'المخزون ' + id + ' متوقع ' + q + ' والقاعدة ' + (row && row.qty)); }
ok(sq.prepare('SELECT COUNT(*) n FROM stock WHERE qty < 0').get().n === 0, 'ما فيه مخزون بالسالب');
const n = sq.prepare('SELECT COUNT(*) n FROM orders').get().n; ok(n === placed, 'عدد الطلبات في القاعدة = المرسلة: ' + n + ' / ' + placed);
r = await call('/admin/verify', A); ok(r.ok && r.clean, 'التحليل مطابق لسجل الطلبات ' + JSON.stringify(r).slice(0, 200));
console.log('طلبات', placed, '· مرفوضة للحد الأدنى', rejectedMin, '· نفد', unavailable, '· اختلاف سعر', priceMismatch, '· إعادة إرسال', repeatOk, '· مخزون مطابق', stockOk + '/' + Object.keys(expect).length, '· فحوص', checks);
if (bad.length) console.log(bad.join('\n'));
console.log(fails ? '\n' + fails + ' فحص فشل' : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
