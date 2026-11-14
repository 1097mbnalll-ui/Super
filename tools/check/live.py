"""فحوص الإنتاج من Cloudflare (قراءة بس): الخادم المنشور = اللي في المستودع؟ وقراءات D1 لآخر ٢٤ ساعة."""
import json, sys, hashlib, urllib.request, datetime, re, os
A = '66ca4d319e2722cb7cb018f5352c21f6'
def req(url, body=None):
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body else None, headers={'Authorization': 'Bearer x', 'Content-Type': 'application/json'})
    return urllib.request.urlopen(r, timeout=60).read()
try:
    raw = req(f'https://api.cloudflare.com/client/v4/accounts/{A}/workers/scripts/ohod-admin/content/v2').decode('utf-8', 'replace')
    m = re.search(r'export default \{', raw)
    local = open('server/worker.js', encoding='utf-8').read()
    same = local.strip() in raw or hashlib.sha256(local.encode()).hexdigest() == hashlib.sha256(raw.encode()).hexdigest()
    print(('✅ الخادم المنشور في Cloudflare نفس اللي في المستودع') if same else '⚠️ الخادم المنشور في Cloudflare مختلف عن المستودع (ينتظر «نزّله» أو انعدل يدوي)')
except Exception as e:
    print('⚠️ ما قدرت أقارن الخادم المنشور:', str(e)[:80])
try:
    now = datetime.datetime.now(datetime.timezone.utc); s = (now - datetime.timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%SZ'); e = now.strftime('%Y-%m-%dT%H:%M:%SZ')
    q = '''query($a:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){
      d1QueriesAdaptiveGroups(limit:3,filter:{datetime_geq:$s,datetime_leq:$e},orderBy:[sum_rowsRead_DESC]){sum{rowsRead} count dimensions{query}}
      workersInvocationsAdaptive(limit:10,filter:{datetime_geq:$s,datetime_leq:$e,scriptName:"ohod-admin"}){sum{requests errors} dimensions{status}}}}}'''
    d = json.loads(req('https://api.cloudflare.com/client/v4/graphql', {'query': q, 'variables': {'a': A, 's': s, 'e': e}}))['data']['viewer']['accounts'][0]
    rows = sum(g['sum']['rowsRead'] for g in d['d1QueriesAdaptiveGroups'])
    top = d['d1QueriesAdaptiveGroups'][0] if d['d1QueriesAdaptiveGroups'] else None
    print(f"{'✅' if rows < 3_000_000 else '⚠️'} قراءات قاعدة البيانات آخر ٢٤ ساعة (أعلى ٣ استعلامات): {rows:,} صف" + (f" · الأعلى: {top['dimensions']['query'][:60]}" if top else ''))
    inv = d['workersInvocationsAdaptive']; req_n = sum(x['sum']['requests'] for x in inv); err = sum(x['sum']['requests'] for x in inv if x['dimensions']['status'] not in ('success', 'clientDisconnected'))
    print(f"{'✅' if err == 0 else '⚠️'} طلبات الخادم آخر ٢٤ ساعة: {req_n:,} · أخطاء: {err}")
except Exception as e:
    print('⚠️ ما قدرت أقرأ إحصائيات Cloudflare:', str(e)[:80])
