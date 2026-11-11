// اختبار: وضع «المندوب للتوصيل بس» (تشغيل/إيقاف/تلقائي)، تنبيه الطلب المتأخر، وإشعارات المجهز.
// التشغيل:  node server/test/prep-mode.mjs   (node 22)
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
const env = { LATE_CHECK_MS: 0, GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
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
let r;
await put();
// ١) بدون مجهز: النظام القديم (المندوب يجهز)
let mode = await call('/admin/prep-mode', A); ok(mode.ok && mode.mode === 'auto' && !mode.on && mode.preparers === 0, 'بدون مجهز: تلقائي ومتوقف');
const o1 = (await mk('0551110001')).orderNo;
r = await call('/driver/orders', { pin: '1111' }); ok(r.mode === 'pick', 'المندوب يجهز بنفسه');
// ٢) أول ما يتفعّل مجهز: تلقائي يشتغل
r = await call('/admin/staff-save', { ...A, name: 'المجهز', role: 'preparer', loginPin: '5555' }); ok(r.ok, 'إضافة مجهز');
mode = await call('/admin/prep-mode', A); ok(mode.on && mode.mode === 'auto' && mode.preparers === 1, 'تلقائي: يشتغل لما فيه مجهز');
r = await call('/driver/orders', { pin: '1111' }); ok(r.mode === 'ready', 'المندوب للتوصيل بس');
// ٣) متوقف يدوياً: يرجع النظام القديم حتى لو فيه مجهز
r = await call('/admin/prep-mode', { ...A, mode: 'off' }); ok(r.ok && !r.on && r.mode === 'off', 'إيقاف يدوي');
ok((await call('/driver/orders', { pin: '1111' })).mode === 'pick', 'والمندوب يرجع يجهز بنفسه');
ok((await call('/driver/status', { pin: '1111', no: o1, status: 'accepted' })).ok, 'ويقدر يمسك الطلب');
await call('/driver/status', { pin: '1111', no: o1, status: 'new' });
// ٤) شغّال يدوياً
r = await call('/admin/prep-mode', { ...A, mode: 'on' }); ok(r.on && r.mode === 'on', 'تشغيل يدوي');
ok((await call('/driver/status', { pin: '1111', no: o1, status: 'accepted' })).code === 'not_ready', 'المندوب ما يمسك طلب ما جهز');
ok((await call('/admin/prep-mode', { ...A, mode: 'bogus' })).code === 'bad_request', 'قيمة غلط ترفض');
ok((await call('/admin/prep-mode', { ...A, lateMin: 1 })).code === 'bad_request' && (await call('/admin/prep-mode', { ...A, lateMin: 15 })).lateMin === 15, 'مهلة التأخير من ٣ إلى ٦٠ دقيقة');
// المجهز نفسه ما يغيّر الإعداد
const tok = (await call('/enter', { pin: '5555' })).token;
ok((await call('/admin/prep-mode', { session: tok, mode: 'off' })).code === 'forbidden', 'المجهز ما يغيّر وضع التجهيز');
// ٥) تنبيه الطلب المتأخر: مرة وحدة لكل طلب
await call('/admin/prep-mode', { ...A, lateMin: 5 });
const lateCount = () => sq.prepare('SELECT COUNT(*) n FROM late_alerts').get().n;
r = await call('/driver/pending', { pin: '1111' }); ok(lateCount() === 0, 'طلب جديد: لسا ما تأخر');
sq.prepare('UPDATE orders SET created = ? WHERE no = ?').run(Date.now() - 8 * 60000, N(o1));
await call('/admin/prep', A); ok(lateCount() === 1, 'بعد ٨ دقايق بدون تجهيز: ينسجل تنبيه تأخير');
const pushes = []; const realFetch = globalThis.fetch;
await call('/admin/prep', A); await call('/driver/pending', { pin: '1111' }); ok(lateCount() === 1, 'ما يتكرر لنفس الطلب');
const pr = (await call('/admin/prep', A)); ok(pr.lateMin === 5, 'شاشة المجهز تعرف مهلة التأخير');
// ما يتأخر الطلب اللي جهز
const o2 = (await mk('0551110002')).orderNo;
const pp = (await call('/admin/prep', A)).orders.find((o) => o.no === o2); const ck = {}; pp.lines.forEach((l) => ck[l.key] = 'picked');
await call('/admin/prep-save', { ...A, no: o2, version: pp.version, orderUpdated: pp.orderUpdated, stage: 'ready', checks: ck });
sq.prepare('UPDATE orders SET created = ? WHERE no = ?').run(Date.now() - 9 * 60000, N(o2)); await call('/admin/prep', A); ok(lateCount() === 1, 'طلب جاهز ما ينعدّ متأخر');
// ٦) إشعارات المجهز: اشتراك بدور «prep» منفصل عن الإدارة
const key = 'B' + 'x'.repeat(86), auth = 'a'.repeat(22), sub = { endpoint: 'https://push.example.com/' + 'e'.repeat(40), keys: { p256dh: key, auth } };
r = await call('/push/sub', { session: tok, sub }); ok(r.ok, 'المجهز يفعّل إشعاراته');
ok(sq.prepare("SELECT role FROM subs WHERE endpoint = ?").all(sub.endpoint).map((x) => x.role).join() === 'prep', 'ينسجل بدور prep مو admin');
r = await call('/push/sub', { pin: '2468', sub: { ...sub, endpoint: 'https://push.example.com/' + 'f'.repeat(40) } }); ok(r.ok && sq.prepare("SELECT COUNT(*) n FROM subs WHERE role = 'admin'").get().n === 1, 'اشتراك الإدارة يبقى admin');
console.log(fails ? `\n${fails} فشل` : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
