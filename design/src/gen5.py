exec(open('gen.py').read().split("# ---------- البنر المعلّق")[0])
# كرت المندوب 9×5 + نزيف 3مم
W=96; H=56; M=8
CSS=('''.cd{width:96mm;height:56mm;position:relative;overflow:hidden;break-after:page}
.in{position:absolute;inset:%(m)smm;display:flex}
.e svg{width:100%%;height:100%%;display:block}
.f{background:%(C)s}.f .in{flex-direction:column}
.f .top{display:flex;align-items:center;gap:2mm}
.f .top .e{width:7.5mm;height:7.5mm}.f .top b{font-size:4mm;line-height:1;color:%(N)s}
.f .top small{margin-inline-start:auto;font-size:2.6mm;font-weight:500;color:%(N)s;opacity:.7}
.f .msg{margin-top:auto}
.f .a{font-size:4.2mm;font-weight:700;color:%(N)s}
.f .h{font-size:10mm;line-height:1.15;color:%(N)s;white-space:nowrap}
.f .h em{font-style:normal;color:%(O)s}
.f .s{margin-top:1mm;font-size:2.7mm;font-weight:500;color:%(G)s}
.f .side{position:absolute;top:0;bottom:0;left:0;width:%(sw)smm;background:%(G)s}
.k{background:#fff}.k .in{align-items:center;gap:5mm}
.k .tx{flex:1;min-width:0}
.k .t{font-size:5.6mm;line-height:1.1;color:%(G)s}
.k ol{list-style:none;padding:0;margin-top:2.2mm;display:grid;gap:1.6mm}
.k li{display:flex;align-items:center;gap:1.8mm;font-size:2.9mm;font-weight:500;color:%(N)s}
.k li i{flex:none;width:4mm;height:4mm;border-radius:50%%;background:%(O)s;color:#fff;font-style:normal;font-size:2.4mm;font-weight:700;display:grid;place-items:center;line-height:1}
.k .u{margin-top:2.6mm;font-size:2.25mm;font-weight:500;color:%(N)s;opacity:.75;direction:ltr;text-align:right;white-space:nowrap}
.k .qr{flex:none;width:31mm;height:31mm}
.k .side{position:absolute;top:0;bottom:0;right:0;width:%(sw)smm;background:%(O)s}''')%dict(N=N,G=G,O=O,C=C,m=M,sw=3+2.5)
front='''<div class="cd f"><i class="side"></i><div class="in" style="left:12mm"><div class="top"><div class="e">%s</div><b class="lz">متاجر أحد</b><small>شكراً لطلبك</small></div>
<div class="msg"><div class="a">المرة الجاية</div><div class="h lz">اطلبها من <em>جوالك</em></div><div class="s">بدون اتصال ولا انتظار</div></div></div></div>'''%EMB
back='''<div class="cd k"><i class="side"></i><div class="in" style="right:12mm"><div class="tx"><div class="t lz">اطلب من متجرنا</div>
<ol><li><i>١</i>امسح الكود</li><li><i>٢</i>اختر أغراضك</li><li><i>٣</i>توصلك لين بابك</li></ol>
<div class="u">1097mbnalll-ui.github.io/Super</div></div><div class="qr">%s</div></div></div>'''%qr_svg(N,'#FFFFFF')
for n,b in [('dc',front+back),('dc-front',front),('dc-back',back)]: open(n+'.html','w').write(page(W,H,CSS,b,'كرت المندوب · متاجر أحد'))
print('ok')
