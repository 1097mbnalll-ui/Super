// صورة المخزون القليل (stock_snap): الزائر يقرأ سطر واحد، والصورة تطابق جدول المخزون بعد الطلب والإلغاء والتعديل والاستيراد. التشغيل: node server/test/stock-snap.mjs

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
const N = (n) => Number(String(n).replace(/\D/g, '')) - 1000;
for (const id of ['pantry0', 'pantry1', 'dairy3']) { const p = data.products.find((x) => x.id === id); p.price = 10; p.stock = true; delete p.max; delete p.packs; delete p.old; }
let reads = 0; const realPrep = DB.prepare; DB.prepare = (sql) => { if (/FROM stock\b/.test(sql) && !/WHERE id/.test(sql)) reads++; return realPrep(sql); };
const snap = async () => (await w.fetch(new Request('https://x.dev/stock', { headers: { Origin: O } }), env, { waitUntil() {} })).json();
const truth = () => Object.fromEntries(sq.prepare('SELECT id, qty FROM stock WHERE qty <= 10').all().map((r) => [r.id, r.qty]));
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
ok((await call('/save', { ...A, data, stock: { pantry0: 12, pantry1: 5, dairy3: 100 } })).ok, 'حفظ المخزون (استيراد)');
let s = await snap(); ok(same(s.stock, truth()) && s.stock.pantry1 === 5 && s.stock.pantry0 == null, 'الصورة بعد الاستيراد: ' + JSON.stringify(s.stock));
const o = await call('/order', { items: { pantry0: 3, pantry1: 1 }, phone: '0554000001', lat: 24.84, lng: 46.83 }); ok(o.ok, 'طلب');
await new Promise((r) => setTimeout(r, 16000)); // ذاكرة الخادم ١٥ ثانية
reads = 0; s = await snap(); ok(same(s.stock, truth()) && s.stock.pantry0 === 9 && s.stock.pantry1 === 4, 'بعد الطلب: pantry0 نزل تحت ١٠ ودخل الصورة: ' + JSON.stringify(s.stock));
ok(reads === 0, 'الزائر ما قرأ جدول المخزون (قرأ سطر الصورة بس): ' + reads);
ok((await call('/admin/order-edit', { ...A, no: o.orderNo, lines: [{ id: 'pantry0', qty: 1, price: 10 }, { id: 'pantry1', qty: 1, price: 10 }] })).ok, 'تعديل الطلب');
await new Promise((r) => setTimeout(r, 16000));
s = await snap(); ok(same(s.stock, truth()) && s.stock.pantry0 == null && s.stock.pantry1 === 4, 'بعد التعديل: pantry0 رجع ١١ وطلع من الصورة: ' + JSON.stringify(s.stock));
const st = await call('/driver/status', { ...A, no: o.orderNo, status: 'canceled', reason: 'test' });
await new Promise((r) => setTimeout(r, 16000));
s = await snap(); ok(st.ok && same(s.stock, truth()) && s.stock.pantry1 === 5, 'بعد الإلغاء رجع المخزون والصورة مطابقة: ' + JSON.stringify(s.stock) + ' ' + JSON.stringify(truth()) + ' ' + (st.code || ''));
// صورة مفقودة (أول تشغيل بعد التحديث): تنبني مرة وحدة
sq.exec("DELETE FROM stock_snap"); await new Promise((r) => setTimeout(r, 16000));
s = await snap(); ok(same(s.stock, truth()), 'الصورة تنبني من جديد لو مفقودة');
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
