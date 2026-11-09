// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package when needed.
// All requests are local fixtures or blocked; this test never writes to production.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ohod-browser-'));
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'data.json')));catalog.store.closed=false;
 const p=catalog.products.find(x=>x.stock&&x.price>0),p2=catalog.products.find(x=>x.stock&&x.price>0&&x.id!==p.id);p.max=1;
 Object.assign(catalog.store,{daily:{...catalog.store.daily,on:false},deal95:{...catalog.store.deal95,on:false},bans:[{id:'fixture_bundle',title:'باقة الاختبار',style:'bundle',ids:[p.id,p2.id],bprice:1}],promos:[{id:'fixture_bundle',on:true}]});
 const catalogFile=path.join(folder,'catalog.json');fs.writeFileSync(catalogFile,JSON.stringify(catalog));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/(<script[^>]*id="store-data"[^>]*>)[\s\S]*?(<\/script>)/,'$1'+JSON.stringify(catalog)+'$2');
 let publicCatalogueAvailable=true,publicCatalogueApi,publicCatalogueData;const staticServer=http.createServer((req,res)=>{if(req.url.startsWith('/data.json')){res.setHeader('content-type','application/json');res.statusCode=publicCatalogueAvailable?200:503;res.end(JSON.stringify(publicCatalogueAvailable?(publicCatalogueApi===undefined?(publicCatalogueData||catalog):{...catalog,store:{...catalog.store,api:publicCatalogueApi}}):{ok:false}));return;}res.setHeader('content-type','text/html');res.end(html);});await new Promise(r=>staticServer.listen(0,'127.0.0.1',r));
 const reserve=http.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const worker=spawn(process.execPath,[path.join(root,'android-driver/test/mock-worker.mjs')],{env:{...process.env,PORT:String(port),CATALOG_FILE:catalogFile},stdio:['ignore','pipe','pipe']});
 let workerErrors='';worker.stderr.on('data',d=>workerErrors+=d);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('mock startup timeout '+workerErrors)),10000);worker.stdout.on('data',d=>{if(String(d).includes('mock worker on')){clearTimeout(timer);resolve();}});worker.on('exit',c=>{clearTimeout(timer);reject(Error('mock exited '+c+' '+workerErrors));});});
  const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[],orders=[];
  let orderMode='lost',heldRoute=null,catalogMode='modern',heldCatalogRoute=null;const saves=[];
  await context.addInitScript(()=>{try{sessionStorage.setItem('ohod-sp','1');if(!localStorage.getItem('ohod-form2'))localStorage.setItem('ohod-form2',JSON.stringify({lat:24.84,lng:46.83,phone:'',details:'اختبار محلي',pay:'cash'}));}catch(e){}});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.hostname==='127.0.0.1')return route.continue();
   if(url.hostname===new URL(catalog.store.api).hostname){
    if(url.pathname==='/enter'&&catalogMode==='legacy')return route.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"code":"not_found"}'});
    if(url.pathname==='/admin/catalog'){
     if(catalogMode==='legacy')return route.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"code":"not_found"}'});
     if(catalogMode==='network')return route.abort();
     if(catalogMode==='hang'){heldCatalogRoute=route;return;}
    }
    if(url.pathname==='/save')saves.push(JSON.parse(req.postData()));

    if(url.pathname==='/order'&&orderMode==='hang'){heldRoute=route;return;}
    const res=await fetch('http://127.0.0.1:'+port+url.pathname,{method:req.method(),headers:{Origin:'https://1097mbnalll-ui.github.io','content-type':'application/json'},body:req.method()==='POST'?req.postData():undefined});const body=await res.text();
    if(url.pathname==='/order'){orders.push({request:JSON.parse(req.postData()),response:JSON.parse(body)});if(orderMode==='lost'){orderMode='normal';return route.abort();}}
    return route.fulfill({status:res.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body});
   }
   return route.abort();
  });
  context.on('page',page=>page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.stack);}));
  const page=await context.newPage(),url='http://127.0.0.1:'+staticServer.address().port;
  await page.goto(url);await page.locator('.kq-logo').waitFor();
  await page.locator('[data-addbund=fixture_bundle]').click();await page.locator('[data-nav=cart]').first().click();
  await page.locator('[data-bund=fixture_bundle][data-bd="1"]').click();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('ohod-cart')));assert.equal(stored['x:fixture_bundle:'+p.id],1);assert.equal(stored['x:fixture_bundle:'+p2.id],1);
  await page.locator('[data-nav=checkout]').click();await page.locator('#cPhone').fill('٠٥٥١١١١١١١');await page.locator('#sendOrder').click();await page.locator('#sendErr .alert').waitFor();assert.equal(await page.locator('#phoneErr').isVisible(),false);
  const identity=orders[0].request.requestId;assert.equal(orders[0].response.ok,true);
  await page.reload();await page.locator('[data-nav=cart]').first().click();await page.locator('[data-nav=checkout]').click();await page.locator('#sendOrder').click();await page.locator('.sent h1').waitFor();
  assert.equal(orders.length,2);assert.equal(orders[1].request.requestId,identity);assert.equal(orders[0].response.orderNo,orders[1].response.orderNo);assert.equal(orders[1].response.repeated,true);assert.equal(await page.evaluate(()=>localStorage.getItem('ohod-checkout-attempt')),null);
  console.log('PASS Arabic phone, bundle limit and lost-response replay after reload');
  await page.locator('[data-nav=home]').first().click();await page.locator('[data-act=inc][data-id="'+p.id+'"]').first().click();await page.locator('[data-nav=cart]').first().click();await page.locator('[data-nav=checkout]').click();
  await page.clock.install();orderMode='hang';await page.locator('#sendOrder').click();await page.waitForFunction(()=>document.querySelector('#sendOrder').disabled);await page.clock.fastForward(15001);await page.locator('#sendErr .alert').waitFor();assert.equal(await page.locator('#sendOrder').isDisabled(),false);assert.ok(await page.evaluate(()=>localStorage.getItem('ohod-checkout-attempt')));if(heldRoute)await heldRoute.abort().catch(()=>{});await page.clock.resume();orderMode='normal';
  console.log('PASS timeout releases checkout button and retains the original request identity');
  async function ownerLogin(pg){await pg.goto(url);await pg.locator('[data-nav=more]').first().click();await pg.locator('#toAdmin').click();await pg.locator('#pinIn').fill('2468');await pg.locator('#pinForm [type=submit]').click();await pg.locator('.adm[data-simple-admin]').waitFor().catch(async e=>{console.error('ADMIN DEBUG',await pg.locator('body').innerText(),errors,workerErrors);throw e;});}
  async function nav(pg,id){const toggle=pg.locator('#adminMenuToggle');if(await toggle.isVisible())await toggle.click();const b=pg.locator('.adm-nav [data-atab="'+id+'"]');const group=b.locator('xpath=ancestor::details[1]');if(await group.count())await group.evaluate(x=>x.open=true);await b.click();}
  const one=await context.newPage(),two=await context.newPage();await ownerLogin(one);await ownerLogin(two);
  assert.equal(await one.locator('#aPOS,#aPreparation').count(),0);
  await nav(one,'prods');await nav(two,'prods');const first=one.locator('#aProds [data-f=price]').first(),second=two.locator('#aProds [data-f=price]').first();await first.fill('11.25');await second.fill('12.25');await two.locator('#aSave').click();await two.waitForFunction(()=>document.querySelector('#aSave').disabled);
  await one.locator('#aSave').click();await one.locator('#aStatus').filter({hasText:'جهاز ثاني'}).waitFor();assert.equal(await first.inputValue(),'11.25');assert.equal(await one.locator('#aSave').isEnabled(),true);
  await second.fill('13.25');await two.locator('#aSave').click();await two.waitForFunction(()=>document.querySelector('#aSave').disabled);
  console.log('PASS stale second editor is rejected with its draft preserved; fresh saves update their baseline');
  // A missing catalogue route must not hide the whole admin or bypass save protection.
  catalogMode='legacy';p.price=8.75;
  const legacy=await context.newPage();await legacy.setViewportSize({width:1440,height:1000});await ownerLogin(legacy);await legacy.locator('#adminCompatibilityNotice').waitFor();assert.equal(await legacy.locator('#adminLoadTitle').count(),0);assert.equal(await legacy.locator('#aToggleOpen').isDisabled(),true);
  await nav(legacy,'olist');await legacy.locator('#aOList').waitFor();
  const screenshots=process.env.ADMIN_SCREENSHOT_DIR;if(screenshots){fs.mkdirSync(screenshots,{recursive:true});await legacy.screenshot({path:path.join(screenshots,'admin-legacy-desktop.png'),fullPage:true});await legacy.setViewportSize({width:390,height:844});await legacy.screenshot({path:path.join(screenshots,'admin-legacy-mobile.png'),fullPage:true});await legacy.setViewportSize({width:1440,height:1000});}
  await nav(legacy,'prods');const legacyPrice=legacy.locator('#aProds [data-f=price]').first();assert.equal(await legacyPrice.inputValue(),'8.75');await legacyPrice.fill('9.75');assert.equal(await legacy.locator('#aSave').isEnabled(),true);
  await nav(legacy,'store');const backupButton=legacy.locator('#bkData');const backupFold=backupButton.locator('xpath=ancestor::details[1]');if(await backupFold.count())await backupFold.evaluate(x=>x.open=true);
  const [backup]=await Promise.all([legacy.waitForEvent('download'),backupButton.click()]);const backedUp=JSON.parse(fs.readFileSync(await backup.path(),'utf8'));assert.equal(backedUp.products[0].price,9.75);await nav(legacy,'prods');
  console.log('PASS catalogue backup includes the unsaved draft price, not just the loaded catalogue');
  const before=saves.length;await legacy.evaluate(()=>{const b=document.querySelector('#aSave');b.disabled=false;b.click();});await legacy.locator('#aStatus').filter({hasText:'تحديث الخدمة'}).waitFor();assert.equal(saves.length,before);assert.equal(await legacyPrice.inputValue(),'9.75');
  await legacy.locator('#checkAdminCompatibility').click();assert.equal(await legacyPrice.inputValue(),'9.75');assert.equal(await legacy.locator('#adminCompatibilityNotice').count(),1);
  console.log('PASS legacy admin opens with fresh public data; orders are reachable, saves blocked and draft preserved');
  const recovery=await context.newPage();await ownerLogin(recovery);await recovery.locator('#adminCompatibilityNotice').waitFor();catalogMode='modern';await recovery.locator('#checkAdminCompatibility').click();await recovery.locator('#adminCompatibilityNotice').waitFor({state:'detached'});await recovery.locator('.adm[data-simple-admin]').waitFor();await nav(recovery,'prods');const recoveredPrice=recovery.locator('#aProds [data-f=price]').first();await recoveredPrice.fill('14.25');await recovery.locator('#aSave').click();await recovery.waitForFunction(()=>document.querySelector('#aSave').disabled);assert.equal(saves.length,before+1);assert.ok(saves.at(-1).baseVersion);
  console.log('PASS upgraded service restores protected saving after retry');
  catalogMode='network';const unavailable=await context.newPage();await unavailable.goto(url);await unavailable.locator('[data-nav=more]').first().click();await unavailable.locator('#toAdmin').click();await unavailable.locator('#pinIn').fill('2468');await unavailable.locator('#pinForm [type=submit]').click();await unavailable.locator('#adminLoadTitle').filter({hasText:'تعذر فتح الإدارة'}).waitFor();assert.equal(await unavailable.locator('#adminCompatibilityNotice').count(),0);catalogMode='modern';await unavailable.locator('#retryAdminLoad').click();await unavailable.locator('.adm[data-simple-admin]').waitFor();
  console.log('PASS network errors show a recoverable error instead of downgrading protection');
  catalogMode='legacy';publicCatalogueAvailable=false;const cached=await context.newPage();await ownerLogin(cached);await cached.locator('#adminCompatibilityNotice').waitFor();await nav(cached,'prods');await cached.locator('#aProds [data-f=price]').first().fill('15.25');assert.equal(await cached.locator('#aSave').isEnabled(),true);assert.equal(saves.length,before+1);publicCatalogueAvailable=true;catalogMode='modern';
  console.log('PASS failed public fetch still allows cached viewing with saving blocked');
  catalogMode='legacy';publicCatalogueApi='';const noApi=await context.newPage();await ownerLogin(noApi);await noApi.locator('#adminCompatibilityNotice').waitFor();await nav(noApi,'prods');await noApi.locator('#aProds [data-f=price]').first().fill('16.25');assert.equal(await noApi.locator('#aSave').isEnabled(),true);await noApi.evaluate(()=>{const b=document.querySelector('#aSave');b.disabled=false;b.click();});await noApi.locator('#aStatus').filter({hasText:'تعذر الاتصال بخدمة الحفظ'}).waitFor();assert.equal(saves.length,before+1);publicCatalogueApi=undefined;catalogMode='modern';
  console.log('PASS legacy fallback cannot enable an unprotected save by removing its API URL');
  const latest=await (await fetch('http://127.0.0.1:'+port+'/admin/catalog',{method:'POST',headers:{Origin:'https://1097mbnalll-ui.github.io','content-type':'application/json'},body:JSON.stringify({pin:'2468'})})).json();assert.equal(latest.ok,true);publicCatalogueData=latest.data;
  catalogMode='legacy';const draftRecovery=await context.newPage();await ownerLogin(draftRecovery);await nav(draftRecovery,'prods');const pendingPrice=draftRecovery.locator('#aProds [data-f=price]').first();await pendingPrice.fill('17.25');assert.equal(await draftRecovery.locator('#aSave').isEnabled(),true);
  catalogMode='modern';await draftRecovery.locator('#aSave').click();await draftRecovery.locator('#aStatus').filter({hasText:'انحفظ'}).waitFor();assert.equal(await pendingPrice.inputValue(),'17.25');assert.equal(saves.length,before+2);assert.ok(saves.at(-1).baseVersion);assert.equal(await draftRecovery.locator('#adminCompatibilityNotice').count(),0);
  await legacy.locator('#checkAdminCompatibility').click();await legacy.locator('#aStatus').filter({hasText:'جهاز ثاني'}).waitFor();assert.equal(await legacyPrice.inputValue(),'9.75');assert.equal(saves.length,before+2);publicCatalogueData=undefined;
  console.log('PASS Save recovers protection and publishes an unchanged-baseline draft; newer remote edits never get overwritten');
  for(const [i,role] of ['manager','orders','preparer','cashier'].entries()){
   const loginPin='88000'+i;const result=await (await fetch('http://127.0.0.1:'+port+'/admin/staff-save',{method:'POST',headers:{Origin:'https://1097mbnalll-ui.github.io','content-type':'application/json'},body:JSON.stringify({pin:'2468',name:'اختبار '+role,role,loginPin})})).json();assert.equal(result.ok,true);
   const staff=await context.newPage();await staff.goto(url);await staff.locator('[data-nav=more]').first().click();await staff.locator('#toAdmin').click();await staff.locator('#pinIn').fill(loginPin);await staff.locator('#pinForm [type=submit]').click();
   if(role==='manager'){await staff.locator('.adm[data-simple-admin]').waitFor();assert.equal(await staff.locator('.adm-nav [data-atab=staff]').count(),0);assert.equal(await staff.locator('#aPOS,#aPreparation').count(),0);}
   else{await staff.locator(role==='preparer'?'#aPreparation':role==='cashier'?'#aPOS':'#aOList').waitFor();assert.equal(await staff.locator('.adm-nav [data-atab=prods]').count(),0);}
   await staff.close();
  }
  console.log('PASS unified PIN login opens manager, orders, preparer and cashier workspaces');
  assert.deepEqual(errors,[]);console.log('PASS no browser JavaScript errors');
 }finally{await browser.close();worker.kill();await new Promise(r=>staticServer.close(r));fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
