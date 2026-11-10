// يلتقط لقطات الفيلم من الواجهة الحقيقية (index.html بدون أي تعديل) على خادم العرض المحلي.
// التشغيل:  node film/tools/demo-server.mjs   ثم في نافذة ثانية:  node film/tools/capture.cjs
// الصور تنحفظ PNG في film/shots/raw (PREFIX=n- مع NEUTRAL=1 في خادم العرض = نسخة بلا اسم المتجر) ثم تتحول webp بـ film/tools/pack-shots.py
// LEAFLET_DIR = مجلد dist حق leaflet (npm i leaflet) لو الشبكة ما توصل unpkg.
// لو خرائط OpenStreetMap محجوبة تنحط بدالها خلفية محايدة: أعد التقاط لقطات الخريطة من شبكة مفتوحة قبل المونتاج.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path');
const out = path.resolve(__dirname, '../shots/raw'), base = 'http://127.0.0.1:' + (process.env.PORT || 8788), site = 'https://1097mbnalll-ui.github.io/Super/';
const only = (process.env.ONLY || '').split(',').filter(Boolean), want = (k) => !only.length || only.includes(k);
const leaflet = process.env.LEAFLET_DIR || '';
// سلة مختارة: منتجات صورها واضحة بس (بعض المنتجات بدون صورة أو صورتها ضعيفة، ما نعتمد عليها في التصوير)
const CART = { x6281007032261: 2, x6281007041379: 2, x3073786155186: 1, x6281014402200: 1, x6271002270119: 2, x6281014800426: 2, x7622201764555: 2, x6281026164004: 3, x7893000469815: 1 };
const tile = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#F2EFE9"/><path d="M0 64H256M0 192H256M96 0V256M208 0V256" stroke="#fff" stroke-width="9"/><path d="M0 128H256M32 0V256M152 0V256" stroke="#fff" stroke-width="4"/><rect x="108" y="76" width="34" height="42" rx="4" fill="#E4EBD9"/><rect x="42" y="140" width="44" height="40" rx="4" fill="#EAE6DD"/></svg>';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const mk = async (w, h, scale) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale || 2, locale: 'ar-SA', timezoneId: 'Asia/Riyadh', geolocation: { latitude: 24.8452, longitude: 46.8125 }, permissions: ['geolocation', 'notifications'] });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('ohod-sp', '1'); } catch (e) {} });
    await ctx.route('**/*', async (route) => {
      const req = route.request(), url = new URL(req.url());
      if (url.hostname === '127.0.0.1' || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return route.continue();
      // الصفحة تحمّل data.json بس لو العنوان github.io، فنفتحها بعنوانها الحقيقي ونخدمها من الخادم المحلي
      if (url.hostname.endsWith('.github.io')) { const res = await fetch(base + url.pathname.replace(/^\/Super/, '') + url.search); return route.fulfill({ status: res.status, contentType: res.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await res.arrayBuffer()) }); }
      if (url.hostname.endsWith('workers.dev')) {
        const res = await fetch(base + url.pathname, { method: req.method(), headers: { 'content-type': 'application/json' }, body: req.method() === 'POST' ? req.postData() : undefined });
        return route.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: await res.text() });
      }
      if (url.hostname === 'unpkg.com' && leaflet) { const f = path.join(leaflet, path.basename(url.pathname)); if (fs.existsSync(f)) return route.fulfill({ path: f }); }
      if (url.hostname.endsWith('tile.openstreetmap.org')) return route.fulfill({ contentType: 'image/svg+xml', body: tile });
      return route.abort();
    });
    return ctx;
  };
  const snap = async (page, name, opts) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(out, (process.env.PREFIX || '') + name + '.png'), ...(opts || {}) }); console.log('shot', name); };
  const api = async (p, body) => (await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  const live = (await (await fetch(base + '/__live')).json()).live;
  const staffIn = async (ctx, pin) => { const page = await ctx.newPage(); page.on('pageerror', (e) => console.error('PAGE ERROR', e.message)); await page.goto(site + '#driver'); await page.locator('#drvPin').waitFor(); await page.locator('#drvPin').fill(pin); await page.locator('#drvPin').press('Enter'); await page.waitForTimeout(3500); return page; };

  // ---------------- الزبون (جوال) ----------------
  if (want('customer')) {
    const ctx = await mk(390, 844), page = await ctx.newPage(); page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
    await page.goto(site); await page.locator('.kq-logo').waitFor(); await page.waitForTimeout(2500);
    await snap(page, 'c1-home');
    await page.evaluate(() => window.scrollTo(0, 560)); await snap(page, 'c2-cats');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('[data-nav=search]').first().click(); await page.locator('#q').fill('حليب المراعي'); await page.waitForTimeout(1100); await snap(page, 'c3-search');
    await page.locator('[data-open="x6281007032261"]').first().click(); await page.waitForTimeout(1100); await snap(page, 'c4-product');
    await page.evaluate((cart) => localStorage.setItem('ohod-cart', JSON.stringify(cart)), CART);
    await page.reload(); await page.locator('.kq-logo').waitFor(); await page.waitForTimeout(2200);
    await page.locator('[data-nav=cart]').first().click(); await page.waitForTimeout(900); await snap(page, 'c5-cart');
    await page.locator('[data-nav=checkout]').first().click(); await page.waitForTimeout(2500);
    await page.locator('#locate').click().catch(() => {}); await page.waitForTimeout(1500);
    await page.locator('#cPhone').fill('0551234567'); await page.locator('#cDetails').fill('فيلا ٨، باب بني، جنب المسجد'); await page.locator('#cName').fill('أبو سلمان');
    await page.evaluate(() => window.scrollTo(0, 0)); await snap(page, 'c6-checkout');
    await page.locator('#sendOrder').click(); await page.locator('.sent h1').waitFor(); await page.waitForTimeout(1200); await snap(page, 'c7-sent');
    // نحرّك الطلب من الخادم: المجهز يجهّزه، المندوب يستلمه ويطلع ويرسل موقعه
    const last = await page.evaluate(() => JSON.parse(localStorage.getItem('ohod-last') || 'null')), key = String(last.no).replace(/\D/g, '');
    const prep = await api('/enter', { pin: '5555' }); const find = async () => ((await api('/admin/prep', { session: prep.token })).orders || []).find((o) => String(o.no).replace(/\D/g, '') === key);
    let row = await find(); const checks = {}; row.lines.forEach((_, i) => { checks[i] = 'picked'; });
    await api('/admin/prep-save', { session: prep.token, no: row.no, version: row.version, orderUpdated: row.orderUpdated, stage: 'preparing', checks: {} }); row = await find();
    await api('/admin/prep-save', { session: prep.token, no: row.no, version: row.version, orderUpdated: row.orderUpdated, stage: 'ready', checks });
    await api('/driver/status', { pin: '2222', no: row.no, status: 'accepted' }); await api('/driver/status', { pin: '2222', no: row.no, status: 'onway' });
    await api('/driver/loc', { pin: '2222', lat: 24.8492, lng: 46.8068, acc: 10 });
    await page.reload(); await page.waitForTimeout(2500); await page.locator('[data-nav=sent]').first().click(); await page.waitForTimeout(7000); await page.evaluate(() => window.scrollTo(0, 0));
    await snap(page, 'c8-track'); await snap(page, 'c8-track-full', { fullPage: true });
    await ctx.close();
  }

  // ---------------- المندوب (جوال) ----------------
  if (want('driver')) {
    const ctx = await mk(390, 844), page = await staffIn(ctx, '1111');
    await snap(page, 'd1-list');
    await page.locator('[data-dtab=way]').click(); await page.waitForTimeout(1200); await page.locator('[data-ddeliver]').first().click(); await page.waitForTimeout(1500);
    await page.locator('[data-dgive="200"]').click().catch(() => {}); await page.waitForTimeout(600); await snap(page, 'd2-deliver');
    await page.locator('[data-dview=list]').first().click().catch(() => {}); await page.waitForTimeout(800); await page.locator('[data-dview=cash]').first().click(); await page.waitForTimeout(1800); await snap(page, 'd3-cash');
    await ctx.close();
  }

  // ---------------- عامل التجهيز (جوال) ----------------
  if (want('prep')) {
    const ctx = await mk(390, 844), page = await staffIn(ctx, '5555');
    await snap(page, 'p1-list');
    await page.locator('[data-popen="' + live.new1 + '"]').click(); await page.waitForTimeout(1500);
    for (const i of [0, 1, 2]) { await page.locator('[data-ptile]').nth(i).click().catch(() => {}); await page.waitForTimeout(300); }
    await page.evaluate(() => window.scrollTo(0, 0)); await snap(page, 'p2-order');
    await ctx.close();
  }

  // ---------------- كاشير طلبات التوصيل (جوال) ----------------
  if (want('cashier')) {
    const ctx = await mk(390, 844), page = await staffIn(ctx, '6666');
    await snap(page, 'k1-list');
    await page.locator('[data-posopen="' + live.ready + '"]').click(); await page.waitForTimeout(1500);
    for (const i of [0, 1, 2, 3]) { await page.locator('[data-poscheck="' + i + '"]').check().catch(() => {}); }
    await snap(page, 'k2-review');
    await ctx.close();
  }

  // ---------------- الإدارة (مكتب) ----------------
  if (want('admin')) {
    const ctx = await mk(1440, 900, 1.5), page = await ctx.newPage(); page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
    await page.goto(site); await page.locator('.kq-logo').waitFor(); await page.waitForTimeout(1500);
    await page.locator('[data-nav=more]').first().click(); await page.locator('#toAdmin').click(); await page.locator('#pinIn').fill('2468'); await page.locator('#pinForm [type=submit]').click();
    await page.locator('.adm[data-simple-admin]').waitFor(); await page.waitForTimeout(2500);
    const nav = async (id) => { const b = page.locator('.adm-nav [data-atab="' + id + '"]').first(); const g = b.locator('xpath=ancestor::details[1]'); if (await g.count()) await g.evaluate((x) => { x.open = true; }); await b.click(); await page.waitForTimeout(2500); await page.evaluate(() => window.scrollTo(0, 0)); };
    // ننزل لعنوان معيّن داخل الصفحة ونصوّر من عنده
    const at = async (text, name, dy) => { const ok = await page.evaluate(([t, d]) => { const h = Array.from(document.querySelectorAll('h2,h3,h4,summary,legend,b,strong')).find((x) => x.offsetParent && x.textContent.trim().startsWith(t)); if (!h) return false; window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - (d || 110)); return true; }, [text, dy]); if (!ok) console.log('heading not found', text); await snap(page, name); };
    await snap(page, 'a1-today');
    await nav('olist'); await snap(page, 'a2-orders');
    await nav('stats'); await snap(page, 'a3-stats-tips'); await at('المبيعات كل يوم', 'a3-stats-days'); await at('أوقات الطلب', 'a3-stats-hours'); await at('الأكثر مبيع', 'a3-stats-top'); await at('يشترونها مع بعض', 'a3-stats-pairs'); await at('أفضل الزبائن', 'a3-stats-cust', 260);
    await nav('costs'); await at('صحة المحل قبل العروض', 'a4-advisor'); await at('عروض آمنة مقترحة', 'a4-safe-offers', 380);
    await nav('settlement'); await snap(page, 'a5-settlement');
    await nav('cust'); await snap(page, 'a6-winback');
    await nav('staff'); await snap(page, 'a7-staff');
    await nav('store'); await snap(page, 'a8-store'); await at('منطقة التوصيل', 'a8-zone');
    await nav('prods'); await snap(page, 'a9-products');
    await nav('log'); await snap(page, 'a10-log');
    await ctx.close();
  }
  // ---------------- الإدارة على الجوال (للنسخة البيعية الطولية) ----------------
  if (want('adminm')) {
    const ctx = await mk(390, 844), page = await ctx.newPage(); page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
    await page.goto(site); await page.locator('.kq-logo').waitFor(); await page.waitForTimeout(1500);
    await page.locator('[data-nav=more]').first().click(); await page.locator('#toAdmin').click(); await page.locator('#pinIn').fill('2468'); await page.locator('#pinForm [type=submit]').click();
    await page.locator('.adm[data-simple-admin]').waitFor(); await page.waitForTimeout(2500);
    const nav = async (id) => { const t = page.locator('#adminMenuToggle'); if (await t.isVisible().catch(() => false)) await t.click(); const b = page.locator('.adm-nav [data-atab="' + id + '"]').first(); const g = b.locator('xpath=ancestor::details[1]'); if (await g.count()) await g.evaluate((x) => { x.open = true; }); await b.click(); await page.waitForTimeout(2500); await page.evaluate(() => window.scrollTo(0, 0)); };
    const at = async (text, name, dy) => { await page.evaluate(([t, d]) => { const h = Array.from(document.querySelectorAll('h2,h3,h4,summary,legend,b,strong')).find((x) => x.offsetParent && x.textContent.trim().startsWith(t)); if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - (d || 90)); }, [text, dy]); await snap(page, name); };
    await snap(page, 'm1-today');
    await nav('stats'); await at('المبيعات كل يوم', 'm2-days'); await at('أوقات الطلب', 'm3-hours'); await at('الأكثر مبيع', 'm4-top');
    await nav('settlement'); await snap(page, 'm5-settlement');
    await nav('costs'); await at('صحة المحل قبل العروض', 'm6-advisor');
    await nav('cust'); await snap(page, 'm7-winback');
    await nav('prods'); await snap(page, 'm8-products');
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
