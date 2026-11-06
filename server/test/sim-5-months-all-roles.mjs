// محاكاة ٥ شهور لحظة بلحظة: زبائن + إدارة + مندوب على كود الخادم نفسه، مع دفتر مستقل يتحقق من كل رقم.
import w from '../worker.js'; import fs from 'fs'; import { DatabaseSync } from 'node:sqlite';
const DBFILE = process.argv[2] || ':memory:', DAYS = Number(process.argv[3] || 150);
if (DBFILE !== ':memory:' && fs.existsSync(DBFILE)) fs.unlinkSync(DBFILE);
const sq = new DatabaseSync(DBFILE);
let FAIL = 0.006, injected = 0;
const mk = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } }; return st; };
const DB = { prepare: mk, async batch(l) { sq.exec('BEGIN'); try { const o = [], f = l.length > 3 && Math.random() < FAIL ? Math.floor(Math.random() * l.length) : -1;
  for (let i = 0; i < l.length; i++) { if (i === f) { injected++; throw new Error('injected'); } o.push(await l[i].run()); } sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async k => kv.delete(k) };
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: 'https://1097mbnalll-ui.github.io', LOCKS, DB };
const data = JSON.parse(fs.readFileSync(new URL('../../data.json', import.meta.url), 'utf8'));
data.store.daily = { on: false, list: [] }; if (data.store.deal95) data.store.deal95.on = false;
delete data.store.minOrder; delete data.store.closed; data.store.keepDays = 180; data.store.lowAt = 3;
data.products.forEach(p => { delete p.max; });
const S = data.store, FEE = Number(S.fee || 0), FREE = Number(S.freeOver || 0);
const pushes = [];
globalThis.fetch = async (u, o = {}) => { u = String(u); if (u.includes('api.github.com') && !o.method) return new Response(JSON.stringify(data)); if (u.includes('push.sim')) { pushes.push(u); return new Response('', { status: 201 }); } return new Response('{"ok":true}'); };
let NOW = Date.UTC(2026, 10, 7, 3, 0); const RD = Date; Date.now = () => NOW;
let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; Math.random = rnd;
const O = 'https://1097mbnalll-ui.github.io'; let ipn = 0;
const call = async (path, body) => { const waits = []; const r = await w.fetch(new Request('https://x.dev' + path, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '10.' + (++ipn % 250) + '.' + (Math.floor(ipn / 250) % 250) + '.' + (Math.floor(ipn / 62500) % 250) }, body: JSON.stringify(body) }), env, { waitUntil: p => waits.push(p) }); const j = await r.json(); await Promise.all(waits); return j; };
const admin = (path, body, by) => call(path, { pin: '2468', by: by || (rnd() < 0.5 ? 'فهد' : 'أبو محمد'), ...body });
const dayOf = ms => new RD(ms + 3 * 3600e3).toISOString().slice(0, 10);
const r2 = n => Math.round(n * 100) / 100;
const byId = Object.fromEntries(data.products.map(p => [p.id, p]));
const avail = () => data.products.filter(p => p.stock);
const pick = () => { const l = avail(); return l[Math.floor(Math.pow(rnd(), 1.6) * l.length)]; };
// ---------- people ----------
const N = 650, phones = Array.from({ length: N }, (_, i) => '05' + String(52000000 + i * 7307).slice(0, 8));
const cust = phones.map((ph, i) => ({ phone: ph, name: ['أبو فهد', 'أم سعد', 'محمد', 'نورة', 'خالد', 'سارة', ''][i % 7], type: i % 10 < 3 ? 'loyal' : i % 10 < 6 ? 'occ' : 'once', ordered: 0, churned: false }));
// ---------- ledger ----------
const L = { orders: {}, stock: {}, cost: {}, cashDelivered: 0, cashGot: 0, contacts: {}, phoneOf: {} };
const log = { placed: 0, staff: 0, rejStock: 0, rejDb: 0, rejMin: 0, rejClosed: 0, mismatch: 0, swaps: 0, removes: 0, edits: 0, cancels: 0, delivered: 0, winbackSent: 0, winbackBack: 0, verifies: 0, verifyBad: 0, unexpected: [] };
const tracked = ['bakery1', 'bakery2', 'bakery3', 'dairy1', 'dairy3', 'dairy4', 'veg0', 'veg1', 'meat0', 'drinks1', 'pantry0'].filter(id => byId[id] && byId[id].stock);
// ---------- events queue ----------
const Q = []; const at = (t, f) => { Q.push([t, f]); };
const runUntil = async (t) => { for (;;) { Q.sort((a, b) => a[0] - b[0]); if (!Q.length || Q[0][0] > t) break; const [tt, f] = Q.shift(); NOW = Math.max(NOW, tt); await f(); } NOW = Math.max(NOW, t); };
// ---------- admin actions ----------
async function restock() { const set = {}; for (const id of tracked) set[id] = 50 + Math.floor(rnd() * 90); FAIL = 0; const j = await admin('/save', { data, stock: set }); FAIL = 0.006; if (!j.ok) throw new Error('restock ' + j.code); Object.assign(L.stock, set); }
async function setCosts(mult) { const costs = {}; avail().forEach((p, i) => { if (i % 7 !== 6) costs[p.id] = r2(p.price * (i % 5 === 0 ? 0.92 : mult)); }); FAIL = 0; const j = await admin('/save', { data, costs }); FAIL = 0.006; if (!j.ok) throw new Error('costs'); Object.assign(L.cost, costs); }
async function priceChange() { const p = pick(); const old = p.price; p.price = r2(Math.max(1, old * (rnd() < 0.6 ? 1.1 : 0.9))); FAIL = 0; const j = await admin('/save', { data }); FAIL = 0.006; if (!j.ok) { p.price = old; } }
async function setStore(k, v) { if (v == null) delete data.store[k]; else data.store[k] = v; FAIL = 0; await admin('/save', { data }); FAIL = 0.006; }
// ---------- orders ----------
const costOfLines = (lines) => r2(lines.reduce((s, l) => s + l.qty * (l.cost || 0), 0));
function addLedgerOrder(no, lines, fee, pay, phone, sub, src) {
  const sub2 = r2(lines.reduce((s, l) => s + l.qty * l.price, 0));
  const o = { no, created: NOW, day: dayOf(NOW), phone, pay, lines, fee, total: r2(sub2 + fee), status: 'new', sub, src }; L.orders[no] = o;
  for (const l of lines) if (L.stock[l.id] != null) L.stock[l.id] -= l.qty;
  at(NOW + (3 + rnd() * 25) * 60e3, () => driverTake(o));
  if (rnd() < 0.035) at(NOW + (2 + rnd() * 10) * 60e3, () => adminCancel(o));
  else if (rnd() < 0.05) at(NOW + (2 + rnd() * 6) * 60e3, () => adminEdit(o));
  return o;
}
function basket() { const n = 1 + Math.floor(Math.pow(rnd(), 1.3) * 7), it = {}; for (let i = 0; i < n; i++) { const p = pick(); it[p.id] = (it[p.id] || 0) + 1 + (rnd() < 0.2 ? 1 : 0); } return it; }
async function customerOrder(c, why) {
  let items = basket();
  for (let attempt = 0; attempt < 3; attempt++) {
    const sub = ['swap', 'remove', 'call'][Math.floor(rnd() * 3)], pay = rnd() < 0.4 ? 'card' : 'cash';
    const lines = Object.entries(items).map(([id, qty]) => ({ id, qty, price: byId[id].price, cost: L.cost[id] || 0 }));
    const subtotal = r2(lines.reduce((s, l) => s + l.qty * l.price, 0));
    const short = Object.keys(items).find(id => L.stock[id] != null && L.stock[id] < items[id]);
    const expectMin = data.store.minOrder && subtotal < data.store.minOrder, expectClosed = !!data.store.closed;
    const j = await call('/order', { items, phone: c.phone, name: c.name, pay, sub, lat: 24.84, lng: 46.83, details: 'حي الرمال' });
    if (!j.ok) {
      if (j.code === 'closed') { log.rejClosed++; if (!expectClosed) log.unexpected.push('closed?'); return; }
      if (j.code === 'min_order') { log.rejMin++; if (!expectMin) log.unexpected.push('min?'); const p = pick(); items[p.id] = (items[p.id] || 0) + 2; continue; }
      if (j.code === 'unavailable') { log.rejStock++; if (!short) log.unexpected.push('stock?'); delete items[j.id]; if (!Object.keys(items).length) return; continue; }
      if (j.code === 'db') { log.rejDb++; return; }
      log.unexpected.push('order ' + j.code); return;
    }
    if (short || expectMin || expectClosed) log.unexpected.push('accepted but expected reject ' + [short, expectMin, expectClosed]);
    const fee = FREE && subtotal >= FREE ? 0 : FEE;
    const o = addLedgerOrder(j.orderNo, lines, fee, pay, c.phone, sub, 'web');
    if (Math.abs(o.total - j.total) > 0.001) log.mismatch++;
    c.ordered++; log.placed++; if (why === 'winback') log.winbackBack++;
    return;
  }
}
async function staffOrder() {
  const c = cust[Math.floor(rnd() * N)], items = basket(), lines = Object.entries(items).map(([id, qty]) => ({ id, qty, price: byId[id].price, cost: L.cost[id] || 0 }));
  const short = lines.find(l => L.stock[l.id] != null && L.stock[l.id] < l.qty), force = !!short && rnd() < 0.5;
  const src = ['phone', 'whatsapp', 'store'][Math.floor(rnd() * 3)];
  const j = await admin('/admin/order-new', { source: src, phone: c.phone, name: c.name, details: 'بيت', lines: lines.map(l => ({ id: l.id, qty: l.qty })), force, pay: 'cash' });
  if (!j.ok) { if (j.code === 'unavailable' && short && !force) { log.rejStock++; return; } if (j.code === 'db') { log.rejDb++; return; } log.unexpected.push('staff ' + j.code); return; }
  const sub = r2(lines.reduce((s, l) => s + l.qty * l.price, 0)), fee = FREE && sub >= FREE ? 0 : FEE;
  const o = addLedgerOrder(j.order.no, lines, fee, 'cash', c.phone, 'call', src);
  for (const l of lines) if (L.stock[l.id] != null && L.stock[l.id] < 0) L.stock[l.id] = 0;
  if (Math.abs(o.total - j.order.total) > 0.001) log.mismatch++;
  log.staff++;
}
async function adminCancel(o) { if (o.status !== 'new' && o.status !== 'accepted') return; const j = await admin('/driver/status', { no: o.no, status: 'canceled' }); if (!j.ok) return;
  for (const l of o.lines) if (L.stock[l.id] != null) L.stock[l.id] = Math.max(0, L.stock[l.id] + l.qty); o.status = 'canceled'; log.cancels++; }
async function adminEdit(o) {
  if (o.status === 'canceled' || o.status === 'delivered') return;
  const lines = o.lines.map(l => ({ ...l })); const p = pick(); const ex = lines.find(l => l.id === p.id && l.price === p.price);
  if (ex) ex.qty++; else lines.push({ id: p.id, qty: 1, price: p.price, cost: L.cost[p.id] || 0 });
  const j = await admin('/admin/order-edit', { no: o.no, fee: o.fee, lines: lines.map(l => ({ id: l.id, qty: l.qty, price: l.price })) }); if (!j.ok) return;
  applyStockDiff(o.lines, lines); o.lines = lines; o.total = r2(r2(lines.reduce((s, l) => s + l.qty * l.price, 0)) + o.fee); log.edits++;
  if (Math.abs(o.total - j.order.total) > 0.001) log.mismatch++;
}
function applyStockDiff(a0, b0) { const n = (ls) => { const m = {}; ls.forEach(l => m[l.id] = (m[l.id] || 0) + l.qty); return m; }; const a = n(a0), b = n(b0);
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) if (L.stock[id] != null) L.stock[id] = Math.max(0, L.stock[id] - ((b[id] || 0) - (a[id] || 0))); }
// ---------- driver ----------
async function driverTake(o) {
  if (o.status !== 'new') return;
  const j = await call('/driver/status', { pin: '1357', no: o.no, status: 'accepted' }); if (!j.ok) { at(NOW + 5 * 60e3, () => driverTake(o)); return; }
  o.status = 'accepted';
  at(NOW + (5 + rnd() * 10) * 60e3, () => driverPick(o));
}
async function driverPick(o) {
  if (o.status !== 'accepted') return;
  for (const l of [...o.lines]) {
    if (rnd() > 0.03 || o.lines.length < 2) continue;
    let op = o.sub === 'swap' ? 'swap' : o.sub === 'remove' ? 'remove' : (rnd() < 0.5 ? 'swap' : 'remove');
    const p = byId[l.id], inO = new Set(o.lines.map(x => x.id));
    const alt = data.products.filter(x => x.cat === p.cat && x.id !== l.id && x.stock && !inO.has(x.id) && (L.stock[x.id] == null || L.stock[x.id] >= l.qty))[0];
    if (op === 'swap' && !alt) op = 'remove';
    const j = await call('/driver/order-edit', { pin: '1357', no: o.no, op, id: l.id, to: alt && alt.id });
    if (!j.ok) { if (j.code !== 'db') log.unexpected.push('drv-edit ' + j.code); continue; }
    let lines = o.lines.filter(x => x.id !== l.id).map(x => ({ ...x }));
    if (op === 'swap') { const ex = lines.find(x => x.id === alt.id && x.price === alt.price); if (ex) ex.qty += l.qty; else lines.push({ id: alt.id, qty: l.qty, price: alt.price, cost: L.cost[alt.id] || 0 }); log.swaps++; } else log.removes++;
    applyStockDiff(o.lines, lines); o.lines = lines; o.total = r2(r2(lines.reduce((s, x) => s + x.qty * x.price, 0)) + o.fee);
    if (Math.abs(o.total - j.order.total) > 0.001) log.mismatch++;
  }
  const j = await call('/driver/status', { pin: '1357', no: o.no, status: 'onway' }); if (!j.ok) { at(NOW + 3 * 60e3, () => driverPick(o)); return; }
  o.status = 'onway'; at(NOW + (8 + rnd() * 25) * 60e3, () => driverDeliver(o));
}
async function driverDeliver(o) {
  if (o.status !== 'onway') return;
  const j = await call('/driver/status', { pin: '1357', no: o.no, status: 'delivered' }); if (!j.ok) { at(NOW + 3 * 60e3, () => driverDeliver(o)); return; }
  o.status = 'delivered'; o.dms = NOW - o.created; log.delivered++; if (o.pay === 'cash') L.cashDelivered = r2(L.cashDelivered + o.total);
}
// ---------- daily schedule ----------
const monthly = []; const t0 = RD.now(); const startDay = dayOf(NOW);
FAIL = 0;
await call('/save', { pin: '2468', by: 'أبو محمد', data, newDriverPin: '1357' });
await call('/push/sub', { pin: '2468', sub: { endpoint: 'https://push.sim/admin', keys: { p256dh: 'BNzuajcRGixV8KWDUs44IpLrdoK-PzKb28vvB_NBtm9BSaBO0gLlH-OoP41Mmmsc6BZjA7EBH0faD3PC9D3xYG0', auth: 'abcdefghijklmnopqrstuv' } } });
await call('/driver/push', { pin: '1357', sub: { endpoint: 'https://push.sim/driver', keys: { p256dh: 'BNzuajcRGixV8KWDUs44IpLrdoK-PzKb28vvB_NBtm9BSaBO0gLlH-OoP41Mmmsc6BZjA7EBH0faD3PC9D3xYG0', auth: 'abcdefghijklmnopqrstuv' } } });
await restock(); await setCosts(0.72); FAIL = 0.006;
const cashStart = (await admin('/admin/cash', {})).balance;
for (let d = 0; d < DAYS; d++) {
  const day0 = Date.UTC(2026, 10, 7) - 3 * 3600e3 + d * 864e5, dow = new RD(day0 + 15 * 3600e3).getUTCDay();
  // admin: morning
  if (dow === 6) at(day0 + 7.5 * 3600e3, restock);
  if (d === 40) at(day0 + 8 * 3600e3, () => setStore('minOrder', 15));
  if (d === 75) at(day0 + 8 * 3600e3, () => setCosts(0.75));
  if (d === 100) at(day0 + 8 * 3600e3, () => setStore('minOrder', null));
  if (d === 60) { at(day0 + 6 * 3600e3, () => setStore('closed', true)); at(day0 + 15 * 3600e3, () => setStore('closed', null)); }
  if (d % 9 === 4) at(day0 + 9 * 3600e3, priceChange);
  // customers: orders + browsing
  const n = Math.round(24 + d * 0.15 + (dow === 4 || dow === 5 ? 12 : 0) + (rnd() - 0.5) * 10);
  for (let k = 0; k < n; k++) {
    const r = rnd(), h = r < 0.18 ? 8 + rnd() * 3 : r < 0.45 ? 12 + rnd() * 3 : r < 0.92 ? 18 + rnd() * 4.5 : 15 + rnd() * 3;
    const pool = cust.filter(c => !c.churned && !(c.type === 'once' && c.ordered >= 1));
    const c = pool[Math.floor(Math.pow(rnd(), 1.4) * pool.length)];
    at(day0 + h * 3600e3, async () => { await customerOrder(c); if (c.type === 'occ' && c.ordered >= 2 && rnd() < 0.15) c.churned = true; });
  }
  for (let k = 0; k < 6; k++) at(day0 + (9 + rnd() * 12) * 3600e3, async () => { const v = {}, cc = {}; for (let i = 0; i < 6; i++) v[pick().id] = 1; if (rnd() < 0.3) cc[pick().id] = 1; await call('/ev', { visit: 1, v, c: cc, s: rnd() < 0.4 ? [{ q: rnd() < 0.5 ? 'نوتيلا' : 'حليب', f: rnd() < 0.5 ? 0 : 2 }] : [], co: rnd() < 0.3 ? 1 : 0 }); });
  // admin: phone/WhatsApp orders during the day
  const ns = 3 + Math.floor(rnd() * 5); for (let k = 0; k < ns; k++) at(day0 + (10 + rnd() * 11) * 3600e3, staffOrder);
  // admin: weekly win-back (customers who ordered once and didn't return in 30 days)
  if (dow === 0 && d > 30) at(day0 + 11 * 3600e3, async () => {
    const j = await admin('/admin/winback', { kind: 'once', days: 30 });
    if (!j.ok) { log.unexpected.push('winback ' + j.code); return; }
    for (const row of j.list.filter(r => !r.cat).slice(0, 12)) {
      const m = await admin('/admin/winback-mark', { ch: row.ch, tail: row.phone.slice(-4) }); if (!m.ok) continue;
      L.contacts[row.phone] = NOW; log.winbackSent++;
      const c = cust.find(x => x.phone === row.phone);
      if (c && rnd() < 0.35) { const when = NOW + (1 + rnd() * 9) * 864e5; at(when, () => customerOrder({ ...c, type: 'occ' }, 'winback').then(() => { c.ordered++; })); }
    }
  });
  // admin: evening cash handover
  at(day0 + 23.5 * 3600e3, async () => { const c = await admin('/admin/cash', {}); if (c.ok && c.balance > 0 && rnd() < 0.85) { const amt = Math.round(c.balance - (rnd() < 0.3 ? 20 : 0)); const r = await admin('/admin/cash', { add: amt, note: 'تسليم' }); if (r.ok) L.cashGot = r2(L.cashGot + amt); } });
  // admin: weekly verify
  if (dow === 3) at(day0 + 23.8 * 3600e3, async () => { FAIL = 0; const v = await admin('/admin/verify', { from: startDay }); FAIL = 0.006; log.verifies++; if (!v.clean) log.verifyBad++; });
  await runUntil(day0 + 864e5 - 30e3);
  if ((d + 1) % 30 === 0) {
    FAIL = 0; const s = await admin('/admin/stats', { days: 30 }); FAIL = 0.006;
    const to = dayOf(NOW), E = expect(s.from, to), G = got(s), bad = cmp(E, G);
    monthly.push({ m: monthly.length + 1, from: s.from, to, orders: E.orders, revenue: E.revenue, profit: r2(E.revenue - E.cost), canceled: E.canceled, delivered: E.delivered, newc: E.newc, bad });
    console.log('شهر', monthly.length, s.from, '→', to, '| طلبات', E.orders, '| مبيعات', E.revenue, '| ربح', r2(E.revenue - E.cost), '| فروقات:', bad.length ? bad.slice(0, 4) : 'صفر');
  }
}
await runUntil(NOW + 864e5); FAIL = 0;
function expect(from, to) {
  const E = { orders: 0, revenue: 0, items: 0, canceled: 0, delivered: 0, cost: 0, card: 0, fees: 0, newc: 0, prod: {} }, first = {};
  for (const o of Object.values(L.orders)) if (o.status !== 'canceled' && (!first[o.phone] || o.day < first[o.phone])) first[o.phone] = o.day;
  for (const o of Object.values(L.orders)) { if (o.day < from || o.day > to) continue; if (o.status === 'canceled') { E.canceled++; continue; }
    E.orders++; E.revenue += o.total; E.fees += o.fee; E.cost += costOfLines(o.lines); if (o.pay === 'card') E.card++; if (o.status === 'delivered') E.delivered++;
    for (const l of o.lines) { E.items += l.qty; E.prod[l.id] = (E.prod[l.id] || 0) + l.qty; } }
  E.newc = Object.values(first).filter(dd => dd >= from && dd <= to).length; E.revenue = r2(E.revenue); E.cost = r2(E.cost); E.fees = r2(E.fees); return E;
}
function got(s) { const cur = s.daily.filter(x => x.day >= s.from), sum = k => cur.reduce((a, x) => a + Number(x[k] || 0), 0), prod = {};
  s.items.forEach(x => { if (x.qty) prod[x.id] = x.qty; });
  return { orders: sum('orders'), revenue: r2(sum('revenue')), items: sum('items'), canceled: sum('canceled'), delivered: sum('deliv_n'), cost: r2(sum('cost')), card: sum('card'), fees: r2(sum('fees')), newc: s.customers.fresh || 0, prod }; }
function cmp(E, G) { const b = []; for (const k of ['orders', 'revenue', 'items', 'canceled', 'delivered', 'cost', 'card', 'fees', 'newc']) if (Math.abs(E[k] - G[k]) > 0.011) b.push(k + ' ' + E[k] + '/' + G[k]);
  for (const id of new Set([...Object.keys(E.prod), ...Object.keys(G.prod)])) if ((E.prod[id] || 0) !== (G.prod[id] || 0)) b.push(id + ' ' + (E.prod[id] || 0) + '/' + (G.prod[id] || 0)); return b; }
// ---------- final checks ----------
const ver = await admin('/admin/verify', { from: startDay });
const stock = (await admin('/admin/stock', {})).stock, stockBad = tracked.filter(id => stock[id] !== L.stock[id]).map(id => id + ' ' + L.stock[id] + '/' + stock[id]);
const cash = await admin('/admin/cash', {}), cashExp = r2(cashStart + L.cashDelivered - L.cashGot);
const wbk = await admin('/admin/winback', { kind: 'all', days: 7 });
const contacted = Object.keys(L.contacts), backExp = contacted.filter(ph => Object.values(L.orders).some(o => o.phone === ph && o.status !== 'canceled' && o.created > L.contacts[ph])).length;
const lg = await admin('/admin/log', {});
const all = await admin('/admin/stats', { days: 150 }), Eall = expect(all.from, dayOf(NOW)), badAll = cmp(Eall, got(all));
const counts = sq.prepare("SELECT COUNT(*) n, SUM(anon) anon, SUM(status='delivered') del, SUM(status='canceled') can, SUM(json_extract(data,'$.source') IS NOT NULL) staff FROM orders").get();
const out = { log, injected, monthly, verify: { clean: ver.clean, totals: ver.totals, dayDiffs: ver.dayDiffCount, itemDiffs: ver.itemDiffs, hourDiffs: ver.hourDiffs, pairDiffs: ver.pairDiffs },
  stockBad, cash: { server: cash.balance, ledger: cashExp }, winback: { server: wbk.stats, ledgerContacted: contacted.length, ledgerBack: backExp },
  whole: { orders: Eall.orders, revenue: Eall.revenue, profit: r2(Eall.revenue - Eall.cost), bad: badAll }, db: counts, pushes: pushes.length, logRows: lg.log.length, secs: Math.round((RD.now() - t0) / 1000), end: NOW };
fs.writeFileSync('sim5-result.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, monthly: undefined }, null, 1));
