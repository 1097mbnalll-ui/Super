import { githubMock } from './support/github.mjs';
// محاكاة ٤ شهور قدام: طلبات حقيقية تمر على كود الخادم نفسه، مع سجل مستقل نقارن فيه النتائج
import w from '../worker.js'; import fs from 'fs'; import { DatabaseSync } from 'node:sqlite';
const DBFILE = process.argv[2] || ':memory:'; if (DBFILE !== ':memory:' && fs.existsSync(DBFILE)) fs.unlinkSync(DBFILE);
const sq = new DatabaseSync(DBFILE);
let FAIL_RATE = 0.01, injected = 0;
const mk = (sql) => { let a = []; const st = { sql, bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes } }; } }; return st; };
const DB = { prepare: mk, async batch(l) { sq.exec('BEGIN'); try { const o = []; const failAt = l.length > 3 && Math.random() < FAIL_RATE ? Math.floor(Math.random() * l.length) : -1;
  for (let i = 0; i < l.length; i++) { if (i === failAt) { injected++; throw new Error('injected D1 failure'); } o.push(await l[i].run()); } sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async k => kv.delete(k) };
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: 'https://1097mbnalll-ui.github.io', LOCKS, DB };
const data = JSON.parse(fs.readFileSync(new URL('../../data.json', import.meta.url), 'utf8'));
data.store.daily = { on: false, list: [] }; if (data.store.deal95) data.store.deal95.on = false; delete data.store.minOrder; delete data.store.closed; data.store.keepDays = 90; data.store.lowAt = 3;
data.products.forEach(p => { delete p.max; });
const S = data.store, FEE = Number(S.fee || 0), FREE = Number(S.freeOver || 0);
globalThis.fetch = githubMock(() => data, async (u, o = {}) => { u = String(u); if (u.includes('api.github.com') && !o.method) return new Response(JSON.stringify(data)); return new Response('{"ok":true}'); }, false);
// fake clock
let NOW = Date.UTC(2026, 10, 5, 5, 0); const RealDate = Date; Date.now = () => NOW;
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; Math.random = rnd;
const O = 'https://1097mbnalll-ui.github.io'; let ipn = 0;
const call = async (path, body) => { if(path==='/save'&&body.baseVersion===undefined)body={...body,baseVersion:(await call('/admin/catalog',{pin:body.pin})).version}; const waits = []; const r = await w.fetch(new Request('https://x.dev' + path, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': '10.' + (++ipn % 250) + '.' + Math.floor(ipn / 250) % 250 + '.1' }, body: JSON.stringify(body) }), env, { waitUntil: p => waits.push(p) }); const j = await r.json(); await Promise.all(waits); return j; };
const dayOf = ms => new RealDate(ms + 3 * 3600e3).toISOString().slice(0, 10);
const r2 = n => Math.round(n * 100) / 100;
// catalog & customers
const prods = data.products.filter(p => p.stock); const byId = Object.fromEntries(data.products.map(p => [p.id, p]));
const popular = prods.map((p, i) => ({ p, wgt: 1 / (1 + i * 0.25) }));
const pick = () => { let t = popular.reduce((s, x) => s + x.wgt, 0) * rnd(); for (const x of popular) { if ((t -= x.wgt) <= 0) return x.p; } return popular[0].p; };
const AFF = { bakery1: 'dairy1', bakery3: 'dairy3', veg0: 'veg1', meat0: 'pantry0' };
const phones = Array.from({ length: 450 }, (_, i) => '05' + String(51000000 + i * 7919).slice(0, 8));
const pickPhone = () => phones[Math.floor(Math.pow(rnd(), 2.2) * phones.length)];
// ledger (independent truth)
const L = { orders: {}, stock: {} }; const tracked = ['bakery1', 'bakery2', 'dairy1', 'dairy3', 'dairy4', 'veg0', 'meat0', 'drinks1'].filter(id => byId[id] && byId[id].stock);
const restock = async () => { const set = {}; for (const id of tracked) { set[id] = 60 + Math.floor(rnd() * 80); } FAIL_RATE = 0; const j = await call('/save', { pin: '2468', data, stock: set }); FAIL_RATE = 0.01; if (!j.ok) throw new Error('restock ' + JSON.stringify(j)); Object.assign(L.stock, set); };
await call('/save', { pin: '2468', data, newDriverPin: '1357' });
await restock();
const log = { placed: 0, rejectedStock: 0, rejectedDb: 0, mismatchTotal: 0, edits: 0, cancels: 0, uncancels: 0, delivered: 0, stockouts: 0, unexpectedReject: 0 };
const pending = []; // [time, fn]
const DAYS = 120, monthly = [];
const startDay = dayOf(NOW);
async function placeOrder() {
  const n = 1 + Math.floor(Math.pow(rnd(), 1.4) * 7), items = {};
  for (let i = 0; i < n; i++) { const p = pick(); items[p.id] = (items[p.id] || 0) + 1 + (rnd() < 0.2 ? 1 : 0); if (AFF[p.id] && rnd() < 0.55 && byId[AFF[p.id]].stock) items[AFF[p.id]] = (items[AFF[p.id]] || 0) + 1; }
  const phone = pickPhone(), pay = rnd() < 0.42 ? 'card' : 'cash';
  const short = Object.keys(items).find(id => L.stock[id] != null && L.stock[id] < items[id]);
  const j = await call('/order', { items, phone, pay, lat: 24.84, lng: 46.83, details: 'بيت', name: 'زبون' });
  if (!j.ok) { if (j.code === 'unavailable') { log.rejectedStock++; if (!short) log.unexpectedReject++; } else if (j.code === 'db') log.rejectedDb++; else { log.unexpectedReject++; console.log('reject', j); } return; }
  if (short) log.unexpectedReject++;
  const lines = Object.entries(items).map(([id, qty]) => ({ id, qty, price: byId[id].price }));
  const sub = r2(lines.reduce((s, l) => s + l.qty * l.price, 0)), fee = FREE && sub >= FREE ? 0 : FEE, total = r2(sub + fee);
  if (Math.abs(total - j.total) > 0.001) log.mismatchTotal++;
  for (const l of lines) if (L.stock[l.id] != null) { L.stock[l.id] -= l.qty; if (L.stock[l.id] === 0) log.stockouts++; }
  const o = { no: j.orderNo, created: NOW, day: dayOf(NOW), phone, pay, lines, fee, total, status: 'new', dms: 0 }; L.orders[o.no] = o; log.placed++;
  // what happens next
  const r = rnd();
  if (r < 0.06) pending.push([NOW + (5 + rnd() * 30) * 60e3, () => setStatus(o, 'canceled')]);
  else {
    if (r < 0.11) pending.push([NOW + (3 + rnd() * 8) * 60e3, () => editOrder(o)]);
    pending.push([NOW + (2 + rnd() * 10) * 60e3, () => setStatus(o, 'accepted')]);
    pending.push([NOW + (15 + rnd() * 15) * 60e3, () => setStatus(o, 'onway')]);
    const dt = (25 + rnd() * 40) * 60e3; pending.push([NOW + dt + 60e3, () => setStatus(o, 'delivered')]);
    if (rnd() < 0.02) pending.push([NOW + 20 * 60e3, () => setStatus(o, 'canceled')]);
  }
}
async function setStatus(o, st) {
  if (o.status === st || (o.status === 'canceled' && st !== 'new') || (o.status === 'delivered')) return;
  const j = await call('/driver/status', { pin: '1357', no: o.no, status: st }); if (!j.ok) return; // failed write: nothing changed, retry later
  if (st === 'canceled' && o.status !== 'canceled') { log.cancels++; for (const l of o.lines) if (L.stock[l.id] != null) L.stock[l.id] += l.qty; if (rnd() < 0.08) pending.push([NOW + 10 * 60e3, () => uncancel(o)]); }
  if (st === 'delivered') { o.dms = NOW - o.created; log.delivered++; }
  o.status = st;
}
async function uncancel(o) { // الإدارة ترجّع طلب انلغى بالغلط
  const short = o.lines.find(l => L.stock[l.id] != null && L.stock[l.id] < l.qty); if (short) return;
  const j = await call('/driver/status', { pin: '2468', no: o.no, status: 'new' }); if (!j.ok) return;
  log.uncancels++; for (const l of o.lines) if (L.stock[l.id] != null) L.stock[l.id] = Math.max(0, L.stock[l.id] - l.qty); o.status = 'new';
  pending.push([NOW + 30 * 60e3, () => setStatus(o, 'delivered')]);
}
async function editOrder(o) {
  if (o.status === 'canceled' || o.status === 'delivered') return;
  const lines = o.lines.map(l => ({ ...l })); const r = rnd();
  if (r < 0.5) { const p = pick(); const ex = lines.find(l => l.id === p.id); if (ex) ex.qty++; else lines.push({ id: p.id, qty: 1, price: p.price }); }
  else if (r < 0.8 && lines.length > 1) lines.splice(Math.floor(rnd() * lines.length), 1);
  else lines[0].price = r2(lines[0].price * 0.9);
  for (const l of lines) { const before = (o.lines.find(x => x.id === l.id) || { qty: 0 }).qty; if (L.stock[l.id] != null && L.stock[l.id] < l.qty - before) return; }
  const j = await call('/admin/order-edit', { pin: '2468', no: o.no, fee: o.fee, lines: lines.map(l => ({ id: l.id, qty: l.qty, price: l.price })) }); if (!j.ok) return;
  const need = (ls) => { const m = {}; ls.forEach(l => m[l.id] = (m[l.id] || 0) + l.qty); return m; }; const a = need(o.lines), b = need(lines);
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) if (L.stock[id] != null) L.stock[id] = Math.max(0, L.stock[id] - ((b[id] || 0) - (a[id] || 0)));
  o.lines = lines; o.total = r2(r2(lines.reduce((s, l) => s + l.qty * l.price, 0)) + o.fee); log.edits++;
  if (Math.abs(o.total - j.order.total) > 0.001) log.mismatchTotal++;
}
async function runPending(until) { pending.sort((a, b) => a[0] - b[0]); while (pending.length && pending[0][0] <= until) { const [t, fn] = pending.shift(); NOW = Math.max(NOW, t); await fn(); pending.sort((a, b) => a[0] - b[0]); } }
// expected stats from ledger
function expect(from, to) {
  const E = { orders: 0, revenue: 0, items: 0, canceled: 0, delivered: 0, delivRev: 0, card: 0, fees: 0, prod: {}, newc: 0 };
  const first = {}; Object.values(L.orders).filter(o => o.status !== 'canceled').forEach(o => { if (!first[o.phone] || o.day < first[o.phone]) first[o.phone] = o.day; });
  for (const o of Object.values(L.orders)) { if (o.day < from || o.day > to) continue;
    if (o.status === 'canceled') { E.canceled++; continue; }
    E.orders++; E.revenue += o.total; E.fees += o.fee; if (o.pay === 'card') E.card++; for (const l of o.lines) { E.items += l.qty; E.prod[l.id] = (E.prod[l.id] || 0) + l.qty; }
    if (o.status === 'delivered') { E.delivered++; E.delivRev += o.total; } }
  E.newc = Object.values(first).filter(d => d >= from && d <= to).length; E.revenue = r2(E.revenue); E.delivRev = r2(E.delivRev); return E;
}
function fromStats(j) {
  const cur = j.daily.filter(d => d.day >= j.from); const sum = k => cur.reduce((s, d) => s + Number(d[k] || 0), 0);
  const prod = {}; j.items.forEach(x => { if (x.qty) prod[x.id] = x.qty; });
  return { orders: sum('orders'), revenue: r2(sum('revenue')), items: sum('items'), canceled: sum('canceled'), delivered: sum('deliv_n'), delivRev: r2(sum('deliv_rev')), card: sum('card'), fees: r2(sum('fees')), prod, newc: j.customers.fresh || 0 };
}
function compare(E, G) { const bad = []; for (const k of ['orders', 'revenue', 'items', 'canceled', 'delivered', 'delivRev', 'card', 'fees', 'newc']) if (Math.abs(E[k] - G[k]) > 0.011) bad.push(k + ': متوقع ' + E[k] + ' / التحليل ' + G[k]);
  for (const id of new Set([...Object.keys(E.prod), ...Object.keys(G.prod)])) if ((E.prod[id] || 0) !== (G.prod[id] || 0)) bad.push('منتج ' + id + ': ' + (E.prod[id] || 0) + ' / ' + (G.prod[id] || 0)); return bad; }
// main loop
const t0 = RealDate.now();
for (let d = 0; d < DAYS; d++) {
  const dayStart = Date.UTC(2026, 10, 5) - 3 * 3600e3 + d * 864e5; // midnight Riyadh
  const dow = new RealDate(dayStart + 3 * 3600e3 + 12 * 3600e3).getUTCDay();
  if (dow === 6) await restock(); // السبت: توريد
  const base = 22 + d * 0.22 + (dow === 4 || dow === 5 ? 12 : 0) + (rnd() - 0.5) * 10;
  const n = Math.max(5, Math.round(base));
  const times = Array.from({ length: n }, () => { const r = rnd(); const h = r < 0.18 ? 8 + rnd() * 3 : r < 0.45 ? 12 + rnd() * 3 : r < 0.92 ? 18 + rnd() * 4.5 : 15 + rnd() * 3; return dayStart + h * 3600e3; }).sort((a, b) => a - b);
  for (const t of times) { await runPending(t); NOW = t; await placeOrder();
    if (rnd() < 0.9) { const v = {}; for (let k = 0; k < 4; k++) v[pick().id] = 1; await call('/ev', { visit: 1, v, c: {}, s: rnd() < 0.3 ? [{ q: rnd() < 0.5 ? 'نوتيلا' : 'حليب', f: 0 }] : [], co: 1 }); }
    for (let k = 0; k < 6; k++) await call('/ev', { visit: 1, v: { [pick().id]: 1 }, c: rnd() < 0.2 ? { [pick().id]: 1 } : {}, s: [] }); }
  await runPending(dayStart + 864e5 - 60e3); NOW = dayStart + 864e5 - 60e3;
  if ((d + 1) % 30 === 0) {
    FAIL_RATE = 0; const j = await call('/admin/stats', { pin: '2468', days: 30 }); FAIL_RATE = 0.01;
    const E = expect(j.from, dayOf(NOW)), G = fromStats(j), bad = compare(E, G);
    monthly.push({ month: monthly.length + 1, from: j.from, to: dayOf(NOW), E, G, bad, cust: j.customers });
    console.log('شهر', monthly.length, j.from, '→', dayOf(NOW), '| طلبات', E.orders, '| مبيعات', E.revenue, '| ملغي', E.canceled, '| فروقات:', bad.length ? bad.slice(0, 5) : 'صفر');
  }
}
await runPending(NOW + 864e5);
FAIL_RATE = 0;
// final: whole period checks
const ver = await call('/admin/verify', { pin: '2468', from: startDay });
const stock = (await call('/admin/stock', { pin: '2468' })).stock; const stockBad = tracked.filter(id => stock[id] !== L.stock[id]).map(id => id + ' ' + L.stock[id] + '/' + stock[id]);
const all = await call('/admin/stats', { pin: '2468', days: 120 }); const Eall = expect(all.from, dayOf(NOW)), badAll = compare(Eall, fromStats(all));
const totalOrders = sq.prepare('SELECT COUNT(*) n, SUM(anon) a FROM orders').get(); const anonPhones = sq.prepare("SELECT COUNT(*) n FROM orders WHERE anon = 1 AND phone != ''").get().n;
const cust = all.customers, phonesUsed = new Set(Object.values(L.orders).filter(o => o.status !== 'canceled').map(o => o.phone)).size;
const out = { log, injected, ver: { clean: ver.clean, totals: ver.totals, dayDiffCount: ver.dayDiffCount, itemDiffs: ver.itemDiffs, hourDiffs: ver.hourDiffs, pairDiffs: ver.pairDiffs }, stockBad, badAll, Eall: { ...Eall, prod: undefined }, totalOrders, anonPhones, cust, phonesUsed, monthly: monthly.map(m => ({ month: m.month, from: m.from, to: m.to, orders: m.E.orders, revenue: m.E.revenue, canceled: m.E.canceled, delivered: m.E.delivered, newc: m.E.newc, bad: m.bad })), secs: Math.round((RealDate.now() - t0) / 1000), end: NOW };
fs.writeFileSync('sim-result.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify({ log, injected, ver: out.ver, stockBad, badAll, totalOrders, anonPhones, cust, phonesUsed, secs: out.secs }, null, 1));
