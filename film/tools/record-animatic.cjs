// يسجّل فيديو من صفحة الستوري بورد وهي تشتغل بالتوقيت الحقيقي: الصورة + النص على الشاشة. بدون صوت ولا موسيقى.
// التشغيل: python3 -m http.server 8788 --directory .  ثم  node film/tools/record-animatic.cjs film|sales <مجلد الإخراج>
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path');
const kind = process.argv[2] === 'sales' ? 'sales' : 'film', outDir = path.resolve(process.argv[3] || '.');
const total = kind === 'sales' ? 90 : 220;
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
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8788/film/index.html#' + kind); await page.waitForTimeout(1500);
  await page.addStyleTag({ content: css }); await page.waitForTimeout(400);
  await page.evaluate(() => { document.getElementById('play').click(); });
  await page.waitForTimeout((total + 3) * 1000);
  const v = page.video(); await ctx.close(); await browser.close();
  const src = await v.path(), dst = path.join(outDir, kind + '-animatic.webm'); fs.renameSync(src, dst); console.log('saved', dst);
})().catch((e) => { console.error(e); process.exit(1); });
