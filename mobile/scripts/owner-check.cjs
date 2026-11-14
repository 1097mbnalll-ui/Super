// يتأكد على محاكي أندرويد إن تطبيق المالك يفتح شاشة كلمة السر فعلاً (يتصل بالـWebView عبر DevTools)
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const out = process.argv[2] || 'owner-out';
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => { const b = execSync('adb exec-out screencap -p', { maxBuffer: 64 * 1024 * 1024 }); const i = b.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47])); fs.writeFileSync(`${out}/${n}.png`, i > 0 ? b.subarray(i) : b); };
async function connect() {
  const list = await (await fetch('http://127.0.0.1:9222/json')).json();
  const t = list.find((x) => x.type === 'page' && /^https?:/.test(x.url)) || list[0];
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  return { url: t.url, close: () => ws.close(), evaluate: async (fn) => { const d = await send('Runtime.evaluate', { expression: `(${fn})()`, returnByValue: true }); return d.result && d.result.result && d.result.result.value; } };
}
(async () => {
  const page = await connect();
  let st = null;
  for (let i = 0; i < 40; i++) {            // up to ~40 s for the site to load and the login to open
    st = await page.evaluate(() => ({ url: location.href, pinSheet: !!document.getElementById('pinSheet'), pinInput: !!document.getElementById('pinIn'), capacitor: typeof window.Capacitor, screen: document.body && document.body.getAttribute('data-screen'), title: document.title, offlineErr: (document.getElementById('e') || {}).textContent || null }));
    if (st && st.pinSheet) break;
    await wait(1000);
  }
  // الشاشة لازم تبقى: نراقبها ١٢ ثانية بعد أول ظهور (يمسك حالة «تطلع وتختفي»)
  const timeline = [];
  for (const sec of [1, 3, 6, 12]) { await wait((sec - (timeline.length ? timeline[timeline.length - 1].t : 0)) * 1000); const x = await page.evaluate(() => ({ pinSheet: !!document.getElementById('pinSheet'), screen: document.body.getAttribute('data-screen') })); timeline.push({ t: sec, ...x }); }
  st.timeline = timeline;
  shot('owner-login');
  fs.writeFileSync(`${out}/owner-report.json`, JSON.stringify(st, null, 2));
  console.log(JSON.stringify(st));
  page.close();
  if (!st || !st.pinSheet || !st.pinInput || (st.timeline || []).some((x) => !x.pinSheet)) { console.error('OWNER LOGIN SCREEN DID NOT OPEN'); process.exit(2); }
})().catch((e) => { console.error('FAIL', e); try { shot('owner-error'); } catch {} process.exit(1); });
