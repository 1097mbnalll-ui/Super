exec(open('gen.py').read().split("# ---------- البنر المعلّق")[0])
# كرت المندوب بالطول 5×9 + نزيف 3مم = 56×96
W=56; H=96; M=8
CSS=('''.cd{width:56mm;height:96mm;position:relative;overflow:hidden;break-after:page}
.in{position:absolute;top:%(m)smm;right:%(m)smm;left:%(m)smm;bottom:12mm;display:flex;flex-direction:column}
.e svg{width:100%%;height:100%%;display:block}
.bar{position:absolute;left:0;right:0;bottom:0;height:5.5mm}
.f{background:%(C)s}.f .bar{background:%(G)s}
.f .top{display:flex;align-items:center;gap:2mm}
.f .top .e{width:8mm;height:8mm}.f .top b{font-size:4.2mm;line-height:1;color:%(N)s}
.f .ty{margin-top:3mm;font-size:2.8mm;font-weight:500;color:%(N)s;opacity:.7}
.f .msg{margin-top:auto}
.f .a{font-size:4.4mm;font-weight:700;color:%(N)s}
.f .h{font-size:10.5mm;line-height:1.12;color:%(N)s;white-space:nowrap}
.f .h em{font-style:normal;color:%(O)s}
.f .s{margin-top:2mm;font-size:2.8mm;font-weight:500;color:%(G)s}
.k{background:#fff}.k .bar{background:%(O)s}
.k .in{align-items:stretch}
.k .t{font-size:5.4mm;line-height:1.1;color:%(G)s}
.k .qr{width:32mm;height:32mm;margin:3.5mm auto 0}
.k ol{list-style:none;padding:0;margin-top:auto;display:grid;gap:1.6mm}
.k li{display:flex;align-items:center;gap:1.8mm;font-size:2.9mm;font-weight:500;color:%(N)s}
.k li i{flex:none;width:4mm;height:4mm;border-radius:50%%;background:%(O)s;color:#fff;font-style:normal;font-size:2.4mm;font-weight:700;display:grid;place-items:center;line-height:1}
.k .u{margin-top:2.6mm;font-size:2.15mm;font-weight:500;color:%(N)s;opacity:.75;direction:ltr;text-align:center;white-space:nowrap}''')%dict(N=N,G=G,O=O,C=C,m=M)
front='''<div class="cd f"><div class="in"><div class="top"><div class="e">%s</div><b class="lz">متاجر أحد</b></div><div class="ty">شكراً لطلبك</div>
<div class="msg"><div class="a">المرة الجاية</div><div class="h lz">اطلبها</div><div class="h lz">من <em>جوالك</em></div><div class="s">بدون اتصال ولا انتظار</div></div></div><i class="bar"></i></div>'''%EMB
back='''<div class="cd k"><div class="in"><div class="t lz">اطلب من متجرنا</div><div class="qr">%s</div>
<ol><li><i>١</i>امسح الكود</li><li><i>٢</i>اختر أغراضك</li><li><i>٣</i>توصلك لين بابك</li></ol>
<div class="u">1097mbnalll-ui.github.io/Super</div></div><i class="bar"></i></div>'''%qr_svg(N,'#FFFFFF')
for n,b in [('vc',front+back),('vc-front',front),('vc-back',back)]: open(n+'.html','w').write(page(W,H,CSS,b,'كرت المندوب · متاجر أحد'))
print('ok')
