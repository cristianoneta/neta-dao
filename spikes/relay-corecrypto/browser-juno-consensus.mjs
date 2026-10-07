import assert from 'node:assert/strict';import http from 'node:http';import {readFile,mkdir} from 'node:fs/promises';import {chromium} from 'playwright';
import {commitFixture} from '../../tests/fixtures/juno-commits.mjs';
const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html');const b=await readFile(new URL('.'+p,root));res.writeHead(200,{'content-type':/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':'text/html'}).end(b);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const saved=JSON.parse(await readFile(new URL('data/juno-validator-names-2026-10-07.json',root),'utf8')).validators;
const validators=saved.map((v,i)=>({address:v.address,voting_power:String(i<3?100:10)}));
let failing=false,oneFailed=false,diverge=false,stale=false,waiting=false,historyFailed=false;let consensusReads=0;let historyAvailable=true;
const shotDir=process.env.NNS_SCREENSHOT_DIR||'/tmp/juno-compact';await mkdir(shotDir,{recursive:true});
try{
 browser=await chromium.launch({headless:true,...(process.env.RELAY_CHROMIUM_PATH?{executablePath:process.env.RELAY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const historyNow=Date.now();
 const historyFixture={schema:1,upgradeId:'juno-v31',chainId:'juno-1',upgradeHeight:42452000,halt:{height:42452000,hash:'A'.repeat(64),time:new Date(historyNow-120000).toISOString()},scannedThrough:42452150,scannedHash:'B'.repeat(64),updatedAt:new Date(historyNow).toISOString(),firstResumedSignatureTime:new Date(historyNow-30000).toISOString(),validators,firstSignatures:Object.fromEntries(validators.map((v,i)=>[v.address,i<23?{height:42452001,blockHash:'C'.repeat(64),timestamp:new Date(historyNow-30000).toISOString(),secondsFromHalt:90,blocksAfterRestart:0,signature:Buffer.alloc(64).toString('base64')}:null])),complete:false};
 await page.route('**/data/validator-upgrades/juno-v31.json',route=>historyAvailable?route.fulfill({json:historyFixture}):route.fulfill({status:503,body:'History unavailable fixture'}));
 await page.route('https://**/*',async route=>{
  const u=new URL(route.request().url());if(failing||(oneFailed&&u.hostname.includes('publicnode')))return route.fulfill({status:503,body:'Unavailable'});
  const time=stale?'2026-10-07T06:56:31Z':new Date().toISOString();
  const f=commitFixture(validators,42452150,time);
  if(u.pathname.endsWith('/status'))return route.fulfill({json:{result:{node_info:{network:'juno-1'},sync_info:{latest_block_height:waiting?'42452000':'42452151',latest_block_time:time,catching_up:false}}}});
  if(u.pathname.endsWith('/validators'))return route.fulfill({json:f.set});
  if(u.pathname.endsWith('/commit')){
   if(historyFailed)return route.fulfill({status:503,body:'History unavailable'});
   const block=f.commits[42452150-Number(u.searchParams.get('height'))];
   if(diverge&&u.hostname.includes('stavr'))block.result.signed_header.commit.signatures[4]={block_id_flag:1,validator_address:'',signature:null};
   return route.fulfill({json:block});
  }
  if(u.pathname.endsWith('/dump_consensus_state')){consensusReads++;return route.fulfill({json:{result:{round_state:{height:'42452001',round:0,validators:{validators},votes:[{round:0,prevotes:validators.map(()=> 'nil-Vote'),precommits:validators.map(()=> 'nil-Vote')}]}}}});}
  return route.fulfill({status:503,body:'Metadata unavailable'});
 });
 const refresh=async()=>{await page.locator('#refresh').click();await page.waitForFunction(()=>!document.getElementById('refresh').disabled);};
 await page.goto('http://127.0.0.1:'+server.address().port+'/juno-upgrade-status.html');await page.waitForURL('**/community-tools/validator-upgrades/juno-v31/');await page.waitForFunction(()=>document.getElementById('agreement').textContent.includes('Both sources agree'));
 await page.locator('#auto').uncheck();await page.waitForFunction(()=>document.getElementById('names-state').textContent.includes('Current metadata is unavailable'));
 await page.waitForFunction(()=>document.getElementById('history-state').textContent.includes('Partial evidence'));assert.match(await page.locator('#validators').innerText(),/11m 33s/);assert.match(await page.locator('#validators').innerText(),/Not captured/);const stakeflow=page.locator('#validators tr').filter({hasText:'Stakeflow'});assert.match(await stakeflow.innerText(),/≤ 1m 30s/);assert.match(await stakeflow.innerText(),/Block signature/);assert.match(await stakeflow.locator('a').getAttribute('href'),/commit\?height=42452001/);await page.locator('#sort').selectOption('response');assert.match(await page.locator('#validators tr').first().innerText(),/The_Cybernetics/);await page.locator('#sort').selectOption('status');await page.locator('#readiness-summary').click();assert.match(await page.locator('#readiness-note').innerText(),/54.77%/);assert.equal(await page.locator('#readiness-events tr').count(),14);await page.locator('#readiness-summary').click();await page.locator('#timing').selectOption('commits');await page.waitForFunction(()=>document.getElementById('history-state').textContent.includes('scanned through'));assert.match(await page.locator('#validators').innerText(),/1m 30s/);assert.equal(await page.locator('#validators tr').count(),25);assert.equal(await page.locator('#power').innerText(),'96.15%');assert.equal(await page.locator('#count').innerText(),'23 / 25');assert.equal(consensusReads,0,'healthy chain never uses empty live-round votes');
 assert.equal(await page.locator('#source-details').getAttribute('open'),null);assert.ok((await page.locator('#validators').innerText()).includes(saved[0].name));
 assert.match(await page.locator('#validators tr').first().innerText(),/No signature/);
 await page.locator('#filter').selectOption('missing');assert.equal(await page.locator('#validators tr').count(),2);await page.locator('#filter').selectOption('signed');assert.equal(await page.locator('#validators tr').count(),23);await page.locator('#filter').selectOption('all');
 await page.locator('#timing').selectOption('votes');
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:shotDir+'/juno-compact-'+width+'.png',fullPage:true});if(width===1440)assert.ok((await page.locator('#validators').boundingBox()).y<760,'validator table is above the fold');}
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement!==document.body),true);
 await page.setViewportSize({width:720,height:500});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 historyAvailable=false;await page.reload();await page.locator('#timing').selectOption('commits');await page.waitForFunction(()=>document.getElementById('history-state').textContent.includes('unavailable'));assert.equal(await page.locator('.first-signature a').count(),0);await page.locator('#auto').uncheck();
 diverge=true;await refresh();assert.match(await page.locator('#quality').innerText(),/Sources differ/);await page.locator('#source-details > summary').click();await page.locator('#observer').selectOption('1');assert.equal(await page.locator('#count').innerText(),'22 / 25');await page.locator('#observer').selectOption('auto');diverge=false;
 oneFailed=true;await refresh();assert.match(await page.locator('#quality').innerText(),/Single source/);assert.match(await page.locator('#basis').innerText(),/STAVR/);oneFailed=false;
 stale=true;await refresh();assert.match(await page.locator('#network-state').innerText(),/stale/);stale=false;
 historyFailed=true;await refresh();assert.equal(await page.locator('#power').innerText(),'—');assert.equal(await page.locator('#validators tr').count(),25);assert.match(await page.locator('#validators').innerText(),/Live unavailable/);assert.equal(consensusReads,0);historyFailed=false;
 waiting=true;await refresh();assert.match(await page.locator('#scope').innerText(),/empty round/);assert.equal(await page.locator('#power').innerText(),'0.00%');assert.match(await page.locator('#power-label').innerText(),/Voting in this round/);assert.match(await page.locator('#validators').innerText(),/Not observed/);waiting=false;
 failing=true;await refresh();assert.match(await page.locator('#network-state').innerText(),/unavailable/);assert.equal(await page.locator('#validators tr').count(),25);assert.equal(await page.locator('#power').innerText(),'—');assert.deepEqual(errors,[]);
 await page.goto('http://127.0.0.1:'+server.address().port+'/community-tools/');assert.equal(await page.locator('.gov-header .faucet-dao-promo').count(),1);assert.equal(await page.locator('.tool-card').count(),2);await page.getByRole('link',{name:/Validator Upgrade Status/}).click();assert.match(page.url(),/validator-upgrades\/$/);assert.equal(await page.getByRole('link',{name:/Juno v31/}).getAttribute('href'),'/community-tools/validator-upgrades/juno-v31/');
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:shotDir+'/upgrade-list-'+width+'.png',fullPage:true});}
 await page.goto('http://127.0.0.1:'+server.address().port+'/community-tools/');for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:shotDir+'/community-tools-'+width+'.png',fullPage:true});}
 console.log('Juno compact tracker: canonical five-block window, empty-round regression, filters, source disagreement/fallback, stale/missing data, dated names and 320–1440px passed. Mock RPC; no wallet or transaction.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
