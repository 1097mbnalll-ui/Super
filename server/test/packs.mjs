// اختبار خيارات البيع (حبة / شدّة / كرتون): السعر من المتجر، المخزون بالحبات، التكلفة، الحد لكل طلب، الإلغاء والتعديل، وصحة التحليل.
// التشغيل:  node server/test/packs.mjs   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8')); data.store.closed = false; delete data.store.minOrder; data.store.fee = 0; data.store.freeOver = 0;
// الحفظ يستبدل كائنات المنتجات، فنرجع للمنتج من البيانات كل مرة
const prod = () => data.products.find((p) => p.id === 'pantry0');
let P = prod(); P.price = 2; P.stock = true; delete P.max;
P.packs = [{ u: 'شدّة 6 حبات', n: 6, price: 11 }, { u: 'كرتون 24 حبة', n: 24, price: 40 }];
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
let ipn = 0;
const call = async (p, body) => { if (p === '/save' && body.baseVersion === undefined) body = { ...body, baseVersion: (await call('/admin/catalog', { pin: body.pin })).version }; return w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '7.1.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json()); };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const A = { pin: '2468' };
const N = (n) => Number(String(n).replace(/\D/g, '')) - 1000;
const stock = () => sq.prepare("SELECT qty FROM stock WHERE id = 'pantry0'").get().qty;
const rec = (no) => JSON.parse(sq.prepare('SELECT data FROM orders WHERE no = ?').get(N(no)).data);

ok((await call('/save', { ...A, data, stock: { pantry0: 100 }, costs: { pantry0: 1.5 } })).ok, 'حفظ منتج له شدّة وكرتون');
let r = await call('/order', { items: { 'pantry0~1': 2, pantry0: 3 }, phone: '0551000001', lat: 24.84, lng: 46.83 });
ok(r.ok && r.total === 2 * 40 + 3 * 2, 'السعر: كرتونين ب٤٠ + ٣ حبات ب٢ = ' + r.total);
ok(stock() === 100 - 2 * 24 - 3, 'المخزون ينقص بالحبات: ' + stock());
let o = rec(r.orderNo), cl = o.lines.find((l) => l.id === 'pantry0~1');
ok(cl && cl.unit === 'كرتون 24 حبة' && cl.per === 24 && cl.name === prod().name, 'سطر الطلب: الاسم والوحدة وعدد الحبات');
ok(Math.abs(cl.cost - 1.5 * 24) < 0.001, 'تكلفة الكرتون = تكلفة الحبة × ٢٤');
ok((await call('/order', { items: { 'pantry0~7': 1 }, phone: '0551000002', lat: 24.84, lng: 46.83 })).code === 'unavailable', 'خيار غير موجود ينرفض');
ok((await call('/order', { items: { 'nope~1': 1 }, phone: '0551000002', lat: 24.84, lng: 46.83 })).code === 'unavailable', 'منتج غير موجود ينرفض');
// الحد لكل طلب بالحبات
prod().max = 30; await call('/save', { ...A, data });
r = await call('/order', { items: { 'pantry0~1': 1, 'pantry0~0': 2 }, phone: '0551000003', lat: 24.84, lng: 46.83 });
ok(r.code === 'item_limit', 'الحد ٣٠ حبة: كرتون + شدّتين = ٣٦ حبة ينرفض');
delete prod().max; await call('/save', { ...A, data, stock: { pantry0: 100 } });
// نقص المخزون
r = await call('/order', { items: { 'pantry0~1': 5 }, phone: '0551000004', lat: 24.84, lng: 46.83 });
ok(r.code === 'unavailable', 'خمس كراتين (١٢٠ حبة) والمخزون ١٠٠ ينرفض: ' + r.code);
// تعديل الطلب يحافظ على عدد الحبات، والإلغاء يرجع المخزون
const o2 = (await call('/order', { items: { 'pantry0~0': 2 }, phone: '0551000005', lat: 24.84, lng: 46.83 })).orderNo;
const s0 = stock();
r = await call('/admin/order-edit', { ...A, no: o2, lines: [{ id: 'pantry0~0', qty: 3, price: 11 }] });
ok(r.ok && stock() === s0 - 6, 'زيادة شدّة في التعديل تنقص ٦ حبات: ' + (s0 - stock()));
ok(rec(o2).lines[0].per === 6, 'التعديل يحافظ على عدد حبات الشدّة');
await call('/admin/team-save', { ...A, name: 'سعيد', role: 'driver', newPin: '1111' });
await call('/driver/status', { pin: '1111', no: o2, status: 'canceled' });
ok(stock() === s0 + 12, 'الإلغاء يرجع ١٨ حبة (٣ شدّات): ' + (stock() - (s0 - 6)));
// المجهز يبدل الكرتون بمنتج ثاني: نفس عدد الحبات
const alt = data.products.find((p) => p.cat === prod().cat && p.id !== 'pantry0' && p.stock && !p.packs);
const o3 = (await call('/order', { items: { 'pantry0~1': 1, pantry0: 1 }, phone: '0551000006', lat: 24.84, lng: 46.83, sub: 'swap' })).orderNo;
await call('/driver/status', { pin: '1111', no: o3, status: 'accepted' });
r = await call('/admin/prep-sub', { ...A, op: 'propose', no: o3, id: 'pantry0~1', to: alt.id });
ok(r.ok && r.applied && rec(o3).lines.find((l) => l.id === alt.id).qty === 24, 'تبديل كرتون بمنتج بالحبة = ٢٤ حبة');
// حفظ بيانات غلط للخيارات ينرفض
prod().packs = [{ u: 'كرتون', n: 0, price: 5 }]; ok((await call('/save', { ...A, data })).code === 'bad_data', 'خيار بعدد حبات صفر ما ينحفظ');
prod().packs = [{ u: 'شدّة 6 حبات', n: 6, price: 11 }, { u: 'كرتون 24 حبة', n: 24, price: 40 }]; await call('/save', { ...A, data });
// التحليل سليم
r = await call('/admin/verify', A); ok(r.ok && r.clean, 'التحليل مطابق لسجل الطلبات');
console.log(fails ? '\n' + fails + ' فحص فشل' : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
