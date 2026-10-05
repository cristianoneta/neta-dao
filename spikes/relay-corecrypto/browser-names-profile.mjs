import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(path.includes('..')) {res.writeHead(400).end();return;}
    const body=await readFile(new URL('.'+path,root));
    const mime=/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.webp')?'image/webp':'text/html';
    res.writeHead(200,{'content-type':mime}).end(body);
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}: {})});
  const context=await browser.newContext();
  await context.route('https://**/*',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/index.html#relay/profile');
  await page.locator('#names-profile-name').fill('Operator.NETA');
  await page.locator('#names-profile-bio').fill('<img src=x onerror=alert(1)> Test validator profile');
  await page.locator('#names-profile-discord').fill('operator.1');
  await page.locator('#names-profile-telegram').fill('@operator');
  await page.locator('#names-profile-twitter').fill('@operator');
  await page.locator('#names-profile-email').fill('hello@example.org');
  await page.locator('#names-profile-web').fill('https://example.org');
  await page.locator('#names-profile-form summary').click();
  const network = page.getByRole('combobox', {name: 'Network', exact: true});
  assert.equal(await network.inputValue(), 'juno');
  assert.deepEqual(await network.locator('option').allTextContents(), ['Juno']);
  assert.match(await page.locator('label[for="names-profile-mainnet"]').textContent(), /Juno mainnet operator · juno-1/);
  assert.match(await page.locator('label[for="names-profile-testnet"]').textContent(), /Juno testnet operator · uni-7/);
  await network.focus();
  assert.notEqual(await network.evaluate(el=>getComputedStyle(el).outlineStyle), 'none');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#names-profile-mainnet').evaluate(el=>el===document.activeElement), true);
  await page.locator('#names-profile-mainnet').fill('junovaloper1my0kxfxzxvmgg0tj0gx63lzp6zrj5vjwcsutpe');
  await page.locator('#names-profile-testnet').fill('junovaloper1a2m9f5u4qrnr45euqqwwuv8kvadv7twptqm02y');
  await page.locator('#names-profile-form [type=submit]').click();
  const preview=page.locator('#names-profile-preview');
  assert.equal(await preview.isVisible(),true);
  assert.match(await preview.textContent(),/operator.neta/);
  assert.match(await preview.textContent(),/Preview · not published/);
  assert.match(await preview.textContent(),/Validator addresses · unverified/);
  assert.match(await preview.textContent(),/Network: Juno/);
  assert.match(await preview.textContent(),/juno-1 · junovaloper/);
  assert.match(await preview.textContent(),/uni-7 · junovaloper/);
  assert.equal(await preview.locator('img,script').count(),0);
  assert.equal(await preview.locator('a[href="https://t.me/operator"]').count(),1);
  assert.equal(await preview.locator('a[href="https://example.org"]').getAttribute('rel'),'noopener noreferrer');
  assert.equal(await page.getByRole('button',{name:'Publish profile',exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/names-profile/.test(k))),false);
  if(process.env.NNS_SCREENSHOT_DIR) await mkdir(process.env.NNS_SCREENSHOT_DIR,{recursive:true});
  for (const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:1000});
    await page.evaluate(()=>window.scrollTo(0,0));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
    if(process.env.NNS_SCREENSHOT_DIR) {
      await page.screenshot({path:`${process.env.NNS_SCREENSHOT_DIR}/profile-${width}.png`,fullPage:true});
      await page.locator('#names-profile-form details').screenshot({path:`${process.env.NNS_SCREENSHOT_DIR}/profile-network-${width}.png`});
    }
  }
  // A network change invalidates the preview; unsupported IDs cannot fall back to Juno.
  await network.selectOption('juno');
  assert.equal(await preview.isVisible(), false);
  assert.match(await page.locator('#names-profile-mainnet').inputValue(), /^junovaloper/);
  await network.evaluate(el=>{el.add(new Option('Unsupported fixture', 'unknown'));el.value='unknown';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#names-profile-form [type=submit]').click();
  assert.equal(await preview.isVisible(), false);
  assert.match(await page.locator('#names-profile-result').textContent(), /not supported/);
  await network.selectOption('juno');
  await network.locator('option[value="unknown"]').evaluate(el=>el.remove());
  await page.locator('#names-profile-form [type=submit]').click();
  assert.equal(await preview.isVisible(), true);
  await page.setViewportSize({width:1440,height:1000});
  // 200% equivalent reflow and keyboard focus through actual editable fields.
  await page.setViewportSize({width:720,height:500});
  await page.locator('#names-profile-email').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#names-profile-web').evaluate(el=>el===document.activeElement),true);
  assert.notEqual(await page.locator('#names-profile-web').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
  await page.locator('#names-profile-web').fill('https://user:password@example.org');
  assert.equal(await preview.isVisible(),false,'editing must invalidate old preview');
  await page.locator('#names-profile-form [type=submit]').click();
  assert.match(await page.locator('#names-profile-result').textContent(),/without embedded credentials/);
  assert.equal(await preview.isVisible(),false);
  await page.locator('#names-profile-form [type=reset]').click();
  assert.equal(await page.locator('#names-profile-email').inputValue(),'');
  assert.equal(await network.inputValue(), 'juno');
  assert.equal(await preview.isVisible(), false);
  // Real Chromium WebCrypto verification, shared with Rust and Node fixtures.
  const quoteProtocol=await page.evaluate(async()=>{
    const {validateQuote,commitmentHash}=await import('/names-v2-core.mjs');
    const f=await (await fetch('/tests/fixtures/nns-v2-quote.json')).json();
    const args={deployment:f.deployment,config:f.config,offer:f.offer,expected:f.offer.quote,now:f.now};
    const verified=await validateQuote(args);
    let tamperRejected=false;
    const tampered=structuredClone(f.offer);tampered.quote.nonce='02'.repeat(32);
    try {await validateQuote({...args,offer:tampered});} catch {tamperRejected=true;}
    return {amount:verified.amount,tamperRejected,commitmentMatches:await commitmentHash(f.deployment,'alice','alice.neta',f.salt)===f.commitment};
  });
  assert.deepEqual(quoteProtocol,{amount:'2500000',tamperRejected:true,commitmentMatches:true});
  assert.deepEqual(errors,[]);
  console.log('Names profile: optional contacts, escaped preview, validator address checks, disabled publication, keyboard, 320–1440 px and NNS v2 WebCrypto quote protocol passed.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
