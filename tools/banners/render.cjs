// يصوّر بنرات الموقع (نفس التصميم الفني ART) صور جاهزة لتطبيق الآيفون: ban/<id>.webp، ويحط روابطها في store.app.banImg بملف المنتجات.
// التطبيق يعرض الصورة بدل بنره المرسوم، فأي تعديل في بنرات الموقع يطلع في التطبيق بدون تحديث. شغّله بعد أي تحديث للعروض أو الأسعار.
// الاستخدام: node tools/banners/render.cjs   (من مجلد المستودع، يحتاج Playwright وChromium)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '../..'), O = 'https://1097mbnalll-ui.github.io';
const TYPES = { html: 'text/html', json: 'application/json', js: 'text/javascript', webp: 'image/webp', png: 'image/png', svg: 'image/svg+xml', jpg: 'image/jpeg' };
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await b.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 3, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
  await ctx.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.host === '1097mbnalll-ui.github.io') {
      const f = decodeURIComponent(u.pathname.replace(/^\/Super\/?/, '')) || 'index.html';
      const p = path.join(ROOT, f);
      if (!fs.existsSync(p)) return r.fulfill({ status: 404, body: '' });
      let body = fs.readFileSync(p);
      if (f === 'data.json') { const d = JSON.parse(body); d.store.closed = false; body = JSON.stringify(d); }
      return r.fulfill({ body, contentType: TYPES[f.split('.').pop()] });
    }
    if (/fonts\.(googleapis|gstatic)\.com/.test(u.host)) return r.continue().catch(() => r.fulfill({ status: 404, body: '' }));
    return r.fulfill({ status: 404, body: '' });
  });
  const p = await ctx.newPage();
  // بنر السهرة يطلع من ٧ المساء: نصوّر على الساعة ٩ بالليل بتوقيت الرياض
  const now = new Date(); now.setUTCHours(18, 0, 0, 0); await p.clock.setFixedTime(now);
  await p.goto(O + '/Super/index.html?embed=1&blocks=featured,promos&st=0');
  await p.waitForTimeout(3500);
  const ids = await p.evaluate(() => [...document.querySelectorAll('.kq-track > *')].map((el, i) => {
    const x = el.matches('[data-bid]') ? el : el.querySelector('[data-bid]'); return x ? x.getAttribute('data-bid') : 'b' + i; }));
  fs.mkdirSync(path.join(ROOT, 'ban'), { recursive: true });
  const out = {};
  for (let i = 0; i < ids.length; i++) {
    await p.evaluate((i) => { [...document.querySelectorAll('.kq-track > *')].forEach((k, j) => { k.style.visibility = j === i ? 'visible' : 'hidden'; }); }, i);
    await p.waitForTimeout(300);
    const el = (await p.$$('.kq-track > *'))[i];
    const png = await el.screenshot({ type: 'png' });
    // webp أخف بكثير (التطبيق يحمّلها مع كل فتحة)
    const file = 'ban/' + ids[i] + '.webp', tmp = path.join(require('os').tmpdir(), 'ban-' + ids[i] + '.png');
    fs.writeFileSync(tmp, png);
    require('child_process').execFileSync('python3', ['-c', 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"WEBP",quality=86,method=6)', tmp, path.join(ROOT, file)]);
    fs.unlinkSync(tmp);
    const buf = fs.readFileSync(path.join(ROOT, file));
    out[ids[i]] = file + '?v=' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
  }
  const dp = path.join(ROOT, 'data.json'), d = JSON.parse(fs.readFileSync(dp, 'utf8'));
  d.store.app = d.store.app || {}; d.store.app.banImg = out;
  fs.writeFileSync(dp, JSON.stringify(d));
  console.log(JSON.stringify(out));
  await b.close();
})();
