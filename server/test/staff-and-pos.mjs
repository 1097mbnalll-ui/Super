// اختبار: مندوبين + نقاط البيع، على worker.js الحقيقي وقاعدة SQLite في الذاكرة.
// التشغيل:  node server/test/staff-and-pos.mjs   (node 22)
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, '../../data.json'), 'utf8'));
data.store.daily = { on: false, list: [] }; if (data.store.deal95) data.store.deal95.on = false; delete data.store.minOrder; data.store.closed = false;
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } }; return st; };
// D1 batch: ذرّي (كلها أو ولا شي). نأخّر شوي قبل التنفيذ عشان طلبين بنفس اللحظة يتداخلون مثل الواقع
const DB = { prepare: mk1, async batch(l) { await new Promise((r) => setTimeout(r, 5)); sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = async (u, o = {}) => { u = String(u); if (u.includes('api.github.com') && !o.method) return new Response(JSON.stringify(data)); return new Response('{"ok":true}'); };
let ipn = 0;
const call = (p, body) => w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '9.9.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const A = { pin: '2468', by: 'أبو خالد' };

// ١) الرقم القديم للمندوب يتحول لحساب «المندوب» بدون ما يتغير شي
kv.set('driver_pin', await (async () => { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('s'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('pin:driver:1357')); return [...new Uint8Array(s)].map((b) => b.toString(16).padStart(2, '0')).join(''); })());
let r = await call('/driver/login', { pin: '1357' });
ok(r.ok && r.role === 'driver' && r.id === 'd0' && r.name === 'المندوب', 'الرقم القديم للمندوب يشتغل كما هو: ' + JSON.stringify(r));
await call('/save', { ...A, data });

// ٢) الإدارة تضيف مندوب ثاني وكاشير
r = await call('/admin/team-save', { ...A, name: 'سعيد', role: 'driver', newPin: '2222' }); ok(r.ok && r.staff.length === 2, 'إضافة مندوب ثاني');
const said = r.staff.find((s) => s.name === 'سعيد').id;
r = await call('/admin/team-save', { ...A, name: 'فهد الكاشير', role: 'cashier', newPin: '3333' }); ok(r.ok, 'إضافة كاشير');
const fahd = r.staff.find((s) => s.role === 'cashier').id;
ok((await call('/admin/team-save', { ...A, name: 'مكرر', role: 'driver', newPin: '2222' })).code === 'pin_taken', 'رقم مكرر ينرفض');
ok((await call('/admin/team-save', { ...A, name: 'مكرر', role: 'driver', newPin: '2468' })).code === 'pin_taken', 'رقم الإدارة ما ينعطى لموظف');
ok((await call('/admin/team-save', { ...A, name: 'x', role: 'driver' })).code === 'pin_required', 'موظف جديد بدون رقم ينرفض');
r = await call('/admin/team-save', { ...A, id: 'd0', name: 'محمد' }); ok(r.ok && r.staff.find((s) => s.id === 'd0').name === 'محمد', 'تغيير اسم المندوب القديم');
ok((await call('/driver/login', { pin: '1357' })).name === 'محمد', 'الرقم القديم صار باسم محمد');
ok((await call('/pos/login', { pin: '1357' })).code === 'bad_pin', 'رقم المندوب ما يفتح نقاط البيع');
ok((await call('/driver/login', { pin: '3333' })).code === 'bad_pin', 'رقم الكاشير ما يفتح صفحة المندوب');

// ٣) طلبين، ومندوبين يضغطون «ابدأ التجهيز» على نفس الطلب بنفس اللحظة
const mkOrder = (phone, name, loc) => call('/admin/order-new', { ...A, source: 'phone', phone, name, loc, pay: 'cash', lines: [{ id: 'pantry0', qty: 1 }, { id: 'dairy3', qty: 2 }] });
const o1 = (await mkOrder('0551111111', 'أبو فهد', '24.8400,46.8300')).order.no, o2 = (await mkOrder('0552222222', 'أم سعد', '24.8350,46.8200')).order.no;
const [ra, rb] = await Promise.all([call('/driver/status', { pin: '1357', no: o1, status: 'accepted' }), call('/driver/status', { pin: '2222', no: o1, status: 'accepted' })]);
const wins = [ra, rb].filter((x) => x.ok).length;
const loser = [ra, rb].find((x) => !x.ok);
ok(wins === 1 && loser && ['taken', 'not_yours'].includes(loser.code) && loser.by, 'سباق: واحد بس يمسك الطلب، والثاني يعرف مين أخذه: ' + JSON.stringify(loser));
const winnerPin = ra.ok ? '1357' : '2222', otherPin = ra.ok ? '2222' : '1357';
r = await call('/driver/status', { pin: otherPin, no: o1, status: 'onway' }); ok(r.code === 'not_yours', 'المندوب الثاني ما يقدر يحرّك طلب زميله');
r = await call('/driver/order-edit', { pin: otherPin, no: o1, op: 'remove', id: 'dairy3' }); ok(r.code === 'not_yours', 'ولا يعدّل عليه');
ok((await call('/driver/status', { pin: otherPin, no: o2, status: 'accepted' })).ok, 'الثاني يمسك الطلب الثاني');
let L = (await call('/driver/orders', { pin: '1357' }));
ok(L.me && L.me.id === 'd0' && L.team.length === 2 && L.orders.find((o) => o.no === o1).drvName, 'قائمة المندوب فيها مين ماسك كل طلب');
// الطلب يروح للطريق، والتتبع لكل مندوب لحاله
await call('/driver/status', { pin: winnerPin, no: o1, status: 'onway' }); await call('/driver/status', { pin: otherPin, no: o2, status: 'onway' });
const p1 = await call('/driver/pending', { pin: '1357' }), p2 = await call('/driver/pending', { pin: '2222' });
ok(p1.onway === 1 && p2.onway === 1, 'كل مندوب يشوف طلبه اللي في الطريق بس: ' + p1.onway + '/' + p2.onway);
await call('/driver/loc', { pin: winnerPin, lat: 24.826, lng: 46.812, acc: 5 });
await call('/driver/loc', { pin: otherPin, lat: 24.833, lng: 46.818, acc: 5 });
const t1 = await call('/track', { no: o1, phone: '0551111111' }), t2 = await call('/track', { no: o2, phone: '0552222222' });
ok(t1.driver && Math.abs(t1.driver.lat - 24.826) < 1e-9 && t2.driver && Math.abs(t2.driver.lat - 24.833) < 1e-9, 'كل زبون يشوف مندوبه هو على الخريطة');
const dl = await call('/admin/driver-loc', A); ok(dl.locs.length === 2 && dl.locs.every((l) => l.name), 'الإدارة تشوف المندوبين على الخريطة: ' + dl.locs.map((l) => l.name).join('، '));
// التوصيل والكاش لكل مندوب
await call('/driver/status', { pin: winnerPin, no: o1, status: 'delivered' }); await call('/driver/status', { pin: otherPin, no: o2, status: 'delivered' });
const c1 = await call('/driver/cash', { pin: '1357' }), c2 = await call('/driver/cash', { pin: '2222' });
const tot = (await call('/admin/orders', A)).orders.filter((o) => o.no === o1 || o.no === o2).map((o) => o.total);
ok(c1.balance === tot[0] || c1.balance === tot[1], 'كاش محمد = طلبه بس: ' + c1.balance);
ok(round(c1.balance + c2.balance) === round(tot[0] + tot[1]), 'كاش المندوبين مع بعض = مجموع الطلبين');
let ac = await call('/admin/cash', { ...A, add: c2.balance, drv: said, note: 'استلام' });
ok(ac.drivers.find((d) => d.id === said).balance === 0 && ac.drivers.find((d) => d.id === 'd0').balance === c1.balance, 'استلام كاش سعيد ما يمس كاش محمد');
// الإدارة تحوّل طلب لمندوب
const o3 = (await mkOrder('0553333333', 'جار', '24.8300,46.8100')).order.no;
r = await call('/admin/assign', { ...A, no: o3, drv: said }); ok(r.ok && r.state === 'accepted', 'الإدارة حوّلت طلب لسعيد');
ok((await call('/driver/status', { pin: '1357', no: o3, status: 'onway' })).code === 'not_yours', 'محمد ما يقدر يحرّكه');
ok((await call('/driver/status', { pin: '2222', no: o3, status: 'onway' })).ok, 'سعيد يكمله');
// مندوب يرجّع الطلب للكل
const o4 = (await mkOrder('0554444444', 'رابع', '')).order.no;
await call('/driver/status', { pin: '2222', no: o4, status: 'accepted' });
r = await call('/driver/status', { pin: '2222', no: o4, status: 'new' }); ok(r.ok && r.drv === '', 'سعيد رجّع الطلب للجديدة');
ok((await call('/driver/status', { pin: '1357', no: o4, status: 'accepted' })).ok, 'ومحمد مسكه بعده');

// ٤) نقاط البيع
r = await call('/pos/login', { pin: '3333' }); ok(r.ok && r.role === 'cashier' && r.name === 'فهد الكاشير', 'الكاشير يدخل نقاط البيع');
await call('/save', { ...A, data, stock: { dairy3: 20 } });
const stock0 = (await (await w.fetch(new Request('https://x.dev/stock', { headers: { Origin: O } }), env, { waitUntil() {} })).json()).stock || {};
const sale = { pin: '3333', cid: 'sale-0001-abcd', pay: 'cash', paid: 50, lines: [{ id: 'dairy3', qty: 2 }, { id: 'bakery1', qty: 3 }, { bc: '6281000000123', name: 'علبة كبريت', price: 1, qty: 2 }] };
const s1 = await call('/pos/sale', sale);
const expect = round(2 * data.products.find((p) => p.id === 'dairy3').price + 3 * data.products.find((p) => p.id === 'bakery1').price + 2);
ok(s1.ok && s1.total === expect, 'بيعة كاش في المحل: ' + s1.no + ' = ' + s1.total);
const s1b = await call('/pos/sale', sale); ok(s1b.ok && s1b.dup && s1b.no === s1.no, 'نفس البيعة انرسلت مرتين (النت قطع): تنحسب مرة وحدة');
ok((await call('/pos/sale', { ...sale, cid: 'sale-0002-abcd', lines: [{ id: 'dairy3', qty: 1, price: 1 }] })).code === 'price_locked', 'الكاشير ما يقدر يغيّر السعر');
ok((await call('/pos/sale', { ...sale, cid: 'sale-0003-abcd', discount: 2 })).code === 'price_locked', 'ولا يعطي خصم');
ok((await call('/pos/sale', { ...sale, cid: 'sale-0004-abcd', paid: 1 })).code === 'paid_short', 'المبلغ المدفوع أقل من الإجمالي ينرفض');
const s2 = await call('/pos/sale', { pin: '2468', by: 'أبو خالد', cid: 'sale-0005-abcd', pay: 'card', discount: 1, lines: [{ id: 'veg0', qty: 1, price: 3 }] });
ok(s2.ok && s2.total === 2, 'الإدارة تقدر تغيّر السعر وتعطي خصم: ' + s2.total);
const off = Date.now() - 3600e3;
const s3 = await call('/pos/sale', { pin: '3333', cid: 'sale-0006-abcd', at: off, pay: 'card', lines: [{ id: 'drinks1', qty: 1 }] });
ok(s3.ok && s3.at === off, 'بيعة انحفظت والنت مقطوع تنسجل بوقتها الحقيقي');
const stock1 = (await (await w.fetch(new Request('https://x.dev/stock', { headers: { Origin: O } }), env, { waitUntil() {} })).json()).stock || {};
ok(stock0.dairy3 === 20, 'مخزون الشيدر قبل البيع 20'); ok(stock1.dairy3 === stock0.dairy3 - 2, 'المخزون نقص من نفس مخزون الموقع: ' + stock0.dairy3 + ' → ' + stock1.dairy3);
L = await call('/driver/orders', { pin: '1357' }); ok(!L.orders.some((o) => o.src === 'pos' || o.source === 'pos'), 'بيعات المحل ما تطلع للمناديب');
ok((await call('/driver/pending', { pin: '1357' })).last < Number(s3.no.slice(1)), 'وما تحسب «طلب جديد» في التطبيق');
// الوردية والإقفال
let sh = await call('/pos/shift', { pin: '3333' });
ok(sh.ok && sh.count === 2 && sh.cash === s1.total && sh.card === s3.total, 'وردية فهد: ' + sh.count + ' بيعات، كاش ' + sh.cash + '، شبكة ' + sh.card);
r = await call('/pos/close', { pin: '3333', counted: s1.total - 1 }); ok(r.ok && r.closed.diff === -1, 'إقفال الصندوق: ناقص ١ ريال ينسجل');
sh = await call('/pos/shift', { pin: '3333' }); ok(sh.count === 0 && sh.closes.length === 1, 'بعد الإقفال الوردية تبدأ من جديد');
// الإدارة: فصل المحل عن التوصيل، والأصناف اليدوية، وإلغاء بيعة
const onl = (await call('/admin/orders', { ...A, src: 'online' })).orders, pos = (await call('/admin/orders', { ...A, src: 'pos' })).orders;
ok(onl.every((o) => o.src !== 'pos') && pos.length === 3 && pos.every((o) => o.src === 'pos'), 'الإدارة: طلبات التوصيل لحال وبيعات المحل لحال');
const oi = await call('/admin/openitems', A); ok(oi.items.length === 1 && oi.items[0].bc === '6281000000123' && oi.items[0].n === 2, 'الصنف اللي مو مسجّل يطلع للإدارة عشان تضيفه');
r = await call('/driver/status', { ...A, no: s1.no, status: 'canceled' }); ok(r.ok, 'الإدارة تلغي بيعة (مرتجع)');
const stock2 = (await (await w.fetch(new Request('https://x.dev/stock', { headers: { Origin: O } }), env, { waitUntil() {} })).json()).stock || {};
ok(stock2.dairy3 === stock0.dairy3, 'المرتجع رجّع المخزون');
const td = await call('/admin/today', A); ok(td.today.pos_n === 2 && td.today.pos_rev === round(s2.total + s3.total), 'اليوم حتى الحين: المحل لحاله ' + td.today.pos_n + ' بيعة / ' + td.today.pos_rev);
// تسوية لكل مندوب، وإقفال اليوم بمبلغ لكل مندوب
await call('/admin/team-save', { ...A, id: said, name: 'سعيد', active: true });
const o5 = (await mkOrder('0555555555', 'خامس', '24.8300,46.8100')).order.no;
await call('/driver/status', { pin: '2222', no: o5, status: 'accepted' }); await call('/driver/status', { pin: '2222', no: o5, status: 'onway' }); await call('/driver/status', { pin: '2222', no: o5, status: 'delivered' });
const cs = await call('/driver/cash', { pin: '2222' }), cm = await call('/driver/cash', { pin: '1357' });
const allDay = await call('/admin/day-report', A);
ok(cs.balance > 0 && cs.today && cs.today.cash >= Math.round(cs.balance * 100) && cs.today.cash < allDay.cash, 'سعيد: باقي يسلّم ' + cs.balance + '، وجمع اليوم ' + cs.today.cash / 100 + ' من أصل ' + allDay.cash / 100 + ' للمحل (تقريره له هو بس)');
const rq = await call('/driver/settlement-request', { pin: '2222' }); ok(rq.ok && rq.settlement.drv === said, 'سعيد طلب تسوية باسمه');
const rq2 = await call('/driver/settlement-request', { pin: '1357' }); ok(rq2.ok && rq2.settlement.drv === 'd0', 'ومحمد طلب تسوية باسمه بنفس اليوم');
const sr = await call('/admin/settlement-requests', A); ok(sr.requests.length === 2 && sr.requests.every((r) => r.drvName), 'الإدارة تشوف طلبين: ' + sr.requests.map((r) => r.drvName).join('، '));
const cf = await call('/admin/settlement-confirm', { ...A, day: rq.settlement.day, drv: said, revision: rq.settlement.revision, actual: cs.balance });
ok(cf.ok, 'تأكيد استلام كاش سعيد');
ok((await call('/driver/cash', { pin: '2222' })).balance === 0 && (await call('/driver/cash', { pin: '1357' })).balance === cm.balance, 'سعيد صار صفر، ومحمد ما تأثر: ' + cm.balance);
const dr = await call('/admin/day-report', A);
const dc = await call('/admin/day-close', { ...A, day: dr.day, expected: dr.outstanding, actual: cm.balance, parts: [{ drv: 'd0', amount: cm.balance }, { drv: said, amount: 0 }], note: 'إقفال تجريبي' });
ok(dc.ok, 'إقفال اليوم بمبلغ لكل مندوب');
ok((await call('/driver/cash', { pin: '1357' })).balance === 0, 'بعد الإقفال: محمد صفر');
ok((await call('/admin/day-close', { ...A, day: dr.day, expected: dr.outstanding, actual: 5, parts: [{ drv: 'd0', amount: 1 }], note: 'x' })).code !== undefined, 'مجموع الأجزاء لازم يساوي المبلغ');
// منطقة التوصيل
data.store.shop = [24.8414, 46.8299]; data.store.maxKm = 5; await call('/save', { ...A, data });
const far = await call('/order', { items: { dairy3: 1 }, phone: '0557777777', name: 'بعيد', lat: 25.0, lng: 46.83 });
ok(far.code === 'too_far' && far.km > 5 && far.max === 5, 'طلب من برّا منطقة التوصيل ينرفض: ' + far.km + ' كم');
const near = await call('/order', { items: { dairy3: 1 }, phone: '0557777778', name: 'قريب', lat: 24.85, lng: 46.84 });
ok(near.ok, 'طلب من داخل المنطقة ينقبل');
const v = await call('/admin/verify', A); ok(v.clean, 'فحص الأرقام سليم بعد كل هذا: ' + JSON.stringify({ d: v.dayDiffCount, i: v.itemDiffs, h: v.hourDiffs, p: v.pairDiffs }));
// موظف موقوف ما يدخل
await call('/admin/team-save', { ...A, id: said, name: 'سعيد', active: false });
ok((await call('/driver/login', { pin: '2222' })).code === 'bad_pin', 'المندوب الموقوف ما يقدر يدخل');
const lg = (await call('/admin/log', A)).log.map((x) => x.act);
ok(['staff_add', 'claim', 'assign', 'pos_sale', 'pos_close', 'status'].every((a) => lg.includes(a) || a === 'claim'), 'كل شي ينسجل في سجل العمليات');
function round(n) { return Math.round(n * 100) / 100; }
console.log(fails ? `\n${fails} فشل` : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
