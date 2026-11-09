import segno, io, base64, re, html
P='/tmp/claude-0/-home-user--Public-/8e5dea40-6fc8-5378-ba65-17a06170671e/scratchpad/'
URL='https://1097mbnalll-ui.github.io/Super/'
SHOW='1097mbnalll-ui.github.io/Super'
def qr_svg(fg='#13213C', bg='#FFFFFF'):
    q=segno.make(URL, error='q', micro=False)
    buf=io.BytesIO(); q.save(buf, kind='svg', scale=1, border=0, dark=fg, light=bg, xmldecl=False, svgns=True, nl=False)
    s=buf.getvalue().decode()
    m=re.search(r'<svg[^>]*?width="(\d+)"[^>]*?height="(\d+)"',s); w,h=m.group(1),m.group(2)
    s=re.sub(r'(<svg[^>]*?)\swidth="\d+"',r'\1',s,count=1); s=re.sub(r'(<svg[^>]*?)\sheight="\d+"',r'\1',s,count=1)
    s=s.replace('<svg ','<svg viewBox="0 0 %s %s" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet" '%(w,h),1)
    return s
logo='data:image/webp;base64,'+base64.b64encode(open(P+'logo.webp','rb').read()).decode()
def ff(fam,path,w): return '@font-face{font-family:"%s";src:url(file://%s%s) format("woff2");font-weight:%d}'%(fam,P,path,w)
FONTS=ff('Lalezar','fs/lalezar/package/files/lalezar-arabic-400-normal.woff2',400)+ff('Lalezar','fs/lalezar/package/files/lalezar-latin-400-normal.woff2',400)
FONTS+=''.join(ff('Readex Pro','fs/readex-pro/package/files/readex-pro-%s-%d-normal.woff2'%(s,w),w) for s in('arabic','latin') for w in(500,700))
FONTS+=''.join(ff('Reem Kufi','fs/reem-kufi/package/files/reem-kufi-%s-700-normal.woff2'%s,700) for s in('arabic','latin'))
G='#0E9F7B'; O='#FF8A1F'; N='#13213C'; C='#FBF6EC'
BASE='''@page{size:105mm 148mm;margin:0}*{box-sizing:border-box;margin:0}html,body{width:105mm;background:#fff}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:"Readex Pro",Tahoma,sans-serif;direction:rtl;color:%(N)s}
.p{width:105mm;height:148mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;display:flex;flex-direction:column}
.p:last-child{page-break-after:auto;break-after:auto}
.lalz{font-family:"Lalezar","Readex Pro",sans-serif;font-weight:400}
.logo{display:block;border-radius:50%%;background:#fff;object-fit:contain}
.qr{display:block}.qr svg{display:block;width:100%%;height:100%%}
.url{white-space:nowrap;direction:ltr;unicode-bidi:isolate;font-family:"Readex Pro",sans-serif;font-weight:700;letter-spacing:.01em}
'''%dict(N=N)
# ---------- A: عبارة ضخمة ----------
A='''
.A{background:%(C)s}
.A .top{padding:7mm 8mm 0;display:flex;align-items:center;gap:3.5mm}
.A .top .logo{width:21mm;height:21mm;flex:none;box-shadow:0 0 0 .5mm %(N)s}
.A .top .nm{display:grid;line-height:1.05}.A .top .nm b{font-family:"Lalezar";font-weight:400;font-size:9.5mm;color:%(N)s}.A .top .nm span{font-size:3.1mm;font-weight:500;letter-spacing:0}
.A .big{padding:4mm 8mm 0;flex:1;display:flex;flex-direction:column;justify-content:center}
.A .big .l1{font-family:"Lalezar";font-weight:400;font-size:19mm;line-height:.9;color:%(N)s}
.A .big .l2{margin-top:6mm;font-family:"Lalezar";font-weight:400;font-size:30mm;line-height:.9;color:%(G)s;position:relative;display:inline-block;width:max-content}
.A .big .l2::after{content:"";position:absolute;right:0;left:-2mm;bottom:-1.5mm;height:2.3mm;background:%(O)s;transform:rotate(-1.3deg);border-radius:1mm}
.A .big .sub{margin-top:6.5mm;font-size:5.4mm;font-weight:700}
.A .foot{background:%(N)s;color:#fff;padding:5mm 8mm;display:flex;align-items:center;gap:5mm}
.A .foot .qr{width:34mm;height:34mm;background:#fff;padding:2mm;flex:none;border-radius:1.2mm}
.A .foot .tx{display:grid;gap:2mm}.A .foot .tx b{font-family:"Lalezar";font-weight:400;font-size:8.2mm;line-height:1;color:%(O)s}.A .foot .tx span{font-size:3.4mm;font-weight:500;line-height:1.4}
.A .foot .url{font-size:2.6mm;color:#fff;opacity:.9}
'''%dict(C=C,N=N,G=G,O=O)
def pageA(qr):
    return '''<div class="p A"><div class="top"><img class="logo" src="%s" alt=""><div class="nm"><b>متاجر أحد</b><span>أسواق ومخابز · حي الرمال</span></div></div>
<div class="big"><div class="l1">التوصيل</div><div class="l2">مجاناً</div><div class="sub">اطلب من موقعنا وتجيك لين الباب</div></div>
<div class="foot"><div class="qr">%s</div><div class="tx"><b>امسح واطلب</b><span>افتح كاميرا الجوال ووجّهها على الرمز</span><span class="url">%s</span></div></div></div>'''%(logo,qr,SHOW)
# ---------- B: نصفين ----------
B='''
.B{background:#fff}
.B .hero{background:%(G)s;color:#fff;height:78mm;padding:19mm 8mm 0;position:relative}
.B .hero .logo{position:absolute;left:50%%;top:6mm;transform:translateX(-50%%);width:26mm;height:26mm;box-shadow:0 0 0 1.2mm %(O)s}
.B .hero .t{margin-top:15mm;text-align:center;line-height:.95}
.B .hero .t .a{font-family:"Lalezar";font-weight:400;font-size:15mm;display:block}
.B .hero .t .b{margin-top:5.5mm;font-family:"Lalezar";font-weight:400;font-size:25mm;display:block;color:%(C)s}
.B .hero .t .c{display:inline-block;margin-top:3mm;background:%(O)s;color:%(N)s;font-weight:700;font-size:4.3mm;padding:1.3mm 5mm 1.7mm;border-radius:10mm}
.B .low{flex:1;display:flex;align-items:center;gap:4mm;padding:4mm 7mm}
.B .low .qr{width:40mm;height:40mm;border:.9mm solid %(N)s;padding:2.2mm;flex:none}
.B .low .tx{display:grid;gap:2.6mm}.B .low .tx b{font-family:"Lalezar";font-weight:400;font-size:9.4mm;line-height:1;color:%(N)s}.B .low .tx span{font-size:3.4mm;line-height:1.45;font-weight:500}
.B .low .url{font-size:2.25mm;color:%(G)s}
.B .nm{background:%(N)s;color:#fff;text-align:center;font-size:3.5mm;padding:2.4mm 0;font-weight:500}.B .nm b{font-family:"Lalezar";font-weight:400;font-size:4.6mm;margin-inline-end:1.5mm;letter-spacing:0}
'''%dict(G=G,O=O,N=N,C=C)
def pageB(qr):
    return '''<div class="p B"><div class="hero"><img class="logo" src="%s" alt=""><div class="t"><span class="a">التوصيل</span><span class="b">مجاناً</span><span class="c">اطلب من موقعنا</span></div></div>
<div class="low"><div class="qr">%s</div><div class="tx"><b>امسح الرمز</b><span>وتجيك الطلبية لين باب البيت</span><span class="url">%s</span></div></div>
<div class="nm"><b>متاجر أحد</b> أسواق ومخابز · حي الرمال</div></div>'''%(logo,qr,SHOW)
# ---------- C: ختم ----------
Cc='''
.C{background:%(N)s;padding:5mm}
.C .in{flex:1;background:%(C)s;border-radius:1.5mm;display:flex;flex-direction:column;align-items:center;position:relative;padding:6mm 6mm 5mm}
.C .in .logo{width:23mm;height:23mm;box-shadow:0 0 0 .6mm %(N)s}
.C .in .hd{margin-top:2.4mm;font-family:"Lalezar";font-weight:400;font-size:6.4mm;line-height:1;color:%(N)s}
.C .stamp{margin-top:3.5mm;width:62mm;height:62mm;border-radius:50%%;background:%(O)s;color:%(N)s;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-7deg);box-shadow:inset 0 0 0 1.4mm %(O)s,inset 0 0 0 2.2mm %(N)s}
.C .stamp .a{font-family:"Lalezar";font-weight:400;font-size:12mm;line-height:.9}
.C .stamp .b{margin-top:5mm;font-family:"Lalezar";font-weight:400;font-size:21mm;line-height:.9;color:#fff;-webkit-text-stroke:.5mm %(N)s;paint-order:stroke fill}
.C .row{margin-top:auto;width:100%%;display:flex;align-items:center;justify-content:center;gap:4.5mm}
.C .row .qr{width:30mm;height:30mm;background:#fff;padding:1.8mm;border:.6mm solid %(N)s;flex:none}
.C .row .tx{display:grid;gap:1.8mm}.C .row .tx b{font-family:"Lalezar";font-weight:400;font-size:7.4mm;line-height:1}.C .row .tx span{font-size:3.1mm;line-height:1.4}
.C .row .url{font-size:2.5mm;color:%(G)s}
'''%dict(N=N,C=C,O=O,G=G)
def pageC(qr):
    return '''<div class="p C"><div class="in"><img class="logo" src="%s" alt=""><div class="hd">متاجر أحد · حي الرمال</div>
<div class="stamp"><span class="a">التوصيل</span><span class="b">مجاناً</span></div>
<div class="row"><div class="qr">%s</div><div class="tx"><b>اطلب من الموقع</b><span>امسح الرمز بالجوال</span><span class="url">%s</span></div></div></div></div>'''%(logo,qr,SHOW)
# ---------- D: أبيض وأسود (يوفر الحبر) ----------
D='''
.D{background:#fff;border:1.4mm solid #000;margin:0;padding:6mm 7mm}
.D *{color:#000!important}
.D .top{display:flex;align-items:center;gap:3.5mm;border-bottom:.7mm solid #000;padding-bottom:4mm}
.D .top .logo{width:19mm;height:19mm;box-shadow:0 0 0 .4mm #000}
.D .top .nm{display:grid;line-height:1.05}.D .top .nm b{font-family:"Lalezar";font-weight:400;font-size:9mm}.D .top .nm span{font-size:3mm;font-weight:500}
.D .big{flex:1;display:flex;flex-direction:column;justify-content:center;padding-top:2mm}
.D .big .l1{font-family:"Lalezar";font-weight:400;font-size:19mm;line-height:.9}
.D .big .l2{margin-top:6mm;font-family:"Lalezar";font-weight:400;font-size:30mm;line-height:.9;display:inline-block;width:max-content;position:relative}
.D .big .l2::after{content:"";position:absolute;right:0;left:-2mm;bottom:-1.5mm;height:2mm;background:#000;transform:rotate(-1.3deg)}
.D .big .sub{margin-top:6mm;font-size:5mm;font-weight:700}
.D .foot{border-top:.7mm solid #000;padding-top:4mm;display:flex;align-items:center;gap:5mm}
.D .foot .qr{width:33mm;height:33mm;border:.7mm solid #000;padding:1.6mm;flex:none}
.D .foot .tx{display:grid;gap:2mm}.D .foot .tx b{font-family:"Lalezar";font-weight:400;font-size:8mm;line-height:1}.D .foot .tx span{font-size:3.2mm;line-height:1.4}
.D .foot .url{font-size:2.6mm}
'''
def pageD(qr):
    return '''<div class="p D"><div class="top"><img class="logo" src="%s" alt=""><div class="nm"><b>متاجر أحد</b><span>أسواق ومخابز · حي الرمال</span></div></div>
<div class="big"><div class="l1">التوصيل</div><div class="l2">مجاناً</div><div class="sub">اطلب من موقعنا وتجيك لين الباب</div></div>
<div class="foot"><div class="qr">%s</div><div class="tx"><b>امسح واطلب</b><span>افتح كاميرا الجوال ووجّهها على الرمز</span><span class="url">%s</span></div></div></div>'''%(logo,qr,SHOW)
def doc(body, css): return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إعلان الكاشير · متاجر أحد</title><style>%s%s%s</style></head><body>%s</body></html>'%(FONTS,BASE,css,body)
qn=qr_svg(N); qb=qr_svg('#000000')
pages={'A':(pageA(qn),A),'B':(pageB(qn),B),'C':(pageC(qn),Cc),'D':(pageD(qb),D)}
for k,(b,c) in pages.items(): open('ad-%s.html'%k,'w').write(doc(b,c))
open('ad-all.html','w').write(doc(''.join(b for b,_ in pages.values()), A+B+Cc+D))
print('ok')
