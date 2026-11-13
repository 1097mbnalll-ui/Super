"""مراجعة «التحديث اليومي» الشاملة (قرار المالك ١٣ نوفمبر ٢٠٢٦): تقرير بالعربي عن حالة data.json.
الاستخدام: python3 tools/daily/review.py data.json
ما يغيّر شي، يقرأ بس. الأرقام تنعرض للمالك، وأي تعديل يحتاج موافقته و«نزّله»."""
import sys, json, os, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'data.json', encoding='utf-8'))
S, P, C = d['store'], d['products'], {c['id']: c for c in d['cats']}
shelf = {k: v for k, v in json.load(open(os.path.join(HERE, 'shelf_offers.json'), encoding='utf-8')).items() if not k.startswith('_')} if os.path.exists(os.path.join(HERE, 'shelf_offers.json')) else {}
hidden = json.load(open(os.path.join(HERE, 'hidden.json'), encoding='utf-8')) if os.path.exists(os.path.join(HERE, 'hidden.json')) else []
hidden_ids = {str(h.get('bc') or h.get('id')) for h in (hidden.get('items', []) if isinstance(hidden, dict) else hidden) if isinstance(h, dict)}
by = {p['id']: p for p in P}
out, warn = [], []
say = out.append

# ١) المتجر
say('## المتجر')
say(f"- مقفل يدوي: {'نعم ⚠️' if S.get('closed') else 'لا'}")
o, c = S.get('openAt') or '', S.get('closeAt') or ''
say(f"- مواعيد الاستقبال: {o or '—'} → {c or '—'} ({S.get('hours', '')})")
if o and c:
    hm = lambda x: int(x.split(':')[0]) * 60 + int(x.split(':')[1])
    span = (hm(c) - hm(o)) % 1440
    if span < 6 * 60: warn.append(f'المواعيد قصيرة ({span // 60} ساعة و{span % 60} دقيقة): تأكد إنها مقصودة')
say(f"- الرسوم {S.get('fee')} · مجاني فوق {S.get('freeOver')} · أقل طلب {S.get('minOrder')} · منطقة مرسومة: {'نعم' if S.get('zone') else 'لا'}")

# ٢) المنتجات
avail = [p for p in P if p.get('stock')]
say('## المنتجات')
say(f'- الكل {len(P)} · المتوفر {len(avail)} · النافد {len(P) - len(avail)}')
noimg = [p for p in avail if not p.get('img')]
say(f'- متوفر بدون صورة: {len(noimg)}')
misc = sum(1 for p in avail if p.get('cat') == 'misc')
say(f"- قسم «المنزل والمنوعات»: {misc} ({round(misc * 100 / max(1, len(avail)))}٪ من المتوفر، الحد ١٠٪)")
if misc > len(avail) * 0.1: warn.append('قسم المنوعات فوق ١٠٪: يحتاج تصنيف')
badcat = [p for p in P if p.get('cat') not in C]
if badcat: warn.append(f'{len(badcat)} منتج قسمه مو موجود')
zero = [p for p in avail if not (float(p.get('price') or 0) > 0)]
if zero: warn.append(f'{len(zero)} منتج متوفر بدون سعر: ' + '، '.join(p['name'] for p in zero[:5]))
back = [p for p in P if p['id'] in hidden_ids or p['id'].lstrip('x') in hidden_ids]
if back: warn.append(f'{len(back)} منتج مخفي (كحول/تدخين) رجع للموقع: ' + '، '.join(p['name'] for p in back[:5]))
cart_unit = [p for p in avail if re.match(r'^(كرتون|شد)', str(p.get('unit') or '')) and float(p.get('price') or 0) < 5]
if cart_unit: warn.append(f'{len(cart_unit)} منتج وحدته كرتون/شدّة وسعره أقل من ٥ (غالباً سعر حبة): ' + '، '.join(p['name'] for p in cart_unit[:5]))

# ٣) العروض
say('## العروض')
sale = [p for p in P if p.get('old') and float(p['old']) > float(p['price'])]
packs = [(p, k) for p in P for k in p.get('packs', []) if ('عرض' in k['u'] or 'حبتين' in k['u']) and k['price'] < k['n'] * p['price']]
say(f'- خصومات («كان/صار»): {len(sale)} · منها عروض رف {sum(1 for p in sale if p["id"] in shelf)} · عروض كمية: {len(packs)}')
not95 = [p for p in sale if float(p['price']) == int(float(p['price']))] + [p for p, k in packs if float(k['price']) == int(float(k['price']))]
if not95: warn.append(f'{len(not95)} عرض سعره رقم صحيح (القاعدة: ينقص ٥ هللات): ' + '، '.join(p['name'] for p in not95[:6]))
for pid, v in shelf.items():
    p = by.get(pid)
    if not p: warn.append(f'عرض رف لمنتج مو موجود: {pid}'); continue
    if abs(float(p['price']) - v['price']) > 0.001 or abs(float(p.get('old') or 0) - v['old']) > 0.001:
        warn.append(f"عرض الرف تغيّر: {p['name']} ({p.get('old')}/{p['price']} بدل {v['old']}/{v['price']})")
    if not p.get('stock'): warn.append(f"عرض رف ومنتجه نافد: {p['name']}")
big = [p for p in sale if (float(p['old']) - float(p['price'])) / float(p['old']) > 0.5]
if big: warn.append(f'{len(big)} خصم فوق ٥٠٪ (تأكد إنه صحيح): ' + '، '.join(f"{p['name']} {p['old']}→{p['price']}" for p in big[:5]))

print('\n'.join(out))
print('## تنبيهات' + ('' if warn else '\n- ما فيه تنبيهات ✓'))
for w in warn: print('- ⚠️ ' + w)
