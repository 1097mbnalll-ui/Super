// فحص الموقع على محرك آبل (WebKit = نفس محرك Safari وWKWebView في التطبيق)، بمقاس آيفون.
// يقيس: رأس الصفحة ظاهر، الصفحة ما تنزل لحالها، البنرات المتحركة واقفة صح (مو بين بنرين)، والبنر الظاهر مو فاضي.
// الاستخدام: node check.mjs <base-url> <out-dir>
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://localhost:8765';
const out = process.argv[3] || 'out';
fs.mkdirSync(out, { recursive: true });
const cases = [
  { id: 'site-morning', url: '/index.html?sky=morning' },
  { id: 'site-maghrib', url: '/index.html?sky=maghrib' },
  { id: 'site-night', url: '/index.html?sky=night' },
  { id: 'app-head-night', url: '/index.html?embed=1&blocks=head,featured,promos&st=47&sky=night' },
  { id: 'app-head-morning', url: '/index.html?embed=1&blocks=head,featured,promos&st=47&sky=morning' },
  { id: 'app-blocks', url: '/index.html?embed=1&blocks=featured,promos,again,due,moment,season,myoffers,catoffers' },
];
const report = { base, cases: [] };
let fail = 0;
const b = await webkit.launch();
for (const c of cases) {
  const ctx = await b.newContext({ ...devices['iPhone 14'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message || e)));
  await p.addInitScript(() => { try { localStorage.setItem('ohod-intro', '1'); } catch (e) {} });
  await p.route(/workers\.dev/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"code":"not_found"}' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.continue());
  await p.goto(base + c.url, { waitUntil: 'load' });
  const samples = [];
  const t0 = Date.now();
  for (const t of [1500, 4000, 7000, 10500, 14000, 18000, 23000]) {
    while (Date.now() - t0 < t) await p.waitForTimeout(100);
    const m = await p.evaluate(() => {
      const r = {};
      r.scrollY = window.scrollY;
      const head = document.querySelector('.kq-head');
      if (head) { const bb = head.getBoundingClientRect(); r.headTop = Math.round(bb.top); r.headH = Math.round(bb.height); }
      const srch = document.querySelector('.kq-search');
      if (srch) { const bb = srch.getBoundingClientRect(); r.searchVisible = bb.top >= 0 && bb.bottom <= innerHeight && bb.height > 20; }
      const el = document.getElementById('kqBans');
      if (el && el.firstElementChild) {
        const box = el.getBoundingClientRect();
        const holder = el.firstElementChild.classList.contains('kq-track') ? el.firstElementChild : el;
        const rs = Array.from(holder.children).map(x => x.getBoundingClientRect());
        const onIx = Array.from(holder.children).findIndex(x => x.classList.contains('on'));
        const k = onIx >= 0 ? onIx : rs.findIndex(q => Math.abs(q.left - box.left) < 3 && Math.abs(q.width - box.width) < 3);
        const near = rs.reduce((m, q, ix) => Math.abs(q.left - box.left) < Math.abs(rs[m].left - box.left) ? ix : m, 0);
        r.ban = { inView: box.top >= 0 && box.bottom <= innerHeight, n: rs.length, k: k >= 0 ? k : near, off: onIx >= 0 ? 0 : Math.round(rs[near].left - box.left), snapped: k >= 0 };
        const slide = holder.children[r.ban.k];
        r.ban.centerSlide = slide ? (slide.dataset.bid || String(slide.className).slice(0, 40)) : 'NONE';
        if (slide) {
          const kids = Array.from(slide.querySelectorAll('*')).filter(x => { const q = x.getBoundingClientRect(); return q.width > 4 && q.height > 4 && getComputedStyle(x).visibility !== 'hidden' && getComputedStyle(x).opacity !== '0'; });
          r.ban.visibleKids = kids.length;
          const imgs = Array.from(slide.querySelectorAll('img'));
          r.ban.imgs = imgs.length; r.ban.imgsBroken = imgs.filter(i => i.complete && !i.naturalWidth).length; r.ban.imgsPending = imgs.filter(i => !i.complete).length;
        }
      }
      // الكلام فوق السما: مغطى بشي شبه شفاف (سحابة)؟
      const hi = document.querySelector('.kqsky-hi b');
      if (hi) { const q = hi.getBoundingClientRect(); const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); r.greetCovered = top && !top.closest('#splash') && !hi.contains(top) && top !== hi ? (top.className || top.tagName) : false; }
      return r;
    });
    samples.push({ t, ...m });
    await p.screenshot({ path: `${out}/${c.id}-${String(t).padStart(5, '0')}.png` });
    try { const bn = await p.$('#kqBans'); if (bn) await bn.screenshot({ path: `${out}/ban-${c.id}-${String(t).padStart(5, '0')}.png` }); } catch (e) {}
  }
  // سحب بالإصبع على البنرات (مثل الزبون): بعده لازم يوقف على بنر كامل
  const swipe = await p.evaluate(async () => {
    const el = document.getElementById('kqBans'); if (!el) return null;
    el.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 300));
    const b = el.getBoundingClientRect(), y = b.top + b.height / 2;
    const mk = (type, x) => { let ev; try { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y }); ev = new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }); } catch (e) { return false; } el.dispatchEvent(ev); return true; };
    const res = [];
    for (const dir of [1, 1, -1, 1]) {
      const sx = b.left + b.width * (dir > 0 ? 0.25 : 0.75);
      if (!mk('touchstart', sx)) return { unsupported: true };
      for (let s = 1; s <= 6; s++) { mk('touchmove', sx + dir * s * 25); await new Promise(r => setTimeout(r, 16)); }
      mk('touchend', sx + dir * 150); await new Promise(r => setTimeout(r, 900));
      const holder = el.firstElementChild.classList.contains('kq-track') ? el.firstElementChild : el;
      const box = el.getBoundingClientRect();
      const rs = Array.from(holder.children).map(x => x.getBoundingClientRect());
      const onIx = Array.from(holder.children).findIndex(x => x.classList.contains('on'));
      res.push(onIx >= 0 ? onIx : rs.findIndex(q => Math.abs(q.left - box.left) < 3 && Math.abs(q.width - box.width) < 3));
    }
    window.scrollTo(0, 0);
    return { idx: res };
  });
  if (swipe && !swipe.unsupported) samples.push({ swipe });
  // تقييم
  const issues = [];
  if (errs.length) issues.push('أخطاء جافاسكربت: ' + errs.slice(0, 3).join(' | '));
  if (swipe && swipe.idx && swipe.idx.some(k => k < 0)) issues.push('بعد السحب البنرات وقفت بين بنرين: ' + swipe.idx.join(','));
  if (samples.filter(s => s.t).some(s => s.scrollY > 2)) issues.push('الصفحة نزلت لحالها (scrollY=' + Math.max(...samples.map(s => s.scrollY)) + ')');
  if (!c.url.includes('embed=1') || c.url.includes('head')) {
    const s0 = samples[0];
    if (s0.searchVisible === false) issues.push('مربع البحث مو ظاهر أول ما تفتح الصفحة');
  }
  const bad = samples.filter(s => s.t && s.ban && !s.ban.snapped);
  if (bad.length) issues.push('البنرات واقفة بين بنرين: ' + bad.map(s => s.t + 'ms off=' + s.ban.off).join(', '));
  const blank = samples.filter(s => s.t && s.ban && s.ban.inView && (String(s.ban.centerSlide).startsWith('NONE') || s.ban.visibleKids < 3 || s.ban.imgsBroken));
  if (blank.length) issues.push('بنر فاضي/مكسور: ' + blank.map(s => s.t + 'ms ' + s.ban.centerSlide + ' kids=' + s.ban.visibleKids + ' broken=' + s.ban.imgsBroken).join(', '));
  const cov = samples.filter(s => s.greetCovered);
  if (cov.length) issues.push('التحية مغطاة بـ: ' + cov[0].greetCovered);
  if (issues.length) fail++;
  report.cases.push({ id: c.id, url: c.url, ok: !issues.length, issues, samples });
  console.log((issues.length ? '❌ ' : '✅ ') + c.id + (issues.length ? '\n   - ' + issues.join('\n   - ') : ''));
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(fail ? `\n${fail} حالة فيها مشاكل` : '\nكل الحالات سليمة');
process.exitCode = fail ? 1 : 0;
