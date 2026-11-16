// الدفع الإلكتروني (ميسّر): المرحلة الأولى، التأكد من الدفع، التنبيه، الترجيع. التشغيل: node server/test/pay-online.mjs

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
const env = { MOYASAR_SECRET: 'sk_test_x', MOYASAR_WEBHOOK_SECRET: 'hooksecret', GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O + ',capacitor://localhost', LOCKS, DB };
const gm = githubMock(() => data, async () => new Response('{"ok":true}'), true);
const PAYS = {}, REFUNDS = [];
globalThis.fetch = async (u, o) => { const s = String(u && u.url || u);
  if (s.startsWith('https://api.moyasar.com/v1/payments/')) {
    const m = s.match(/payments\/([^/]+)(\/refund)?$/); const id = decodeURIComponent(m[1]);
    if ((o && o.headers && o.headers.Authorization) !== 'Basic ' + btoa('sk_test_x:')) return new Response('{}', { status: 401 });
    if (m[2]) { REFUNDS.push([id, JSON.parse(o.body).amount]); return new Response('{"status":"refunded"}'); }
    return PAYS[id] ? new Response(JSON.stringify(PAYS[id])) : new Response('{}', { status: 404 }); }
  return gm(u, o); };
let ipn = 0;
const call = async (p, body, hdr = {}) => { if (p === '/save' && body.baseVersion === undefined) body = { ...body, baseVersion: (await call('/admin/catalog', { pin: body.pin })).version }; return w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '7.2.' + (ipn++ % 250) + '.1', ...hdr }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json()); };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const A = { pin: '2468' };
const N = (n) => Number(String(n).replace(/\D/g, '')) - 1000; const rec = (no) => JSON.parse(sq.prepare('SELECT data FROM orders WHERE no = ?').get(N(no)).data);
const P1 = data.products.find((p) => p.id === 'pantry0'); P1.price = 10; P1.stock = true; delete P1.max; delete P1.old; delete P1.packs;
ok((await call('/save', { ...A, data, stock: { pantry0: 20 } })).ok, 'حفظ');
const stockOf = (id) => (sq.prepare('SELECT qty FROM stock WHERE id = ?').get(id) || {}).qty;
const loc = { lat: 24.84, lng: 46.83 };
const hook = (b) => w.fetch(new Request('https://x.dev/pay/hook', { method: 'POST', headers: { 'CF-Connecting-IP': '9.9.9.9' }, body: JSON.stringify(b) }), env, { waitUntil() {} }).then((r) => r.json());
const ord = { items: { pantry0: 3 }, phone: '0557300001', name: 'سارة', details: 'بيت ٣', ...loc, pay: 'online' };

// ١) الدفع مطفي من ملف المتجر: يرفض
let r = await call('/order', ord); ok(!r.ok && r.code === 'pay_off', 'الدفع الإلكتروني مطفي: ' + r.code);
data.store.pay = { on: true, pk: 'pk_test_x' }; ok((await call('/save', { ...A, data })).ok, 'تشغيل الدفع');

// ٢) المرحلة الأولى: ما ينسجل طلب، يرجع رقم الدفع والمبلغ بالهللة
const before = sq.prepare('SELECT COUNT(*) n FROM orders').get().n;
r = await call('/order', ord); ok(r.ok && r.pay && /^p[0-9a-f]{24}$/.test(r.payRef) && r.amount === Math.round(r.total * 100), 'المرحلة الأولى: رقم الدفع والمبلغ ' + JSON.stringify([r.payRef, r.amount, r.total]));
ok(sq.prepare('SELECT COUNT(*) n FROM orders').get().n === before, 'ما انسجل طلب قبل الدفع');
const ref = r.payRef, amount = r.amount;

// ٣) رقم دفع ما اندفع / مبلغ غلط / رقم طلب ثاني: يرفض
PAYS.pay_fail = { id: 'pay_fail', status: 'failed', amount, currency: 'SAR', metadata: { ref }, source: { type: 'creditcard', message: 'رفض البنك' } };
r = await call('/pay/finish', { ref, id: 'pay_fail' }); ok(!r.ok && r.code === 'pay_failed', 'دفع فاشل ما يسجّل طلب: ' + r.code);
PAYS.pay_low = { id: 'pay_low', status: 'paid', amount: amount - 100, currency: 'SAR', metadata: { ref } };
r = await call('/pay/finish', { ref, id: 'pay_low' }); ok(!r.ok && r.code === 'not_paid', 'مبلغ أقل يرفض: ' + r.code);
PAYS.pay_other = { id: 'pay_other', status: 'paid', amount, currency: 'SAR', metadata: { ref: 'p' + '0'.repeat(24) } };
r = await call('/pay/finish', { ref, id: 'pay_other' }); ok(!r.ok && r.code === 'not_paid', 'دفع لطلب ثاني يرفض: ' + r.code);
r = await call('/order', { ...ord, paid: { id: 'x', amount }, payRef: ref }); ok(r.ok && r.pay && !r.orderNo, 'الزبون ما يقدر يزوّر «مدفوع» من المتصفح');
ok(sq.prepare('SELECT COUNT(*) n FROM orders').get().n === before, 'ولا طلب انسجل');

// ٤) الدفع الصح: ينسجل الطلب مرة وحدة (الرجوع من صفحة الدفع + تنبيه ميسّر)
PAYS.pay_ok = { id: 'pay_ok', status: 'paid', amount, currency: 'SAR', metadata: { ref }, source: { type: 'applepay' }, created_at: '2026-11-16T18:00:00Z' };
r = await call('/pay/finish', { ref, id: 'pay_ok' }); ok(r.ok && r.paid && /^#\d+$/.test(r.orderNo), 'بعد الدفع الطلب انسجل: ' + JSON.stringify([r.ok, r.code, r.orderNo]));
const no = r.orderNo, rec0 = rec(no);
ok(rec0.pay === 'online' && rec0.paid && rec0.paid.id === 'pay_ok' && rec0.paid.amount === amount && rec0.paid.via === 'applepay', 'الطلب «مدفوع إلكترونياً» برقم العملية');
let h = await hook({ type: 'payment_paid', secret_token: 'hooksecret', data: PAYS.pay_ok });
ok(h.ok && h.orderNo === no, 'تنبيه ميسّر بعدها ما يكرر الطلب: ' + JSON.stringify([h.ok, h.code, h.orderNo]));
ok(sq.prepare('SELECT COUNT(*) n FROM orders').get().n === before + 1, 'طلب واحد بس');
h = await hook({ type: 'payment_paid', secret_token: 'wrong', data: PAYS.pay_ok }); ok(!h.ok && h.code === 'bad_token', 'تنبيه بسر غلط يرفض');

// ٥) الزبون سكّر الصفحة بعد الدفع: تنبيه ميسّر لحاله يسجّل الطلب
r = await call('/order', { ...ord, phone: '0557300002' }); const ref2 = r.payRef;
PAYS.pay_ok2 = { id: 'pay_ok2', status: 'paid', amount: r.amount, currency: 'SAR', metadata: { ref: ref2 }, source: { type: 'mada' } };
h = await hook({ type: 'payment_paid', secret_token: 'hooksecret', data: PAYS.pay_ok2 }); ok(h.ok && h.orderNo, 'التنبيه لحاله يسجّل الطلب: ' + JSON.stringify([h.ok, h.code]));

// ٦) الكاش والتحصيل: المدفوع إلكترونياً ما يدخل في كاش المندوب، والتحليل مطابق
ok((await call('/admin/order-edit', { ...A, no, lines: [{ id: 'pantry0', qty: 3, price: 10 }] })).ok, 'تعديل طلب مدفوع');
await call('/admin/team-save', { ...A, name: 'سعيد', role: 'driver', newPin: '1357' });
for (const st of ['accepted', 'onway', 'delivered']) await call('/driver/status', { pin: '1357', no, status: st });
const cash = await call('/driver/cash', { pin: '1357' }); ok(cash.ok && JSON.stringify(cash).indexOf('"cash":0') > -1 || (cash.today && cash.today.cash === 0), 'المندوب ما عليه كاش لطلب مدفوع: ' + JSON.stringify(cash.today || cash).slice(0, 160));
let v = await call('/admin/verify', A); ok(v.ok && v.clean, 'التحليل مطابق');

// ٧) خلص المنتج بعد الدفع: نرجّع المبلغ كامل، وما ينسجل طلب
r = await call('/order', { ...ord, phone: '0557300003' }); const ref3 = r.payRef, am3 = r.amount;
sq.prepare("INSERT INTO stock (id, qty) VALUES ('pantry0', 0) ON CONFLICT(id) DO UPDATE SET qty = 0").run();
PAYS.pay_ok3 = { id: 'pay_ok3', status: 'paid', amount: am3, currency: 'SAR', metadata: { ref: ref3 } };
r = await call('/pay/finish', { ref: ref3, id: 'pay_ok3' }); ok(!r.ok && r.code === 'unavailable' && r.refunded === true, 'خلص بعد الدفع: يرفض ويرجّع: ' + JSON.stringify([r.code, r.refunded]));
ok(REFUNDS.some((x) => x[0] === 'pay_ok3' && x[1] === am3), 'انطلب ترجيع المبلغ كامل من ميسّر');
sq.prepare("DELETE FROM stock WHERE id = 'pantry0'").run();

// ٨) إلغاء طلب مدفوع: يرجع المبلغ تلقائي
const no2 = h.orderNo; const am2 = rec(no2).paid.amount;
ok((await call('/cancel', { no: no2, phone: '0557300002', reason: 'طلبته بالغلط' })).ok, 'الزبون لغى طلبه المدفوع');
await new Promise((res) => setTimeout(res, 50));
ok(REFUNDS.some((x) => x[0] === 'pay_ok2' && x[1] === am2), 'المبلغ رجع تلقائي بعد الإلغاء');
v = await call('/admin/verify', A); ok(v.ok && v.clean, 'التحليل مطابق بعد الإلغاء');
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
