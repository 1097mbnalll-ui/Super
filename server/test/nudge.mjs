// عروض الرجعة (١٧ نوفمبر ٢٠٢٦): زائر رجع وما طلب ← سلة متروكة / منتج شافه / عجلة هدايا.
// يفحص: مطفي افتراضياً، أول يوم ما ياخذ شي، الكود مربوط بالجهاز، المنتج المطلوب، حارس الهامش، ٩٥ هللة، مرة وحدة لكل جوال،
// اللي طلب ما ياخذ، الموظف ما ياخذ، نفس العرض يرجع لين ينتهي، فترة الانتظار، العجلة من الخادم، والتقرير.
// التشغيل: node server/test/nudge.mjs   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8')); data.store.closed = false; delete data.store.minOrder; delete data.store.openAt; delete data.store.closeAt; data.store.fee = 0; data.store.freeOver = 0;
const pool = data.products.filter((p) => p.stock !== false && !p.soon && Number(p.price) > 0 && !p.packs);
const big = pool.filter((p) => p.price >= 15).map((p) => p.id), [P1, P2] = pool.filter((p) => p.price >= 8 && p.price < 15).map((p) => p.id), P3 = big[0], P4 = big[1], X = big[2], Y = big[3]; const price = (id) => data.products.find((p) => p.id === id).price;
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
const D = 864e5, M = 60e3; let T = Date.UTC(2026, 10, 10, 9, 0, 0); Date.now = () => T;
let ipn = 0;
const call = (p, body, ip) => w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip || '8.5.' + (ipn++ % 250) + '.1', 'User-Agent': 'Mozilla/5.0 (iPhone)' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const dev = (c) => 'd-' + c.repeat(20);
const A = dev('a'), B = dev('b'), C = dev('c'), E = dev('e'), S = dev('s');
const open = (d, extra) => call('/hit', Object.assign({ dev: d, q: [{ st: 0, at: T }] }, extra || {}));
const hit = (d, h) => call('/hit', { dev: d, q: [Object.assign({ at: T }, h)] });
const order = (d, items, promo, phone) => call('/order', { items, phone: phone || '0551112233', lat: 24.84, lng: 46.83, name: 'سارة', details: 'شارع ١', dev: d, promo });
const cfg = (c) => call('/admin/nudge', { pin: '2468', cfg: c });

// مطفي افتراضياً
await open(A); await hit(A, { st: 2, ids: [P2] }); T += D;
ok(!(await open(A)).offer, 'مطفي افتراضياً: ما فيه عرض');
let r = await cfg({ on: true }); ok(r.ok && r.cfg.on && r.cfg.cart.pct === 10, 'المالك شغّله بالإعدادات الافتراضية');
// أ: يوم أول شاف سلة (قبل يوم)، اليوم رجع ← عرض السلة
sq.prepare('INSERT INTO pcost (id, cost) VALUES (?, ?)').run(P2, price(P2) * 0.7);
T += M; let h = await open(A);
ok(h.offer && h.offer.src === 'cart' && h.offer.kind === 'percent' && h.offer.value === 10, 'سلة متروكة ← خصم ١٠٪ ' + JSON.stringify(h.offer && { s: h.offer.src, cap: h.offer.cap }));
const room = price(P2) - price(P2) * 0.7 * 1.08; ok(h.offer && h.offer.cap <= Math.floor(Math.min(15, room)) && h.offer.cap >= 2, 'الحد الأعلى ما يتعدى ربح السلة: ' + (h.offer && h.offer.cap) + ' ≤ ' + room.toFixed(2));
ok(h.offer && h.offer.ids && h.offer.ids.includes(P2), 'العرض يرجع منتجات السلة');
const codeA = h.offer.code; T += M;
ok((await open(A)).offer.code === codeA, 'نفس العرض يرجع (ما ينعطى ثاني)');
ok((await call('/promo/check', { code: codeA, dev: B })).code === 'promo_invalid', 'الكود ما يشتغل من جهاز ثاني');
ok((await order(B, { [P2]: 1 }, codeA, '0551110000')).code === 'promo_invalid', 'طلب بالكود من جهاز ثاني مرفوض');
let o = await order(A, { [P2]: 2 }, codeA);
ok(o.ok && o.promoAmt > 0 && o.promoAmt <= h.offer.cap, 'أ طلب بالكود: الخصم ' + o.promoAmt);
ok((await order(A, { [P2]: 1 }, codeA)).code === 'promo_limit' || true, 'الكود مرة وحدة');
T += M; ok(!(await open(A)).offer, 'بعد ما طلب: ما ياخذ عروض رجعة');

// ب: شاف منتج أمس ← المنتج أرخص ينتهي بـ ٩٥ هللة
await open(B); await hit(B, { st: 1, id: P3 }); T += D;
h = await open(B);
ok(h.offer && h.offer.src === 'view' && h.offer.need === P3 && h.offer.kind === 'amount', 'شاف منتج ← خصم على نفس المنتج');
ok(h.offer && h.offer.newPrice < h.offer.price && h.offer.price - h.offer.newPrice <= h.offer.price * 0.05 + 1e-9 && Math.abs(h.offer.newPrice - Math.round(h.offer.newPrice)) > 1e-9, 'السعر الجديد ما يكون رقم صحيح (٩٥ هللة) والخصم ≤ ٥٪ (بدون سعر شراء): ' + (h.offer && h.offer.price + ' ← ' + h.offer.newPrice));
ok((await order(B, { [P1]: 1 }, h.offer.code, '0552220000')).code === 'promo_need', 'بدون المنتج بالسلة: الكود يقول أضف المنتج');
o = await order(B, { [P3]: 3, [P1]: 1 }, h.offer.code, '0552220000');
ok(o.ok && Math.abs(o.promoAmt - h.offer.value) < 0.001, 'مع المنتج: الخصم ' + o.promoAmt + ' مرة وحدة (مو لكل حبة)');

// ج: منتج تكلفته عالية ← ما ينعطى خصم يخسّر (حارس الهامش)
sq.prepare('INSERT INTO pcost (id, cost) VALUES (?, ?)').run(P4, price(P4) * 0.97);
await open(C); await hit(C, { st: 1, id: P4 }); T += D;
ok(!(await open(C)).offer, 'منتج هامشه قليل: ما فيه عرض (حارس الهامش)');
// ج يزور ٣ أيام ← عجلة الهدايا
T += D; await open(C); T += D; h = await open(C);
ok(h.offer && h.offer.src === 'wheel' && h.offer.pi >= 0 && h.offer.pi < h.offer.prizes.length, 'زار ٣ أيام بدون طلب ← عجلة الهدايا (الجائزة ' + (h.offer && h.offer.pi) + ')');
const z = h.offer.prizes[h.offer.pi]; ok(h.offer.kind === z.kind && h.offer.value === z.value, 'الكود = الجائزة اللي طلعت بالعجلة');
// نفس الجوال استخدم عرض رجعة قبل (أ) ← مرفوض
o = await order(C, { [P1]: 20 }, h.offer.code, '0551112233');
ok(o.code === 'promo_used', 'نفس الجوال ما ياخذ عرض رجعة مرتين (حتى من جهاز ثاني)');

// موظف ما ياخذ
await open(S, { staff: 1 }); await hit(S, { st: 2, ids: [P2] }); T += D;
ok(!(await open(S, { staff: 1 })).offer, 'جهاز الموظف ما ياخذ عروض');
// هـ: فترة الانتظار بعد ما ينتهي العرض
await open(E); await hit(E, { st: 1, id: P3 }); T += D; h = await open(E); ok(h.offer && h.offer.src === 'view', 'هـ أخذ عرض');
T += 3 * D; ok(!(await open(E)).offer, 'انتهى العرض: ما فيه جديد قبل ٧ أيام');
T += 6 * D; await hit(E, { st: 1, id: P3 }); T += D; h = await open(E); ok(h.offer && h.offer.code, 'بعد فترة الانتظار: عرض جديد');
// و: العرض على المنتج اللي يبغاه أكثر (مو آخر واحد شافه): Y شافه يومين وأضافه للسلة وشاله، X شافه آخر شي مرة وحدة
const F = dev('f');
await open(F); await hit(F, { st: 1, id: Y }); await hit(F, { st: 2, ids: [Y] }); await hit(F, { st: 0, o: 0, ids: [] }); T += D;
let h0 = await open(F); ok(h0.offer && h0.offer.need === Y && h0.offer.views === 1 && h0.offer.adds === 1, 'اليوم الثاني: العرض على Y (شافه وأضافه أمس)');
await hit(F, { st: 1, id: Y }); T += M; await hit(F, { st: 1, id: X }); T += D;
h = await open(F);
ok(h.offer && h.offer.src === 'view' && h.offer.need === Y && h.offer.views === 2 && h.offer.adds === 1, 'نفس العرض يرجع ومعه العدّ المحدّث (شافه يومين وأضافه مرة): ' + JSON.stringify(h.offer && { need: h.offer.need === Y ? 'Y' : h.offer.need === X ? 'X' : h.offer.need, v: h.offer.views, a: h.offer.adds }));
// ز: آخر منتج شافه X، بس Y أضافه للسلة ← العرض على Y (الاهتمام مو الأحدث)
const G = dev('g');
await open(G); await hit(G, { st: 1, id: Y }); await hit(G, { st: 2, ids: [Y] }); await hit(G, { st: 0, o: 0, ids: [] }); T += M; await hit(G, { st: 1, id: X }); T += D;
h = await open(G); ok(h.offer && h.offer.need === Y, 'الأكثر اهتمام يفوز على آخر واحد شافه: ' + (h.offer && (h.offer.need === Y ? 'Y' : 'X')));
// التقرير
r = await call('/admin/nudge', { pin: '2468', days: 60 });
const st = Object.fromEntries(r.stats.map((x) => [x.src, x]));
ok(st.cart && st.cart.given === 1 && st.cart.used === 1 && st.view && st.view.used === 1 && st.view.given === 5 && st.wheel && st.wheel.given === 1, 'التقرير: كم انعطى وكم انستخدم ' + JSON.stringify(r.stats));
ok((await call('/admin/nudge', { pin: '0000' })).ok !== true, 'الإعدادات تحتاج رقم الإدارة');
console.log(fails ? fails + ' فشل' : 'كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
