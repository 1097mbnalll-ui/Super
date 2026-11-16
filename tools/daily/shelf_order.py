"""ترتيب المنتجات في data.json مثل رف الموقع (shelfSort في index.html): المتوفر أول، ثم اللي عليه عرض، ثم المصوّر، وكل مجموعة بالأكثر طلباً (rk). قرار المالك ١٦ نوفمبر ٢٠٢٦.
تطبيق الآيفون يعرض منتجات القسم بترتيب الملف، فبهذا يصير ترتيبه نفس الموقع ويتغير مع كل تحديث للأهمية والعروض بدون تحديث للتطبيق.
الاستخدام: python3 tools/daily/shelf_order.py data.json   (شغّله بعد popularity.py وأي تحديث للعروض)"""
import sys, json, re
path = sys.argv[1]
d = json.load(open(path))
def offer(p):
    try:
        if p.get('old') is not None and float(p['old']) > float(p['price']): return True
    except (TypeError, ValueError): pass
    return any(re.match(r'^(عرض|حبتين)', str(k.get('u') or '')) for k in p.get('packs') or [])
def key(ip):
    i, p = ip
    return (0 if p.get('stock') else 1, 0 if offer(p) else 1, 0 if p.get('img') else 1, -float(p.get('rk') or 0), i)
before = [p['id'] for p in d['products']]
d['products'] = [p for _, p in sorted(enumerate(d['products']), key=key)]
moved = sum(1 for a, b in zip(before, (p['id'] for p in d['products'])) if a != b)
json.dump(d, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
print('رتّبت', len(before), 'منتج، تغيّر مكان', moved)
