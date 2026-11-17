// عدّاد الزوار الدقيق (١٧ نوفمبر ٢٠٢٦): /hit و/admin/visits.
// يفحص: زائر = جهاز مختلف (فتح الصفحة كذا مرة = زائر واحد)، الجلسات (فاصل ٣٠ دقيقة)، الجديد والراجع، مراحل الشراء،
// المصدر، المرسل متأخر بوقته الأصلي، الروبوتات، أجهزة الموظفين مستثناة، تغطية الطلبات (كل طلب له زيارة)، والصلاحيات.
// التشغيل: node server/test/visits.mjs   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8')); data.store.closed = false; delete data.store.minOrder; delete data.store.openAt; delete data.store.closeAt; data.store.fee = 0; data.store.freeOver = 0;
const pool = data.products.filter((p) => p.stock !== false && !p.soon && Number(p.price) > 0 && !p.packs);
const [P1] = pool.map((p) => p.id);
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
const D = 864e5, M = 60e3; let T = Date.UTC(2026, 10, 10, 9, 0, 0); Date.now = () => T;
let ipn = 0;
const call = (p, body, ip, ua) => w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip || '8.4.' + (ipn++ % 250) + '.1', 'User-Agent': ua || 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const dev = (c) => 'd-' + c.repeat(20);
const A = dev('a'), B = dev('b'), C = dev('c'), S = dev('s'), BOT = dev('r');
const hit = (d, st, extra, ua) => call('/hit', Object.assign({ dev: d, st: st || 0 }, extra || {}), null, ua);
const rep = (days) => call('/admin/visits', { pin: '2468', days: days || 1 });

ok((await call('/hit', { dev: 'bad' })).code === 'bad_request', 'رقم جهاز غلط مرفوض');
// أ: يفتح ٣ مرات بنفس الجلسة، ثم بعد ساعة جلسة ثانية، يشوف منتج ويضيف ويوصل الدفع ويطلب
ok((await hit(A, 0, { src: 'qr' })).ok, 'أ فتح الموقع من ملصق QR');
T += 2 * M; await hit(A, 0); T += 2 * M; await hit(A, 0);
T += 60 * M; await hit(A, 0); await hit(A, 1); await hit(A, 2); await hit(A, 3);
const o = await call('/order', { items: { [P1]: 2 }, phone: '0551112233', lat: 24.84, lng: 46.83, name: 'سارة', details: 'شارع ١', dev: A });
ok(o.ok, 'أ طلب ' + (o.code || ''));
// ب: يفتح من قوقل ويشوف منتج بس
T += 5 * M; await hit(B, 0, { src: 'google' }); await hit(B, 1);
// ج: مرسل متأخر (انحفظ بجهازه) بوقته الأصلي قبل ١٠ دقايق
await call('/hit', { dev: C, q: [{ st: 0, at: T - 10 * M, src: 'wa' }, { st: 2, at: T - 9 * M }] });
// روبوت: ما ينحسب
ok((await hit(BOT, 0, {}, 'Mozilla/5.0 (compatible; Googlebot/2.1)')).skipped === 'bot', 'الروبوت ما ينحسب');
// جهاز موظف: ينحسب عليه بس ينستثنى
await hit(S, 0, { staff: 1 });

let r = await rep(1);
ok(r.ok, 'التقرير يرد');
ok(r.visitors === 3, 'الزوار = ٣ أجهزة مختلفة (مو عدد الفتحات): ' + r.visitors);
ok(r.opens === 6, 'مرات فتح الصفحة = ٦: ' + r.opens);
ok(r.visits === 4, 'الجلسات = ٤ (أ جلستين، ب، ج): ' + r.visits);
ok(r.fresh === 3, 'كلهم زوار جدد: ' + r.fresh);
ok(r.funnel.viewed === 3 && r.funnel.carted === 2 && r.funnel.checkout === 1 && r.funnel.ordered === 1, 'مراحل الشراء صحيحة ' + JSON.stringify(r.funnel));
ok(r.orders === 1 && r.coverage.orders === 1 && r.coverage.seen === 1, 'تغطية: الطلب له زيارة مسجلة');
const qr = r.sources.find((x) => x.src === 'qr'); ok(qr && qr.visitors === 1 && qr.buyers === 1, 'المصدر QR: زائر واحد واشترى');
ok(r.sources.some((x) => x.src === 'google') && r.sources.some((x) => x.src === 'wa'), 'المصادر قوقل والواتساب موجودة');
ok(r.staffDevices === 1, 'جهاز الموظف مسجل ومستثنى');
ok(r.live === 2, 'المتواجدين الحين (آخر ٥ دقايق: أ وب) = ٢: ' + r.live);

// اليوم الثاني: أ يرجع (راجع مو جديد)، والطلب بدون زيارة يطلع بالتغطية
T += D; await hit(A, 0);
const o2 = await call('/order', { items: { [P1]: 1 }, phone: '0551112299', lat: 24.84, lng: 46.83, name: 'نورة', details: 'شارع ٢', dev: dev('z') });
r = await rep(1);
ok(r.visitors === 1 && r.fresh === 0, 'اليوم الثاني: أ زائر راجع مو جديد');
ok(r.coverage.orders === 1 && r.coverage.seen === 0 && r.coverage.missing.length === 1, 'طلب بدون زيارة مسجلة يطلع في «ناقص»');
r = await rep(2);
ok(r.visitors === 3 && r.daily.length === 2 && r.daily[0].visitors === 3 && r.daily[1].visitors === 1, 'يومين: ٣ أجهزة مختلفة (أ مرة وحدة)، وسطرين يومي');
// الصلاحيات
ok((await call('/admin/visits', { pin: '0000', days: 1 })).ok !== true, 'بدون رقم الإدارة مرفوض');
const x = await call('/admin/staff-dev', { pin: '2468', dev: B }); ok(x.ok && x.n === 2, 'المالك يستثني جهاز');
r = await rep(2); ok(r.visitors === 2, 'بعد استثناء ب: ٢');
// الساعات: يوم معيّن وساعة معيّنة
{ const day = '2026-11-20', at = (hh, mm) => Date.parse(day + 'T' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':00+03:00');
  T = at(21, 50);
  await call('/hit', { dev: dev('h'), q: [{ st: 0, at: at(21, 5), src: 'google' }] }); await call('/hit', { dev: dev('h'), q: [{ st: 0, at: at(21, 40) }] });
  await call('/hit', { dev: dev('i'), q: [{ st: 0, at: at(21, 30) }] }); await call('/hit', { dev: dev('j'), q: [{ st: 0, at: at(9, 15) }] });
  await call('/hit', { dev: S, staff: 1, q: [{ st: 0, at: at(21, 10) }] });
  const hr = await call('/admin/visit-hours', { pin: '2468', day, h: 21 });
  const h21 = hr.hours[21], h9 = hr.hours[9];
  ok(hr.ok && h21.visitors === 2 && h21.opens === 3 && h9.visitors === 1, 'الساعة ٩ المساء: زائرين و٣ زيارات، و٩ الصبح زائر (الموظف مستثنى) ' + JSON.stringify(h21));
  ok(hr.list && hr.list.length === 3 && hr.list[0].src === 'google' && new Date(hr.list[0].at + 3 * 36e5).getUTCMinutes() === 5, 'قائمة زيارات الساعة بوقت كل وحدة ومصدرها');
  ok(hr.visitors === 3 && hr.opens === 4, 'مجموع اليوم: ٣ زوار و٤ زيارات');
  ok((await call('/admin/visit-hours', { pin: '0000', day })).ok !== true, 'الساعات تحتاج رقم الإدارة'); }
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
