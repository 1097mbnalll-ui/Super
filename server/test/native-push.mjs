// اختبار: إشعارات التطبيق الأصلي للزبائن (آيفون APNs وأندرويد FCM) من الخادم، بدون أي اتصال حقيقي.
// التشغيل:  node server/test/native-push.mjs   (node 22)
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
import crypto from 'node:crypto';
let r;
// مفاتيح تجريبية: EC (APNs) و RSA (حساب خدمة FCM)
const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }), rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ecPem = ec.privateKey.export({ type: 'pkcs8', format: 'pem' });
const sa = { project_id: 'ohod-test', client_email: 'push@ohod-test.iam.gserviceaccount.com', private_key: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const calls = []; let apnsStatus = 200, apnsBody = '{}', fcmStatus = 200, fcmBody = '{}';
globalThis.fetch = githubMock(() => data, async (url, o = {}) => {
  url = String(url);
  if (/push\.apple\.com/.test(url)) { calls.push({ kind: 'apns', url, h: o.headers, body: JSON.parse(o.body) }); return new Response(apnsBody, { status: apnsStatus }); }
  if (/oauth2\.googleapis\.com/.test(url)) { calls.push({ kind: 'oauth', url, body: String(o.body) }); return new Response('{"access_token":"ya29.test","expires_in":3600}', { status: 200 }); }
  if (/fcm\.googleapis\.com/.test(url)) { calls.push({ kind: 'fcm', url, h: o.headers, body: JSON.parse(o.body) }); return new Response(fcmBody, { status: fcmStatus }); }
  return new Response('{"ok":true}');
}, true);
const tick = () => new Promise((res) => setTimeout(res, 60));
const b64u = (s) => Buffer.from(s, 'base64url');
await put();
const ph = '0554440001', ph2 = '0554440002';
const o1 = (await mk(ph)).orderNo, no1 = N(o1);
const iosTok = 'a'.repeat(64), andTok = 'f'.repeat(30) + ':APA91b' + 'x'.repeat(60);
// ١) بدون أسرار: ينحفظ الاشتراك وما يصير شي (بدون خطأ ولا حذف)
r = await call('/push/order', { no: o1, phone: ph, sub: { native: 'ios', token: iosTok } }); ok(r.ok, 'اشتراك آيفون ينحفظ');
await tick(); ok(calls.length === 0 && sq.prepare("SELECT COUNT(*) n FROM subs WHERE endpoint = ?").get('apns:' + iosTok).n === 1, 'بدون مفاتيح: ما ينرسل شي، والاشتراك يبقى');
// ٢) آبل: المالك يرفع المفتاح من الإدارة (KV)، والفريق من أسرار Cloudflare
env.APNS_TEAM_ID = 'TEAM123456';
r = await call('/admin/apns-key', { ...A, key: 'not a key', keyId: 'KEY123ABCD' }); ok(!r.ok && r.code === 'bad_key', 'ملف غلط ينرفض');
r = await call('/admin/apns-key', { ...A, key: ecPem, keyId: 'bad' }); ok(!r.ok && r.code === 'bad_key_id', 'Key ID غلط ينرفض');
r = await call('/admin/apns-key', { key: ecPem, keyId: 'KEY123ABCD' }); ok(!r.ok, 'بدون رقم الإدارة ما ينحفظ');
r = await call('/admin/apns-key', { ...A, key: ecPem, keyId: 'key123abcd' }); ok(r.ok && r.ready && r.keyId === 'KEY123ABCD' && !JSON.stringify(r).includes('PRIVATE'), 'المفتاح ينحفظ ومايرجع للواجهة');
r = await call('/admin/apns-key', A); ok(r.ok && r.ready && r.hasKey, 'حالة المفتاح تنقرأ');
r = await call('/push/order', { no: o1, phone: ph, sub: { native: 'ios', token: iosTok } }); await tick();
let ap = calls.find((c) => c.kind === 'apns'); ok(r.ok && ap, 'إشعار التأكيد يروح لآبل');
ok(ap.url === 'https://api.push.apple.com/3/device/' + iosTok && ap.h['apns-topic'] === 'sa.ohod.store' && ap.h['apns-push-type'] === 'alert', 'العنوان والـtopic الصحيحين');
const [jh, jp, js] = ap.h.authorization.replace('bearer ', '').split('.'); const head2 = JSON.parse(b64u(jh)), pay = JSON.parse(b64u(jp));
ok(head2.alg === 'ES256' && head2.kid === 'KEY123ABCD' && pay.iss === 'TEAM123456', 'رمز JWT: الخوارزمية والمفتاح والفريق');
ok(crypto.verify('sha256', Buffer.from(jh + '.' + jp), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, b64u(js)), 'توقيع JWT يتحقق بالمفتاح العام');
ok(/تم تفعيل الإشعارات/.test(ap.body.aps.alert.title) && ap.body.aps['thread-id'] === 'order' + no1, 'نص الإشعار والتجميع بالطلب');
// ٣) تغيّر حالة الطلب: يوصل الزبون
calls.length = 0; await call('/driver/status', { pin: '1111', no: o1, status: 'accepted' }); await tick();
ap = calls.find((c) => c.kind === 'apns'); ok(ap && /طلبك/.test(ap.body.aps.alert.title + ap.body.aps.alert.body), 'تغيير حالة الطلب يوصل الآيفون');
// ٤) JWT يتكرر استخدامه (ما يتولّد لكل إشعار)
const jwt1 = ap.h.authorization; calls.length = 0; await call('/driver/status', { pin: '1111', no: o1, status: 'onway' }); await tick();
ok(calls.find((c) => c.kind === 'apns')?.h.authorization === jwt1, 'رمز آبل يتجدد بس كل فترة');
// ٥) جهاز ما عاد مسجّل: ينحذف
apnsStatus = 410; apnsBody = '{"reason":"Unregistered"}'; calls.length = 0; await call('/driver/status', { pin: '1111', no: o1, status: 'delivered' }); await tick();
ok(sq.prepare("SELECT COUNT(*) n FROM subs WHERE endpoint = ?").get('apns:' + iosTok).n === 0, 'جهاز آبل غير مسجّل ينحذف من الخادم'); apnsStatus = 200; apnsBody = '{}';
// ٦) أندرويد FCM
const o2 = (await mk(ph2)).orderNo, no2 = N(o2);
r = await call('/push/order', { no: o2, phone: ph2, sub: { native: 'android', token: andTok } }); await tick(); ok(r.ok, 'اشتراك أندرويد ينحفظ');
ok(!calls.some((c) => c.kind === 'fcm'), 'بدون حساب خدمة: ما ينرسل شي');
env.FCM_SERVICE_ACCOUNT = JSON.stringify(sa); calls.length = 0;
r = await call('/push/order', { no: o2, phone: ph2, sub: { native: 'android', token: andTok } }); await tick();
const oa = calls.find((c) => c.kind === 'oauth'), fm = calls.find((c) => c.kind === 'fcm'); ok(oa && fm, 'يطلب صلاحية من قوقل ثم يرسل');
const asrt = new URLSearchParams(oa.body).get('assertion').split('.'); const fp = JSON.parse(b64u(asrt[1]));
ok(JSON.parse(b64u(asrt[0])).alg === 'RS256' && fp.iss === sa.client_email && /firebase\.messaging/.test(fp.scope), 'طلب الصلاحية: خوارزمية ومرسل ونطاق صح');
ok(crypto.verify('sha256', Buffer.from(asrt[0] + '.' + asrt[1]), rsa.publicKey, b64u(asrt[2])), 'توقيع RS256 يتحقق');
ok(fm.url === 'https://fcm.googleapis.com/v1/projects/ohod-test/messages:send' && fm.h.authorization === 'Bearer ya29.test' && fm.body.message.token === andTok && fm.body.message.notification.body.includes('#' + (1000 + no2)), 'رسالة FCM: العنوان والتوكن والنص');
calls.length = 0; await call('/driver/status', { pin: '1111', no: o2, status: 'accepted' }); await tick();
ok(calls.filter((c) => c.kind === 'oauth').length === 0 && calls.filter((c) => c.kind === 'fcm').length === 1, 'صلاحية قوقل تنحفظ ولا تتكرر');
fcmStatus = 404; fcmBody = '{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}'; await call('/driver/status', { pin: '1111', no: o2, status: 'onway' }); await tick();
ok(sq.prepare("SELECT COUNT(*) n FROM subs WHERE endpoint = ?").get('fcm:' + andTok).n === 0, 'جهاز أندرويد غير مسجّل ينحذف');
// ٧) تحقق من المدخلات
ok((await call('/push/order', { no: o2, phone: ph2, sub: { native: 'ios', token: 'zz' } })).code === 'bad_sub', 'توكن آبل غلط يترفض');
ok((await call('/push/order', { no: o2, phone: ph2, sub: { native: 'windows', token: iosTok } })).code === 'bad_sub', 'منصة غير معروفة تترفض');
ok((await call('/push/order', { no: o2, phone: '0559990000', sub: { native: 'ios', token: iosTok } })).code === 'not_found', 'جوال غير صاحب الطلب ما يشترك');
ok((await call('/push/sub', { pin: '2468', sub: { native: 'ios', token: iosTok } })).code === 'bad_sub', 'الإدارة ما تشترك بتوكن أصلي (للزبائن بس)');
ok((await call('/driver/push', { pin: '1111', sub: { native: 'ios', token: iosTok } })).code === 'bad_sub', 'ولا المندوب');
// اشتراكات الويب ما تأثرت
const key = 'B' + 'x'.repeat(86), auth = 'a'.repeat(22);
ok((await call('/push/order', { no: o2, phone: ph2, sub: { endpoint: 'https://push.example.com/' + 'e'.repeat(40), keys: { p256dh: key, auth } } })).ok, 'اشتراك الويب القديم يشتغل');
console.log(fails ? `\n${fails} فشل` : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
