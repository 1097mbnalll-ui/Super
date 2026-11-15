// يتأكد على محاكي أندرويد إن تطبيق الزبون يفتح الموقع الحي بتصميم أندرويد، وإن شبكة العروض ما فيها تداخل
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const out = process.argv[2] || 'cust-out';
fs.mkdirSync(out, { recursive: true });
const guard = setTimeout(() => { console.error('TIMEOUT'); process.exit(3); }, 120000);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => { const b = execSync('adb exec-out screencap -p', { maxBuffer: 64 * 1024 * 1024 }); const i = b.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47])); fs.writeFileSync(`${out}/${n}.png`, i > 0 ? b.subarray(i) : b); };
async function connect() {
  const list = await (await fetch('http://127.0.0.1:9222/json')).json();
  const t = list.find((x) => x.type === 'page' && /^https?:/.test(x.url)) || list[0];
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  return { close: () => ws.close(), evaluate: async (fn) => { const d = await send('Runtime.evaluate', { expression: `(${fn})()`, returnByValue: true, awaitPromise: true }); return d.result && d.result.result && d.result.result.value; } };
}
(async () => {
  const page = await connect();
  let st = null;
  for (let i = 0; i < 40; i++) { st = await page.evaluate(() => ({ url: location.href, cls: document.documentElement.className, cards: document.querySelectorAll('.kq-card').length })); if (st && st.cards > 5) break; await wait(1000); }
  // dismiss any welcome sheet, open Offers (orange button), measure every card
  const res = await page.evaluate(() => new Promise((done) => {
    [...document.querySelectorAll('button')].filter((b) => /^(تخطّى|تخطى|Skip)$/.test(b.textContent.trim())).forEach((b) => b.click());
    const m = document.querySelector('.kq-mid'); if (m) m.click();
    setTimeout(() => {
      const issues = []; const cards = [...document.querySelectorAll('.kq-card')];
      cards.forEach((c, ci) => { const cr = c.getBoundingClientRect(); if (!cr.width) return;
        [...c.querySelectorAll('.kq-img, .kq-name, .kq-price, .kq-save, .kq-qty')].forEach((x) => { const r = x.getBoundingClientRect(); if (r.width && (r.right > cr.right + 2 || r.left < cr.left - 2)) issues.push('sticks out: ' + x.className); });
        const h = c.querySelector('.fav'), bd = c.querySelector('.kq-badge'); if (h && bd) { const a = h.getBoundingClientRect(), q = bd.getBoundingClientRect(); if (Math.min(a.right, q.right) - Math.max(a.left, q.left) > 1 && Math.min(a.bottom, q.bottom) - Math.max(a.top, q.top) > 1) issues.push('heart covers badge'); } });
      const g = document.querySelector('.kq-grid .kq-card'); if (g) { g.scrollIntoView({ block: 'start' }); window.scrollBy(0, -120); }
      done({ cards: cards.length, issues: issues.slice(0, 10), nIssues: issues.length });
    }, 2500);
  }));
  await wait(1200); shot('offers');
  const report = { ...st, ...res };
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  page.close(); clearTimeout(guard);
  const bad = !/^https:\/\/1097mbnalll-ui\.github\.io\/Super\//.test(st.url) || !/\bandroid\b/.test(st.cls) || res.nIssues > 0 || res.cards < 5;
  if (bad) { console.error('CUSTOMER APP CHECK FAILED'); process.exit(2); }
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error('FAIL', e); try { shot('error'); } catch {} process.exit(1); });
