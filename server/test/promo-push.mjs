// إشعارات العروض للزبائن (promo-push): اشتراك الموقع والتطبيق، الإرسال من الإدارة، الصلاحيات، الحد اليومي، التجربة. التشغيل: node server/test/promo-push.mjs
// (قديم: أكواد الخصم: إضافة من الإدارة، مبلغ ثابت ونسبة بحد أعلى، الحد الأدنى، الانتهاء، مرة لكل جوال، حد الاستخدام الكلي، التعديل، الإيصال، والصلاحيات. التشغيل: node server/test/promo-codes.mjs

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
const tok = (n) => (String(n).padStart(2, '0')).repeat(32);   // رمز آبل وهمي (٦٤ خانة هكس)
let r = await call('/push/promo', { sub: { native: 'ios', token: tok(11) } }); ok(r.ok, 'اشتراك التطبيق بإشعارات العروض');
r = await call('/push/promo', { sub: { native: 'ios', token: tok(11) } }); ok(r.ok, 'نفس الجهاز مرة ثانية ما يتكرر');
await call('/push/promo', { sub: { native: 'ios', token: tok(22) } });
r = await call('/push/promo', { sub: { native: 'ios', token: 'zz' } }); ok(!r.ok && r.code === 'bad_sub', 'رمز غلط مرفوض');
r = await call('/push/promo', { sub: { endpoint: 'https://x.dev/abc', keys: { p256dh: 'a', auth: 'b' } } }); ok(!r.ok, 'اشتراك ويب ناقص مرفوض');
ok(sq.prepare("SELECT COUNT(*) n FROM subs WHERE role='promo'").get().n === 2, 'جهازين مشتركين فقط');
r = await call('/push/status', A); ok(r.ok && r.promo === 2, 'الإدارة تشوف عدد المشتركين: ' + r.promo);
r = await call('/admin/promo-push', { ...A, title: '', body: 'x' }); ok(!r.ok && r.code === 'bad_message', 'رسالة فاضية مرفوضة');
r = await call('/admin/promo-push', { title: 'ت', body: 'ب', pin: 'bad' }); ok(!r.ok, 'بدون رقم الإدارة مرفوض');
r = await call('/admin/promo-push', { ...A, title: 'عروض الأسبوع نزلت', body: 'خصم حتى 37٪', go: 'offers', test: true }); ok(r.ok && r.test && r.total === 2, 'التجربة لأجهزة الإدارة بس (ما تنرسل للزبائن): ' + JSON.stringify(r));
ok(sq.prepare("SELECT COUNT(*) n FROM alog WHERE act='promo_push'").get().n === 0, 'التجربة ما تنحسب من الحد اليومي');
r = await call('/admin/promo-push', { ...A, title: 'عروض الأسبوع نزلت', body: 'خصم حتى 37٪ على منتجات مختارة', go: 'offers' }); ok(r.ok && r.total === 2 && r.tried === 2 && r.next === null, 'الإرسال لكل المشتركين: ' + JSON.stringify(r));
ok(sq.prepare("SELECT COUNT(*) n FROM alog WHERE act='promo_push'").get().n === 1, 'الإرسال انسجّل في سجل العمليات');
for (let i = 0; i < 3; i++) await call('/admin/promo-push', { ...A, title: 'ت' + i, body: 'ب' });
r = await call('/admin/promo-push', { ...A, title: 'خامس', body: 'ب' }); ok(!r.ok && r.code === 'daily_limit', 'الحد اليومي ٤ إرسالات: ' + r.code);
r = await call('/push/promo', { sub: { native: 'ios', token: tok(11) }, off: true }); ok(r.ok && r.off, 'إلغاء الاشتراك');
ok(sq.prepare("SELECT COUNT(*) n FROM subs WHERE role='promo'").get().n === 1, 'باقي جهاز واحد');
await call('/admin/team-save', { ...A, name: 'مندوب', role: 'driver', newPin: '5151' });
r = await call('/admin/promo-push', { pin: '5151', title: 'ت', body: 'ب' }); ok(!r.ok, 'المندوب ما يرسل إشعارات للزبائن');
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
