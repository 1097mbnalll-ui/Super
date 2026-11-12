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
S = 1000; BOTTOM = 0.14; MAX_W = 0.84; MAX_H = 0.78; TARGET_L = 150; MIN_PX = 450

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
    cut.putalpha(a); box = a.getbbox(); cut = cut.crop(box)
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
    g = max(0.6, min(1.15, math.log(TARGET_L / 255) / math.log(max(l0, 1) / 255)))
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
    sess = new_session('isnet-general-use')
    print(json.dumps(process(args[0], args[1], sess), ensure_ascii=False))
