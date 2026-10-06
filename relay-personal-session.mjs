import {personalMainnetProfile} from './relay-personal-network.mjs';
import {PersonalMailboxClient} from './relay-uni7-client.mjs';
import {PersonalBackupClient} from './relay-personal-backup.mjs';
import {PersonalBrowserController} from './relay-personal-browser.mjs';
import {PersonalCryptoRuntime} from './relay-personal-runtime.mjs';
import {lookupTransaction} from './juno-faucet-transactions.mjs';

// Explicit host connection only. The default deployment is null: importing or
// mounting the workspace never connects, authenticates or enables SEND.
export async function connectPersonalBrowser({deployment,backupUrl,owner,keplr=globalThis.keplr,bundle=globalThis.NetaNamesSigning,
  storage=globalThis.localStorage,fetcher=globalThis.fetch,onState=()=>{}}){
  const profile=personalMainnetProfile(deployment);
  if(!bundle?.createBridge||!owner)throw Error('Shared wallet and recovery-aware signing bundle required');
  const adapter=new PersonalMailboxClient({keplr,fetcher,assertDevicePrepared:async()=>false,
    bundle:{connect:(rpc,signer)=>bundle.connect(rpc,signer,profile.chain),execute:()=>{throw Error('Use the reviewed personal controller');}}},profile);
  await adapter.connect();if(adapter.address!==owner)throw Error('Shared wallet changed');
  const client=await adapter.signer();
  const backup=new PersonalBackupClient({url:backupUrl,webOrigin:location.origin,scope:{chain:profile.chain,contract:profile.contract,wallet:owner},keplr,fetcher});
  const controller=new PersonalBrowserController({runtime:new PersonalCryptoRuntime(),adapter,backup,storage,onState,
    makeBridge:journal=>bundle.createBridge({chainId:profile.chain,client,storage:journal,
      lookup:hash=>lookupTransaction(hash,fetcher,profile.chain),assertWallet:()=>adapter.assertWallet(),verifyDeployment:()=>adapter.verify()})});
  return {controller,authorizeBackup:()=>backup.connect(),async disconnect(){await controller.close();backup.disconnect();client.disconnect();}};
}
