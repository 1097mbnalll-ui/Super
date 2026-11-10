// يسجّل فيديو من صفحة الستوري بورد (ويحفظ لحظة الضغط على تشغيل في <kind>-offset.json عشان تنقص بداية الفيديو قبل دمج الصوت) وهي تشتغل بالتوقيت الحقيقي: الصورة + النص على الشاشة. بدون صوت ولا موسيقى.
// التشغيل: python3 -m http.server 8788 --directory .  ثم  node film/tools/record-animatic.cjs film|sales <مجلد الإخراج>
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path');
const kind = process.argv[2] === 'sales' ? 'sales' : 'film', outDir = path.resolve(process.argv[3] || '.');
const size = kind === 'sales' ? { width: 540, height: 960 } : { width: 1280, height: 720 };
const css = `
 .wrap>*:not(.room),.room>*:not(.stagebox),.stagebox>*:not(.frame-holder),footer,.top{display:none!important}
 body{background:#000!important}.wrap{max-width:none!important;padding:0!important}
 .stagebox{padding:0!important;border:0!important;background:#000!important;border-radius:0!important;display:block!important}
 .frame-holder{padding:0!important}
 .frame,.frame.tall{width:100vw!important;max-width:100vw!important;height:100vh!important;aspect-ratio:auto!important;border-radius:0!important}
 .frame .sub{font-size:max(16px,${kind === 'sales' ? '5.4' : '2.6'}cqw)!important}
 ::-webkit-scrollbar{display:none}`;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, locale: 'ar-SA', recordVideo: { dir: outDir, size } });
  const page = await ctx.newPage(); const t0 = Date.now();
  await page.goto('http://127.0.0.1:8788/film/index.html#' + kind); await page.waitForTimeout(1500);
  await page.addStyleTag({ content: css }); await page.waitForTimeout(400);
  // المدة الكاملة من عدّاد الصفحة (مثل «0:00 / 1:46»)
  const total = await page.evaluate(() => { const m = document.getElementById('clock').textContent.split('/')[1].trim().split(':'); return Number(m[0]) * 60 + Number(m[1]) + 1; });
  const playedAt = (Date.now() - t0) / 1000;
  await page.evaluate(() => { document.getElementById('play').click(); });
  await page.waitForTimeout((total + 2) * 1000);
  fs.writeFileSync(path.join(outDir, kind + '-offset.json'), JSON.stringify({ playedAt, total }));
  const v = page.video(); await ctx.close(); await browser.close();
  const src = await v.path(), dst = path.join(outDir, kind + '-animatic.webm'); fs.renameSync(src, dst); console.log('saved', dst);
})().catch((e) => { console.error(e); process.exit(1); });
