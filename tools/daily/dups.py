# فحص المكرر: نفس الحجم ونفس كلمات الاسم (بعد التطبيع) بباركودات مختلفة. الاستخدام: python3 tools/daily/dups.py ملف-الكاشير.xlsx out.json
# شغّله بعد كل تحديث يومي. الدمج: الباقي = اللي في ملف الكاشير الأخير وسعره الأعلى، والمكرر يروح merged.json (المالك ٢١ نوفمبر ٢٠٢٦).
import json,sys,re,collections
sys.path.insert(0,'tools/daily'); import update
X={}
for code,name,unit,qty,price in update.read_rows(sys.argv[1]): X['x'+str(code)]=(name,price,qty)
d=json.load(open('data.json'))
AR=str.maketrans('أإآةىؤئ','اااهيوي')
SYN={'جبنه':'جبن','شوكولاته':'شوكولا','شوكولاتة':'شوكولا','شكولاته':'شوكولا','شوكلاته':'شوكولا','شيكولاته':'شوكولا','فانيلا':'فانيليا','كافيه':'كافي','كافية':'كافي','كافيه':'كافي','لاتيه':'لاتي','لاتية':'لاتي','موزريلا':'موزاريلا','وجة':'وجه','عرق':'عرق'}
NEU={'عادي','كامل','كامله','الدسم','دسم','اصلي','طبيعي','طبيعيه','جديد','حبه','جم','ج','غ','مل','ملل','لتر','ل','كجم','كيلو','ك','جرام','السعوديه','اي','اف','شكل','عرض','خاص','حجم','و'}
def toks(s):
  s=s.translate(AR).lower(); s=re.sub(r'(\d)([^\d\s.])',r'\1 \2',s); s=re.sub(r'([^\d\s.])(\d)',r'\1 \2',s)
  out=[]
  for t in re.split(r'[\s\-\(\)/×x*،,+.]+',s):
    if not t: continue
    if t.startswith('ال') and len(t)>4: t=t[2:]
    t=SYN.get(t,t); out.append(t)
  return out
UNITS='جم|ج|غ|مل|ملل|لتر|ل|كجم|كيلو|ك|جرام|حبه|منديل|قطعه|شريحه|جالون'
def size(p):
  t=' '.join(toks(p['name']+' '+str(p.get('unit',''))))
  return tuple(sorted(set(re.findall(r'(\d+(?:\.\d+)?) (%s)\b'%UNITS,t))))
def core(p):
  t=toks(p['name']+' '+str(p.get('unit','')))
  # الأرقام اللي مو حجم (رقم 11، 3*1، ×6) تدخل
  nums=set(re.findall(r'\d+(?:\.\d+)?',' '.join(t)))-{a for a,b in size(p)}
  return frozenset([x for x in t if not re.match(r'^\d',x) and x not in NEU and len(x)>1]+['#'+n for n in nums])
def packish(p): u=str(p.get('unit',''))+p['name']; return bool(re.search(r'×|علبه|علبة|ربطة|ربطه|شد|كرتون|\*',u)) or bool(p.get('packs'))
ps=[p for p in d['products'] if not p.get('soon') and p.get('price')]
by=collections.defaultdict(list)
for p in ps:
  s=size(p)
  if s: by[s].append(p)
groups=[]; seen=set()
for s,L in by.items():
  ck=collections.defaultdict(list)
  for p in L: ck[(core(p),packish(p))].append(p)
  for k,G in ck.items():
    if len(G)>1: groups.append(G)
print('groups',len(groups),'diffprice',sum(1 for G in groups if len({p['price'] for p in G})>1))
out=[[{'id':p['id'],'name':p['name'],'unit':p.get('unit',''),'price':p['price'],'old':p.get('old'),'img':bool(p.get('img')),'stock':p.get('stock'),'cashier':(X.get(p['id']) or [None,None,None])} for p in G] for G in groups]
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,indent=1)
for G in out:
  if len({p['price'] for p in G})>1: print(' || '.join('%s %s=%s [%s]'%(p['name'],p['unit'],p['price'],(p['cashier'][0] or '-')) for p in G))
