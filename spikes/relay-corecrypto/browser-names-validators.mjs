import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {proofChallenge,operatorAccount} from '../../names-profile-core.mjs';
import {NAMES_TEST_ARTIFACTS} from '../../names-v2-artifacts.mjs';
const root=new URL('../../',import.meta.url),f=JSON.parse(await readFile(new URL('tests/fixtures/nns-adr36.json',root)));
const owner=f.profile.identity.owner,operators={mainnet:operatorAccount(f.pair.mainnet.address),testnet:operatorAccount(f.pair.testnet.address)};
const manifest={version:1,chain_id:'uni-7',testnet_only:true,registry:f.deployment.registry,profile_contract:f.deployment.contract,token:'juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr',admin:owner,treasury:owner,quote_public_key:Buffer.alloc(32,7).toString('base64'),signer_version:1,contracts:Object.fromEntries(['registry','token','profiles'].map((role,i)=>[role,{code_id:i+1,sha256:NAMES_TEST_ARTIFACTS[role].sha256,creator:owner,admin:null}]))};
const config={...manifest,purchases_paused:false,tariff_version:1,tariff:{three_cents:64000,four_cents:16000,standard_cents:500}};
let profile=structuredClone(f.profile);profile.identity.expires_at=Math.floor(Date.now()/1000)+86400;
let writes=[],chainReadMode='ready';
const consensusKey=Buffer.alloc(32,8).toString('base64');
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,body=await readFile(new URL('.'+p,root));res.writeHead(200,{'content-type':/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/html'}).end(body);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('https://**/*',route=>{
  const url=new URL(route.request().url()),p=url.pathname,chain=url.hostname.includes('polkachu')||url.hostname.includes('.m.')?'juno-1':'uni-7';let data;
  if(p.endsWith('/node_info'))data={default_node_info:{network:'uni-7'}};
  else if(p.endsWith('/blocks/latest'))data={block:{header:{chain_id:chainReadMode==='wrong-chain'?'wrong-chain':chain,height:'100',time:new Date().toISOString()}}};
  else if(p.includes('/staking/v1beta1/validators/'))data={validator:{operator_address:f.pair[chain==='juno-1'?'mainnet':'testnet'].address,description:{moniker:'Synthetic validator'},consensus_pubkey:{'@type':'/cosmos.crypto.ed25519.PubKey',key:consensusKey},jailed:false,status:'BOND_STATUS_BONDED'}};
  else if(p.includes('/validatorsets/'))data={block_height:'100',validators:[{pub_key:{'@type':'/cosmos.crypto.ed25519.PubKey',key:chainReadMode==='inactive'?Buffer.alloc(32,9).toString('base64'):consensusKey},voting_power:'10'}],pagination:{total:'1'}};
  else if(p.includes('/smart/')){
   const contract=p.split('/contract/')[1].split('/')[0],q=JSON.parse(Buffer.from(decodeURIComponent(p.split('/smart/')[1]),'base64').toString());
   if(q.config)data={data:contract===manifest.registry?config:{registry:manifest.registry}};
   else if(q.token_info)data={data:{decimals:6}};
   else if(q.profile)data={data:{active:true,profile}};
   else if(q.operator_binding)data={data:null};
   else if(q.challenge){const a=q.challenge;assert.equal(a.expected_revision,profile.revision);data={data:{text:proofChallenge({deployment:f.deployment,profile,pair:a.pair,expiresAt:a.expires_at,now:Math.floor(Date.now()/1000),revoke:a.revoke}),mainnet_signer:operatorAccount(a.pair.mainnet.address),testnet_signer:operatorAccount(a.pair.testnet.address)}};}
   else throw Error('Unexpected smart query '+JSON.stringify(q));
  }else if(p.includes('/code/'))data={code_info:{data_hash:Object.values(manifest.contracts).find(c=>String(c.code_id)===p.split('/code/')[1]).sha256}};
  else{const contract=p.split('/contract/')[1],role=contract===manifest.registry?'registry':contract===manifest.token?'token':'profiles';data={contract_info:{code_id:String(manifest.contracts[role].code_id),creator:owner,admin:''}};}
  return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.exposeFunction('simulateValidatorExecute',request=>{
  writes.push(request);const msg=request.msg;
  if(msg.link_validators){assert.equal(request.owner,owner);assert.equal(msg.link_validators.expected_revision,profile.revision);profile.validators=structuredClone(msg.link_validators.pair);}
  else if(msg.unlink_validators){assert.equal(request.owner,owner);assert.equal(msg.unlink_validators.expected_revision,profile.revision);profile.validators=null;}
  else if(msg.revoke_by_operator){assert.equal(msg.revoke_by_operator.expected_revision,profile.revision);assert.notEqual(request.owner,owner);profile.validators=null;}
  else throw Error('Unexpected validator write');
  profile.revision++;return {chainId:'uni-7',transactionHash:String(writes.length).padStart(64,'A'),code:0,height:101+writes.length};
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/names-v2-lab.html');
 assert.equal(await page.locator('#validator-prepare').isDisabled(),true);
 // Public chain observations need neither a wallet nor a manifest.
 await page.locator('#validator-mainnet').fill(f.pair.mainnet.address);await page.locator('#validator-testnet').fill(f.pair.testnet.address);
 await page.locator('#validator-check').click();await page.waitForFunction(()=>!document.querySelector('#validator-check').disabled);
 assert.match(await page.locator('#validator-observation').textContent(),/IN ACTIVE CONSENSUS SET/);assert.equal(writes.length,0);
 chainReadMode='inactive';await page.locator('#validator-check').click();await page.waitForFunction(()=>!document.querySelector('#validator-check').disabled);assert.match(await page.locator('#validator-observation').textContent(),/NOT IN ACTIVE CONSENSUS SET/);
 chainReadMode='wrong-chain';await page.locator('#validator-check').click();await page.waitForFunction(()=>!document.querySelector('#validator-check').disabled);assert.match(await page.locator('#validator-observation').textContent(),/UNAVAILABLE/);assert.doesNotMatch(await page.locator('#validator-observation').textContent(),/IN ACTIVE CONSENSUS SET/);chainReadMode='ready';
 await page.evaluate(({owner,proofs})=>{
  window.testWallet=owner;window.operatorSigns=[];
  window.keplr={experimentalSuggestChain:async()=>{},enable:async()=>{},getOfflineSigner:()=>({getAccounts:async()=>[{address:window.testWallet}],signDirect(){throw Error('No real transaction signing in this fixture');}}),getKey:async()=>({bech32Address:window.testWallet}),signArbitrary:async(chain,signer,text)=>{window.operatorSigns.push({chain,signer,text});const p=proofs[chain==='juno-1'?0:1];return {pub_key:{type:'tendermint/PubKeySecp256k1',value:p.public_key},signature:p.signature};}};
  window.NetaNamesSigning={validAddress:()=>true,connect:async()=>{if(window.holdConnection)await new Promise(resolve=>window.releaseConnection=resolve);return {disconnect(){}};},createBridge:()=>({execute:r=>window.simulateValidatorExecute(r)})};
 },{owner,proofs:f.proofs});
 await page.locator('#manifest').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(manifest))});
 await page.locator('#verify').click();await page.locator('#connect').click();
 await page.locator('#validator-name').fill('alice');
 await page.locator('#validator-mainnet').fill(f.pair.mainnet.address);
 await page.locator('#validator-testnet').fill(f.pair.testnet.address);
 await page.locator('#validator-prepare').click();await page.waitForFunction(()=>!document.querySelector('#validator-sign-mainnet').disabled);
 assert.match(await page.locator('#validator-challenge').textContent(),/Purpose: link-validators/);
 await page.locator('#validator-sign-mainnet').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Select the mainnet operator wallet'));
 assert.equal(await page.evaluate(()=>window.operatorSigns.length),0);
 async function switchWallet(address){await page.evaluate(address=>{window.testWallet=address;window.dispatchEvent(new Event('keplr_keystorechange'));},address);}
 async function collectBoth(){
  await switchWallet(operators.mainnet);await page.locator('#validator-sign-mainnet').click();await page.waitForFunction(()=>document.querySelector('#validator-proof-mainnet').textContent.includes('collected'));
  await switchWallet(operators.testnet);await page.locator('#validator-sign-testnet').click();await page.waitForFunction(()=>document.querySelector('#validator-proof-testnet').textContent.includes('collected'));
 }
 await collectBoth();assert.equal(writes.length,0);assert.equal(await page.locator('#validator-publish').isDisabled(),true);
 const signs=await page.evaluate(()=>window.operatorSigns);assert.equal(signs[0].text,signs[1].text);
 await page.locator('#connect').click();await page.waitForFunction(address=>document.querySelector('#wallet').textContent===address,operators.testnet);assert.equal(await page.locator('#validator-publish').isDisabled(),true,'operator is not the name owner');
 await switchWallet(owner);await page.locator('#connect').click();await page.waitForFunction(()=>!document.querySelector('#validator-publish').disabled);
 await page.locator('#validator-check').click();await page.waitForFunction(()=>!document.querySelector('#validator-check').disabled);assert.match(await page.locator('#validator-observation').textContent(),/IN ACTIVE CONSENSUS SET/);
 assert.equal((await page.evaluate(()=>window.operatorSigns)).length,2,'read-only check does not ask for signatures');
 if(process.env.NNS_SCREENSHOT_DIR)await mkdir(process.env.NNS_SCREENSHOT_DIR,{recursive:true});
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`validator overflow ${width}`);
  if(process.env.NNS_SCREENSHOT_DIR)await page.locator('section[aria-labelledby="validator-heading"]').screenshot({path:process.env.NNS_SCREENSHOT_DIR+`/validators-${width}.png`});
 }
 await page.setViewportSize({width:720,height:500});await page.locator('#validator-name').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'validator-action');
 await page.locator('#validator-publish').click();await page.waitForFunction(()=>!document.querySelector('#confirm').disabled);
 assert.match(await page.locator('#review-text').textContent(),/no mainnet transaction/);assert.equal(writes.length,0);
 await page.locator('#confirm').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Exact transaction confirmed on UNI-7.');
 assert.equal(writes.length,1);assert.deepEqual(writes[0].msg.link_validators.mainnet_proof,f.proofs[0]);
 await page.locator('#validator-refresh').click();await page.waitForFunction(()=>!document.querySelector('#validator-refresh').disabled);assert.match(await page.locator('#validator-current').textContent(),/stored on UNI-7/);assert.match(await page.locator('#validator-observation').textContent(),/Stored ownership link/);
 // Owner unlink is separately reviewed and does not need operator signatures.
 await page.locator('#validator-unlink').click();await page.waitForFunction(()=>!document.querySelector('#confirm').disabled);assert.equal(writes.length,1);
 await page.locator('#confirm').click();await page.waitForFunction(()=>!document.querySelector('#validator-unlink').disabled);assert.equal(writes.length,2);assert.equal(profile.validators,null);
 // Re-establish fixture state to test unilateral operator revocation with another payer.
 profile.validators=structuredClone(f.pair);profile.revision++;
 await page.locator('#validator-action').selectOption('revoke-testnet');await page.locator('#validator-prepare').click();await page.waitForFunction(()=>!document.querySelector('#validator-sign-testnet').disabled);
 assert.equal(await page.locator('#validator-sign-mainnet').isDisabled(),true);
 await switchWallet(operators.testnet);await page.locator('#validator-sign-testnet').click();await page.waitForFunction(()=>document.querySelector('#validator-proof-testnet').textContent.includes('collected'));
 await page.locator('#connect').click();await page.locator('#validator-publish').click();await page.locator('#confirm').click();await page.waitForFunction(()=>!document.querySelector('#validator-prepare').disabled);
 assert.equal(writes.length,3);assert.ok(writes[2].msg.revoke_by_operator);assert.equal(profile.validators,null);
 // A late connect result cannot restore a session after a Keplr account switch.
 await page.locator('#disconnect').click();
 await page.evaluate(()=>window.holdConnection=true);await page.locator('#connect').click();
 await page.waitForFunction(()=>typeof window.releaseConnection==='function');
 await switchWallet(owner);await page.evaluate(()=>{window.holdConnection=false;window.releaseConnection();});
 await page.waitForFunction(()=>!document.querySelector('#connect').disabled);
 assert.equal(await page.locator('#wallet').textContent(),'Wallet not connected.');
 assert.match(await page.locator('#status').textContent(),/Wallet changed during connection/);
 assert.deepEqual(errors,[]);console.log('Validator UI: real reader/client, separate mocked ADR-36 signatures, wallet switches, owner publication, unlink, operator revocation, keyboard and 320–1440px reflow passed. No real operator or on-chain write.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
