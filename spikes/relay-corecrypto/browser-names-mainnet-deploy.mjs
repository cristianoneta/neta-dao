import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {SNAPSHOT_ARTIFACTS} from '../../names/mainnet-artifacts.mjs';
import {NETA,DAO} from '../../names/service/constants.mjs';
import {MAINNET_PRICE_KEY,MAINNET_UPGRADE_ADMIN,MAINNET_REGISTRY_ADMIN} from '../../names/mainnet-config.mjs';
const root=new URL('../../',import.meta.url);
const owner='juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt';
// Valid synthetic addresses from existing public test fixtures, never live queries.
const fixture=JSON.parse(await readFile(new URL('../../docs/deployments/nns-uni7-owner-2026-10-04.json',import.meta.url),'utf8'));
const addresses={registry:fixture.registry,profiles:fixture.profile_contract};
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,b=await readFile(new URL('.'+p,root));res.writeHead(200,{'content-type':/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.wasm')?'application/wasm':'text/html'}).end(b);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(({owner,addresses})=>{
  window.keplr={enable:async chain=>{if(chain!=='juno-1')throw Error('wrong chain');},getOfflineSigner:()=>({getAccounts:async()=>[{address:owner}],signDirect:async()=>{}})};
  window.__fixture={owner,addresses};
 },{owner,addresses});
 await context.route('**/assets/names-signing.js*',r=>r.fulfill({contentType:'text/javascript',body:`
  const {owner,addresses}=window.__fixture;
  const persist=()=>JSON.parse(localStorage.getItem('synthetic-mainnet')||'{"writes":0}');
  const receipt=r=>({chainId:'juno-1',intentMatched:true,code:0,height:123,transactionHash:'A'.repeat(64),events:[r.kind==='store'?{type:'store_code',attributes:[{key:'code_id',value:r.role==='registry'?'1':'2'}]}:{type:'instantiate',attributes:[{key:'_contract_address',value:addresses[r.role]}]}]});
  window.NetaNamesSigning={validAddress:()=>true,connect:async(rpc,signer,chain)=>{if(chain!=='juno-1')throw Error('wrong chain');return {disconnect(){}};},createBridge:opts=>({execute:async r=>{await opts.verifyDeployment();const s=persist();s.writes++;localStorage.setItem('synthetic-mainnet',JSON.stringify(s));if(window.loseResponse)throw Error('UNKNOWN: response lost');return receipt(r);},recover:async r=>receipt(r)})};
 `}));
 await context.route('https://**/*',async route=>{
  const u=new URL(route.request().url()),p=u.pathname;let data;
  if(p.endsWith('node_info'))data={default_node_info:{network:'juno-1'}};
  else if(p.endsWith('blocks/latest'))data={block:{header:{chain_id:'juno-1',height:'123',time:new Date().toISOString()}}};
  else if(p.includes('/code/')){const role=p.endsWith('/1')?'registry':'profiles';data={code_info:{creator:owner,data_hash:SNAPSHOT_ARTIFACTS[role].sha256}};}
  else if(p.includes('/smart/')){const addr=p.split('/contract/')[1].split('/')[0];data={data:addr===NETA?{decimals:6}:addr===addresses.registry?{chain_id:'juno-1',token:NETA,treasury:DAO,admin:MAINNET_REGISTRY_ADMIN,quote_public_key:MAINNET_PRICE_KEY,testnet_only:false,signer_version:1,purchases_paused:true,tariff_version:1,tariff:{three_cents:9900,four_cents:1900,standard_cents:500}}:{registry:addresses.registry}};}
  else data={contract_info:{code_id:p.endsWith(addresses.registry)?'1':'2',creator:owner,admin:MAINNET_UPGRADE_ADMIN}};
  await route.fulfill({json:data});
 });
 await page.goto(origin+'/names-mainnet-deploy.html');
 assert.equal(await page.locator('#public-key').textContent(),MAINNET_PRICE_KEY);
 assert.equal(await page.locator('[data-role="registry"][data-kind="store"]').isDisabled(),true);
 await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('[data-role="registry"][data-kind="store"]').disabled);
 assert.equal(await page.evaluate(()=>localStorage.getItem('synthetic-mainnet')),null);
 await page.locator('[data-role="registry"][data-kind="store"]').click();await page.waitForFunction(()=>!document.querySelector('#confirm').disabled);
 assert.match(await page.locator('#review-text').textContent(),/juno-1/);
 await page.evaluate(()=>window.loseResponse=true);await page.locator('#confirm').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('UNKNOWN'));
 await page.reload();await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#recover').disabled);
 assert.equal(await page.locator('[data-role="registry"][data-kind="store"]').isDisabled(),true);
 await page.locator('#recover').click();await page.waitForFunction(()=>document.querySelector('#registry-state').textContent.includes('Code 1'));
 for(const [role,kind] of [['registry','instantiate'],['profiles','store'],['profiles','instantiate']]){
  await page.locator(`[data-role="${role}"][data-kind="${kind}"]`).click();await page.waitForFunction(()=>!document.querySelector('#confirm').disabled);
  if(kind==='instantiate')assert.match(await page.locator('#review-text').textContent(),/Upgrade authority: owner wallet/);
  if(role==='registry')assert.match(await page.locator('#review-text').textContent(),new RegExp(MAINNET_PRICE_KEY.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  await page.locator('#confirm').click();await page.waitForFunction(()=>!document.querySelector('#disconnect').disabled);
 }
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('synthetic-mainnet')).writes),4);
 const download=page.waitForEvent('download');await page.locator('#download').click();const exported=JSON.parse(await readFile(await(await download).path(),'utf8'));
 assert.equal(exported.manifest.version,3);for(const c of Object.values(exported.manifest.contracts))assert.equal(c.admin,MAINNET_UPGRADE_ADMIN);assert.equal(exported.manifest.admin,MAINNET_REGISTRY_ADMIN);assert.equal(exported.history.length,4);assert.equal(exported.observations.length,2);
 await page.reload();await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#download').disabled);
 for(const b of await page.locator('[data-role]').all())assert.equal(await b.isDisabled(),true);
 if(process.env.NNS_SCREENSHOT_DIR)await mkdir(process.env.NNS_SCREENSHOT_DIR,{recursive:true});
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(process.env.NNS_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NNS_SCREENSHOT_DIR}/mainnet-deploy-${width}.png`,fullPage:true});}
 await page.keyboard.press('Tab');await page.locator('#download').focus();assert.notEqual(await page.locator('#download').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
 assert.deepEqual(errors,[]);console.log('Mainnet deployment: four reviewed actions, reload recovery without duplicate write, public receipts, paused DAO config and responsive page passed.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
