import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,b=await readFile(new URL('.'+p,root));res.writeHead(200,{'content-type':/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/html'}).end(b);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('https://**/*',r=>r.fulfill({status:503,body:'Unavailable in local fixture'}));
 await page.goto(origin+'/index.html#relay/register');
 assert.equal(await page.locator('#nns-network').inputValue(),'juno-1');
 await page.locator('#nns-refresh').click();await page.waitForFunction(()=>!document.querySelector('#nns-refresh').disabled);
 assert.match(await page.locator('#nns-status').textContent(),/not open yet/);
 for(const id of ['nns-prepare','nns-payment','nns-check-name'])assert.equal(await page.locator('#'+id).isDisabled(),true);
 await page.goto(origin+'/names-mainnet-setup.html');
 assert.equal(await page.locator('#copy-private').isDisabled(),true);
 await page.locator('#create-key').click();await page.waitForFunction(()=>!document.querySelector('#download-private').disabled);
 const publicKey=await page.locator('#public-key').inputValue();assert.equal(Buffer.from(publicKey,'base64').length,32);
 const download=page.waitForEvent('download');await page.locator('#download-private').click();const pem=await readFile(await(await download).path(),'utf8');
 assert.match(pem,/BEGIN PRIVATE KEY/);
 const storage=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(storage.includes(publicKey));assert.ok(!storage.includes('PRIVATE KEY'));
 const planDownload=page.waitForEvent('download');await page.locator('#download-plan').click();const plan=JSON.parse(await readFile(await(await planDownload).path(),'utf8'));
 assert.equal(plan.registry_instantiate.quote_public_key,publicKey);assert.equal(plan.starts_paused,true);assert.equal(plan.chain_id,'juno-1');
 await page.reload();assert.equal(await page.locator('#public-key').inputValue(),publicKey);assert.equal(await page.locator('#create-key').isDisabled(),true);assert.equal(await page.locator('#copy-private').isDisabled(),true);
 await page.locator('#restore-key').setInputFiles({name:'price-test-backup.pem',mimeType:'application/x-pem-file',buffer:Buffer.from(pem)});
 await page.waitForFunction(()=>!document.querySelector('#copy-private').disabled);assert.equal(await page.locator('#public-key').inputValue(),publicKey);
 // Another tab cannot silently replace the remembered authority.
 const other=await context.newPage();await other.goto(origin+'/names-mainnet-setup.html');assert.equal(await other.locator('#create-key').isDisabled(),true);await other.close();
 if(process.env.NNS_SCREENSHOT_DIR)await mkdir(process.env.NNS_SCREENSHOT_DIR,{recursive:true});
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(process.env.NNS_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NNS_SCREENSHOT_DIR}/price-key-${width}.png`,fullPage:true});}
 await page.locator('#copy-public').focus();assert.notEqual(await page.locator('#copy-public').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
 assert.deepEqual(errors,[]);console.log('Mainnet absent-deployment gate, local key backup/restore, public plan, tab preservation and responsive setup passed.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
