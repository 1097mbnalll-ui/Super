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
let no, walletToken, ordersToken, prepToken;
const phone='0551111111', day=()=>new Date(Date.now()+3*3600e3).toISOString().slice(0,10);
const request=n=>'operation_request_'+n;
async function payment(){return call('/admin/payment',{...owner,no});}
async function changePayment(cash,card,wallet,n){const p=await payment();return call('/admin/payment',{...owner,no,save:true,cash,card,wallet,revision:p.payment.revision,note:'اختبار تصحيح',requestId:request(n)});}

test('split collection preserves sales, checks exact cents and request idempotency',async()=>{
 const product=catalog.products.find(p=>p.stock);
 const made=await call('/admin/order-new',{...owner,phone,fee:0,lines:[{id:product.id,qty:1,price:13}]});assert.equal(made.ok,true);no=made.order.no;
 assert.equal((await call('/driver/status',{...owner,no,status:'delivered'})).ok,true);
 const before=await call('/admin/day-report',{...owner,day:day()});assert.equal(before.cash,1300);
 const wrong=await changePayment(8,6,0,'invalid');assert.equal(wrong.code,'payment_total');
 assert.equal((await changePayment(8,5,0,'split')).ok,true);
 const p=await payment();assert.equal(p.payment.cash,800);assert.equal(p.payment.card,500);
 const report=await call('/admin/day-report',{...owner,day:day()});assert.equal(report.sales,1300);assert.equal(report.cash,800);assert.equal(report.card,500);
 assert.equal((await call('/admin/cash',owner)).balance,8);
 assert.equal((await changePayment(8,5,0,'split')).repeated,true);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM collection_changes').get().n,1);
 assert.equal((await call('/admin/payment',{...owner,no,save:true,revision:0,cash:13,card:0,wallet:0,note:'stale',requestId:request('stale')})).code,'conflict');
});

test('day close records actual receipt once and shows later adjustments',async()=>{
 const r=await call('/admin/day-report',{...owner,day:day()});
 assert.equal((await call('/admin/day-close',{...owner,day:day(),expected:r.outstanding,actual:7,note:'نقص ريال'})).difference,-100);
 assert.equal((await call('/admin/cash',owner)).balance,1);
 assert.equal((await call('/admin/day-close',{...owner,day:day(),expected:100,actual:1,note:'كرر'})).code,'already_closed');
 assert.equal((await changePayment(9,4,0,'afterclose')).ok,true);
 const after=await call('/admin/day-report',{...owner,day:day()});assert.equal(after.closure.actual,700);assert.equal(after.adjustment,100);assert.equal(after.outstanding,200);assert.equal(after.adjustments.card,-100);
 assert.equal((await call('/admin/cash',owner)).balance,2);
});

test('wallet credits and credentials are private, authenticated and idempotent',async()=>{
 assert.equal((await call('/admin/wallet-credit',{...owner,phone,amount:100,note:'رصيد موثق',requestId:request('credit')})).ok,true);
 assert.equal((await call('/admin/wallet-credit',{...owner,phone,amount:100,note:'نفس الطلب',requestId:request('credit')})).repeated,true);
 assert.equal((await call('/admin/wallet',{...owner,phone})).balance,10000);
 assert.equal((await call('/admin/wallet-account',{...owner,phone,password:'fixture-wallet-password'})).ok,true);
 assert.equal((await call('/wallet/login',{phone,password:'incorrect'})).code,'bad_credentials');
 const login=await call('/wallet/login',{phone,password:'fixture-wallet-password'});assert.equal(login.balance,100);walletToken=login.token;
 const view=await call('/wallet/me',{token:walletToken});assert.equal(view.phone,phone);assert.equal(view.balance,100);assert.ok(!('password_hash' in view));
 assert.equal((await call('/wallet/me',{phone,token:'fake'})).code,'session_expired');
});

test('wallet checkout debits atomically, rejects another customer and refunds cancellation',async()=>{
 const product=catalog.products.find(p=>p.stock&&p.price>=1);const body={items:{[product.id]:1},phone,lat:24.84,lng:46.83,walletAmount:1,walletToken,walletRequestId:request('checkout')};
 assert.equal((await call('/order',{...body,phone:'0552222222'})).code,'wallet_login');
 assert.equal((await call('/order',{...body,walletAmount:0.001})).code,'bad_payment');
 const made=await call('/order',body);assert.equal(made.ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,99);
 const repeated=await call('/order',body);assert.equal(repeated.repeated,true);assert.equal(repeated.orderNo,made.orderNo);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,99);
 assert.equal((await call('/driver/status',{...owner,no:made.orderNo,status:'canceled'})).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,100);
 assert.equal((await call('/driver/status',{...owner,no:made.orderNo,status:'canceled'})).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,100);
});

test('cashback is capped, revised with payments and reversed without repeat earnings',async()=>{
 assert.equal((await call('/admin/cashback',{...owner,save:true,enabled:true,rate:10,cap:5})).ok,true);
 const product=catalog.products.find(p=>p.stock);
 const made=await call('/admin/order-new',{...owner,phone,fee:0,lines:[{id:product.id,qty:1,price:13}]});no=made.order.no;
 assert.equal((await call('/driver/status',{...owner,no,status:'delivered'})).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,101.3);
 assert.equal((await changePayment(5,5,3,'walletsplit')).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,98);
 assert.equal((await changePayment(8,5,0,'walletreturn')).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,101.3);
 assert.equal((await changePayment(8,5,0,'walletreturn')).repeated,true);
 assert.equal((await call('/driver/status',{...owner,no,status:'canceled'})).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,100);
 assert.equal((await call('/driver/status',{...owner,no,status:'delivered'})).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,101.3);
 const insufficient=await changePayment(0,0,13,'overdraft'); // Enough balance; changing total must still be exact.
 assert.equal(insufficient.ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,87);
 assert.equal((await call('/driver/status',{...owner,no,status:'canceled'})).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,100);
});

test('preparer role is isolated and ready requires complete picking with concurrency checks',async()=>{
 // Simulate an existing published deployment whose staff CHECK predates the preparer role.
 sql.exec("CREATE TABLE staff_users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('manager','orders')),active INTEGER NOT NULL DEFAULT 1,password_hash TEXT NOT NULL,salt TEXT NOT NULL); INSERT INTO staff_users(username,name,role,password_hash,salt) VALUES('legacy.manager','قديم','manager','fixture','fixture');");
 for(const [username,role] of [['prep.one','preparer'],['orders.one','orders']]){
  assert.equal((await call('/admin/staff-save',{...owner,username,name:'عامل',role,password:'fixture-password-123'})).ok,true);
  const login=await call('/staff/login',{username,password:'fixture-password-123'});assert.equal(login.ok,true);if(role==='preparer')prepToken=login.token;else ordersToken=login.token;
 }
 assert.equal(sql.prepare("SELECT name FROM staff_users WHERE username='legacy.manager'").get().name,'قديم');
 for(const path of ['/admin/day-report','/admin/payment','/admin/cash','/admin/wallet','/admin/wallet-credit','/admin/cashback','/driver/status','/admin/orders'])assert.equal((await call(path,{session:prepToken,pin:'2468'})).status,403,path);
 assert.equal((await call('/admin/prep',{session:ordersToken})).status,403);
 const product=catalog.products.find(p=>p.stock),made=await call('/admin/order-new',{...owner,lines:[{id:product.id,qty:2}],phone});
 const list=await call('/admin/prep',{session:prepToken});const order=list.orders.find(o=>o.no===made.order.no);assert.ok(order);assert.ok(!('phone' in order));assert.ok(!('price' in order.lines[0]));
 const base={session:prepToken,no:order.no,version:order.version,orderUpdated:order.orderUpdated};
 assert.equal((await call('/admin/prep-save',{...base,stage:'ready',checks:{0:'missing'}})).code,'missing_items');
 assert.equal((await call('/admin/prep-save',{...base,stage:'preparing',checks:{0:'missing'}})).ok,true);
 assert.equal((await call('/driver/status',{...owner,no:order.no,status:'onway'})).code,'not_ready');
 assert.equal((await call('/admin/prep-save',{...base,stage:'ready',checks:{0:'picked'}})).code,'conflict');
 assert.equal((await call('/admin/prep-save',{...base,version:1,stage:'ready',checks:{0:'picked'}})).ok,true);
 const driver=await call('/driver/orders',owner);assert.equal(driver.orders.find(o=>o.no===order.no).prepStage,'ready');
});

test('failed financial batch rolls back the balance, payment split and audit together',async()=>{
 const product=catalog.products.find(p=>p.stock);
 const made=await call('/admin/order-new',{...owner,phone,fee:0,lines:[{id:product.id,qty:1,price:13}]});no=made.order.no;
 assert.equal((await call('/driver/status',{...owner,no,status:'delivered'})).ok,true);
 const balance=(await call('/admin/wallet',{...owner,phone})).balance, prior=await payment();
 const originalBatch=DB.batch;
 DB.batch=async function(st){if(st.some(s=>s.sql?.includes('INSERT INTO collection_changes')))return originalBatch([...st,prepare("SELECT json('injected')")]);return originalBatch(st);};
 try{assert.equal((await changePayment(5,5,3,'injected')).code,'conflict');}finally{DB.batch=originalBatch;}
 assert.equal((await call('/admin/wallet',{...owner,phone})).balance,balance);
 assert.equal((await payment()).payment.revision,prior.payment.revision);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM collection_changes WHERE request_id=?').get(request('injected')).n,0);
 const big=await call('/admin/order-new',{...owner,phone,fee:0,lines:[{id:product.id,qty:1,price:500}]});no=big.order.no;
 await call('/driver/status',{...owner,no,status:'delivered'});
 assert.equal((await changePayment(0,0,500,'too-much')).code,'wallet_balance');
 assert.equal((await payment()).payment.wallet,0);
});

test('financial refunds still work after personal order data is anonymized',async()=>{
 const before=(await call('/wallet/me',{token:walletToken})).balance;
 const product=catalog.products.find(p=>p.stock&&p.price>=1);
 const made=await call('/order',{items:{[product.id]:1},phone,lat:24.84,lng:46.83,walletAmount:1,walletToken,walletRequestId:request('private-refund')});assert.equal(made.ok,true);
 assert.equal((await call('/driver/status',{...owner,no:made.orderNo,status:'delivered'})).ok,true);
 const n=Number(made.orderNo.replace('#',''))-1000;
 sql.prepare("UPDATE orders SET phone='',anon=1,data=json_set(data,'$.phone','') WHERE no=?").run(n);
 assert.equal((await call('/driver/status',{...owner,no:made.orderNo,status:'canceled'})).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).balance,before);
});

test('a concurrent collection correction prevents a stale cancellation refund',async()=>{
 const product=catalog.products.find(p=>p.stock),made=await call('/admin/order-new',{...owner,phone,fee:0,lines:[{id:product.id,qty:1,price:13}]});no=made.order.no;
 assert.equal((await call('/driver/status',{...owner,no,status:'delivered'})).ok,true);
 const balance=(await call('/admin/wallet',{...owner,phone})).balance;
 const original=DB.batch;let intercept=true;
 DB.batch=async function(st){if(intercept&&st.some(s=>s.sql?.startsWith('UPDATE orders SET status'))){intercept=false;assert.equal((await changePayment(5,5,3,'racing-split')).ok,true);}return original(st);};
 try{assert.equal((await call('/driver/status',{...owner,no,status:'canceled'})).ok,false);}finally{DB.batch=original;}
 assert.equal(sql.prepare('SELECT status FROM orders WHERE no=?').get(Number(no.slice(1))-1000).status,'delivered');
 assert.equal((await call('/admin/wallet',{...owner,phone})).balance,balance-330);
 assert.equal((await call('/driver/status',{...owner,no,status:'canceled'})).ok,true);
 assert.equal((await call('/admin/wallet',{...owner,phone})).balance,balance-130);
});

test('wallet supports a simple six-digit PIN with hashing and session revocation',async()=>{
 assert.equal((await call('/admin/wallet-account',{...owner,phone,password:'12345'})).code,'bad_password');
 assert.equal((await call('/admin/wallet-account',{...owner,phone,password:'482619'})).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).code,'session_expired');
 assert.equal((await call('/wallet/login',{phone,password:'482618'})).code,'bad_credentials');
 const login=await call('/wallet/login',{phone,password:'482619'});assert.equal(login.ok,true);walletToken=login.token;
 assert.notEqual(sql.prepare('SELECT password_hash FROM wallets WHERE phone=?').get(phone).password_hash,'482619');
});

test('orders staff cannot alter money or wallets; logout revokes wallet access',async()=>{
 for(const path of ['/admin/payment','/admin/day-close','/admin/day-report','/admin/wallet-credit','/admin/wallet-account','/admin/cashback'])assert.equal((await call(path,{session:ordersToken,...owner})).status,403,path);
 assert.equal((await call('/wallet/logout',{token:walletToken})).ok,true);
 assert.equal((await call('/wallet/me',{token:walletToken})).code,'session_expired');
});
