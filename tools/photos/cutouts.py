"""صور البنرات بدون خلفية (طلب المالك ١٣ نوفمبر ٢٠٢٦ «الموقع ثقيل»): بدل ما جوال الزبون يقص الخلفية البيضاء وقت الفتح،
نجهّزها هنا مرة وحدة: pc/<id>.webp (شفافة) للمنتجات اللي تطلع في البنرات (العروض، المجموعات، «قريباً»، الأشهر)، ونحط pc:1 على المنتج.
الاستخدام: python3 tools/photos/cutouts.py data.json   (يحتاج Pillow و numpy)"""
import sys, os, json, numpy as np
from collections import deque
from PIL import Image, ImageFilter
root = os.path.dirname(os.path.abspath(sys.argv[1])); d = json.load(open(sys.argv[1], encoding='utf-8'))
P = [p for p in d['products'] if str(p.get('img', '')).startswith('p/')]
isoff = lambda p: p.get('old') is not None or any(isinstance(k, dict) and k.get('price') for k in p.get('packs', []))
want = {p['id'] for p in P if isoff(p) or p.get('soon')}
for g in d['store'].get('groups', []): want |= set(g.get('ids', []))
for sub in ('chips', 'soft'): want |= {p['id'] for p in sorted([p for p in P if p.get('sub') == sub and p.get('stock')], key=lambda p: -p.get('rk', 0))[:12]}
for c in d['cats']: want |= {p['id'] for p in sorted([p for p in P if p['cat'] == c['id'] and p.get('stock')], key=lambda p: -p.get('rk', 0))[:6]}
os.makedirs(os.path.join(root, 'pc'), exist_ok=True); made = kept = 0
for p in P:
    if p['id'] not in want: p.pop('pc', None); continue
    src = os.path.join(root, p['img']); out = os.path.join(root, 'pc', p['id'] + '.webp')
    if not os.path.exists(src): p.pop('pc', None); continue
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src): p['pc'] = 1; kept += 1; continue
    im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(int); H, W = a.shape[:2]
    light = (a.min(axis=2) > 228) & (a.max(axis=2) - a.min(axis=2) < 28); bg = np.zeros((H, W), bool); q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if light[y, x] and not bg[y, x]: bg[y, x] = 1; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if light[y, x] and not bg[y, x]: bg[y, x] = 1; q.append((y, x))
    while q:
        y, x = q.popleft()
        for c2, e in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= c2 < H and 0 <= e < W and light[c2, e] and not bg[c2, e]: bg[c2, e] = 1; q.append((c2, e))
    if bg.sum() < H * W * 0.08: p.pop('pc', None); continue  # ما فيها خلفية بيضاء تنقص (صورة رف مثلاً): تبقى بإطار أبيض
    al = Image.fromarray(((~bg) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    o = im.convert('RGBA'); o.putalpha(al); o = o.crop(o.getbbox() or (0, 0, W, H)); o.save(out, 'WEBP', quality=82, method=6); p['pc'] = 1; made += 1
open(sys.argv[1], 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
print('صور بنرات مقصوصة:', made, 'جديدة ·', kept, 'موجودة · المطلوب', len(want))
