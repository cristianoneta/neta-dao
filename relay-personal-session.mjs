import {personalMainnetProfile} from './relay-personal-network.mjs';
import {PersonalMailboxClient} from './relay-uni7-client.mjs';
import {PersonalBackupClient} from './relay-personal-backup.mjs';
import {PersonalBrowserController} from './relay-personal-browser.mjs';
import {PersonalCryptoRuntime} from './relay-personal-runtime.mjs';
import {lookupTransaction} from './juno-faucet-transactions.mjs';

// Explicit host connection only. The default deployment is null: importing or
// mounting the workspace never connects, authenticates or enables SEND.
export async function connectPersonalBrowser({deployment,backupUrl,owner,keplr=globalThis.keplr,bundle=globalThis.NetaNamesSigning,
  storage=globalThis.localStorage,fetcher=globalThis.fetch,onState=()=>{},assertCurrent=()=>{}}){
  const profile=personalMainnetProfile(deployment);
  if(!bundle?.createBridge||!owner)throw Error('Shared wallet and recovery-aware signing bundle required');
  let connected=true,client,controller,backup;
  const check=()=>{if(!connected)throw Error('Personal session disconnected');assertCurrent();};
  const guarded={getOfflineSigner(chain){check();const signer=keplr.getOfflineSigner(chain);return {...signer,getAccounts:async()=>{check();const accounts=await signer.getAccounts();check();return accounts;}};}};
  for(const method of ['enable','signDirect','signAmino','signArbitrary'])guarded[method]=async(...args)=>{check();const result=await keplr[method](...args);check();return result;};
  check();
  const adapter=new PersonalMailboxClient({keplr:guarded,fetcher,assertDevicePrepared:async()=>false,
    bundle:{connect:(rpc,signer)=>bundle.connect(rpc,signer,profile.chain),execute:()=>{throw Error('Use the reviewed personal controller');}}},profile);
  try {
  await adapter.connect();check();if(adapter.address!==owner)throw Error('Shared wallet changed');
  client=await adapter.signer();check();
  backup=new PersonalBackupClient({url:backupUrl,webOrigin:location.origin,scope:{chain:profile.chain,contract:profile.contract,wallet:owner},keplr:guarded,fetcher});
  controller=new PersonalBrowserController({runtime:new PersonalCryptoRuntime(),adapter,backup,storage,onState,
    makeBridge:journal=>bundle.createBridge({chainId:profile.chain,client,storage:journal,
      lookup:hash=>lookupTransaction(hash,fetcher,profile.chain),assertWallet:()=>adapter.assertWallet(),verifyDeployment:()=>adapter.verify()})});
  return {controller,authorizeBackup:()=>{check();return backup.connect();},async disconnect(){connected=false;await controller.close();backup.disconnect();client.disconnect();}};
  } catch(error) {connected=false;await controller?.close();backup?.disconnect();client?.disconnect();throw error;}
}
