// UI state transitions with a fake controller; real crypto/backup lives in the
// separate browser-personal-browser regression. No real keys or wallet actions.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/fixture'){res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Personal UX fixture</title><link rel="stylesheet" href="/neta-ui.css"><link rel="stylesheet" href="/relay-personal-inbox.css"><main id="inbox"></main>');return;}
 try{const bytes=await readFile(new URL('.'+path,root));res.writeHead(200,{'content-type':path.endsWith('.css')?'text/css':'text/javascript'}).end(bytes);}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const wallet='juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
try{
 browser=await chromium.launch({headless:true,...(process.env.RELAY_CHROMIUM_PATH?{executablePath:process.env.RELAY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/fixture?relayContact='+wallet);
 await page.evaluate(async wallet=>{
  const {mountPersonalInbox}=await import('/relay-personal-inbox.mjs');window.calls={auth:0,sign:0,read:0,recover:0,consent:0};window.remoteMode='create';window.expire=false;window.local=false;
  window.state={open:false,busy:false,history:[],pending:[],readOnly:false,registered:false};
  const emit=()=>c.onState({...state});
  const request={owner:wallet,contract:'fixture',msg:{register:{}}};
  window.c={scopeObject:{wallet},onState:()=>{},get busy(){return state.busy;},status:()=>({...state}),
   entryMode:async({remote=false}={})=>local?'unlock':remote?remoteMode:'check_backup',
   create:async()=>{local=true;state.open=true;emit();},unlock:async()=>{state.open=true;emit();},restore:async()=>{local=true;state.open=true;state.readOnly=true;state.registered=true;emit();},
   reviewRegistration:async()=>request,submitRegistration:async()=>{calls.sign++;state.registered=true;emit();},
   recover:async()=>{calls.recover++;state.needsRecovery=false;emit();},
   receive:async()=>{calls.read++;if(expire){state.needsRecovery=true;emit();throw Error('Backup authentication expired. Authorize encrypted backup');}state.history=[{direction:'in',meta:{sender:wallet},text:'<img src=x onerror=alert(1)>'}];emit();},
   lockInbox:async()=>{state.open=false;emit();},close:async()=>{state.open=false;},reviewContact:async()=>{calls.consent++;return request;}};
  window.ui=mountPersonalInbox({root:document.getElementById('inbox'),controller:c,authorizeBackup:async()=>{calls.auth++;expire=false;},pollInterval:100});
 },wallet);
 await page.getByRole('button',{name:'Continue with wallet',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>calls.auth+calls.sign+calls.consent),0,'opening/invitation must not authorize anything');
 await page.getByRole('button',{name:'Continue with wallet',exact:true}).click();
 const create=page.getByRole('button',{name:'Create inbox',exact:true});await create.waitFor();assert.equal(await create.isDisabled(),true);
 assert.match(await page.getByLabel('Recovery code',{exact:true}).inputValue(),/^[a-f0-9]{64}$/);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/relay-entry-'+width+'.png',fullPage:true});}
 await page.getByRole('checkbox').check();await create.click();await page.getByRole('button',{name:'Confirm in Keplr',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>calls.sign),0,'setup must stop at explicit chain confirmation');
 await page.getByRole('button',{name:'Confirm in Keplr',exact:true}).click();
 await page.waitForFunction(()=>calls.read>0);assert.equal(await page.locator('#inbox img').count(),0);assert.match(await page.getByRole('list').innerText(),/<img/);
 assert.equal(await page.getByLabel('Contact .neta name or wallet').inputValue(),wallet);assert.equal(await page.evaluate(()=>calls.consent),0);
 await page.evaluate(()=>{expire=true;});await page.getByRole('button',{name:'Renew backup access',exact:true}).waitFor();const reads=await page.evaluate(()=>calls.read);
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>calls.read),reads,'expired auth pauses automatic reads');
 await page.getByRole('button',{name:'Renew backup access',exact:true}).click();await page.waitForFunction(()=>!state.needsRecovery);assert.equal(await page.evaluate(()=>calls.sign),1);
 await page.evaluate(()=>{state.pending=[{id:'fixture',state:'ready',outcome:'pending'}];c.onState({...state});});await page.waitForFunction(()=>calls.recover>=2);
 assert.equal(await page.getByRole('button',{name:'Review saved message',exact:true}).count(),0,'unknown transaction must never offer blind resend');assert.equal(await page.evaluate(()=>calls.sign),1);
 await page.evaluate(()=>{state.pending=[];state.needsRecovery=false;c.onState({...state});});
 await page.getByRole('button',{name:'Lock inbox',exact:true}).click();await page.getByRole('button',{name:'Unlock inbox',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Create inbox',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Restore inbox',exact:true}).count(),0);
 await page.getByLabel('Recovery code',{exact:true}).fill('a'.repeat(64));await page.getByRole('button',{name:'Unlock inbox',exact:true}).click();
 await page.waitForFunction(()=>state.open);await page.evaluate(()=>ui.dispose());assert.equal(await page.locator('#inbox').innerText(),'');
 const stopped=await page.evaluate(()=>calls.read);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>calls.read),stopped);
 // Fresh browser state selects restore, never overwrites it through create.
 await page.evaluate(async()=>{local=false;remoteMode='restore';state.open=false;const {mountPersonalInbox}=await import('/relay-personal-inbox.mjs');ui=mountPersonalInbox({root:document.getElementById('inbox'),controller:c,authorizeBackup:async()=>calls.auth++,pollInterval:0});});
 await page.getByRole('button',{name:'Continue with wallet',exact:true}).click();await page.getByRole('button',{name:'Restore inbox',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Create inbox',exact:true}).count(),0);
 console.log('Personal UX passed: state-selected entry, explicit signatures, invitation without consent, automatic reads, auth pause/renewal, unknown-transaction reconciliation, lock/dispose, restore selection and responsive setup.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
