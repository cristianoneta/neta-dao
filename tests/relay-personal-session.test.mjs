import test from 'node:test';
import assert from 'node:assert/strict';
import {connectPersonalBrowser} from '../relay-personal-session.mjs';
import {verifiedPersonalRelease} from '../relay-personal-release.mjs';
import {PERSONAL_MAINNET_OWNER as owner, PERSONAL_MAINNET_POLICY as policy, PERSONAL_MAINNET_WASM as hash} from '../relay-personal-network.mjs';
const deployment={chainId:'juno-1',contract:'juno1'+'q'.repeat(58),creator:owner,admin:owner,codeId:123,codeHash:hash,label:'NETA RELAY personal v0.4 · Juno mainnet'};
const response=data=>({ok:true,json:async()=>data});
function fixture(){
 let current=true,signs=0,disconnected=0;
 const check=()=>{if(!current)throw Error('Shared session changed');};
 const keplr={enable:async()=>{},getOfflineSigner:()=>({getAccounts:async()=>[{address:owner}]}),signArbitrary:async()=>{signs++;throw Error('Unexpected signature');}};
 const client={getChainId:async()=>'juno-1',disconnect:()=>disconnected++};
 const bundle={connect:async()=>client,createBridge:()=>{throw Error('No crypto operation expected');}};
 const fetcher=async url=>response(url.endsWith('/node_info')?{default_node_info:{network:'juno-1'}}:
  url.endsWith('/code/123')?{code_info:{data_hash:hash}}:url.includes('/smart/')?{data:policy}:
  {contract_info:{creator:owner,admin:owner,code_id:123,label:deployment.label}});
 return {args:{deployment,backupUrl:'https://backup.example',owner,keplr,bundle,fetcher,storage:{getItem:()=>null},assertCurrent:check},
  invalidate(){current=false;},stats:()=>({signs,disconnected})};
}
test('release defaults to disabled and rejects unpinned identity or backup origins',()=>{
 assert.equal(verifiedPersonalRelease(),null);
 assert.equal(verifiedPersonalRelease({enabled:false}),null);
 for(const backupUrl of ['http://backup.example','https://backup.example/path','https://user@backup.example','https://backup.example?redirect=x'])
  assert.throws(()=>verifiedPersonalRelease({enabled:true,deployment,backupUrl}));
 assert.throws(()=>verifiedPersonalRelease({enabled:true,deployment:{...deployment,admin:'other'},backupUrl:'https://backup.example'}));
 assert.equal(verifiedPersonalRelease({enabled:true,deployment,backupUrl:'https://backup.example'}).backupUrl,'https://backup.example');
});
test('shared disconnect invalidates the real adapter and backup auth without a keystore event',async()=>{
 globalThis.location={origin:'https://dao.netareborn.com'};
 const f=fixture(),session=await connectPersonalBrowser(f.args);
 assert.deepEqual(f.stats(),{signs:0,disconnected:0});
 f.invalidate();await assert.rejects(session.controller.guard(),/Shared session changed/);
 assert.equal(session.controller.status().closed,true);
 assert.throws(()=>session.authorizeBackup(),/Shared session changed/);
 await session.disconnect();assert.deepEqual(f.stats(),{signs:0,disconnected:1});
});
test('a late signing-client connection is discarded after shared-wallet invalidation',async()=>{
 const f=fixture(),original=f.args.bundle.connect;
 f.args.bundle.connect=async(...args)=>{const client=await original(...args);f.invalidate();return client;};
 await assert.rejects(connectPersonalBrowser(f.args),/Shared session changed/);
 assert.deepEqual(f.stats(),{signs:0,disconnected:1});
});
test('default absent deployment never accesses a wallet or RPC',async()=>{
 let calls=0;
 await assert.rejects(connectPersonalBrowser({owner,keplr:{enable:async()=>calls++},fetcher:async()=>calls++}),/not verified/);
 assert.equal(calls,0);
});
