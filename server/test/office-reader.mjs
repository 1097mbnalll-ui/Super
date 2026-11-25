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
// قارئ المكتب (٢٥ نوفمبر ٢٠٢٦): مراقب «مكتب متاجر أحد» يقرأ بس، والجدول القديم يتحدّث بدون ما تضيع الحسابات
test('office reader role: old staff table migrates, read-only paths, sees costs, cannot write', async () => {
  sql.exec("CREATE TABLE staff_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('manager','orders','preparer','cashier','supervisor')), active INTEGER NOT NULL DEFAULT 1, password_hash TEXT NOT NULL, salt TEXT NOT NULL)");
  sql.exec("INSERT INTO staff_users (username,name,role,password_hash,salt) VALUES ('old.sup','مشرف قديم','supervisor','x','y')");
  const r = await call('/admin/staff-save', { ...owner, name: 'قارئ المكتب', role: 'reader', active: true, loginPin: '918273645501' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM staff_users").get().n, 2, 'الحسابات القديمة باقية');
  const e = await call('/enter', { pin: '918273645501' }); assert.equal(e.ok, true); assert.equal(e.go, 'staff');
  assert.equal(e.user.role, 'reader');
  const S = { session: e.token };
  for (const p of ['/admin/alerts', '/admin/today', '/admin/cash']) assert.equal((await call(p, S)).ok, true, p);
  const st = await call('/admin/stock', { ...S, summary: true }); assert.equal(st.ok, true);
  const full = await call('/admin/stock', S); assert.equal(full.ok, true); assert.ok('costs' in full, 'القارئ يشوف التكاليف عشان ينبه على البيع بخسارة');
  // ما يقدر يكتب أي شي
  assert.equal((await call('/admin/cash', { ...S, add: 50, drv: 'd0' })).status, 403);
  for (const p of ['/save', '/admin/orders', '/admin/order-new', '/admin/order-edit', '/admin/assign', '/admin/staff', '/admin/staff-save', '/admin/day-close', '/admin/settlement-confirm', '/admin/wallet-credit', '/admin/promo-push', '/admin/opex', '/admin/opex-save', '/admin/prep-mode', '/admin/catalog', '/admin/stats', '/driver/status', '/admin/winback-mark', '/admin/cashback', '/admin/promo-save', '/pos/sale']) assert.equal((await call(p, S)).status, 403, p);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM cash WHERE amount != 0").get().n, 0, 'ما انضاف كاش');
});
