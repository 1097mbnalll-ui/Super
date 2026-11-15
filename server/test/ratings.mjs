// اختبار: تقييم الطلب بعد التوصيل (/rate)، ظهوره في /track، والإدارة (/admin/ratings) وتنبيه التقييم المنخفض.
// التشغيل:  node server/test/ratings.mjs   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8'));
data.store.closed = false; delete data.store.minOrder; delete data.store.maxKm; delete data.store.zone; delete data.store.hoursOpen;
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB, TELEGRAM_BOT_TOKEN: 'tg' };
const tgSent = [];
const gh = githubMock(() => data, async () => new Response('{"ok":true}'), true);
globalThis.fetch = async (u, init) => { if (String(u).includes('api.telegram.org')) { const m = JSON.parse(init.body); if (/تقييم منخفض/.test(m.text || '')) tgSent.push(m); return new Response('{"ok":true}'); } return gh(u, init); };
let ipn = 0; const pending = [];
const call = (p, body, ip) => w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip || '9.9.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil(q) { pending.push(q); } }).then((r) => r.json());
const settle = () => Promise.all(pending.splice(0));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const A = { pin: '2468' };
await call('/admin/team-save', { ...A, name: 'سعيد', role: 'driver', newPin: '1111' });
const mk = (phone) => call('/order', { items: { pantry0: 1 }, phone, lat: 24.84, lng: 46.83 });
const deliver = async (no) => { for (const s of ['accepted', 'onway', 'delivered']) await call('/driver/status', { pin: '1111', no, status: s }); };
const N = (n) => Number(String(n).replace(/\D/g, '')) - 1000;
kv.set('tg_chat', '555');

// ١) ما يقيّم قبل التوصيل، ولا غير صاحب الطلب
const ph = '0554440001';
const o1 = (await mk(ph)).orderNo; ok(!!o1, 'طلب جديد: ' + o1);
let r = await call('/rate', { no: o1, phone: ph, stars: 5 }); ok(r.code === 'not_delivered', 'قبل التوصيل ما يقيّم: ' + r.code);
let t = await call('/track', { no: o1, phone: ph }); ok(t.ok && t.rating === undefined && t.canRate === undefined, 'التتبع قبل التوصيل ما فيه تقييم');
await deliver(o1);
t = await call('/track', { no: o1, phone: ph }); ok(t.status === 'delivered' && t.rating === null && t.canRate === true, 'بعد التوصيل: يقدر يقيّم وما فيه تقييم');
ok((await call('/rate', { no: o1, phone: '0559999999', stars: 5 })).code === 'not_found', 'جوال غير صاحب الطلب ما يقيّم');
ok((await call('/rate', { no: o1, phone: ph, stars: 0 })).code === 'bad_request', 'نجوم صفر مرفوضة');
ok((await call('/rate', { no: o1, phone: ph, stars: 6 })).code === 'bad_request', 'نجوم ٦ مرفوضة');
ok((await call('/rate', { no: o1, phone: ph, stars: 4.5 })).code === 'bad_request', 'نجوم كسور مرفوضة');
ok((await call('/rate', { no: o1, phone: ph, stars: '5' })).code === 'bad_request', 'نجوم نص مرفوضة');

// ٢) التقييم ينحفظ، والاختيارات تتنظف، والملاحظة تنقص
r = await call('/rate', { no: o1, phone: ph, stars: 5, tags: ['driver', 'fast', 'bogus', 'driver'], note: '  شكراً\u0000 لكم '.padEnd(400, 'x') });
ok(r.ok && r.rating.stars === 5, 'التقييم ينحفظ');
ok(JSON.stringify(r.rating.tags) === '["driver","fast"]', 'الاختيارات المعروفة بس وبدون تكرار: ' + JSON.stringify(r.rating.tags));
ok(r.rating.note.length === 300 && !/\u0000/.test(r.rating.note) && r.rating.note.startsWith('شكراً'), 'الملاحظة ٣٠٠ حرف بالأكثر وبدون رموز تحكم');
ok(r.rating.until - r.rating.at === 24 * 3600e3 && r.canRate === true, 'يقدر يعدّل خلال ٢٤ ساعة');
const row1 = sq.prepare('SELECT * FROM ratings WHERE no = ?').get(N(o1)); ok(row1 && row1.drv && row1.drv !== 'admin', 'المندوب ينحفظ مع التقييم: ' + (row1 && row1.drv));
t = await call('/track', { no: o1, phone: ph }); ok(t.rating && t.rating.stars === 5 && t.canRate === true, 'التتبع يرجع التقييم المحفوظ');
await settle(); ok(tgSent.length === 0, 'التقييم العالي ما ينبّه');

// ٣) تعديل خلال ٢٤ ساعة (تقييم واحد بس للطلب)، وانخفاضه ينبّه الإدارة مرة وحدة
r = await call('/rate', { no: o1, phone: ph, stars: 2, tags: ['late'], note: 'تأخر' }); ok(r.ok && r.rating.stars === 2, 'تعديل التقييم');
ok(sq.prepare('SELECT COUNT(*) n FROM ratings').get().n === 1 && sq.prepare('SELECT edits FROM ratings').get().edits === 1, 'تقييم واحد للطلب، والتعديل ينعد');
await settle(); ok(tgSent.length === 1 && /تقييم منخفض/.test(tgSent[0].text) && /تأخر/.test(tgSent[0].text) && /#\d+/.test(tgSent[0].text), 'التقييم المنخفض ينبّه بتيليجرام');
r = await call('/rate', { no: o1, phone: ph, stars: 1, tags: ['late', 'missing'] }); await settle();
ok(r.ok && tgSent.length === 1, 'نزول من ٢ لـ ١ ما يكرر التنبيه');
ok(sq.prepare("SELECT COUNT(*) n FROM alog WHERE act = 'rate_order'").get().n === 3, 'كل تقييم يتسجل في سجل العمليات');
// بعد ٢٤ ساعة ينقفل
sq.prepare('UPDATE ratings SET created = created - ? WHERE no = ?').run(25 * 3600e3, N(o1));
r = await call('/rate', { no: o1, phone: ph, stars: 5 }); ok(r.code === 'locked' && r.rating && r.rating.stars === 1, 'بعد ٢٤ ساعة ما يتعدل: ' + r.code);
t = await call('/track', { no: o1, phone: ph }); ok(t.canRate === false && t.rating.stars === 1, 'التتبع يقول ما يقدر يعدّل');

// ٤) أول تقييم بعد ٧ أيام من التوصيل ما ينقبل
const o2 = (await mk(ph)).orderNo; await deliver(o2);
sq.prepare('UPDATE orders SET updated = updated - ? WHERE no = ?').run(8 * 864e5, N(o2));
ok((await call('/rate', { no: o2, phone: ph, stars: 4 })).code === 'too_old', 'بعد ٧ أيام من التوصيل ما يقيّم');
t = await call('/track', { no: o2, phone: ph }); ok(t.canRate === false && t.rating === null, 'والتتبع يقول كذا');
const oc = (await mk(ph)).orderNo; await call('/cancel', { no: oc, phone: ph });
ok((await call('/rate', { no: oc, phone: ph, stars: 3 })).code === 'not_delivered', 'الطلب الملغي ما يتقيّم');

// ٥) طلبات ثانية وتقرير الإدارة
const phB = '0554440002';
for (const [s, tags] of [[5, ['fresh']], [4, []], [3, ['packing']], [2, ['missing', 'damaged']]]) { const o = (await mk(phB)).orderNo; await deliver(o); ok((await call('/rate', { no: o, phone: phB, stars: s, tags })).ok, 'تقييم ' + s); }
await settle();
ok(tgSent.length === 2, 'تقييم ٢ جديد ينبّه: ' + tgSent.length);
let a = await call('/admin/ratings', { ...A, days: 30 });
ok(a.ok && a.summary.n === 5, 'الإدارة تشوف كل التقييمات: ' + a.summary.n);
ok(Math.abs(a.summary.avg - (1 + 5 + 4 + 3 + 2) / 5) < 0.01, 'المتوسط صحيح: ' + a.summary.avg);
ok(a.summary.low === 2 && JSON.stringify(a.summary.dist) === '[1,1,1,1,1]', 'التوزيع والمنخفضة: ' + JSON.stringify(a.summary.dist));
ok(a.summary.delivered >= 6, 'عدد الطلبات المسلّمة للنسبة: ' + a.summary.delivered);
ok(a.tags.find((x) => x.t === 'missing').n === 2 && a.tags.find((x) => x.t === 'late').n === 1, 'عدّ الاختيارات');
ok(a.drivers.length === 1 && a.drivers[0].name === 'سعيد' && a.drivers[0].n === 5, 'التقييم لكل مندوب باسمه');
ok(a.list[0].no && a.list.every((x) => typeof x.phone === 'string' && Array.isArray(x.tags)), 'القائمة فيها رقم الطلب والجوال');
let lo = await call('/admin/ratings', { ...A, low: true }); ok(lo.ok && lo.list.length === 2 && lo.list.every((x) => x.stars <= 2), 'فلتر التقييم المنخفض');
// الصلاحيات: المدير يشوف، موظف الطلبات والمجهز والكاشير ما يشوفون، وبدون رقم ممنوع
const mkStaff = async (role, pin) => { const s = await call('/admin/staff-save', { ...A, name: role, role, loginPin: pin }); ok(s.ok, 'حساب ' + role); return (await call('/enter', { pin })).token; };
ok((await call('/admin/ratings', { session: await mkStaff('manager', '730001') })).ok, 'المدير يشوف التقييمات');
ok((await call('/admin/ratings', { session: await mkStaff('orders', '730002') })).code === 'forbidden', 'موظف الطلبات ممنوع');
ok((await call('/admin/ratings', { session: await mkStaff('preparer', '730003') })).code === 'forbidden', 'المجهز ممنوع');
ok((await call('/admin/ratings', { session: await mkStaff('cashier', '730004') })).code === 'forbidden', 'الكاشير ممنوع');
ok((await call('/admin/ratings', { pin: '0000' })).code === 'bad_pin', 'بدون رقم صحيح ممنوع');

// ٦) حد المحاولات
let lim; for (let i = 0; i < 12; i++) lim = await call('/rate', { no: o1, phone: '0559999999', stars: 5 }, '7.7.7.7'); ok(lim.code === 'slow_down', 'محاولات تقييم كثيرة ينحدّ منها');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
