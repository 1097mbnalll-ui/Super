// أكواد الخصم: إضافة من الإدارة، مبلغ ثابت ونسبة بحد أعلى، الحد الأدنى، الانتهاء، مرة لكل جوال، حد الاستخدام الكلي، التعديل، الإيصال، والصلاحيات. التشغيل: node server/test/promo-codes.mjs

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
{ const p0 = data.products.find((p) => p.id === 'pantry0'); p0.price = 2; p0.stock = true; delete p0.max; delete p0.packs; delete p0.old; }
const realNow = Date.now; const at = (d, h) => Date.UTC(2026, 10, d, h - 3);
const N = (n) => Number(String(n).replace(/\D/g, '')) - 1000;
const stock = () => sq.prepare("SELECT qty FROM stock WHERE id = 'pantry0'").get().qty;
const rec = (no) => JSON.parse(sq.prepare('SELECT data FROM orders WHERE no = ?').get(N(no)).data);
Date.now = () => at(13, 14);
ok((await call('/save', { ...A, data, stock: { pantry0: 5000 } })).ok, 'حفظ');
const ord = (q, phone, extra = {}) => call('/order', { items: { pantry0: q }, phone, lat: 24.84, lng: 46.83, ...extra });
let r = await call('/admin/promo-save', { ...A, code: 'ohod10', kind: 'amount', value: 10, min: 50 });
ok(r.ok && r.codes[0].code === 'OHOD10', 'إضافة كود (يتحول لحروف كبيرة)');
ok((await call('/admin/promo-save', { ...A, code: 'x', kind: 'amount', value: 5 })).code === 'bad_code', 'كود قصير مرفوض');
ok((await call('/admin/promo-save', { ...A, code: 'BIG', kind: 'percent', value: 95 })).code === 'bad_value', 'نسبة فوق ٩٠ مرفوضة');
r = await call('/promo/check', { code: ' ohod10 ' }); ok(r.ok && r.value === 10 && r.min === 50, 'فحص الكود للزبون');
ok((await call('/promo/check', { code: 'NOPE' })).code === 'promo_invalid', 'كود غلط');
r = await ord(20, '0553000001', { promo: 'OHOD10' }); ok(r.code === 'promo_min', 'أقل من الحد الأدنى: ' + r.code);
r = await ord(30, '0553000001', { promo: 'ohod10' }); ok(r.ok && r.total === 50 && r.promoAmt === 10, '٦٠ − ١٠ = ٥٠: ' + r.total);
const o1 = r.orderNo; ok(rec(o1).promo === 'OHOD10' && rec(o1).promoAmt === 10, 'الكود محفوظ في الطلب');
r = await ord(30, '0553000001', { promo: 'OHOD10' }); ok(r.code === 'promo_used', 'نفس الجوال مرة ثانية مرفوض');
r = await call('/promo/check', { code: 'OHOD10', phone: '0553000001' }); ok(r.code === 'promo_used', 'الفحص يعرف إن الجوال استخدمه');
// الكود ما يجتمع مع هدية الاعتذار
r = await ord(30, '0553000002', { promo: 'OHOD10', note: 'هدية اعتذار' }); ok(r.ok && r.total === 50 && !r.gift, 'الكود بدل الهدية (ما يجتمعون)');
// نسبة بحد أعلى، وحد استخدام كلي
ok((await call('/admin/promo-save', { ...A, code: 'RAMADAN', kind: 'percent', value: 20, cap: 15, maxUses: 2, perPhone: 0 })).ok, 'كود نسبة ٢٠٪ حده ١٥ ريال واستخدامين');
r = await ord(25, '0553000003', { promo: 'RAMADAN' }); ok(r.ok && r.promoAmt === 10 && r.total === 40, '٢٠٪ من ٥٠ = ١٠: ' + r.total);
const o2 = r.orderNo;
r = await ord(100, '0553000003', { promo: 'RAMADAN' }); ok(r.ok && r.promoAmt === 15 && r.total === 185, '٢٠٪ من ٢٠٠ بحد ١٥: ' + r.total);
r = await ord(25, '0553000004', { promo: 'RAMADAN' }); ok(r.code === 'promo_limit', 'خلص حد الاستخدام');
// التعديل يعيد الحساب
r = await call('/admin/order-edit', { ...A, no: o2, lines: [{ id: 'pantry0', qty: 40, price: 2 }] });
ok(r.ok && rec(o2).promoAmt === 15 && rec(o2).total === 65, 'تعديل لـ٨٠: ٢٠٪ بحد ١٥ = ٦٥: ' + rec(o2).total);
r = await call('/admin/order-edit', { ...A, no: o1, lines: [{ id: 'pantry0', qty: 20, price: 2 }] });
ok(r.ok && rec(o1).promoAmt === 0 && rec(o1).total === 40, 'تعديل تحت الحد الأدنى ينشال الخصم: ' + rec(o1).total);
const rc = await call('/admin/pos-receipt', { ...A, no: o2 }); ok(rc.ok && rc.document.total === 6500 && rc.document.gift === 1500, 'إيصال الكاشير: ' + JSON.stringify(rc.document && [rc.document.total, rc.document.gift]));
// إيقاف وانتهاء
ok((await call('/admin/promo-save', { ...A, code: 'OHOD10', kind: 'amount', value: 10, min: 50, active: false })).ok, 'إيقاف الكود');
ok((await ord(30, '0553000009', { promo: 'OHOD10' })).code === 'promo_invalid', 'الكود الموقوف مرفوض');
ok((await call('/admin/promo-save', { ...A, code: 'OLD', kind: 'amount', value: 5, until: at(13, 10) })).ok, 'كود منتهي');
ok((await ord(30, '0553000009', { promo: 'OLD' })).code === 'promo_expired', 'الكود المنتهي مرفوض');
const L = await call('/admin/promos', A); const rm = L.codes.find((c) => c.code === 'RAMADAN');
ok(rm && rm.used === 2 && rm.given === 30, 'القائمة فيها عدد الاستخدام والمبلغ: ' + JSON.stringify(rm && [rm.used, rm.given]));
ok((await call('/admin/promo-save', { ...A, code: 'OLD', remove: true })).codes.every((c) => c.code !== 'OLD'), 'حذف كود');
ok((await call('/admin/promos', { pin: '0000' })).ok === false, 'بدون رقم الإدارة ممنوع');
const v = await call('/admin/verify', A); ok(v.ok && v.clean, 'التحليل مطابق');
Date.now = realNow;
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
