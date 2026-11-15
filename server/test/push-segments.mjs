// شرائح إشعارات العروض (قرار المالك ١٤ نوفمبر ٢٠٢٦): جهاز الزبون المجهول، نبضة السلة، الشرائح وعددها والإرسال لها،
// الملغي ما ينحسب، «انقطع» بالأيام، تذكير السلة التلقائي (مرة وحدة، ساعات الهدوء، مطفي افتراضياً، المتجر المقفل)، والصلاحيات.
// التشغيل: node server/test/push-segments.mjs   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { generateKeyPairSync } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8')); data.store.closed = false; delete data.store.minOrder; delete data.store.openAt; delete data.store.closeAt; data.store.fee = 0; data.store.freeOver = 0;
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); let kvPut = 0; const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { if (k !== 'apns_last') kvPut++; kv.set(k, v); }, delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const pem = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB, APNS_KEY: pem, APNS_KEY_ID: 'K1', APNS_TEAM_ID: 'T1', CART_CHECK_MS: 0 };
const apple = []; globalThis.fetch = githubMock(() => data, async (url, o) => { if (String(url).includes('push.apple.com')) { apple.push({ t: String(url).split('/').pop(), b: JSON.parse(o.body) }); return new Response('', { status: 200, headers: { 'apns-id': 'x' } }); } return new Response('{"ok":true}'); }, true);
// الوقت تحت التحكم: ١٢ الظهر بالرياض (٩ الصبح UTC)
const realNow = Date.now; let T = Date.UTC(2026, 10, 14, 9, 0, 0); Date.now = () => T;
const H = 3600e3;
let ipn = 0;
const call = (p, body, ip) => w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip || '7.4.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
const settle = () => new Promise((r) => setTimeout(r, 30));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const A = { pin: '2468' };
const tok = (n) => n.toString(16).padStart(64, '0');
const dev = (c) => 'd-' + c.repeat(20);
const DA = dev('a'), DB_ = dev('b'), DC = dev('c'), DD = dev('d'), DE = dev('e');
const pid = data.products.find((p) => p.stock !== false && !p.soon && Number(p.price) > 0 && !p.packs).id;
const order = (phone, d) => call('/order', { items: { [pid]: 1 }, phone, lat: 24.84, lng: 46.83, ...(d ? { dev: d } : {}) });
const segs = async (days) => (await call('/admin/promo-segs', { ...A, ...(days ? { days } : {}) }));

// ١) ربط الجهاز بالاشتراك
for (const [i, d] of [[1, DA], [2, DB_], [3, DC], [4, DD]]) ok((await call('/push/promo', { sub: { native: 'ios', token: tok(i) }, dev: d })).ok, 'اشتراك جهاز ' + d.slice(2, 3));
ok((await call('/push/promo', { sub: { native: 'ios', token: tok(5) } })).ok, 'اشتراك قديم بدون جهاز');
ok((await call('/push/promo', { sub: { native: 'ios', token: tok(6) }, dev: 'bad' })).ok, 'رقم جهاز غلط ما يمنع الاشتراك (ينحفظ بدون جهاز)');
ok(sq.prepare("SELECT COUNT(*) n FROM subs WHERE role='promo' AND dev IS NOT NULL").get().n === 4, 'أربع اشتراكات مربوطة بأجهزتها');
await call('/push/promo', { sub: { native: 'ios', token: tok(1) } });
ok(sq.prepare("SELECT dev FROM subs WHERE endpoint=?").get('apns:' + tok(1)).dev === DA, 'تجديد الاشتراك بدون جهاز ما يمسح الربط');
const devRow = sq.prepare("SELECT * FROM devices WHERE dev=?").get(DA);
ok(devRow && !('phone' in devRow) && !('name' in devRow), 'سجل الجهاز بدون اسم ولا جوال: ' + Object.keys(devRow || {}).join(','));
let s = await segs(); ok(s.ok && s.segs.all === 6 && s.segs.never === 4 && s.segs.ordered === 0 && s.segs.cart === 0, 'العدد بالشرائح أول: ' + JSON.stringify(s.segs));
ok(s.remind && s.remind.on === false && s.remind.hours === 3, 'تذكير السلة مطفي افتراضياً (٣ ساعات): ' + JSON.stringify(s.remind));

// ٢) نبضة السلة
ok((await call('/cart-ping', { dev: 'x', n: 2 })).code === 'bad_request', 'نبضة برقم جهاز غلط مرفوضة');
ok((await call('/cart-ping', { dev: DA, n: 3 })).ok, 'نبضة سلة فيها ٣');
ok(sq.prepare("SELECT cart_n, cart_at FROM devices WHERE dev=?").get(DA).cart_n === 3, 'عدد السلة انحفظ');
ok((await call('/cart-ping', { dev: DE, n: 1 })).ok && !!sq.prepare("SELECT 1 FROM devices WHERE dev=?").get(DE), 'جهاز بدون اشتراك ينحفظ بعد (ما يطلع بالشرائح)');
await call('/cart-ping', { dev: DB_, n: 2 });
let lim = 0; for (let i = 0; i < 61; i++) { const r = await call('/cart-ping', { dev: DE, n: (i % 5) + 1 }, '9.9.9.9'); if (r.code === 'slow_down') lim++; }
ok(lim === 1, 'حد النبضات لكل عنوان (٦٠ بالساعة): ' + lim);

// ٣) الطلبات: الطلب يفضّي السلة، والعدّ من سجل الطلبات، والملغي ما ينحسب
let r = await order('0551110002', DB_); ok(r.ok, 'طلب من الجهاز ب');
let b = sq.prepare("SELECT * FROM devices WHERE dev=?").get(DB_); ok(b.cart_n === 0 && b.orders_n === 1 && b.last_order_at === T, 'الطلب فضّى السلة وعدّ الطلب: ' + JSON.stringify(b));
ok(sq.prepare("SELECT dev FROM orders ORDER BY no DESC LIMIT 1").get().dev === DB_, 'الجهاز محفوظ على الطلب');
for (let i = 0; i < 3; i++) ok((await order('055111000' + (3 + i), DC)).ok, 'طلب ' + (i + 1) + ' من الجهاز ج');
const dno = (await order('0551110009', DD)).orderNo; ok(!!dno, 'طلب من الجهاز د');
ok(sq.prepare("SELECT orders_n FROM devices WHERE dev=?").get(DD).orders_n === 1, 'قبل الإلغاء: طلب واحد');
ok((await call('/driver/status', { ...A, no: dno, status: 'canceled' })).ok, 'إلغاء طلب د');
ok(sq.prepare("SELECT orders_n, last_order_at FROM devices WHERE dev=?").get(DD).orders_n === 0, 'الملغي ما ينحسب من طلبات الجهاز');
ok((await order('0551110010')).ok, 'طلب بدون جهاز (نسخة قديمة) يشتغل عادي');
ok((await order('0551110011', 'd-<script>')).ok && sq.prepare("SELECT dev FROM orders ORDER BY no DESC LIMIT 1").get().dev === null, 'رقم جهاز غلط مع الطلب ينتجاهل');

// ٤) الشرائح بعد ٣ ساعات
T += 3 * H;
s = await segs(); ok(s.segs.cart === 1 && s.segs.ordered === 2 && s.segs.loyal === 1 && s.segs.never === 2 && s.segs.all === 6 && s.segs.lapsed === 0, 'الشرائح: ' + JSON.stringify(s.segs));
await call('/cart-ping', { dev: DC, n: 4 });
s = await segs(); ok(s.segs.cart === 1, 'سلة جديدة (أقل من ساعتين) ما تنحسب متروكة');
// ٥) «انقطع» بالأيام
T += 20 * 24 * H;
s = await segs(); ok(s.days === 14 && s.segs.lapsed === 2, 'انقطع ١٤ يوم: ' + s.segs.lapsed);
s = await segs(30); ok(s.days === 30 && s.segs.lapsed === 0, 'انقطع ٣٠ يوم: ' + s.segs.lapsed);
s = await segs(1); ok(s.days === 3, 'أقل شي ٣ أيام: ' + s.days);
s = await segs(500); ok(s.days === 90, 'أكثر شي ٩٠ يوم: ' + s.days);

// ٦) الإرسال للشريحة (والحد اليومي يحسب كل إرسال مهما كانت الشريحة)
const sendTo = async (seg, extra) => { apple.length = 0; const x = await call('/admin/promo-push', { ...A, title: 'ت', body: 'ب', seg, ...extra }); return { ...x, to: apple.map((a) => a.t) }; };
r = await sendTo('loyal'); ok(r.ok && r.total === 1 && r.tried === 1 && r.to[0] === tok(3) && r.seg === 'loyal', 'إرسال للدائمين يوصل ج بس: ' + JSON.stringify(r));
r = await sendTo('lapsed', { days: 14 }); ok(r.ok && r.total === 2 && r.to.sort().join() === [tok(2), tok(3)].join(), 'إرسال للمنقطعين');
r = await sendTo('cart', { test: true }); ok(r.ok && r.test && r.to.length === 0, 'التجربة لأجهزة الإدارة بس حتى مع الشريحة');
r = await sendTo('never'); ok(r.ok && r.total === 2 && r.to.sort().join() === [tok(1), tok(4)].join(), 'إرسال لاللي ما طلبوا (أ، د الملغي)');
ok(sq.prepare("SELECT COUNT(*) n FROM alog WHERE act='promo_push'").get().n === 3, 'كل إرسال انسجّل');
ok(JSON.parse(sq.prepare("SELECT info FROM alog WHERE act='promo_push' ORDER BY id LIMIT 1").get().info).seg === 'loyal', 'الشريحة مكتوبة بالسجل');
r = await sendTo('all'); ok(r.ok && r.total === 6, 'الكل: ' + r.total);
r = await sendTo('ordered'); ok(!r.ok && r.code === 'daily_limit', 'الحد اليومي ٤ مهما كانت الشريحة');
r = await sendTo('bogus', { test: true }); ok(r.ok && r.total === 6, 'شريحة مو معروفة = الكل');

// ٧) تذكير السلة التلقائي
const pending = async () => { apple.length = 0; await call('/driver/pending', A); await settle(); return apple.map((a) => a.t); };
T = Math.floor(T / (24 * H)) * 24 * H + 2 * 24 * H + 6 * H;   // بعد يومين، ٩ الصبح بالرياض (+٤ ساعات = ١ الظهر)
await call('/cart-ping', { dev: DA, n: 2 }); T += 4 * H;   // سلة أ متروكة ٤ ساعات
ok((await pending()).length === 0, 'مطفي افتراضياً: ما يرسل شي');
r = await call('/admin/promo-segs', { ...A, remind: { on: true, hours: 99 } }); ok(r.code === 'bad_request', 'تأخير غلط مرفوض');
r = await call('/admin/promo-segs', { ...A, remind: { on: true, hours: 3 } }); ok(r.ok && r.remind.on && r.remind.hours === 3, 'تشغيل التذكير بعد ٣ ساعات');
let to = await pending(); ok(to.length === 1 && to[0] === tok(1), 'التذكير وصل لجهاز أ بس: ' + to.join());
ok(apple.length === 1 && /سلتك تنتظرك/.test(JSON.stringify(apple[0].b)) && /go=cart/.test(JSON.stringify(apple[0].b)), 'نص التذكير «سلتك تنتظرك» ويفتح السلة');
ok((await pending()).length === 0, 'مرة وحدة بس لكل سلة');
T += 60000; await call('/cart-ping', { dev: DA, n: 5 }); T += 2 * H;
ok((await pending()).length === 0, 'سلة جديدة قبل ٣ ساعات: ما يذكّر');
T += 2 * H; ok((await pending()).length === 1, 'السلة الجديدة بعد ٣ ساعات: تذكير ثاني (سلة ثانية)');
// ساعات الهدوء: ١١:٣٠ الليل بالرياض
const day0 = Math.floor(T / (24 * H)) * 24 * H + 24 * H;   // بكرة ٠٠:٠٠ UTC
T = day0 + 20.5 * H; await call('/cart-ping', { dev: DA, n: 2 });   // ١١:٣٠ الليل بالرياض
T = day0 + 24 * H;   // ٣ الفجر بالرياض (والسلة من ٣٫٥ ساعة)
ok((await pending()).length === 0, 'ما يذكّر بالليل (١١ الليل لين ٩ الصبح)');
// المتجر مقفل
T = day0 + 34 * H; await call('/cart-ping', { dev: DA, n: 3 }); T += 4 * H;
data.store.closed = true; T += 31000;
ok((await pending()).length === 0, 'ما يذكّر والمتجر مقفل');
data.store.closed = false; T += 31000;
ok((await pending()).length === 1, 'بعد ما يفتح المتجر يذكّر');
// الطلب بعد السلة: ما يذكّر
await call('/cart-ping', { dev: DB_, n: 2 }); await order('0551110002', DB_); T += 4 * H;
ok((await pending()).length === 0, 'اللي طلب ما يوصله تذكير');
r = await call('/admin/promo-segs', { ...A, remind: { on: false, hours: 3 } }); ok(r.ok && !r.remind.on, 'إيقاف التذكير');
await call('/cart-ping', { dev: DA, n: 1 }); T += 4 * H; ok((await pending()).length === 0, 'بعد الإيقاف ما يرسل');
ok(kvPut === 0, 'الميزة ما تكتب في KV (غير تشخيص آبل الموجود من قبل): ' + kvPut);

// ٨) الصلاحيات
await call('/admin/staff-save', { ...A, name: 'طلبات', role: 'orders', loginPin: '6161' });
await call('/admin/staff-save', { ...A, name: 'مجهز', role: 'preparer', loginPin: '6262' });
await call('/admin/staff-save', { ...A, name: 'كاشير', role: 'cashier', loginPin: '6363' });
await call('/admin/staff-save', { ...A, name: 'مدير', role: 'manager', loginPin: '6464' });
for (const [pin, nm] of [['6161', 'موظف الطلبات'], ['6262', 'المجهز'], ['6363', 'الكاشير']]) {
  const ses = (await call('/enter', { pin })).token;
  ok(!!ses && (await call('/admin/promo-segs', { session: ses })).code === 'forbidden', nm + ' ما يشوف الشرائح');
  ok((await call('/admin/promo-push', { session: ses, title: 'ت', body: 'ب', seg: 'all', test: true })).code === 'forbidden', nm + ' ما يرسل');
  ok((await call('/admin/promo-segs', { session: ses, remind: { on: true, hours: 3 } })).code === 'forbidden', nm + ' ما يشغّل التذكير');
}
const mses = (await call('/enter', { pin: '6464' })).token; ok((await call('/admin/promo-segs', { session: mses })).ok, 'المدير يشوف الشرائح');
ok((await call('/admin/promo-segs', { pin: '0000' })).ok !== true, 'بدون رقم مرفوض');
Date.now = realNow;
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
