const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1800, height: 1800 } });
  p.on('console', (m) => console.log('C', m.text())); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:8811/boxonly.html'); await p.waitForSelector('body[data-ready="1"]', { timeout: 60000 }).catch(() => console.log('no ready')); await p.waitForTimeout(1500);
  await p.screenshot({ path: 'boxonly.png' }); await b.close(); })();
