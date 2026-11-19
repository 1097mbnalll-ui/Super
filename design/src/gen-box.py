# صندوق الدباب (المندوب) — المالك ١٩ نوفمبر ٢٠٢٦
# ٣ وجوه بمقاس ٤٥×٤٥ سم (الملف متجه، يتكبّر أو يتصغّر لأي صندوق بدون ما يخرب): الخلفي (اللي يشوفه اللي ورا الدباب)، الجانبين، والغطا.
import os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) > 1: P_OVERRIDE = sys.argv[1]
exec(open('gen.py').read().split("# ---------- البنر المعلّق")[0])
if len(sys.argv) > 1:
    P = P_OVERRIDE
    FONTS = ff('Lalezar','fs/lalezar/package/files/lalezar-arabic-400-normal.woff2',400)+ff('Lalezar','fs/lalezar/package/files/lalezar-latin-400-normal.woff2',400)
    FONTS += ''.join(ff('Readex Pro','fs/readex-pro/package/files/readex-pro-%s-%d-normal.woff2'%(s,w),w) for s in('arabic','latin') for w in(500,700))
W = H = 450   # مم
APPLE = '<svg viewBox="0 0 24 24"><path d="M16.37 12.77c-.03-2.69 2.2-3.98 2.3-4.04-1.25-1.83-3.2-2.08-3.9-2.11-1.66-.17-3.24.98-4.08.98-.84 0-2.14-.96-3.52-.93-1.81.03-3.48 1.050-4.41 2.67-1.88 3.26-.48 8.09 1.35 10.73.89 1.29 1.96 2.75 3.36 2.7 1.35-.05 1.86-.87 3.49-.87 1.63 0 2.09.87 3.51.84 1.45-.02 2.37-1.32 3.26-2.62 1.03-1.5 1.45-2.950 1.47-3.02-.03-.01-2.82-1.09-2.85-4.33zM13.69 4.86c.74-.9 1.24-2.15 1.11-3.39-1.07.04-2.36.71-3.13 1.61-.69.79-1.29 2.06-1.13 3.27 1.19.09 2.41-.6 3.15-1.49z" fill="currentColor"/></svg>'
PHONE = '055 538 9587'
CSS = ('''.f{width:450mm;height:450mm;position:relative;overflow:hidden;break-after:page}
.stripe{position:absolute;left:0;right:0;bottom:0;height:22mm;background:linear-gradient(to left,%(O)s 0 30%%,%(G)s 30%%)}
.e svg{width:100%%;height:100%%;display:block}
/* الخلفي */
.bk{background:%(C)s}
.bk .hd{position:absolute;top:0;left:0;right:0;height:120mm;background:%(G)s;display:flex;align-items:center;justify-content:center;gap:16mm;padding:0 30mm}
.bk .hd .emb{width:82mm;height:82mm;flex:none}
.bk .hd b{font-size:96mm;line-height:1;color:#fff;white-space:nowrap}
.bk .mid{position:absolute;top:142mm;left:30mm;right:30mm;text-align:center}
.bk .mid .h{font-size:62mm;line-height:1.1;color:%(N)s;white-space:nowrap}.bk .mid .h em{font-style:normal;color:%(O)s}
.bk .mid .s{margin-top:6mm;font-size:17mm;font-weight:700;color:%(N)s}
.bk .low{position:absolute;left:30mm;right:30mm;bottom:40mm;display:flex;align-items:center;gap:16mm}
.bk .qr{flex:none;width:122mm;height:122mm;background:#fff;padding:7mm;border-radius:8mm;box-shadow:0 0 0 2.5mm %(N)s}
.bk .tx{flex:1;min-width:0;display:grid;gap:7mm}
.bk .tx .t{font-size:40mm;line-height:1;color:%(N)s}.bk .tx .t em{font-style:normal;color:%(G)s}
.ap{display:inline-flex;align-items:center;gap:5mm;background:#000;color:#fff;border-radius:9mm;padding:5mm 10mm;width:max-content}
.ap .ai{width:17mm;height:17mm}.ap span{display:grid;line-height:1.05}.ap small{font-size:7mm;font-weight:500}.ap b{font-size:13mm;font-family:"Readex Pro",sans-serif;direction:ltr}
.ph{display:flex;align-items:center;gap:4mm;font-size:15mm;font-weight:700;color:%(N)s;direction:ltr;justify-content:flex-end}
/* الجانب */
.sd{background:%(G)s;color:#fff}
.sd .emb{position:absolute;top:58mm;left:50%%;transform:translateX(-50%%);width:170mm;height:170mm;box-shadow:0 0 0 6mm rgba(255,255,255,.25)}
.sd .nm{position:absolute;top:250mm;left:20mm;right:20mm;text-align:center;font-size:92mm;line-height:1;white-space:nowrap}
.sd .s{position:absolute;top:356mm;left:20mm;right:20mm;text-align:center;font-size:22mm;font-weight:700}
.sd .s i{display:inline-block;width:18mm;height:4mm;background:%(O)s;border-radius:2mm;vertical-align:middle;margin:0 5mm}
.sd .stripe{background:linear-gradient(to left,%(O)s 0 30%%,%(N)s 30%%)}
/* الغطا */
.tp{background:%(C)s}
.tp .emb{position:absolute;top:70mm;left:50%%;transform:translateX(-50%%);width:200mm;height:200mm;box-shadow:0 0 0 7mm %(G)s}
.tp .nm{position:absolute;top:300mm;left:20mm;right:20mm;text-align:center;font-size:84mm;line-height:1;color:%(N)s;white-space:nowrap}
''') % dict(N=N, G=G, O=O, C=C)
back = '''<div class="f bk"><div class="hd"><div class="emb">%s</div><b class="lz">متاجر أحد</b></div>
<div class="mid"><div class="h lz">بقالتك في <em>جوالك</em></div><div class="s">اطلب من التطبيق، ويوصلك لين بابك</div></div>
<div class="low"><div class="qr">%s</div><div class="tx"><div class="t lz">امسح <em>واطلب</em></div>
<div class="ap"><span class="ai e">%s</span><span><small>حمّله من</small><b>App Store</b></span></div>
<div class="ph">%s ☎</div></div></div><i class="stripe"></i></div>''' % (EMB, qr_svg(N, '#FFFFFF'), APPLE, PHONE)
side = '''<div class="f sd"><div class="emb">%s</div><div class="nm lz">متاجر أحد</div><div class="s">بقالتك في جوالك<i></i>حي الرمال</div><i class="stripe"></i></div>''' % EMB
top = '''<div class="f tp"><div class="emb">%s</div><div class="nm lz">متاجر أحد</div><i class="stripe"></i></div>''' % EMB
# الخلفي (نسخة ٢، المالك ١٩ نوفمبر): خلفية خضراء كاملة تنشاف من بعيد، الشعار والاسم كبار، والباركود في كرت أبيض
CSS += ('''.bk2{background:%(G)s;color:#fff}
.bk2 .hd2{position:absolute;top:34mm;left:30mm;right:30mm;display:flex;align-items:center;justify-content:center;gap:14mm}
.bk2 .hd2 .emb{width:84mm;height:84mm;flex:none;box-shadow:0 0 0 5mm rgba(255,255,255,.22)}
.bk2 .hd2 b{font-size:82mm;line-height:1;white-space:nowrap}
.bk2 .h{position:absolute;top:168mm;left:20mm;right:20mm;text-align:center;font-size:58mm;line-height:1;white-space:nowrap}.bk2 .h em{font-style:normal;color:#FFD08A}
.bk2 .card{position:absolute;left:26mm;right:26mm;bottom:40mm;height:166mm;background:#fff;border-radius:16mm;display:flex;align-items:center;gap:12mm;padding:0 14mm;color:%(N)s}
.bk2 .qr{flex:none;width:136mm;height:136mm}
.bk2 .tx{flex:1;min-width:0;display:grid;gap:7mm;justify-items:center;text-align:center}
.bk2 .tx .t{font-size:40mm;line-height:1.05}.bk2 .tx .t em{font-style:normal;color:%(G)s}
.bk2 .ph{justify-content:center;font-size:14mm}
.bk2 .stripe{background:linear-gradient(to left,%(O)s 0 30%%,%(N)s 30%%)}
''') % dict(N=N, G=G, O=O, C=C)
back2 = '''<div class="f bk2"><div class="hd2"><div class="emb">%s</div><b class="lz">متاجر أحد</b></div>
<div class="h lz">بقالتك في <em>جوالك</em></div>
<div class="card"><div class="qr">%s</div><div class="tx"><div class="t lz">امسح<br><em>واطلب</em></div>
<div class="ap"><span class="ai e">%s</span><span><small>حمّله من</small><b>App Store</b></span></div>
<div class="ph">☎ %s</div></div></div><i class="stripe"></i></div>''' % (EMB, qr_svg(N, '#FFFFFF'), APPLE, PHONE)
for n, b in [('box-back', back), ('box-back2', back2), ('box-side', side), ('box-top', top)]:
    open(n + '.html', 'w').write(page(W, H, CSS, b, 'صندوق الدباب · متاجر أحد'))
print('ok')
