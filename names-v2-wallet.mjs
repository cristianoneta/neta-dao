import {NamesV2Reader,UNI7_RPCS} from './names-v2-reader.mjs';
import {NamesV2Client} from './names-v2-client.mjs';
import {CHAIN_CONFIG} from './juno-faucet-core.mjs?v=2';
import {lookupTransaction} from './juno-faucet-transactions.mjs';

export async function connectNamesWallet({deployment,keplr=globalThis.keplr,bundle=globalThis.NetaNamesSigning,storage=globalThis.localStorage,locks=globalThis.navigator?.locks,fetcher=globalThis.fetch}){
  if(!keplr||!bundle?.createBridge||!locks?.request)throw Error('Keplr, secure browser locks and the Names signing bundle are required.');
  const reader=new NamesV2Reader({deployment,fetcher});await reader.verify();
  await keplr.experimentalSuggestChain(CHAIN_CONFIG);await keplr.enable('uni-7');
  const signer=keplr.getOfflineSigner('uni-7');
  if(typeof signer.signDirect!=='function')throw Error('This UNI-7 test flow requires a Keplr Direct-signing account.');
  const owner=(await signer.getAccounts())[0]?.address;
  if(!bundle.validAddress(owner,true))throw Error('Invalid UNI-7 wallet.');
  let connected=true;
  const walletAddress=async()=>{
    if(!connected)return null;
    return (await keplr.getOfflineSigner('uni-7').getAccounts())[0]?.address;
  };
  const assertWallet=async expected=>{if(await walletAddress()!==expected)throw Error('Wallet changed. Reconnect before continuing.');};
  const wrapped={getAccounts:()=>signer.getAccounts(),signDirect:(address,doc)=>keplr.signDirect('uni-7',address,doc,{preferNoSetFee:true})};
  let signing;
  for(const rpc of UNI7_RPCS){try{signing=await bundle.connect(rpc,wrapped);break;}catch{/* No signatures during RPC connection. */}}
  if(!signing)throw Error('UNI-7 signing connection unavailable.');
  const bridge=bundle.createBridge({client:signing,storage,locks,lookup:hash=>lookupTransaction(hash,fetcher),assertWallet,verifyDeployment:()=>reader.verify()});
  const client=new NamesV2Client({deployment:reader.deployment,reader,storage,walletAddress,execute:bridge.execute,
    withLock:(key,callback)=>locks.request(key,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Another tab is working on this Names intent.');return callback();})});
  return {owner,reader,client,recover:hash=>client.recoverPending(owner,bridge.recover,hash||null),disconnect(){connected=false;signing.disconnect();}};
}
