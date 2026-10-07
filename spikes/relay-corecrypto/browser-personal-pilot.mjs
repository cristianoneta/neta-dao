import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {PERSONAL_PILOT} from '../../relay-personal-pilot.mjs';
const root=new URL('../../',import.meta.url),screens=process.env.NNS_SCREENSHOT_DIR||'/tmp/personal-pilot-screenshots';
await mkdir(screens,{recursive:true});
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;
  const data=await readFile(new URL('.'+path,root));res.writeHead(200,{'content-type':/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.wasm')?'application/wasm':'text/html'}).end(data);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.RELAY_CHROMIUM_PATH?{executablePath:process.env.RELAY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Real compiled page: no wallet/provider/backup request on page load.
  const external=[];await context.route('https://**/*',r=>{external.push(r.request().url());return r.abort();});
  await page.goto(origin+'/relay-personal-pilot.html');await page.locator('#pilot-connect').click();
  await page.waitForFunction(()=>document.getElementById('pilot-status').textContent.includes('Keplr installed'));
  assert.deepEqual(external,[]);
  await context.addInitScript(wallets=>{
    window.pilotFixture={wallets,address:'juno1'+'q'.repeat(38),connections:0,signatures:0,disconnections:0,invalidations:0,hold:false};
    window.keplr={enable:async chain=>{if(chain!=='juno-1')throw Error('Wrong chain');},getOfflineSigner:()=>({getAccounts:async()=>[{address:window.pilotFixture.address}]})};
  },PERSONAL_PILOT.wallets);
  await context.route('**/relay-personal-pilot.js*',r=>r.fulfill({contentType:'text/javascript',body:`
    import {mountPersonalPilot} from './relay-personal-pilot.mjs';
    const f=window.pilotFixture;
    mountPersonalPilot({connect:async options=>{
      f.connections++;f.options=options;
      if(f.hold)await new Promise(resolve=>f.release=resolve);
      return {controller:{busy:false,onState:()=>{},status:()=>({open:false,closed:false,busy:false}),
        entryMode:async({remote=false}={})=>remote?'create':'check_backup',invalidate(){f.invalidations++;},close:async()=>{}},
        authorizeBackup:async()=>{options.assertCurrent();f.signatures++;},disconnect:async()=>{f.disconnections++;}};
    }});
  `}));
  await page.reload();await page.locator('#pilot-connect').click();
  await page.waitForFunction(()=>document.getElementById('pilot-status').textContent.includes('two participating wallets'));
  assert.equal(await page.evaluate(()=>pilotFixture.connections),0);
  for(const [index,wallet] of PERSONAL_PILOT.wallets.entries()){
    await page.evaluate(wallet=>{pilotFixture.address=wallet;localStorage.setItem('pilot-preserve-journal','keep');},wallet);
    await page.locator('#pilot-connect').click();await page.getByRole('button',{name:'Continue with wallet',exact:true}).waitFor();
    assert.equal(await page.locator('#pilot-wallet').textContent(),wallet);
    assert.equal(await page.evaluate(()=>pilotFixture.signatures),index);
    await page.getByRole('button',{name:'Continue with wallet',exact:true}).click();
    await page.getByRole('heading',{name:'Save your recovery code',exact:true}).waitFor();
    assert.match(await page.getByLabel('Recovery code',{exact:true}).inputValue(),/^[a-f0-9]{64}$/);
    if(index===0){
      for(const width of [1440,768,390,320]){
        await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        // Never put even fixture recovery codes in screenshots.
        await page.getByLabel('Recovery code',{exact:true}).fill('Screenshot fixture — no real recovery code');
        await page.screenshot({path:join(screens,'personal-pilot-'+width+'.png'),fullPage:true});
      }
      await page.locator('#pilot-disconnect').focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'pilot-disconnect');assert.notEqual(await page.locator('#pilot-disconnect').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
      await page.locator('#pilot-disconnect').click();
    }else await page.evaluate(()=>dispatchEvent(new Event('keplr_keystorechange')));
    assert.equal(await page.locator('#pilot-inbox').isHidden(),true);assert.equal(await page.locator('#pilot-inbox').textContent(),'');
    assert.equal(await page.evaluate(()=>localStorage.getItem('pilot-preserve-journal')),'keep');
  }
  // A disconnected pending connection cannot reopen the Inbox or authorize backup.
  await page.evaluate(()=>{pilotFixture.hold=true;});await page.locator('#pilot-connect').click();
  await page.waitForFunction(()=>!!pilotFixture.release);await page.locator('#pilot-disconnect').click();
  await page.evaluate(()=>pilotFixture.release());await page.waitForFunction(()=>pilotFixture.disconnections===3);
  assert.equal(await page.locator('#pilot-inbox').isHidden(),true);
  assert.equal(await page.evaluate(()=>{try{pilotFixture.options.assertCurrent();return false;}catch{return true;}}),true);
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('Private pilot: real bundle loads; two-wallet admission, no signing on connect, explicit backup signature, wallet/disconnect invalidation, late connection cleanup, journal preservation and 1440/768/390/320px passed. Wallet and chain are simulated.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
