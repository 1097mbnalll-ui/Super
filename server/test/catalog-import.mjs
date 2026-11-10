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
  'دقيق ابيض 10كجم': 'pantry', 'مرقة دجاج ماجي 20 جرام': 'pantry', 'صواني كيك تيفال طويل': 'kitchen', 'كاسات عصير': 'kitchen', 'شامبو جونسون 500مل': 'care',
  'كلوركس ابيض 1.8 لتر': 'clean', 'دجاج ساديا 800ج': 'meat', 'صحن ملامين': 'kitchen', 'كيبل ايفون': 'misc', 'خبز تنور شعير دايت240ج': 'bakery' };
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
const names = { drinks: 'عصير برتقال', dairy: 'حليب كامل الدسم', sweets: 'شوكولاتة', pantry: 'رز بسمتي', clean: 'منظف ارضيات', misc: 'شاحن جوال' };
const big = []; let n = 0;
for (const [c, nm] of Object.entries(names)) for (let i = 0; i < (c === 'misc' ? 2000 : 1000); i++) { n++; big.push({ code: String(6280000000000 + n), name: nm + ' ' + i, unit: 'حبة', qty: (i % 97) + 1, cost: 1 + (i % 13), price: 2 + (i % 13), cat: '' }); }
const t0 = Date.now(); plan = C.catalogPlan(big, [], { limit: 3000, cats: [] }); const ms = Date.now() - t0;
ok(plan.pick.length === 3000, 'الحد ٣٠٠٠: ' + plan.pick.length + ' (' + ms + 'ms)');
ok(plan.perCat.misc <= 300 && plan.perCat.drinks >= 500, 'المنوعات ≤ ١٠٪ والباقي موزع: ' + JSON.stringify(plan.perCat));
const top = plan.pick.filter((x) => x.catId === 'drinks'); ok(top[0].qty >= top[top.length - 1].qty, 'داخل القسم: الأكثر كمية أول');

// ٤) الخادم يحفظ ٣٠٠٠ منتج مع مخزونها وتكلفتها مرة وحدة، والسجل سطر ملخص
const data = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/catalog.json'), 'utf8')); data.store.closed = false;
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

// ٥) تحسينات الاستيراد (ملف حقيقي: بيض وخبز بأرقام قصيرة، وتسالي وليز بمخزون قليل)
ok(C.catalogCat('تسالي شرقية 225 جرام') === 'sweets' && C.catalogCat('فصفص البستان مالح 230ج') === 'sweets' && C.catalogCat('لب سوبر ابو ريال 50ج') === 'sweets', 'التسالي والفصفص واللب تروح للسناكس مو للمنوعات');
const mk = (code, name, qty, price, extra) => ({ code, name, unit: 'حبة', qty, cost: null, price, cat: '', dateCode: false, sold: null, ...extra });
const real = [mk('888', 'بيض هلا حقول حبه', 6838, 0.75), mk('1', 'خبز الندوة', 1076, 1), mk('555', 'مخبز', 39000, 1.15), mk('6281036004178', 'ليز تسالي كاتشب 90ج', 3, 5),
  mk('6281036004185', 'كشاف ليزر ميداليه', 3, 5), mk('6281036004192', 'مزيل العرق اسينتاليز 73 جم', 3, 12), mk('6281000000100', 'منظف ارضيات 4 لتر', 500, 12), mk('6281000000117', 'ماء نوفا 330مل', 900, 0.5), mk('6281036004208', 'سلايس حلوى', 0, 1.15)];
let pl = C.catalogPlan(real, [], { limit: 3000, cats: [] });
ok(pl.pick.some((x) => x.name === 'بيض هلا حقول حبه') && pl.pick.some((x) => x.name === 'خبز الندوة'), 'البيض والخبز بأرقام قصيرة (١، ٨٨٨) ما عاد ينشالون');
ok(!pl.pick.some((x) => x.name === 'مخبز') && pl.skipped['صنف عام في الكاشير مو منتج (مثل «مخبز»)'] === 1, 'الصنف العام «مخبز» لسا ينشال بالاسم');
ok(pl.skipped['مخزونه صفر'] === 1, 'مخزون الصفر ينشال افتراضياً');
// الحد صغير: الأقل مخزوناً يطلع برا، إلا لو ضفنا كلمته
pl = C.catalogPlan(real, [], { limit: 3, cats: [] });
ok(!pl.pick.some((x) => x.name.startsWith('ليز تسالي')), 'بدون كلمات: ليز بمخزون ٣ ما يدخل مع حد ٣');
pl = C.catalogPlan(real, [], { limit: 3, cats: [], must: ['ليز', 'تسالي'] });
ok(pl.pick.length === 3 && pl.pick.some((x) => x.name.startsWith('ليز تسالي')) && pl.must['ليز'] === 1 && pl.must['تسالي'] === 1 && pl.mustPicked === 1, 'كلمات «لازم تنضاف» تدخل الصنف أول: ' + JSON.stringify(pl.must));
ok(!pl.pick.some((x) => /ليزر|اسينتاليز/.test(x.name)), '«ليز» ما تمسك «ليزر» ولا «اسينتاليز» (كلمة كاملة بس)');
pl = C.catalogPlan(real, [], { limit: 100, cats: [], must: ['كلمةما_موجودة'] });
ok(pl.must['كلمةما_موجودة'] === 0, 'كلمة ما لها نتيجة ترجع صفر عشان نبلّغ المالك');
// مخزون صفر: لو سمح المالك يدخل بكمية صفر (يطلع نفد)، ولو الصنف موجود بالموقع ونفد يتحدّث لصفر حتى بدون السماح
pl = C.catalogPlan(real, [], { limit: 3000, cats: [], zero: true });
const apz = C.catalogApply(pl, []);
ok(apz.added.some((p) => p.name === 'سلايس حلوى') && apz.stock['x6281036004208'] === 0, 'السماح بالمخزون صفر: يضاف بكمية صفر (يطلع نفد)');
const onSite = [{ id: 'x6281000000117', bc: '6281000000117', name: 'ماء نوفا 330مل', price: 0.5, cat: 'drinks', stock: true }];
const soldOut = real.map((r) => (r.code === '6281000000117' ? { ...r, qty: 0 } : r));
pl = C.catalogPlan(soldOut, onSite, { limit: 3000, cats: [] });
ok(C.catalogApply(pl, onSite).stock['x6281000000117'] === 0, 'صنف بالموقع نفد في الملف: مخزونه يتحدّث لصفر (قبل كان يبقى متوفر)');
// عمود المبيعات (لو موجود) يرفع الأهمية فوق كمية المخزن
const sales = [mk('6281000000201', 'منظف ضخم', 900, 5, { sold: 0 }), mk('6281000000218', 'شيبس سريع البيع', 12, 2, { sold: 400 })];
pl = C.catalogPlan(sales, [], { limit: 1, cats: [] });
ok(pl.pick.length === 1 && pl.pick[0].name === 'شيبس سريع البيع', 'المبيعات تغلب على كمية المخزن لو الملف فيه عمود المبيعات');
const aoaS = [['رقم الصنف', 'اسم الصنف', 'الكمية', 'الكمية المباعة', 'سعر البيع'], ['6281000000300', 'ليز', 5, 70, 2]];
ok(C.catalogRows(aoaS).rows[0].sold === 70, 'قراءة عمود «الكمية المباعة»');


// ٦) أخطاء تصنيف حقيقية لقيناها في ملف الكاشير (١٠٬٠٠٠ صنف) وانصلحت
const real2 = { 'اكل قطط ميو ماكس 1.43 كيلو': 'pets', 'هريره طعام قطط البالغه 1.5كجم': 'pets', 'فارما غذاء طيور الحب': 'pets', 'ورق وتاليت فاين 4 رول': 'care',
  'ريتا رد بدون سكر 185 مل': 'drinks', 'الري برتقال 190مل': 'drinks', 'تانج اكياس تروبيكال 375 ج': 'drinks', 'كاكو كرواسان بالزبدة 85ج': 'sweets', 'داري فراولة مجمد 1 ك': 'veg',
  'الطائي زبدة فول سوداني 227 جم': 'pantry', 'زبدة الفول السوداني خشن 793ج': 'pantry', 'طعم الريف بازلاء خضراء 400جم': 'pantry', 'اسكريم بابو كورة 75 مل': 'sweets', 'المراعي ايسكريم ستيك': 'sweets',
  'سروال طويل الاصيل': 'misc', 'يان يان كاسات شوكلاته 50ج': 'sweets', 'اكياس زباله المنير رول 30 جالون': 'kitchen', 'مدى الخليج سفره4 *1 رول مطبوعه': 'misc', 'كمفرت ندى الربيع وردي 2لتر': 'clean',
  'الكبير روبيان كبير 400ج': 'meat', 'لوزين خبز برجر بريوش400جم': 'bakery', 'مكتيفز ثنز شيكولاتة بالحليب 42جم': 'sweets', 'روب نادك صغير': 'dairy', 'فحم الطيب صغير 40*48': 'bbq', 'لعبة مسدس ماء': 'toys',
  'دفتر رسم روكو': 'stationery', 'سياره مجنونه16840': 'toys', 'شاحن سيارة فاستر': 'misc', 'ترمس فرشلي600غ': 'pantry', 'ترمس ستانلس 1 لتر': 'kitchen', 'ريسيس زبده الفول السوداني كأس 42ج': 'sweets' };
Object.assign(real2, { 'سيارات كرت 6 حبة 8686': 'toys', 'برايفت ماكس مطويه كبير بالاجنح': 'care', 'فيري ليمون 400 مل الاصلي': 'clean', 'تين مجفف 500جم باسقات القصيم': 'pantry', 'ساردين 555 بارد': 'pantry', 'ديمه كركس كاتشب 75 جم': 'sweets', 'جف سائل ليمون 470 مل': 'clean', 'مرطب شفايف لابلو لون احمر': 'care', 'بطاريات دورسيل ريموت': 'misc' });
for (const [n, c] of Object.entries(real2)) ok(C.catalogCat(n) === c, 'قسم (من الملف الحقيقي): ' + n + ' → ' + C.catalogCat(n));
// ماركة بدون كلمة نوع تاخذ قسم بقية أصناف الماركة (٣+، ٨٠٪+)؛ وغرام بدون قاعدة = تخمين سناكس
const br = ['فولكانو شوكولاتة', 'فولكانو بسكويت', 'فولكانو ويفر', 'فولكانو كاندي', 'فولكانو'].map((n, i) => mk('62810000' + String(i).padStart(5, '0'), n + ' ' + (i + 1) * 10 + 'ج', 5, 1));
pl = C.catalogPlan([...br, mk('6281000009999', 'بلبلو 40جم', 5, 1), mk('6281000009998', 'درنفيس مفتاح', 5, 1)], [], { limit: 100, cats: [] });
ok(pl.pick.find((x) => x.name === 'فولكانو 50ج').catId === 'sweets', 'الماركة تتعلم قسمها من أصنافها');
ok(pl.pick.find((x) => x.name === 'بلبلو 40جم').src === 'guess' && pl.pick.find((x) => x.name === 'بلبلو 40جم').catId === 'sweets', 'غرام بدون قاعدة = تخمين سناكس معلّم للمراجعة');
ok(pl.pick.find((x) => x.name === 'درنفيس مفتاح').catId === 'misc' && pl.pick.find((x) => x.name === 'درنفيس مفتاح').src === 'default', 'اللي ما نعرفه يبقى منوعات ومعلّم «بدون قاعدة»');

// ٧) الأقسام الثانوية تنضم للمنوعات في الموقع (قرار المالك): التصنيف الداخلي يبقى، والمنتج والقسم الجديد = misc
pl = C.catalogPlan([mk('6281000007001', 'لعبة مسدس ماء', 9, 5), mk('6281000007002', 'فحم الطيب صغير', 9, 5), mk('6281000007003', 'اكل قطط ميو ماكس 1 كيلو', 9, 5), mk('6281000007004', 'دفتر رسم روكو', 9, 5), mk('6281000007005', 'صحن ملامين', 9, 5), mk('6281000007006', 'شيبس ليز 25جم', 9, 1)], [], { limit: 100, cats: [{ id: 'misc', name: 'المنزل والمنوعات' }, { id: 'sweets', name: 'الحلويات والسناكس' }] });
const apM = C.catalogApply(pl, []);
ok(apM.added.filter((p) => p.cat === 'misc').length === 5 && apM.added.find((p) => p.name.startsWith('شيبس')).cat === 'sweets', 'الثانوية كلها تنضاف للمنوعات، والأكل يبقى بقسمه');
ok(!pl.needCats.length && Object.keys(pl.perCat).every((c) => ['misc', 'sweets'].includes(c)), 'ما ينطلب قسم جديد للثانوية: ' + JSON.stringify(pl.perCat));

console.log(fails ? '\n' + fails + ' فحص فشل' : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
