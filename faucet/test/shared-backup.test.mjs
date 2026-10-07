import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Secp256k1Wallet} from '@cosmjs/amino';
import {openRelayBackup} from '../service/relay-backup.mjs';
import {FaucetLedger} from '../service/ledger.mjs';
import {createFaucetServer} from '../service/http.mjs';
const origin='https://dao.netareborn.com',domain='https://neta-junox-faucet.onrender.com',contract='juno1'+'a'.repeat(58);
const signer=await Secp256k1Wallet.fromKey(new Uint8Array(32).fill(19),'juno'),wallet=(await signer.getAccounts())[0].address;
async function serve(backup,ledger,adapter,paused=false){
 const server=createFaucetServer({backup,ledger,adapter,origin,paused});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {request:(path,method='GET',body,token)=>fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),
 close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
test('RELAY is opt-in and cannot share the faucet database path',async()=>{
 assert.equal(await openRelayBackup({}),null);assert.equal(await openRelayBackup({RELAY_BACKUP_ENABLED:'false'}),null);
 await assert.rejects(openRelayBackup({RELAY_BACKUP_ENABLED:'yes'}),/flag/);
 await assert.rejects(openRelayBackup({RELAY_BACKUP_ENABLED:'true',RELAY_BACKUP_DIRECTORY:'/tmp/shared',FAUCET_DB:'/tmp/shared/relay-backup.sqlite'}),/faucet database/);
});
test('disabled backup routes never enter payout handling or consume faucet admission',async()=>{
 let admitted=0;const s=await serve(null,{guard:{admitRequest(){admitted++;return null;}}},{});
 try{for(const path of ['/v1/backup','/v1/challenge','/v1/auth','/health'])assert.equal((await s.request(path)).status,503);assert.equal(admitted,0);}finally{await s.close();}
});
test('same host keeps independent authorization, quotas and restart persistence',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'shared-relay-'));
 const env={RELAY_BACKUP_ENABLED:'true',RELAY_BACKUP_DIRECTORY:join(directory,'relay'),FAUCET_DB:join(directory,'faucet.sqlite'),
   FAUCET_WEB_ORIGIN:origin,FAUCET_PUBLIC_ORIGIN:domain,RELAY_MAILBOX_CONTRACT:contract,RELAY_BACKUP_WALLETS:wallet};
 let chainReads=0;const adapter={address:'juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt',balance:async()=>{chainReads++;return '100000000';},lookup:async()=>null};
 const ledger=new FaucetLedger(env.FAUCET_DB,adapter,{domain,verify:async()=>false,limits:{requestsPerDay:1}});
 let relay=await openRelayBackup(env),s=await serve(relay.server,ledger,adapter);
 try{
  assert.equal((await s.request('/status')).status,200);assert.equal((await s.request('/status')).status,429);
  assert.equal((await s.request('/v1/backup')).status,401);
  const challenge=await (await s.request('/v1/challenge','POST',{wallet})).json();
  assert.equal(JSON.parse(challenge.message).domain,domain);
  const doc={chain_id:'',account_number:'0',sequence:'0',fee:{gas:'0',amount:[]},msgs:[{type:'sign/MsgSignData',value:{signer:wallet,data:Buffer.from(challenge.message).toString('base64')}}],memo:''};
  const signature=(await signer.signAmino(wallet,doc)).signature;
  const auth=await (await s.request('/v1/auth','POST',{nonce:challenge.nonce,signature})).json();assert.ok(auth.accessToken);
  const scope=JSON.stringify(['juno-1',contract,wallet]),envelope={version:1,scope,revision:1,salt:Buffer.alloc(32).toString('base64'),iv:Buffer.alloc(12).toString('base64'),ciphertext:Buffer.alloc(16).toString('base64')};
  assert.equal((await s.request('/v1/backup','PUT',{expectedRevision:0,envelope},auth.accessToken)).status,200);
  assert.equal(chainReads,1,'backup auth and writes never use faucet RPC or signing');
  await s.close();relay.close();relay=await openRelayBackup(env);s=await serve(relay.server,ledger,adapter,true);
  assert.equal((await s.request('/health')).status,200,'backup stays independent of faucet pause');
  assert.equal((await s.request('/v1/backup','GET',null,auth.accessToken)).status,401,'restart does not persist bearer credentials');
  const {BackupStore}=await import('../../relay-backup/store.mjs');const copy=new BackupStore(relay.file);
  assert.equal(JSON.parse(copy.get(scope).blob).revision,1);copy.close();
  assert.notEqual(relay.file,env.FAUCET_DB);assert.equal((await s.request('/status')).status,429,'existing faucet quota survives backup restart');
 }finally{await s.close();relay.close();ledger.close();await rm(directory,{recursive:true,force:true});}
});
