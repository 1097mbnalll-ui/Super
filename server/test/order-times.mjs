// اختبار: أوقات مراحل الطلب (/admin/order-times): التجهيز، استلام المندوب، التوصيل.
// التشغيل:  node server/test/order-times.mjs   (node 22)
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
await call('/admin/staff-save', { ...A, name: 'المجهز', role: 'preparer', loginPin: '5555' });
await call('/save', { ...A, data });
let r;
const mk = (phone) => call('/order', { items: { pantry0: 1 }, phone, lat: 24.84, lng: 46.83 });
const N = (n) => Number(String(n).replace(/\D/g, '')) - 1000;
const o = (await mk('0551110001')).orderNo; ok(!!o, 'طلب');
const t0 = Date.now(); sq.prepare('UPDATE orders SET created = ? WHERE no = ?').run(t0 - 30 * 60000, N(o));
const pp = (await call('/admin/prep', A)).orders.find((x) => x.no === o); const ck = {}; pp.lines.forEach((l) => ck[l.key] = 'picked');
const tok = (await call('/enter', { pin: '5555' })).token; r = await call('/admin/prep-save', { session: tok, no: o, version: pp.version, orderUpdated: pp.orderUpdated, stage: 'ready', checks: ck }); ok(r.ok, 'المجهز: جاهز ' + JSON.stringify(r));
ok((await call('/driver/status', { pin: '1111', no: o, status: 'accepted' })).ok, 'المندوب مسكه');
ok((await call('/driver/status', { pin: '1111', no: o, status: 'onway' })).ok, 'طلع');
ok((await call('/driver/status', { pin: '1111', no: o, status: 'delivered' })).ok, 'وصل');
r = await call('/admin/order-times', A); const x = r.orders && r.orders.find((y) => y.no === o);
ok(r.ok && x, 'التقرير فيه الطلب');
ok(x && x.created < x.ready && x.ready <= x.accepted && x.accepted <= x.onway && x.onway <= x.delivered, 'الأوقات بالترتيب: ' + JSON.stringify(x));
ok(x && x.drv === 'سعيد' && x.prep === 'المجهز', 'اسم المندوب والمجهز: ' + (x && [x.drv, x.prep]));
ok(x && x.ready - x.created >= 29 * 60000, 'مدة التجهيز محسوبة من وقت الطلب');
// طلب ملغي ما يطلع، والمجهز ما يقدر يشوف التقرير
const o2 = (await mk('0551110002')).orderNo; await call('/admin/orders', { ...A, no: o2, status: 'canceled' });
sq.prepare("UPDATE orders SET status='canceled' WHERE no = ?").run(N(o2));
r = await call('/admin/order-times', A); ok(!r.orders.find((y) => y.no === o2), 'الملغي ما يطلع');
r = await call('/admin/order-times', { session: tok }); ok(!r.ok, 'المجهز ما يشوف التقرير');
r = await call('/admin/order-times', { pin: '1111' }); ok(!r.ok, 'المندوب ما يشوف التقرير');
r = await call('/admin/order-times', { ...A, days: 7 }); ok(r.ok && r.days === 7, '٧ أيام');
console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
