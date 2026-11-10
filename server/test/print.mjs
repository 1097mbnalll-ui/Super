// اختبار قسم الطباعة: صفحات بالمئات (سطر واحد)، حد أدنى مستقل لطلب الطباعة، وحدود الأصناف العادية ما تتغير.
// التشغيل:  node server/test/print.mjs   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8'));
data.store.closed = false; data.store.fee = 2.7; data.store.freeOver = 30; data.store.minOrder = 20; delete data.store.zone; delete data.store.maxKm; delete data.store.deal95;
data.cats.push({ id: 'print', name: 'الطباعة', img: '' });
data.products.push({ id: 'print_bw', name: 'طباعة أبيض وأسود (صفحة A4)', unit: 'صفحة', price: 0.5, cat: 'print', img: '', stock: true, print: 'bw' }, { id: 'print_color', name: 'طباعة ألوان (صفحة A4)', unit: 'صفحة', price: 1.5, cat: 'print', img: '', stock: true, print: 'color' });
data.store.print = { minOrder: 5 };
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: r.lastInsertRowid } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io'; const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
let ipn = 0; const call = (p, body) => w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '7.7.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const order = (items, extra) => call('/order', { items, phone: '0551110001', lat: 24.84, lng: 46.83, ...extra });
const std = data.products.find((p) => p.stock && p.id !== 'print_bw' && p.id !== 'print_color' && !p.max).id;

let r = await order({ print_bw: 360 });
ok(r.ok && r.subtotal === 180 && r.fee === 0 && r.total === 180, '٣٦٠ صفحة أبيض وأسود = ١٨٠ ر.س، والتوصيل مجاني فوق ٣٠: ' + JSON.stringify(r));
r = await order({ print_bw: 4000, print_color: 1000 });
ok(r.ok && r.subtotal === 3500, 'حتى ٤٠٠٠ صفحة في سطر وحد: ' + r.subtotal);
r = await order({ print_bw: 5001 });
ok(!r.ok, 'فوق ٥٠٠٠ صفحة للسطر الواحد ما ينقبل: ' + r.code);
r = await order({ print_bw: 10 });
ok(r.ok && r.subtotal === 5 && r.total === 7.7, 'طلب طباعة صغير (٥ ر.س) يقبل بحد الطباعة (مع التوصيل ٢.٧): ' + JSON.stringify(r));
r = await order({ print_bw: 9 });
ok(r.code === 'min_order' && r.min === 5, 'طلب الطباعة تحت حده الأدنى ٥ يترفض ويرجّع الحد: ' + JSON.stringify(r));
// طلب فيه صنف عادي ما يستفيد من حد الطباعة
r = await order({ print_bw: 12, [std]: 1 });
const priceStd = data.products.find((p) => p.id === std).price;
ok(priceStd + 6 < 20 && r.code === 'min_order' && r.min === 20, 'الطلب المختلط (طباعة + صنف عادي) يلتزم بالحد العام ٢٠: ' + JSON.stringify(r));
// الأصناف العادية: السطر فوق ٢٠٠ ما ينحسب
r = await order({ [std]: 201, print_bw: 20 });
ok(r.ok && r.count === 20, 'الصنف العادي فوق ٢٠٠ يتجاهل (زي قبل)، وصفحات الطباعة تنحسب: count=' + r.count);
// بدون حد أدنى خاص: الطباعة تلتزم بالعام
delete data.store.print; await call('/save', { pin: '2468', data, baseVersion: (await call('/admin/catalog', { pin: '2468' })).version });
r = await order({ print_bw: 20 });
ok(r.code === 'min_order' && r.min === 20, 'بدون إعداد خاص: حد الطباعة = الحد العام ٢٠: ' + JSON.stringify(r));
// سطر الطباعة في الطلب محفوظ بالأرقام الصحيحة وينطبع في الإيصال
const row = sq.prepare("SELECT data, total FROM orders ORDER BY no ASC LIMIT 1").get(), rec = JSON.parse(row.data); // أول طلب = ٣٦٠ صفحة
ok(rec.lines[0].id === 'print_bw' && rec.lines[0].qty === 360 && rec.lines[0].price === 0.5 && row.total === 180, 'الطلب انحفظ: ' + rec.lines[0].name + ' × ' + rec.lines[0].qty);
// تعديل الإدارة لسطر طباعة كبير (بدل منتج ناقص) ما يفشل
const n1 = 'عدّل'; const e = await call('/admin/order-edit', { pin: '2468', no: '#1001', fee: 0, lines: [{ id: 'print_bw', qty: 600, price: 0.5 }] });
ok(e.ok && e.order.total === 300, 'تعديل الإدارة لسطر ٦٠٠ صفحة يشتغل: ' + JSON.stringify(e).slice(0, 80));
console.log(fails ? '\n' + fails + ' فحص فشل' : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
