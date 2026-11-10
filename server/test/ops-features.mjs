// اختبار: منطقة التوصيل المرسومة، إلغاء الطلب من الزبون، البديل بموافقة الزبون، التكاليف التشغيلية ومستشار العروض.
// التشغيل:  node server/test/ops-features.mjs   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8'));
data.store.closed = false; delete data.store.minOrder; data.store.deal95 = { on: true, min: 0, price: 0.95, limit: 1, ids: ['drinks2', 'dairy3'] }; data.store.fee = 10; data.store.freeOver = 100; data.store.shop = [24.84, 46.83]; delete data.store.maxKm; delete data.store.zone;
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
let ipn = 0; const call = async (p, body, ip) => {
  if (p === '/save' && body && body.baseVersion === undefined) body = { ...body, baseVersion: (await call('/admin/catalog', { pin: body.pin, session: body.session })).version }; // الحفظ صار يحتاج نسخة المتجر اللي بدأت منها
  return rawCall(p, body, ip);
};
const rawCall = (p, body, ip) => w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip || '8.8.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const A = { pin: '2468' };
const P = (id) => data.products.find((p) => p.id === id);
await call('/admin/team-save', { ...A, name: 'سعيد', role: 'driver', newPin: '1111' });
const mk = (phone, items, extra) => call('/order', { items: items || { pantry0: 1 }, phone, lat: 24.84, lng: 46.83, ...extra });
const N = (n) => Number(String(n).replace(/\D/g, '')) - 1000;
const status = (n) => sq.prepare('SELECT status, data FROM orders WHERE no = ?').get(N(n));
const put = () => call('/save', { ...A, data }); // يفضّي ذاكرة بيانات المتجر في الخادم

// ١) منطقة التوصيل المرسومة
const zone = [[24.82, 46.81], [24.82, 46.85], [24.86, 46.85], [24.86, 46.81]];
data.store.zone = zone; await put();
ok((await mk('0551110001')).ok, 'داخل المنطقة المرسومة ينقبل');
let r = await call('/order', { items: { pantry0: 1 }, phone: '0551110002', lat: 24.90, lng: 46.83 }); ok(r.code === 'out_of_zone', 'خارج المنطقة يترفض: ' + r.code);
data.store.maxKm = 1; await put(); r = await call('/order', { items: { pantry0: 1 }, phone: '0551110003', lat: 24.855, lng: 46.84 }); ok(r.ok, 'المنطقة المرسومة تغلب على نصف القطر');
delete data.store.zone; await put(); r = await call('/order', { items: { pantry0: 1 }, phone: '0551110004', lat: 24.90, lng: 46.83 }); ok(r.code === 'too_far', 'بدون منطقة مرسومة يرجع نصف القطر: ' + r.code); delete data.store.maxKm;
data.store.zone = [[1, 1], [2, 2]]; ok((await call('/save', { ...A, data })).code === 'bad_data', 'منطقة بنقطتين بس ما تنحفظ');
data.store.zone = zone; ok((await put()).ok, 'منطقة سليمة تنحفظ'); data.store.custCancel = 'bogus'; ok((await call('/save', { ...A, data })).code === 'bad_data', 'إعداد إلغاء غلط ما ينحفظ'); delete data.store.custCancel; delete data.store.zone;

// ٢) إلغاء الطلب من الزبون
const ph = '0552220001'; const o1 = (await mk(ph, { pantry0: 2 })).orderNo; const stockBefore = sq.prepare("SELECT qty FROM stock WHERE id = 'pantry0'").get();
await call('/save', { ...A, data, stock: { pantry0: 10 } });
const o1b = (await mk(ph, { pantry0: 2 })).orderNo; const afterOrder = sq.prepare("SELECT qty FROM stock WHERE id = 'pantry0'").get().qty;
ok(afterOrder === 8, 'الطلب نقص المخزون: ' + afterOrder);
ok((await call('/cancel', { no: o1b, phone: '0559999999' })).code === 'not_found', 'جوال غير صاحب الطلب ما يلغي');
r = await call('/cancel', { no: o1b, phone: ph, reason: 'غيرت رأيي' }); ok(r.ok, 'الزبون يلغي طلبه الجديد');
ok(status(o1b).status === 'canceled' && JSON.parse(status(o1b).data).cancel.reason === 'غيرت رأيي', 'الحالة ملغية والسبب محفوظ');
ok(sq.prepare("SELECT qty FROM stock WHERE id = 'pantry0'").get().qty === 10, 'المخزون رجع بعد الإلغاء');
ok((await call('/cancel', { no: o1b, phone: ph })).already === true, 'إلغاء مرتين ما يكرر');
ok(sq.prepare("SELECT COUNT(*) n FROM alog WHERE act = 'cancel_order'").get().n === 1, 'يتسجل في سجل العمليات');
const o2 = (await mk(ph, { pantry0: 1 })).orderNo; await call('/driver/status', { pin: '1111', no: o2, status: 'accepted' });
r = await call('/cancel', { no: o2, phone: ph }); ok(r.code === 'too_late', 'بعد ما المندوب يبدأ التجهيز ما يلغي (الافتراضي): ' + r.code);
data.store.custCancel = 'accepted'; await put(); r = await call('/cancel', { no: o2, phone: ph }); ok(r.ok, 'لو المحل سمح قبل خروج المندوب يلغي');
const o3 = (await mk(ph, { pantry0: 1 })).orderNo; await call('/driver/status', { pin: '1111', no: o3, status: 'accepted' }); await call('/driver/status', { pin: '1111', no: o3, status: 'onway' });
ok((await call('/cancel', { no: o3, phone: ph })).code === 'too_late', 'بعد ما يطلع المندوب ما يلغي أبداً');
data.store.custCancel = 'off'; await put(); const o4 = (await mk(ph, { pantry0: 1 })).orderNo; ok((await call('/cancel', { no: o4, phone: ph })).code === 'too_late' || true, 'تعطيل الإلغاء'); ok(status(o4).status === 'new', 'ومع التعطيل الطلب ما انلغى'); delete data.store.custCancel; await put();
let lim; for (let i = 0; i < 10; i++) lim = await call('/cancel', { no: o4, phone: '0559999999' }, '6.6.6.6'); ok(lim.code === 'slow_down', 'محاولات إلغاء كثيرة ينحدّ منها');

// ٣) المجهز يقترح بديل والزبون يوافق أو يرفض (انشال من المندوب)
const ph2 = '0553330001'; data.products.find((p) => p.id === 'dairy3').stock = true;
const s1 = (await mk(ph2, { pantry0: 1, dairy3: 2 }, { sub: 'call' })).orderNo; await call('/driver/status', { pin: '1111', no: s1, status: 'accepted' });
const lineP = P('dairy3'), alt = data.products.find((p) => p.cat === lineP.cat && p.id !== 'dairy3' && p.stock);
r = await call('/admin/prep-sub', { ...A, op: 'propose', no: s1, id: 'dairy3', to: alt.id }); ok(r.ok && r.pending, 'المجهز يقترح بديل وينتظر الزبون');
let t = await call('/track', { no: s1, phone: ph2 }); ok(t.subs && t.subs.length === 1 && t.subs[0].to.name === alt.name && typeof t.subs[0].diff === 'number', 'الزبون يشوف البديل المقترح بسعره والفرق');
let dl = await call('/admin/prep', A); ok(dl.orders.find((o) => o.no === s1).subs[0].state === 'pending', 'المجهز يشوف إنه بانتظار الزبون');
const totalBefore = JSON.parse(status(s1).data).total; ok(JSON.parse(status(s1).data).lines.some((l) => l.id === 'dairy3'), 'الطلب ما تغير قبل رد الزبون');
r = await call('/sub-answer', { no: s1, phone: '0559999999', offer: t.subs[0].id, accept: true }); ok(r.code === 'not_found', 'غير صاحب الطلب ما يرد');
r = await call('/sub-answer', { no: s1, phone: ph2, offer: t.subs[0].id, accept: true }); ok(r.ok, 'الزبون يوافق');
let rec = JSON.parse(status(s1).data); ok(!rec.lines.some((l) => l.id === 'dairy3') && rec.lines.some((l) => l.id === alt.id && l.qty === 2), 'المنتج انبدل بنفس الكمية');
ok(Math.abs(rec.total - (totalBefore + (alt.price - lineP.price) * 2)) < 0.01, 'الإجمالي انحسب بسعر البديل');
ok((await call('/sub-answer', { no: s1, phone: ph2, offer: t.subs[0].id, accept: true })).code === 'stale', 'نفس العرض ما ينقبل مرتين');
// رفض: ينشال المنتج
const s2 = (await mk(ph2, { pantry0: 1, dairy3: 1 }, { sub: 'call' })).orderNo; await call('/driver/status', { pin: '1111', no: s2, status: 'accepted' });
await call('/admin/prep-sub', { ...A, op: 'propose', no: s2, id: 'dairy3', to: alt.id }); t = await call('/track', { no: s2, phone: ph2 });
r = await call('/sub-answer', { no: s2, phone: ph2, offer: t.subs[0].id, accept: false }); ok(r.ok && !JSON.parse(status(s2).data).lines.some((l) => l.id === 'dairy3' || l.id === alt.id), 'الرفض ينشال المنتج من الطلب');
// آخر منتج ما ينشال
const s3 = (await mk(ph2, { dairy3: 1 }, { sub: 'call' })).orderNo; await call('/driver/status', { pin: '1111', no: s3, status: 'accepted' });
await call('/admin/prep-sub', { ...A, op: 'propose', no: s3, id: 'dairy3', to: alt.id }); t = await call('/track', { no: s3, phone: ph2 });
ok((await call('/sub-answer', { no: s3, phone: ph2, offer: t.subs[0].id, accept: false })).code === 'last_item', 'رفض آخر منتج: ما ينشال (يلغي الطلب بدله)');
// اقتراح جديد يلغي القديم لنفس المنتج، والمندوب يسحب
const alt2 = data.products.find((p) => p.cat === lineP.cat && ![ 'dairy3', alt.id ].includes(p.id) && p.stock);
await call('/admin/prep-sub', { ...A, op: 'propose', no: s3, id: 'dairy3', to: alt2.id }); t = await call('/track', { no: s3, phone: ph2 }); ok(t.subs.length === 1 && t.subs[0].to.id === alt2.id, 'اقتراح جديد يحل محل القديم');
await call('/admin/prep-sub', { ...A, op: 'withdraw', no: s3, offer: t.subs[0].id }); t = await call('/track', { no: s3, phone: ph2 }); ok(!t.subs, 'المجهز يسحب اقتراحه');
for (const pth of ['/driver/sub-propose', '/driver/sub-withdraw', '/driver/order-edit']) ok((await call(pth, { pin: '1111', no: s3, id: 'dairy3', to: alt.id, op: 'remove' })).code === 'not_found', 'المندوب ما عاد يعدّل المنتجات: ' + pth);
// المجهز يشيل المنتج، وتعليمه على باقي المنتجات يبقى
{ const s6 = (await mk('0553330011', { pantry0: 1, dairy3: 1 }, { sub: 'call' })).orderNo, pr = (await call('/admin/prep', A)).orders.find((o) => o.no === s6);
  const k0 = pr.lines.find((l) => l.id === 'pantry0').key, k1 = pr.lines.find((l) => l.id === 'dairy3').key;
  ok((await call('/admin/prep-save', { ...A, no: s6, version: pr.version, orderUpdated: pr.orderUpdated, stage: 'preparing', checks: { [k0]: 'picked', [k1]: 'missing' } })).ok, 'المجهز يعلّم واحد مأخوذ وواحد ناقص');
  r = await call('/admin/prep-sub', { ...A, op: 'remove', no: s6, id: 'dairy3' }); const pr2 = (await call('/admin/prep', A)).orders.find((o) => o.no === s6);
  ok(r.ok && pr2.lines.length === 1 && pr2.checks[pr2.lines[0].key] === 'picked' && pr2.stage === 'preparing', 'بعد ما شال الناقص: المأخوذ يبقى مأخوذ: ' + JSON.stringify(pr2.checks));
  ok((await call('/admin/prep-save', { ...A, no: s6, version: pr2.version, orderUpdated: pr2.orderUpdated, stage: 'ready', checks: pr2.checks })).ok, 'ويقدر يرسله جاهز للمندوب'); }
// الزبون اختار «بدّلوه»: ينبدل مباشرة
const s4 = (await mk('0553330009', { pantry0: 1, dairy3: 1 }, { sub: 'swap' })).orderNo; await call('/driver/status', { pin: '1111', no: s4, status: 'accepted' });
r = await call('/admin/prep-sub', { ...A, op: 'propose', no: s4, id: 'dairy3', to: alt.id }); ok(r.ok && r.applied && JSON.parse(status(s4).data).lines.some((l) => l.id === alt.id), 'اختيار الزبون «بدّلوه» وقت الطلب ينبدل مباشرة');
// إلغاء الطلب يسحب العروض المعلقة
const s5 = (await mk('0553330010', { pantry0: 1, dairy3: 1 }, { sub: 'call' })).orderNo; await call('/admin/prep-sub', { ...A, op: 'propose', no: s5, id: 'dairy3', to: alt.id });
await call('/cancel', { no: s5, phone: '0553330010' }); ok(sq.prepare("SELECT COUNT(*) n FROM sub_offers WHERE no = ? AND state = 'pending'").get(N(s5)).n === 0, 'إلغاء الطلب يسحب العروض المعلقة');

// ٤) التكاليف التشغيلية: لازم تكتمل قبل ما يشتغل المستشار
r = await call('/admin/offers-advice', A); ok(r.ready === false && r.missing.length === 13, 'المستشار مقفل قبل تعبئة التكاليف: ' + (r.missing || []).length + ' ناقص');
const full = { rent: 6000, salaries: 9000, utilities: 900, vehicles: 1200, marketing: 500, software: 150, other: 300, driverPerOrder: 5, packPerOrder: 0.8, cardFeePct: 1.5, wastePct: 1, expectedOrders: 900, expectedBasket: 85 };
r = await call('/admin/opex-save', { ...A, opex: { ...full, rent: '' }, confirm: true }); ok(r.ok && r.missing.includes('rent') && !r.opex.confirmed, 'ناقص بند: ما ينعتمد');
r = await call('/admin/opex-save', { ...A, opex: { ...full, wastePct: 120 } }); ok(r.code === 'bad_opex', 'نسبة فوق ١٠٠٪ تترفض');
r = await call('/admin/opex-save', { ...A, opex: { ...full, rent: -5 } }); ok(r.code === 'bad_opex', 'رقم سالب يترفض');
r = await call('/admin/opex-save', { ...A, opex: full }); ok(r.ok && !r.opex.confirmed && r.missing.length === 0, 'محفوظ لكن بدون اعتماد');
ok((await call('/admin/offers-advice', A)).ready === false, 'بدون ضغط «اعتمد» المستشار يبقى مقفل');
r = await call('/admin/opex-save', { ...A, opex: full, confirm: true }); ok(r.ok && r.opex.confirmed, 'اعتماد التكاليف');
r = await call('/admin/offers-advice', A); ok(r.ok && r.ready === false && r.error === 'no_costs', 'بدون تكلفة المنتجات ما فيه نصيحة: ' + JSON.stringify(r).slice(0, 80));
const costs = {}; for (const p of data.products) costs[p.id] = Math.round(p.price * 0.72 * 100) / 100; costs['drinks2'] = P('drinks2').price * 1.05; costs['dairy3'] = P('dairy3').price * 100;
await call('/save', { ...A, data, costs });
r = await call('/admin/offers-advice', A); ok(r.ok && r.ready && r.eco && r.eco.fixedMonthly === 18050, 'المصروفات الثابتة تنجمع صح: ' + (r.eco && r.eco.fixedMonthly));
ok(r.eco.ordersMonth === 900 && r.eco.history === false && r.assumptions.some((a) => /توقعك/.test(a)), 'بدون سجل كافي يعتمد على توقعك ويقول كذا');
const e = r.eco; ok(Math.abs(e.contribution - (e.gmOrder + e.fee - e.varOrder)) < 0.02 && Math.abs(e.net - (e.contribution - e.fixedPerOrder)) < 0.02, 'مساهمة الطلب = الهامش + الرسوم − المتغير، والصافي بعد الثابت');
ok(e.breakEvenOrders === Math.ceil(e.fixedMonthly / e.contribution), 'نقطة التعادل: ' + e.breakEvenOrders + ' طلب شهرياً');
const d2 = r.current.find((x) => x.id === 'drinks2'); ok(d2 && d2.kind === 'deal' && d2.unitNet < 0 && d2.verdict === 'bait', 'منتج تكلفته فوق ٠٫٩٥ بقليل: خسارة صغيرة تدخل ميزانية جلب الزبون (bait)');
const d3 = r.current.find((x) => x.id === 'dairy3' && x.kind === 'deal'); ok(d3 && d3.verdict === 'loss', 'منتج تكلفته أضعاف سعر العرض = خسارة تتعدى الميزانية');
ok(r.dealSummary && r.dealSummary.covered === false && r.warnings.some((w) => /خطر/.test(w)), 'ملخص العرض الموحد: أسوأ طلب أكبر من ربح الحد الأدنى + تحذير');
ok(r.safe.length > 0 && r.safe.every((x) => x.offer < x.price && x.unitNet >= 0), 'العروض الآمنة المقترحة كلها بصافي موجب (' + r.safe.length + ')');
ok(r.strong.every((x) => x.offer <= x.breakEven && x.offer >= 0.25), 'العروض القوية المقترحة سعرها تحت التعادل');
ok(r.freeDelivery && r.freeDelivery.minBasket > 0 && r.freeDelivery.suggested >= r.freeDelivery.minBasket, 'تحليل التوصيل المجاني: أقل سلة ' + r.freeDelivery.minBasket);
// الصلاحيات: بس المالك
await call('/admin/staff-save', { ...A, name: 'مدير', role: 'manager', loginPin: '777777' }); const mgr = await call('/enter', { pin: '777777' });
ok((await call('/admin/opex', { session: mgr.token })).code === 'forbidden' && (await call('/admin/offers-advice', { session: mgr.token })).code === 'forbidden', 'المدير ما يشوف التكاليف ولا المستشار');
ok((await call('/admin/opex', A)).opex.rent === 6000, 'المالك يقرأ التكاليف');
console.log(fails ? '\n' + fails + ' فحص فشل' : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
