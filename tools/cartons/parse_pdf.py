"""يقرأ ملف «تسعيرة الأصناف» PDF من الكاشير (وحدة الكرتون، المستوى 400) ويطلع rows.json: رقم الصنف، الاسم، سعر الكرتون.
الاستخدام: pdftotext -layout الملف.pdf all.txt && python3 tools/cartons/parse_pdf.py all.txt rows.json
تنبيه: rows.json فيه «آخر سعر شراء» (سري) فلا ترفعه للمستودع (عام)."""
import sys
import re, unicodedata, json, collections
raw=open(sys.argv[1],encoding='utf8').read()
def norm(s):
    s=unicodedata.normalize('NFKC',s)
    s=re.sub('[‪-‮‎‏⁦-⁩]','',s)
    s=s.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩٫','0123456789.'))
    return s
rows=[]; prev=None
for line in raw.split('\n'):
    L=norm(line).rstrip()
    m=re.match(r'^\s*(?:([\d.,]+)\s+)?([\d.,]+)\s+([\d.,]+)\s+SAR\s+(?:\S+\s+)?400\s+(\S+)\s+(.*)$',L)
    if m:
        last,avg,price,unit,rest=m.groups()
        rest=rest.strip()
        if unit not in ('كرتون','شدة','شده','باكت','حبة','حبه'):
            rest=unit+' '+rest; unit='كرتون'
        # code: trailing token or leading token of digits/-/
        code=None; name=rest
        mm=re.match(r'^(.*?)\s{2,}([0-9/\-A-Za-z]+)$',rest)
        if mm: name,code=mm.group(1).strip(),mm.group(2)
        else:
            mm=re.match(r'^([0-9][0-9/\-]{2,})\s*(\D.*)$',rest)
            if mm: code,name=mm.group(1),mm.group(2).strip()
        rows.append(dict(code=code,name=re.sub(r'\s+',' ',name),unit=unit,price=float(price.replace(',','')),last=float(last.replace(',','')) if last else None))
        prev=rows[-1]
    elif prev and L.strip() and not re.search(r'SAR|MATAJER|TX NO|الرقم|المملكة|حي الرمال|تسعيرة|آخر سعر|طبع بواسطة|^\s*\d+\s*$',L) and len(L.strip())<40:
        prev['name']+=' '+L.strip()
    else:
        if re.match(r'^\s*\d+\s*$',L): pass
print(len(rows))
print(collections.Counter(r['unit'] for r in rows).most_common())
print(sum(1 for r in rows if not r['code']))
json.dump(rows,open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
for r in rows[:5]+rows[1000:1005]: print(r)
