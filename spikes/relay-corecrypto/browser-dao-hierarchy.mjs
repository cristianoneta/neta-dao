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
mainLedger.refresh_status=opsLedger.refresh_status='completed';
mainLedger.entries=mainLedger.entries.filter(r=>r.tx_hash==='85689A2C75DE86829D4116FA0AABBA5062D269679CA139984E169E8E2ACF8DC1');
const receipt=mainLedger.entries[0];assert.ok(receipt);
const review={status:'PARTIAL',event_refresh_status:'PARTIAL',accounting_start:'2026-10-01T00:00:00Z',unreviewed_movements:0,matched_receipts:0,unmatched_receipt_ids:[],movements:[]};
mainLedger.movement_review={...review,matched_receipts:1,movements:[{id:receipt.id,tx_hash:receipt.tx_hash,timestamp:receipt.timestamp,denom:`cw20:${receipt.token}`,direction:'in',raw_amount:receipt.raw_amount,counterparty:receipt.registry,classification:receipt.category,usd_value:receipt.usd_value,receipt_id:receipt.id}]};
opsLedger.entries=[];opsLedger.coverage_gaps=[];opsLedger.execution_candidates=[];opsLedger.movement_review=review;
opsLedger.sources=ops.accountingSource.treasuries.map(t=>({...t,adapter:'cosmos-rest-receipts',accounting_start:'2026-10-01T00:00:00Z',last_scanned_height:100,anchor_hash:'A'.repeat(64)}));
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
 // Structure shares the canonical scope selector; graph clicks never create wallet actions.
 for(const [organization,mainId,childId] of [['neta','neta','neta-operations'],['juno','juno','juno-delegation']]){
  await page.goto(origin+'/index.html?dao='+organization+'#people');
  await page.waitForURL('**#people/structure');
  await page.locator('.structure-node').first().waitFor();
  assert.equal(await page.locator('[data-people-panel]').first().innerText(),'DAO structure');
  assert.equal(await page.locator('.structure-node').count(),2);
  assert.equal(await page.locator('.structure-node[aria-pressed="true"]').count(),0);
  assert.equal(await page.locator('.structure-overview').getAttribute('aria-pressed'),'true');
  await page.locator(`[data-structure-id="${childId}"]`).click();
  assert.equal(await page.locator('#subdao-select').inputValue(),childId);
  assert.equal(await page.locator(`[data-structure-id="${childId}"]`).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator(`[data-structure-id="${childId}"]`).evaluate(el=>el===document.activeElement),true);
  assert.equal(new URL(page.url()).searchParams.get('subdao'),childId);
  await page.reload();await page.locator('.structure-node').first().waitFor();
  assert.equal(await page.locator(`[data-structure-id="${childId}"]`).getAttribute('aria-pressed'),'true');
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(()=>window.scrollTo(0,0));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`structure overflow at ${width}`);
   if(process.env.NNS_SCREENSHOT_DIR){await mkdir(process.env.NNS_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:`${process.env.NNS_SCREENSHOT_DIR}/structure-${organization}-${width}.png`,fullPage:true})}
  }
  await page.locator('.structure-overview').press('Enter');
  assert.equal(await page.locator('#subdao-select').inputValue(),'all');
  assert.equal(new URL(page.url()).searchParams.has('subdao'),false);
  await page.locator('#subdao-select').selectOption(mainId);
  assert.equal(await page.locator(`[data-structure-id="${mainId}"]`).getAttribute('aria-pressed'),'true');
  await page.locator('[data-people-panel="members"]').click();
  assert.equal(await page.locator('#dao-structure-panel').isVisible(),false);
  assert.equal(await page.locator('#dao-members-panel').isVisible(),true);
  await page.locator('[data-people-panel="structure"]').click();
  assert.equal(await page.locator('#dao-structure-panel').isVisible(),true);
 }
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
 assert.equal(await page.locator('.pnl-units table tr').count(),3);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,`hierarchy overflow at ${width}`);
  assert.equal(await page.locator('#subdao-select').isVisible(),true);
  if(width<=640)assert.equal(await page.locator('.pnl-units tbody tr').first().locator('td').first().evaluate(el=>getComputedStyle(el,'::before').content),'\"Income\"');
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
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#subdao-select').value==='neta');
 assert.equal(await page.locator('#subdao-select').inputValue(),'neta');
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
 // Juno uses the same shell and consolidation with its named main unit.
 await page.goto(origin+'/index.html?dao=juno#treasury');
 await page.waitForFunction(()=>document.querySelector('#treasury-units').children.length===2&&!document.querySelector('#treasury-units').hidden);
 assert.deepEqual(await page.locator('#subdao-select option').allTextContents(),['Consolidated overview','Community Pool','Delegation Programme']);
 const junoUnits=inventory.daos.filter(d=>d.organizationId==='juno');
 const junoSnapshots=await Promise.all(junoUnits.map(d=>read(d.snapshot)));
 const junoExpected=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(junoSnapshots.reduce((n,d)=>n+Number(d.total_usd),0));
 assert.equal(await page.locator('#treasury-total').innerText(),junoExpected);
 await page.locator('[data-section="income"]').click();
 assert.match(await page.locator('#pnl-rows').innerText(),/Community Tax/);
 assert.match(await page.locator('#pnl-rows').innerText(),/Other income/);
 assert.doesNotMatch(await page.locator('#pnl-rows').innerText(),/NNS registrations/);
 assert.match(await page.locator('.pnl-result').innerText(),/—/);
 for(const unit of ['juno','juno-delegation','all']){
  await page.locator('#subdao-select').selectOption(unit);
  await page.waitForFunction(()=>!document.querySelector('#treasury-refresh').disabled);
  if(unit==='juno-delegation'){
   assert.match(await page.locator('#treasury-assets').innerText(),/JUNO · Delegated/);
   assert.match(await page.locator('#treasury-assets').innerText(),/JUNO · Claimable rewards/);
   assert.doesNotMatch(await page.locator('.treasury-events-note').innerText(),/Operations|Polytone/);
   assert.equal(await page.locator('#pnl-account-community_tax').count(),0);
  }
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,`Juno ${unit} overflow at ${width}`);
   assert.equal(await page.locator('.testnet-pill').isVisible(),false);
   if(process.env.NNS_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NNS_SCREENSHOT_DIR}/juno-${unit}-${width}.png`,fullPage:true});
  }
 }
 // A foreign-address snapshot must not appear in the standalone treasury either.
 await context.route('**/juno-delegation.json*',async r=>json(r,{...junoSnapshots.find(d=>d.dao_id==='juno-delegation'),treasury_address:'foreign'}));
 await page.locator('#subdao-select').selectOption('juno-delegation');
 await page.waitForFunction(()=>document.querySelector('#treasury-live-status').textContent==='LIVE DATA UNAVAILABLE');
 assert.equal(await page.locator('#treasury-total').innerText(),'—');
 // Synthetic branches are test-only; production contains only directory-backed units.
 const directoryScript=await readFile(new URL('dao-directory.js',root),'utf8');
 const extraUnits=Array.from({length:4},(_,i)=>({...ops,id:`test-branch-${i}`,unitName:`Test branch ${i}`,parentDaoId:i===3?'test-branch-0':'neta'}));
 await context.route('**/dao-directory.js*',r=>r.fulfill({contentType:'text/javascript',body:directoryScript+';window.NetaDaoDirectory=Object.freeze([...window.NetaDaoDirectory,...'+JSON.stringify(extraUnits)+'].map(Object.freeze));'}));
 await page.goto(origin+'/index.html?dao=neta#people/structure');await page.locator('.structure-node').first().waitFor();
 assert.equal(await page.locator('.structure-node').count(),6);
 assert.equal(await page.locator('.structure-branches .structure-branches').count(),1);
 for(const width of [320,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`multi-level structure overflow at ${width}`)}
 assert.deepEqual(errors,[]);
 console.log('DAO hierarchy: organizational grouping, custody, consolidated P&L, failures, stale responses, navigation and 320–1440px passed');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
