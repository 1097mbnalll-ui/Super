// رمز الاستلام وفحص مكان المندوب عند التسليم (١٦ نوفمبر ٢٠٢٦). التشغيل: node server/test/delivery-code.mjs

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
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O + ',capacitor://localhost', LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
let ipn = 0;
const call = async (p, body, hdr = {}) => { if (p === '/save' && body.baseVersion === undefined) body = { ...body, baseVersion: (await call('/admin/catalog', { pin: body.pin })).version }; return w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '7.2.' + (ipn++ % 250) + '.1', ...hdr }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json()); };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const A = { pin: '2468' };
const N = (n) => Number(String(n).replace(/\D/g, '')) - 1000; const rec = (no) => JSON.parse(sq.prepare('SELECT data FROM orders WHERE no = ?').get(N(no)).data);
const P1 = data.products.find((p) => p.id === 'pantry0'); P1.price = 10; P1.stock = true; delete P1.max; delete P1.old; delete P1.packs;
ok((await call('/save', { ...A, data, stock: { pantry0: 20 } })).ok, 'حفظ');
const stockOf = (id) => (sq.prepare('SELECT qty FROM stock WHERE id = ?').get(id) || {}).qty;
const loc = { lat: 24.84, lng: 46.83 };
ok((await call('/admin/team-save', { ...A, name: 'سعيد', role: 'driver', newPin: '1357' })).ok, 'مندوب');
const D = { pin: '1357' };
const mkOrder = async (phone, hdr) => { const r = await call('/order', { items: { pantry0: 3 }, phone, ...loc }, hdr); ok(r.ok, 'طلب ' + phone + ': ' + JSON.stringify(r.code || 'ok')); return r.orderNo; };
const toWay = async (no) => { await call('/driver/status', { ...D, no, status: 'accepted' }); return call('/driver/status', { ...D, no, status: 'onway' }); };

// رمز الاستلام موقوف بقرار المالك (١٦ نوفمبر ٢٠٢٦): ما ينولد رمز، والمندوب يسلّم بدونه، وفحص المكان باقي
const o1 = await mkOrder('0557200001');
ok(!rec(o1).dc, 'الطلب بدون رمز');
let tk = await call('/track', { no: o1, phone: '0557200001' }); ok(tk.ok && !tk.dc, 'المتابعة بدون رمز');
let dl = await call('/driver/orders', D); let dO = dl.orders.find((o) => o.no === o1); ok(dO && dO.needCode === false, 'المندوب ما يُطلب منه رمز');
await toWay(o1);
let st = await call('/driver/status', { ...D, no: o1, status: 'delivered', lat: 24.86, lng: 46.83 }); ok(st.ok, 'يسلّم بدون رمز');
let ck = sq.prepare('SELECT * FROM dchecks WHERE no = ?').get(N(o1)); ok(ck && ck.dist > 2000 && ck.warn === 1 && ck.skip === '', 'فحص المكان باقي (بعيد = تنبيه)');
const o2 = await mkOrder('0557200002'); await toWay(o2);
st = await call('/driver/status', { ...D, no: o2, status: 'delivered', lat: 24.8402, lng: 46.8301 }); ck = sq.prepare('SELECT * FROM dchecks WHERE no = ?').get(N(o2));
ok(st.ok && ck.warn === 0, 'قريب من البيت: بدون تنبيه');
// طلب قديم انحفظ له رمز قبل الإيقاف: يتسلّم بدونه
const o3 = await mkOrder('0557200003'); const r3 = rec(o3); r3.dc = '1234'; sq.prepare('UPDATE orders SET data = ? WHERE no = ?').run(JSON.stringify(r3), N(o3)); await toWay(o3);
st = await call('/driver/status', { ...D, no: o3, status: 'delivered' }); ok(st.ok, 'طلب له رمز قديم يتسلّم بدونه');
const v = await call('/admin/verify', A); ok(v.ok && v.clean, 'التحليل مطابق');
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
