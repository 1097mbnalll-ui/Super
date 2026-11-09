exec(open('gen.py').read().split("# ---------- البنر المعلّق")[0])
# كرت مستطيل 9×5 سم + 3مم نزيف = 96×56
W=96; H=56; B=3; M=B+5
CSS=('''.cd{width:96mm;height:56mm;position:relative;overflow:hidden;break-after:page}
.in{position:absolute;top:%(m)smm;right:%(m)smm;left:%(m)smm;bottom:%(ib)smm;display:flex}
.f{background:#fff}.f .in{flex-direction:column}
.f .top{display:flex;align-items:center;gap:2mm}
.e svg{width:100%%;height:100%%;display:block}
.f .top .e{width:8mm;height:8mm}.f .top b{font-size:4.4mm;line-height:1;color:%(N)s}
.f .msg{margin-top:auto}
.f .h{font-size:10.5mm;line-height:1.1;color:%(N)s;white-space:nowrap}
.f .h em{font-style:normal;color:%(G)s}
.f .s{margin-top:1.6mm;font-size:2.7mm;font-weight:500;color:%(N)s}
.f .s::before{content:"";display:inline-block;width:4.5mm;height:.9mm;background:%(O)s;border-radius:.5mm;margin-inline-end:1.5mm;vertical-align:middle}
.bar{position:absolute;left:0;right:0;bottom:0;height:%(bh)smm;background:linear-gradient(to left,%(O)s 0 30%%,%(G)s 30%%)}
.k{background:%(G)s;color:#fff}
.k .in{align-items:center;gap:5mm}
.k .tx{flex:1;min-width:0}
.k .t{font-size:7.2mm;line-height:1.15;color:#fff}.k .t em{font-style:normal;color:%(C)s}
.k .s{margin-top:1.5mm;font-size:2.7mm;font-weight:500}
.k .u{margin-top:3mm;font-size:2.35mm;font-weight:500;direction:ltr;text-align:right;white-space:nowrap}
.k .qr{flex:none;width:33mm;height:33mm;background:#fff;padding:2mm;border-radius:1.5mm}
.k .bar{background:linear-gradient(to left,%(O)s 0 30%%,%(N)s 30%%)}''')%dict(N=N,G=G,O=O,C=C,m=M,ib=B+7,bh=B+3)
front='''<div class="cd f"><div class="in"><div class="top"><div class="e">%s</div><b class="lz">متاجر أحد</b></div>
<div class="msg"><div class="h lz">بقالتك في <em>جوالك</em></div><div class="s">افتتحنا متجرنا الإلكتروني</div></div></div><i class="bar"></i></div>'''%EMB
back='''<div class="cd k"><div class="in"><div class="tx"><div class="t lz">امسح<br><em>واطلب</em></div><div class="s">واللي تبيه يوصلك لين بابك</div><div class="u">1097mbnalll-ui.github.io/Super</div></div><div class="qr">%s</div></div><i class="bar"></i></div>'''%qr_svg(N,'#FFFFFF')
for n,b in [('bc',front+back),('bc-front',front),('bc-back',back)]: open(n+'.html','w').write(page(W,H,CSS,b,'كرت · متاجر أحد'))
print('ok')
