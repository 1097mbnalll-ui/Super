// استيراد ملف أصناف الكاشير (Excel) للموقع: توزيع الأقسام من اسم الصنف، تنظيف، واختيار الأهم.
// صفحة الإدارة تحمّل هذا الملف وقت الاستيراد بس (ما يثقّل الموقع على الزبون). ويشتغل في Node للاختبار.
// الطريقة: نوع المنتج اللي يجي أول في الاسم يحدد القسم («البطل فشار بالزبدة» = سناكس مو ألبان).
// أسماء الشركات اللي تسوي أكثر من نوع (المراعي، الربيع…) تُستخدم بس إذا ما فيه كلمة نوع واضحة.
// اللي ما ينطبق عليه شي يروح قسم عام واحد «المنزل والمنوعات».
var W = "(?:^|\\s|\\.|-)(?:ال|بال|و)?"; // بداية كلمة: عشان «روب» ما تنمسك داخل «مشروب»
var CATALOG_RULES = [
  // [القسم, اسمه, كلمات النوع, أسماء شركات (أضعف)]
  ["care", "العناية الشخصية", "شامبو|بلسم|معجون (?:ال)?اسنان|فرش(?:اة|اه) (?:ال)?اسنان|اسنان|" + W + "كريم\\s|كريم (?:يد|وجه|جسم|مرطب|اساس|حلاقة|شعر)|لوشن|غسول|جل (?:استحمام|شعر)|عطر|مزيل (?:ال)?عرق|مناديل|محارم|حفاض|حفائض|حفايض|حفايظ|بامبرز|بيبي جوي|كلينكس|شفرات|حلاق(?:ة|ه)|امواس|" + W + "فوط|" + W + "قطن|فازلين|صبغ(?:ة|ه)|مشط|سواك|مسواك|ماسك|واقي شمس|مولفيكس|زيت شعر|مناكير|ريكسونا|بانتين|سنسوداين|سيجنال|كولجيت|جونسون|نيفيا|نيفياء|غارنية|لوريال|شولدر|هيد اند", "دوف|لوكس|فاين|سندريلا|الويز"],
  ["clean", "المنظفات", "منظف|صابون|كلوركس|كلور|مطهر|معطر|مسحوق|مزيل (?:ال)?بقع|ملمع|ليف(?:ة|ه)|اسفنج|مساح(?:ة|ه)|مكنس(?:ة|ه)|ممسح(?:ة|ه)|مبيد|منعم|تعقيم|معقم|كفوف|قفاز|زبال(?:ة|ه)|نفايات|مناشف مطبخ|رول مطبخ|نشاف|سائل (?:صحون|غسيل|ملابس|ايدي|اليدين)|غسيل|بخور|عود\\s|مبخر(?:ة|ه)", "تايد|اريال|فيري|ديتول|داوني|هاربيك|جونت|برسيل|فنش|فينيل|كمفورت|داك|العجيب|اومو|جف|بريل|لايف|سنوفا|العملاق|كلوركس|يور"],
  ["sweets", "الحلويات والسناكس", "ايسكريم|ايس كريم|آيس كريم|شوكولا|شكولا|شوكلا|شوكو|بسكويت|بسكوت|ويفر|" + W + "علك|حلاو|حلو(?:ى|ي)|شيبس|" + W + "بطاطس|فشار|تسالي|فصفص|" + W + "لب\\s|سناك|كاندي|مصاص|" + W + "جيلي|مارشميلو|مارشملو|مارش ميلو|كيت ?كات|سنيكرز|سنكرز|ميلكا|تويكس|كوكيز|كرانشي|تاكس|دوريتوس|" + W + "ليز\\s|بفك|" + W + "بف\\s|نوتيلا|توفي|مكسرات|" + W + "لوز|فستق|كاجو|فول سوداني|بزر|كراميل|سكيتلز|سكتلز|باونتي|بونتي|" + W + "مارس\\s|كرسبي|كندر|برينجلز|تشيتوس|ام اند امز|كورن ?فليكس|سويس رول|" + W + "رول\\s|كاسترد|بودين|مهلبي|كريم كراميل|حلا\\s|لوليتا|مرامي", "اولكر|امريكانا|تيشوب|رينجو|ديري ميلك|سينو|فش فاش|بريك|سكليتز|كتكات|تيفاني|ديمه|ديمة|البطل|غندور|جالكسي|جلكسي|ريجالو|جوديفا|سويتز|دايز|كاكو|مكفيتز|مكفتيز|ماكفيتيز|ميموري|جولن|لوكير|لواكر|فوشية|لتين|بسكريم|كواليتي"],
  ["bakery", "المخبز", "" + W + "خبز|صامولي|توست|كرواسون|كروسان|" + W + "كعك|بقسماط|تميس|شابور(?:ة|ه)|فطائر|فطير(?:ة|ه)|باتون|بريوش|" + W + "كيك|معمول|كليجا|تورتيلا|سمبوس(?:ة|ه)|بيتزا|عجين(?:ة|ه)|رقاق|مخبز|مافن|دونات", "لوزين|الطازج"],
  ["meat", "اللحوم والدواجن", "دجاج|" + W + "لحم|كبد(?:ة|ه)|نقانق|برجر|مرتديلا|سجق|ناجتس|شاورما|" + W + "سمك|روبيان|مجمد|مفرزن|دواجن|" + W + "فخذ|صدور|اجنح(?:ة|ه)|مفروم|كباب|استربس|بانيه", "ساديا|الوطنية|اليوم|دوراديو|سيارا|تنمية"],
  ["veg", "الخضار والفواكه", "خضار طازج|فواكه طازج|فواكة طازج|خضار وفواك|" + W + "خس\\s|بقدونس|كزبر(?:ة|ه) (?:خضراء|طازج)|نعناع طازج|باذنجان|فلفل رومي|بطيخ|شمام", ""],
  ["dairy", "الألبان والبيض", "حليب|" + W + "لبن|" + W + "جبن|زبادي|" + W + "روب|قشط(?:ة|ه)|زبد(?:ة|ه)|" + W + "بيض\\s|" + W + "بيض$|لبن(?:ة|ه)|كريم(?:ة|ه) (?:طبخ|خفق|الطبخ|الخفق)|" + W + "سمن", "المراعي|نادك|الصافي|داري|السعودية|بوني|كرافت|كرفت|كيري|بوك|البقرة الضاحكة|بك\\s|الري"],
  ["drinks", "المشروبات", "عصير|" + W + "مياه|" + W + "مياة|" + W + "ماء|مشروب|شراب|طاق(?:ة|ه)|نكتار|صودا|عيران|" + W + "كولا|قهو(?:ة|ه)|" + W + "بن\\s|" + W + "شاي|" + W + "شاهي|كاكاو|كابتشينو|نسكافي|كوفي|" + W + "ثلج|ايس تي|بير(?:ه|ة)\\s|كركدي", "ريتا|فانتا|كافي(?:ه|ة)?\\s|نسكافيه|كددي|كي دي دي|زوي|ستريم|راني|بربيكان|باربيكان|الربيع|ربيع|سن ?توب|ليبتون|كودرد|بيبسي|ببسي|ميرندا|سفن ?اب|كوكا|فيمتو|تانج|ريد ?بول|صافيو|نوفا|اكوافينا|بيرين|موسي|هولستن|بدويزر|سبرايت|شاني|ماونتن|ديو\\s|حمضيات|لونا|فريشكو|كودو|توب ماكس|سن بلس|نستله|القصيم"],
  ["pantry", "البقالة", "" + W + "رز|" + W + "ارز|" + W + "سكر|" + W + "زيت|طحين|دقيق|معكرون|مكرون|شعيري|اندومي|نودلز|" + W + "فول\\s|حمص|عدس|فاصولي|تون(?:ة|ه)|سردين|صلص|" + W + "صوص|كاتشب|مايونيز|خردل|" + W + "ملح|بهار|كمون|فلفل|كركم|" + W + "هيل|مرق(?:ة|ه)?\\s|ماجي|مكعبات|" + W + "خل\\s|" + W + "عسل|مربى|طحيني|" + W + "تمر|زعتر|زيتون|" + W + "ذر(?:ة|ه)|شوفان|رقائق|حبوب|خمير(?:ة|ه)|بيكنج|" + W + "نشا|معجون طماطم|ورق عنب|مخلل|شط(?:ة|ه)|متبل|دبس|سمسم|فانيلا|بودر(?:ة|ه)|" + W + "جلي\\s|بقوليات|توابل|كاري|شوربة|شوربه|اكل (?:قطط|كلاب)|طعام (?:قطط|كلاب)", "قودي|رنا|السنبله|السنبلة|البستان|وادي النحل|غوار|ناندوز|فرشلي|الجميل|ابو بنت|الوليمة|العالميه|تاندي|حدائق كاليفورنيا|بيرفتو|الوفرة|مياو"],
  // أدوات ومتفرقات: تدخل المقارنة عشان «صواني كيك» و«كاسات عصير» ما تروح للمخبز والمشروبات
  ["misc", "المنزل والمنوعات", "صوان(?:ي|ى)|قالب|ملاعق|كاسات|" + W + "كاس\\s|اكواب|" + W + "كوب\\s|صحن|صحون|اطباق|سكين|مقص|قلم|اقلام|دفتر|لعب(?:ة|ه)|العاب|شاحن|كيبل|سماع(?:ة|ه)|بطاري|فحم|منقل|ولاع(?:ة|ه)|ترمس|دل(?:ة|ه)\\s|ابريق|قدر\\s|قدور|طنج(?:ر|ي)|مقلا|حافظ(?:ة|ه)|علب(?:ة|ه) حفظ|توصيل(?:ة|ه) كهرباء|لمب(?:ة|ه)|مروح(?:ة|ه)|شنط(?:ة|ه)|نظار(?:ة|ه)|مسبح(?:ة|ه)|ساع(?:ة|ه)\\s|مكبس|مضرب|قطاع(?:ة|ه)|مطحن(?:ة|ه)|رمل قطط|ميزان|بيكربونات|اكياس|" + W + "كيس\\s|اطباق ورق|مناديل ورق", ""],
];
var CATALOG_GENERAL = { id: "misc", name: "المنزل والمنوعات" };
var catalogRx = CATALOG_RULES.map(function(r){ return { id: r[0], name: r[1], strong: new RegExp(r[2]), weak: r[3] ? new RegExp(r[3]) : null }; });
function catalogCat(name){
  var s = " " + String(name || "").replace(/[إأآ]/g, "ا").replace(/\s+/g, " ").trim() + " ", best = null, at = 1e9, i, k;
  for (i = 0; i < catalogRx.length; i++) { k = s.search(catalogRx[i].strong); if (k > -1 && k < at) { at = k; best = catalogRx[i].id; } }
  if (best) return best;
  for (i = 0; i < catalogRx.length; i++) { if (!catalogRx[i].weak) continue; k = s.search(catalogRx[i].weak); if (k > -1 && k < at) { at = k; best = catalogRx[i].id; } }
  return best || CATALOG_GENERAL.id;
}

// ---------- قراءة صفوف الإكسل ----------
// يدور على سطر العناوين (فيه «اسم الصنف» أو «الاسم») ويعرف الأعمدة من أسمائها، فترتيب الأعمدة ما يهم.
var CATALOG_COLS = {
  code: /رقم الصنف|الباركود|باركود|كود|رقم$/,
  name: /اسم الصنف|^الاسم$|^اسم$|المنتج/,
  unit: /الوحدة|وحدة/,
  qty: /الكمية|المخزون|الرصيد/,
  cost: /التكلفة|تكلفة|سعر الشراء|الشراء/,
  price: /سعر البيع|^السعر|سعر الموقع|البيع/,
  cat: /القسم|التصنيف|الفئة/,
  sold: /المباع|مبيعات|حركة البيع|الأكثر مبيع/
};
function catalogRows(aoa){
  var head = -1, map = {}, i, j;
  for (i = 0; i < Math.min(aoa.length, 30) && head < 0; i++) {
    var row = aoa[i] || [], m = {};
    for (j = 0; j < row.length; j++) {
      var h = String(row[j] == null ? "" : row[j]).trim();
      if (!h) continue;
      for (var k in CATALOG_COLS) if (m[k] == null && CATALOG_COLS[k].test(h)) {
        if (k === "price" && /تكلف|شراء/.test(h)) continue; // «سعر الشراء» تكلفة مو سعر بيع
        if (k === "code" && /اسم/.test(h)) continue;
        m[k] = j; break;
      }
    }
    if (m.name != null && (m.code != null || m.qty != null)) { head = i; map = m; }
  }
  if (head < 0) return { error: "no_header" };
  var out = [];
  for (i = head + 1; i < aoa.length; i++) {
    var r = aoa[i] || [], name = String(r[map.name] == null ? "" : r[map.name]).replace(/\s+/g, " ").trim();
    if (!name) continue;
    var num = function(v){ if (v == null || v === "") return null; var n = Number(String(v).replace(/[٠-٩]/g, function(d){ return "٠١٢٣٤٥٦٧٨٩".indexOf(d); }).replace(/[,،\s]/g, "")); return isFinite(n) ? n : null; };
    out.push({ code: catalogCode(r[map.code]), name: name, unit: map.unit == null ? "" : String(r[map.unit] == null ? "" : r[map.unit]).trim(),
      qty: num(r[map.qty]), cost: map.cost == null ? null : num(r[map.cost]), price: map.price == null ? null : num(r[map.price]),
      cat: map.cat == null ? "" : String(r[map.cat] == null ? "" : r[map.cat]).trim(), sold: map.sold == null ? null : num(r[map.sold]), dateCode: r[map.code] instanceof Date });
  }
  return { rows: out, cols: Object.keys(map) };
}
function catalogCode(v){
  if (v == null) return "";
  if (typeof v === "number" && isFinite(v) && Math.floor(v) === v) return String(v);
  return String(v).replace(/\*/g, "").trim();
}
function catalogUnit(u){
  u = String(u || "").replace(/[0-9٠-٩]+$/, "").trim();
  if (!u || /^حب(?:ة|ه)$/.test(u) || /^[0-9]+$/.test(u)) return "حبة";
  return u.replace(/ه$/, "ة").replace(/^شدة$/, "شدّة");
}
function catalogNorm(s){ return String(s || "").replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[\u064B-\u0652]/g, "").replace(/\s+/g, " ").trim(); }
function catalogId(code){ return "x" + String(code).replace(/[^0-9A-Za-z_-]/g, "_").slice(0, 40); }

// ---------- الخطة: وش ينضاف ووش يتحدّث ----------
// opts.limit: كم منتج يكون في الموقع بالإجمالي (مبدئياً ٣٠٠٠). opts.cats: أقسام الموقع الحالية [{id,name}].
// المنتجات اللي ضافها صاحب المحل بيده (ما لها باركود من الملف) ما تنلمس.
function catalogPlan(rows, products, opts){
  opts = opts || {};
  var limit = Math.max(1, Number(opts.limit) || 3000), skip = {}, i;
  var note = function(k){ skip[k] = (skip[k] || 0) + 1; };
  var byCode = {}, byName = {}, onSite = {};
  products.forEach(function(p){ if (p.bc) onSite[p.bc] = 1; });
  for (i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.dateCode) { note("رقم الصنف خربه الإكسل (صار تاريخ)"); continue; }
    if (!r.code) { note("بدون رقم صنف"); continue; }
    if (/^(?:مخبز|خضار|فواكه|فواكة|خضار و ?فواك.|لحوم|عام|متفرقات|منوعات|بقالة|بقاله)$/.test(r.name)) { note("صنف عام في الكاشير مو منتج (مثل «مخبز»)"); continue; }
    if (!(r.qty > 0) && !opts.zero && !onSite[r.code]) { note("مخزونه صفر"); continue; }
    var o = byCode[r.code];
    if (o) { note("رقم صنف مكرر"); if (r.qty <= o.qty) continue; }
    byCode[r.code] = r.qty > 0 ? r : Object.assign({}, r, { qty: 0 });
  }
  var uniq = [];
  for (var c in byCode) {
    var x = byCode[c], k = catalogNorm(x.name), y = byName[k];
    if (y) { note("اسم مكرر"); if (x.qty <= y.qty) continue; uniq[uniq.indexOf(y)] = x; byName[k] = x; continue; }
    byName[k] = x; uniq.push(x);
  }
  // قسم كل صنف: من عمود «القسم» لو موجود وفيه اسم قسم معروف، وإلا من اسم الصنف
  var cats = (opts.cats || []).slice(), catByName = {};
  cats.forEach(function(ct){ catByName[catalogNorm(ct.name)] = ct.id; catByName[ct.id] = ct.id; });
  CATALOG_RULES.forEach(function(rr){ if (!catByName[catalogNorm(rr[1])]) catByName[catalogNorm(rr[1])] = rr[0]; });
  catByName[catalogNorm(CATALOG_GENERAL.name)] = CATALOG_GENERAL.id;
  uniq.forEach(function(x){ x.catId = (x.cat && catByName[catalogNorm(x.cat)]) || catalogCat(x.name); });
  // الأهمية: الكمية في المخزن وقيمتها (المحل يكدّس اللي ينباع أكثر)، والباركود الحقيقي يزيد
  uniq.forEach(function(x){ x.score = Math.log(1 + x.qty) + 0.5 * Math.log(1 + x.qty * Math.max(0, x.cost || 0)) + (/^[0-9]{8}$|^[0-9]{12,14}$/.test(x.code) ? 1 : 0) + (x.sold > 0 ? 2 * Math.log(1 + x.sold) : 0); });
  // كلمات «لازم تنضاف» (يحددها المالك): كل صنف يحتويها كلمة كاملة (مو داخل كلمة ثانية: «ليز» ما تمسك «ليزر») يدخل أول بغض النظر عن ترتيبه
  var mustHit = {}, mustRx = (opts.must || []).map(function(w){ return String(w).trim(); }).filter(Boolean).map(function(w0){ var w = catalogNorm(w0); mustHit[w0] = 0; return { w: w0, rx: new RegExp("(?:^|[\\s.\\-/(])(?:ال)?" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[\\s.\\-/)0-9])") }; });
  uniq.forEach(function(x){ var n = catalogNorm(x.name); x.must = false; mustRx.forEach(function(m){ if (m.rx.test(n)) { x.must = true; mustHit[m.w]++; } }); });
  // المنتجات الموجودة بالموقع من استيراد قبل: نحدّثها (المخزون، التكلفة، السعر لو موجود) ونحسبها من العدد
  var have = {}; products.forEach(function(p){ if (p.bc) have[p.bc] = p; });
  var update = [], fresh = [];
  uniq.forEach(function(x){ (have[x.code] ? update : fresh).push(x); });
  var room = Math.max(0, limit - products.length);
  // حصة كل قسم بنسبة حجمه، والقسم العام (المنوعات) ما يتعدى ١٠٪
  var forced = fresh.filter(function(x){ return x.must; }).sort(function(a, b){ return b.score - a.score; }).slice(0, room);
  var isForced = {}; forced.forEach(function(x){ isForced[x.code] = 1; });
  var rest = fresh.filter(function(x){ return !isForced[x.code]; }), room2 = room - forced.length;
  var groups = {}; rest.forEach(function(x){ (groups[x.catId] = groups[x.catId] || []).push(x); });
  Object.keys(groups).forEach(function(g){ groups[g].sort(function(a, b){ return b.score - a.score; }); });
  var pick = forced.slice(), taken = {}, total = rest.length || 1, miscCap = Math.round(limit * 0.10);
  forced.forEach(function(x){ taken[x.code] = 1; });
  Object.keys(groups).forEach(function(g){
    var share = Math.floor(room2 * groups[g].length / total);
    if (g === CATALOG_GENERAL.id) share = Math.min(share, miscCap);
    groups[g].slice(0, share).forEach(function(x){ pick.push(x); taken[x.code] = 1; });
  });
  // الباقي من الحصص يروح للأعلى أهمية من كل الأقسام (بدون ما المنوعات تتعدى حدها)
  var miscN = pick.filter(function(x){ return !x.must && x.catId === CATALOG_GENERAL.id; }).length;
  rest.slice().sort(function(a, b){ return b.score - a.score; }).forEach(function(x){
    if (pick.length >= room || taken[x.code]) return;
    if (x.catId === CATALOG_GENERAL.id) { if (miscN >= miscCap) return; miscN++; }
    pick.push(x); taken[x.code] = 1;
  });
  pick.sort(function(a, b){ return b.score - a.score; });
  var noPrice = pick.filter(function(x){ return !(x.price > 0); });
  var perCat = {}; pick.forEach(function(x){ perCat[x.catId] = (perCat[x.catId] || 0) + 1; });
  var needCats = [];
  Object.keys(perCat).forEach(function(id){ if (!cats.some(function(ct){ return ct.id === id; })) { var rr = CATALOG_RULES.filter(function(q){ return q[0] === id; })[0]; needCats.push({ id: id, name: rr ? rr[1] : CATALOG_GENERAL.name }); } });
  return { must: mustHit, mustPicked: forced.length, rows: rows.length, eligible: uniq.length, skipped: skip, pick: pick, noPrice: noPrice.length, update: update, perCat: perCat, needCats: needCats, room: room, limit: limit };
}
// يطبّق الخطة على نسخة المنتجات: يرجع المنتجات الجديدة، وتغييرات المخزون والتكلفة (تنحفظ بالقاعدة السرية مو بالملف العام)
function catalogApply(plan, products){
  var stock = {}, costs = {}, added = [], priced = 0, have = {};
  products.forEach(function(p){ if (p.bc) have[p.bc] = p; });
  plan.update.forEach(function(x){
    var p = have[x.code]; stock[p.id] = Math.floor(x.qty); if (x.cost > 0) costs[p.id] = Math.round(x.cost * 100) / 100;
    if (x.price > 0 && Number(p.price) !== x.price) { p.price = x.price; priced++; }
  });
  plan.pick.forEach(function(x){
    if (!(x.price > 0)) return;
    var p = { id: catalogId(x.code), name: x.name, unit: catalogUnit(x.unit), price: x.price, cat: x.catId, img: "", stock: true, bc: x.code };
    added.push(p); stock[p.id] = Math.floor(x.qty); if (x.cost > 0) costs[p.id] = Math.round(x.cost * 100) / 100;
  });
  return { added: added, stock: stock, costs: costs, priced: priced };
}
if (typeof module !== "undefined") module.exports = { CATALOG_RULES: CATALOG_RULES, CATALOG_GENERAL: CATALOG_GENERAL, catalogCat: catalogCat, catalogRows: catalogRows, catalogPlan: catalogPlan, catalogApply: catalogApply, catalogUnit: catalogUnit, catalogNorm: catalogNorm };
