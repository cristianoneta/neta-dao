import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{
 try {const path=new URL(req.url,'http://localhost').pathname;
  if(path.includes('..')){res.writeHead(400).end();return;}
  const body=await readFile(new URL('.'+path,root));
  res.writeHead(200,{'content-type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':'text/html'}).end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
const json=(route,data)=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
const proposal=id=>({id,author:'juno1'+'q'.repeat(38),title:'Proposal '+id,status:'discussion',current_revision:1,created_time:id});
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext();
 await context.route('https://**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/smart/')){
   const query=JSON.parse(Buffer.from(decodeURIComponent(url.pathname.split('/smart/')[1]),'base64').toString());
   let data=[];
   if(query.config)data={owner:'owner'};
   if(query.proposals)data=query.proposals.start_after?[]:[proposal(1),proposal(2)];
   if(query.reverse_proposals)data={proposals:[]};
   if(query.revisions){const id=query.revisions.proposal_id;
    if(id===1)await new Promise(resolve=>setTimeout(resolve,350));
    data=[{revision:1,author:'author',title:'Proposal '+id,summary:'Summary '+id,body:'Body '+id,actions_json:'[]',created_time:id,change_note:'Initial'}];
   }
   if(query.comments){const id=query.comments.proposal_id;
    if(id===1)await new Promise(resolve=>setTimeout(resolve,350));
    data=[{id:1,body:id===2?'[[NETA_THREAD:%]]\nVisible comment 2':'Old comment 1',author:'author',verified_stake:'11000000',created_time:1}];
   }
   return json(route,{data});
  }
  if(url.pathname.endsWith('/proposals'))return json(route,{proposals:[],pagination:{total:'0'}});
  if(url.pathname.endsWith('/deposit'))return json(route,{params:{min_deposit:[]}});
  if(url.pathname.endsWith('/voting'))return json(route,{params:{}});
  return json(route,{});
 });
 let delayOperations=true;
 await context.route('**/data/treasury/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('current.json')&&delayOperations)await new Promise(resolve=>setTimeout(resolve,500));
  if(path.endsWith('history.json'))return json(route,{snapshots:[]});
  if(path.endsWith('events.json'))return json(route,{events:[]});
  const juno=path.endsWith('juno-community-pool.json');
  return json(route,{generated_at:'2026-10-02T20:00:00Z',height:1,status:'LIVE',total_usd:juno?'200':'100',price_source:'mock',assets:[{type:'token',symbol:'JUNO',amount:'1',usd_value:juno?'200':'100'}]});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/index.html');
 await page.locator('#dao-search').fill('Juno');
 await page.locator('#dao-options button').filter({hasText:'Juno Network Governance'}).click();
 await page.waitForFunction(()=>document.querySelector('#treasury-total').textContent==='$200.00');
 await page.waitForTimeout(700);
 assert.equal(await page.locator('#treasury-total').textContent(),'$200.00','old Operations response overwrote Community Pool');
 assert.match(await page.locator('#treasury-live-status').textContent(),/JUNO COMMUNITY POOL/);
 delayOperations=false;
 await page.locator('#dao-search').fill('Operations');
 await page.locator('#dao-options button').filter({hasText:'NETA Operations DAO'}).click();
 await page.waitForFunction(()=>document.querySelector('#proposal-list').textContent.includes('Proposal 2'));
 await page.locator('#proposal-list button').filter({hasText:'Proposal 1'}).click();
 await page.locator('#proposal-list button').filter({hasText:'Proposal 2'}).click();
 await page.waitForFunction(()=>document.querySelector('#comment-list').textContent.includes('Visible comment 2'));
 await page.waitForTimeout(600);
 assert.equal(await page.locator('#proposal-heading').textContent(),'Proposal 2');
 assert.match(await page.locator('#comment-list').textContent(),/Visible comment 2/);
 assert.doesNotMatch(await page.locator('#comment-list').textContent(),/Old comment 1/);
 assert.deepEqual(errors,[]);
 console.log('Workspace security: stale DAO snapshot, rapid proposal switch and malformed public marker passed');
 await context.close();
}finally{await browser?.close();server.close();}
