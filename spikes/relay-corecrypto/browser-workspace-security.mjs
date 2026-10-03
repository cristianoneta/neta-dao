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
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}: {})});
 const context=await browser.newContext();
 await context.route('https://**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/smart/')){
   const query=JSON.parse(Buffer.from(decodeURIComponent(url.pathname.split('/smart/')[1]),'base64').toString());
   let data=[];
   if(query.config)data={owner:'owner'};
   if(query.proposals)data=query.proposals.start_after?[]:[proposal(1),proposal(2)];
   if(query.reverse_proposals)data={proposals:url.pathname.includes('juno13z0mu9cyd0rj9cwr0hgwm9rxl8g9zwleqjg6pulcyypts26nua8qkzmlg0')?[3,2,1].map(id=>({id,proposal:{title:['','Initial proposal','LLC Operating Agreement Ratification','Ratify Neta DAO Constitution'][id],description:'Historical main DAO decision '+id,status:'executed',votes:{yes:'1000000',no:'0',abstain:'0'},msgs:[],expiration:{at_height:100}}})):[]};
   if(query.revisions){const id=query.revisions.proposal_id;
    if(id===1)await new Promise(resolve=>setTimeout(resolve,350));
    data=[{revision:1,author:'author',title:'Proposal '+id,summary:'Summary '+id,body:'Body '+id,actions_json:'[]',created_time:id,change_note:'Initial'}];
   }
   if(query.comments){const id=query.comments.proposal_id;
    if(id===1)await new Promise(resolve=>setTimeout(resolve,350));
    data=[{id:1,body:id===2?'[[NETA_THREAD:%]]\nVisible comment 2':'Old comment 1',author:'author',verified_stake:'11000000',created_time:1},{id:2,parent_id:1,title:'hidden title',body:'NEVER RENDER HIDDEN BODY',author:'author',moderation:{hidden:true,reason:'spam'},created_time:1},{id:3,body:'[[NETA_REPLY:4]]\nforward reference',author:'author',created_time:1},{id:4,body:'[[NETA_REPLY:3]]\ncycle candidate',author:'author',created_time:1}];
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
  if(path.endsWith('neta-main-events.json'))return json(route,{scope:'neta-main-dao',treasuries:[{chain_id:'juno-1',address:'juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6'}],status:'UNAVAILABLE',events:[]});
  if(path.endsWith('events.json'))return json(route,{events:[]});
  const juno=path.endsWith('juno-community-pool.json');
  return json(route,{chain_id:'juno-1',treasury_type:'dao-core',treasury_address:path.endsWith("neta-main.json")?"juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6":undefined,generated_at:'2026-10-02T20:00:00Z',height:1,status:'LIVE',total_usd:juno?'200':'100',price_source:'mock',assets:[{type:'token',symbol:'JUNO',amount:'1',usd_value:juno?'200':'100'}]});
 });
 await context.route('**/data/daos/neta.json',route=>json(route,{chain_id:'juno-1',token_contract:'juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr',core:'juno1c5v6jkmre5xa9vf9aas6yxewc7aqmjy0rlkkyk4d88pnwuhclyhsrhhns6',voting_module:'juno1839rlmw33avduccuhpnv6cqxsdlwpz87vq8g6x6jkfrdzpwtl8nsgf20f4',staking_contract:'juno1a7x8aj7k38vnj9edrlymkerhrl5d4ud3makmqhx6vt3dhu0d824qh038zh',members_complete:true,members:[{address:'juno1'+'q'.repeat(38),power_raw:'1000000'}],total_power_raw:'1000000',height:100,generated_at:'2026-10-03T18:00:00Z'}));
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
 await page.locator('[data-workspace-view=governance]').click();
 await page.waitForFunction(()=>document.querySelector('#proposal-list').textContent.includes('Proposal 2'));
 await page.locator('#proposal-list button').filter({hasText:'Proposal 1'}).click();
 await page.locator('#proposal-list button').filter({hasText:'Proposal 2'}).click();
 await page.waitForFunction(()=>document.querySelector('#comment-list').textContent.includes('Visible comment 2'));
 await page.waitForTimeout(600);
 assert.equal(await page.locator('#proposal-heading').textContent(),'Proposal 2');
 assert.match(await page.locator('#comment-list').textContent(),/Visible comment 2/);
 assert.doesNotMatch(await page.locator('#comment-list').textContent(),/Old comment 1/);
 assert.doesNotMatch(await page.locator('#comment-list').textContent(),/NEVER RENDER HIDDEN BODY|hidden title/);
 assert.match(await page.locator('#comment-list').textContent(),/COMMENT HIDDEN BY MODERATION.*spam/);
 assert.match(await page.locator('#comment-list').textContent(),/cycle candidate/);
 assert.deepEqual(errors,[]);
 console.log('Workspace security: stale DAO snapshot, rapid proposal switch and malformed public marker passed');

 // Names is part of the actual RELAY route, with read-only controls.
 await page.goto(origin+'/index.html#relay/names');
 assert.equal(await page.locator('#names-view').isVisible(),true);
 assert.equal(new URL(page.url()).hash,'#relay/directory');
 assert.equal(await page.locator('[data-relay-panel="following"],.names-tabs').count(),0);
 for(const panel of ['contacts','profile','register','directory']){
  await page.locator(`[data-relay-panel="${panel}"]`).click();
  assert.equal(await page.locator(`[data-name-panel="${panel}"]`).isVisible(),true);
  assert.equal(new URL(page.url()).hash,'#relay/'+panel);
 }
 await page.goBack();
 assert.equal(await page.locator('[data-name-panel="register"]').isVisible(),true);
 await page.goForward();
 assert.equal(await page.locator('[data-name-panel="directory"]').isVisible(),true);
 const opsFollow=page.locator('#names-directory-list [data-relay-dao="neta-operations"]');
 assert.equal(await opsFollow.getAttribute('aria-pressed'),'true');
 await opsFollow.click();
 assert.equal(await opsFollow.getAttribute('aria-pressed'),'false');
 await page.locator('#names-directory-filter').selectOption('followed');
 assert.equal(await opsFollow.isVisible(),false);
 await page.reload();
 assert.equal(await opsFollow.getAttribute('aria-pressed'),'false');
 await opsFollow.click();
 assert.equal(await opsFollow.getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('neta-relay-favorites:v1')).includes('neta-operations')),true);
 await page.goto(origin+'/index.html#relay/following');
 await page.waitForURL(origin+'/index.html#relay/directory');
 assert.equal(new URL(page.url()).hash,'#relay/directory');
 assert.equal(await page.locator('.relay-hero').isVisible(),true);
 assert.equal(await page.getByText('Explore the preview',{exact:true}).count(),0);
 await page.getByRole('button',{name:'View NETA Operations DAO',exact:true}).click();
 assert.equal(await page.locator('[data-name-panel="dao"]').isVisible(),true);
 assert.match(await page.locator('#names-dao-address').textContent(),/^juno1excmam/);
 assert.equal(await page.getByRole('button',{name:'Send NETA',exact:true}).isDisabled(),true);
 assert.equal(await page.locator('[data-name-panel="dao"] [data-relay-dao]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-name-panel="dao"] [data-relay-dao]').click();
 assert.equal(await opsFollow.getAttribute('aria-pressed'),'false');
 await page.locator('[data-name-panel="dao"] [data-relay-dao]').click();
 await page.getByRole('button',{name:'← Back to directory',exact:true}).click();
 await page.locator('#names-directory-query').fill('<img src=x onerror=alert(1)>');
 assert.equal(await page.locator('#names-directory-list img').count(),0);
 await page.locator('#names-directory-query').fill('cristiano');
 await page.getByRole('button',{name:'Calculate name fee',exact:true}).click();
 for(const [label,total] of [['abc','$640 USD'],['abcd','$160 USD'],['cristiano','$5 USD']]){
  await page.locator('#names-fee-label').fill(label);
  assert.equal(await page.locator('#names-fee-total').textContent(),total);
 }
 await page.locator('#names-fee-years').selectOption('3');
 assert.equal(await page.locator('#names-fee-total').textContent(),'$15 USD');
 await page.locator('#names-fee-label').fill('ab');
 assert.equal(await page.locator('#names-fee-label').getAttribute('aria-invalid'),'true');
 assert.equal(await page.getByRole('button',{name:'REGISTER · COMING SOON',exact:true}).isDisabled(),true);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  let baseline;
  for(const panel of ['inbox','directory','contacts','profile','register']){
   await page.locator(`[data-relay-panel="${panel}"]`).click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'RELAY '+panel+' overflow at '+width);
   assert.equal(await page.locator('.relay-hero').isVisible(),true);
   assert.equal(await page.locator('.relay-hero .page-hero-art').isVisible(),width>960);
   const layout=await page.evaluate(()=>{
    const nav=document.querySelector('.relay-subnav'),card=document.querySelector('[data-relay-panel-view="inbox"]:not([hidden]) .relay-section-card, #names-view:not([hidden])');
    const rect=nav.getBoundingClientRect(),style=getComputedStyle(card),heading=getComputedStyle(card.querySelector('header h2'));
    return {navTop:Math.round(rect.top+scrollY),navLeft:Math.round(rect.left),navHeight:Math.round(rect.height),background:style.backgroundColor,border:style.borderColor,radius:style.borderRadius,padding:style.padding,headingSize:heading.fontSize,headingColor:heading.color};
   });
   if(!baseline)baseline=layout;
   else assert.deepEqual(layout,baseline,'Stable RELAY shell for '+panel+' at '+width);
  }
 }
 assert.equal(await page.locator('.names-heading h2').evaluate(el=>getComputedStyle(el).color),'rgb(242, 244, 247)');
 await page.locator('[data-relay-panel="inbox"]').click();
 assert.equal(await page.locator('.relay-hero').isVisible(),true);
 assert.equal(await page.locator('#names-view').isVisible(),false);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  for(const view of ['governance','delivery','contributors','treasury']){
   await page.locator(`button[data-workspace-view="${view}"]`).click();
   const hero=page.locator(`#${view==='governance'?'governance':view}-view .page-hero`);
   assert.equal(await hero.locator('.page-hero-art').isVisible(),width>960,view+' artwork at '+width);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,view+' overflow at '+width);
   assert.equal(await hero.locator(view==='governance'?'#new-draft':'.concept-badge').isVisible(),true);
  }
 }
 assert.deepEqual(errors,[]);
 console.log('Integrated Names: routing, contrast, responsive fee form, tariffs and disabled writes passed');

 await page.getByRole('button',{name:'RELAY',exact:true}).click();
 await page.locator('[data-relay-panel="directory"]').click();
 await page.locator('#names-directory-query').fill('');
 await page.getByRole('button',{name:'View Juno Governance',exact:true}).click();
 assert.equal(new URL(page.url()).hash,'#relay/dao/juno');
 assert.match(await page.locator('#names-dao-profile').textContent(),/juno-governance.dao.neta/);
 assert.equal(await page.locator('#names-copy-address').count(),0);
 await page.getByRole('button',{name:'← Back to directory',exact:true}).click();
 await page.getByRole('button',{name:'View Neta DAO',exact:true}).click();
 assert.equal(new URL(page.url()).hash,'#relay/dao/neta');
 assert.match(await page.locator('#names-dao-address').textContent(),/^juno1c5v6/);
 await page.getByRole('button',{name:'View participation',exact:true}).click();
 assert.equal(await page.locator('#dao-search').inputValue(),'Neta DAO');
 await page.waitForFunction(()=>document.querySelector('#dao-members-panel').textContent.includes('1 active staking addresses'));
 await page.getByRole('button',{name:'Treasury',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#treasury-live-status').textContent.includes('NETA DAO'));
 assert.equal(await page.locator('#treasury-nns').isVisible(),true);
 assert.match(await page.locator('#treasury-events').textContent(),/history unavailable/i);
 assert.equal(await page.locator('.allocation-card').isVisible(),false);
 assert.equal(await page.locator('.treasury-bottom-grid').isVisible(),false);
 assert.doesNotMatch(await page.locator('.treasury-events-note').textContent(),/OSMOSIS/i);
 assert.match(await page.locator('#treasury-nns').textContent(),/Not active yet/);
 await page.getByRole('button',{name:'Proposals',exact:true}).click();
 assert.equal(await page.locator('#primary-action').isDisabled(),true);
 assert.match(await page.locator('#action-hint').textContent(),/not connected/);
 await page.waitForFunction(()=>document.querySelector('#proposal-list').textContent.includes('Ratify Neta DAO Constitution'));
 await page.locator('#proposal-list button').filter({hasText:'Ratify Neta DAO Constitution'}).click();
 assert.equal(await page.locator('#proposal-heading').textContent(),'Ratify Neta DAO Constitution');
 assert.match(await page.locator('#action-hint').textContent(),/Neta DAO proposal module/);
 assert.equal(await page.locator('#vote-actions').isVisible(),false);
 await page.reload();
 assert.equal(await page.locator('#dao-search').inputValue(),'Neta DAO');
 for(const width of [320,768,1440]){
  await page.setViewportSize({width,height:1000});
  await page.getByRole('button',{name:'Contributors',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'main DAO member overflow');
 }
 assert.deepEqual(errors,[]);
 console.log('DAO onboarding: Juno/native identity, NETA profile, membership, treasury scope, disabled writes and persistence passed');
 // Reject unknown directory routes instead of displaying Operations identity.
 await page.goto(origin+'/index.html#relay/dao/not-a-dao');
 assert.match(await page.locator('#names-dao-profile').textContent(),/Unknown DAO/);
 assert.equal(await page.locator('#names-copy-address').count(),0);
 // Snapshot identity checks include chain and voting token.
 await context.route('**/data/daos/neta.json',route=>json(route,{chain_id:'wrong-chain',members_complete:true,members:[]}));
 await page.goto(origin+'/index.html#relay/dao/neta');await page.reload();
 await page.waitForFunction(()=>document.querySelector('#names-dao-profile').textContent.includes('Membership unavailable'));
 await context.unroute('**/data/daos/neta.json');
 // Wrong event scope cannot masquerade as the selected DAO's payments.
 await context.route('**/data/treasury/neta-main-events.json*',route=>json(route,{scope:'neta-operations-cross-chain',events:[{title:'FOREIGN PAYMENT'}]}));
 await page.getByRole('button',{name:'View treasury',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#treasury-events').textContent.includes('source identity'));
 assert.doesNotMatch(await page.locator('#treasury-events').textContent(),/FOREIGN PAYMENT/);
 await context.unroute('**/data/treasury/neta-main-events.json*');
 if(process.env.SCREENSHOT_DIR){
  // Use actual committed snapshots for visual review, while chain queries stay synthetic.
  await context.unroute('**/data/treasury/**');
  const {mkdir}=await import('node:fs/promises');await mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
  for(const width of [320,768,1440]){
   await page.setViewportSize({width,height:1000});
   for(const view of ['treasury','contributors','relay/dao/neta','relay/dao/juno']){
    await page.goto(origin+'/index.html#'+view);await page.reload();await page.waitForTimeout(500);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    assert.equal(await page.locator('.gov-header').evaluate(el=>Math.round(el.getBoundingClientRect().top)),0,'header at page top');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,view+' real snapshot overflow '+width);
    await page.screenshot({path:process.env.SCREENSHOT_DIR+'/'+view.replaceAll('/','-')+'-'+width+'.png',fullPage:true});
   }
  }
 }


 // Exercise the actual shared generated bundle with synthetic TxRaw data only.
 const attempt=()=>page.evaluate(async()=>{
   let signs=0,broadcasts=0;
   const client={getChainId:async()=> 'juno-1',getTx:async()=>null,simulate:async()=>100,
     gasPrice:{denom:'ujuno',amount:{multiply:()=>({ceil:()=>({toString:()=> '1'})})}},
     sign:async(_sender,_messages,fee)=>{if(fee.amount[0].denom!=='ujuno')throw Error('wrong fee denom');signs++;return {bodyBytes:new Uint8Array([1]),authInfoBytes:new Uint8Array([10,2,24,7]),signatures:[new Uint8Array([2])]};},
     broadcastTx:async()=>{broadcasts++;throw Error('node accepted, response lost');}};
   let error;try{await window.NetaSocialsTestnet.execute(client,'journal-fixture','contract',{test:{}},'local fixture');}catch(e){error=e.message;}
   return {error,signs,broadcasts,record:JSON.parse(localStorage.getItem('neta-pending-tx-v1:juno-1:journal-fixture'))};
 });
 const first=await attempt();assert.match(first.error,/OUTCOME UNKNOWN/);assert.equal(first.signs,1);assert.equal(first.broadcasts,1);assert.equal(first.record.sequence,'7');
 await page.reload();await page.waitForFunction(()=>!!window.NetaSocialsTestnet);
 const second=await attempt();assert.match(second.error,/RETRY LOCKED/);assert.equal(second.signs,0);assert.equal(second.broadcasts,0);assert.deepEqual(second.record,first.record);
 console.log('Shared signing bundle: exact signed transaction journal blocks repeated signatures after reload');
 await context.close();
}finally{await browser?.close();server.close();}



