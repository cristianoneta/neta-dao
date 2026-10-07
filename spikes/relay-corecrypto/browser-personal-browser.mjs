// Real CoreCrypto, IndexedDB, exact-byte bridge and cross-origin HTTPS/ADR-36/SQLite backup.
// Chain signing is simulated; disposable test wallets authenticate the real service.
import assert from 'node:assert/strict';
import https from 'node:https';
import {personalHttpFixture} from './personal-http-fixture.mjs';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {openPersonalBackup} from '../../relay-personal-backup.mjs';
const require=createRequire(new URL('../../faucet/package.json',import.meta.url));
const {TxRaw,TxBody,AuthInfo}=require('cosmjs-types/cosmos/tx/v1beta1/tx');
const {MsgExecuteContract}=require('cosmjs-types/cosmwasm/wasm/v1/tx');
const {toBech32}=require('@cosmjs/encoding');
const hash=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
const root=new URL('../../',import.meta.url),contract=toBech32('juno',new Uint8Array(32).fill(9));
const transport=await personalHttpFixture(),[alice,bob]=transport.wallets;
const devices=new Map(),identities=new Map(),consents=new Map(),blocked=new Map(),inboxes=new Map(),sent=new Map(),receipts=new Map(),backups=transport;
const codes=new Map();
let sequence=0,broadcasts=0,signs=0,hideReceipts=false;
function apply(owner,msg){
 if(msg.register){const r=msg.register,old=devices.get(owner),generation=(old?.generation||0)+1;assert.equal(r.expected_previous_generation,generation-1);
  const d={...r,generation,active:true,max_prekey_id:Math.max(...r.prekeys.map(p=>p.id))};devices.set(owner,d);identities.set(owner+':'+generation,structuredClone(d));
 }else if(msg.allow_sender){const r=msg.allow_sender;consents.set(owner+':'+r.address,r.allowed?[r.recipient_generation,r.sender_generation]:null);
 }else if(msg.set_block){blocked.set(owner+':'+msg.set_block.address,msg.set_block.blocked);
 }else if(msg.add_prekeys){const d=devices.get(owner),r=msg.add_prekeys;assert.equal(d.generation,r.generation);d.prekeys.push(...r.prekeys);d.max_prekey_id=Math.max(...d.prekeys.map(p=>p.id));
 }else{const r=msg.send_initial||msg.send,d=devices.get(owner),recipient=devices.get(r.recipient);assert.equal(r.sender_generation,d.generation);assert.equal(r.recipient_generation,recipient.generation);
  assert.deepEqual(consents.get(r.recipient+':'+owner),[recipient.generation,d.generation]);assert.notEqual(blocked.get(r.recipient+':'+owner),true);
  assert.equal(sent.has(owner+':'+r.message_id),false);
  if(msg.send_initial){assert.ok(recipient.prekeys.some(p=>p.id===r.prekey_id));recipient.prekeys=recipient.prekeys.filter(p=>p.id!==r.prekey_id);}
  const row={...r,sender:owner,sender_generation:d.generation,sequence:++sequence,kind:msg.send_initial?{initial:{prekey_id:r.prekey_id}}:'followup'};
  inboxes.set(r.recipient,[...(inboxes.get(r.recipient)||[]),row]);sent.set(owner+':'+r.message_id,sequence);
 }
}
async function rpc({kind,wallet,data}){
 if(kind==='failBackup'){transport.faults.offline=true;return;}
 if(kind==='backupSign')return transport.sign(wallet,data);
 if(kind==='device')return structuredClone(devices.get(data||wallet)||null);
 if(kind==='historical')return structuredClone(identities.get(data.address+':'+data.generation)||null);
 if(kind==='inbox')return structuredClone((inboxes.get(wallet)||[]).filter(r=>r.sequence>(data||0)));
 if(kind==='smart'){if(data.sent)return hideReceipts?null:sent.get(data.sent.sender+':'+data.sent.message_id)??null;if(data.consent)return consents.get(data.consent.recipient+':'+data.consent.sender)??null;if(data.blocked)return blocked.get(data.blocked.recipient+':'+data.blocked.sender)??false;throw Error('Unknown query');}
 if(kind==='sign'){
  signs++;const {messages,fee,memo}=data,m=messages[0];m.value.msg=Uint8Array.from(m.value.msg);
  const body=TxBody.fromPartial({messages:[{typeUrl:m.typeUrl,value:MsgExecuteContract.encode(m.value).finish()}],memo});
  const auth=AuthInfo.fromPartial({signerInfos:[{sequence:BigInt(signs)}],fee:{amount:fee.amount,gasLimit:BigInt(fee.gas)}});
  return {bodyBytes:Array.from(TxBody.encode(body).finish()),authInfoBytes:Array.from(AuthInfo.encode(auth).finish()),signatures:[[1]]};
 }
 if(kind==='broadcast'){
  broadcasts++;const bytes=Uint8Array.from(data),id=hash(bytes),raw=TxRaw.decode(bytes),body=TxBody.decode(raw.bodyBytes),m=MsgExecuteContract.decode(body.messages[0].value);
  const opened=await openPersonalBackup({chain:'juno-1',contract,wallet:m.sender},backups.get(m.sender).envelope,codes.get(m.sender));
  const backed=opened.snapshot.transactionIntents.map(r=>JSON.parse(r.value)).find(r=>r.hash===id);assert.equal(backed?.status,'signed');assert.equal(backed.bytes,Buffer.from(bytes).toString('base64'));
  apply(m.sender,JSON.parse(new TextDecoder().decode(m.msg)));receipts.set(id,{hash:id,tx:Array.from(bytes),height:100+broadcasts,code:0});return id;
 }
 if(kind==='lookup')return hideReceipts?null:receipts.get(data)||null;
 throw Error('Unknown fixture operation '+kind);
}
const server=https.createServer(transport.tls,async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/fixture'){res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Personal recovery fixture</title><link rel="stylesheet" href="/neta-ui.css"><link rel="stylesheet" href="/relay-personal-inbox.css"><script src="/assets/names-signing.js"></script>');return;}
 try{let data=await readFile(new URL('.'+path,root));
 // Mirror the release's exact-origin CSP pin using only this disposable server.
 if(path==='/index.html')data=Buffer.from(data.toString().replace("connect-src 'self'","connect-src 'self' "+transport.url));
 res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript'}).end(data);}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='https://127.0.0.1:'+server.address().port;
await transport.start(origin,contract);
let browser;
async function profile(wallet,context,workspace=false){
 context||=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage();await page.exposeFunction('fixtureRPC',rpc);
 if(workspace){
  await page.route('https://**/*',route=>route.request().url().startsWith(origin+'/')||route.request().url().startsWith(transport.url+'/')?route.continue():route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[],proposals:[],pagination:{total:'0'}})}));
  await page.goto(origin+'/index.html#relay');await page.waitForFunction(()=>!!window.NetaWorkspaceWallet?.getSession);
  assert.equal(await page.locator('#relay-personal-inbox').isHidden(),true,'null release must not activate the Inbox');
  assert.equal(await page.locator('iframe[title="Personal encryption runtime"]').count(),0);
  await page.addScriptTag({url:origin+'/assets/names-signing.js'});
 }else await page.goto(origin+'/fixture');
 await page.evaluate(async({wallet,contract,backupUrl})=>{
  const {PersonalBackupClient}=await import('/relay-personal-backup.mjs');
  const {PersonalCryptoRuntime}=await import('/relay-personal-runtime.mjs');
  const {PersonalBrowserController}=await import('/relay-personal-browser.mjs');
  const call=(kind,data)=>fixtureRPC({kind,wallet,data});window.failAt=null;window.rejectSign=false;
  const adapter={profile:{chain:'juno-1',contract},address:wallet,assertWallet:async()=>{},verify:async()=>{},device:address=>call('device',address),historicalDevice:(address,generation)=>call('historical',{address,generation}),smart:data=>call('smart',data),inbox:after=>call('inbox',after)};
  const backup=new PersonalBackupClient({url:backupUrl,webOrigin:location.origin,scope:{chain:'juno-1',contract,wallet},keplr:{getOfflineSigner:()=>({getAccounts:async()=>[{address:wallet}]}),signArbitrary:(chain,address,message)=>{if(chain!=='juno-1'||address!==wallet)throw Error('Wrong backup identity');return call('backupSign',message);}}});
  await backup.connect();window.backup=backup;
  const makeBridge=storage=>NetaNamesSigning.createBridge({chainId:'juno-1',storage,locks:navigator.locks,assertWallet:adapter.assertWallet,verifyDeployment:adapter.verify,wait:async()=>{},
   lookup:async id=>{const r=await call('lookup',id);return r&&{...r,tx:Uint8Array.from(r.tx)};},
   client:{getChainId:async()=>'juno-1',simulate:async()=>100000,sign:async(sender,messages,fee,memo)=>{
    if(window.rejectSign)throw Error('Wallet rejected');
    const r=await call('sign',{sender,messages:messages.map(m=>({...m,value:{...m.value,msg:Array.from(m.value.msg)}})),fee,memo});
    return {...r,bodyBytes:Uint8Array.from(r.bodyBytes),authInfoBytes:Uint8Array.from(r.authInfoBytes),signatures:r.signatures.map(s=>Uint8Array.from(s))};
   },broadcastTxSync:bytes=>call('broadcast',Array.from(bytes))}});
  window.makeController=()=>new PersonalBrowserController({runtime:new PersonalCryptoRuntime(),adapter,backup,makeBridge,fault:async point=>{if(window.failAt===point){window.failAt=null;throw Error('Crash at '+point);}}});window.c=makeController();
 },{wallet,contract,backupUrl:transport.url});
 if(workspace){
  await page.evaluate(async({wallet,contract})=>{
   window.keplr={enable:async chain=>{if(chain!=='juno-1')throw Error('Wrong shared wallet network');},getOfflineSigner:()=>({getAccounts:async()=>[{address:wallet}]})};
   const {mountPersonalWorkspace}=await import('/relay-personal-workspace.mjs');
   const {mountPersonalInbox}=await import('/relay-personal-inbox.mjs');
   const {PERSONAL_MAINNET_OWNER,PERSONAL_MAINNET_WASM}=await import('/relay-personal-network.mjs');
   const release={enabled:true,backupUrl:'https://fixture.invalid',deployment:{chainId:'juno-1',contract,creator:PERSONAL_MAINNET_OWNER,admin:PERSONAL_MAINNET_OWNER,codeId:123,codeHash:PERSONAL_MAINNET_WASM,label:'NETA RELAY personal v0.4 · Juno mainnet'}};
   window.workspaceOpens=0;window.holdConnect=false;window.finishConnect=null;window.disconnectedCandidates=0;
   window.ui=mountPersonalWorkspace({root:document.getElementById('relay-personal-inbox'),release,loadSigning:async()=>NetaNamesSigning,
    // This suite deliberately owns the ordering of receive/crash/recovery calls.
    // A wall-clock poll must not consume a packet or fault injection between them.
    // Automatic polling and its busy guard are exercised in browser-personal-ux.
    mountInbox:options=>mountPersonalInbox({...options,pollInterval:0}),
    connect:async({assertCurrent})=>{workspaceOpens++;if(holdConnect)await new Promise(resolve=>window.finishConnect=resolve);const controller=window.c;
     return {controller,authorizeBackup:async()=>{assertCurrent();if(!backup.token||backup.expires<=backup.now())await backup.connect();assertCurrent();},disconnect:async()=>{disconnectedCandidates++;await controller.close();}};}});
  },{wallet,contract});
  assert.equal(await page.getByRole('button',{name:'Open personal inbox',exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>workspaceOpens),0,'page must not open or authorize a personal session automatically');
  await page.locator('#gov-connect').click();
  await page.waitForFunction(()=>NetaWorkspaceWallet.getSession()?.chainId==='juno-1');
  await page.locator('#relay-new-message').click();
  await page.getByRole('button',{name:'Continue with wallet',exact:true}).waitFor();
  assert.equal(await page.locator('#relay-composer').isHidden(),true,'legacy composer must stay closed');
 }
 return {context,page,wallet};
}
const authorize=p=>p.page.evaluate(()=>backup.connect());
const invoke=(p,method,...args)=>p.page.evaluate(async({method,args})=>c[method](...args),{method,args});
const register=async p=>invoke(p,'submitRegistration',await invoke(p,'reviewRegistration'));
const consent=async(p,other)=>invoke(p,'submitLifecycle',await invoke(p,'reviewContact','consent',other.wallet,true));
const send=async(p,other,text)=>invoke(p,'submitMessage',await invoke(p,'prepareMessage',other.wallet,text));
try{
 browser=await chromium.launch({headless:true,...(process.env.RELAY_CHROMIUM_PATH?{executablePath:process.env.RELAY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
 const a=await profile(alice,undefined,true),b=await profile(bob);
 await a.page.getByRole('button',{name:'Continue with wallet',exact:true}).click();
 await a.page.getByLabel('Recovery code',{exact:true}).waitFor();
 const ac=await a.page.getByLabel('Recovery code',{exact:true}).inputValue();assert.match(ac,/^[a-f0-9]{64}$/);
 await a.page.getByRole('checkbox').check();await a.page.getByRole('button',{name:'Create inbox',exact:true}).click();
 await a.page.waitForFunction(()=>c.status().open&&!c.busy&&!document.querySelector('#relay-personal-inbox [role=alert]').textContent);
 const bc=(await invoke(b,'create')).recoveryCode;codes.set(alice,ac);codes.set(bob,bc);
 await a.page.getByRole('region',{name:'Review personal action'}).waitFor();await a.page.getByRole('button',{name:'Confirm in Keplr',exact:true}).click();await a.page.waitForFunction(()=>c.status().registered&&!c.busy);await register(b);await consent(b,a);await consent(a,b);
 const emptyPoll=transport.stats().requests;await invoke(a,'receive');assert.equal(transport.stats().requests,emptyPoll,'empty polls must not consume backup authorization');
 await send(a,b,'Already read and archived');await invoke(b,'receive');await send(b,a,'Reply before backup');await invoke(a,'receive');
 assert.equal((await invoke(a,'status')).history.length,2);assert.equal((await invoke(b,'status')).history.length,2);
 // The user's Lock action releases crypto handles without invalidating the wallet session.
 await a.page.getByRole('button',{name:'Lock inbox',exact:true}).click();await a.page.waitForFunction(()=>!c.status().open);
 await a.page.getByLabel('Recovery code',{exact:true}).fill(ac);await a.page.getByRole('button',{name:'Unlock inbox',exact:true}).click();await a.page.waitForFunction(()=>c.status().open&&!c.busy);
 assert.equal((await invoke(a,'status')).history.length,2);
 // A second tab shares the IDB but cannot acquire this mailbox's lifetime lock.
 const second=await profile(alice,a.context);await assert.rejects(invoke(second,'unlock',ac),/another|lock|open/i);await second.page.close();
 // Ready packet survives wallet rejection and is explicitly retried byte-for-byte.
 const reviewed=await invoke(a,'prepareMessage',bob,'Same ciphertext after rejection');const cipher=reviewed.request.msg.send.ciphertext;
 await a.page.evaluate(()=>{rejectSign=true;});await assert.rejects(invoke(a,'submitMessage',reviewed),/rejected/);await a.page.evaluate(()=>{rejectSign=false;});
 await invoke(a,'recover');const retry=await invoke(a,'reviewPending',reviewed.messageId);assert.equal(retry.request.msg.send.ciphertext,cipher);await invoke(a,'submitMessage',retry);
 // Crash after ratchet advance but before ready rolls back from canonical blocks.
 await a.page.evaluate(()=>{failAt='outbound-encrypted';});await assert.rejects(invoke(a,'prepareMessage',bob,'Interrupted encryption'),/Crash/);await invoke(a,'recover');assert.equal((await invoke(a,'status')).pending.length,0);
 await send(a,b,'Unread at restore');
 // Fresh browser: wrong code leaves no import; staged crash resumes from local IDB.
 const saved=backups.get(bob);transport.restartStorage();assert.deepEqual(backups.get(bob),saved);
 const restored=await profile(bob);await assert.rejects(invoke(restored,'restore','00'.repeat(32)),/authentication/);
 await restored.page.evaluate(()=>{c=makeController();failAt='restore-staged';});await assert.rejects(invoke(restored,'restore',bc),/Crash/);
 await invoke(restored,'close');await restored.page.evaluate(()=>{c=makeController();});await invoke(restored,'unlock',bc);
 assert.equal((await invoke(restored,'status')).history.length,2);assert.equal((await invoke(restored,'status')).readOnly,true);
 const before=broadcasts;await assert.rejects(invoke(restored,'prepareMessage',alice,'Must stay read only'),/read-only/);assert.equal(broadcasts,before);await invoke(restored,'recover');
 // Interrupted inbound decryption retries exactly once from its saved checkpoint.
 await restored.page.evaluate(()=>{failAt='inbound-decrypted';});await assert.rejects(invoke(restored,'receive'),/Crash/);await invoke(restored,'recover');await invoke(restored,'receive');
 assert.deepEqual((await invoke(restored,'status')).history.filter(r=>r.direction==='in').map(r=>r.text),['Already read and archived','Same ciphertext after rejection','Unread at restore']);
 await authorize(a);await authorize(restored);
 // New rotation is explicit. Retired keys remain readable and original sender is fenced.
 await send(a,b,'Delayed to retired generation');
 const rotate=await invoke(restored,'prepareRotation');await restored.page.evaluate(()=>{rejectSign=true;});
 await assert.rejects(invoke(restored,'submitLifecycle',rotate),/rejected/);await restored.page.evaluate(()=>{rejectSign=false;});await invoke(restored,'recover');
 assert.equal((await invoke(restored,'status')).readOnly,true);await assert.rejects(invoke(restored,'prepareMessage',alice,'Rejected rotation cannot resume old keys'),/read-only/);await invoke(restored,'recover');
 await invoke(restored,'submitLifecycle',await invoke(restored,'reviewPrepared'));assert.equal((await invoke(restored,'status')).generation,2);assert.equal((await invoke(restored,'status')).readOnly,false);
 await invoke(restored,'receive');assert.ok((await invoke(restored,'status')).history.some(r=>r.text==='Delayed to retired generation'));
 await assert.rejects(invoke(b,'prepareMessage',alice,'Old device must not send'),/changed/);
 await consent(restored,a);await consent(a,restored);await send(a,restored,'New generation conversation');await invoke(restored,'receive');await send(restored,a,'Reply after restored rotation');await invoke(a,'receive');
 assert.ok((await invoke(a,'status')).history.some(r=>r.text==='Reply after restored rotation'));
 await invoke(restored,'submitLifecycle',await invoke(restored,'prepareRefill'));assert.equal(devices.get(bob).max_prekey_id,16);
 // Responsive, keyboard and literal-text checks on the real controller UI.
 for(const width of [1440,768,390,320]){await a.page.setViewportSize({width,height:1000});await a.page.evaluate(()=>scrollTo(0,0));assert.equal(await a.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await a.page.screenshot({path:'/tmp/personal-workspace-'+width+'.png',fullPage:true});}
 await a.page.keyboard.press('Tab');assert.equal(await a.page.evaluate(()=>document.activeElement!==document.body),true);
 assert.ok(await a.page.getByRole('list',{name:'Encrypted message history'}).innerText());
 // Repeated generations must retain both delayed old reads and current replies.
 // Each cycle opens both retained and current SQLite paths in the same profile.
 for(let cycle=0;cycle<2;cycle++){
  await authorize(a);await authorize(restored);
  await send(a,restored,'Delayed across generation '+cycle);
  await invoke(restored,'submitLifecycle',await invoke(restored,'prepareRotation'));
  await invoke(restored,'receive');assert.ok((await invoke(restored,'status')).history.some(r=>r.text==='Delayed across generation '+cycle));
  await consent(restored,a);await consent(a,restored);
  await send(a,restored,'Current generation '+cycle);await invoke(restored,'receive');
  await send(restored,a,'Reply from generation '+cycle);await invoke(a,'receive');
  assert.ok((await invoke(a,'status')).history.some(r=>r.text==='Reply from generation '+cycle));
 }
 // The real shared header clears plaintext even if Keplr retains the account.
 await a.page.locator('#gov-disconnect').click();
 assert.equal(await a.page.getByRole('list',{name:'Encrypted message history'}).count(),0);
 assert.equal((await invoke(a,'status')).open,false);
 await a.page.evaluate(()=>{window.c=makeController();});
 await a.page.locator('#gov-connect').click();await a.page.getByRole('button',{name:'Open personal inbox',exact:true}).click();
 await a.page.getByLabel('Recovery code',{exact:true}).fill(ac);await a.page.getByRole('button',{name:'Unlock inbox',exact:true}).click();
 await a.page.waitForFunction(()=>c.status().open&&!c.busy);
 // Navigation also destroys the visible session, preserving the encrypted store.
 await a.page.locator('[data-relay-panel=directory]').click();assert.equal((await invoke(a,'status')).open,false);
 await a.page.locator('[data-relay-panel=inbox]').click();await a.page.evaluate(()=>{window.c=makeController();window.holdConnect=true;});
 await a.page.getByRole('button',{name:'Open personal inbox',exact:true}).click();await a.page.waitForFunction(()=>!!finishConnect);
 await a.page.locator('#gov-disconnect').click();const discarded=await a.page.evaluate(()=>disconnectedCandidates);
 await a.page.evaluate(()=>finishConnect());await a.page.waitForFunction(n=>disconnectedCandidates>n,discarded);
 assert.equal(await a.page.getByLabel('Recovery code',{exact:true}).count(),0,'late connection must not remount the old wallet');
 await a.page.evaluate(()=>{window.c=makeController();window.holdConnect=false;});await a.page.locator('#gov-connect').click();
 await a.page.getByRole('button',{name:'Open personal inbox',exact:true}).click();
 await a.page.getByLabel('Recovery code',{exact:true}).fill(ac);await a.page.getByRole('button',{name:'Unlock inbox',exact:true}).click();
 await a.page.waitForFunction(()=>c.status().open&&!c.busy);
 await authorize(restored);
 // Signed bytes are already backed up when chain accepts but receipt reads vanish.
 hideReceipts=true;const pending=await invoke(a,'prepareMessage',bob,'Accepted but response lost');await assert.rejects(invoke(a,'submitMessage',pending),/UNKNOWN/);const once=broadcasts;
 await invoke(a,'close');await a.context.close();hideReceipts=false;const anew=await profile(alice);await invoke(anew,'restore',ac);
 assert.equal(broadcasts,once);assert.equal((await invoke(anew,'status')).pending.length,0);assert.ok((await invoke(anew,'status')).history.some(r=>r.text==='Accepted but response lost'));
 // Backup failure during signed-byte checkpoint prevents broadcast, never resends.
 await invoke(restored,'receive');const p=await invoke(restored,'prepareMessage',alice,'Backup must finish first');
 // Fail the actual remote upload after exact bytes have been journaled.
 await restored.page.evaluate(()=>{c.fault=async point=>{if(point==='signed-before-backup')await fixtureRPC({kind:'failBackup'});};});
 const count=broadcasts;await assert.rejects(invoke(restored,'submitMessage',p),/Backup service rejected request \(503\)/);assert.equal(broadcasts,count);
 transport.faults.offline=false;await restored.page.evaluate(()=>{c.fault=async()=>{};});await invoke(restored,'recover');await invoke(restored,'submitMessage',await invoke(restored,'reviewPending',p.messageId));
 // Lost backup ack is reconciled by identical encrypted bytes, no replacement.
 transport.faults.lostAck=true;await invoke(restored,'prepareMessage',alice,'Lost backup ack');const ackRevision=backups.get(bob).revision;await invoke(restored,'recover');assert.ok(backups.get(bob).revision>=ackRevision);
 // Conflicting profile must not overwrite a remote revision it never observed.
 const oldRevision=backups.get(bob).revision;await assert.rejects(invoke(b,'recover'),/another profile/);assert.equal(backups.get(bob).revision,oldRevision);
 // Exhaust the real bounded session; renewal is a deliberate wallet action.
 const priorExpiry=backups.get(bob),beforeExpiry=broadcasts;
 const expired=await restored.page.evaluate(async()=>{for(let i=0;i<121;i++){try{await backup.latest();}catch(e){return e.message;}}throw Error('Session cap was not enforced');});
 assert.match(expired,/Authorize encrypted backup/);
 await assert.rejects(invoke(restored,'recover'),/Authorize encrypted backup/);
 assert.equal(broadcasts,beforeExpiry);assert.deepEqual(backups.get(bob),priorExpiry);
 await authorize(restored);await invoke(restored,'recover');
 // Wallet switch immediately removes exposed history and releases only after idle.
 await restored.page.evaluate(()=>dispatchEvent(new Event('keplr_keystorechange')));assert.equal((await invoke(restored,'status')).open,false);
 assert.ok(transport.stats().preflights>0,'real browser CORS preflight required');
 assert.ok(transport.stats().requests>20,'real HTTP traffic required');
 console.log('Personal browser integration passed: real encrypted create/register/send/read/reply, coherent backups, rejected retry, crashes, fresh-profile restore, rotation/retired keys, signed-attempt recovery, backup failures, origin lock and wallet switch. Real cross-origin HTTPS/ADR-36/SQLite backup including restart and lost acknowledgement; simulated chain and wallet UI only.');
}finally{await browser?.close();await new Promise(r=>server.close(r));await transport.close();}
