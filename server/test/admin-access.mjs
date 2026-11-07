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
const catalog = JSON.parse(fs.readFileSync(new URL('../../data.json', import.meta.url)));
// المالك يقفل المتجر من الإدارة (closed) وهذا يتحفظ في data.json؛ الاختبار لازم ما يتأثر بحالة المحل اليوم
catalog.store = { ...catalog.store, closed: false }; delete catalog.store.minOrder; delete catalog.store.maxKm;
globalThis.fetch = async (url, options = {}) => new Response(JSON.stringify(String(url).includes('api.github.com') && !options.method ? catalog : { ok: true }));
let ip = 0;
async function call(path, body = {}, address) {
  const waits = [];
  const response = await worker.fetch(new Request('https://fixture.invalid' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': address || `10.0.0.${++ip}` }, body: JSON.stringify(body) }), env, { waitUntil(p) { waits.push(p); } });
  const result = await response.json(); await Promise.all(waits);
  return { status: response.status, ...result };
}
const owner = { pin: '2468' };
const account = { username: 'orders.one', name: 'فهد', role: 'orders', active: true, password: 'fixture-password-123' };
let ordersSession, managerSession, orderNo;

test('owner creates salted accounts; validation and account management are enforced', async () => {
  assert.equal((await call('/admin/staff', { pin: 'wrong' })).status, 401);
  assert.equal((await call('/admin/staff-save', { ...owner, ...account, password: '123' })).code, 'bad_staff');
  assert.equal((await call('/admin/staff-save', { ...owner, ...account })).ok, true);
  assert.equal((await call('/admin/staff-save', { ...owner, ...account })).code, 'username_taken');
  assert.equal((await call('/admin/staff-save', { ...owner, ...account, username: 'manager.one', role: 'manager' })).ok, true);
  const users = (await call('/admin/staff', owner)).users;
  assert.equal(users.length, 2);
  assert.ok(users.every(u => !('password_hash' in u) && !('salt' in u)));
  const rows = sql.prepare('SELECT * FROM staff_users').all();
  assert.ok(rows.every(u => u.password_hash !== account.password));
  assert.notEqual(rows[0].password_hash, rows[1].password_hash);
});

test('employee login uses generic errors and existing lockout protections', async () => {
  for (let n = 0; n < 5; n++) assert.equal((await call('/staff/login', { username: account.username, password: 'incorrect-password' }, '192.0.2.1')).code, 'bad_credentials');
  assert.equal((await call('/staff/login', { username: account.username, password: account.password }, '192.0.2.1')).code, 'locked');
  assert.equal((await call('/staff/login', { username: 'unknown', password: account.password })).code, 'bad_credentials');
  const result = await call('/staff/login', { username: 'ORDERS.ONE', password: account.password });
  assert.equal(result.ok, true); assert.equal(result.user.role, 'orders');
  assert.match(result.token, /^[a-f0-9]{64}$/); ordersSession = result.token;
  managerSession = (await call('/staff/login', { username: 'manager.one', password: account.password })).token;
  assert.ok(sql.prepare('SELECT token_hash FROM staff_sessions').all().every(s => s.token_hash !== ordersSession));
});

test('permissions are enforced by the server, including forged identity and privilege changes', async () => {
  for (const path of ['/save', '/admin/stats', '/admin/stock', '/admin/cash', '/admin/staff', '/admin/staff-save', '/admin/log', '/admin/order-new', '/admin/order-edit', '/driver/cash', '/driver/loc', '/driver/order-edit']) {
    assert.equal((await call(path, { session: ordersSession, pin: '2468', role: 'owner', by: 'صاحب المتجر' })).status, 403, path);
  }
  assert.equal((await call('/admin/stats', { session: managerSession, days: 7 })).ok, true);
  assert.equal((await call('/admin/staff', { session: managerSession })).status, 403);
  assert.equal((await call('/save', { session: managerSession, newPin: '9999' })).status, 403);
  assert.equal((await call('/save', { session: managerSession, newDriverPin: '9999' })).status, 403);
  assert.equal((await call('/admin/alerts', { session: 'a'.repeat(64), pin: '2468' })).code, 'session_expired');
  const product = catalog.products.find(p => p.stock);
  const created = await call('/admin/order-new', { ...owner, phone: '0551111111', lines: [{ id: product.id, qty: 1 }] });
  assert.equal(created.ok, true); orderNo = created.order.no;
  const contacts = await call('/admin/stats', { ...owner, days: 30 });
  assert.equal(contacts.topCustomers[0].phone, '0551111111');
  assert.ok(!('phone' in (await call('/admin/stats', { session: ordersSession }))));
  const listed = await call('/admin/orders', { session: ordersSession });
  assert.equal(listed.orders.length, 1);
  assert.ok(listed.orders[0].lines.every(l => !('cost' in l)));
  assert.equal((await call('/driver/status', { session: ordersSession, no: orderNo, status: 'accepted', by: 'forged-owner' })).ok, true);
  const logged = sql.prepare("SELECT who FROM alog WHERE act = 'status' ORDER BY id DESC LIMIT 1").get();
  assert.match(logged.who, /موظف #/); assert.ok(!logged.who.includes('forged'));
});

test('overdue alerts use stage timestamps, survive edits, and exclude terminal orders', async () => {
  const n = Number(orderNo.replace('#', '')) - 1000, now = Date.now();
  sql.prepare('UPDATE orders SET updated = ? WHERE no = ?').run(now, n);
  sql.prepare("UPDATE alog SET at = ? WHERE act = 'status' AND ref = ?").run(now - 31 * 60000, orderNo);
  let result = await call('/admin/alerts', { session: ordersSession });
  assert.equal(result.orders.length, 1); assert.equal(result.orders[0].limitMinutes, 30);
  assert.ok(result.orders[0].waitingMinutes >= 31);
  assert.ok(result.orders[0].lines.every(l => !('cost' in l)));
  assert.equal((await call('/driver/status', { session: ordersSession, no: orderNo, status: 'onway' })).ok, true);
  assert.equal((await call('/admin/alerts', owner)).orders.length, 0);
  sql.prepare("UPDATE alog SET at = ? WHERE act = 'status' AND ref = ? AND json_extract(info, '$.to') = 'onway'").run(now - 46 * 60000, orderNo);
  assert.equal((await call('/admin/alerts', owner)).orders[0].limitMinutes, 45);
  assert.equal((await call('/driver/status', { session: ordersSession, no: orderNo, status: 'delivered' })).ok, true);
  assert.equal((await call('/admin/alerts', owner)).orders.length, 0);
  sql.prepare("UPDATE orders SET status = 'new', created = ?, updated = ? WHERE no = ?").run(now - 11 * 60000, now, n);
  assert.equal((await call('/admin/alerts', owner)).orders[0].limitMinutes, 10);
  sql.prepare("UPDATE orders SET status = 'canceled' WHERE no = ?").run(n);
  assert.equal((await call('/admin/alerts', owner)).orders.length, 0);
  sql.prepare("UPDATE orders SET status = 'delivered', phone = '', anon = 1 WHERE no = ?").run(n);
  const anonymized = await call('/admin/stats', { ...owner, days: 30 });
  assert.equal(anonymized.topCustomers[0].phone, null);
});

test('logout, expiry, disabling and password reset revoke sessions', async () => {
  assert.equal((await call('/staff/logout', { session: ordersSession })).ok, true);
  assert.equal((await call('/admin/orders', { session: ordersSession })).code, 'session_expired');
  let login = await call('/staff/login', { username: account.username, password: account.password });
  sql.prepare('UPDATE staff_sessions SET expires = 0').run();
  assert.equal((await call('/admin/orders', { session: login.token })).code, 'session_expired');
  login = await call('/staff/login', { username: account.username, password: account.password });
  const user = (await call('/admin/staff', owner)).users.find(u => u.username === account.username);
  assert.equal((await call('/admin/staff-save', { ...owner, ...user, active: false })).ok, true);
  assert.equal((await call('/admin/orders', { session: login.token })).code, 'session_expired');
  assert.equal((await call('/staff/login', { username: account.username, password: account.password })).code, 'bad_credentials');
  assert.equal((await call('/admin/staff-save', { ...owner, ...user, active: true, password: 'new-fixture-password' })).ok, true);
  assert.equal((await call('/staff/login', { username: account.username, password: account.password })).code, 'bad_credentials');
  assert.equal((await call('/staff/login', { username: account.username, password: 'new-fixture-password' })).ok, true);
});
