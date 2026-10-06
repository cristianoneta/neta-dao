import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;try{if(path==='/crypto.html'){res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>DAO crypto test</title>');return;}const body=await readFile(new URL('.'+path,root));res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':'text/html'}).end(body);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const participants=[];
 for(const [label,letter] of [['alice','a'],['bob','b'],['carol','c'],['dave','d']]){
  const ctx=await browser.newContext(),page=await ctx.newPage();await page.goto(origin+'/crypto.html');
  const device=await page.evaluate(async({label,letter})=>{
   const wire=await import('/assets/relay-crypto/corecrypto.js');await wire.initWasmModule('/assets/relay-crypto/index_bg.wasm');
   const key=new wire.DatabaseKey(crypto.getRandomValues(new Uint8Array(32))),db=await wire.Database.open(label+'.db',key),cc=wire.CoreCrypto.new(db);await cc.transaction(c=>c.proteusInit());
   window.cc=cc;window.db=db;window.dbKey=key;window.owner='juno1'+letter.repeat(38);
   const fingerprint=await cc.transaction(c=>c.proteusFingerprint()),bundle=await cc.transaction(c=>c.proteusNewPrekey(1));
   const second=await cc.transaction(c=>c.proteusNewPrekey(2));
   return {address:window.owner,device:{active:true,generation:1,fingerprint,prekeys:[{id:1,bundle:btoa(String.fromCharCode(...bundle))},{id:2,bundle:btoa(String.fromCharCode(...second))}]}};
  },{label,letter});participants.push({page,device});
 }
 const [alice,bob,carol,dave]=participants,contract='juno1'+'e'.repeat(38),name='operations.dao.neta';
 const base={chain:'uni-7',contract,name,revision:2,correspondent:alice.device.address,reply:false,sender:alice.device.address,senderGeneration:1,senderFingerprint:alice.device.device.fingerprint,messageId:'11'.repeat(32)};
 const encrypted=await alice.page.evaluate(async({base,recipients})=>{const {encryptDaoBatch}=await import('/relay-dao-protocol.mjs');return cc.transaction(ctx=>encryptDaoBatch(ctx,base,'Milestone evidence',[...recipients]));},{base,recipients:[bob.device,carol.device]});
 assert.equal(encrypted.length,2);assert.notEqual(encrypted[0].ciphertext,encrypted[1].ciphertext);
 const read=async(person,base,delivery)=>person.page.evaluate(async({base,device,delivery})=>{const {decryptDaoDelivery}=await import('/relay-dao-protocol.mjs');return cc.transaction(ctx=>decryptDaoDelivery(ctx,{...base,recipient:device.address,recipientGeneration:device.device.generation,recipientFingerprint:device.device.fingerprint},delivery));},{base,device:person.device,delivery});
 assert.equal(await read(bob,base,encrypted[0]),'Milestone evidence');assert.equal(await read(carol,base,encrypted[1]),'Milestone evidence');
 await assert.rejects(read(dave,base,encrypted[0]),/Not this recipient/);
 const second={...base,messageId:'22'.repeat(32)};
 const next=await alice.page.evaluate(async({base,recipients})=>{const {encryptDaoBatch}=await import('/relay-dao-protocol.mjs');return cc.transaction(ctx=>encryptDaoBatch(ctx,base,'After Carol left',recipients));},{base:second,recipients:[bob.device,dave.device]});
 assert.equal(next[0].prekey_id,null);assert.equal(next[1].prekey_id,1);
 assert.equal(await read(bob,second,next[0]),'After Carol left');assert.equal(await read(dave,second,next[1]),'After Carol left');await assert.rejects(read(carol,second,next[0]),/Not this recipient/);
 const reply={...base,reply:true,sender:bob.device.address,senderFingerprint:bob.device.device.fingerprint,messageId:'33'.repeat(32)};
 const response=await bob.page.evaluate(async({base,recipient})=>{const {encryptDaoBatch}=await import('/relay-dao-protocol.mjs');return cc.transaction(ctx=>encryptDaoBatch(ctx,base,'Reviewed', [recipient]));},{base:reply,recipient:alice.device});
 assert.equal(response[0].prekey_id,null);assert.equal(await read(alice,reply,response[0]),'Reviewed');
 // Wrong DAO name must fail inside the crypto transaction, even with valid ciphertext.
 const third={...base,messageId:'44'.repeat(32)};
 const wrong=await alice.page.evaluate(async({base,recipient})=>{const {encryptDaoBatch}=await import('/relay-dao-protocol.mjs');return cc.transaction(ctx=>encryptDaoBatch(ctx,base,'Scope check',[recipient]));},{base:third,recipient:bob.device});
 await assert.rejects(read(bob,{...third,name:'other.dao.neta'},wrong[0]));

 const isolated={...base,name:'isolated.dao.neta',messageId:'55'.repeat(32)};
 const bobFresh={...bob.device,device:{...bob.device.device,prekeys:bob.device.device.prekeys.slice(1)}};
 const carolWrong={...carol.device,device:{...carol.device.device,fingerprint:'00'.repeat(32),prekeys:carol.device.device.prekeys.slice(1)}};
 await assert.rejects(alice.page.evaluate(async({base,recipients})=>{
  const {prepareDaoPacket}=await import('/relay-dao-protocol.mjs');const {BrowserOutbox}=await import('/spikes/relay-corecrypto/browser-outbox.mjs');window.failedBatch=await BrowserOutbox.open('dao-failed-batch');
  return prepareDaoPacket({outbox:failedBatch,cryptoClient:cc,base,text:'Must stay locked',recipients});
 },{base:isolated,recipients:[bobFresh,carolWrong]}),/device changed/);
 assert.equal(await alice.page.evaluate(async()=> (await failedBatch.entries())[0].state),'intent','partial crypto mutation keeps durable journal');
 await assert.rejects(alice.page.evaluate(async({base,recipients})=>{const {prepareDaoPacket}=await import('/relay-dao-protocol.mjs');return prepareDaoPacket({outbox:failedBatch,cryptoClient:cc,base,text:'Unsafe retry',recipients});},{base:{...isolated,messageId:'66'.repeat(32)},recipients:[bobFresh]}),/Unresolved send/);

 const context=await browser.newContext();await context.route('https://**/*',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));const page=await context.newPage();await page.goto(origin+'/index.html#relay/inbox');
 await page.evaluate(async({a,b,name})=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href='/relay-dao-inbox.css';document.head.append(link);
  window.testWallet=b;window.allowed=true;window.hold=null;window.fixtureThread={revision:1,status:'open',assignee:null,canBlock:true,blocked:false};window.submissions=0;
  const {mountDaoInboxes}=await import('/relay-dao-inbox.mjs');
  window.controller=mountDaoInboxes({document,window,account:()=>window.testWallet,client:{
   list:async()=>window.allowed?[{name,label:'NETA Operations',enabled:true}]:[],
   page:async()=>({items:Array.from({length:100},(_,i)=>({sequence:i+1,name,correspondent:a,author:a,reply:false})),next:null}),
   thread:async()=>window.fixtureThread,
   readable:async(record)=>{if(window.hold)await window.hold;return 'Evidence message '+record.sequence;},
   assignDraft:async()=>({message:{dao:{assign:{name}}}}),blockDraft:async()=>({message:{dao:{set_block:{name}}}}),submit:async()=>{window.submissions++;},
  }});
 },{a:alice.device.address,b:bob.device.address,name});
 await page.getByLabel('Select inbox').selectOption(name);await page.waitForFunction(()=>document.querySelectorAll('.dao-inbox-panel .relay-event').length===1);
 assert.equal(await page.locator('.dao-inbox-panel .relay-event').count(),1);
 await page.locator('.dao-inbox-panel .relay-event').click();await page.getByText('Evidence message 100',{exact:true}).waitFor();
 assert.equal(await page.locator('.dao-message').count(),100);
 await page.getByRole('button',{name:'Take conversation',exact:true}).click();assert.equal(await page.locator('.dao-action-review').count(),1);assert.equal(await page.evaluate(()=>window.submissions),0);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 if(process.env.NNS_SCREENSHOT_DIR){await mkdir(process.env.NNS_SCREENSHOT_DIR,{recursive:true});for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:process.env.NNS_SCREENSHOT_DIR+'/dao-inbox-'+width+'.png',fullPage:false});}}
 // Membership removal immediately hides the mailbox and all previously rendered text.
 await page.evaluate(async()=>{window.allowed=false;await controller.refresh();});assert.equal(await page.getByLabel('Select inbox').isVisible(),false);assert.equal(await page.locator('.dao-message').count(),0);
 // A wallet switch while decryption is pending cannot repaint the old plaintext.
 await page.evaluate(async()=>{window.allowed=true;await controller.refresh();});await page.getByLabel('Select inbox').selectOption(name);await page.waitForFunction(()=>document.querySelectorAll('.dao-inbox-panel .relay-event').length===1);
 await page.evaluate(()=>{window.hold=new Promise(resolve=>window.release=resolve);});await page.locator('.dao-inbox-panel .relay-event').click();await page.evaluate(()=>{window.testWallet=null;dispatchEvent(new CustomEvent('neta:wallet-change'));window.release();});assert.equal(await page.locator('.dao-message').count(),0);assert.equal(await page.getByLabel('Select inbox').isVisible(),false);
 console.log('DAO inbox: real four-device Proteus exchange/reply and membership changes; UI sender grouping, reviewed actions, removal, wallet-race and responsive layouts passed. No chain deployment or transaction.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
