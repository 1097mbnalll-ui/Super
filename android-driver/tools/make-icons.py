# يولّد أيقونات التطبيق من أيقونات المندوب الموجودة في الموقع. التشغيل: python3 tools/make-icons.py
import os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); SITE = os.path.dirname(ROOT)
RES = os.path.join(ROOT, "res")
NAVY = (19, 33, 60)
dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
full = Image.open(os.path.join(SITE, "driver-512.png")).convert("RGB")
mask = Image.open(os.path.join(SITE, "driver-maskable-512.png")).convert("RGB")
for d, k in dens.items():
    # أيقونة قديمة (قبل أندرويد ٨): مربعة بزوايا مدوّرة
    s = int(48 * k); im = full.resize((s, s), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", (s, s), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, s - 1, s - 1), int(s * 0.2), fill=255); im.putalpha(m)
    im.save(f"{RES}/mipmap-{d}/ic_launcher.png")
    # أيقونة دائرية
    r = full.resize((s, s), Image.LANCZOS).convert("RGBA"); m = Image.new("L", (s, s), 0); ImageDraw.Draw(m).ellipse((0, 0, s - 1, s - 1), fill=255); r.putalpha(m)
    r.save(f"{RES}/mipmap-{d}/ic_launcher_round.png")
    # الطبقة الأمامية للأيقونة التكيفية: ١٠٨dp، والمحتوى داخل المنطقة الآمنة (٦٦٪)
    L = int(108 * k); fg = Image.new("RGB", (L, L), NAVY); inner = int(L * 0.72)
    fg.paste(mask.resize((inner, inner), Image.LANCZOS), ((L - inner) // 2, (L - inner) // 2)); fg.save(f"{RES}/mipmap-{d}/ic_launcher_fg.png")
    # أيقونة الإشعار: شاحنة بيضاء على شفاف (٢٤dp)
    S = 96; g = Image.new("RGBA", (S, S), (0, 0, 0, 0)); p = ImageDraw.Draw(g); W = (255, 255, 255, 255)
    p.rounded_rectangle((8, 26, 56, 62), 5, fill=W)                    # صندوق الشاحنة
    p.polygon([(60, 36), (76, 36), (88, 50), (88, 62), (60, 62)], fill=W)  # الكابينة
    p.polygon([(66, 41), (74, 41), (82, 50), (66, 50)], fill=(0, 0, 0, 0))  # الزجاج
    for cx in (28, 74): p.ellipse((cx - 10, 54, cx + 10, 74), fill=(0, 0, 0, 0)); p.ellipse((cx - 7, 57, cx + 7, 71), fill=W)
    t = int(24 * k); g.resize((t, t), Image.LANCZOS).save(f"{RES}/drawable-{d}/ic_stat.png")
print("icons ok")
