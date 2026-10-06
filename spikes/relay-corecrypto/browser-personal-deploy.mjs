import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PERSONAL_MAINNET_OWNER as owner,PERSONAL_MAINNET_WASM as hash,PERSONAL_MAINNET_POLICY as policy} from '../../relay-personal-network.mjs';
import {PERSONAL_DEPLOY_LABEL as label} from '../../relay-personal-deploy-core.mjs';
const root=new URL('../../',import.meta.url),address='juno1'+'q'.repeat(58);
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,b=await readFile(new URL('.'+p,root));res.writeHead(200,{'content-type':/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.wasm')?'application/wasm':'text/html'}).end(b);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.RELAY_CHROMIUM_PATH?{executablePath:process.env.RELAY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(({owner,address})=>{window.keplr={enable:async()=>{},getOfflineSigner:()=>({getAccounts:async()=>[{address:owner}]})};window.fixture={owner,address};},{owner,address});
 await context.route('**/assets/names-signing.js*',r=>r.fulfill({contentType:'text/javascript',body:`
 const {owner,address}=window.fixture;
 const receipt=r=>({chainId:'juno-1',intentMatched:true,code:0,height:123,transactionHash:(r.kind==='store'?'A':'B').repeat(64),events:[r.kind==='store'?{type:'store_code',attributes:[{key:'code_id',value:'321'}]}:{type:'instantiate',attributes:[{key:'_contract_address',value:address}]}]});
 window.NetaNamesSigning={validAddress:s=>s===address,connect:async()=>({disconnect(){}}),createBridge:opts=>({execute:async r=>{await opts.verifyDeployment();localStorage.setItem('writes',Number(localStorage.getItem('writes')||0)+1);if(window.loseResponse)throw Error('UNKNOWN');return receipt(r);},recover:async r=>{await opts.verifyDeployment();return receipt(r);}})};
 `}));
 await context.route('https://**/*',async route=>{const p=new URL(route.request().url()).pathname;let data;
  if(p.endsWith('node_info'))data={default_node_info:{network:'juno-1'}};
  else if(p.endsWith('blocks/latest'))data={block:{header:{chain_id:'juno-1',height:'123',time:new Date().toISOString()}}};
  else if(p.includes('/code/'))data={code_info:{creator:owner,data_hash:hash}};
  else if(p.includes('/smart/'))data={data:policy};
  else data={contract_info:{code_id:'321',creator:owner,admin:owner,label}};
  await route.fulfill({json:data});
 });
 await page.goto(origin+'/relay-personal-deploy.html');assert.equal(await page.locator('[data-kind=store]').isDisabled(),true);
 await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('[data-kind=store]').disabled);
 assert.equal(await page.evaluate(()=>localStorage.getItem('writes')),null);
 await page.locator('[data-kind=store]').click();await page.waitForFunction(()=>!document.querySelector('#confirm').disabled);
 assert.match(await page.locator('#review-text').textContent(),new RegExp(hash));assert.equal(await page.evaluate(()=>localStorage.getItem('writes')),null);
 await page.evaluate(()=>window.loseResponse=true);await page.locator('#confirm').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('UNKNOWN'));
 await page.reload();await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#recover').disabled);assert.equal(await page.locator('[data-kind=store]').isDisabled(),true);
 await page.locator('#recover').click();await page.waitForFunction(()=>document.querySelector('#registry-state').textContent.includes('Code 321'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('writes')),'1');
 await page.locator('[data-kind=instantiate]').click();await page.waitForFunction(()=>!document.querySelector('#confirm').disabled);
 const review=await page.locator('#review-text').textContent();assert.match(review,/migrationAdmin/);assert.ok(review.includes(owner));assert.match(review,/"mainnet": true/);
 // Switching the wallet invalidates a visible review and leaves durable receipts.
 await page.evaluate(()=>dispatchEvent(new Event('keplr_keystorechange')));assert.equal(await page.locator('#review').isHidden(),true);
 await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('[data-kind=instantiate]').disabled);
 await page.locator('[data-kind=instantiate]').click();await page.waitForFunction(()=>!document.querySelector('#confirm').disabled);await page.locator('#confirm').click();await page.waitForFunction(()=>!document.querySelector('#download').disabled);
 const waiting=page.waitForEvent('download');await page.locator('#download').click();const exported=JSON.parse(await readFile(await(await waiting).path(),'utf8'));
 assert.equal(exported.activated,false);assert.equal(exported.deployment.admin,owner);assert.deepEqual(exported.policy,policy);assert.equal(exported.history.length,2);assert.equal(exported.observations.length,2);assert.equal(await page.evaluate(()=>localStorage.getItem('writes')),'2');
 await page.reload();await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#download').disabled);
 for(const b of await page.locator('[data-kind]').all())assert.equal(await b.isDisabled(),true);
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/personal-deploy-'+width+'.png',fullPage:true});}
 await page.keyboard.press('Tab');await page.locator('#download').focus();assert.notEqual(await page.locator('#download').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 assert.deepEqual(errors,[]);console.log('Personal deployment browser passed: two explicit reviews, owner admin/policy, reload recovery without resend, wallet invalidation, two-provider export and 320/390/768/1440px. Simulated chain/signing only.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
