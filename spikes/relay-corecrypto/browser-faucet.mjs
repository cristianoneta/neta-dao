import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path.includes('..'))throw Error();const body=await readFile(new URL('.'+path,root));res.writeHead(200,{'content-type':/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':'text/html'}).end(body);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const address='juno1qurswpc8qurswpc8qurswpc8qurswpc89pyp8a';
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext();let paid=false,broadcasts=[];
 const json=(route,data)=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 const validator=(name,suffix,rate)=>({operator_address:'junovaloper1'+suffix.repeat(38),description:{moniker:name},status:'BOND_STATUS_BONDED',jailed:false,commission:{commission_rates:{rate}}});
 const validators=[validator('Zulu','q','.1'),validator('Alpha','p','.05')];
 await context.route('https://**/*',route=>{
  const p=new URL(route.request().url()).pathname;
  if(p.endsWith('node_info'))return json(route,{default_node_info:{network:'uni-7'}});
  if(p.endsWith('/params'))return json(route,{params:{bond_denom:'ujunox',unbonding_time:'2419200s'}});
  if(p.endsWith('/validators'))return json(route,{validators,pagination:{next_key:null}});
  if(p.endsWith('/by_denom'))return json(route,{balance:{denom:'ujunox',amount:paid?'30000000':'20000000'}});
  if(p.endsWith('/delegations'))return json(route,{delegation_responses:[{delegation:{validator_address:validators[1].operator_address},balance:{denom:'ujunox',amount:'5000000'}}],pagination:{}});
  if(p.endsWith('/unbonding_delegations'))return json(route,{unbonding_responses:[],pagination:{}});
  if(p.endsWith('/withdraw_address'))return json(route,{withdraw_address:address});
  if(p.endsWith('/rewards'))return json(route,{rewards:[{validator_address:validators[1].operator_address,reward:[{denom:'ujunox',amount:'1234567.123'}]}],total:[{denom:'ujunox',amount:'1234567.123'}]});
  throw Error('Unexpected network path '+p);
 });
 await context.addInitScript(addr=>{window.walletAddress=addr;window.keplr={experimentalSuggestChain:async c=>{if(c.chainId!=='uni-7')throw Error('wrong chain');},enable:async()=>{},getOfflineSigner:()=>({getAccounts:async()=>[{address:window.walletAddress}]}),signArbitrary:async()=>({pub_key:{},signature:'mock'})};},address);
 await context.route('**/assets/faucet-signing.js*',async route=>route.fulfill({contentType:'text/javascript',body:(await readFile(new URL('assets/faucet-signing.js',root),'utf8'))+`;NetaFaucetSigning={...NetaFaucetSigning,connect:async()=>({disconnect(){}}),broadcast:async(client,address,messages)=>{await window.recordBroadcast(messages);return {transactionHash:'A'.repeat(64)};}};`}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Page error:',e.message);});page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
 await page.goto(origin+'/juno-faucet.html');await page.getByText('Live UNI-7 data',{exact:false}).waitFor({timeout:10000}).catch(async e=>{console.error(await page.locator('#chain-status').innerText());throw e;});
 assert.match(await page.locator('#faucet-status').innerText(),/not active/);assert.equal(await page.locator('#request').isDisabled(),true);
 assert.match(await page.locator('.validator-name').first().innerText(),/^Alpha/);
 await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#available').textContent==='20',{},{timeout:10000}).catch(async e=>{console.error(await page.locator('#action-status').innerText(), await page.locator('#wallet-help').innerText());throw e;});
 assert.equal(await page.locator('#staked').innerText(),'5');assert.equal(await page.locator('#rewards').innerText(),'1.234567');assert.match(await page.locator('#unstaking-help').innerText(),/28 days/);
 await page.exposeFunction('recordBroadcast',messages=>broadcasts.push(messages));


 await page.locator('[data-action=stake]').first().click();await page.locator('#transaction-amount').fill('1.25');await page.locator('#transaction-confirm').click();await page.waitForFunction(()=>!document.querySelector('#transaction-dialog').open);
 assert.equal(broadcasts[0][0].typeUrl,'/cosmos.staking.v1beta1.MsgDelegate');assert.equal(broadcasts[0][0].value.amount.amount,'1250000');
 await page.locator('#refresh').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
 await page.locator('[data-action=unstake]').first().click();await page.locator('#transaction-amount').fill('6');await page.locator('#transaction-confirm').click();await page.getByText('Amount exceeds your current stake with this validator.',{exact:true}).first().waitFor();assert.equal(broadcasts.length,1);await page.locator('#transaction-cancel').click();
 await page.locator('#claim').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert.equal(broadcasts[1][0].typeUrl,'/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward');
 // A changed Keplr account must not use the stale page wallet for a signature.
 await page.locator('[data-action=stake]').first().click();await page.locator('#transaction-amount').fill('1');await page.evaluate(()=>window.walletAddress='other');await page.locator('#transaction-confirm').click();await page.waitForFunction(()=>document.querySelector('#wallet').textContent.includes('not connected'));assert.equal(broadcasts.length,2);
 // Activate only in the test fixture; production config remains deliberately unset.
 await context.route('**/juno-faucet-config.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export const FAUCET={api:${JSON.stringify(origin)},address:${JSON.stringify(address)}};`}));
 await context.route(origin+'/status**',route=>json(route,{chainId:'uni-7',address,amount:'10000000',intervalSeconds:86400,balance:'1000000000',ready:true,pending:false,nextClaimAt:paid?new Date(Date.now()+86400000).toISOString():null}));
 await context.route(origin+'/challenge',route=>json(route,{id:'nonce',address,chainId:'uni-7',message:'NETA JUNOX faucet\nTest challenge'}));
 await context.route(origin+'/claim',route=>{paid=true;return json(route,{status:'confirmed',hash:'B'.repeat(64)});});
 await page.reload();await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#request').disabled);
 await page.locator('#request').click();await page.waitForFunction(()=>document.querySelector('#available').textContent==='30');assert.equal(await page.locator('#request').isDisabled(),true);assert.match(await page.locator('#faucet-status').innerText(),/Next payout/);
 await page.waitForFunction(()=>!document.querySelector('#donate').disabled);await page.locator('#donation').fill('1.5');await page.locator('#donate').click();assert.equal(await page.locator('#transaction-dialog').evaluate(x=>x.open),false);
 await page.locator('#donation').fill('17');await page.locator('#donate').click();await page.locator('#transaction-confirm').click();await page.waitForFunction(()=>!document.querySelector('#transaction-dialog').open);assert.equal(broadcasts.at(-1)[0].value.amount[0].amount,'17000000');
 await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
 await mkdir(new URL('artifacts/',root),{recursive:true});
 await page.locator('#dismiss-status').click();
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))console.error(await page.evaluate(()=>({inner:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,x:scrollX})),await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>[e.tagName,e.className,e.getBoundingClientRect().width]).slice(0,20)));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);await page.screenshot({path:new URL(`artifacts/faucet-${width}.png`,root).pathname,fullPage:true});}
 assert.deepEqual(errors,[]);await context.close();console.log('Faucet browser checks passed: reads, alphabetical validators, stake, limits, rewards, wallet switch, donation, 4 viewport sizes.');
}finally{await browser?.close();server.close();}
