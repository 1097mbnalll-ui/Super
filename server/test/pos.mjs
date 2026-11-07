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
const catalog = JSON.parse(fs.readFileSync(new URL('../../data.json', import.meta.url)));
globalThis.fetch = async (url, options = {}) => new Response(JSON.stringify(String(url).includes('api.github.com') && !options.method ? catalog : { ok: true }));
let ip = 0;
async function call(path, body = {}, address) {
  const waits = [];
  const response = await worker.fetch(new Request('https://fixture.invalid' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': address || `10.0.0.${++ip}` }, body: JSON.stringify(body) }), env, { waitUntil(p) { waits.push(p); } });
  const result = await response.json(); await Promise.all(waits);
  return { status: response.status, ...result };
}
const owner = { pin: '2468' };
let no,preview,cashierToken;
const product=catalog.products.find(p=>p.stock);
catalog.store.fee=0;catalog.store.freeOver=0;catalog.store.deal95={on:false};
catalog.store.daily={on:true,limit:2,list:[{id:product.id,price:73}]};product.price=75;delete product.old;
async function order(){return call('/order',{items:{['t:'+product.id]:1},phone:'0551111111',lat:24.84,lng:46.83});}

test('POS uses accepted app prices and offers, with an immutable 75 minus 2 equals 73 document',async()=>{
 const created=await order();assert.equal(created.ok,true);assert.equal(created.total,73);no=created.orderNo;
 preview=await call('/admin/pos-receipt',{...owner,no});assert.equal(preview.document.gross,7500);assert.equal(preview.document.discount,200);assert.equal(preview.document.total,7300);assert.equal(preview.current,false);
 assert.ok(!('cost' in preview.document.lines[0]));assert.ok(!('phone' in preview.document));
 const ordersBefore=sql.prepare('SELECT COUNT(*) n FROM orders').get().n;
 assert.equal((await call('/admin/pos-issue',{...owner,no,fingerprint:preview.fingerprint})).code,'review_required');
 const issued=await call('/admin/pos-issue',{...owner,no,fingerprint:preview.fingerprint,reviewed:true,document:{total:1}});
 assert.equal(issued.ok,true);assert.equal(issued.receipt.document.total,7300);assert.equal(issued.receipt.revision,1);
 assert.equal((await call('/admin/pos-issue',{...owner,no,fingerprint:preview.fingerprint,reviewed:true})).repeated,true);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM pos_receipts').get().n,1);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n,ordersBefore);
 assert.equal((await call('/driver/cash',owner)).balance,0);
 // Catalogue edits must not change the accepted order or its receipt.
 product.price=90;assert.equal((await call('/admin/pos-receipt',{...owner,no})).document.total,7300);
});

test('editing an order invalidates the old receipt and creates a numbered new revision',async()=>{
 assert.equal((await call('/admin/order-edit',{...owner,no,fee:0,lines:[{id:product.id,qty:1,price:72}]})).ok,true);
 const changed=await call('/admin/pos-receipt',{...owner,no});assert.equal(changed.current,false);assert.equal(changed.receipt.document.total,7300);assert.equal(changed.document.total,7200);assert.equal(changed.document.gross,7500);
 assert.equal((await call('/admin/pos-issue',{...owner,no,fingerprint:preview.fingerprint,reviewed:true})).code,'conflict');
 const revised=await call('/admin/pos-issue',{...owner,no,fingerprint:changed.fingerprint,reviewed:true});assert.equal(revised.receipt.revision,2);assert.equal(revised.receipt.document.total,7200);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM pos_receipts').get().n,2);
});

test('cashier migration preserves staff and enforces limited POS and collection permissions',async()=>{
 sql.exec("CREATE TABLE staff_users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('manager','orders','preparer')),active INTEGER NOT NULL DEFAULT 1,password_hash TEXT NOT NULL,salt TEXT NOT NULL); INSERT INTO staff_users(username,name,role,password_hash,salt) VALUES('legacy.prep','سابق','preparer','fixture','fixture');");
 assert.equal((await call('/admin/staff-save',{...owner,username:'cashier.one',name:'الكاشير',role:'cashier',password:'fixture-password-123'})).ok,true);
 assert.equal(sql.prepare("SELECT name FROM staff_users WHERE username='legacy.prep'").get().name,'سابق');
 const login=await call('/staff/login',{username:'cashier.one',password:'fixture-password-123'});cashierToken=login.token;assert.equal(login.user.role,'cashier');
 assert.equal((await call('/admin/pos-orders',{session:cashierToken})).ok,true);
 assert.equal((await call('/admin/pos-receipt',{session:cashierToken,no})).ok,true);
 for(const path of ['/save','/admin/stats','/admin/stock','/admin/wallet','/admin/wallet-credit','/admin/staff','/admin/order-edit','/admin/pos-settings','/driver/status'])assert.equal((await call(path,{session:cashierToken,pin:'2468'})).status,403,path);
 assert.equal((await call('/admin/settlement-requests',{session:cashierToken})).ok,true);
});

test('optional cashier approval blocks unapproved departure and locks edits after dispatch',async()=>{
 const created=await order(),pending=created.orderNo;
 assert.equal((await call('/admin/pos-settings',owner)).settings.require_receipt,0);
 assert.equal((await call('/admin/pos-settings',{...owner,save:true,requireReceipt:true})).ok,true);
 assert.equal((await call('/driver/status',{...owner,no:pending,status:'onway'})).code,'pos_required');
 const p=await call('/admin/pos-receipt',{session:cashierToken,no:pending});
 assert.equal((await call('/admin/pos-issue',{session:cashierToken,no:pending,fingerprint:p.fingerprint,reviewed:true})).ok,true);
 assert.equal((await call('/driver/status',{...owner,no:pending,status:'onway'})).ok,true);
 assert.equal((await call('/admin/order-edit',{...owner,no:pending,fee:0,lines:[{id:product.id,qty:1,price:71}]})).code,'pos_locked');
 assert.equal((await call('/driver/status',{...owner,no:pending,status:'delivered'})).ok,true);
 assert.equal((await call('/admin/pos-receipt',{session:cashierToken,no:pending})).current,true);
});

test('the existing PIN-based POS opens delivery receipts without another login or sale',async()=>{
 assert.equal((await call('/admin/team-save',{...owner,name:'كاشير برقم',role:'cashier',newPin:'3333'})).ok,true);
 assert.equal((await call('/pos/login',{pin:'3333'})).ok,true);
 const delivery=await order();
 const listed=await call('/pos/delivery-orders',{pin:'3333'});assert.equal(listed.ok,true);assert.ok(listed.orders.find(o=>o.no===delivery.orderNo));
 const view=await call('/pos/delivery-receipt',{pin:'3333',no:delivery.orderNo});assert.equal(view.document.total,7300);
 assert.equal((await call('/pos/delivery-issue',{pin:'3333',no:delivery.orderNo,fingerprint:view.fingerprint,reviewed:true})).ok,true);
 const retail=await call('/pos/sale',{pin:'3333',cid:'pos-retail-test-id',lines:[{id:product.id,qty:1}],pay:'cash'});
 assert.equal(retail.ok,true);
 assert.ok(!(await call('/pos/delivery-orders',{pin:'3333'})).orders.find(o=>o.no===retail.no));
 assert.equal((await call('/pos/delivery-receipt',{pin:'3333',no:retail.no})).code,'not_delivery');
});

test('canceled orders cannot be printed or approved at the POS',async()=>{
 assert.equal((await call('/driver/status',{...owner,no,status:'canceled'})).ok,true);
 assert.equal((await call('/admin/pos-receipt',{session:cashierToken,no})).code,'canceled');
 assert.equal((await call('/admin/pos-issue',{session:cashierToken,no,fingerprint:preview.fingerprint,reviewed:true})).code,'canceled');
});
