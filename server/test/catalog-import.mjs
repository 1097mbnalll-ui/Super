// اختبار استيراد ملف أصناف الكاشير: التوزيع على الأقسام، التنظيف، اختيار الأهم، والحفظ الكبير (٣٠٠٠ منتج) على الخادم.
// التشغيل:  node server/test/catalog-import.mjs   (node 22)
import { githubMock } from './support/github.mjs'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url)); const require = createRequire(import.meta.url);
const C = require('../../tools/catalog.js');
const w = (await import(path.join(here, '../worker.js'))).default;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// ١) الأقسام من الاسم: نوع المنتج اللي يجي أول، والشركات بس لو ما فيه نوع
const cases = { 'ريتا توت 185 مل': 'drinks', 'فانتا فراولة 250مل': 'drinks', 'البطل فشار عائلي زبدة 90ج': 'sweets', 'ويفر قشطه المداح 17ج': 'sweets',
  'حليب السعودية صغير كامل الدسم 200مل': 'dairy', 'الصافي لبن كامل الدسم 1.5 لتر': 'dairy', 'ليبتون ايس تي تروبيكال زيرو 240 مل': 'drinks', 'زوي آيس تي خوخ 355 مل': 'drinks',
  'دقيق ابيض 10كجم': 'pantry', 'مرقة دجاج ماجي 20 جرام': 'pantry', 'صواني كيك تيفال طويل': 'misc', 'كاسات عصير': 'misc', 'شامبو جونسون 500مل': 'care',
  'كلوركس ابيض 1.8 لتر': 'clean', 'دجاج ساديا 800ج': 'meat', 'صحن ملامين': 'misc', 'كيبل ايفون': 'misc', 'خبز تنور شعير دايت240ج': 'bakery' };
for (const [n, c] of Object.entries(cases)) ok(C.catalogCat(n) === c, 'القسم: ' + n + ' → ' + C.catalogCat(n));

// ٢) قراءة الإكسل: سطر العناوين في أي مكان، والأعمدة بأسمائها
const aoa = [[null], ['المخزن', 400], ['رقم الصنف', 'اسم الصنف', 'المخزن', 'الوحدة', 'الكمية المتوفرة', 'التكلفةSAR', 'الإجمالي', 'سعر البيع'],
  ['*6281000000017*', 'حليب المراعي 1 لتر', 400, 'حبه', 50, 5.2, 260, 6.5], [6281000000024, 'ماء نوفا 330مل', 400, 'حبة', 900, 0.35, 315, 0.5],
  [555, 'مخبز', 400, 'حبه', 39000, 0.85, 1, 1], [new Date(2026, 0, 2), 'صنف خربان', 400, 'حبة', 5, 1, 5, 2], [6281000000031, 'ريتا توت 185 مل', 400, 'حبة', 0, 0.6, 0, 1],
  [6281000000048, 'حليب  المراعي 1 لتر', 400, 'حبة', 3, 5.2, 15, 6.5], [6281000000055, 'شاحن جوال', 400, 'حبة', 4, 10, 40, null]];
const R = C.catalogRows(aoa);
ok(R.rows.length === 7 && R.rows[0].code === '6281000000017' && R.rows[0].price === 6.5 && R.rows[1].code === '6281000000024', 'قراءة الأعمدة والباركود (بدون النجوم، والرقم الكبير كامل)');
let plan = C.catalogPlan(R.rows, [], { limit: 3000, cats: [] });
ok(plan.skipped['مخزونه صفر'] === 1 && plan.skipped['اسم مكرر'] === 1 && plan.skipped['رقم الصنف خربه الإكسل (صار تاريخ)'] === 1 && plan.skipped['صنف عام في الكاشير مو منتج (مثل «مخبز»)'] === 1, 'التنظيف: صفر، مكرر، تاريخ، صنف عام: ' + JSON.stringify(plan.skipped));
ok(plan.pick.length === 3 && plan.noPrice === 1, 'ينختار ٣ وواحد بدون سعر');
let ap = C.catalogApply(plan, []);
ok(ap.added.length === 2 && ap.added.every((p) => p.bc && p.id === 'x' + p.bc && p.img === '' && p.stock === true) && ap.stock[ap.added[0].id] > 0 && ap.costs[ap.added[0].id] > 0, 'المنتج الجديد: باركود، مخزون وتكلفة بالقاعدة السرية');
ok(!JSON.stringify(ap.added).includes('5.2'), 'التكلفة ما تدخل ملف المنتجات العام');
// رفع الملف مرة ثانية: يحدّث الموجود بدل ما يكرره
const again = C.catalogRows(aoa.map((r) => (r[1] === 'ماء نوفا 330مل' ? [r[0], r[1], r[2], r[3], 40, 0.4, 0, 0.75] : r)));
plan = C.catalogPlan(again.rows, ap.added, { limit: 3000, cats: [] });
const ap2 = C.catalogApply(plan, ap.added);
ok(plan.update.length === 2 && ap2.added.length === 0 && ap2.stock['x6281000000024'] === 40 && ap.added.find((p) => p.bc === '6281000000024').price === 0.75, 'الرفع الثاني يحدّث المخزون والسعر بدون تكرار');

// ٣) الأهم فالأهم: الحد، وحصة كل قسم، والمنوعات ما تتعدى ١٠٪
const names = { drinks: 'عصير برتقال', dairy: 'حليب كامل الدسم', sweets: 'شوكولاتة', pantry: 'رز بسمتي', clean: 'منظف ارضيات', misc: 'لعبة سيارة' };
const big = []; let n = 0;
for (const [c, nm] of Object.entries(names)) for (let i = 0; i < (c === 'misc' ? 2000 : 1000); i++) { n++; big.push({ code: String(6280000000000 + n), name: nm + ' ' + i, unit: 'حبة', qty: (i % 97) + 1, cost: 1 + (i % 13), price: 2 + (i % 13), cat: '' }); }
const t0 = Date.now(); plan = C.catalogPlan(big, [], { limit: 3000, cats: [] }); const ms = Date.now() - t0;
ok(plan.pick.length === 3000, 'الحد ٣٠٠٠: ' + plan.pick.length + ' (' + ms + 'ms)');
ok(plan.perCat.misc <= 300 && plan.perCat.drinks >= 500, 'المنوعات ≤ ١٠٪ والباقي موزع: ' + JSON.stringify(plan.perCat));
const top = plan.pick.filter((x) => x.catId === 'drinks'); ok(top[0].qty >= top[top.length - 1].qty, 'داخل القسم: الأكثر كمية أول');

// ٤) الخادم يحفظ ٣٠٠٠ منتج مع مخزونها وتكلفتها مرة وحدة، والسجل سطر ملخص
const data = JSON.parse(fs.readFileSync(path.join(here, '../../data.json'), 'utf8')); data.store.closed = false;
ap = C.catalogApply(plan, data.products);
const D2 = JSON.parse(JSON.stringify(data)); plan.needCats.forEach((c) => D2.cats.push({ id: c.id, name: c.name, img: '' })); D2.products = D2.products.concat(ap.added);
const sq = new DatabaseSync(':memory:'); let queries = 0;
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { queries++; return sq.prepare(sql).get(...a) ?? null; }, async all() { queries++; return { results: sq.prepare(sql).all(...a) }; }, async run() { queries++; const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io'; let saved = null; // = data (يتحدث مع كل حفظ)
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = githubMock(() => data, async () => new Response('{"ok":true}'), true);
const call = async (p, body, get) => {
  if (p === '/save' && body && body.baseVersion === undefined) body = { ...body, baseVersion: (await call('/admin/catalog', { pin: body.pin, session: body.session })).version }; // الحفظ صار يحتاج نسخة المتجر اللي بدأت منها
  return rawCall(p, body, get);
};
const rawCall = (p, body, get) => w.fetch(new Request('https://x.dev' + p, get ? { headers: { Origin: O } } : { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '3.3.3.3' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
await call('/admin/team', { pin: '2468' }); await call('/save', { pin: '2468', data, stock: { pantry0: 5 }, costs: { pantry0: 1 } }); sq.exec('DELETE FROM alog'); queries = 0; // تجهيز جداول القاعدة أول مرة
const t1 = Date.now(); const r = await call('/save', { pin: '2468', data: D2, stock: ap.stock, costs: ap.costs }); saved = data;
ok(r.ok && Object.keys(r.stock).length >= 2900, 'حفظ ٣٠٠٠ منتج: ' + (r.ok ? 'تم' : r.code) + ' في ' + (Date.now() - t1) + 'ms، استعلامات القاعدة: ' + queries);
ok(queries < 40, 'عدد الاستعلامات قليل (مو استعلام لكل منتج): ' + queries);
ok(saved && saved.products.length === D2.products.length && !JSON.stringify(saved).includes('"cost"'), 'الملف العام فيه المنتجات بدون التكلفة');
ok(sq.prepare('SELECT COUNT(*) n FROM pcost').get().n >= Object.keys(ap.costs).length, 'التكلفة انحفظت بالقاعدة السرية');
const logs = sq.prepare("SELECT act, info FROM alog").all();
ok(logs.length === 1 && logs[0].act === 'bulk_import' && JSON.parse(logs[0].info).added === ap.added.length, 'سجل العمليات: سطر ملخص واحد ' + JSON.stringify(logs.map((l) => l.act)));
queries = 0; const s1 = await call('/stock', null, true); const s2 = await call('/stock', null, true);
ok(s1.ok && Object.keys(s1.stock).length >= 2900 && queries <= 2, 'المخزون للزوار ينقرأ من الذاكرة المؤقتة: ' + queries + ' استعلام لطلبين');
console.log(fails ? '\n' + fails + ' فحص فشل' : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
