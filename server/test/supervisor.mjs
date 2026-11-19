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
  return { bind(...values) { args = values; return this; },
    async first() { return sql.prepare(query).get(...args) ?? null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
    async run() { const r = sql.prepare(query).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } };
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
// المشرف (١٩ نوفمبر ٢٠٢٦): متابعة الطلبات والتواصل بس، والجدول القديم (بدون supervisor) يتحدّث بدون ما تضيع الحسابات
test('supervisor role: old staff table migrates, limited paths, no costs', async () => {
  sql.exec("CREATE TABLE staff_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('manager','orders','preparer','cashier')), active INTEGER NOT NULL DEFAULT 1, password_hash TEXT NOT NULL, salt TEXT NOT NULL)");
  sql.exec("INSERT INTO staff_users (username,name,role,password_hash,salt) VALUES ('old.mgr','قديم','manager','x','y')");
  const r = await call('/admin/staff-save', { ...owner, username: 'najeeb', name: 'نجيب', role: 'supervisor', active: true, loginPin: '445566' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM staff_users").get().n, 2);
  const e = await call('/enter', { pin: '445566' }); assert.equal(e.ok, true); assert.equal(e.go, 'staff');
  const S = { session: e.token };
  assert.equal(e.user.role, 'supervisor');
  for (const p of ['/admin/orders', '/admin/alerts', '/admin/winback', '/admin/ratings', '/admin/order-times', '/admin/today', '/admin/catalog']) assert.notEqual((await call(p, S)).status, 403, p);
  for (const p of ['/save', '/admin/stats', '/admin/stock', '/admin/cash', '/admin/staff', '/admin/staff-save', '/admin/order-new', '/admin/order-edit', '/admin/day-close', '/admin/settlement-confirm', '/admin/wallet-credit', '/admin/promo-push', '/admin/opex', '/admin/prep-mode']) assert.equal((await call(p, S)).status, 403, p);
  const t = await call('/admin/today', S); assert.equal(JSON.stringify(t).includes('"profit"'), false); assert.equal(JSON.stringify(t).includes('"cost"'), false);
});
