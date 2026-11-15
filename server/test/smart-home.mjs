// «الرئيسية الذكية» (١٤ نوفمبر ٢٠٢٦): سجل الجهاز المجهول من الخادم (/mine).
// يفحص: عدد الطلبات لكل منتج، آخر مرة، المدة المعتادة (الوسيط)، الكرتون على المنتج الأساسي، الملغي ما ينحسب،
// الأقدم من ١٢٠ يوم ما ينحسب، الخصوصية (أرقام بس)، رقم جهاز غلط مرفوض، وحد المعدل.
// التشغيل: node server/test/smart-home.mjs   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8')); data.store.closed = false; delete data.store.minOrder; delete data.store.openAt; delete data.store.closeAt; data.store.fee = 0; data.store.freeOver = 0;
const pool = data.products.filter((p) => p.stock !== false && !p.soon && Number(p.price) > 0 && !p.packs);
const [P1, P2, P3, P4] = pool.map((p) => p.id);
pool[3].packs = [{ u: 'كرتون', n: 6, price: Math.round(pool[3].price * 5) }];
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
const D = 864e5; let T = Date.UTC(2026, 10, 1, 9, 0, 0); const realNow = Date.now; Date.now = () => T;
let ipn = 0;
const call = (p, body, ip) => w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip || '8.3.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const dev = (c) => 'd-' + c.repeat(20);
const DA = dev('a'), DB_ = dev('b'), DN = dev('n');
const order = (items, d, phone) => call('/order', { items, phone: phone || '0551112233', lat: 24.84, lng: 46.83, name: 'سارة', details: 'شارع ١', dev: d });
const mine = (d, ip) => call('/mine', { dev: d }, ip);

// ١) رقم جهاز غلط مرفوض، وجهاز جديد بدون طلبات
ok((await mine('bad')).code === 'bad_request', 'رقم جهاز غلط مرفوض');
ok((await mine('d-<script>alert(1)</script>xx')).code === 'bad_request', 'رقم جهاز فيه رموز مرفوض');
ok((await call('/mine', {})).code === 'bad_request', 'بدون رقم جهاز مرفوض');
let m = await mine(DN); ok(m.ok && m.n === 0 && Object.keys(m.items).length === 0, 'جهاز جديد: صفر طلبات');

// ٢) طلبات قديمة (أقدم من ١٢٠ يوم) ما تنحسب
const T0 = T - 130 * D; T = T0; ok((await order({ [P3]: 1 }, DA)).ok, 'طلب قديم قبل ١٣٠ يوم');
// ٣) المنتج ١ كل ٣ أيام، والمنتج ٢ كل ٧ أيام، والكرتون للمنتج ٤
T = Date.UTC(2026, 10, 1, 9, 0, 0);
const start = T;
for (let i = 0; i < 5; i++) { T = start + i * 3 * D; const it = { [P1]: 2 }; if (i % 2 === 0) it[P2] = 1; if (i === 4) it[P4 + '~0'] = 1; ok((await order(it, DA)).ok, 'طلب ' + (i + 1) + ' (يوم ' + i * 3 + ')'); }
// طلب بنفس اليوم (نسيت شي): ما يخرّب المدة المعتادة
T += 2 * 3600e3; ok((await order({ [P1]: 1 }, DA)).ok, 'طلب ثاني بنفس اليوم');
// طلب ملغي فيه منتج ما ينطلب غيره
T += 3600e3; const cx = await order({ [P3]: 5, [P1]: 1 }, DA); ok(cx.ok, 'طلب بينلغي');
ok((await call('/driver/status', { pin: '2468', no: cx.orderNo, status: 'canceled' })).ok, 'إلغاء الطلب');
// جهاز ثاني: ما يختلط
ok((await order({ [P2]: 1 }, DB_, '0559998877')).ok, 'طلب من جهاز ثاني');

T += 60 * 1000;
m = await mine(DA);
ok(m.ok && m.n === 6, 'عدد طلبات الجهاز (بدون الملغي والقديم): ' + m.n);
const a = m.items[P1], b = m.items[P2], c = m.items[P4];
ok(a && a.n === 6 && a.gap === 3, 'المنتج ١: ٦ طلبات وكل ٣ أيام: ' + JSON.stringify(a));
ok(a && a.q === 11, 'المنتج ١: مجموع الكمية ١١: ' + (a && a.q));
ok(b && b.n === 3 && b.gap === 6, 'المنتج ٢: ٣ طلبات وكل ٦ أيام: ' + JSON.stringify(b));
ok(a && a.last === start + 12 * D + 2 * 3600e3, 'آخر مرة = آخر طلب غير ملغي');
ok(c && c.n === 1 && !('gap' in c), 'الكرتون ينحسب على المنتج الأساسي، ومرة وحدة بدون مدة: ' + JSON.stringify(c));
ok(!m.items[P4 + '~0'], 'ما فيه مفتاح كرتون منفصل');
ok(!m.items[P3], 'المنتج اللي بالطلب الملغي والقديم بس ما يطلع');
// الخصوصية: أرقام بس
const txt = JSON.stringify(m);
ok(!/0551112233|سارة|شارع|24\.84|46\.83|phone|name|lat|addr/.test(txt), 'الرد بدون جوال ولا اسم ولا عنوان ولا موقع');
ok(Object.keys(m).sort().join() === 'at,items,n,ok', 'حقول الرد: ' + Object.keys(m).join());
ok(Object.values(m.items).every((x) => Object.keys(x).every((k) => ['n', 'q', 'last', 'gap'].includes(k))), 'حقول كل منتج: n,q,last,gap بس');
const mb = await mine(DB_); ok(mb.n === 1 && Object.keys(mb.items).join() === P2, 'الجهاز الثاني يشوف طلبه بس');

// ٤) الذاكرة المؤقتة: طلب جديد من نفس الجهاز يبان على طول
T += 60 * 1000; ok((await order({ [P3]: 1 }, DA)).ok, 'طلب جديد');
m = await mine(DA); ok(m.n === 7 && m.items[P3] && m.items[P3].n === 1, 'الطلب الجديد يبان على طول (الذاكرة تتفضّى)');
// الإلغاء يفضّي ذاكرة الجهاز
const ln = sq.prepare('SELECT no FROM orders ORDER BY no DESC LIMIT 1').get().no;
ok((await call('/driver/status', { pin: '2468', no: '#' + (1000 + ln), status: 'canceled' })).ok, 'إلغاء آخر طلب');
m = await mine(DA); ok(m.n === 6 && !m.items[P3], 'الإلغاء يبان على طول');

// ٥) حد المعدل لكل عنوان (٣٠ كل ١٠ دقايق، الذاكرة ما تحسب)
let lim = 0; for (let i = 0; i < 32; i++) { const r = await mine('d-' + String(i).padStart(20, 'z'), '6.6.6.6'); if (r.code === 'slow_down') lim++; }
ok(lim === 2, 'حد المعدل: ' + lim);
// القراءات قليلة: الاستعلام يستخدم فهرس الجهاز
const plan = sq.prepare("EXPLAIN QUERY PLAN SELECT no, created FROM orders WHERE dev = 'x' AND status != 'canceled' AND created >= 0 ORDER BY created DESC LIMIT 60").all().map((r) => r.detail).join(' | ');
ok(/orders_dev/.test(plan), 'الاستعلام بفهرس الجهاز: ' + plan);

Date.now = realNow;
console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
