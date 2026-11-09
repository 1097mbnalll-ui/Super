exec(open('gen.py').read().split("# ---------- البنر المعلّق")[0])
# كرت مربع 90×90مم + 3مم نزيف من كل جهة = 96×96
S=96; B=3
CSS=('''.cd{width:96mm;height:96mm;position:relative;overflow:hidden;break-after:page}
.in{position:absolute;inset:%(sf)smm;display:flex;flex-direction:column}
.f{background:#fff}
.f .top{display:flex;align-items:center;gap:3mm}
.f .top .e{width:11mm;height:11mm}.e svg{width:100%%;height:100%%;display:block}
.f .top b{font-size:6.2mm;line-height:1;color:%(N)s}
.f .msg{margin-top:auto;margin-bottom:auto}
.f .h{font-size:17mm;line-height:1.05;color:%(N)s}
.f .h em{font-style:normal;color:%(G)s}
.f .s{margin-top:4mm;font-size:3.6mm;font-weight:500;color:%(N)s}
.f .s::before{content:"";display:inline-block;width:6mm;height:1.2mm;background:%(O)s;border-radius:1mm;margin-inline-end:2mm;vertical-align:middle}
.bar{position:absolute;left:0;right:0;bottom:0;height:%(bh)smm;background:linear-gradient(to left,%(O)s 0 30%%,%(G)s 30%%)}
.k{background:%(G)s;color:#fff}
.k .in{align-items:center;justify-content:center;text-align:center}
.k .qr{width:44mm;height:44mm;background:#fff;padding:3mm;border-radius:2mm}
.k .t{margin-top:4mm;font-size:6.5mm;line-height:1;color:#fff}
.k .t em{font-style:normal;color:%(C)s}
.k .u{margin-top:3mm;font-size:3.1mm;font-weight:500;direction:ltr;white-space:nowrap;opacity:.95}
.k .bar{background:linear-gradient(to left,%(O)s 0 30%%,%(N)s 30%%)}''')%dict(N=N,G=G,O=O,C=C,sf=B+6,bh=B+5)
front='''<div class="cd f"><div class="in" style="bottom:%dmm"><div class="top"><div class="e">%s</div><b class="lz">متاجر أحد</b></div>
<div class="msg"><div class="h lz">بقالتك</div><div class="h lz">في <em>جوالك</em></div><div class="s">افتتحنا متجرنا الإلكتروني</div></div></div><i class="bar"></i></div>'''%(B+12,EMB)
back='''<div class="cd k"><div class="in" style="bottom:%dmm"><div class="qr">%s</div><div class="t lz">امسح <em>واطلب</em></div><div class="u">1097mbnalll-ui.github.io/Super</div></div><i class="bar"></i></div>'''%(B+9,qr_svg(N,'#FFFFFF'))
open('card.html','w').write(page(S,S,CSS,front+back,'كرت · متاجر أحد'))
open('card-front.html','w').write(page(S,S,CSS,front,'كرت وجه'))
open('card-back.html','w').write(page(S,S,CSS,back,'كرت ظهر'))
print('ok')
