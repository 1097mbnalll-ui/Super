// يصوّر شاشات التطبيق (وضع التطبيق الأصلي) من نسخة المستودع. شغّل أول: python3 -m http.server 8765 من جذر المستودع
// node capture.cjs <مجلد الصور الخام>
const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, locale: 'ar-SA', isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    window.__NATIVE_STORE__ = true; window.__SITE__ = 'http://127.0.0.1:8765/'; window.__FCM__ = false;
    window.Capacitor = { getPlatform: () => 'ios', Plugins: { PushNotifications: { requestPermissions(){ return Promise.resolve({receive:'prompt'}); }, register(){}, addListener(){}, removeAllListeners(){} } } };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' }).catch(()=>{});
  await p.waitForTimeout(3000);
  const shot = async (n) => { await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n, await p.evaluate(() => document.body.getAttribute('data-screen'))); };
  await shot('1-home');
  await p.click('[data-nav="cats"]'); await shot('2-cats');
  await p.click('[data-opencat="dairy"]').catch(e=>console.log('nocat', e.message)); await shot('3-category');
  const ids = await p.$$eval('article.kq-card:not(.out)', a => a.map(x => x.getAttribute('data-open')).slice(0, 8));
  for (const [i, id] of ids.entries()) { const n = i < 3 ? 2 : 1; for (let k = 0; k < n; k++) { await p.click(`[data-act="inc"][data-id="${id}"]`).catch(()=>{}); await p.waitForTimeout(250); } }
  await shot('3b-category-added');
  await p.click(`article[data-open="${ids[2]}"] .kq-img`).catch(e=>console.log('noprod', e.message));
  await shot('4-product');
  await p.click('[data-nav="back"]').catch(()=>{}); await p.waitForTimeout(500);
  await p.click('[data-nav="cart"]').catch(e=>console.log('nocart', e.message)); await shot('5-cart');
  console.log('errors', errs.slice(0,5));
  await b.close();
})();
