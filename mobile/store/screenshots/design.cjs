// صور المتجر التسويقية: ١٢٩٠×٢٧٩٦ (آيفون 6.9")
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const here = __dirname, shots = process.argv[2] || path.join(here, 'raw'), outDir = process.argv[3] || path.join(here, 'out');
fs.mkdirSync(outDir, { recursive: true });
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const logo = b64(path.join(here, '..', '..', '..', 'icon-512.png'));

const slides = [
  { f: '1-home', theme: 'green', kicker: 'متاجر أحد · حي الرمال', h: 'بقالتك<br>صارت في جوالك', p: 'اطلب مقاضيك ويوصلك الطلب لين بابك', chip: '+٧٬٧٠٠ منتج' },
  { f: '2-cats', theme: 'cream', kicker: 'كل اللي تحتاجه', h: 'كل أقسام البقالة<br>في مكان واحد', p: 'ألبان، مخبوزات، مشروبات، منظفات وأكثر', chip: 'مخبز ومقاضي البيت' },
  { f: '3-category', theme: 'orange', kicker: 'تصفّح بسهولة', h: 'شوف المنتج<br>قبل لا تطلبه', p: 'صورة واضحة وسعر واضح لكل منتج', chip: 'بحث سريع بالاسم' },
  { f: '4-product', theme: 'cream', kicker: 'تفاصيل كاملة', h: 'كل التفاصيل<br>بلمسة وحدة', p: 'واقتراحات تكمّل فيها سلتك', chip: 'حبة · شدّة · كرتون' },
  { f: '5-cart', theme: 'navy', kicker: 'وصلنا لك', h: 'توصيل مجاني<br>فوق ٣٠ ريال', p: 'وادفع عند الاستلام كاش أو شبكة', chip: 'كاش أو شبكة' },
];
const T = {
  green:  { bg: 'linear-gradient(160deg,#0E9F7B 0%,#0B8467 60%,#086650 100%)', h: '#FFFFFF', p: 'rgba(255,255,255,.86)', k: '#FFD9B0', chipBg: '#FF8A1F', chipFg: '#FFFFFF', blob1: 'rgba(255,255,255,.09)', blob2: 'rgba(255,138,31,.30)' },
  cream:  { bg: 'linear-gradient(170deg,#FBF6EC 0%,#F6EBD6 100%)', h: '#13213C', p: '#4E5870', k: '#0E9F7B', chipBg: '#0E9F7B', chipFg: '#FFFFFF', blob1: 'rgba(14,159,123,.16)', blob2: 'rgba(255,138,31,.18)' },
  orange: { bg: 'linear-gradient(160deg,#FF9A3C 0%,#FF8A1F 55%,#F06F00 100%)', h: '#FFFFFF', p: 'rgba(255,255,255,.9)', k: '#13213C', chipBg: '#13213C', chipFg: '#FFFFFF', blob1: 'rgba(255,255,255,.18)', blob2: 'rgba(19,33,60,.12)' },
  navy:   { bg: 'linear-gradient(160deg,#1B2D52 0%,#13213C 60%,#0C1528 100%)', h: '#FFFFFF', p: 'rgba(255,255,255,.82)', k: '#FF8A1F', chipBg: '#0E9F7B', chipFg: '#FFFFFF', blob1: 'rgba(14,159,123,.30)', blob2: 'rgba(255,138,31,.22)' },
};
const html = (s) => { const t = T[s.theme]; return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Lalezar&family=Readex+Pro:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:430px;height:932px;overflow:hidden}
body{background:${t.bg};font-family:"Readex Pro",sans-serif;position:relative}
.blob{position:absolute;border-radius:50%;filter:blur(2px)}
.b1{width:420px;height:420px;background:${t.blob1};top:-150px;left:-170px}
.b2{width:360px;height:360px;background:${t.blob2};bottom:120px;right:-200px}
.dots{position:absolute;top:34px;left:26px;width:90px;height:60px;background-image:radial-gradient(${t.k} 2px,transparent 2.5px);background-size:14px 14px;opacity:.35}
.head{position:absolute;top:58px;right:30px;left:30px;text-align:right}
.brand{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:15px;color:${t.k};letter-spacing:.2px}
.brand img{width:30px;height:30px;border-radius:9px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
h1{font-family:"Lalezar",sans-serif;font-weight:400;font-size:47px;line-height:1.18;color:${t.h};margin-top:14px}
p{font-size:17px;line-height:1.6;color:${t.p};margin-top:8px;font-weight:400}
.phone{position:absolute;left:50%;transform:translateX(-50%);top:318px;width:292px;height:633px;border-radius:44px;background:#0F1729;padding:9px;box-shadow:0 30px 60px rgba(8,16,32,.35),0 0 0 1.5px rgba(255,255,255,.18)}
.phone .scr{width:100%;height:100%;border-radius:36px;overflow:hidden;position:relative;background:#fff}
.phone .scr img{width:100%;display:block}
.sb{height:42px;display:flex;align-items:center;justify-content:space-between;padding:6px 26px 0;direction:ltr;font:600 14px -apple-system,'Readex Pro',sans-serif;color:#13213C}
.sb .bat{width:24px;height:11px;border:1.5px solid #13213C;border-radius:3.5px;position:relative;opacity:.9}.sb .bat:after{content:'';position:absolute;inset:1.5px;right:5px;background:#13213C;border-radius:1.5px}
.sb .sig{display:flex;gap:2px;align-items:flex-end;margin-right:6px}.sb .sig i{width:3px;background:#13213C;border-radius:1px}
.island{position:absolute;top:18px;left:50%;transform:translateX(-50%);width:84px;height:24px;border-radius:14px;background:#0F1729;z-index:2}
.chip{position:absolute;top:300px;left:22px;z-index:3;background:${t.chipBg};color:${t.chipFg};font-weight:700;font-size:15px;padding:10px 16px;border-radius:999px;box-shadow:0 10px 24px rgba(0,0,0,.22);transform:rotate(-6deg)}
</style></head><body>
<div class="blob b1"></div><div class="blob b2"></div><div class="dots"></div>
<div class="head"><span class="brand"><img src="${logo}">${s.kicker}</span><h1>${s.h}</h1><p>${s.p}</p></div>
<div class="chip">${s.chip}</div>
<div class="phone"><div class="island"></div><div class="scr"><div class="sb"><span>9:41</span><span style="display:flex;align-items:center"><span class="sig"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:10px"></i></span><span class="bat"></span></span></div><img src="${b64(path.join(shots, s.f + '.png'))}"></div></div>
</body></html>`; };

(async () => {
  const br = await chromium.launch();
  const pg = await br.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
  for (const [i, s] of slides.entries()) {
    await pg.setContent(html(s), { waitUntil: 'networkidle' });
    await pg.evaluate(async () => { const im = document.querySelector('.scr img'); await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = 8; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(c.width - 6, 3, 1, 1).data; document.querySelector('.scr').style.background = `rgb(${d[0]},${d[1]},${d[2]})`; });
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(400);
    const f = path.join(outDir, `ohod-${i + 1}.png`);
    await pg.screenshot({ path: f });
    console.log(f, await pg.evaluate(() => [...document.fonts].filter(x => x.status === 'loaded').map(x => x.family).join(',')));
  }
  await br.close();
})();
