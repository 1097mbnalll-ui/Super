"""أسماء المنتجات بأسلوب تطبيقات التوصيل (طلب المالك ١٤ نوفمبر ٢٠٢٦): يطبّق renames.json على data.json.
القاعدة في NAMING.md: العنوان = الماركة ثم نوع المنتج ثم النكهة/الوصف بدون الحجم، والحجم في «الوحدة» (السطر الرمادي تحت الاسم
في الموقع والتطبيق) لو كانت الوحدة «حبة» وما للمنتج خيارات بيع (packs). غير كذا الحجم يبقى آخر العنوان.

الاستخدام:  python3 tools/daily/apply_names.py data.json [--dry]
- يغيّر المنتج بس لو اسمه الحالي = _old_name (لو المالك عدّل الاسم من الإدارة، تعديله يفوز وينطبع «تخطّي»).
- لو الوحدة تغيّرت من بعد (مثلاً صارت كرتون) أو صار للمنتج خيارات بيع: الاسم الجديد ينحط والحجم آخره، والوحدة ما تتغير.
- يتكرر بأمان: المنتج اللي انطبق عليه قبل يعدّي («مطبّق»)."""
import sys, json, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))

def main(path, dry=False):
    ren = {k: v for k, v in json.load(open(os.path.join(HERE, 'renames.json'), encoding='utf-8')).items() if not k.startswith('_')}
    d = json.load(open(path, encoding='utf-8'))
    by = {p['id']: p for p in d['products']}
    rep = collections.Counter(); skipped = []
    for pid, e in ren.items():
        p = by.get(pid)
        if not p: rep['missing'] += 1; continue
        unit = p.get('unit') or ''
        new_unit = e.get('unit')
        if p['name'] != e['_old_name']:
            done = p['name'] == e['name'] or (new_unit and p['name'] == e['name'] + ' ' + new_unit)
            if done: rep['already'] += 1
            else: rep['skip_name_changed'] += 1; skipped.append((pid, p['name'], e['_old_name']))
            continue
        if new_unit is not None and (unit != (e.get('_old_unit') or '') or p.get('packs')):
            # الوحدة تغيّرت أو صار فيه خيارات: الحجم يرجع آخر العنوان
            p['name'] = e['name'] + ' ' + new_unit; rep['size_in_title'] += 1; continue
        p['name'] = e['name']
        if new_unit is not None: p['unit'] = new_unit
        rep['applied'] += 1
    # الماركة الصغيرة فوق الاسم (brands.json): بس لو الاسم الحالي يبدأ فيها
    try: brands = json.load(open(os.path.join(HERE, 'brands.json'), encoding='utf-8'))
    except Exception: brands = {}
    for pid, b in brands.items():
        p = by.get(pid)
        if p and not p.get('brand') and p['name'].startswith(b + ' '): p['brand'] = b; rep['brand'] += 1
    if not dry and (rep['applied'] or rep['size_in_title'] or rep['brand']):
        open(path, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
    print(dict(rep), '(تجربة بدون حفظ)' if dry else '')
    for pid, now, old in skipped[:40]: print('  تخطّي (الاسم تغيّر):', pid, '|', now, '| كان', old)
    return rep

if __name__ == '__main__':
    main(sys.argv[1], '--dry' in sys.argv)
