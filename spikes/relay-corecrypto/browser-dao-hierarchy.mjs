import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const inventory=JSON.parse(await readFile(new URL('data/dao-directory.json',root)));
const read=async name=>JSON.parse(await readFile(new URL('data/treasury/'+name,root)));
const main=inventory.daos.find(d=>d.id==='neta'),ops=inventory.daos.find(d=>d.id==='neta-operations');
const mainLedger=await read(main.accountingSource.file),opsLedger=await read(ops.accountingSource.file);
mainLedger.last_success_at=opsLedger.last_success_at=new Date().toISOString();
const mainSnapshot=await read(main.snapshot),opsSnapshot=await read(ops.snapshot);
const expected=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(mainSnapshot.total_usd)+Number(opsSnapshot.total_usd));
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const body=await readFile(new URL('.'+path,root));res.writeHead(200,{'content-type':/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':'text/html'}).end(body)}catch{res.writeHead(404).end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext();await context.route('https://**/*',r=>r.abort());
 let missingOps=false,delayOps=false;
 const json=(route,data)=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 await context.route('**/neta-main-accounting.json*',r=>json(r,mainLedger));
 await context.route('**/neta-operations-accounting.json*',async r=>{if(delayOps)await new Promise(resolve=>setTimeout(resolve,500));return missingOps?r.fulfill({status:503,body:'unavailable'}):json(r,opsLedger)});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=`http://127.0.0.1:${server.address().port}`;
 await page.goto(origin+'/index.html?dao=neta#treasury');
 await page.waitForFunction(()=>document.querySelector('#treasury-units').children.length===2);
 assert.equal(await page.locator('#dao-search').inputValue(),'NETA');
 assert.deepEqual(await page.locator('#subdao-select option').allTextContents(),['Consolidated overview','Main','Operations']);
 assert.equal(await page.locator('#subdao-select').inputValue(),'all');
 assert.equal(await page.locator('#treasury-total').innerText(),expected);
 assert.equal(await page.locator('.testnet-pill').isVisible(),false);
 assert.match(await page.locator('#treasury-units').innerText(),/Organizational SubDAO of NETA/);
 assert.match(await page.locator('#pnl-coverage').innerText(),/Consolidated · provisional/);
 await page.getByText('Breakdown by DAO unit',{exact:true}).click();
 assert.equal(await page.locator('.pnl-units tbody tr,.pnl-units table > tr').count(),3);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,`hierarchy overflow at ${width}`);
  assert.equal(await page.locator('#subdao-select').isVisible(),true);
  if(process.env.NNS_SCREENSHOT_DIR){await mkdir(process.env.NNS_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:`${process.env.NNS_SCREENSHOT_DIR}/dao-hierarchy-${width}.png`,fullPage:true})}
 }
 await page.locator('#subdao-select').selectOption('neta-operations');
 await page.waitForFunction(()=>document.querySelector('#pnl-coverage').textContent==='Provisional · recorded transactions');
 assert.equal(new URL(page.url()).searchParams.get('subdao'),'neta-operations');
 assert.equal(await page.locator('#treasury-units').isVisible(),false);
 assert.equal(await page.locator('.testnet-pill').isVisible(),false);
 await page.getByRole('button',{name:'Proposals',exact:true}).click();
 assert.equal(await page.locator('.testnet-pill').isVisible(),true);
 assert.match(await page.locator('.testnet-pill').innerText(),/UNI-7/);
 await page.getByRole('button',{name:'Treasury',exact:true}).click();
 assert.equal(await page.locator('.testnet-pill').isVisible(),false);
 await page.locator('#subdao-select').selectOption('neta');
 await page.reload();assert.equal(await page.locator('#subdao-select').inputValue(),'neta');
 assert.equal(new URL(page.url()).searchParams.get('subdao'),'main');
 // Organization picker chooses its consolidated view, not a hidden main-only balance.
 await page.locator('#dao-search').fill('NETA');await page.locator('#dao-options button').filter({hasText:'NETA'}).click();
 await page.waitForFunction(()=>document.querySelector('#treasury-units').children.length===2&&!document.querySelector('#treasury-units').hidden);
 assert.equal(new URL(page.url()).searchParams.has('subdao'),false);
 missingOps=true;await page.locator('#treasury-refresh').click();
 await page.waitForFunction(()=>document.querySelector('#pnl-coverage').textContent.includes('incomplete accounting'));
 assert.match(await page.locator('.pnl-result').innerText(),/—/);
 assert.doesNotMatch(await page.locator('.pnl-result').innerText(),/\$5/);
 missingOps=false;delayOps=true;await page.locator('#treasury-refresh').click();
 await page.locator('#subdao-select').selectOption('neta');
 await page.waitForFunction(()=>document.querySelector('#pnl-coverage').textContent==='Provisional · recorded transactions');
 await page.waitForTimeout(700);assert.equal(await page.locator('#treasury-units').isVisible(),false);
 assert.doesNotMatch(await page.locator('#pnl-coverage').innerText(),/Consolidated/);
 // Legacy Operations bookmarks retain their exact unit.
 await page.goto(origin+'/index.html?dao=neta-operations#treasury');
 await page.waitForFunction(()=>document.querySelector('#subdao-select').value==='neta-operations');
 assert.equal(await page.locator('#dao-search').inputValue(),'NETA');
 await page.locator('#subdao-select').press('Home');await page.locator('#subdao-select').press('Enter');
 assert.deepEqual(errors,[]);
 console.log('DAO hierarchy: organizational grouping, custody, consolidated P&L, failures, stale responses, navigation and 320–1440px passed');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
