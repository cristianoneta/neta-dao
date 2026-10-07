import assert from 'node:assert/strict';import http from 'node:http';import {readFile} from 'node:fs/promises';import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;const b=await readFile(new URL('.'+p,root));res.writeHead(200,{'content-type':/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':'text/html'}).end(b);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const address='1'.repeat(40),vote=`Vote{0:${address.slice(0,12)} 42452001/00/SIGNED_MSG_TYPE_PREVOTE(Prevote) AAAAAAAAAAAA signature @ 2026-10-07T07:00:00Z}`;
const snapshot={result:{round_state:{height:'42452001',round:0,step:4,validators:{validators:[{address,voting_power:'100'}]},votes:[{round:0,prevotes:[vote],precommits:['nil-Vote']}]}}};
let failing=false,diverge=false;
try{
 browser=await chromium.launch({headless:true,...(process.env.RELAY_CHROMIUM_PATH?{executablePath:process.env.RELAY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',async route=>{
  const u=new URL(route.request().url());if(failing)return route.fulfill({status:503,body:'Unavailable'});
  if(u.pathname.endsWith('/status'))return route.fulfill({json:{result:{node_info:{network:'juno-1'},sync_info:{latest_block_height:'42452000',latest_block_time:'2026-10-07T06:56:31Z'}}}});
  if(u.pathname.endsWith('dump_consensus_state')){const s=structuredClone(snapshot);if(diverge&&u.hostname.includes('stavr'))s.result.round_state.votes[0].prevotes[0]='nil-Vote';return route.fulfill({json:s});}
  return route.fulfill({json:{validators:[],pagination:{next_key:null}}});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/juno-upgrade-status.html');await page.waitForFunction(()=>document.getElementById('agreement').textContent.includes('same votes'));
 assert.equal(await page.locator('#validators tr').count(),1);assert.match(await page.locator('#validators').innerText(),/For block/);assert.match(await page.locator('#validators').innerText(),/No vote observed/);assert.match(await page.locator('.metric').first().innerText(),/100.00%/);
 diverge=true;await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('agreement').textContent.includes('differ'));await page.locator('#observer').selectOption('1');assert.doesNotMatch(await page.locator('#validators').innerText(),/For block/);
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/juno-upgrade-'+width+'.png',fullPage:true});}
 failing=true;await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('network-state').textContent.includes('unavailable'));assert.equal(await page.locator('#validators tr').count(),0);assert.equal(await page.locator('.metric').count(),0);assert.equal(await page.locator('#refresh').isEnabled(),true);
 assert.deepEqual(errors,[]);console.log('Juno consensus browser: independent observers, round-specific weighted votes, disagreement, unavailable data and responsive layout passed. Mock RPC; no wallet or transaction.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
