import {MAINNET_UPGRADE_ADMIN} from '../../names/mainnet-config.mjs';
import {namesNetwork} from '../../names/networks.mjs';
// Chain-scoped Names execution bridge. Uses the same lock/journal as Faucet, Governance and RELAY.
import {SigningStargateClient,GasPrice,defaultRegistryTypes,calculateFee} from '@cosmjs/stargate';
import {Registry} from '@cosmjs/proto-signing';
import {sha256} from '@cosmjs/crypto';
import {toHex,toBase64,fromBase64,fromBech32} from '@cosmjs/encoding';
import {TxRaw,TxBody,AuthInfo} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {MsgExecuteContract,MsgStoreCode,MsgInstantiateContract} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import {journalBroadcast} from './broadcast-journal.mjs';

const TYPE='/cosmwasm.wasm.v1.MsgExecuteContract',STORE='/cosmwasm.wasm.v1.MsgStoreCode',INSTANTIATE='/cosmwasm.wasm.v1.MsgInstantiateContract';
const codecs={[TYPE]:MsgExecuteContract,[STORE]:MsgStoreCode,[INSTANTIATE]:MsgInstantiateContract};
const encoder=new TextEncoder();
const hash=bytes=>toHex(sha256(bytes)).toUpperCase();
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const journalKey=(owner,chainId)=>'neta-pending-tx-v1:'+chainId+':'+owner;
export const attemptKey=(owner,id,chainId='uni-7')=>'neta-nns-v2-attempt:'+chainId+':'+owner+':'+id;
export function validAddress(value,walletOnly=false){
  try {const d=fromBech32(value);return value===value.toLowerCase()&&d.prefix==='juno'&&(d.data.length===20||(!walletOnly&&d.data.length===32));}catch{return false;}
}
function requestValid(r){
  if(!validAddress(r.owner,true)||typeof r.memo!=='string'||encoder.encode(r.memo).length>256)throw Error('Invalid Names request.');
  if(!/^[a-f0-9]{32}$/.test(r.intentId||''))throw Error('A persisted Names attempt ID is required.');
  if(r.kind==='store'){
    const bytes=fromBase64(r.wasm||'');
    if(bytes.length<8||bytes.length>1000000||!same(bytes.slice(0,8),new Uint8Array([0,97,115,109,1,0,0,0]))||hash(bytes).toLowerCase()!==r.checksum)throw Error('Invalid reviewed WASM artifact.');
  }else{
    if(!r.msg||typeof r.msg!=='object'||Array.isArray(r.msg))throw Error('Invalid contract message.');
    if(r.kind==='instantiate'){
      if(r.migrationAdmin!==undefined&&r.migrationAdmin!==MAINNET_UPGRADE_ADMIN)throw Error('Invalid migration administrator.');
      if(!Number.isSafeInteger(r.codeId)||r.codeId<1||typeof r.label!=='string'||r.label.length<1||encoder.encode(r.label).length>128)throw Error('Invalid instantiate request.');
    }else if((r.kind&&r.kind!=='execute')||!validAddress(r.contract)||Object.keys(r.msg).length!==1)throw Error('Invalid Names execute request.');
  }
}
function message(r){
  if(r.kind==='store')return {typeUrl:STORE,value:MsgStoreCode.fromPartial({sender:r.owner,wasmByteCode:fromBase64(r.wasm)})};
  if(r.kind==='instantiate')return {typeUrl:INSTANTIATE,value:MsgInstantiateContract.fromPartial({sender:r.owner,admin:r.migrationAdmin||'',codeId:BigInt(r.codeId),label:r.label,msg:encoder.encode(JSON.stringify(r.msg)),funds:[]})};
  return {typeUrl:TYPE,value:MsgExecuteContract.fromPartial({sender:r.owner,contract:r.contract,msg:encoder.encode(JSON.stringify(r.msg)),funds:[]})};
}
function save(storage,key,row){const raw=JSON.stringify(row);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('Names transaction record could not be verified.');}
function recordedRequest(r){if(r.kind!=='store')return r;const copy={...r};delete copy.wasm;return copy;}
function rowFor(storage,r,chainId){
  const raw=storage.getItem(attemptKey(r.owner,r.intentId,chainId));if(raw===null)return null;
  const row=JSON.parse(raw);
  if(row.version!==1||canonical(row.request)!==canonical(recordedRequest(r))||!['preparing','signing','signed','pending','not_broadcast','included'].includes(row.status))throw Error('Names transaction record changed; remain locked.');
  return row;
}
// Check actual protobuf payload; a successful hash from another action is insufficient.
export function matchTransaction(bytes,r){
  requestValid(r);
  const raw=TxRaw.decode(bytes),body=TxBody.decode(raw.bodyBytes),auth=AuthInfo.decode(raw.authInfoBytes),expected=message(r);
  if(body.messages.length!==1||body.messages[0].typeUrl!==expected.typeUrl||body.memo!==r.memo||body.extensionOptions.length||body.nonCriticalExtensionOptions.length||body.timeoutHeight!==0n||raw.signatures.length!==1||auth.signerInfos.length!==1)throw Error('Transaction does not match this Names intent.');
  if(!same(body.messages[0].value,codecs[expected.typeUrl].encode(expected.value).finish()))throw Error('Transaction payload does not match this Names intent.');
  return raw;
}
function feeMatches(raw,fee){
  const auth=AuthInfo.decode(raw.authInfoBytes),f=auth.fee;
  if(!f||f.gasLimit.toString()!==fee.gas||f.payer||f.granter||auth.tip||canonical(f.amount)!==canonical(fee.amount))throw Error('Wallet changed the reviewed fee. No broadcast was sent.');
}
export async function connect(rpc,signer,chainId='uni-7'){
  const network=namesNetwork(chainId);
  if(!network.rpcs.includes(rpc))throw Error('Unapproved Names RPC.');
  const registry=new Registry([...defaultRegistryTypes,...Object.entries(codecs)]);
  const client=await SigningStargateClient.connectWithSigner(rpc,signer,{registry,gasPrice:GasPrice.fromString(network.gasPrice)});
  if(await client.getChainId()!==chainId){client.disconnect();throw Error('Names network mismatch.');}
  return client;
}
export function createBridge({chainId='uni-7',client,lookup,assertWallet,verifyDeployment,storage=globalThis.localStorage,locks=globalThis.navigator?.locks,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
  const network=namesNetwork(chainId);
  if(!storage||!locks?.request||typeof lookup!=='function'||typeof assertWallet!=='function'||typeof verifyDeployment!=='function')throw Error('Names transaction dependencies unavailable.');
  async function checkedReceipt(hashValue,r){
    if(!/^[A-F0-9]{64}$/.test(hashValue))throw Error('Invalid transaction hash.');
    const found=await lookup(hashValue);
    if(!found||found.hash!==hashValue||!found.tx||hash(found.tx)!==hashValue||!Number.isSafeInteger(found.height)||found.height<1||!Number.isInteger(found.code)||found.code<0)throw Error('Transaction outcome is still unknown.');
    matchTransaction(found.tx,r);
    return {transactionHash:hashValue,chainId,height:found.height,code:found.code,intentMatched:true,events:found.events||[]};
  }
  async function execute(request,{beforeSign=async()=>{},onSigned=async()=>{}}={}){
    const r=structuredClone(request);requestValid(r);
    // Legacy no-admin requests remain readable by recover(), never signable on mainnet.
    if(r.kind==='instantiate'&&(chainId==='juno-1'?r.migrationAdmin!==MAINNET_UPGRADE_ADMIN:r.migrationAdmin!==undefined))throw Error('Review the required chain-specific migration administrator.');
    if(rowFor(storage,r,chainId))throw Error('This attempt already exists. Reconcile it before any new signature.');
    const key=attemptKey(r.owner,r.intentId,chainId);
    let row={version:1,request:recordedRequest(r),status:'preparing'};save(storage,key,row);
    let enteredSign=false;
    const proxy={
      getChainId:()=>client.getChainId(),gasPrice:GasPrice.fromString(network.gasPrice),
      getTx:async h=>{const tx=await lookup(h);return tx&&hash(tx.tx)===h?tx:null;},
      simulate:(...args)=>client.simulate(...args),
      sign:async(sender,messages,fee,memo)=>{
        await verifyDeployment();await assertWallet(r.owner);
      if(await client.getChainId()!==chainId)throw Error('Names network mismatch.');
        await beforeSign();
        row.status='signing';save(storage,key,row);enteredSign=true;
        let signed;
        try {
          signed=await client.sign(sender,messages,fee,memo);
          const bytes=TxRaw.encode(signed).finish();matchTransaction(bytes,r);feeMatches(signed,fee);
          // Account changes while the wallet popup is open must not broadcast.
          await assertWallet(r.owner);
          await beforeSign();
          row={...row,status:'signed',hash:hash(bytes),bytes:toBase64(bytes)};save(storage,key,row);
          // A recovery-aware caller may durably back up these exact signed bytes
          // before journalBroadcast can submit them. Failure here is proven
          // not-broadcast and retains the recorded attempt for explicit recovery.
          await onSigned({transactionHash:row.hash});
          await assertWallet(r.owner);
          await beforeSign();
        }catch(error){row.status='not_broadcast';save(storage,key,row);throw error;}
        return signed;
      },
      broadcastTx:async bytes=>{
        if(row.hash!==hash(bytes)||!same(fromBase64(row.bytes),bytes))throw Error('Signed transaction changed.');
        row.status='pending';save(storage,key,row);
        // Submission and confirmation use separate providers: the sending RPC
        // can accept transactions while its transaction index is disabled.
        // A lost submit response is also resolved only by exact on-chain bytes.
        try {await client.broadcastTxSync(bytes);}catch{/* Never resend here. */}
        let receipt,lastError;
        for(let attempt=0;attempt<6;attempt++){
          try {receipt=await checkedReceipt(row.hash,r);break;}catch(error){lastError=error;}
          if(attempt<5)await wait(2000);
        }
        if(!receipt)throw lastError;
        row.status='included';row.receipt=receipt;delete row.bytes;save(storage,key,row);
        return receipt;
      },
    };
    try {
      await verifyDeployment();await assertWallet(r.owner);
      if(await client.getChainId()!==chainId)throw Error('Names network mismatch.');
      const gas=await client.simulate(r.owner,[message(r)],r.memo),maximum=r.kind==='store'?10000000:2000000;
      if(!Number.isSafeInteger(gas)||gas<=0||gas>maximum)throw Error('Transaction gas exceeds the Names limit.');
      const fee=calculateFee(Math.max(250000,Math.ceil(gas*1.8)),GasPrice.fromString(network.gasPrice));
      return await journalBroadcast(proxy,r.owner,[message(r)],fee,r.memo,{storage,locks});
    }
    catch(error){
      // Before client.sign, this attempt has not produced any broadcast bytes.
      // The shared journal may still belong to another operation; never erase it.
      if(!enteredSign&&row.status==='preparing'){row.status='not_broadcast';save(storage,key,row);}
      throw error;
    }
  }
  async function recover(request,explicitHash=null){
    const r=structuredClone(request);requestValid(r);
    return locks.request(journalKey(r.owner,chainId),{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock)throw Error('Another tab is using this wallet.');
      await verifyDeployment();await assertWallet(r.owner);
      if(await client.getChainId()!==chainId)throw Error('Names network mismatch.');
      const key=attemptKey(r.owner,r.intentId,chainId),row=rowFor(storage,r,chainId);
      if(row?.status==='not_broadcast'&&!explicitHash)return {notBroadcast:true,intentMatched:true};
      const h=explicitHash||row?.hash;
      if(!h)throw Error('Interrupted signing has no proven receipt. Keep the intent and check wallet history.');
      if(row?.hash&&h!==row.hash)throw Error('Hash does not match the saved signed transaction.');
      if(row?.bytes&&hash(fromBase64(row.bytes))!==h)throw Error('Saved signed bytes are invalid.');
      const receipt=await checkedReceipt(h,r);
      if(row){const finished={...row,status:'included',receipt};delete finished.bytes;save(storage,key,finished);}
      const pending=storage.getItem(journalKey(r.owner,chainId));
      if(pending){
        const shared=JSON.parse(pending);
        if(shared.version!==1||shared.chain!==chainId||shared.sender!==r.owner)throw Error('Invalid shared transaction journal.');
        // Never clear another action or an interrupted signature based on this hash.
        if(shared.status==='pending'&&shared.hash===h){
          if(hash(fromBase64(shared.bytes))!==h)throw Error('Shared journal bytes mismatch.');
          if(storage.getItem(journalKey(r.owner,chainId))!==pending)throw Error('Shared journal changed.');
          storage.removeItem(journalKey(r.owner,chainId));
        }
      }
      return receipt;
    });
  }
  return {execute,recover,adminReviewGuard:true,signedCheckpointGuard:true};
}
