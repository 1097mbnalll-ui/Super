"""يكتب الكميات (stock-out من update.py) في جدول stock بالخادم عن طريق Cloudflare API.
الاستخدام: python3 tools/daily/d1_stock.py stock.json  (يحتاج توكن Cloudflare فيه صلاحية D1 Edit؛ بيئة Claude تحقنه تلقائياً)"""
import sys, json, time, urllib.request
ACC = '66ca4d319e2722cb7cb018f5352c21f6'
DB = '4e195d2f-6c9e-4bf5-a7aa-5c0848789036'
URL = f'https://api.cloudflare.com/client/v4/accounts/{ACC}/d1/database/{DB}/query'

def q(sql, params=None):
    body = json.dumps({'sql': sql, **({'params': params} if params else {})}).encode()
    req = urllib.request.Request(URL, data=body, method='POST', headers={'Content-Type': 'application/json', 'Authorization': 'Bearer x'})
    r = json.load(urllib.request.urlopen(req, timeout=60))
    if not r.get('success'): raise SystemExit(r)
    return r['result'][0]

stock = json.load(open(sys.argv[1]))
items = list(stock.items())
for i in range(0, len(items), 2500):
    part = dict(items[i:i + 2500])
    q("INSERT INTO stock (id, qty) SELECT key, value FROM json_each(?) WHERE true ON CONFLICT(id) DO UPDATE SET qty = excluded.qty", [json.dumps(part)])
q("INSERT INTO alog (at, who, act, ref, info) VALUES (?, ?, ?, ?, ?)",
  [int(time.time() * 1000), 'Claude (ملف التحديث اليومي)', 'bulk_import', 'stock', json.dumps({'n': len(items)}, ensure_ascii=False)])
print('stock rows written', len(items), q("SELECT COUNT(*) n, SUM(qty=0) zero FROM stock")['results'])
