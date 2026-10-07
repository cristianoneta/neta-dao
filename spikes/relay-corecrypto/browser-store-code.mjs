// Real shipped bridge + browser-native gzip; disposable signing/RPC fixture only.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {PERSONAL_MAINNET_OWNER as owner,PERSONAL_MAINNET_WASM as checksum} from '../../relay-personal-network.mjs';
const require=createRequire(new URL('../../faucet/package.json',import.meta.url));
const {TxRaw,TxBody,AuthInfo}=require('cosmjs-types/cosmos/tx/v1beta1/tx');
const {MsgStoreCode}=require('cosmjs-types/cosmwasm/wasm/v1/tx');
const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const bytes=await readFile(new URL('.'+path,root));res.writeHead(200,{'content-type':/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.wasm')?'application/wasm':'text/html'}).end(bytes);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.RELAY_CHROMIUM_PATH?{executablePath:process.env.RELAY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('fixtureSign',({sender,code,fee,memo})=>{
  const body=TxBody.fromPartial({messages:[{typeUrl:'/cosmwasm.wasm.v1.MsgStoreCode',value:MsgStoreCode.encode({sender,wasmByteCode:Uint8Array.from(code)}).finish()}],memo});
  const auth=AuthInfo.fromPartial({signerInfos:[{sequence:1n}],fee:{amount:fee.amount,gasLimit:BigInt(fee.gas)}});
  const raw=TxRaw.fromPartial({bodyBytes:TxBody.encode(body).finish(),authInfoBytes:AuthInfo.encode(auth).finish(),signatures:[new Uint8Array([1])]});
  return {bodyBytes:[...raw.bodyBytes],authInfoBytes:[...raw.authInfoBytes],signatures:raw.signatures.map(s=>[...s])};
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/relay-personal-deploy.html');
 const result=await page.evaluate(async({owner,checksum})=>{
  const raw=new Uint8Array(await(await fetch('assets/relay-mainnet/neta_relay_mailbox_v04.wasm')).arrayBuffer());
  const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
  let code,found,signs=0,broadcasts=0;
  const client={getChainId:async()=>'juno-1',simulate:async(_,messages)=>{code=messages[0].value.wasmByteCode;if(code.length*2+1024>1000000)throw Error('Bad status on response: 400');return 2913204;},
   sign:async(sender,messages,fee,memo)=>{signs++;const r=await window.fixtureSign({sender,code:[...messages[0].value.wasmByteCode],fee,memo});return {bodyBytes:Uint8Array.from(r.bodyBytes),authInfoBytes:Uint8Array.from(r.authInfoBytes),signatures:r.signatures.map(s=>Uint8Array.from(s))};},
   broadcastTxSync:async bytes=>{broadcasts++;found={hash:await hash(bytes),tx:bytes,height:123,code:0};return found.hash;}};
  const bridge=NetaNamesSigning.createBridge({chainId:'juno-1',client,storage:localStorage,locks:navigator.locks,lookup:async()=>found,assertWallet:async()=>{},verifyDeployment:async()=>{},wait:async()=>{}});
  let b64='';for(let i=0;i<raw.length;i+=8192)b64+=String.fromCharCode(...raw.subarray(i,i+8192));
  const request={owner,checksum,wasm:btoa(b64),kind:'store',intentId:'ef'.repeat(16),memo:'Upload NETA RELAY personal v0.4 on Juno mainnet'};
  const receipt=await bridge.execute(request),restored=new Uint8Array(await new Response(new Blob([code]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const recovered=await bridge.recover(request);
  return {code:receipt.code,recovered:recovered.transactionHash===receipt.transactionHash,signs,broadcasts,rawBytes:raw.length,compressedBytes:code.length,checksum:(await hash(restored)).toLowerCase()};
 },{owner,checksum});
 assert.equal(result.code,0);assert.equal(result.recovered,true);assert.equal(result.signs,1);assert.equal(result.broadcasts,1);assert.equal(result.checksum,checksum);
 assert.ok(result.rawBytes*2>1000000);assert.ok(result.compressedBytes*2+1024<1000000);assert.deepEqual(errors,[]);
 console.log('Browser store-code passed: real signing bundle, native gzip, unchanged WASM checksum, exact receipt and recovery without re-signing. '+JSON.stringify(result));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
