// عرض المجموعة (S.groups): أي ٣ من منتجات المجموعة بـ ١١٫٩٥، التوزيع بالهللة، والزايد بسعره العادي (العرض اختياري). التشغيل: node server/test/group-offer.mjs

import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8')); data.store.closed = false; delete data.store.minOrder; data.store.fee = 0; data.store.freeOver = 0;




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
const N = (n) => Number(String(n).replace(/\D/g, '')) - 1000; const rec = (no) => JSON.parse(sq.prepare('SELECT data FROM orders WHERE no = ?').get(N(no)).data);
const G = ['pantry0', 'pantry1', 'dairy3'];
for (const id of G) { const p = data.products.find((x) => x.id === id); p.price = 13; p.stock = true; delete p.max; delete p.old; delete p.packs; }
data.store.groups = [{ id: 'deemah', name: 'كوكيز ديمة', n: 3, price: 11.95, ids: G }];
ok((await call('/save', { ...A, data, stock: { pantry0: 50, pantry1: 50, dairy3: 50 } })).ok, 'حفظ');
const sum = (o) => Math.round(o.lines.reduce((a, l) => a + l.qty * l.price, 0) * 100) / 100;
let r = await call('/order', { items: { pantry0: 1, pantry1: 1, dairy3: 1 }, phone: '0557000001', lat: 24.84, lng: 46.83 });
ok(r.ok && r.subtotal === 11.95, '٣ أنواع مختلفة = ١١٫٩٥: ' + r.subtotal); ok(sum(rec(r.orderNo)) === 11.95, 'السطور مجموعها ١١٫٩٥');
r = await call('/order', { items: { pantry0: 3 }, phone: '0557000002', lat: 24.84, lng: 46.83 });
ok(r.ok && r.subtotal === 11.95 && sum(rec(r.orderNo)) === 11.95, '٣ من نفس النوع = ١١٫٩٥ (السطر ينقسم): ' + JSON.stringify(rec(r.orderNo).lines.map((l) => [l.qty, l.price])));
r = await call('/order', { items: { pantry0: 4, pantry1: 2 }, phone: '0557000003', lat: 24.84, lng: 46.83 });
ok(r.ok && r.subtotal === 23.9 && sum(rec(r.orderNo)) === 23.9, '٦ = ٢٣٫٩٠: ' + r.subtotal);
r = await call('/order', { items: { pantry0: 2 }, phone: '0557000004', lat: 24.84, lng: 46.83 });
ok(r.ok && r.subtotal === 26 && sum(rec(r.orderNo)) === 26, 'علبتين بدون العرض = ٢٦ (العرض اختياري): ' + r.subtotal);
r = await call('/order', { items: { pantry0: 3, pantry1: 1 }, phone: '0557000005', lat: 24.84, lng: 46.83 });
ok(r.ok && r.subtotal === 24.95 && sum(rec(r.orderNo)) === 24.95, '٤ علب = عرض + علبة بـ١٣ = ٢٤٫٩٥: ' + r.subtotal);
ok(sq.prepare("SELECT qty FROM stock WHERE id='pantry0'").get().qty === 50 - 1 - 3 - 4 - 2 - 3, 'المخزون نقص صح');
let qq = await call('/quote', { items: { pantry0: 2, pantry1: 1 } });
ok(qq.ok && qq.subtotal === 11.95 && qq.total === 11.95 + qq.fee, 'التسعير للتطبيق (/quote): ' + JSON.stringify([qq.subtotal, qq.fee, qq.total]));
qq = await call('/quote', { items: { pantry0: 1 } }); ok(qq.ok && qq.subtotal === 13, 'علبة وحدة بسعرها (لا شكراً): ' + qq.subtotal);
// التطبيق: السلة تحت أقل طلب تنسعّر بالعرض بعد (كان يرجع min_order والتطبيق يعرض السعر بدون خصم)
data.store.minOrder = 20; await call('/save', { ...A, data });
qq = await call('/quote', { items: { pantry0: 2, pantry1: 1 } }); ok(qq.ok && qq.subtotal === 11.95 && qq.belowMin === true && qq.min === 20, 'تحت أقل طلب: التسعير بالعرض ويقول إنه تحت الحد: ' + JSON.stringify([qq.ok, qq.subtotal, qq.belowMin]));
r = await call('/order', { items: { pantry0: 2, pantry1: 1 }, phone: '0557000009', lat: 24.84, lng: 46.83 }); ok(!r.ok && r.code === 'min_order', 'الطلب نفسه تحت الحد مرفوض: ' + r.code);
delete data.store.minOrder; await call('/save', { ...A, data });
data.store.groups[0].must = true; ok((await call('/save', { ...A, data })).ok, 'حفظ إجباري');
qq = await call('/quote', { items: { pantry0: 2 } }); ok(!qq.ok && qq.code === 'pack_only' && qq.n === 3, 'لو العرض إجباري (must) الناقص مرفوض: ' + qq.code);
const v = await call('/admin/verify', A); ok(v.ok && v.clean, 'التحليل مطابق');
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
