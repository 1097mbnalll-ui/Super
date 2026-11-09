import segno, io, re
P='/tmp/claude-0/-home-user--Public-/8e5dea40-6fc8-5378-ba65-17a06170671e/scratchpad/'
URL='https://1097mbnalll-ui.github.io/Super/'
def qr_svg(fg='#13213C', bg='#FFFFFF'):
    q=segno.make(URL, error='q'); buf=io.BytesIO(); q.save(buf, kind='svg', scale=1, border=0, dark=fg, light=bg, xmldecl=False, svgns=True, nl=False)
    s=buf.getvalue().decode(); m=re.search(r'<svg[^>]*?width="(\d+)"[^>]*?height="(\d+)"',s); w,h=m.group(1),m.group(2)
    s=re.sub(r'(<svg[^>]*?)\swidth="\d+"',r'\1',s,count=1); s=re.sub(r'(<svg[^>]*?)\sheight="\d+"',r'\1',s,count=1)
    return s.replace('<svg ','<svg viewBox="0 0 %s %s" shape-rendering="crispEdges" '%(w,h),1)
EMB=open('emblem.svg').read()
def ff(fam,path,w): return '@font-face{font-family:"%s";src:url(file://%s%s) format("woff2");font-weight:%d}'%(fam,P,path,w)
FONTS=ff('Lalezar','fs/lalezar/package/files/lalezar-arabic-400-normal.woff2',400)+ff('Lalezar','fs/lalezar/package/files/lalezar-latin-400-normal.woff2',400)
FONTS+=''.join(ff('Readex Pro','fs/readex-pro/package/files/readex-pro-%s-%d-normal.woff2'%(s,w),w) for s in('arabic','latin') for w in(500,700))
G='#0E9F7B'; O='#FF8A1F'; N='#13213C'; C='#FBF6EC'
BASE='''*{box-sizing:border-box;margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:"Readex Pro",sans-serif;direction:rtl;color:%(N)s}
.lz{font-family:"Lalezar",sans-serif;font-weight:400}
[data-fit]{display:block;white-space:nowrap;width:100%%}
.emb{border-radius:50%%;background:#fff;display:grid;place-items:center}.emb svg{width:74%%;height:74%%;display:block}
.qr svg{display:block;width:100%%;height:100%%}
'''%dict(N=N)
FIT='''<script>
function fit(){document.querySelectorAll('[data-fit]').forEach(function(e){var s=parseFloat(getComputedStyle(e).fontSize),i=0;while(e.scrollWidth>e.clientWidth+1&&i<200){s*=0.98;e.style.fontSize=s+'px';i++;}});}
document.fonts.ready.then(function(){fit();document.body.setAttribute('data-ready','1');});
</script>'''
def page(w,h,css,body,title):
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>%s</title><style>@page{size:%dmm %dmm;margin:0}html,body{width:%dmm;height:%dmm}%s%s%s</style></head><body>%s%s</body></html>'%(title,w,h,w,h,FONTS,BASE,css,body,FIT)
# ---------- البنر المعلّق ٣٠٠×١٠٠ سم ----------
BN=('''.bn{width:3000mm;height:1000mm;display:grid;grid-template-columns:860mm 1fr 760mm;overflow:hidden}
.bn .a{background:%(G)s;display:grid;place-items:center}
.bn .a .emb{width:740mm;height:740mm;box-shadow:0 0 0 22mm %(O)s}
.bn .b{background:%(C)s;padding:70mm 80mm 60mm;display:flex;flex-direction:column;justify-content:center;min-width:0}
.bn .k{font-weight:700;font-size:62mm}
.bn .pill{align-self:flex-start;background:%(O)s;color:%(N)s;font-weight:700;font-size:76mm;line-height:1;padding:8mm 44mm 14mm;border-radius:80mm;margin-top:16mm}
.bn .h1{font-size:270mm;line-height:.95;color:%(O)s;margin-top:12mm}
.bn .h2{font-size:230mm;line-height:1.05;color:%(N)s}
.bn .sl{margin-top:18mm;align-self:flex-start;color:%(G)s;font-weight:700;font-size:70mm;line-height:1.1}
.bn .c{background:%(N)s;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34mm}
.bn .qr{width:540mm;height:540mm;background:#fff;padding:30mm;border-radius:14mm}
.bn .cap{color:%(O)s;font-size:110mm;line-height:1}''')%dict(G=G,O=O,N=N,C=C)
bn_body='''<div class="bn"><div class="a"><div class="emb">%s</div></div>
<div class="b"><span class="k" data-fit>متاجر أحد · أسواق ومخابز · حي الرمال</span><span class="pill">افتتاح</span><span class="h1 lz" data-fit>بقالتك</span><span class="h2 lz" data-fit>في جوالك</span><span class="sl">افتتحنا متجرنا الإلكتروني</span></div>
<div class="c"><div class="qr">%s</div><span class="cap lz">امسح واطلب</span></div></div>'''%(EMB,qr_svg())
# ---------- ستاند ١: الأخضر ----------
SA=('''.st{width:850mm;height:2000mm;display:flex;flex-direction:column;overflow:hidden;background:%(C)s}
.st .top{background:%(G)s;color:#fff;display:flex;flex-direction:column;align-items:center;padding:55mm 60mm 45mm}
.st .top .emb{width:330mm;height:330mm;box-shadow:0 0 0 16mm %(O)s}
.st .top .nm{margin-top:38mm;font-size:110mm;line-height:1;color:%(C)s;text-align:center}
.st .top .ar{margin-top:16mm;font-size:40mm;font-weight:500;text-align:center}
.st .mid{padding:34mm 70mm 0}
.st .pill{display:inline-block;background:%(N)s;color:%(C)s;font-weight:700;font-size:48mm;line-height:1;padding:6mm 30mm 11mm;border-radius:60mm}
.st .h1{font-size:225mm;line-height:.95;color:%(O)s;margin-top:12mm}
.st .h2{font-size:170mm;line-height:1.05}
.st .sl{margin-top:12mm;font-size:62mm;font-weight:700;color:%(G)s;position:relative;padding-bottom:12mm}
.st .sl::after{content:"";position:absolute;right:0;width:62%%;bottom:0;height:9mm;background:%(O)s;border-radius:5mm;transform:rotate(-.8deg)}
.st .pts{list-style:none;padding:0;margin:42mm 70mm 0;display:grid;gap:14mm}
.st .pts li{font-size:40mm;font-weight:700;display:flex;align-items:center;gap:18mm}
.st .pts li::before{content:"";width:22mm;height:22mm;background:%(O)s;flex:none;transform:rotate(45deg)}
.st .q{margin:auto 70mm 0;display:flex;align-items:center;gap:40mm;padding:30mm 0 35mm}
.st .q .qr{width:300mm;height:300mm;background:#fff;padding:18mm;border:6mm solid %(N)s;flex:none}
.st .q .t{display:grid;gap:12mm}.st .q .t b{font-size:84mm;line-height:1}.st .q .t span{font-size:38mm;font-weight:500;line-height:1.4}
.st .base{height:150mm;background:%(N)s;flex:none}''')%dict(G=G,O=O,N=N,C=C)
sa_body='''<div class="st"><div class="top"><div class="emb">%s</div><span class="nm lz">متاجر أحد</span><span class="ar">أسواق ومخابز · حي الرمال</span></div>
<div class="mid"><span class="pill">افتتاح</span><span class="h1 lz" data-fit>بقالتك</span><span class="h2 lz" data-fit>في جوالك</span><span class="sl" data-fit>افتتحنا متجرنا الإلكتروني</span></div>
<ul class="pts"><li>التوصيل مجاناً</li><li>الدفع عند الاستلام · كاش أو شبكة</li><li>يوصلك خلال ٣٠–٤٥ دقيقة</li></ul>
<div class="q"><div class="qr">%s</div><div class="t"><b class="lz">امسح واطلب</b><span>من كاميرا جوالك</span></div></div><div class="base"></div></div>'''%(EMB,qr_svg())
# ---------- ستاند ٢: الكحلي ----------
SB=('''.sb{width:850mm;height:2000mm;display:flex;flex-direction:column;align-items:center;overflow:hidden;background:%(N)s;color:#fff;text-align:center}
.sb .emb{margin-top:70mm;width:370mm;height:370mm;box-shadow:0 0 0 14mm %(C)s}
.sb .nm{margin-top:40mm;font-size:110mm;line-height:1}
.sb .ar{margin-top:10mm;font-size:38mm;font-weight:500;opacity:.85}
.sb .rib{margin-top:55mm;width:110%%;background:%(O)s;color:%(N)s;transform:rotate(-4deg);padding:22mm 0 34mm}
.sb .rib b{font-size:215mm;line-height:.95;display:block}
.sb .h2{margin-top:50mm;padding:0 60mm;font-size:190mm;line-height:1.05;color:%(C)s}
.sb .sl{margin-top:18mm;margin-bottom:34mm;font-size:62mm;font-weight:700;color:%(O)s}
.sb .qr{margin-top:auto;width:350mm;height:350mm;background:#fff;padding:20mm;border-radius:10mm}
.sb .cap{margin-top:24mm;font-size:72mm;line-height:1}
.sb .pts{margin:26mm 0 36mm;font-size:36mm;font-weight:500;opacity:.9}
.sb .base{height:170mm;width:100%%;background:%(G)s;flex:none}''')%dict(G=G,O=O,N=N,C=C)
sb_body='''<div class="sb"><div class="emb">%s</div><span class="nm lz">متاجر أحد</span><span class="ar">أسواق ومخابز · حي الرمال</span>
<div class="rib"><b class="lz" data-fit>بقالتك</b></div><span class="h2 lz" data-fit>في جوالك</span><span class="sl">افتتاح متجرنا الإلكتروني</span>
<div class="qr">%s</div><span class="cap lz">امسح واطلب الحين</span><span class="pts">التوصيل مجاناً · الدفع عند الاستلام · ٣٠–٤٥ دقيقة</span><div class="base"></div></div>'''%(EMB,qr_svg())
open('banner.html','w').write(page(3000,1000,BN,bn_body,'بنر المدخل · متاجر أحد'))
open('stand-1.html','w').write(page(850,2000,SA,sa_body,'ستاند ١ · متاجر أحد'))
open('stand-2.html','w').write(page(850,2000,SB,sb_body,'ستاند ٢ · متاجر أحد'))
print('ok')
