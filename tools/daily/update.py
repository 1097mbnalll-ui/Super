"""تحديث المنتجات من «ملف التحديث اليومي للمخزون والأسعار» (Excel: رقم الصنف، اسم الصنف، الوحدة، الكمية المتوفرة، السعر).

الاستخدام:  python3 tools/daily/update.py data.json ملف.xlsx  [--dry]
- المنتج الموجود (بالباركود): «متوفر» = الكمية > 0، والسعر الأساسي من الملف (آخر ملف هو المعتمد). المنتج اللي عليه عرض
  (له old): سعر العرض يبقى و old = سعر الملف (الزبون يشوف «قبل» و«بعد» ونسبة الخصم). عروض الكمية (packs) ما تتغير.
- المنتج الجديد: ينضاف بقسمه حسب اسمه (classify.py)، واللي كميته صفر ينضاف «نفد».
- ما يلمس: الصور، الأقسام، الخيارات (packs)، الإعدادات. التكلفة والكميات بالعدد مكانها الخادم (D1) مو هالملف.
قرار المالك ١١ نوفمبر ٢٠٢٦: كل منتج بالملف ينضاف، واللي مخزونه صفر يطلع «نفد»، وتحديث يومي للمخزون والأسعار.
- الشدّات والكراتين اللي في packs_map.json (قرار المالك ١٢ نوفمبر) ما تنضاف منتج منفصل: سعرها يصير سعر خيارها داخل منتج
  الحبة، وكميتها × عدد حباتها تنضاف لمخزون الحبة (المخزون بالحبات)، والمنتج المنفصل القديم ينشال.
"""
import sys, json, re, hashlib, collections, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classify import classify, norm
from names import clean
import openpyxl

UNIT = {'حبه': 'حبة', 'حبة': 'حبة', 'شده': 'شدّة', 'شدة': 'شدّة', 'علبه': 'علبة', 'علبة': 'علبة', 'ربطه': 'ربطة', 'ربطة': 'ربطة',
        'كيس': 'كيس', 'كرتون': 'كرتون', 'باكت': 'باكت', 'طبق': 'طبق', 'درزن': 'درزن', 'كيلو': 'كيلو'}
SKIP = re.compile(r'صنف ضريبي|^مخبز$|^منزلية$|ايجار|كرت نظافة')

def key(name): return re.sub(r'\s', '', norm(name))

def code_of(v):
    if isinstance(v, float) and v.is_integer(): return str(int(v))
    return str(v).strip().strip('*')

def read_rows(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    head = None
    for r in ws.iter_rows(values_only=True):
        if head is None:
            if r and any(str(c or '').strip() == 'اسم الصنف' for c in r):
                head = {str(c).strip(): i for i, c in enumerate(r) if c}
            continue
        if not r or not r[head['اسم الصنف']]: continue
        g = lambda k: r[head[k]] if k in head and head[k] < len(r) else None
        price = g('السعر') if g('السعر') is not None else g('سعر البيع')
        try: price = float(price)
        except (TypeError, ValueError): price = 0
        try: qty = float(g('الكمية المتوفرة') or 0)
        except (TypeError, ValueError): qty = 0
        yield code_of(g('رقم الصنف')), re.sub(r'\s+', ' ', str(g('اسم الصنف'))).strip(), str(g('الوحدة') or '').strip(), qty, round(price, 2)

PACKS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'packs_map.json')
HIDDEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hidden.json')
# المنتجات المكررة اللي اندمجت (merged.json): باركود المكرر ← معرّف المنتج الباقي. كميتها تنضاف للباقي وما ترجع منتج منفصل
MERGED = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'merged.json')
# عروض الرف من المالك (السعر العادي والعرض)، ما يغيّرها ملف الكاشير
_sp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shelf_offers.json')
KEEP_OFFERS = '--keep-offers' in sys.argv
_cp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'consumables.json')
_cj = json.load(open(_cp, encoding='utf-8')) if os.path.exists(_cp) else {}
CONSUM = set(_cj.get('cats', [])); CONSUM_SUB = set(_cj.get('subs', [])); CONSUM_IDS = set(_cj.get('ids', []))
SHELF = {k: v for k, v in json.load(open(_sp, encoding='utf-8')).items() if not k.startswith('_')} if os.path.exists(_sp) else {}

def main(data_path, xlsx, dry=False):
    d = json.load(open(data_path))
    global KEEP_ON
    KEEP_ON = {p['id'] for p in d['products'] if p.get('stock')}
    pmap = {k: v for k, v in json.load(open(PACKS)).items() if k != '_'} if os.path.exists(PACKS) else {}
    hidden = {x['bc'] for x in json.load(open(HIDDEN)).get('items', [])} if os.path.exists(HIDDEN) else set()
    merged = {k: v for k, v in json.load(open(MERGED)).items() if k != '_'} if os.path.exists(MERGED) else {}
    gone = {'x' + k for k in pmap} | {'x' + b for b in hidden} | {k if k.startswith('x') else 'x' + k for k in merged}
    if any(p['id'] in gone for p in d['products']):
        d['products'] = [p for p in d['products'] if p['id'] not in gone]
    ps = d['products']
    by_bc = {p['bc']: p for p in ps if p.get('bc')}
    by_id = {p['id']: p for p in ps}
    names = {key(p['name']) for p in ps}
    by_name = {}
    for p in ps: by_name.setdefault(key(p['name']), p)
    rep = collections.Counter(); changed = []; kept_diff = []; seen = set(); qty_of = {}; pack_rows = {}; alias_rows = []
    # الملف فيه أحياناً نفس الباركود (أو نفس الاسم) أكثر من سطر: المعتمد آخر سطر (قرار المالك)
    best = {}
    for row in read_rows(xlsx):
        code, name = row[0], row[1]
        k = code if re.fullmatch(r'\d{6,14}', code) else 'n:' + key(name)
        best.pop(k, None); best[k] = row
    for code, name, unit, qty, price in best.values():
        if SKIP.search(name) or price <= 0: rep['skip'] += 1; continue
        if code in hidden: rep['hidden'] += 1; continue
        if code in pmap: pack_rows[code] = (qty, price); continue
        good = bool(re.fullmatch(r'\d{6,14}', code))
        _aid = code if good else 'xn' + hashlib.sha1(name.encode()).hexdigest()[:10]
        if _aid in merged: alias_rows.append((merged[_aid], qty, price)); rep['merged_alias'] += 1; continue
        name = clean(name)
        p = by_bc.get(code) if good else None
        p = p or by_id.get('x' + code if good else _aid)   # معرّف المنتج بدون باركود من الاسم الأصلي بالملف (قبل التنظيف)
        if not p and key(name) in by_name and not (good and by_name[key(name)].get('bc') and by_name[key(name)]['bc'] != code):
            p = by_name[key(name)]
        if p and p['id'] in seen: rep['repeat'] += 1; continue
        if p:
            seen.add(p['id']); qty_of[p['id']] = max(0, int(qty))
            # الكرتون والشدّة من عمود «الوحدة» (قرار المالك ١٢ نوفمبر): الوحدة تتبع الملف، فيطلع المنتج في قسم «الكراتين والشدّات»
            if UNIT.get(unit) in ('كرتون', 'شدّة') and p.get('unit') != UNIT[unit]: p['unit'] = UNIT[unit]; rep['unit'] += 1
            avail = qty > 0
            # الاستهلاكي (consumables.json): الملف ما يصفّره. صفر بالملف = يبقى متوفر وبدون عدد في الخادم (None = يمسح سطره من جدول stock)
            if p.get('cat') in CONSUM or p.get('sub') in CONSUM_SUB or p['id'] in CONSUM_IDS:
                # «لا توقفه أبداً»: بدون عدد في الخادم دايماً (ما يوقف لو خلصت الكمية بالطلبات)، والملف يشغّله بس
                qty_of[p['id']] = None; rep['consumable_kept'] += 1
                if avail and not p.get('stock'): p['stock'] = True; rep['stock_on'] += 1
                elif not avail and not p.get('stock') and p['id'] in KEEP_ON: p['stock'] = True
            elif bool(p.get('stock')) != avail: p['stock'] = avail; rep['stock_' + ('on' if avail else 'off')] += 1
            # سعر الملف = السعر الأساسي. المنتج اللي عليه عرض (old): العرض يبقى، و«السعر قبل» يصير سعر الملف.
            # لو سعر الملف صار أقل من سعر العرض أو يساويه، العرض ما له معنى فينشال ويصير السعر سعر الملف.
            if p['id'] in SHELF:  # عرض رف من المالك: السعر العادي والعرض ثابتين لين ينحذف من shelf_offers.json
                v = SHELF[p['id']]; p['price'] = v['price']
                if v.get('old') is not None: p['old'] = v['old']
                else: p.pop('old', None)
                if 'packs' in v: p['packs'] = v['packs']
                continue
            # --keep-offers (طلب المالك ١٣ نوفمبر ٢٠٢٦ «لا تلمس أسعار العروض»): أي منتج عليه خصم (old) أو عرض كمية: ما نلمس سعره ولا «السعر قبل» ولا خيارات العرض، والمخزون بس يتحدث
            if KEEP_OFFERS and (p.get('old') is not None or any(re.match(r'^(عرض|حبتين)', str(k.get('u') or '')) for k in p.get('packs', []))):
                rep['offer_kept'] += 1
                if abs(price - float(p['price'])) >= 0.01: kept_diff.append((p['name'], p['price'], p.get('old'), price))
                continue
            if p.get('old') is not None:
                if price > float(p['price']) + 0.009:
                    if abs(float(p['old']) - price) >= 0.01: p['old'] = price; rep['offer_before'] += 1
                    continue
                p.pop('old', None); rep['offer_ended'] += 1
            if abs(price - float(p['price'])) >= 0.01:
                changed.append((p['name'], p['price'], price)); p['price'] = price; rep['price'] += 1
            continue
        if key(name) in names: rep['same_name_other_code'] += 1; continue
        c, _ = classify(name)
        cat, sub = (c.split(':') + [None])[:2] if c else (None, None)
        if not cat:
            n = norm(name)
            cat = 'drinks' if re.search(r'\d\s?(مل|لتر)', n) else 'sweets' if re.search(r'\d\s?(جم|ج|جرام|غ)(?=\s)', n) else 'misc'
        np = {'id': 'x' + code if good else _aid, 'name': name,
              'unit': UNIT.get(unit, 'حبة'), 'price': price, 'cat': cat, 'stock': qty > 0}
        if good: np['bc'] = code
        if cat == 'misc' and sub: np['sub'] = sub
        qty_of[np['id']] = max(0, int(qty))
        ps.append(np); by_id[np['id']] = np; names.add(key(name)); rep['added'] += 1
        if good: by_bc[code] = np
    # المكرر المدموج: كميته تنضاف للمنتج الباقي (والمتوفر لو أي واحد متوفر)، وسعره بس لو الباقي ما جاء بالملف
    for target, qty, price in alias_rows:
        b = by_id.get(target)
        if not b: rep['merged_no_target'] += 1; continue
        if b['id'] not in seen and b['id'] not in qty_of and price > 0 and b.get('old') is None and b['id'] not in SHELF and abs(price - float(b['price'])) >= 0.01:
            changed.append((b['name'], b['price'], price)); b['price'] = price; rep['price'] += 1
        if b['id'] in qty_of and qty_of[b['id']] is None:
            if qty > 0 and not b.get('stock'): b['stock'] = True; rep['stock_on'] += 1
            continue
        qty_of[b['id']] = qty_of.get(b['id'], 0) + max(0, int(qty))
        avail = qty_of[b['id']] > 0
        if bool(b.get('stock')) != avail: b['stock'] = avail; rep['stock_' + ('on' if avail else 'off')] += 1
    # الشدّة/الكرتون: سعر الخيار من الملف، والكمية بالحبات تنضاف للحبة
    for code, (qty, price) in pack_rows.items():
        m = pmap[code]; b = by_id.get(m['base'])
        if not b: rep['pack_no_base'] += 1; continue
        pk = b.setdefault('packs', [])
        o = next((x for x in pk if int(x.get('n') or 0) == int(m['n'])), None)
        if not o: o = {'u': m['u'], 'n': int(m['n']), 'price': price}; pk.append(o); rep['pack_added'] += 1
        elif abs(float(o.get('price') or 0) - price) >= 0.01: changed.append((b['name'] + ' · ' + o['u'], o['price'], price)); o['price'] = price; rep['pack_price'] += 1
        if b['id'] in qty_of and qty_of[b['id']] is None:  # استهلاكي: بدون عدد، والكرتون يشغّله بس
            if qty > 0 and not b.get('stock'): b['stock'] = True; rep['stock_on'] += 1
            rep['pack_rows'] += 1; continue
        qty_of[b['id']] = qty_of.get(b['id'], 0) + max(0, int(qty)) * int(m['n'])
        avail = qty_of[b['id']] > 0
        if bool(b.get('stock')) != avail: b['stock'] = avail; rep['stock_' + ('on' if avail else 'off')] += 1
        rep['pack_rows'] += 1
    if not dry: json.dump(d, open(data_path, 'w'), ensure_ascii=False, separators=(',', ':'))
    # الكميات بالعدد للخادم (D1 جدول stock): python3 tools/daily/d1_stock.py الملف_هذا
    out = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--stock-out=')), None)
    if out: json.dump(qty_of, open(out, 'w'))
    print(dict(rep))
    for n, a, b in changed[:40]: print('  سعر:', n, a, '→', b)
    for n, a, o, b in kept_diff[:60]: print('  عرض ما انلمس:', n, 'سعره', a, '(قبل', o, ') والملف', b)
    return rep

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], '--dry' in sys.argv)
