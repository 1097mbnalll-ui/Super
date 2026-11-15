// يقرأ اللي ظاهر في الـWebView (عبر DevTools) ويطبعه: الرابط، العنوان، الصورة، طول النص
const out = process.argv[2], tag = process.argv[3];
const fs = require('node:fs');
(async () => {
  let list = [];
  try { list = await (await fetch('http://127.0.0.1:9222/json')).json(); } catch (e) { console.log(tag, 'NO DEVTOOLS', String(e)); return; }
  const t = list.find((x) => x.type === 'page') || list[0];
  if (!t) { console.log(tag, 'NO PAGE', JSON.stringify(list)); return; }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const res = await new Promise((r) => { ws.onmessage = (m) => r(JSON.parse(m.data)); ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { returnByValue: true, expression: '({url: location.href, h1: (document.querySelector("h1")||{}).textContent || null, img: (document.querySelector("img")||{}).naturalWidth || 0, textLen: (document.body && document.body.innerText || "").length, ready: document.readyState, err: (document.getElementById("e")||{}).textContent || null})' } })); });
  const v = res.result && res.result.result && res.result.result.value;
  const line = tag + ' ' + JSON.stringify({ target: t.url, ...v });
  console.log(line); fs.appendFileSync(out + '/dom.txt', line + '\n');
  ws.close();
})().catch((e) => console.log(tag, 'ERR', String(e)));
