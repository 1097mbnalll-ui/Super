// «طلب بالكتابة» (الخضار بالوزن...) وسطر «منتج من عندي» في طلب الإدارة. التشغيل: node server/test/free-items.mjs

import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8')); data.store.closed = false; delete data.store.hours; data.store.minOrder = 30; data.store.fee = 5; data.store.freeOver = 0;
delete data.store.groups;

const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
let ipn = 0;
const call = async (p, body) => { if (p === '/save' && body.baseVersion === undefined) body = { ...body, baseVersion: (await call('/admin/catalog', { pin: body.pin })).version }; return w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '7.2.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json()); };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const A = { pin: '2468' };
const N = (n) => Number(String(n).replace(/\D/g, '')) - 1000; const rec = (no) => JSON.parse(sq.prepare('SELECT data FROM orders WHERE no = ?').get(N(no)).data);
const P1 = data.products.find((p) => p.id === 'pantry0'); P1.price = 10; P1.stock = true; delete P1.max; delete P1.old; delete P1.packs;
ok((await call('/save', { ...A, data, stock: { pantry0: 20 } })).ok, 'حفظ');
const stockOf = (id) => (sq.prepare('SELECT qty FROM stock WHERE id = ?').get(id) || {}).qty;
const loc = { lat: 24.84, lng: 46.83 };
const FREE = 'طماط ٢ كيلو\nخيار ١ كيلو\r\nليمون ١٠ حبات\u0007';

// ١) القائمة لحالها: مقبولة، وأقل طلب ما ينطبق، والسعر توصيل بس
let r = await call('/order', { items: {}, free: FREE, note: '🥬 طماط ٢ كيلو\nخيار ١ كيلو\nليمون ١٠ حبات', phone: '0557100001', ...loc });
ok(r.ok && r.subtotal === 0 && r.total === 5 && r.count === 0, 'القائمة لحالها مقبولة (بدون أقل طلب): ' + JSON.stringify([r.ok, r.code, r.subtotal, r.total]));
let o1 = r.ok ? rec(r.orderNo) : {};
ok(o1.free === 'طماط ٢ كيلو\nخيار ١ كيلو\nليمون ١٠ حبات', 'القائمة محفوظة بالطلب ومنظّفة: ' + JSON.stringify(o1.free));
ok(o1.note === '', 'نسخة الملاحظات (للخادم القديم) انشالت: ' + JSON.stringify(o1.note));
ok(Array.isArray(o1.lines) && o1.lines.length === 0, 'بدون سطور');

// ٢) القائمة مع منتجات + ملاحظة الزبون تبقى
r = await call('/order', { items: { pantry0: 1 }, free: 'بطاطس ٣ كيلو', note: 'الباب الثاني\n🥬 بطاطس ٣ كيلو', phone: '0557100002', ...loc });
ok(r.ok && r.subtotal === 10, 'منتج تحت أقل طلب + قائمة: مقبول: ' + JSON.stringify([r.ok, r.code, r.subtotal]));
const o2 = r.ok ? rec(r.orderNo) : {};
ok(o2.free === 'بطاطس ٣ كيلو' && o2.note === 'الباب الثاني', 'ملاحظة الزبون تبقى والقائمة لحالها: ' + JSON.stringify([o2.note, o2.free]));
ok(stockOf('pantry0') === 19, 'المخزون نقص بالمنتج بس: ' + stockOf('pantry0'));

// ٣) الطلب القديم بدون قائمة: نفس السلوك
r = await call('/order', { items: { pantry0: 1 }, phone: '0557100003', ...loc });
ok(!r.ok && r.code === 'min_order', 'بدون قائمة: أقل طلب ينطبق مثل قبل: ' + r.code);
r = await call('/order', { items: {}, phone: '0557100003', ...loc });
ok(!r.ok && r.code === 'empty', 'سلة فاضية بدون قائمة: empty');
r = await call('/order', { items: {}, free: ' \n\u0001 ', phone: '0557100003', ...loc });
ok(!r.ok && r.code === 'empty', 'قائمة فاضية (مسافات): empty');
r = await call('/order', { items: { pantry0: 3 }, phone: '0557100004', note: 'عادي', ...loc });
const o3 = r.ok ? rec(r.orderNo) : {};
ok(r.ok && !('free' in o3) && o3.note === 'عادي', 'الطلب العادي بدون حقل free');
r = await call('/order', { items: {}, free: 'x'.repeat(900), phone: '0557100005', ...loc });
ok(r.ok && rec(r.orderNo).free.length === 600, 'القائمة أقصاها ٦٠٠ حرف');
const qq = await call('/quote', { items: {}, free: 'موز درزن' });
ok(qq.ok && qq.subtotal === 0 && qq.belowMin === false && qq.free === 'موز درزن', '/quote يقبل القائمة لحالها: ' + JSON.stringify(qq));

// ٤) الإدارة: سطر من عندي
const before = stockOf('pantry0');
r = await call('/admin/order-new', { ...A, phone: '0557100006', lines: [{ id: 'pantry0', qty: 1 }, { custom: true, name: 'طماط بلدي', unit: '2 كيلو', qty: 2, price: 7.5 }, { custom: true, name: 'طماط بلدي', unit: '2 كيلو', qty: 1, price: 7.5 }], fee: 0 });
const om = r.ok ? r.order : {};
const cl = (om.lines || []).find((l) => String(l.id).startsWith('c:'));
ok(r.ok && cl && cl.qty === 3 && cl.price === 7.5 && cl.name === 'طماط بلدي' && cl.unit === '2 كيلو', 'سطر من عندي انحفظ (والمكرر اندمج): ' + JSON.stringify(cl));
ok(om.total === 32.5, 'الإجمالي يشمله: ' + om.total);
ok(stockOf('pantry0') === before - 1 && !sq.prepare("SELECT 1 FROM stock WHERE id LIKE 'c:%'").get() && !sq.prepare("SELECT 1 FROM pcost WHERE id LIKE 'c:%'").get(), 'المخزون وسعر الشراء ما انلمسوا للسطر');
const cid = cl && cl.id;
r = await call('/admin/order-new', { ...A, lines: [{ custom: true, name: 'طماط بلدي', unit: '2 كيلو', qty: 1, price: 7.5 }] });
ok(r.ok && r.order.lines[0].id === cid, 'المعرّف ثابت لنفس الاسم والوحدة');
for (const bad of [{ custom: true, name: '', qty: 1, price: 1 }, { custom: true, name: 'x', qty: 0, price: 1 }, { custom: true, name: 'x', qty: 501, price: 1 }, { custom: true, name: 'x', qty: 1, price: -1 }]) {
  r = await call('/admin/order-new', { ...A, lines: [bad] }); ok(!r.ok && r.code === 'bad_line', 'سطر غلط مرفوض: ' + JSON.stringify(bad));
}
r = await call('/admin/order-new', { ...A, lines: [{ custom: true, name: 'ن'.repeat(90), unit: 'و'.repeat(40), qty: 1, price: 1 }] });
ok(r.ok && r.order.lines[0].name.length === 60 && r.order.lines[0].unit.length === 20, 'الاسم ≤٦٠ والوحدة ≤٢٠');

// ٥) تسعير القائمة بعد التجهيز: تعديل الطلب بسطور من عندي وشيل القائمة
r = await call('/admin/order-edit', { ...A, no: '#' + (1000 + 1), lines: [{ custom: true, name: 'طماط', unit: '2 كيلو', qty: 1, price: 8 }, { custom: true, name: 'خيار', unit: 'كيلو', qty: 1, price: 6 }], free: '' });
ok(r.ok && r.order.total === 19 && !r.order.free && r.order.lines.length === 2, 'تسعير الطلب المكتوب بالتعديل: ' + JSON.stringify([r.ok, r.code, r.order && r.order.total]));
r = await call('/admin/order-edit', { ...A, no: '#' + (1000 + 2), lines: [] });
ok(r.ok && r.order.free === 'بطاطس ٣ كيلو' && r.order.lines.length === 0, 'التعديل يقدر يشيل كل المنتجات ما دام فيه قائمة');
ok(stockOf('pantry0') === before, 'المنتج المشال رجع للمخزون: ' + stockOf('pantry0'));

// ٦) المندوب يشوف القائمة، والإلغاء ما يكسر شي
const d = await call('/driver/orders', A);
const dO = (d.orders || []).find((x) => x.no === '#1002');
ok(d.ok && dO && dO.free === 'بطاطس ٣ كيلو', 'المندوب يشوف القائمة');
const st = await call('/driver/status', { ...A, no: '#1005', status: 'canceled' });
ok(st.ok && sq.prepare('SELECT status FROM orders WHERE no = 5').get().status === 'canceled', 'إلغاء طلب القائمة: ' + JSON.stringify(st.code || 'ok'));
const dl = await call('/driver/status', { ...A, no: '#1001', status: 'delivered' });
ok(dl.ok, 'توصيل طلب مسعّر بسطور من عندي: ' + JSON.stringify(dl.code || 'ok'));
const v = await call('/admin/verify', A); ok(v.ok && v.clean, 'التحليل مطابق (verifyStats): ' + JSON.stringify(v.ok && { d: v.dayDiffCount, i: v.itemDiffs, h: v.hourDiffs, p: v.pairDiffs }));
// الزبون يضيف لطلبه بعد ما طلب (/order-add)
r = await call('/order', { items: { pantry0: 1 }, free: 'بصل ١ كيلو', phone: '0557100009', ...loc });
ok(r.ok, 'طلب للإضافة');
let ad = await call('/order-add', { no: r.orderNo, phone: '0557100009', text: 'خبز ٢\nحليب' });
ok(ad.ok && rec(r.orderNo).free === 'بصل ١ كيلو\n➕ خبز ٢\nحليب', 'الإضافة انضافت للقائمة: ' + JSON.stringify(ad.ok ? rec(r.orderNo).free : ad.code));
ad = await call('/order-add', { no: r.orderNo, phone: '0550000000', text: 'x' }); ok(!ad.ok && ad.code === 'not_found', 'جوال غلط مرفوض');
ad = await call('/order-add', { no: r.orderNo, phone: '0557100009', text: '' }); ok(!ad.ok, 'نص فاضي مرفوض');
r = await call('/order', { items: { pantry0: 3 }, phone: '0557100010', ...loc });
ad = await call('/order-add', { no: r.orderNo, phone: '0557100010', text: 'ماء' });
ok(ad.ok && rec(r.orderNo).free === 'ماء', 'طلب بدون قائمة: الإضافة تصير القائمة');
// اقتراحات الزبون (/suggest)
let sg = await call('/suggest', { no: '#1001', stars: 4, text: 'زيدوا الخضار' });
ok(sg.ok && sq.prepare("SELECT COUNT(*) n FROM alog WHERE act = 'suggestion'").get().n === 1, 'الاقتراح انحفظ بالسجل');
sg = await call('/suggest', { text: '' }); ok(!sg.ok, 'اقتراح فاضي مرفوض');
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
