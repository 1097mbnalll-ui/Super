// فحص التطبيق على محاكي أندرويد (يشتغل في GitHub Actions): يتصل بالـ WebView عبر DevTools،
// يتأكد إن المحتوى ما ينغطى بشريط الحالة/التنقل، يقيس سلاسة التمرير، ويصوّر الشاشات.
const { chromium } = require('playwright-core');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const out = process.argv[2] || 'emu-out';
const sh = (c) => execSync(c, { encoding: 'utf8' });
const shot = (n) => fs.writeFileSync(`${out}/${n}.png`, execSync('adb exec-out screencap -p'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const report = {};
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages().find((p) => !p.url().startsWith('devtools')) || browser.contexts()[0].pages()[0];
  report.url = page.url();
  const dens = parseFloat((sh('adb shell wm density').match(/(\d+)\s*$/) || [, '420'])[1]) / 160;
  const sz = sh('adb shell wm size').match(/(\d+)x(\d+)/);
  report.screenPx = sz && [ +sz[1], +sz[2] ]; report.density = dens;
  report.env = await page.evaluate(() => {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;padding:var(--sa-top) var(--sa-right) var(--sa-bottom) var(--sa-left)';
    document.body.appendChild(p); const cs = getComputedStyle(p);
    const r = { top: cs.paddingTop, bottom: cs.paddingBottom, left: cs.paddingLeft, right: cs.paddingRight }; p.remove();
    const nav = [...document.querySelectorAll('[data-nav="more"]')].pop();
    const nb = nav && nav.closest('nav,div').getBoundingClientRect();
    return { insets: r, innerH: innerHeight, innerW: innerWidth, htmlClass: document.documentElement.className,
      platform: window.Capacitor && Capacitor.getPlatform && Capacitor.getPlatform(), native: !!window.__NATIVE_STORE__,
      tabBarBottom: nb && nb.bottom, tabBarTop: nb && nb.top,
      ua: navigator.userAgent, adminVisible: !!document.querySelector('[data-nav="admin"],#adminBtn:not([hidden])') };
  });
  shot('01-home');
  // سلاسة التمرير: نعدّ الإطارات ونقيس الإطارات المتأخرة أثناء تمرير بالإصبع (adb swipe)
  await page.evaluate(() => { window.__fr = []; let last = performance.now(); const f = (t) => { window.__fr.push(t - last); last = t; if (window.__fr.length < 2000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const [w, h] = report.screenPx || [1080, 2400];
  for (let i = 0; i < 6; i++) { sh(`adb shell input swipe ${w / 2} ${h * 0.75} ${w / 2} ${h * 0.3} 250`); await wait(350); }
  shot('02-scrolled');
  for (let i = 0; i < 6; i++) { sh(`adb shell input swipe ${w / 2} ${h * 0.3} ${w / 2} ${h * 0.75} 250`); await wait(350); }
  report.scroll = await page.evaluate(() => { const a = window.__fr.slice(2); window.__fr = a.slice(0, 0); const n = a.length, avg = a.reduce((s, x) => s + x, 0) / n;
    return { frames: n, avgMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), over33ms: a.filter((x) => x > 33.4).length, over50ms: a.filter((x) => x > 50).length, worstMs: +Math.max(...a).toFixed(1) }; });
  // تبويبات: الأقسام، العروض، السلة، حسابي
  for (const [id, name] of [['cats', '03-categories'], ['cart', '04-cart'], ['more', '05-account']]) {
    await page.evaluate((id) => { const b = [...document.querySelectorAll(`[data-nav="${id}"]`)].pop(); if (b) b.click(); }, id);
    await wait(1500); shot(name);
  }
  report.account = await page.evaluate(() => ({ deleteLink: !!document.querySelector('a[href="delete-data.html"]'), privacyLink: !!document.querySelector('a[href="privacy.html"]') }));
  // آخر عنصر بالصفحة لازم يبان فوق شريط التبويبات (ما ينغطى)
  report.bottomCheck = await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); return new Promise((r) => setTimeout(() => {
    const a = document.querySelector('a[href="delete-data.html"]'); const nav = [...document.querySelectorAll('[data-nav="more"]')].pop();
    const ar = a && a.getBoundingClientRect(), nr = nav && nav.getBoundingClientRect();
    r({ linkBottom: ar && ar.bottom, tabTop: nr && nr.top, innerH: innerHeight, linkClear: !!(ar && nr && ar.bottom <= nr.top) }); }, 800)); });
  shot('07-account-bottom');
  await page.evaluate(() => { const a = document.querySelector('a[href="delete-data.html"]'); if (a) a.click(); });
  await wait(2500); shot('08-delete-data');
  report.deletePage = await browser.contexts()[0].pages().map((p) => p.url());
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close().catch(() => {});
})().catch((e) => { console.error('FAIL', e); try { shot('99-error'); } catch {} process.exit(1); });
