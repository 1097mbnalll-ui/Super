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
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
env.ALLOWED_ORIGIN = O + ',capacitor://localhost,https://localhost';
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = (o, body, ua) => w.fetch(new Request('https://x.dev/order', { method: 'POST', headers: { Origin: o, 'User-Agent': ua || '', 'CF-Connecting-IP': '9.9.9.' + Math.floor(Math.random() * 200) }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
const order = (ph) => ({ items: { pantry0: 1 }, phone: ph, lat: 24.84, lng: 46.83 });
data.store.app = { launch: { at: new Date(Date.now() + 2500).toISOString(), msg: 'ينطلق الخميس' } };
let r = await call('capacitor://localhost', order('0551110001')); ok(!r.ok && r.code === 'closed', 'التطبيق ما يطلب قبل الإطلاق: ' + JSON.stringify(r));
r = await call(O, order('0551110002')); ok(r.ok, 'الموقع يطلب عادي: ' + (r.code || ''));
await new Promise((r) => setTimeout(r, 3000));   // الموعد يجي والقفل ينفتح لحاله
r = await call('capacitor://localhost', order('0551110003')); ok(r.ok, 'بعد الموعد التطبيق يطلب: ' + (r.code || ''));
// مقفل للتطبيق بس (closed + app.closedOnly): الموقع يطلب عادي
data.store.closed = true; data.store.app.closedOnly = true; data.store.app.launch.at = new Date(Date.now() + 36e5).toISOString();
await w.fetch(new Request('https://x.dev/save', { method: 'POST', headers: { Origin: O }, body: '{}' }), env, { waitUntil() {} }).catch(() => {});
r = await call(O, order('0551110004')); ok(r.ok, 'closedOnly: الموقع يطلب: ' + (r.code || ''));
delete data.store.app.closedOnly;
// من وين انطلب الطلب (المالك ١٩ نوفمبر ٢٠٢٦)
data.store.closed = false; delete data.store.app.launch;
const via = (no) => JSON.parse(sq.prepare('SELECT data FROM orders WHERE no = ?').get(Number(String(no).replace(/\D/g, '')) - 1000).data).via;
const cases = [['capacitor://localhost', 'OhodStore/1.2 CFNetwork/3826 Darwin/24', {}, 'ios_app'], ['https://localhost', 'Mozilla/5.0 (Linux; Android 14) wv', {}, 'android_app'],
  [O, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari', {}, 'site_iphone'], [O, 'Mozilla/5.0 (Linux; Android 14) Chrome', {}, 'site_android'], [O, 'Mozilla/5.0 (Windows NT 10.0) Chrome', {}, 'site_pc'], [O, 'Mozilla/5.0 (iPhone) AppleWebKit', { via: 'app' }, 'ios_app']];
let k = 10; for (const [o, ua, extra, want] of cases) { const x = await call(o, { ...order('05511100' + (k++)), ...extra }, ua); ok(x.ok && via(x.orderNo) === want, 'مصدر الطلب ' + want + ': ' + (x.ok ? via(x.orderNo) : x.code)); }
console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
