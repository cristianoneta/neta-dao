// WYND execution bridge adapted from neta-website 7ad0bbf7215e087e639965ae65ebecc0c77d2945.
// Reuse the workspace's pinned dependencies and origin-wide transaction journal.
import {SigningStargateClient,GasPrice,defaultRegistryTypes} from '@cosmjs/stargate';
import {Registry} from '@cosmjs/proto-signing';
import {MsgExecuteContract} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import {TxBody,AuthInfo} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {journalBroadcast} from './broadcast-journal.mjs';
export {fixedFee} from './wynd-swap-fee.mjs';

const typeUrl='/cosmwasm.wasm.v1.MsgExecuteContract';
const message=(sender,contract,msg,funds)=>({typeUrl,value:MsgExecuteContract.fromPartial({sender,contract,msg:new TextEncoder().encode(JSON.stringify(msg)),funds})});
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
export async function connect(endpoints,signer,gasPrice,timeoutMs=8000){
  for(const endpoint of endpoints){
    let timeout,expired=false,client;
    try{
      const attempt=SigningStargateClient.connectWithSigner(endpoint,signer,{registry:new Registry([...defaultRegistryTypes,[typeUrl,MsgExecuteContract]]),gasPrice:GasPrice.fromString(gasPrice)});
      attempt.then(c=>{if(expired)c.disconnect();},()=>{});
      client=await Promise.race([attempt,new Promise((_,reject)=>{timeout=setTimeout(()=>{expired=true;reject(Error('RPC connection timed out'));},timeoutMs);})]);
      if(await client.getChainId()!=='juno-1')throw Error('Wrong signing network');
      return {client,endpoint};
    }catch{client?.disconnect();}finally{clearTimeout(timeout);}
  }
  throw Error('No Juno signing connection is available. Try again later.');
}
export const simulate=(client,sender,contract,msg,funds,memo)=>client.simulate(sender,[message(sender,contract,msg,funds)],memo);
export async function execute(client,sender,contract,msg,funds,fee,memo,{assertWallet}={}){
  if(typeof assertWallet!=='function')throw Error('Wallet validation is required');
  const expected=message(sender,contract,msg,funds);
  const proxy={
    getChainId:async()=>{const chain=await client.getChainId();if(chain!=='juno-1')throw Error('Wrong signing network');return chain;},
    getTx:h=>client.getTx(h),
    sign:async(...args)=>{
      await assertWallet();
      const signed=await client.sign(...args),body=TxBody.decode(signed.bodyBytes),auth=AuthInfo.decode(signed.authInfoBytes);
      if(body.messages.length!==1||body.messages[0].typeUrl!==typeUrl||!same(body.messages[0].value,MsgExecuteContract.encode(expected.value).finish())||body.memo!==memo||body.timeoutHeight!==0n||body.extensionOptions.length||body.nonCriticalExtensionOptions.length)
        throw Error('Wallet changed the reviewed swap. Nothing was broadcast.');
      if(!auth.fee||auth.fee.gasLimit.toString()!==fee.gas||auth.fee.payer||auth.fee.granter||auth.tip||auth.fee.amount.length!==fee.amount.length||auth.fee.amount.some((coin,i)=>coin.denom!==fee.amount[i].denom||coin.amount!==fee.amount[i].amount))
        throw Error('Wallet changed the reviewed fee. Nothing was broadcast.');
      await assertWallet();return signed;
    },
    broadcastTx:bytes=>client.broadcastTx(bytes),
  };
  return journalBroadcast(proxy,sender,[expected],fee,memo);
}
