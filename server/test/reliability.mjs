import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import worker from '../worker.js';
import { githubMock } from './support/github.mjs';

const sql=new DatabaseSync(':memory:');
function prepare(query){let args=[];return {query,bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)??null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}};}};}
let queue=Promise.resolve(),failCheckout=false;
const DB={prepare,batch(statements){const task=queue.then(async()=>{sql.exec('BEGIN');try{const result=[];for(const stmt of statements){if(failCheckout&&stmt.query.includes('INSERT INTO checkout_keys')){failCheckout=false;throw Error('injected checkout failure');}result.push(await stmt.run());}sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}});queue=task.catch(()=>{});return task;}};
const values=new Map(),LOCKS={async get(k,type){const v=values.get(k);return v==null?null:type==='json'?JSON.parse(v):v;},async put(k,v){values.set(k,v);},async delete(k){values.delete(k);}};
const origin='https://1097mbnalll-ui.github.io',owner={pin:'2468'};
const env={DB,LOCKS,GITHUB_TOKEN:'fixture',ADMIN_PIN:owner.pin,SECRET:'fixture',REPO:'fixture/store',BRANCH:'main',ALLOWED_ORIGIN:origin};
const catalog=JSON.parse(fs.readFileSync(new URL('../../data.json',import.meta.url)));
Object.assign(catalog.store,{closed:false,fee:0,freeOver:0,daily:{on:false},deal95:{on:false},bans:[]});delete catalog.store.minOrder;delete catalog.store.maxKm;
let p=catalog.products.find(p=>p.stock&&p.price>0),p2=catalog.products.find(x=>x.stock&&x.price>0&&x.id!==p.id);
const realNow=Date.now;let now=realNow();Date.now=()=>now;
let conflictPut=false,omitInline=false,puts=0;
const mock=githubMock(()=>catalog,undefined,true);
globalThis.fetch=async(url,options={})=>{if(options.method==='PUT'){puts++;if(conflictPut)return new Response('{}',{status:409});}let response=await mock(url,options);if(omitInline&&!options.method&&String(url).includes('/contents/')){const file=await response.json();response=Response.json({...file,content:'',encoding:'none'});}if(options.method==='PUT'&&response.ok){p=catalog.products.find(x=>x.id===p.id);p2=catalog.products.find(x=>x.id===p2.id);}return response;};
let address=0;
async function call(path,body={},ip){const waits=[];const r=await worker.fetch(new Request('https://fixture.invalid'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':ip||'192.0.2.'+(++address)},body:JSON.stringify(body)}),env,{waitUntil(p){waits.push(p);}});const result=await r.json();await Promise.all(waits);return {status:r.status,...result};}
async function baseline(){return call('/admin/catalog',owner);}
async function save(data,more={}){return call('/save',{...owner,data,baseVersion:(await baseline()).version,...more});}
const day=()=>new Date(now+3*3600e3).toISOString().slice(0,10);
async function delivered(price,drv){const made=await call('/admin/order-new',{...owner,phone:'0551111111',fee:0,lines:[{id:p.id,qty:1,price}]});assert.equal(made.ok,true);if(drv)assert.equal((await call('/admin/assign',{...owner,no:made.order.no,drv})).ok,true);assert.equal((await call('/driver/status',{...owner,no:made.order.no,status:'delivered'})).ok,true);return made.order.no;}
function resetLedger(){sql.exec('DELETE FROM orders;DELETE FROM oline;DELETE FROM cash;DELETE FROM payment_splits;DELETE FROM delivery_times;DELETE FROM driver_settlements2;');}
function order(id,more={}){return {requestId:id,items:{[p.id]:1},phone:'0551111111',lat:24.84,lng:46.83,pay:'cash',...more};}

test('first manual receipt and confirmed settlement clear the balance without losing earlier collections',async()=>{
 assert.equal((await save(catalog,{newDriverPin:'1357'})).ok,true);resetLedger();
 await delivered(100);now+=60000;assert.equal((await call('/admin/cash',owner)).balance,100);
 assert.equal((await call('/admin/cash',{...owner,add:40,drv:'d0'})).balance,60);now+=60000;
 assert.equal((await call('/admin/cash',{...owner,add:60,drv:'d0'})).balance,0);
 resetLedger();now+=60000;await delivered(100);now+=60000;
 const pending=await call('/driver/settlement-request',{pin:'1357'});assert.equal(pending.settlement.expected,10000);
 const confirm={...owner,drv:'d0',day:day(),revision:pending.settlement.revision,actual:100};
 assert.equal((await call('/admin/settlement-confirm',confirm)).ok,true);assert.equal((await call('/admin/cash',owner)).balance,0);
 assert.equal((await call('/admin/settlement-confirm',confirm)).repeated,true);assert.equal(sql.prepare('SELECT COUNT(*) n FROM cash').get().n,1);
});

test('explicit migration opening is preserved, and receipts remain isolated for two drivers',async()=>{
 resetLedger();now+=60000;await delivered(100);now+=60000;
 sql.prepare("INSERT INTO cash(at,day,who,amount,note,drv) VALUES(?,?,'النظام',0,'بداية الحساب','d0')").run(now,day());now+=60000;
 await delivered(50);assert.equal((await call('/admin/cash',owner)).balance,50);now+=60000;
 assert.equal((await call('/admin/cash',{...owner,add:50,drv:'d0'})).balance,0);
 resetLedger();now+=60000;
 const team=await call('/admin/team-save',{...owner,name:'المندوب الثاني',role:'driver',newPin:'2222'});assert.equal(team.ok,true);const other=team.staff.find(x=>x.id!=='d0').id;
 await delivered(70,'d0');await delivered(30,other);now+=60000;
 await call('/admin/cash',{...owner,add:70,drv:'d0'});
 const cash=await call('/admin/cash',owner);assert.equal(cash.drivers.find(x=>x.id==='d0').balance,0);assert.equal(cash.drivers.find(x=>x.id===other).balance,30);
});

test('cash/card checkout retries reuse the order, stock and statistics even after closure',async()=>{
 for(const pay of ['cash','card']){
  const first=await call('/order',order('checkout_'+pay+'_retry',{pay}));assert.equal(first.ok,true);
  const before=sql.prepare('SELECT COUNT(*) n FROM orders').get().n;
  const again=await call('/order',order('checkout_'+pay+'_retry',{pay}));assert.equal(again.orderNo,first.orderNo);assert.equal(again.repeated,true);assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n,before);
  const bad=await call('/order',order('checkout_'+pay+'_retry',{pay,items:{[p.id]:2}}));assert.equal(bad.code,'request_conflict');
 }
 const body=order('checkout_before_closed');const first=await call('/order',body);assert.equal(first.ok,true);
 catalog.store.closed=true;now+=31000;
 assert.equal((await call('/order',body)).orderNo,first.orderNo);
 catalog.store.closed=false;now+=31000;
});

test('concurrent repeated requests commit one order and one stock decrement; failed batch is retryable',async()=>{
 assert.equal((await save(catalog,{stock:{[p.id]:10}})).ok,true);
 const body=order('checkout_concurrent_one');const before=sql.prepare('SELECT COUNT(*) n FROM orders').get().n;
 const pair=await Promise.all([call('/order',body),call('/order',body)]);assert.ok(pair.every(x=>x.ok));assert.equal(pair[0].orderNo,pair[1].orderNo);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n,before+1);assert.equal(sql.prepare('SELECT qty FROM stock WHERE id=?').get(p.id).qty,9);
 failCheckout=true;const failed=order('checkout_failed_once');assert.equal((await call('/order',failed)).code,'db');assert.equal(sql.prepare('SELECT qty FROM stock WHERE id=?').get(p.id).qty,9);
 assert.equal((await call('/order',failed)).ok,true);assert.equal(sql.prepare('SELECT qty FROM stock WHERE id=?').get(p.id).qty,8);
 const distinct=await Promise.all([call('/order',order('checkout_distinct_one')),call('/order',order('checkout_distinct_two'))]);assert.ok(distinct.every(r=>r.ok));assert.notEqual(distinct[0].orderNo,distinct[1].orderNo);
 for(const [i,key] of ['checkout_distinct_one','checkout_distinct_two'].entries())assert.equal(distinct[i].orderNo,'#'+(1000+sql.prepare('SELECT no FROM checkout_keys WHERE request_id=?').get(key).no));
});

test('wallet replay survives token expiry and price changes without a second debit',async()=>{
 const phone='0552222222';assert.equal((await call('/admin/wallet-credit',{...owner,phone,amount:20,note:'fixture',requestId:'fixture_wallet_credit'})).ok,true);
 assert.equal((await call('/admin/wallet-account',{...owner,phone,password:'123456'})).ok,true);const login=await call('/wallet/login',{phone,password:'123456'});
 const body=order('checkout_wallet_token',{phone,walletAmount:1,walletToken:login.token,walletRequestId:'checkout_wallet_token'});
 const first=await call('/order',body);assert.equal(first.ok,true);
 await call('/wallet/logout',{token:login.token});const old=p.price;p.price+=1;now+=31000;
 const repeated=await call('/order',body);assert.equal(repeated.orderNo,first.orderNo);assert.equal(repeated.total,first.total);assert.equal(sql.prepare('SELECT balance FROM wallets WHERE phone=?').get(phone).balance,1900);p.price=old;now+=31000;
});

test('item key aliases and bundle/regular combinations cannot evade purchase limits',async()=>{
 catalog.store.daily={on:true,limit:1,list:[{id:p.id,price:1}]};p.max=2;now+=31000;
 assert.equal((await call('/order',order('daily_alias_invalid',{items:{['t:'+p.id+':a']:1,['t:'+p.id+':b']:1}}))).code,'bad_items');
 const daily=await call('/order',order('daily_limit_valid',{items:{['t:'+p.id]:2}}));assert.equal(daily.count,1);assert.equal(daily.total,1);
 catalog.store.daily={on:false};catalog.store.bans=[{id:'test_bundle',style:'bundle',ids:[p.id,p2.id],bprice:1}];p.max=1;now+=31000;
 const keys={['x:test_bundle:'+p.id]:2,['x:test_bundle:'+p2.id]:2};assert.equal((await call('/order',order('bundle_over_limit',{items:keys}))).code,'item_limit');
 assert.equal((await call('/order',order('bundle_plus_regular',{items:{[p.id]:1,['x:test_bundle:'+p.id]:1,['x:test_bundle:'+p2.id]:1}}))).code,'item_limit');
 const valid=await call('/order',order('bundle_limit_valid',{items:{['x:test_bundle:'+p.id]:1,['x:test_bundle:'+p2.id]:1}}));assert.equal(valid.ok,true);delete p.max;catalog.store.bans=[];now+=31000;
});

test('Arabic and Persian phone digits resolve to the same customer identity',async()=>{
 for(const [i,phone] of ['٠٥٥١١١١١١١','۰۵۵۱۱۱۱۱۱۱','+٩٦٦٥٥١١١١١١١'].entries()){
  const result=await call('/order',order('arabic_phone_'+i,{phone}));assert.equal(result.ok,true);const n=Number(result.orderNo.slice(1))-1000;assert.equal(sql.prepare('SELECT phone FROM orders WHERE no=?').get(n).phone,'0551111111');
 }
});

test('distributed wrong credentials cannot lock legitimate devices; per-device lock stays enforced',async()=>{
 for(let i=0;i<40;i++)assert.equal((await call('/login',{pin:'0000'},'203.0.113.'+i)).code,'bad_pin');
 values.set('fail:all',JSON.stringify({n:100,until:now+3600000}));assert.equal((await call('/login',owner,'198.51.100.200')).ok,true);
 for(let i=0;i<5;i++)await call('/login',{pin:'0000'},'198.51.100.201');assert.equal((await call('/login',owner,'198.51.100.201')).code,'locked');
 assert.equal((await call('/login',owner,'198.51.100.202')).ok,true);
});

test('stale admin drafts and GitHub write races cannot overwrite newer catalogues',async()=>{
 const base=await baseline(),a=structuredClone(base.data),b=structuredClone(base.data);a.store.tagline='first editor';b.store.hours='second editor';
 const first=await call('/save',{...owner,data:a,baseVersion:base.version});assert.equal(first.ok,true);assert.notEqual(first.version,base.version);
 const before=puts,second=await call('/save',{...owner,data:b,baseVersion:base.version});assert.equal(second.status,409);assert.equal(second.code,'data_conflict');assert.equal(puts,before);assert.equal(catalog.store.tagline,'first editor');
 assert.equal((await call('/save',{...owner,data:b})).code,'data_conflict');
 conflictPut=true;const current=await baseline();const raced=await call('/save',{...owner,data:b,baseVersion:current.version});conflictPut=false;assert.equal(raced.code,'data_conflict');assert.equal(puts,before+1);assert.equal(catalog.store.tagline,'first editor');
});

test('large catalogues use the pinned Git blob for their editable version',async()=>{omitInline=true;const b=await baseline();omitInline=false;assert.equal(b.ok,true);assert.ok(b.version);assert.equal(b.data.store.tagline,catalog.store.tagline);});

test.after(()=>{Date.now=realNow;});
