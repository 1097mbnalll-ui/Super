"""ترتيب «الرف الذهبي» (طلب المالك ١٣ نوفمبر ٢٠٢٦): لكل منتج رقم أهمية `rk` (١–٩٩٩) يرتّب المنتجات داخل القسم.
الأهمية = المبيعات الحقيقية (آخر ٦٠ يوم) + الإضافات للسلة + المشاهدات (من D1) + «أساسيات البقالة» والماركات المعروفة
(لين تكثر الطلبات، الأساسيات هي اللي ترفع: حليب، بيض، ماء، خبز، بيبسي، شيبس...). المنتجات بدون أهمية ما ينحط لها رقم.
الاستخدام: python3 tools/daily/popularity.py data.json [--no-db]   (يقرأ D1 عبر Cloudflare API، قراءة بس)"""
import json, re, sys, math, urllib.request
from classify import norm

URL = 'https://api.cloudflare.com/client/v4/accounts/66ca4d319e2722cb7cb018f5352c21f6/d1/database/4e195d2f-6c9e-4bf5-a7aa-5c0848789036/query'
def q(sql):
    r = urllib.request.Request(URL, data=json.dumps({'sql': sql}).encode(), method='POST', headers={'Content-Type': 'application/json', 'Authorization': 'Bearer x'})
    return json.load(urllib.request.urlopen(r, timeout=60))['result'][0]['results']

# أساسيات: القسم الفرعي (من subs.py) → وزن
SUB_W = {'milk': 60, 'eggs': 70, 'laban': 50, 'water': 70, 'soft': 55, 'juice': 40, 'chips': 50, 'chocolate': 40, 'biscuits': 35,
         'rice': 45, 'oil': 40, 'flour': 40, 'canned': 30, 'pasta': 30, 'sauces': 20, 'tea': 40, 'cheese': 40, 'cream': 30,
         'chicken': 55, 'icecream': 25, 'candy': 20, 'gum': 15, 'paper': 40, 'laundry': 35, 'dishes': 30, 'bags': 25,
         'baby': 30, 'hair': 20, 'oral': 20, 'breakfast': 25, 'sugar': 25, 'spices': 15, 'energy': 25, 'icedtea': 20}
# ماركات يعرفها الكل
BRAND = re.compile(r'المراعي|نادك|السعوديه|الصافي|بيبسي|ببسي|كوكا|سفن اب|ميرندا|ليز|بطاطس عمان|نوفا|بيرين|اروى|العين|صحتك|نقي|الربيع|'
                   r'جالكسي|كيت كات|سنيكرز|اوريو|ديمه|ابو ولد|اندومي|قودي|ابو كاس|الشعلان|عافيه|نستله|نيدو|تايد|فاين|كلينكس|ديتول|الوطنيه|ساديا|دو!|امريكانا|كيري|بوك')
SMALL = re.compile(r'(?<!\d)(125|150|180|200|240|250|320|330|340)\s?(مل|ملي)|حبه!')

def run(path, use_db=True):
    d = json.load(open(path, encoding='utf-8'))
    sold, carts, views = {}, {}, {}
    if use_db:
        for r in q("SELECT l.id id, SUM(l.qty) q FROM oline l JOIN orders o ON o.no = l.no WHERE o.status != 'canceled' AND o.created > (strftime('%s','now') - 60*86400) * 1000 GROUP BY l.id"):
            sold[str(r['id']).split('~')[0]] = r['q']
        for r in q("SELECT id, SUM(views) v, SUM(carts) c FROM st_view WHERE day >= date('now', '-60 day') GROUP BY id"):
            views[r['id']] = r['v'] or 0; carts[r['id']] = r['c'] or 0
    n = 0
    for p in d['products']:
        nm = norm(p['name'])
        s = SUB_W.get(p.get('sub'), 0) + (25 if BRAND.search(nm) else 0) + (8 if SMALL.search(nm) else 0)
        s += 12 * math.log1p(sold.get(p['id'], 0)) * 10 + 6 * math.log1p(carts.get(p['id'], 0)) * 5 + 2 * math.log1p(views.get(p['id'], 0)) * 5
        rk = min(999, round(s))
        if rk > 0: p['rk'] = rk; n += 1
        else: p.pop('rk', None)
    open(path, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
    print('منتجات لها أهمية:', n, '· مبيعات:', len(sold), '· سلة/مشاهدة:', len(views))

if __name__ == '__main__':
    run(sys.argv[1], '--no-db' not in sys.argv)
