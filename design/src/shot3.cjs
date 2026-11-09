const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const mm = 96/25.4;
  for (const n of ['card','card-front','card-back']) {
    const p = await b.newPage({ viewport: { width: Math.round(96*mm), height: Math.round(96*mm) }, deviceScaleFactor: 8 });
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto('file://' + process.cwd() + '/' + n + '.html'); await p.waitForSelector('body[data-ready="1"]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => [...document.querySelectorAll('.cd')].map(cd => { const R = cd.getBoundingClientRect(), m = 9*96/25.4;
      return [...cd.querySelectorAll('.in *')].filter(e => !e.closest('svg')).filter(e => { const x = e.getBoundingClientRect(); return x.width && (x.left < R.left+m-1 || x.right > R.right-m+1 || x.top < R.top+m-1 || e.scrollWidth > e.clientWidth+1); }).map(e => e.className||e.tagName); }));
    if (n !== 'card') await p.screenshot({ path: n + '.png' });
    await p.pdf({ path: n + '.pdf', width: '96mm', height: '96mm', printBackground: true });
    console.log(n, JSON.stringify(r)); await p.close(); }
  await b.close(); })();
