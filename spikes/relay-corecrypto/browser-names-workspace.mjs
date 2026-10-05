import {MAINNET_UPGRADE_ADMIN,MAINNET_REGISTRY_ADMIN} from '../../names/mainnet-config.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {SNAPSHOT_ARTIFACTS} from '../../names/mainnet-artifacts.mjs';
import {NETA,DAO} from '../../names/service/constants.mjs';
import {priceSnapshotPreimage} from '../../names-v2-core.mjs';
const mainnet=process.env.NNS_MAINNET==='1',chainId=mainnet?'juno-1':'uni-7';
const adminMode=process.env.NNS_ADMIN==='1';
const priceKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,7)]),format:'der',type:'pkcs8'});
const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('docs/deployments/nns-uni7-owner-2026-10-04.json', root)));
const owner = adminMode?MAINNET_REGISTRY_ADMIN:manifest.admin;
if(mainnet){Object.assign(manifest,{version:3,pricing_protocol:'treasury-snapshot-v1',chain_id:'juno-1',testnet_only:false,token:NETA,admin:MAINNET_REGISTRY_ADMIN,treasury:DAO,quote_public_key:createPublicKey(priceKey).export({format:'der',type:'spki'}).subarray(-32).toString('base64')});for(const role of ['registry','profiles'])Object.assign(manifest.contracts[role],{sha256:SNAPSHOT_ARTIFACTS[role].sha256,admin:MAINNET_UPGRADE_ADMIN});delete manifest.contracts.token;}
const recipient = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const config = {...manifest, purchases_paused: false, tariff_version: 2, tariff: {three_cents: 9900, four_cents: 1900, standard_cents: 500}};
let record = null, commitment = null, offer = null, revision = 0, lost = false, writes = [], delayedProfile = null, holdProfile = false;
let contacts = {description: '', discord: '', telegram: '', twitter: '', email: '', website: ''};
let priceUnavailable=false;
if(adminMode){assert.equal(mainnet,true);config.purchases_paused=true;for(const pin of Object.values(manifest.contracts))pin.creator=owner;}
const json = (route, data) => route.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(data)});
const server = http.createServer(async (req,res) => {try {const p=new URL(req.url,'http://localhost').pathname;const b=await readFile(new URL('.'+p,root));res.writeHead(200,{'content-type':/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/html'}).end(b);}catch {res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const context = await browser.newContext(), page = await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/docs/deployments/'+(mainnet?'nns-mainnet.json':'nns-uni7-owner-2026-10-04.json'),r=>json(r,manifest));
  if(mainnet)await context.route('**/data/nns/price.json',r=>{if(priceUnavailable)return r.fulfill({status:404,body:''});const now=Math.floor(Date.now()/1000),snapshot={signer_version:1,usd_per_neta_12:'2000000000000',observed_at:now-60,expires_at:now+86340};return json(r,{schema_version:1,chain_id:chainId,registry:manifest.registry,token:NETA,treasury:DAO,snapshot,signature:sign(null,Buffer.from(priceSnapshotPreimage(manifest,config,snapshot)),priceKey).toString('base64')});});
  await context.route('https://**/*', async route => {
    const p=new URL(route.request().url()).pathname;let data={};
    if(p.endsWith('/node_info'))data={default_node_info:{network:chainId}};
    else if(p.endsWith('/blocks/latest'))data={block:{header:{chain_id:chainId,height:'100',time:new Date().toISOString()}}};
    else if(p.includes('/smart/')) {
      const contract=p.split('/contract/')[1].split('/')[0],q=JSON.parse(Buffer.from(decodeURIComponent(p.split('/smart/')[1]),'base64').toString());
      let value=[];
      if(q.config)value=contract===manifest.registry?config:contract===manifest.profile_contract?{registry:manifest.registry}:{owner};
      else if(q.token_info)value={decimals:6};
      else if(q.name_of)value={address:q.name_of.address,name:record?.owner===q.name_of.address?record.name:null};
      else if(q.resolve)value={name:q.resolve.name,owner:record?.owner||null,active:!!record,in_grace:false,available:!record,expires_at:record?.expires_at||null,next_generation:record?2:1};
      else if(q.identity)value=record;
      else if(q.commitment)value=commitment;
      else if(q.transfer_offer)value=offer;
      else if(q.profile){if(holdProfile)await new Promise(resolve=>delayedProfile=resolve);value={active:!!record,profile:{identity:record,revision,contacts}};}
      else if(q.access)value={can_publish:false,can_comment:false};
      data={data:value};
    } else if(p.includes('/code/'))data={code_info:{data_hash:Object.values(manifest.contracts).find(c=>String(c.code_id)===p.split('/code/')[1])?.sha256}};
    else if(p.includes('/contract/')){const contract=p.split('/contract/')[1],role=contract===manifest.registry?'registry':contract===manifest.token?'token':'profiles';data={contract_info:{code_id:String(manifest.contracts[role].code_id),creator:owner,admin:mainnet?MAINNET_UPGRADE_ADMIN:''}};}
    return json(route,data);
  });
  await page.exposeFunction('simulateNamesWrite',request=>{
    writes.push(request);const msg=request.msg;
    if(msg.commit)commitment={hash:msg.commit.hash};
    else if(msg.send){
      assert.equal(request.contract,manifest.token);assert.equal(msg.send.contract,manifest.registry);
      const hook=JSON.parse(Buffer.from(msg.send.msg,'base64').toString()),q=(hook.register||hook.renew||hook.register_snapshot||hook.renew_snapshot).offer.quote;
      if(hook.register||hook.register_snapshot){assert.ok(commitment);record={name:q.name,owner:request.owner,generation:1,ownership_revision:1,expires_at:Math.floor(Date.now()/1000)+31536000};commitment=null;}
      else record.expires_at+=31536000;
    }else if(msg.update_contacts){assert.equal(msg.update_contacts.expected_revision,revision);contacts=structuredClone(msg.update_contacts.contacts);revision++;}
    else if(msg.offer_transfer){offer={id:1,name:record.name,owner:record.owner,recipient:msg.offer_transfer.recipient,generation:1,ownership_revision:record.ownership_revision,expires_at:msg.offer_transfer.expires_at};}
    else if(msg.accept_transfer){assert.equal(request.owner,offer.recipient);record.owner=request.owner;record.ownership_revision++;offer=null;contacts=Object.fromEntries(Object.keys(contacts).map(k=>[k,'']));revision++;}
    else if(msg.cancel_transfer)offer=null;
    else if(msg.set_purchases_paused){assert.equal(request.owner,MAINNET_REGISTRY_ADMIN);assert.equal(request.contract,manifest.registry);config.purchases_paused=msg.set_purchases_paused.paused;}
    else throw Error('Unexpected write '+JSON.stringify(msg));
    if(lost)throw Error('OUTCOME UNKNOWN: fixture response lost');
    return {chainId,transactionHash:String(writes.length).padStart(64,'A'),height:100+writes.length,code:0};
  });
  await page.exposeFunction('simulateNamesRecovery',request=>{assert.deepEqual(request,writes.at(-1));return {intentMatched:true,chainId,transactionHash:String(writes.length).padStart(64,'A'),height:100+writes.length,code:0};});
  await page.addInitScript(({owner})=>{
    window.testWallet=owner;window.testDisconnects=0;window.enabledNamesChains=[];
    window.keplr={experimentalSuggestChain:async()=>{},enable:async chain=>{window.enabledNamesChains.push(chain);},getOfflineSigner:()=>({getAccounts:async()=>[{address:window.testWallet}],signDirect(){throw Error('No real wallet signing in fixture');}})};
    window.NetaNamesSigning={validAddress:()=>true,connect:async()=>{if(window.holdConnection)await new Promise(resolve=>window.releaseConnection=resolve);return {disconnect(){window.testDisconnects++;}};},createBridge:()=>({adminReviewGuard:true,execute:async(request,{beforeSign}={})=>{await beforeSign?.();await beforeSign?.();return window.simulateNamesWrite(request);},recover:request=>window.simulateNamesRecovery(request)})};
  },{owner});
  const settle=()=>page.waitForFunction(()=>!document.querySelector('#nns-refresh').disabled);
  const click=async id=>{await page.locator('#'+id).click();await settle();};
  await page.goto(origin+'/index.html#relay/register');
  await page.locator('#nns-network').selectOption(chainId);
  if(!mainnet)manifest.quote_public_key=config.quote_public_key=await page.evaluate(async()=>{const {getTestAuthority}=await import('/names-v2-test-authority.mjs');return (await getTestAuthority({create:true})).publicKey;});
  assert.equal(await page.locator('#nns-prepare').isDisabled(),true);
  assert.equal(await page.locator('#nns-workspace-session').isVisible(),true);
  await click('nns-refresh');assert.match(await page.locator('#nns-deployment-status').textContent(),mainnet?/Juno mainnet verified/:/UNI-7 verified/);
  assert.equal(await page.locator('#nns-admin').isVisible(),false);
  await page.locator('#gov-connect').click();await page.waitForFunction(()=>!document.querySelector('#gov-connect').disabled);
  assert.equal(await page.evaluate(()=>window.enabledNamesChains.at(-1)),chainId);
  if(adminMode){
    assert.equal(await page.locator('#nns-admin').isVisible(),true);
    await page.locator('#nns-admin summary').click();
    priceUnavailable=true;await click('nns-admin-review');assert.match(await page.locator('#nns-status').textContent(),/price unavailable/);assert.equal(writes.length,0);
    priceUnavailable=false;await click('nns-admin-review');assert.equal(writes.length,0);assert.match(await page.locator('#nns-review-text').textContent(),/NETA debit: 0/);
    await click('nns-discard');assert.equal(writes.length,0);assert.equal(await page.locator('#nns-review').isVisible(),false);
    await click('nns-admin-review');config.tariff_version++;await click('nns-confirm');assert.match(await page.locator('#nns-status').textContent(),/configuration changed/);assert.equal(writes.length,0);
    await click('nns-admin-review');
    if(process.env.NNS_SCREENSHOT_DIR)await mkdir(process.env.NNS_SCREENSHOT_DIR,{recursive:true});
    for(const width of [1440,768,390,320]){
      await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`admin overflow ${width}`);
      if(process.env.NNS_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NNS_SCREENSHOT_DIR}/workspace-mainnet-admin-${width}.png`,fullPage:true});
    }
    await click('nns-confirm');assert.equal(writes.length,1);assert.equal(config.purchases_paused,false);assert.match(await page.locator('#nns-status').textContent(),/Purchases enabled/);assert.equal(await page.locator('#nns-prepare').isDisabled(),false);
    priceUnavailable=true;await click('nns-admin-review');assert.match(await page.locator('#nns-review-text').textContent(),/Pause NNS purchases/);
    lost=true;await click('nns-confirm');assert.match(await page.locator('#nns-status').textContent(),/OUTCOME UNKNOWN/);assert.equal(writes.length,2);
    await page.reload();await click('nns-refresh');await page.locator('#gov-connect').click();await page.waitForFunction(()=>!document.querySelector('#gov-connect').disabled);await click('nns-my-name');
    assert.equal(await page.locator('#nns-admin-review').isDisabled(),true);assert.equal(await page.locator('#nns-recover').isDisabled(),false);
    await page.locator('#nns-recovery summary').click();await click('nns-recover');assert.equal(writes.length,2);assert.match(await page.locator('#nns-status').textContent(),/Current purchases: paused/);assert.equal(await page.locator('#nns-admin-review').isDisabled(),false);
    const other='juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt';
    await page.evaluate(address=>{window.testWallet=address;window.dispatchEvent(new Event('keplr_keystorechange'));},other);
    await page.locator('#gov-connect').click();await page.waitForFunction(()=>!document.querySelector('#gov-connect').disabled);assert.equal(await page.locator('#nns-admin').isVisible(),false);assert.equal(writes.length,2);
    assert.deepEqual(errors,[]);console.log('Mainnet admin UI: gated access, signed price, review/discard, stale configuration, activation, pause without price, exact recovery and responsive layout passed.');
  }else{
  await page.locator('#names-fee-label').fill('abcd');
  assert.equal(await page.locator('#names-fee-total').textContent(),'$19 USD');
  await click('nns-check-name');assert.match(await page.locator('#nns-name-result').textContent(),mainnet?/available on Juno mainnet/:/available on UNI-7/);assert.equal(writes.length,0);
  config.tariff.four_cents=16000;await click('nns-refresh');await click('nns-prepare');if(mainnet){assert.match(await page.locator('#nns-status').textContent(),/prepared locally/);assert.equal(await page.locator('#names-fee-total').textContent(),'$160 USD');}else assert.match(await page.locator('#nns-status').textContent(),/approved USD 99/);assert.equal(writes.length,0);
  config.tariff.four_cents=1900;await click('nns-refresh');
  if(!mainnet)await click('nns-prepare');assert.equal(writes.length,0);
  await click('nns-reserve');assert.match(await page.locator('#nns-review-text').textContent(),/Reserve abcd.neta/);assert.equal(writes.length,0);
  await click('nns-confirm');assert.equal(writes.length,1);
  await click('nns-payment');assert.match(await page.locator('#nns-review-text').textContent(),mainnet?/9.500000 NETA/:/9.500000 mock NETA/);assert.equal(writes.length,1);
  await click('nns-confirm');assert.equal(writes.length,2);assert.equal(record.name,'abcd.neta');
  await click('nns-my-name');assert.match(await page.locator('#nns-owned').textContent(),/abcd.neta/);assert.equal(await page.locator('#nns-operation').inputValue(),'renew');
  if(mainnet){config.tariff.four_cents=2400;config.tariff_version++;await click('nns-refresh');}
  await click('nns-payment');if(mainnet)assert.match(await page.locator('#nns-review-text').textContent(),/12.000000 NETA/);const expiry=record.expires_at;await click('nns-confirm');assert.equal(record.expires_at,expiry+31536000);
  // Profile editing reuses the main form and snapshots FormData before disabling it.
  await page.locator('[data-relay-panel="profile"]').click();
  await page.locator('#names-profile-bio').fill('Public biography');
  await page.locator('#names-profile-telegram').fill('@example');
  await click('nns-publish-profile');assert.equal(writes.length,3);assert.match(await page.locator('#nns-review-text').textContent(),/Public biography/);
  await page.locator('#names-profile-bio').fill('Edited biography');assert.equal(await page.locator('#nns-review').isVisible(),false);
  await click('nns-publish-profile');await click('nns-confirm');assert.equal(contacts.description,'Edited biography');assert.equal(contacts.telegram,'example');
  await page.locator('#names-profile-bio').fill('Unsaved');await click('nns-load-profile');assert.equal(await page.locator('#names-profile-bio').inputValue(),'Edited biography');
  // Route changes during an asynchronous review must not revive stale confirmation.
  holdProfile=true;await page.locator('#nns-publish-profile').click();
  await page.waitForTimeout(100);await page.locator('[data-relay-panel="register"]').click();
  holdProfile=false;delayedProfile?.();await settle();assert.equal(await page.locator('#nns-review').isVisible(),false);
  // Recipient acceptance across explicit shared-wallet disconnect/reconnect.
  await page.locator('#nns-recipient').fill(recipient);
  await click('nns-transfer');assert.match(await page.locator('#nns-review-text').textContent(),new RegExp(recipient));await click('nns-confirm');assert.equal(record.owner,owner);
  await page.evaluate(address=>{window.testWallet=address;window.dispatchEvent(new Event('keplr_keystorechange'));},recipient);
  assert.equal(await page.locator('#gov-disconnect').isVisible(),false);
  await page.locator('#gov-connect').click();await page.waitForFunction(()=>!document.querySelector('#gov-connect').disabled);
  await page.locator('#nns-transfer-action').selectOption('accept');await click('nns-transfer');await click('nns-confirm');assert.equal(record.owner,recipient);assert.equal(contacts.description,'');
  await click('nns-my-name');await page.locator('[data-relay-panel="profile"]').click();await click('nns-load-profile');assert.equal(await page.locator('#names-profile-bio').inputValue(),'');
  // Lost outcomes stay journaled after reload. Never silently sign or retry.
  lost=true;await page.locator('#names-profile-bio').fill('Receipt recovery fixture');await click('nns-publish-profile');await click('nns-confirm');assert.match(await page.locator('#nns-status').textContent(),/OUTCOME UNKNOWN/);
  const count=writes.length;assert.equal(await page.locator('#nns-publish-profile').isDisabled(),true);
  await page.reload();await click('nns-refresh');
  await page.evaluate(address=>window.testWallet=address,recipient);await page.locator('#gov-connect').click();await page.waitForFunction(()=>!document.querySelector('#gov-connect').disabled);await click('nns-my-name');
  assert.equal(writes.length,count);assert.equal(await page.locator('#nns-publish-profile').isDisabled(),true);assert.equal(await page.locator('#nns-recover').isDisabled(),false);
  const saved=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('neta-nns-v2-intent:'))));
  await page.locator('#gov-disconnect').click();
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('neta-nns-v2-intent:')))),saved);
  // Late NNS connection cannot survive disconnect from the shared header.
  await page.locator('#gov-connect').click();await page.waitForFunction(()=>!document.querySelector('#gov-connect').disabled);
  await page.evaluate(()=>window.holdConnection=true);await page.locator('#nns-my-name').click();await page.waitForFunction(()=>!!window.releaseConnection);
  await page.locator('#gov-disconnect').click();await page.evaluate(()=>{window.holdConnection=false;window.releaseConnection();});await settle();assert.equal(await page.locator('#nns-publish-profile').isDisabled(),true);
  if(process.env.NNS_SCREENSHOT_DIR)await mkdir(process.env.NNS_SCREENSHOT_DIR,{recursive:true});
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});
    for(const panel of ['register','profile']){
      await page.locator(`[data-relay-panel="${panel}"]`).click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${panel} overflow ${width}`);
      if(process.env.NNS_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NNS_SCREENSHOT_DIR}/workspace-${mainnet?"mainnet":"uni7"}-${panel}-${width}.png`,fullPage:true});
    }
  }
  await page.setViewportSize({width:720,height:500});await page.locator('[data-relay-panel="register"]').click();
  await page.locator('#nns-refresh').focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'nns-refresh');assert.notEqual(await page.locator('#nns-refresh').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
  assert.deepEqual(errors,[]);
  console.log(chainId+' integrated NNS: register, quote, renew, contacts, transfer, stale review, shared wallet, pending journal reload and responsive UI passed.');
  }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
