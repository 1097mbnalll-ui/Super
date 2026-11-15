// حدود الخطة المجانية في Cloudflare: قراءات/كتابات KV لكل نداء، وإشعار العروض على دفعات صغيرة.
// التشغيل:  node server/test/free-plan-budget.mjs   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { generateKeyPairSync } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8')); data.store.closed = false; delete data.store.minOrder; delete data.store.openAt; delete data.store.closeAt;
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const n = { get: 0, put: 0, del: 0, getKeys: [] };
const LOCKS = { get: async (k, t) => { n.get++; n.getKeys.push(k); const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { n.put++; kv.set(k, v); }, delete: async (k) => { n.del++; kv.delete(k); } };
const O = 'https://1097mbnalll-ui.github.io';
const pem = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB, APNS_KEY: pem, APNS_KEY_ID: 'K1', APNS_TEAM_ID: 'T1' };
let apple = 0; const dead = new Set();
globalThis.fetch = githubMock(() => data, async (url) => { if (String(url).includes('push.apple.com')) { apple++; const t = String(url).split('/').pop(); return dead.has(t) ? new Response('{"reason":"Unregistered"}', { status: 410 }) : new Response('', { status: 200, headers: { 'apns-id': 'x' } }); } return new Response('{"ok":true}'); }, true);
let ipn = 0;
const call = (p, body, ip) => w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip || '7.2.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const A = { pin: '2468' };
const tok = (i) => i.toString(16).padStart(64, '0');

// ١) قراءات KV لكل نداء من المندوب/الإدارة: كانت ٣ (قفل الجهاز + رقم الإدارة + مسح المحاولات)، صارت ١
await call('/admin/team-save', { ...A, name: 'سعيد', role: 'driver', newPin: '1111' });
await call('/driver/pending', { pin: '1111' }, '9.9.9.9');
n.get = 0; n.getKeys = []; await call('/driver/pending', { pin: '1111' }, '9.9.9.9');
ok(n.get === 1 && n.getKeys[0] === 'fail:9.9.9.9', 'نداء المندوب يقرأ KV مرة وحدة بس: ' + n.get + ' ' + n.getKeys.join(','));
n.get = 0; await call('/admin/alerts', A, '9.9.9.8'); ok(n.get === 1, 'نداء الإدارة برقمها يقرأ KV مرة وحدة: ' + n.get);
// القفل بعد ٥ محاولات غلط ما زال شغّال، والدخول الصح بعدها يمسح المحاولات
for (let i = 0; i < 4; i++) await call('/driver/pending', { pin: '0000' }, '9.9.9.7');
ok(kv.has('fail:9.9.9.7'), 'المحاولات الغلط تنسجل');
ok((await call('/driver/pending', { pin: '1111' }, '9.9.9.7')).ok && !kv.has('fail:9.9.9.7'), 'الدخول الصح يمسح المحاولات الغلط');
for (let i = 0; i < 5; i++) await call('/driver/pending', { pin: '0000' }, '9.9.9.6');
ok((await call('/driver/pending', { pin: '1111' }, '9.9.9.6')).code === 'locked', 'بعد ٥ غلط الجهاز ينقفل حتى بالرقم الصح');
// تغيير رقم الإدارة يشتغل على طول (الذاكرة تتحدث مع الحفظ)
const v = (await call('/admin/catalog', A)).version;
ok((await call('/save', { ...A, data, baseVersion: v, newPin: '13579' })).ok, 'تغيير رقم الإدارة');
ok((await call('/login', A)).code === 'bad_pin' && (await call('/login', { pin: '13579' })).ok, 'الرقم القديم يوقف على طول والجديد يشتغل');
A.pin = '13579';

// ٢) إشعار العروض: دفعات ٤٠ (حد ٥٠ اتصال خارجي لكل نداء في الخطة المجانية) وما يتخطى أحد لو انحذف جهاز وقت الإرسال
for (let i = 1; i <= 95; i++) await call('/push/promo', { sub: { native: 'ios', token: tok(i) } }, '7.3.' + (i % 250) + '.1');
for (let i = 1; i <= 95; i += 9) dead.add(tok(i));   // ١١ جهاز حذف التطبيق
apple = 0; n.put = 0;
const batches = []; let next = 0, sent = 0;
do { const r = await call('/admin/promo-push', { ...A, title: 'عروض', body: 'خصم', offset: next }); batches.push(r.tried); sent += r.sent; next = r.next; } while (next);
ok(batches.every((x) => x <= 40) && batches.length === 3, 'الإرسال على دفعات ٤٠ بالأكثر: ' + batches.join('+'));
ok(apple === 95, 'كل الأجهزة انرسل لها مرة وحدة (حتى لو انحذف جهاز قبلها): ' + apple);
ok(sent === 84, 'انرسل للأجهزة الشغّالة: ' + sent);
ok(sq.prepare("SELECT COUNT(*) n FROM subs WHERE role='promo'").get().n === 84, 'الأجهزة المنتهية انحذفت');
// ٣) «آخر رد من آبل» ما ينكتب في KV مع كل إشعار (حد ١٠٠٠ كتابة باليوم)
ok(n.put <= 3, 'كتابات KV لإرسال ٩٥ إشعار: ' + n.put);
const last = JSON.parse(kv.get('apns_last') || '{}'); ok(last.status === 200 || last.status === 410, 'آخر رد من آبل محفوظ للتشخيص: ' + last.status);

// ٤) قائمة المندوب وكاشير التوصيل: نفس نتيجة الاستعلام القديم بالضبط، بدون مسح جدول الطلبات كامل
const OLD_D = "SELECT no FROM orders WHERE src != 'pos' AND (created > ? OR status IN ('new','accepted','onway')) ORDER BY no DESC LIMIT 150";
const OLD_P = "SELECT o.no FROM orders o WHERE o.src!='pos' AND (o.status IN ('new','accepted','onway') OR o.updated>?) ORDER BY o.no DESC LIMIT 200";
const first = await call('/order', { items: { pantry0: 1 }, phone: '0551110001', lat: 24.84, lng: 46.83 }); ok(first.ok, 'طلب حقيقي أول');
const base = sq.prepare('SELECT * FROM orders ORDER BY no DESC LIMIT 1').get(), cols = Object.keys(base).filter((c) => c !== 'no' && c !== 'cid');
const ins = sq.prepare(`INSERT INTO orders (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
const ST = ['delivered', 'delivered', 'delivered', 'canceled', 'new', 'accepted', 'onway'];
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const same = async (label) => {
  const now = Date.now(), d = (await call('/driver/orders', { pin: '1111' })).orders.map((o) => Number(o.no.slice(1)) - 1000);
  const p = (await call('/admin/pos-orders', A)).orders.map((o) => Number(o.no.replace(/\D/g, '')) - 1000);
  const od = sq.prepare(OLD_D).all(now - 3 * 864e5).map((r) => r.no), op = sq.prepare(OLD_P).all(now - 2 * 864e5).map((r) => r.no);
  ok(JSON.stringify(d) === JSON.stringify(od), `${label}: قائمة المندوب (${d.length}) نفس القديم`);
  ok(JSON.stringify(p) === JSON.stringify(op), `${label}: قائمة كاشير التوصيل (${p.length}) نفس القديم`);
};
await same('طلبات قليلة');
const add = (count, perDay, activeShare, endAgoDays = 0) => { const now = Date.now(); sq.exec('BEGIN');
  for (let i = 0; i < count; i++) { const t = now - endAgoDays * 864e5 - (count - i) * 864e5 / perDay; const st = rnd() < activeShare ? ST[4 + Math.floor(rnd() * 3)] : ST[Math.floor(rnd() * 4)];
    ins.run(...cols.map((c) => c === 'created' ? t : c === 'updated' ? t + rnd() * 4 * 864e5 : c === 'status' ? st : c === 'src' ? (rnd() < 0.05 ? 'pos' : base.src) : base[c])); }
  sq.exec('COMMIT'); };
// الطلبات تنحفظ بترتيب وقتها (رقم أكبر = أحدث)، فكل حالة تبدأ من جدول فاضي
const fresh = () => sq.exec('DELETE FROM orders');
fresh(); add(2000, 40, 0.01);  await same('٤٠ طلب باليوم (أقل من ١٥٠ بثلاث أيام) مع طلبات شغّالة قديمة');
fresh(); add(700, 250, 0.02);  await same('٢٥٠ طلب باليوم');
fresh(); add(2000, 10, 0.002); await same('١٠ طلبات باليوم');
fresh(); add(140, 40, 0.05);   await same('أقل من ١٥٠ طلب بالجدول كله');
fresh(); add(1000, 50, 0);     await same('٥٠ طلب باليوم بدون شغّال');

console.log(fails ? fails + ' فحص فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
