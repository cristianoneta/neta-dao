import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const body=await readFile(new URL('.'+path,root));res.writeHead(200,{'content-type':/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.wasm')?'application/wasm':path.endsWith('.json')?'application/json':'text/html'}).end(body);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));const origin='http://127.0.0.1:'+server.address().port;
 await context.route('https://**/*',route=>route.fulfill({status:200,contentType:'application/json',body:'{"default_node_info":{"network":"juno-1"}}'}));
 await page.goto(origin+'/names-v2-setup.html');assert.equal(await page.locator('#connect').isDisabled(),true);
 await page.locator('#authority').click();await page.waitForFunction(()=>document.querySelector('#authority-status').textContent.includes('ready'));
 const authority=await page.locator('#authority-status').textContent();assert.equal(await page.locator('#connect').isDisabled(),false);
 for(const button of await page.locator('[data-role]').all())assert.equal(await button.isDisabled(),true);
 const key=await page.evaluate(async()=>{const {getTestAuthority}=await import('/names-v2-test-authority.mjs');const a=await getTestAuthority();let blocked=false;try{await crypto.subtle.exportKey('pkcs8',a.privateKey);}catch{blocked=true;}return {blocked,extractable:a.privateKey.extractable};});assert.deepEqual(key,{blocked:true,extractable:false});
 const quotes=await page.evaluate(async()=>{
  const {getTestAuthority,createTestQuote}=await import('/names-v2-test-authority.mjs');const {validateQuote}=await import('/names-v2-core.mjs');
  const a=await getTestAuthority(),f=await (await fetch('/tests/fixtures/nns-v2-quote.json')).json();
  let config={...f.config,quote_public_key:a.publicKey};const reader={deployment:f.deployment,verify:async()=>config,resolve:async()=>({name:'alice.neta',available:true,next_generation:1})};
  const offer=await createTestQuote({reader,request:{operation:'register',payer:'alice',name:'alice',years:1},now:f.now});
  const valid=await validateQuote({deployment:f.deployment,config,offer,expected:f.offer.quote,now:f.now});
  config={...config,testnet_only:false};let blocked=false;try{await createTestQuote({reader,request:{operation:'register',payer:'alice',name:'alice',years:1},now:f.now});}catch{blocked=true;}
  return {amount:valid.amount,mainnetBlocked:blocked};
 });assert.deepEqual(quotes,{amount:'2500000',mainnetBlocked:true});
 await page.reload();await page.locator('#authority').click();await page.waitForFunction(()=>document.querySelector('#authority-status').textContent.includes('ready'));assert.equal(await page.locator('#authority-status').textContent(),authority);
 await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Keplr'));
 // Exercise the actual setup connection and REST fallback without wallet signing.
 await page.evaluate(()=>{
  window.testDisconnects=0;
  const signer={getAccounts:async()=>[{address:'test-owner'}],signDirect:()=>{throw Error('Unexpected signing');}};
  window.keplr={experimentalSuggestChain:async()=>{},enable:async()=>{},getOfflineSigner:()=>signer};
  window.NetaNamesSigning={validAddress:()=>true,createBridge:()=>({}),connect:async()=>({disconnect(){window.testDisconnects++;}})};
 });
 await context.unroute('https://**/*');let stale=true;
 await context.route('https://**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname.includes('nodeshub'))return route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'unavailable'});
  const body=url.pathname.endsWith('node_info')?{default_node_info:{network:'uni-7'}}:{block:{},sdk_block:{header:{chain_id:'uni-7',height:'100',time:new Date(Date.now()-(stale?300000:0)).toISOString()}}};
  return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#connect').disabled);assert.match(await page.locator('#status').textContent(),/browser time/);
 assert.match(await page.locator('#status').textContent(),/HTTP 503/);
 assert.equal(await page.evaluate(()=>window.testDisconnects),1);
 assert.equal(await page.locator('#connect').isDisabled(),false);
 stale=false;await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Connected to UNI-7'));
 assert.equal(await page.locator('#wallet').textContent(),'test-owner');
 await page.locator('#disconnect').click();assert.equal(await page.evaluate(()=>window.testDisconnects),2);
 if(process.env.NNS_SCREENSHOT_DIR)await mkdir(process.env.NNS_SCREENSHOT_DIR,{recursive:true});
 for(const name of ['setup','lab']){
  await page.goto(origin+`/names-v2-${name}.html`);
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflow ${width}`);
   if(process.env.NNS_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NNS_SCREENSHOT_DIR}/${name}-${width}.png`,fullPage:true});
  }
 }
 for(const id of ['connect','prepare','commit','review-quote','local-quote','review-transfer','review-profile','recover'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' must be disabled before verification');
 await page.locator('#manifest').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"chain_id":"juno-1"}')});await page.locator('#verify').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('UNI-7 deployment manifest'));
 assert.equal(await page.locator('#connect').isDisabled(),true);
 await page.locator('#name').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#years').evaluate(el=>el===document.activeElement),true);
 // Real browser FormData regression: capture every typed field before busy render
 // disables controls. Network/wallet adapters are synthetic; no live signing.
 await context.route('**/names-v2-reader.mjs*',route=>route.fulfill({contentType:'text/javascript',body:`
 export class NamesV2Reader {
  constructor({deployment}){this.deployment=deployment;}
  async verify(){return {purchases_paused:false};}
 }`}));
 await context.route('**/names-v2-wallet.mjs*',route=>route.fulfill({contentType:'text/javascript',body:`
 export async function connectNamesWallet(){
  window.profileWrites=[];
  const owner='test-owner';
  return {owner,disconnect(){},reader:{async profile(name){return {active:true,profile:{identity:{owner,name},revision:0}};}},
   client:{load(){return null;},async updateProfile(args){window.profileWrites.push(structuredClone(args));}}};
 }`}));
 await page.goto(origin+'/names-v2-lab.html');
 await page.locator('#manifest').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from('{"registry":"test-registry"}')});
 await page.locator('#verify').click();await page.locator('#connect').click();
 await page.locator('#profile-name').fill('cristiano');
 const typed={description:'A public test profile',discord:'example.1',telegram:'@example_tg',twitter:'@example_x',email:'test@example.org',website:'https://example.org'};
 const expected={...typed,telegram:'example_tg',twitter:'example_x'};
 for(const [name,value] of Object.entries(typed))await page.locator(`#profile-form [name="${name}"]`).fill(value);
 await page.locator('#review-profile').click();
 await page.waitForFunction(()=>!document.querySelector('#confirm').disabled);
 const review=await page.locator('#review-text').textContent();
 assert.match(review,/cristiano\.neta/);
 for(const [name,value] of Object.entries(expected))assert.ok(review.includes(JSON.stringify(name)+': '+JSON.stringify(value)),name+' absent from review');
 assert.equal(await page.evaluate(()=>window.profileWrites.length),0,'review must not publish');
 await page.locator('#profile-form [name="description"]').fill('Updated public test profile');
 assert.equal(await page.locator('#review').isVisible(),false,'editing invalidates review');
 assert.equal(await page.locator('#confirm').isDisabled(),true);
 expected.description='Updated public test profile';
 await page.locator('#review-profile').click();await page.locator('#confirm').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='Exact transaction confirmed on UNI-7.');
 assert.deepEqual(await page.evaluate(()=>window.profileWrites),[{owner:'test-owner',name:'cristiano.neta',contacts:expected,expectedRevision:0}]);
 // Empty optional fields remain intentional, and invalid values cannot open review.
 for(const name of Object.keys(typed))await page.locator(`#profile-form [name="${name}"]`).fill('');
 await page.locator('#review-profile').click();await page.waitForFunction(()=>!document.querySelector('#confirm').disabled);
 assert.match(await page.locator('#review-text').textContent(),/"email": ""/);
 await page.locator('#discard-review').click();
 await page.locator('#profile-form [name="email"]').fill('invalid email');
 await page.locator('#review-profile').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('valid public email'));
 assert.equal(await page.locator('#review').isVisible(),false);
 assert.equal(await page.evaluate(()=>window.profileWrites.length),1);
 assert.deepEqual(errors,[]);console.log('Names UNI-7: setup/lab fail-closed controls, durable non-exportable Ed25519 test key, reload, keyboard and 320–1440px reflow passed.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
