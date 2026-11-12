"""معيار صور منتجات متاجر أحد (قرار المالك ١٣ نوفمبر ٢٠٢٦). كل صورة تنعالج بنفس الطريقة:
- مربع ١٠٠٠×١٠٠٠، خلفية بيضاء نقية.
- المنتج «واقف» على خط ثابت: الهامش تحت ٨٪، وفوقه مسافة أكبر (المنتج نازل تحت شوي مو بالنص).
- أكبر بُعد للمنتج: العرض لين ٨٤٪ والطول لين ٧٨٪ من المربع.
- ظل ناعم خفيف تحت المنتج.
- إضاءة موحدة: متوسط سطوع المنتج يتعدل لهدف ثابت (TARGET_L)، مع تباين وحدة خفيفة.
- فحص جودة: لو المنتج المقصوص صغير (أقل من ٤٥٠ بكسل) أو الصورة مهزوزة أو مظلمة كثير، تنعلّم «تحتاج إعادة تصوير».
الاستخدام: python process.py in.jpg out.jpg [--lid 0.55]   (يحتاج Pillow و rembg)"""
import sys, os, json
from PIL import Image, ImageFilter, ImageEnhance, ImageOps, ImageStat
from rembg import remove, new_session

LID = 1.0  # --lid 0.55 للعلب المصورة من فوق
BOX = False  # --box للكراتين: تعديل الزاوية لمستطيل مستقيم
HULL = False  # --hull للكراتين والعلب المستقيمة (القناع = الشكل الكامل)
S = 1000; BOTTOM = 0.14; MAX_W = 0.84; MAX_H = 0.78; TARGET_L = 165; MIN_PX = 450

def fix_mask(a):
    """يسد الفراغات داخل المنتج (مثل المربع الأبيض على علبة كيري)، ويخلي أكبر قطعة بس.
    مع --hull (للكراتين والعلب المستقيمة): القناع يصير الشكل المحدّب الكامل للمنتج."""
    import numpy as np
    from PIL import ImageDraw
    m = np.array(a) > 128
    # أكبر قطعة متصلة (تشيل بقايا الرف والخلفية المتفرقة)
    from collections import deque
    H, W = m.shape; lab = np.zeros((H, W), np.int32); best, bestn, cur = 0, 0, 0
    small = m[::4, ::4]; h, w = small.shape; lab = np.zeros((h, w), np.int32)
    for y in range(h):
        for x in range(w):
            if small[y, x] and not lab[y, x]:
                cur += 1; q = deque([(y, x)]); lab[y, x] = cur; n = 0
                while q:
                    cy, cx = q.popleft(); n += 1
                    for ny, nx in ((cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)):
                        if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not lab[ny, nx]: lab[ny, nx] = cur; q.append((ny, nx))
                if n > bestn: best, bestn = cur, n
    keep = np.kron(lab == best, np.ones((4, 4), bool))[:H, :W]
    m = m & np.pad(keep, ((0, max(0, H - keep.shape[0])), (0, max(0, W - keep.shape[1]))))
    if HULL:
        ys, xs = np.nonzero(m[::2, ::2]); pts = sorted(set(zip((xs * 2).tolist(), (ys * 2).tolist())))
        def cross(o, a_, b_): return (a_[0]-o[0])*(b_[1]-o[1]) - (a_[1]-o[1])*(b_[0]-o[0])
        lo, up = [], []
        for pt in pts:
            while len(lo) >= 2 and cross(lo[-2], lo[-1], pt) <= 0: lo.pop()
            lo.append(pt)
        for pt in reversed(pts):
            while len(up) >= 2 and cross(up[-2], up[-1], pt) <= 0: up.pop()
            up.append(pt)
        hull = Image.new('L', a.size, 0); ImageDraw.Draw(hull).polygon(lo[:-1] + up[:-1], fill=255)
        return Image.fromarray(np.minimum(np.array(hull), 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
    # سد الفراغات: كل شي ما يوصل للحافة من الخلفية يصير جزء من المنتج
    bg = ~m; seen = np.zeros_like(bg); q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if bg[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if bg[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)):
            if 0 <= ny < H and 0 <= nx < W and bg[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
    holes = bg & ~seen
    arr = np.array(a); arr[holes] = 255; arr[~(m | holes)] = 0
    return Image.fromarray(arr)

def box_quad(a):
    """أضلاع الكرتون الأربعة من حدود القناع: نقسم الحدود لأربع جهات ونرسم خط لكل جهة (أقل مربعات)، والزوايا = تقاطع الخطوط"""
    import numpy as np
    m = np.array(a) > 128; H, W = m.shape
    ys, xs = np.nonzero(m)
    if len(xs) < 1000: return None
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max(); cw, ch = x1 - x0, y1 - y0
    rows = np.arange(y0 + ch * 0.15, y1 - ch * 0.15, max(1, ch // 80)).astype(int)
    cols = np.arange(x0 + cw * 0.15, x1 - cw * 0.15, max(1, cw // 80)).astype(int)
    L = [(np.nonzero(m[y])[0].min(), y) for y in rows if m[y].any()]
    R = [(np.nonzero(m[y])[0].max(), y) for y in rows if m[y].any()]
    T = [(x, np.nonzero(m[:, x])[0].min()) for x in cols if m[:, x].any()]
    B = [(x, np.nonzero(m[:, x])[0].max()) for x in cols if m[:, x].any()]
    def fit(pts, vertical):
        P = np.array(pts, float)
        # خط متين: نشيل النقاط البعيدة (الزاوية الممسوحة) ونعيد
        for _ in range(3):
            if vertical: k, c = np.polyfit(P[:, 1], P[:, 0], 1); r = P[:, 0] - (k * P[:, 1] + c)
            else: k, c = np.polyfit(P[:, 0], P[:, 1], 1); r = P[:, 1] - (k * P[:, 0] + c)
            keep = np.abs(r) <= max(3, 2.0 * np.median(np.abs(r)) + 1)
            if keep.all() or keep.sum() < 6: break
            P = P[keep]
        return k, c
    l, r_, t, b = fit(L, True), fit(R, True), fit(T, False), fit(B, False)
    def cross(v, h):  # x = kv*y + cv ; y = kh*x + ch
        kv, cv = v; kh, chh = h; y = (kh * cv + chh) / (1 - kh * kv); return (kv * y + cv, y)
    return (cross(l, t), cross(r_, t), cross(r_, b), cross(l, b))

def persp_coeffs(dst_pts, src_pts):
    import numpy as np
    A = []; B = []
    for (x, y), (u, v) in zip(dst_pts, src_pts):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()

def lum(img, mask):
    return ImageStat.Stat(img.convert('L'), mask).mean[0]

def sharpness(img, mask):
    e = img.convert('L').filter(ImageFilter.FIND_EDGES)
    return ImageStat.Stat(e, mask).var[0]

def process(src, dst, sess):
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    im.thumbnail((2000, 2000))
    cut = remove(im, session=sess, alpha_matting=True, alpha_matting_foreground_threshold=240,
                 alpha_matting_background_threshold=20, alpha_matting_erode_size=8)
    a = cut.split()[-1].point(lambda v: 0 if v < 30 else v)
    a = fix_mask(a)
    cut = im.copy()  # الألوان من الصورة الأصلية (القص يبهّت الحواف)، والقناع من القص
    if BOX:
        # الكرتون: نلقى أضلاع الواجهة الأربعة (حتى لو زاوية ممسوحة) ونفردها لمستطيل، كأن الكاميرا قدّام نصه بالضبط
        quad = box_quad(a)
        if quad:
            (tl, tr, br, bl) = quad
            import math
            Wd = int((math.dist(tl, tr) + math.dist(bl, br)) / 2); Hd = int((math.dist(tl, bl) + math.dist(tr, br)) / 2)
            coeffs = persp_coeffs([(0, 0), (Wd, 0), (Wd, Hd), (0, Hd)], [tl, tr, br, bl])
            rgb0 = im.transform((Wd, Hd), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
            # القناع بعد التعديل، وكل عمود يتعبى من أول المنتج لين تحت (يرجّع الزوايا الممسوحة تحت ويخلي شكل الأعلى مثل الغطيان)
            import numpy as np
            am = np.array(a.transform((Wd, Hd), Image.PERSPECTIVE, coeffs, Image.BILINEAR)) > 128
            out = np.zeros((Hd, Wd), np.uint8)
            for x in range(Wd):
                col = np.nonzero(am[:, x])[0]
                if len(col): out[col.min():, x] = 255
            a = Image.fromarray(out).filter(ImageFilter.GaussianBlur(0.8))
            cut = rgb0; cut.putalpha(a); cut = cut.crop(a.getbbox())
            return finish(cut, a, dst, src)
    cut.putalpha(a); box = a.getbbox(); cut = cut.crop(box)
    return finish(cut, None, dst, src)

def finish(cut, _a, dst, src):
    # العلب والأسطوانات المصورة من فوق شوي: نضغط منطقة الغطاء (أعلى ٣٠٪) عمودياً فتبان مستقيمة قدّام الكاميرا
    if LID < 1:
        w0, h0 = cut.size; lid = int(h0 * 0.30)
        top = cut.crop((0, 0, w0, lid)).resize((w0, max(1, int(lid * LID))), Image.LANCZOS)
        n = Image.new('RGBA', (w0, h0 - lid + top.size[1]), (0, 0, 0, 0)); n.paste(top, (0, 0)); n.paste(cut.crop((0, lid, w0, h0)), (0, top.size[1])); cut = n
    a = cut.split()[-1]
    rgb = cut.convert('RGB')
    notes = []
    if max(cut.size) < MIN_PX: notes.append('المنتج صغير في الصورة: قرّب الكاميرا')
    mask = a.point(lambda v: 255 if v > 200 else 0)
    l0 = lum(rgb, mask); sh = sharpness(rgb, mask)
    if l0 < 60: notes.append('مظلمة كثير: زِد الإضاءة وقت التصوير')
    if sh < 150: notes.append('مو واضحة (مهزوزة أو بدون تركيز)')
    # إضاءة موحدة (برفق: من ٠٫٨٥ لين ١٫٤)
    # رفع الإضاءة بمنحنى (gamma) يرفع الدرجات المتوسطة والغامقة بدون ما يحرق الأبيض واللمعة
    import math
    k = max(0.85, min(1.4, TARGET_L / max(l0, 1)))
    g = max(0.5, min(1.15, math.log(TARGET_L / 255) / math.log(max(l0, 1) / 255)))
    lut = [round(255 * (i / 255) ** g) for i in range(256)]
    rgb = rgb.point(lut * 3)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.06)
    rgb = ImageEnhance.Color(rgb).enhance(1.06)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.4, percent=70, threshold=2))
    # المقاس والمكان
    w, h = cut.size; f = min(S * MAX_W / w, S * MAX_H / h)
    nw, nh = max(1, round(w * f)), max(1, round(h * f))
    rgb = rgb.resize((nw, nh), Image.LANCZOS); a = a.resize((nw, nh), Image.LANCZOS)
    x = (S - nw) // 2; y = S - round(S * BOTTOM) - nh
    # المنتج العريض القصير (علب، كراتين مسطحة) يرتفع لين يكون نازل عن النص شوي بس
    y = min(y, round((S - nh) / 2 + S * 0.04))
    bg = Image.new('RGB', (S, S), 'white')
    # ظل ناعم بيضاوي تحت المنتج
    sh_l = Image.new('L', (S, S), 0); from PIL import ImageDraw
    ImageDraw.Draw(sh_l).ellipse((x + nw * 0.08, y + nh - nh * 0.035, x + nw * 0.92, y + nh + nh * 0.05), fill=70)
    sh_l = sh_l.filter(ImageFilter.GaussianBlur(18))
    bg.paste(Image.new('RGB', (S, S), (150, 150, 150)), (0, 0), sh_l)
    rgb.putalpha(a); bg.paste(rgb, (x, y), rgb)
    bg.save(dst, quality=92)
    return {'file': os.path.basename(src), 'brightness_before': round(l0), 'gamma': round(g, 2), 'sharp': round(sh), 'size': max(w, h), 'notes': notes}

if __name__ == '__main__':
    args = sys.argv[1:]
    if '--lid' in args: i = args.index('--lid'); LID = float(args[i + 1]); del args[i:i + 2]
    if '--hull' in args: HULL = True; args.remove('--hull')
    if '--box' in args: BOX = True; HULL = True; args.remove('--box')
    sess = new_session(os.environ.get('MODEL', 'isnet-general-use'))
    print(json.dumps(process(args[0], args[1], sess), ensure_ascii=False))
