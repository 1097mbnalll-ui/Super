// «هدية اعتذار»: خصم ٥ على طلب ٣٠ وفوق، مرة لكل جوال، لين نهاية ١٥ نوفمبر، ويبقى بعد التعديل، والإيصال يقبله. التشغيل: node server/test/apology-gift.mjs

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
ok((await call('/save', { ...A, data, stock: { pantry0: 1000 } })).ok, 'حفظ');
const G = 'هدية اعتذار';
let r = await call('/order', { items: { pantry0: 15 }, phone: '0552000001', lat: 24.84, lng: 46.83, note: G });
ok(r.ok && r.total === 25 && r.gift === 5, '٣٠ مع الهدية = ٢٥: ' + r.total);
ok(rec(r.orderNo).gift === 5 && rec(r.orderNo).total === 25, 'الهدية محفوظة في الطلب');
const first = r.orderNo;
r = await call('/order', { items: { pantry0: 20 }, phone: '0552000001', lat: 24.84, lng: 46.83, note: G });
ok(r.ok && r.total === 40 && !r.gift, 'نفس الجوال مرة ثانية بدون هدية: ' + r.total);
r = await call('/order', { items: { pantry0: 14 }, phone: '0552000002', lat: 24.84, lng: 46.83, note: G });
ok(r.ok && r.total === 28 && !r.gift, 'أقل من ٣٠ بدون هدية');
r = await call('/order', { items: { pantry0: 15 }, phone: '0552000003', lat: 24.84, lng: 46.83, note: 'ابغى هديه الاعتذار لو سمحت' });
ok(r.ok && r.total === 25, 'صيغة ثانية للعبارة تنقبل');
r = await call('/order', { items: { pantry0: 15 }, phone: '0552000004', lat: 24.84, lng: 46.83, note: 'الخبز حار' });
ok(r.ok && r.total === 30, 'بدون العبارة بدون هدية');
// تعديل الطلب يحتفظ بالهدية ما دام ٣٠ وفوق
r = await call('/admin/order-edit', { ...A, no: first, lines: [{ id: 'pantry0', qty: 20, price: 2 }] });
ok(r.ok && rec(first).total === 35 && rec(first).gift === 5, 'تعديل لـ٤٠ يبقى بهدية = ٣٥: ' + rec(first).total);
r = await call('/admin/order-edit', { ...A, no: first, lines: [{ id: 'pantry0', qty: 10, price: 2 }] });
ok(r.ok && rec(first).total === 20 && !rec(first).gift, 'تعديل لـ٢٠ تنشال الهدية: ' + rec(first).total);
// إلغاء طلب الهدية يرجّع حق الجوال
const g3 = await call('/order', { items: { pantry0: 15 }, phone: '0552000005', lat: 24.84, lng: 46.83, note: G });
await call('/admin/status', { ...A, no: g3.orderNo, status: 'canceled' }).catch(() => {});
const rcp = await call('/admin/pos-receipt', { ...A, no: (await call('/order', { items: { pantry0: 16 }, phone: '0552000006', lat: 24.84, lng: 46.83, note: G })).orderNo });
ok(rcp.ok && rcp.document && rcp.document.total === 2700 && rcp.document.gift === 500, 'إيصال الكاشير يقبل الهدية: ' + JSON.stringify(rcp.document && { t: rcp.document.total, g: rcp.document.gift, e: rcp.code }));
Date.now = () => at(16, 0) + 3600e3;
r = await call('/order', { items: { pantry0: 15 }, phone: '0552000007', lat: 24.84, lng: 46.83, note: G });
ok(r.ok && r.total === 30, 'بعد نهاية ١٥ نوفمبر ما فيه هدية');
const v = await call('/admin/verify', A); ok(v.ok && (v.clean ?? !(v.diffs || []).length), 'التحليل مطابق: ' + JSON.stringify(v).slice(0, 160));
Date.now = realNow;
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
