// يحوّل وجوه صندوق الدباب لـ PDF بالمقاس الحقيقي (٤٥×٤٥ سم) وصور معاينة، ويتحقق إن ما فيه كلام طالع برا الوجه
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const mm = 96 / 25.4;
  for (const n of ['box-back', 'box-side', 'box-top']) {
    const p = await b.newPage({ viewport: { width: Math.round(450 * mm), height: Math.round(450 * mm) }, deviceScaleFactor: 1.2 });
    p.on('pageerror', (e) => console.log('ERR', e.message));
    await p.goto('file://' + process.cwd() + '/' + n + '.html'); await p.waitForSelector('body[data-ready="1"]'); await p.waitForTimeout(400);
    const over = await p.evaluate(() => { const R = document.querySelector('.f').getBoundingClientRect(), m = 15 * 96 / 25.4;
      return [...document.querySelectorAll('.f *')].filter((e) => !e.closest('svg') && !e.classList.contains('stripe') && !e.classList.contains('hd')).filter((e) => { const x = e.getBoundingClientRect(); return x.width && (x.left < R.left + m - 1 || x.right > R.right - m + 1 || x.top < R.top - 1 || x.bottom > R.bottom + 1 || e.scrollWidth > e.clientWidth + 1); }).map((e) => (e.className || e.tagName) + ''); });
    await p.screenshot({ path: n + '.png' });
    await p.pdf({ path: n + '.pdf', width: '450mm', height: '450mm', printBackground: true });
    console.log(n, 'outside:', JSON.stringify(over)); await p.close(); }
  await b.close(); })();
