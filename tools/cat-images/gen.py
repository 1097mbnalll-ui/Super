# يحوّل PNG إلى WebP صغير: python3 -I tools/cat-images/gen.py <مجلد-PNG> <مجلد-الإخراج>
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True); tot = 0
for f in sorted(os.listdir(src)):
    if not f.endswith(".png"): continue
    im = Image.open(os.path.join(src, f)).convert("RGB"); out = os.path.join(dst, f[:-4] + ".webp")
    im.save(out, "WEBP", quality=72, method=6); n = os.path.getsize(out); tot += n; print(f[:-4], n, "بايت")
print("المجموع", tot, "بايت")
