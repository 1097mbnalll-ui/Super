import re
exec(open('gen.py').read().split("# ---------- البنر المعلّق")[0])   # الخطوط والرمز والشعار من نفس الملف
EMBN=EMB  # الرمز متجهي
# ---------- بنر بسيط ٣٠٠×١٠٠ ----------
BN2=('''.bn{width:3000mm;height:1000mm;background:#fff;display:flex;align-items:center;padding:0 120mm;gap:110mm;position:relative}
.bn .logo{flex:none;display:flex;flex-direction:column;align-items:center;gap:20mm}
.bn .logo .e{width:420mm;height:420mm}.bn .logo .e svg{width:100%%;height:100%%;display:block}
.bn .logo b{font-size:100mm;line-height:1;color:%(N)s}
.bn .sep{width:4mm;height:620mm;background:%(N)s;opacity:.12;flex:none}
.bn .msg{flex:1;min-width:0}
.bn .h{font-size:290mm;line-height:1.02;color:%(N)s}
.bn .h em{font-style:normal;color:%(G)s}
.bn .s{margin-top:80mm;font-size:66mm;font-weight:500;color:%(N)s}
.bn .s::before{content:"";display:inline-block;width:90mm;height:16mm;background:%(O)s;border-radius:8mm;margin-inline-end:26mm;vertical-align:middle}
.bn .q{flex:none;display:flex;flex-direction:column;align-items:center;gap:22mm}
.bn .q .qr{width:470mm;height:470mm}
.bn .q span{font-size:60mm;font-weight:700;color:%(O)s}
.bn .bar{position:absolute;left:0;right:0;bottom:0;height:46mm;background:linear-gradient(to left,%(O)s 0 24%%,%(G)s 24%%)}''')%dict(N=N,G=G,O=O)
bn2='''<div class="bn"><div class="logo"><div class="e">%s</div><b class="lz">متاجر أحد</b></div><i class="sep"></i>
<div class="msg"><div class="h lz" data-fit>بقالتك</div><div class="h lz" data-fit>في <em>جوالك</em></div><div class="s">افتتحنا متجرنا الإلكتروني</div></div>
<div class="q"><div class="qr">%s</div><span>امسح واطلب</span></div><i class="bar"></i></div>'''%(EMBN,qr_svg())
# ---------- ستاند بسيط ٨٥×٢٠٠ (أبيض، وثاني أخضر) ----------
def stand(bg, fg, accent, qrfg, qrbg, sub_op, bar):
    css=('''.st{width:850mm;height:2000mm;background:%(bg)s;color:%(fg)s;display:flex;flex-direction:column;padding:90mm 75mm 0;position:relative}
.st .top{display:flex;align-items:center;gap:26mm}
.st .top .e{width:170mm;height:170mm;flex:none;%(eb)s}.st .top .e svg{width:100%%;height:100%%;display:block}
.st .top b{font-size:88mm;line-height:1}
.st .msg{margin-top:300mm}
.st .h{font-size:250mm;line-height:1.02}
.st .h em{font-style:normal;color:%(ac)s}
.st .s{margin-top:70mm;font-size:52mm;font-weight:500;opacity:%(so)s}
.st .s::before{content:"";display:inline-block;width:70mm;height:13mm;background:%(oc)s;border-radius:7mm;margin-inline-end:20mm;vertical-align:middle}
.st .q{margin-top:auto;margin-bottom:250mm;display:flex;align-items:flex-end;gap:40mm}
.st .q .qr{width:330mm;height:330mm;flex:none;%(qb)s}
.st .q span{font-size:56mm;font-weight:700;line-height:1.3;padding-bottom:6mm;color:%(cap)s}
.st .bar{position:absolute;left:0;right:0;bottom:0;height:170mm;background:linear-gradient(to left,%(oc)s 0 30%%,%(bar)s 30%%)}''')%dict(bg=bg,fg=fg,ac=accent,so=sub_op,bar=bar,oc=O,cap=(O if bg=='#fff' else '#fff'),
        eb='' if bg=='#fff' else 'background:#fff;border-radius:50%;padding:14mm',qb='' if qrbg=='#FFFFFF' and bg=='#fff' else 'background:#fff;padding:18mm;border-radius:6mm')
    body='''<div class="st"><div class="top"><div class="e">%s</div><b class="lz">متاجر أحد</b></div>
<div class="msg"><div class="h lz" data-fit>بقالتك</div><div class="h lz" data-fit>في <em>جوالك</em></div><div class="s">افتتحنا متجرنا الإلكتروني</div></div>
<div class="q"><div class="qr">%s</div><span>امسح<br>واطلب</span></div><i class="bar"></i></div>'''%(EMBN,qr_svg(qrfg,qrbg))
    return css,body
c1,b1=stand('#fff',N,G,N,'#FFFFFF','.7',G)
c2,b2=stand(G,'#fff',C,N,'#FFFFFF','.9',N)
open('banner.html','w').write(page(3000,1000,BN2,bn2,'بنر المدخل · متاجر أحد'))
open('stand-1.html','w').write(page(850,2000,c1,b1,'ستاند ١ · متاجر أحد'))
open('stand-2.html','w').write(page(850,2000,c2,b2,'ستاند ٢ · متاجر أحد'))
print('ok')
