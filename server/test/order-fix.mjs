// تصحيح الطلب بعد التوصيل (طلب المالك ١٤ نوفمبر ٢٠٢٦): السعر والاسم، والتحصيل والتحليل يتعدلون. التشغيل: node --test server/test/order-fix.mjs
import { githubMock } from './support/github.mjs';
// Local-only integration tests: real Worker, SQLite D1 adapter and in-memory KV.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import worker from '../worker.js';

const sql = new DatabaseSync(':memory:');
function prepare(query) {
  let args = [];
  return { sql: query, bind(...values) { args = values; return this; },
    async first() { return sql.prepare(query).get(...args) ?? null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
    async run() { return { meta: { changes: sql.prepare(query).run(...args).changes } }; } };
}
const DB = { prepare, async batch(statements) {
  sql.exec('BEGIN');
  try { const result = []; for (const statement of statements) result.push(await statement.run()); sql.exec('COMMIT'); return result; }
  catch (error) { sql.exec('ROLLBACK'); throw error; }
} };
const kv = new Map();
const LOCKS = { async get(k, type) { const value = kv.get(k); return value == null ? null : type === 'json' ? JSON.parse(value) : value; },
  async put(k, v) { kv.set(k, v); }, async delete(k) { kv.delete(k); } };
const origin = 'https://1097mbnalll-ui.github.io';
const env = { DB, LOCKS, GITHUB_TOKEN: 'test-fixture', ADMIN_PIN: '2468', SECRET: 'test-fixture-only', REPO: 'test/fixture', BRANCH: 'main', ALLOWED_ORIGIN: origin };
const catalog = JSON.parse(fs.readFileSync(new URL('./fixtures/catalog.json', import.meta.url)));
// المالك يقفل المتجر من الإدارة (closed) وهذا يتحفظ في data.json؛ الاختبار لازم ما يتأثر بحالة المحل اليوم
catalog.store = { ...catalog.store, closed: false }; delete catalog.store.minOrder; delete catalog.store.maxKm;
globalThis.fetch = githubMock(() => catalog, async (url, options = {}) => new Response(JSON.stringify(String(url).includes('api.github.com') && !options.method ? catalog : { ok: true })), false);
let ip = 0;
async function call(path, body = {}, address) {
  if(path==='/save'&&body.baseVersion===undefined)body={...body,baseVersion:(await call('/admin/catalog',{pin:body.pin,session:body.session})).version};
  const waits = [];
  const response = await worker.fetch(new Request('https://fixture.invalid' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': address || `10.0.0.${++ip}` }, body: JSON.stringify(body) }), env, { waitUntil(p) { waits.push(p); } });
  const result = await response.json(); await Promise.all(waits);
  return { status: response.status, ...result };
}
const owner = { pin: '2468' };
const P = catalog.products.filter((p) => p.stock && p.price > 0);
const delivered = async (lines, pay) => { const m = await call('/admin/order-new', { ...owner, phone: '0551111112', fee: 0, pay, lines }); assert.equal(m.ok, true, JSON.stringify(m)); const no = m.order.no; assert.equal((await call('/driver/status', { ...owner, no, status: 'accepted' })).ok, true); assert.equal((await call('/driver/status', { ...owner, no, status: 'onway' })).ok, true); assert.equal((await call('/driver/status', { ...owner, no, status: 'delivered' })).ok, true); return no; };

test('delivered cash order: fix price and name after delivery, collection and stats follow', async () => {
  const no = await delivered([{ id: P[0].id, qty: 2, price: 10 }], 'cash');
  const r = await call('/admin/order-edit', { ...owner, no, fee: 0, lines: [{ id: P[0].id, qty: 2, price: 8.5, name: 'اسم مصحح' }] });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.order.total, 17); assert.equal(r.order.lines[0].name, 'اسم مصحح');
  const pay = await call('/admin/payment', { ...owner, no }); assert.equal(pay.payment.cash, 1700);
  const v = await call('/admin/verify', { ...owner }); assert.equal(v.clean, true, JSON.stringify(v));
});

test('mixed cash+card delivered order must fix collection first', async () => {
  const no = await delivered([{ id: P[1].id, qty: 1, price: 20 }], 'cash');
  const p = await call('/admin/payment', { ...owner, no });
  assert.equal((await call('/admin/payment', { ...owner, no, save: true, cash: 10, card: 10, wallet: 0, revision: p.payment.revision, note: 'نص نص', requestId: 'operation_request_fixmixed' })).ok, true, 'mixed');
  assert.equal((await call('/admin/order-edit', { ...owner, no, fee: 0, lines: [{ id: P[1].id, qty: 1, price: 18 }] })).code, 'payment_locked');
});

test('order not delivered: name override kept, empty name falls back to the ordered name', async () => {
  const m = await call('/admin/order-new', { ...owner, phone: '0551111113', fee: 0, lines: [{ id: P[2].id, qty: 1, price: P[2].price }] });
  let r = await call('/admin/order-edit', { ...owner, no: m.order.no, fee: 0, lines: [{ id: P[2].id, qty: 1, price: P[2].price, name: '' }] });
  assert.equal(r.ok, true); assert.equal(r.order.lines[0].name, P[2].name);
});
