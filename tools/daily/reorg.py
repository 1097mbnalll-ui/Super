"""الجزء 0 من REORG-PLAN.md: الأقسام الـ١٧ الجديدة + نقل المنتجات من الأقسام القديمة (بالقسم الفرعي `sub`).
الاستخدام: python3 tools/daily/reorg.py data.json [--apply] [--report=ملف]
- منتج له sub: ينتقل حسب الجدول MAP (الـsub سبق مراجعته بـ subs.py).
- منتج بدون sub: تنطبق عليه FIX وقواعد subs.py لقسمه؛ وإلا classify.py لو اقترح قسم ثاني (يطلع في التقرير للمراجعة)؛ وإلا يبقى بقسمه الأقرب.
- ما يغيّر price/old/stock ولا يحذف منتج. يحدّث `cat` و`sub` فقط، و`cats`."""
import json, re, sys, collections
from classify import norm, classify
import subs as SB

# (القسم القديم، sub) ← القسم الجديد. أي شي غير موجود يبقى بقسمه القديم
MAP = {
 ('dairy', 'cheese'): 'cheese',
 ('drinks', 'juice'): 'juice', ('drinks', 'tea'): 'tea',
 ('sweets', 'chips'): 'snacks', ('sweets', 'nuts'): 'snacks',
 ('sweets', 'biscuits'): 'biscuits', ('sweets', 'cakes'): 'biscuits',
 ('sweets', 'icecream'): 'icecream',
 ('pantry', 'rice'): 'grains', ('pantry', 'flour'): 'grains',
 ('care', 'paper'): 'clean',
}

# القسم الجديد: (الاسم، الإنجليزي، اللون)، بالترتيب المعتمد في الخطة
NEW = [
 ('dairy', 'الألبان والبيض', 'Dairy & eggs', '#E4F1FF'),
 ('cheese', 'الأجبان', 'Cheeses', '#FFF5D6'),
 ('drinks', 'المشروبات والمياه', 'Drinks & water', '#DFF5F8'),
 ('juice', 'العصائر', 'Juices', '#FFEBD6'),
 ('tea', 'الشاي والقهوة', 'Tea & coffee', '#EFE6DA'),
 ('snacks', 'الشيبس والمكسرات', 'Chips & nuts', '#FFF0D0'),
 ('sweets', 'الشوكولاتة والحلويات', 'Chocolate & sweets', '#FFE8F2'),
 ('biscuits', 'البسكويت والكيك', 'Biscuits & cakes', '#FBEBDD'),
 ('icecream', 'المثلجات', 'Ice cream', '#E3F1FF'),
 ('pantry', 'المعلبات والصلصات', 'Canned & sauces', '#EEE9FF'),
 ('grains', 'الأرز والدقيق', 'Rice & flour', '#F5EFD9'),
 ('meat', 'اللحوم والدواجن', 'Meat & poultry', '#FFE6EA'),
 ('clean', 'المنظفات والورقيات', 'Cleaning & paper', '#E8EEFF'),
 ('care', 'العناية الشخصية والأطفال', 'Personal care & baby', '#FFF5D6'),
 ('misc', 'المنزل والمنوعات', 'Home & misc', '#EEF0F3'),
 ('bakery', 'المخبز', 'Bakery', '#FFEBD6'),
 ('veg', 'الخضار والفواكه', 'Fruits & vegetables', '#E1F6EC'),
 ('roast', 'المحمصة', 'Nuts & roastery', '#FFEBD6'),
 ('print', 'الطباعة', 'Printing', '#FFEBD6'),
]

# بعد التصنيف: منتجات بدون sub لسا في قسم غلط بالاسم (مراجعة ١٧ نوفمبر): (من أقسام قديمة، إلى، كلمات)
RES = [
 ({'sweets'}, 'pantry', SB.rx('خليط|مسحوق|حشوه وتزيين|رقايق شوكو|كسكسي')),
 ({'drinks'}, 'pantry', SB.rx('نسكويك رقائق|كورن فلكس|ميلو اوريو')),
 ({'sweets'}, 'dairy', SB.rx('حلى فانيليا|حلى يوناني|دانيت|مهلبيه|يوبرو|حلي فانيليا|حلى')),
 ({'sweets'}, 'tea', SB.rx('باجه قهوه|باجة قهوة|قهوه سعوديه|قهوه تركيه|كبتشينو|كابتشينو')),
 ({'sweets'}, 'pantry', SB.rx('شيره الحلويات|شراب كارميل|شراب فواكه|طرشي|فراوله امريكانا|قودي اناناس|فيتو تشيني|فطائر كريب|حبوب افطار|كوكو بوبس|كوكو بفس')),
 ({'sweets'}, 'snacks', SB.rx('صن بايت|صون بايت|بيوقلز|رقائق ذره|منفوخات|بطاكس|فصفص|دوار الشمس|بذور|سناك ذره|كتكو بليس|كتكو بايتس|برنقلز|برنجلز|فاير فنجر|مشكل ملح حلو|فستك|قراميش|لوتسي|كراكلز|بطاطس')),
 ({'sweets'}, 'biscuits', SB.rx('كرواسان|بسكريم|بسكويات|ماكفتيز|ماكفيتيز|دايجست|كات كات تات|كانولي|رولانا|بيكاديلي|ميني تكس|شوكو سانويتش|شوكو سندويش|فيرو روشيه')),
 ({'pantry'}, 'meat', SB.rx('مسحب|هوت دوج بقري|قوانص')),
 ({'pantry'}, 'dairy', SB.rx('لورباك زبده|بوك لورباك')),
 ({'pantry'}, 'biscuits', SB.rx('دايجست|ماكفيتيز|شكو سندويش|شوكو سندويش|سويس رول')),
 ({'pantry'}, 'snacks', SB.rx('رقائق بطاطس|رقائق خضار|رقائق السبرينج|كودو تورتيلا بطاطس|رقائق باف')),
 ({'pantry'}, 'sweets', SB.rx('جلي هوت|جيلي هوت')),
 ({'pantry'}, 'snacks', SB.rx('تورتيلا حار')),
 ({'pantry'}, 'grains', SB.rx('تورتيلا|شابوره|سب ساندوتش|فونتي هوت دوغ|مشلتت|جامبو سنادوتش|جامبو ساندوتش')),
 ({'drinks'}, 'dairy', SB.rx('صافيو|داناو|يوبرو')),
 ({'drinks'}, 'tea', SB.rx('نسكويك|سحلب|قهوه مطحونه|كاتمونا')),
 ({'drinks'}, 'care', SB.rx('سائل لليدين|هيدشولدر|مثبت شعر|فيت لازاله|روح افزا')),
 ({'drinks'}, 'clean', SB.rx('غيار جهاز|ارويك|لوجيك|درامر|سطل زباله')),
 ({'drinks'}, 'misc', SB.rx('جاك بلاستيك|برطمان|حبل|مقاس 12')),
 ({'dairy'}, 'care', SB.rx('سيميلاك')),
 ({'care'}, 'clean', SB.rx('رول جامبو|وتاليت|فاين|اونو رول|منضف مطابخ')),
]
EXC = SB.rx('بيض جنا|بيض جنى|بيض جني|جنا بيض|جنى بيض|جني بيض|بيض شفاف|بيض لعبه|بيض لعبة|سلق بيض|صن بايت|صون بايت|كسكسي|جبنه كريميه|جبنة كريمية')
# أخطاء الـsub القديمة داخل القسم الجديد (من القسم الجديد، إلى، كلمات): تنطبق على كل المنتجات
FINAL = [
 ('icecream', 'snacks', SB.rx('ستكس عيدان|ستكس بطاطس|كتكو ستكس')),
 ('icecream', 'biscuits', SB.rx('بسكويت امادا')),
 ('icecream', 'sweets', SB.rx('سي سي ستك')),
 ('juice', 'misc', SB.rx('بخاخ ثلج|سورتوبيا')),
 ('snacks', 'biscuits', SB.rx('جلاكسي كيك|اولكر ديلوكس|ويفر|ماكفيتيز|ماكفتيز|كريم ماكسي|اوريو|بسكويت!|تيفاني نتي')),
 ('snacks', 'sweets', SB.rx('جالكسي|شوكولاته|عيدان شوكو|بورقات|جلي|حلاوه')),
 ('sweets', 'biscuits', SB.rx('بسكويت|بسكوت|ويفر|كيك|كرواسان|كوكيز|اوريو|ماكفيتيز|مكفيتز|ماكفتيز|دايجستيف|نوتيلا بسكويت')),
 ('biscuits', 'sweets', SB.rx('حلاوه|مصاص|منتوس|جلي بورقات|بورقات جلي|حلوي اصابع')),
 ('sweets', 'tea', SB.rx('باجه شاي')),
 ('sweets', 'snacks', SB.rx('فاركو|مدار مكسرات|باجه مكسرات|مكسرات مشكل')),
 ('biscuits', 'snacks', SB.rx('رايس اب')),
 ('cheese', 'snacks', SB.rx('صن بايت')),
 ('cheese', 'grains', SB.rx('ساندويتش الجبنه')),
]
COFFEE = SB.rx('قهوه|قهوة|نسكافيه|نسكافه|كابتشينو|كبتشينو|اسبريسو|لاتيه|موكا|شاي|شاهي|كاكاو')

def decide(p, cats, log):
    cat, sub = p['cat'], p.get('sub')
    if cat in ('print', 'roast', 'veg', 'bakery'): return cat, sub
    n = norm(p['name'] + ' ' + p.get('kw', ''))
    if not sub:
        for frm, to, r in SB.FIX:
            if cat == frm and r.search(n):
                log.append(('FIX', p['name'], cat, to)); cat = to; break
        rules = SB.S.get(cat)
        if rules and not (cat == 'misc'):
            sub = next((sid for sid, _, r in rules if r.search(n)), None)
        if not sub and cat in ('drinks', 'pantry') and COFFEE.search(n) and not re.search(r'مبيض|كريم|حليب|فلفل|بهار', n):
            if cat == 'drinks': sub = 'tea'
        if not sub:
            c, how = classify(p['name'] + ' ' + p.get('kw', ''))
            if c and not EXC.search(n):
                nc, ns = (c.split(':') + [None])[:2]
                if nc != cat and nc in SB.S:
                    rr = SB.S.get(nc)
                    ns2 = next((sid for sid, _, r in rr if r.search(n)), None) if rr and nc != 'misc' else None
                    log.append(('CLS', p['name'], cat, nc)); cat, sub = nc, ns2
                elif nc == cat and cat == 'misc' and ns: sub = ns
        # سبق وانطبقت قواعد الـsub على قسمه: لو انتقل القسم أعد التقييم
        if sub and cat != p['cat'] and not SB.S.get(cat): sub = None
    return cat, sub

def run(path, apply=False, report=None):
    d = json.load(open(path, encoding='utf-8'))
    before = {p['id']: (p.get('price'), p.get('old'), p.get('stock'), p.get('hidden'), p.get('packs'), p.get('unit'), p.get('name')) for p in d['products']}
    old_cats = {c['id']: c for c in d['cats']}
    log = []; moved = collections.Counter(); new_sub = collections.defaultdict(collections.Counter)
    for p in d['products']:
        cat, sub = decide(p, old_cats, log)
        if not sub:
            n = norm(p['name'] + ' ' + p.get('kw', ''))
            for frm, to, r in RES:
                if cat in frm and r.search(n): log.append(('RES', p['name'], cat, to)); cat = to; break
        nc = MAP.get((cat, sub), cat)
        n2 = norm(p['name'] + ' ' + p.get('kw', ''))
        for frm, to, r in FINAL:
            if nc == frm and r.search(n2): log.append(('FINAL', p['name'], nc, to)); nc, sub = to, None; break
        if nc != p['cat'] or sub != p.get('sub'): moved[(p['cat'], nc)] += 1
        p['cat'] = nc
        if sub: p['sub'] = sub
        else: p.pop('sub', None)
        new_sub[nc][sub] += 1
    # الأقسام
    sub_names = {}
    for c in d['cats']:
        for s in c.get('subs', []): sub_names.setdefault(s['id'], s['name'])
    for cid, rules in SB.S.items():
        for sid, nm, _ in rules: sub_names.setdefault(sid, nm)
    for k, v in SB.MISC_NAMES.items(): sub_names.setdefault(k, v)
    order = {}
    for k, v in SB.SHOW.items():
        for i, s in enumerate(v): order.setdefault(s, i)
    cats = []
    for cid, name, en, tint in NEW:
        c = dict(old_cats.get(cid, {})); c.update(id=cid, name=name, name_en=en)
        c.setdefault('tint', tint)
        if cid in old_cats: c['tint'] = old_cats[cid].get('tint', tint)
        if cid not in old_cats: c['tint'] = tint
        if cid in ('cheese', 'juice', 'tea', 'snacks', 'biscuits', 'icecream', 'grains') and cid != 'cheese': c.pop('img', None)
        if cid == 'cheese': c.pop('soon', None)
        subs = [s for s in new_sub.get(cid, {}) if s]
        subs.sort(key=lambda s: order.get(s, 50))
        if cid in ('bakery', 'veg', 'print', 'roast'): subs = [s['id'] for s in old_cats.get(cid, {}).get('subs', [])]
        if len(subs) > 1 or cid in ('bakery', 'veg'):
            c['subs'] = [{'id': s, 'name': sub_names.get(s, s)} for s in subs]
        else: c.pop('subs', None)
        cats.append(c)
    d['cats'] = cats
    # التحقق: ما تغيّر شي من الأسعار/المخزون
    for p in d['products']:
        b = before[p['id']]
        assert (p.get('price'), p.get('old'), p.get('stock'), p.get('hidden'), p.get('packs'), p.get('unit'), p.get('name')) == b, p['id']
    cc = collections.Counter(p['cat'] for p in d['products'])
    out = ['## الأقسام الجديدة (كل المنتجات)'] + [f"{c['name']} ({c['id']}): {cc[c['id']]}" for c in cats]
    out += ['', '## الانتقالات (من ← إلى): ' + str(sum(moved.values()))] + [f'{a} → {b}: {n}' for (a, b), n in sorted(moved.items(), key=lambda x: -x[1])]
    out += ['', '## نقل بالاسم (بدون sub) للمراجعة: ' + str(len(log))] + [f'{k} | {n} | {a} → {b}' for k, n, a, b in log]
    txt = '\n'.join(out)
    if report: open(report, 'w', encoding='utf-8').write(txt)
    else: print(txt)
    if apply:
        open(path, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
        print('انحفظ')

if __name__ == '__main__':
    rep = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--report=')), None)
    run(sys.argv[1], '--apply' in sys.argv, rep)
