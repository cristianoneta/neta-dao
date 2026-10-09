import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const pair='juno1h6x5jlvn6jhpnu63ufe4sgv4utyk8hsfl5rqnrpg2cvp6ccuq4lqwqnzra';
const neta='juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr';
const wallet='juno1d0g7f97v87xwe6r4vr4jj3jfhzcv4vvfhamy8w';
const server=http.createServer(async(req,res)=>{try{
  let path=new URL(req.url,'http://localhost').pathname;if(path.endsWith('/'))path+='index.html';
  res.writeHead(200,{'content-type':/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.png')?'image/png':path.endsWith('.webp')?'image/webp':'text/html'}).end(await readFile(new URL('.'+path,root)));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const page=await browser.newPage(),errors=[],origin=`http://127.0.0.1:${server.address().port}`;
  page.on('pageerror',e=>errors.push(e.message));
  let stale=false,badCode=false,returned='10094';
  await page.route('https://**/*',async route=>{
    const url=new URL(route.request().url());
    assert.equal(route.request().method(),'GET','Fixtures never submit a real transaction');
    if(!['juno.api.m.stavr.tech','juno-api.polkachu.com','juno-rest.publicnode.com'].includes(url.hostname))return route.abort();
    const headers={'access-control-allow-origin':'*','content-type':'application/json'};
    let response;
    if(url.pathname.includes('/balances/'))response={balance:{denom:'ujuno',amount:'100000000'}};
    else if(!url.pathname.includes('/smart/'))response={contract_info:{code_id:badCode?'999':'2289'}};
    else{
      const query=JSON.parse(Buffer.from(decodeURIComponent(url.pathname.split('/smart/')[1]),'base64').toString('utf8'));
      let data={};
      if(query.pair)data={contract_addr:pair,asset_infos:[{native:'ujuno'},{token:neta}],fee_config:{total_fee_bps:30}};
      if(query.pool)data={assets:[{info:{native:'ujuno'},amount:'100000000000'},{info:{token:neta},amount:'1000000000'}]};
      if(query.balance)data={balance:'1000000'};
      if(query.simulation)data={return_amount:query.simulation.offer_asset.info.token?'983732':returned,commission_amount:'30',spread_amount:'0'};
      response={data};
    }
    await route.fulfill({headers,body:JSON.stringify(response)});
  });
  await page.route('**/data/treasury/juno-delegation.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({chain_id:'juno-1',dao_id:'juno-delegation',status:'LIVE',generated_at:new Date(Date.now()-(stale?48*3600000:0)).toISOString(),assets:[{key:'juno:native:ujuno',source_chain:'juno',decimals:6,usd_price:.03}]})}));
  await page.route('**/assets/wynd-swap-signing.js*',r=>r.fulfill({contentType:'text/javascript',body:`window.NetaSwapSigning={fixedFee:()=>({gas:'210000',amount:[{denom:'ujuno',amount:'15750'}]}),connect:async()=>({client:{getChainId:async()=>'juno-1',disconnect(){}}}),simulate:async()=>150000,execute:async(...args)=>{await args[7].assertWallet();window.__executes=(window.__executes||0)+1;window.__executed=args.slice(1,7);if(window.__reject)throw Error('User rejected');return window.__result;}};` }));
  await page.addInitScript(address=>{window.keplr={enable:async()=>{},getKey:async()=>({bech32Address:address}),getOfflineSignerAuto:async()=>({getAccounts:async()=>[{address}]})};},wallet);
  const textIs=(selector,text)=>page.waitForFunction(([s,t])=>document.querySelector(s)?.textContent===t,[selector,text]);
  const ready=()=>page.waitForFunction(()=>!document.querySelector('#swap-action').disabled);
  const shots=process.env.NNS_SCREENSHOT_DIR;if(shots)await mkdir(shots,{recursive:true});
  const screenshot=async name=>{if(shots){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${shots}/${name}.png`,fullPage:!name.includes('review')});}};
  await page.goto(origin+'/community-tools/');
  assert.equal(await page.locator('.tool-card:visible').count(),4);
  await page.locator('[data-project-link="juno"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-project-link="juno"]').getAttribute('aria-current')==='true');
  assert.equal(await page.locator('.tool-card:visible').count(),3);
  assert.deepEqual(await page.locator('.tool-card:visible h3').allTextContents(),['Juno Faucet','Validator Upgrade Status','Delegation Programme']);
  await page.locator('[data-project-link="neta"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-project-link="neta"]').getAttribute('aria-current')==='true');
  assert.equal(await page.locator('.tool-card:visible').count(),1);
  await page.reload();assert.equal(await page.locator('[data-project-link="neta"]').getAttribute('aria-current'),'true');
  await page.locator('[data-project-link="all"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-project-link="all"]').getAttribute('aria-current')==='true');
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshot(`community-tools-${width}`);}
  await page.goto(origin+'/community-tools/neta/buy/');await textIs('#contract-state','Verified');
  await page.locator('#settings-toggle').click();await page.locator('#custom-slippage').fill('0.125');
  await textIs('#slippage-summary','0.13%');
  await page.locator('[data-slippage="5"]').click();await page.locator('#settings-toggle').click();
  await page.locator('#offer-amount').fill('1');await textIs('#receive-amount','0.010094');
  assert.equal(await page.locator('#swap-action').isDisabled(),true);
  await page.locator('#connect-wallet').click();await ready();
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Buy overflow ${width}`);await screenshot(`buy-neta-${width}`);}
  await page.locator('#swap-action').click();assert.equal(await page.locator('#swap-modal').isVisible(),true);
  assert.equal(await page.locator('#review-minimum').textContent(),'0.009589 NETA');
  const nativePreview=JSON.parse(await page.locator('#swap-preview').textContent());
  assert.equal(nativePreview.message.swap.belief_price,'98.775187672856578427','WYND spread uses the pre-commission return');
  // Contract spread is measured before its 30-bps commission. Every execution
  // below the displayed net minimum must fail that on-chain constraint.
  const scale=10n**18n,belief=BigInt(nativePreview.message.swap.belief_price.replace('.',''));
  const expected=1000000n*(scale*scale/belief)/scale;
  for(let gross=1n;gross<=10124n;gross++){
    const net=gross-gross*30n/10000n;
    if(net<9589n)assert.ok((expected-gross)*scale/expected>scale/20n,'under-minimum net return must exceed max_spread');
  }
  await screenshot('buy-neta-review-320');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#swap-modal').isVisible(),false);assert.equal(await page.locator('#swap-action').evaluate(e=>e===document.activeElement),true);
  await page.locator('#offer-amount').fill('1000');await page.waitForFunction(()=>document.querySelector('#quote-error').textContent.includes('$25 LIMIT'));assert.equal(await page.locator('#swap-action').isDisabled(),true);
  await page.locator('#offer-amount').fill('1');await ready();await page.locator('#swap-action').click();
  returned='9000';await page.locator('#confirm-swap').click();await page.waitForFunction(()=>document.querySelector('#swap-modal-message').textContent.includes('REVIEWED MINIMUM'));
  assert.equal(await page.evaluate(()=>window.__executes||0),0);returned='10094';await page.locator('#close-swap').click();
  await page.locator('#swap-action').click();
  await page.evaluate(({wallet,neta})=>{window.__result={transactionHash:'A'.repeat(64),events:[{type:'wasm',attributes:[{key:'_contract_address',value:neta},{key:'action',value:'transfer'},{key:'to',value:wallet},{key:'amount',value:'10094'}]}]};},{wallet,neta});
  await page.locator('#confirm-swap').click();await page.waitForFunction(()=>document.querySelector('#swap-modal-state').textContent.includes('Transaction confirmed'));
  assert.equal(await page.locator('#swap-result-hash').textContent(),'A'.repeat(64));await page.locator('#close-swap').click();
  await page.locator('#reverse-swap').click();await page.locator('#offer-amount').fill('0.01');await ready();await page.locator('#swap-action').click();
  const preview=JSON.parse(await page.locator('#swap-preview').textContent());assert.equal(preview.contract,neta);assert.deepEqual(preview.funds,[]);assert.equal(preview.message.send.amount,'10000');assert.equal(preview.message.send.contract,pair);
  await page.evaluate(()=>window.__reject=true);await page.locator('#confirm-swap').click();await textIs('#swap-modal-message','USER REJECTED');await page.locator('#close-swap').click();
  await page.locator('#disconnect-wallet').click();assert.equal(await page.locator('#swap-action').isDisabled(),true);
  await page.locator('#connect-wallet').click();await ready();await page.evaluate(()=>dispatchEvent(new Event('keplr_keystorechange')));assert.equal(await page.locator('#swap-action').isDisabled(),true);
  stale=true;await page.reload();await textIs('#contract-state','Unavailable');assert.equal(await page.locator('#swap-action').isDisabled(),true);
  stale=false;badCode=true;await page.locator('#refresh-pool').click();await page.waitForFunction(()=>document.querySelector('#quote-error').textContent.includes('CODE ID'));
  assert.equal(await page.locator('#swap-action').isDisabled(),true);await screenshot('buy-neta-unavailable-320');
  assert.deepEqual(errors,[]);console.log('Community project navigation and WYND swap: four viewports, wallet review, quote minimum, limits, stale source and contract checks passed (synthetic transactions only).');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
