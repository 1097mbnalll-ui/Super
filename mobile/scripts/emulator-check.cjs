// فحص التطبيق على محاكي أندرويد (يشتغل في GitHub Actions): يتصل بالـ WebView عبر DevTools مباشرة،
// يتأكد إن المحتوى ما ينغطى بشريط الحالة/التنقل، يقيس سلاسة التمرير، ويصوّر الشاشات.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const out = process.argv[2] || 'emu-out';
const sh = (c) => execSync(c, { encoding: 'utf8' });
const shot = (n) => fs.writeFileSync(`${out}/${n}.png`, execSync('adb exec-out screencap -p', { maxBuffer: 64 * 1024 * 1024 }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// صفحة CDP صغيرة: evaluate(fn, arg) زي Playwright
async function connect() {
  const list = await (await fetch('http://127.0.0.1:9222/json')).json();
  const t = list.find((x) => x.type === 'page' && /^(https?|capacitor):/.test(x.url)) || list[0];
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  return { url: () => t.url, close: () => ws.close(), list: async () => (await (await fetch('http://127.0.0.1:9222/json')).json()).map((x) => x.url),
    evaluate: async (fn, arg) => { const d = await send('Runtime.evaluate', { expression: `(${fn})(${JSON.stringify(arg)})`, awaitPromise: true, returnByValue: true });
      if (d.result && d.result.exceptionDetails) throw new Error(JSON.stringify(d.result.exceptionDetails).slice(0, 400)); return d.result && d.result.result && d.result.result.value; } };
}
(async () => {
  const report = {};
  const page = await connect();
  report.url = page.url();
  const dens = parseFloat((sh('adb shell wm density').match(/(\d+)\s*$/) || [, '420'])[1]) / 160;
  const sz = sh('adb shell wm size').match(/(\d+)x(\d+)/);
  report.screenPx = sz && [ +sz[1], +sz[2] ]; report.density = dens;
  report.env = await page.evaluate(() => {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;padding:var(--sa-top) var(--sa-right) var(--sa-bottom) var(--sa-left)';
    document.body.appendChild(p); const cs = getComputedStyle(p);
    p.style.padding = 'env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)'; const envTop = getComputedStyle(p).paddingTop, envBottom = getComputedStyle(p).paddingBottom;
    p.style.padding = 'var(--safe-area-inset-top,0px) 0 var(--safe-area-inset-bottom,0px)'; const capTop = getComputedStyle(p).paddingTop, capBottom = getComputedStyle(p).paddingBottom;
    p.style.cssText = 'position:fixed;padding:var(--sa-top) var(--sa-right) var(--sa-bottom) var(--sa-left)';
    const r = { envTop, envBottom, capTop, capBottom, top: cs.paddingTop, bottom: cs.paddingBottom, left: cs.paddingLeft, right: cs.paddingRight }; p.remove();
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
  for (const [id, name] of [['cats', '03-categories'], ['more', '05-account']]) {
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
  report.pages = await page.list();
  // السلة آخر شي (شاشة السلة ما فيها شريط تبويبات)
  await page.evaluate(() => { location.href = './'; }); await wait(3000);
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-nav="cart"]')].pop(); if (b) b.click(); }); await wait(1500); shot('04-cart');
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  const bad = []; if (!report.account.deleteLink) bad.push('delete link missing'); if (!report.bottomCheck.linkClear) bad.push('content hidden behind tab bar'); if (!report.env.native) bad.push('not in native mode'); if (report.env.adminVisible) bad.push('admin visible');
  report.problems = bad; fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); if (bad.length) { console.error('PROBLEMS:', bad.join('; ')); process.exitCode = 2; }
  console.log(JSON.stringify(report, null, 2));
  page.close();
})().catch((e) => { console.error('FAIL', e); try { shot('99-error'); } catch {} process.exit(1); });
