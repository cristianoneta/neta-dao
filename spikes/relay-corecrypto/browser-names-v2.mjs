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
 assert.deepEqual(errors,[]);console.log('Names UNI-7: setup/lab fail-closed controls, durable non-exportable Ed25519 test key, reload, keyboard and 320–1440px reflow passed.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
