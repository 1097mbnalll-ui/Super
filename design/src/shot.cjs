const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const errs = []; const mm = 96 / 25.4;
  for (const [n, w, h] of [['banner', 3000, 1000], ['stand-1', 850, 2000], ['stand-2', 850, 2000]]) {
    const p = await b.newPage({ viewport: { width: Math.round(w * mm), height: Math.round(h * mm) }, deviceScaleFactor: 0.25 }); p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + process.cwd() + '/' + n + '.html'); await p.waitForSelector('body[data-ready="1"]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const root = document.body.firstElementChild.getBoundingClientRect();
      const bad = [...document.querySelectorAll('body *')].filter(e => !e.closest('svg') && e.getBoundingClientRect().width && (e.scrollWidth > e.clientWidth + 2 || e.getBoundingClientRect().bottom > root.bottom + 1 || e.getBoundingClientRect().left < root.left - 1 || e.getBoundingClientRect().right > root.right + 1) && !e.classList.contains('rib')).map(e => e.className || e.tagName);
      const q = document.querySelector('.qr svg').getBoundingClientRect(); return { bad: bad.slice(0, 6), qrCm: Math.round(q.width / (96 / 25.4) / 10) }; });
    await p.screenshot({ path: n + '.png' });
    await p.pdf({ path: n + '.pdf', width: w + 'mm', height: h + 'mm', printBackground: true });
    console.log(n, JSON.stringify(r)); await p.close(); }
  console.log('errors', JSON.stringify(errs)); await b.close(); })();
