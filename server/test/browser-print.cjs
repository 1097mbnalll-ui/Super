// اختبار قسم الطباعة في المتصفح (جوال): الحاسبة، السلة، ملاحظة الطلب، زر واتساب، الحد الأدنى، وحفظ السلة بعد إعادة الفتح.
// التشغيل: CHROMIUM_PATH=/opt/pw-browsers/chromium node server/test/browser-print.cjs   (يحتاج Playwright وChromium)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), HOST = 'https://1097mbnalll-ui.github.io/Super/'; const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const API = data.store.api; const types = { html: 'text/html; charset=utf-8', json: 'application/json', js: 'text/javascript', png: 'image/png', webp: 'image/webp' };
const z = data.store.zone, [lat, lng] = z.reduce((a, p) => [a[0] + p[0] / z.length, a[1] + p[1] / z.length], [0, 0]);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const mkPage = async (cartObj) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); const errs = [], posts = [];
    await pg.addInitScript(({ lat, lng, cartObj }) => { try { sessionStorage.setItem('ohod-sp', '1'); localStorage.setItem('ohod-form2', JSON.stringify({ phone: '0551234567', lat, lng, details: '', name: 'تجربة', note: 'بدون دبوس', pay: 'cash', sub: 'call' })); if (cartObj) localStorage.setItem('ohod-cart', JSON.stringify(cartObj)); } catch (e) {} }, { lat, lng, cartObj });
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
    await pg.route('**/*', r => { const u = r.request().url();
      if (u.startsWith(HOST)) { const rel = decodeURIComponent(u.slice(HOST.length).split('?')[0]) || 'index.html'; const f = path.join(root, rel); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: types[f.split('.').pop()] || 'application/octet-stream' }); }
      if (API && u.startsWith(API)) { const p = new URL(u).pathname; const h = { 'access-control-allow-origin': '*' }; if (p === '/order') { posts.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ ok: true, orderNo: '#1234', total: 540, track: false }) }); } return r.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ ok: true, stock: {} }) }); }
      return r.abort(); });
    await pg.goto(HOST + 'index.html', { waitUntil: 'load' }); await pg.waitForTimeout(3200); return { pg, errs, posts }; };
  // ١) الرحلة الكاملة
  let { pg, errs, posts } = await mkPage(null);
  await pg.click('text=الأقسام'); await pg.waitForTimeout(700);
  ok(await pg.evaluate(() => !!document.querySelector('.kq-cat[data-opencat="print"] img')), 'قسم الطباعة ظاهر بصورته');
  await pg.click('.kq-cat[data-opencat="print"]'); await pg.waitForTimeout(700);
  await pg.fill('#prPages', '١٢٠'); await pg.click('[data-pcopies="1"]'); await pg.click('[data-pcopies="1"]'); await pg.click('[data-ptype="color"]'); await pg.click('[data-psides="2"]');
  const price = data.products.find(p => p.id === 'print_color').price, total = 360 * price;
  const sum = await pg.evaluate(() => document.getElementById('prSum').innerText.replace(/\s+/g, ' ')); ok(sum.includes(String(total)) && sum.includes('120') && sum.includes('3'), 'الحاسبة (أرقام عربية ١٢٠ × ٣ نسخ): ' + sum);
  await pg.click('#prAdd'); await pg.waitForTimeout(600); await pg.click('[data-nav="cart"]'); await pg.waitForTimeout(700);
  const cart = await pg.evaluate(() => ({ line: document.querySelector('.line')?.innerText.replace(/\s+/g, ' '), stepper: !!document.querySelector('.line .stepper'), edit: !!document.querySelector('.line [data-opencat="print"]') }));
  ok(cart.line.includes('360') && !cart.stepper && cart.edit, 'سطر السلة: ٣٦٠ صفحة بدون عدّاد +/− وفيه «تعديل»: ' + cart.line);
  await pg.click('[data-nav="checkout"]'); await pg.waitForTimeout(1000); await pg.click('#sendOrder'); await pg.waitForTimeout(1500);
  ok(posts.length === 1 && posts[0].items.print_color === 360 && Object.keys(posts[0].items).length === 1, 'الطلب انرسل بـ٣٦٠ صفحة ألوان');
  ok(posts[0].note.includes('طباعة ألوان: 120 صفحة × 3 نسخة (وجهين)') && posts[0].note.includes('بدون دبوس'), 'الملاحظة فيها تفاصيل الطباعة وملاحظة الزبون: ' + JSON.stringify(posts[0].note));
  const wa = await pg.evaluate(() => { const a = document.querySelector('.pr-wa a'); return a ? decodeURIComponent(a.href) : ''; });
  ok(wa.startsWith('https://wa.me/' + String(data.store.wa).replace(/\D/g, '') + '?text=') && wa.includes('#1234') && wa.includes('120 صفحة × 3 نسخة'), 'زر واتساب فيه رقم الطلب وتفاصيل الطباعة');
  ok(errs.length === 0, 'بدون أخطاء JavaScript: ' + errs.slice(0, 2).join(' | '));
  // ٢) الحد الأدنى + حفظ السلة بعد إعادة الفتح (print_bw مو في البيانات المدمجة بالصفحة)
  const minCase = async (cartObj) => { const r = await mkPage(cartObj); await r.pg.click('[data-nav="cart"]'); await r.pg.waitForTimeout(700); const x = await r.pg.evaluate(() => ({ line: !!document.querySelector('.line'), alert: document.querySelector('.alert.soft')?.innerText.replace(/\s+/g, ' ') || '', off: document.querySelector('.bottomcta button')?.disabled })); await r.pg.context().close(); return x; };
  const bw = data.products.find(p => p.id === 'print_bw').price, min = data.store.print.minOrder, gen = data.store.minOrder;
  let x = await minCase({ print_bw: Math.floor(min / bw) - 2 }); ok(x.line && x.off && x.alert.includes(String(min)), 'السلة المحفوظة ما انحذفت بعد إعادة الفتح، وطلب الطباعة تحت حده الأدنى (' + min + ') ممنوع');
  x = await minCase({ print_bw: Math.ceil(min / bw) }); ok(x.line && !x.off, 'طلب الطباعة عند حده الأدنى مسموح');
  const std = data.products.find(p => !p.print && p.price > 0 && p.price < 5).id;
  x = await minCase({ [std]: 1, print_bw: Math.ceil(min / bw) }); ok(x.off && x.alert.includes(String(gen)), 'الطلب المختلط يلتزم بالحد العام (' + gen + ')');
  await b.close(); console.log(fails ? '\n' + fails + ' فحص فشل' : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
})();
