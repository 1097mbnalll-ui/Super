"""قسم «الكراتين والشدّات» من الصفر (طلب المالك ١٥ نوفمبر ٢٠٢٦).

المصدر: ملف الكاشير «تسعيرة الأصناف» (كل الكراتين بالمحل) بعد parse_pdf.py → rows.json.
الفكرة: الكرتون/الشدّة ما هو منتج منفصل، هو «خيار بيع» داخل منتج الحبة (packs)، ورقم الكرتون بالكاشير = رقم الحبة.
ناخذ المهم بس: المشروبات الغازية والمويه والعصيرات والحليب الصغير ومشروبات الطاقة والمناديل اللي عليها طلب (rk).

الاستخدام:
  python3 tools/cartons/build.py data.json rows.json [--dry]
يكتب tools/cartons/cartons.json (الاختيار بدون أي تكلفة) ويطبّقه على data.json:
  - يشيل كل منتج منفصل وحدته كرتون/شدّة، ويشيل كل خيار كرتون/شدّة قديم
  - يحط خيار الكرتون الجديد في منتج الحبة
  - المنتجات المنفصلة المشالة تنحفظ في cartons.json (off) عشان ملف التحديث اليومي ما يرجعها
"""
import sys, json, re, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'cartons.json')
CARTON_RE = re.compile(r'^(كرتون|كرتونه|شدّة|شدة|شده)')
TARGET = {('drinks', 'soft'), ('drinks', 'water'), ('drinks', 'juice'), ('drinks', 'energy'),
          ('dairy', 'milk'), ('dairy', 'laban'), ('care', 'paper')}
MIN_RK = {'soft': 55, 'water': 70, 'juice': 65, 'energy': 33, 'milk': 85, 'laban': 50, 'paper': 47}
# المشروبات الغازية: الماركات الأساسية بس (بيبسي وأنواعه، كوكاكولا وأنواعها...)
SOFT_BRANDS = re.compile(r'بيبسي|ببسي|سفن ?[اآ]ب|ميرندا|ميراندا|ديو|كوكا|كةكا|سبرايت|فانتا|شاني|شويبس')
COMMON = [6, 12, 18, 24, 30, 36, 40, 48]   # الأعداد الغالبة بس

k = lambda s: str(s).lstrip('0')


def nz(s):
    s = re.sub('[أإآ]', 'ا', s).replace('ة', 'ه').replace('ى', 'ي')
    return s


def size_ml(text):
    """الحجم بالمل (أو الجرام) من الاسم أو الوحدة. None لو ما فيه"""
    t = nz(text)
    m = re.search(r'(\d+(?:\.\d+)?)\s*(مل|ملي|لتر|جم|كجم|ج)\b', t)
    if not m: return None
    v = float(m.group(1)); u = m.group(2)
    if u in ('لتر', 'كجم'): v *= 1000
    return v


def name_n(p):
    """العدد لو مكتوب بالاسم: «240 مل × 30» أو «*24»"""
    m = re.search(r'[×x\*]\s*(\d{1,2})\b', p['name'])
    return int(m.group(1)) if m and 4 <= int(m.group(1)) <= 60 else None


def std_n(p, ml):
    """العدد الغالب بالسوق السعودي حسب النوع والحجم (طلب المالك: «حط الغالب»)"""
    name = nz(p['name'])
    sub = p.get('sub')
    if ml is None: return None
    if sub == 'water' and re.search(r'غازي|صودا|سباركل', name): sub = 'soft'
    if sub == 'water':
        if 'زجاج' in name: return 24
        if ml <= 250: return 48
        if ml <= 350: return 40
        if ml <= 560: return 24
        if ml <= 650: return 30
        if 1400 <= ml <= 1600: return 12
        return None
    if sub in ('soft', 'energy'):
        if 'زجاج' in name: return 24
        if ml <= 260: return 30 if sub == 'soft' else 24
        if ml <= 500: return 24
        if 900 <= ml <= 1250: return 12
        if 1900 <= ml <= 2300: return 6
        return None
    # العصير والحليب واللبن (تتراباك)
    if ml <= 210: return 18
    if ml <= 360: return 24
    if ml <= 520: return 18
    if 900 <= ml <= 1100: return 12
    if 1300 <= ml <= 2000: return 6
    return None


def ratio_n(single, carton):
    """أقرب عدد غالب لنسبة سعر الكرتون لسعر الحبة (لو العدد المعتاد ما يركب على السعر)"""
    ratio = carton / single
    return min(COMMON, key=lambda n: abs(n - ratio))



# ---------- التسمية (tools/daily/NAMING.md): الماركة ← النوع ← الوصف، والحجم آخر العنوان لأن للمنتج خيار كرتون (القاعدة ٣) ----------
SIZE_RE = re.compile(r'(\d+(?:\.\d+)?)\s*(مل|ملي|لتر|جم|كجم|ج|منديل)(?=\s|$)')
FIX = [(r'ببسي', 'بيبسي'), (r'ميراندا', 'ميرندا'), (r'كةكا', 'كوكا'), (r'قزاز', 'زجاج'), (r'زير سكر', 'زيرو سكر'), (r'طاقه', 'طاقة'),
       (r'عصر مانجو', 'عصير مانجو'), (r'فواكة', 'فواكه'), (r'\bو\s+نعناع', 'ونعناع'), (r'سفن آب', 'سفن اب'), (r'بالفراوله', 'بالفراولة'),
       (r'الاجل', 'الأجل'), (r'الابل', 'الإبل')]
SOFT = ['ماونتن ديو', 'كوكا كولا', 'كوكاكولا', 'سفن اب', 'بيبسي', 'ميرندا', 'فانتا', 'سبرايت', 'شاني']
LEAD = [('عصير ', 'عصير'), ('حليب ', 'حليب'), ('مياه ', 'مياه شرب'), ('ماء ', 'مياه شرب'), ('مشروب غازي ', 'مشروب غازي'), ('مشروب طاقة ', 'مشروب طاقة')]


def title_of(p):
    name = p['name']; unit = str(p.get('unit') or '')
    for a, b in FIX: name = re.sub(a, b, name)
    sz = None
    m = list(SIZE_RE.finditer(name))
    if m: sz = m[-1].group(0); name = (name[:m[-1].start()] + name[m[-1].end():])
    elif SIZE_RE.fullmatch(unit.strip()): sz = unit.strip()
    if sz and p.get('cat') in ('drinks', 'dairy') and re.search(r'\d\s*(جم|ج)$', sz): sz = re.sub(r'(جم|ج)$', 'مل', sz)
    if not sz and p.get('cat') == 'drinks':
        mm = re.search(r'\s(\d{3,4})$', name)
        if mm: sz = mm.group(1) + ' مل'; name = name[:mm.start()]
    if sz: sz = re.sub(r'(\d)\s*(مل|ملي)$', r'\1 مل', re.sub(r'(\d)\s*لتر$', r'\1 لتر', sz))
    name = re.sub(r'\s+(حبة|حبه|جديد|عرض)(?=\s|$)', ' ', ' ' + name).strip()
    name = re.sub(r'\s+(كوكا|بيبسي|1)$', '', name) if not re.match(r'^(كوكا|بيبسي)', name) or name.endswith(' 1') else name
    name = re.sub(r'\s*[×x\*]\s*\d+\s*$', '', name).strip()
    # «عصير الربيع …» ← «الربيع عصير …»
    for lead, typ in LEAD:
        if name.startswith(lead) and len(name.split()) >= 2:
            rest = name[len(lead):].split()
            if rest and rest[0] not in ('غازي', 'شرب', 'طاقة'):
                name = rest[0] + ' ' + typ + (' ' + ' '.join(rest[1:]) if rest[1:] else ''); break
    if re.match(r'^ديو\b', name): name = 'ماونتن ' + name
    if p.get('sub') == 'soft' and 'مشروب' not in name and 'شراب' not in name:
        for b in SOFT:
            if name.startswith(b + ' ') or name == b:
                rest = name[len(b):].split(); var = []
                while rest and rest[0] in ('دايت', 'زيرو', 'ماكس', 'لايت', 'نايت', 'فري', 'افز'):
                    var.append(rest.pop(0))
                    if var[-1] == 'زيرو' and rest and rest[0] == 'سكر': var.append(rest.pop(0))
                name = ' '.join([b] + var + ['مشروب غازي'] + rest); break
    name = re.sub(r'\s+', ' ', name).strip()
    return (name + (' ' + sz if sz else '')).strip()


def label(n):
    if n <= 8: return f'شدّة {n} حبات'
    return f'كرتون {n} ' + ('حبات' if n <= 10 else 'حبة')


def main(data_path, rows_path, dry=False):
    d = json.load(open(data_path))
    rows = json.load(open(rows_path))
    exact = {k(r['code']): r for r in rows if r.get('code') and re.fullmatch(r'\d+', r['code'])}
    ps = d['products']
    singles = [p for p in ps if p['id'].startswith('x') and not CARTON_RE.match(str(p.get('unit', '')))]
    ids13 = collections.Counter(k(p['id'][1:])[:-1] for p in singles)
    pick = {}; why = collections.Counter(); skipped = []
    for p in singles:
        if (p.get('cat'), p.get('sub')) not in TARGET or p.get('stock') is False: continue
        if (p.get('rk') or 0) < MIN_RK.get(p.get('sub'), 99): why['low_demand'] += 1; continue
        if p.get('sub') == 'soft' and not (SOFT_BRANDS.search(p['name']) or p['id'].startswith('x12000')): why['minor_brand'] += 1; continue
        b = k(p['id'][1:]); r = exact.get(b)
        if not r and len(b) >= 12 and ids13[b[:-1]] == 1: r = exact.get(b[:-1])   # بعض أرقام الكاشير ناقصة آخر رقم
        if not r: why['no_carton'] += 1; continue
        sp = float(p.get('price') or 0); cp = float(r['price'])
        if sp <= 0 or cp <= sp * 1.5: why['bad_price'] += 1; continue
        ml = size_ml(p['name'] + ' ' + str(p.get('unit', '')))
        if p.get('sub') in ('milk', 'laban') and (ml is None or ml > 1100 or re.search(r'جم|بودر|مجفف|مركز|مبخر|مكثف|سائل|عصار', p['name'] + ' ' + str(p.get('unit', '')))):
            why['not_drink_milk'] += 1; continue
        if p.get('sub') == 'water' and ml and ml > 2000: why['gallon'] += 1; continue
        if p.get('sub') == 'paper' and re.search(r'رول', p['name']): why['rolls'] += 1; continue
        # العدد: المكتوب بالاسم، وإلا المعتاد بالسوق (المويه أرخص بكثير بالكرتون، والحبة أحياناً عليها عرض)، وإلا من السعر
        # حماية المحل: لو العدد يخلي الحبة بالكرتون أرخص بكثير من سعرها (أو أغلى بكثير) فالعدد غلط، ناخذ الأقرب للسعر
        n = name_n(p)
        lo = 0.28 if p.get('sub') == 'water' else 0.6
        if not n:
            n = std_n(p, ml)
            if n and not (lo * sp <= cp / n <= 1.3 * sp): n = None
        n = n or ratio_n(sp, cp)
        if not n or not (lo * sp <= cp / n <= 1.3 * sp): why['count_unsure'] += 1; skipped.append((p['name'], sp, cp)); continue
        pick[p['id']] = {'code': r['code'], 'n': n, 'u': label(n), 'price': round(cp, 2)}
        why['picked'] += 1
    # المنتجات المنفصلة القديمة (وحدتها كرتون/شدّة) تنشال، والخيارات القديمة تنشال
    prev = json.load(open(OUT)) if os.path.exists(OUT) else {}
    off = sorted(set(prev.get('off', [])) | {p['id'] for p in ps if CARTON_RE.match(str(p.get('unit', '')))})
    old_map = json.load(open(os.path.join(os.path.dirname(HERE), 'daily', 'packs_map.json')))
    off_codes = sorted(c for c in old_map if c != '_')
    out = {'_': 'قسم الكراتين والشدّات (المالك ١٥ نوفمبر ٢٠٢٦): picks = خيار الكرتون داخل منتج الحبة (code = رقم الصنف بالكاشير). '
                'off = منتجات كرتون منفصلة قديمة انشالت، off_codes = شدّات قديمة (packs_map) انشالت. update.py ما يرجعها.',
           'picks': pick, 'off': off, 'off_codes': off_codes}
    newps = []; renamed = []
    for p in ps:
        if p['id'] in set(off): continue
        if p.get('packs'):
            p['packs'] = [x for x in p['packs'] if not CARTON_RE.match(str(x.get('u', '')))]
            if not p['packs']: p.pop('packs')
        if p['id'] in pick:
            c = pick[p['id']]
            p.setdefault('packs', []).append({'u': c['u'], 'n': c['n'], 'price': c['price']})
            t = title_of(p)
            if t != p['name'] or p.get('unit') != 'حبة':
                renamed.append((p['id'], p['name'], p.get('unit'), t))
                p['name'] = t; p['unit'] = 'حبة'
        newps.append(p)
    d['products'] = newps
    print(dict(why), 'removed standalone', len(off), 'renamed', len(renamed))
    for x in renamed: print('  اسم:', x[1], '|', x[2], '←', x[3])
    for x in skipped[:40]: print('  ما تأكدت من العدد:', x)
    if not dry:
        json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
        # نفس طريقة التسمية: نسجّل الأسماء في renames.json (الحجم آخر العنوان والوحدة «حبة» لأن له كرتون)
        rp = os.path.join(os.path.dirname(HERE), 'daily', 'renames.json')
        ren = json.load(open(rp, encoding='utf-8'))
        for pid, old, oldu, t in renamed:
            m = SIZE_RE.search(t.split()[-1] + '') if False else None
            ren[pid] = {'name': t, '_old_name': old, '_old_unit': oldu}
        json.dump(ren, open(rp, 'w'), ensure_ascii=False, indent=0)
        json.dump(d, open(data_path, 'w'), ensure_ascii=False, separators=(',', ':'))
    return pick


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], '--dry' in sys.argv)
