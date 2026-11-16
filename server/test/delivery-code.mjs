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

// ١) طلب الموقع: له رمز، الزبون يشوفه، والمندوب ما يشوفه
const o1 = await mkOrder('0557200001');
const code = rec(o1).dc; ok(/^\d{4}$/.test(code), 'الطلب له رمز ٤ أرقام: ' + code);
let tk = await call('/track', { no: o1, phone: '0557200001' }); ok(tk.dc === code, 'الزبون يشوف الرمز في المتابعة');
tk = await call('/track', { no: o1, phone: '0550000000' }); ok(!tk.ok && !tk.dc, 'جوال غلط ما يشوف الرمز');
let dl = await call('/driver/orders', D); let dO = dl.orders.find((o) => o.no === o1);
ok(dO && dO.needCode === true && dO.dc === undefined && !JSON.stringify(dl).includes('"dc"'), 'المندوب يعرف إن الطلب يحتاج رمز وما يشوف الرمز نفسه');
ok((await toWay(o1)).ok, 'في الطريق');
// ٢) بدون رمز / رمز غلط: ما يسلّم
let st = await call('/driver/status', { ...D, no: o1, status: 'delivered' }); ok(!st.ok && st.code === 'need_code', 'بدون رمز مرفوض: ' + st.code);
const wrong = code === '1234' ? '4321' : '1234';
st = await call('/driver/status', { ...D, no: o1, status: 'delivered', code: wrong }); ok(!st.ok && st.code === 'bad_code', 'رمز غلط مرفوض: ' + st.code);
ok(sq.prepare('SELECT status FROM orders WHERE no = ?').get(N(o1)).status === 'onway', 'الطلب باقي في الطريق');
// ٣) الرمز الصح (بأرقام عربية) وقريب من البيت: يسلّم بدون تنبيه
const ar = code.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
st = await call('/driver/status', { ...D, no: o1, status: 'delivered', code: ar, lat: 24.8402, lng: 46.8301 }); ok(st.ok, 'الرمز الصح يسلّم: ' + JSON.stringify(st.code || 'ok'));
let ck = sq.prepare('SELECT * FROM dchecks WHERE no = ?').get(N(o1)); ok(ck && ck.code === 1 && ck.dist < 50 && ck.warn === 0, 'الفحص: بالرمز وقريب: ' + JSON.stringify(ck));
tk = await call('/track', { no: o1, phone: '0557200001' }); ok(tk.ok && !tk.dc, 'بعد التسليم الرمز ما يرجع');
let ad = await call('/admin/orders', { ...A, limit: 20 }); let aO = ad.orders.find((o) => o.no === o1); ok(aO && aO.dchk && aO.dchk.code === true && aO.dchk.warn === false, 'الإدارة تشوف «سلّم بالرمز»');

// ٤) بعيد عن البيت: يسلّم بس ينبّه الإدارة
const o2 = await mkOrder('0557200002'); await toWay(o2);
st = await call('/driver/status', { ...D, no: o2, status: 'delivered', code: rec(o2).dc, lat: 24.86, lng: 46.83 }); ok(st.ok, 'بالرمز وهو بعيد: يسلّم');
ck = sq.prepare('SELECT * FROM dchecks WHERE no = ?').get(N(o2)); ok(ck && ck.dist > 2000 && ck.warn === 1, 'ينحفظ «بعيد» وتنبيه: ' + JSON.stringify(ck && [ck.dist, ck.warn]));

// ٥) الزبون ما عنده الرمز: يسلّم بسبب، ويطلع للإدارة
const o3 = await mkOrder('0557200003'); await toWay(o3);
st = await call('/driver/status', { ...D, no: o3, status: 'delivered', skip: 'الزبون ما فتح الموقع' }); ok(st.ok, 'بدون رمز مع سبب: يسلّم');
ck = sq.prepare('SELECT * FROM dchecks WHERE no = ?').get(N(o3)); ok(ck && ck.code === 0 && ck.skip === 'الزبون ما فتح الموقع' && ck.warn === 1, 'ينحفظ السبب وتنبيه');

// ٦) تخمين الرمز: بعد ٦ محاولات يوقف
const o4 = await mkOrder('0557200004'); await toWay(o4);
const c4 = rec(o4).dc; let lastCode = '';
for (let i = 0; i < 8; i++) { const g = String(1000 + i); if (g === c4) continue; lastCode = (await call('/driver/status', { ...D, no: o4, status: 'delivered', code: g })).code; }
ok(lastCode === 'slow_down', 'التخمين يوقف بعد محاولات: ' + lastCode);

// ٧) طلب من التطبيق (ما يعرض الرمز للحين) أو من الإدارة: بدون رمز، والتسليم عادي
const o5 = await mkOrder('0557200005', { Origin: 'capacitor://localhost' });
ok(o5 && !rec(o5).dc, 'طلب التطبيق بدون رمز');
await toWay(o5); st = await call('/driver/status', { ...D, no: o5, status: 'delivered' }); ok(st.ok, 'طلب التطبيق يسلّم بدون رمز');
const o6 = (await call('/admin/order-new', { ...A, source: 'whatsapp', phone: '0557200006', lines: [{ id: 'pantry0', qty: 1, price: 10 }] })).order;
ok(o6 && !o6.dc, 'طلب الواتساب بدون رمز');
// ٨) الإدارة تقدر تسلّم بدون رمز، وتعديل الطلب ما يمسح الرمز
const o7 = await mkOrder('0557200007'); const c7 = rec(o7).dc;
ok((await call('/admin/order-edit', { ...A, no: o7, lines: [{ id: 'pantry0', qty: 4, price: 10 }] })).ok && rec(o7).dc === c7, 'تعديل الطلب يحافظ على الرمز');
st = await call('/driver/status', { ...A, no: o7, status: 'delivered' }); ok(st.ok, 'الإدارة تسلّم بدون رمز');
const v = await call('/admin/verify', A); ok(v.ok && v.clean, 'التحليل مطابق');
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
