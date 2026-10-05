import {namesNetwork} from './names/networks.mjs';
import {NamesV2Reader} from './names-v2-reader.mjs?v=5';
import {NamesV2Client} from './names-v2-client.mjs?v=5';
import {CHAIN_CONFIG} from './juno-faucet-core.mjs?v=2';
import {lookupTransaction} from './juno-faucet-transactions.mjs';

export async function connectNamesWallet({deployment,keplr=globalThis.keplr,bundle=globalThis.NetaNamesSigning,storage=globalThis.localStorage,locks=globalThis.navigator?.locks,fetcher=globalThis.fetch}){
  if(!keplr||!bundle?.createBridge||!locks?.request)throw Error('Keplr, secure browser locks and the Names signing bundle are required.');
  const reader=new NamesV2Reader({deployment,fetcher});await reader.verify();
  const chainId=reader.deployment.chain_id,network=namesNetwork(chainId);
  if(chainId==='uni-7')await keplr.experimentalSuggestChain(CHAIN_CONFIG);await keplr.enable(chainId);
  const signer=keplr.getOfflineSigner(chainId);
  if(typeof signer.signDirect!=='function')throw Error('This Names flow requires a Keplr Direct-signing account.');
  const owner=(await signer.getAccounts())[0]?.address;
  if(!bundle.validAddress(owner,true))throw Error('Invalid Juno wallet.');
  let connected=true;
  const walletAddress=async()=>{
    if(!connected)return null;
    return (await keplr.getOfflineSigner(chainId).getAccounts())[0]?.address;
  };
  const assertWallet=async expected=>{if(await walletAddress()!==expected)throw Error('Wallet changed. Reconnect before continuing.');};
  const wrapped={getAccounts:()=>signer.getAccounts(),signDirect:(address,doc)=>keplr.signDirect(chainId,address,doc,{preferNoSetFee:true})};
  let signing;
  for(const rpc of network.rpcs){try{signing=await bundle.connect(rpc,wrapped,chainId);break;}catch{/* No signatures during RPC connection. */}}
  if(!signing)throw Error('Names signing connection unavailable.');
  const bridge=bundle.createBridge({chainId,client:signing,storage,locks,lookup:hash=>lookupTransaction(hash,fetcher,chainId),assertWallet,verifyDeployment:()=>reader.verify()});
  const execute=(request,options)=>{
    if(options?.beforeSign&&bridge.adminReviewGuard!==true)throw Error('Reload this page to load the updated administration signer.');
    return bridge.execute(request,options);
  };
  execute.adminReviewGuard=bridge.adminReviewGuard===true;
  const client=new NamesV2Client({deployment:reader.deployment,reader,storage,walletAddress,execute,
    withLock:(key,callback)=>locks.request(key,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Another tab is working on this Names intent.');return callback();})});
  return {owner,reader,client,recover:hash=>client.recoverPending(owner,bridge.recover,hash||null),disconnect(){connected=false;signing.disconnect();}};
}
