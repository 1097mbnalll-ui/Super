"""تحديث المنتجات من «ملف التحديث اليومي للمخزون والأسعار» (Excel: رقم الصنف، اسم الصنف، الوحدة، الكمية المتوفرة، السعر).

الاستخدام:  python3 tools/daily/update.py data.json ملف.xlsx  [--dry]
- المنتج الموجود (بالباركود): «متوفر» = الكمية > 0، والسعر الأساسي من الملف (آخر ملف هو المعتمد). المنتج اللي عليه عرض
  (له old): سعر العرض يبقى و old = سعر الملف (الزبون يشوف «قبل» و«بعد» ونسبة الخصم). عروض الكمية (packs) ما تتغير.
- المنتج الجديد: ينضاف بقسمه حسب اسمه (classify.py)، واللي كميته صفر ينضاف «نفد».
- ما يلمس: الصور، الأقسام، الخيارات (packs)، الإعدادات. التكلفة والكميات بالعدد مكانها الخادم (D1) مو هالملف.
قرار المالك ١١ نوفمبر ٢٠٢٦: كل منتج بالملف ينضاف، واللي مخزونه صفر يطلع «نفد»، وتحديث يومي للمخزون والأسعار.
"""
import sys, json, re, hashlib, collections, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classify import classify, norm
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

def main(data_path, xlsx, dry=False):
    d = json.load(open(data_path))
    ps = d['products']
    by_bc = {p['bc']: p for p in ps if p.get('bc')}
    by_id = {p['id']: p for p in ps}
    names = {key(p['name']) for p in ps}
    by_name = {}
    for p in ps: by_name.setdefault(key(p['name']), p)
    rep = collections.Counter(); changed = []; seen = set(); qty_of = {}
    # الملف فيه أحياناً نفس الباركود (أو نفس الاسم) أكثر من سطر: المعتمد آخر سطر (قرار المالك)
    best = {}
    for row in read_rows(xlsx):
        code, name = row[0], row[1]
        k = code if re.fullmatch(r'\d{6,14}', code) else 'n:' + key(name)
        best.pop(k, None); best[k] = row
    for code, name, unit, qty, price in best.values():
        if SKIP.search(name) or price <= 0: rep['skip'] += 1; continue
        good = bool(re.fullmatch(r'\d{6,14}', code))
        p = by_bc.get(code) if good else None
        p = p or by_id.get('x' + code if good else 'xn' + hashlib.sha1(name.encode()).hexdigest()[:10])
        if not p and key(name) in by_name and not (good and by_name[key(name)].get('bc') and by_name[key(name)]['bc'] != code):
            p = by_name[key(name)]
        if p and p['id'] in seen: rep['repeat'] += 1; continue
        if p:
            seen.add(p['id']); qty_of[p['id']] = max(0, int(qty))
            avail = qty > 0
            if bool(p.get('stock')) != avail: p['stock'] = avail; rep['stock_' + ('on' if avail else 'off')] += 1
            # سعر الملف = السعر الأساسي. المنتج اللي عليه عرض (old): العرض يبقى، و«السعر قبل» يصير سعر الملف.
            # لو سعر الملف صار أقل من سعر العرض أو يساويه، العرض ما له معنى فينشال ويصير السعر سعر الملف.
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
        np = {'id': 'x' + code if good else 'xn' + hashlib.sha1(name.encode()).hexdigest()[:10], 'name': name,
              'unit': UNIT.get(unit, 'حبة'), 'price': price, 'cat': cat, 'stock': qty > 0}
        if good: np['bc'] = code
        if cat == 'misc' and sub: np['sub'] = sub
        qty_of[np['id']] = max(0, int(qty))
        ps.append(np); by_id[np['id']] = np; names.add(key(name)); rep['added'] += 1
        if good: by_bc[code] = np
    if not dry: json.dump(d, open(data_path, 'w'), ensure_ascii=False, separators=(',', ':'))
    # الكميات بالعدد للخادم (D1 جدول stock): python3 tools/daily/d1_stock.py الملف_هذا
    out = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--stock-out=')), None)
    if out: json.dump(qty_of, open(out, 'w'))
    print(dict(rep))
    for n, a, b in changed[:40]: print('  سعر:', n, a, '→', b)
    return rep

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], '--dry' in sys.argv)
