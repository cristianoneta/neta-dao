// Synced from neta-website/src/broadcast-journal.mjs (299be75f84a68b1ea53d364da2f89e634a866358).
import {sha256} from '@cosmjs/crypto';
import {toHex, toBase64} from '@cosmjs/encoding';
import {TxRaw, AuthInfo} from 'cosmjs-types/cosmos/tx/v1beta1/tx';

// Every signing bundle shares this origin-wide gate per chain and account.
// An unknown outcome is never treated as rejection, even after reload. Signed
// bytes are public transaction data, never wallet private keys.
const prefix='neta-pending-tx-v1:';
const hash=bytes=>toHex(sha256(bytes)).toUpperCase();
function read(storage,key) {
  const raw=storage.getItem(key); if(raw===null) return null;
  const row=JSON.parse(raw);
  if(row?.version!==1 || !['signing','pending'].includes(row.status) ||
      (row.status==='pending' && (!/^[0-9A-F]{64}$/.test(row.hash)||typeof row.bytes!=='string'))) throw Error('INVALID TRANSACTION JOURNAL — REMAIN LOCKED');
  return row;
}
function save(storage,key,row) {
  const raw=JSON.stringify(row); storage.setItem(key,raw);
  if(storage.getItem(key)!==raw) throw Error('TRANSACTION JOURNAL COULD NOT BE VERIFIED');
}
async function reconcile(client,storage,key) {
  const pending=read(storage,key); if(!pending)return;
  if(pending.status==='signing') throw Error('INTERRUPTED SIGNATURE — NO AUTOMATIC RETRY; CHECK WALLET AND TRANSACTION HISTORY');
  let included;
  try { included=await client.getTx(pending.hash); } catch {}
  if(!included || included.hash?.toUpperCase()!==pending.hash || !Number.isSafeInteger(included.height) || included.height<1 || !Number.isInteger(included.code)) throw Error('TRANSACTION OUTCOME UNKNOWN — RETRY LOCKED · TX '+pending.hash);
  // Returning the old result as the new action would misattribute it. A user
  // can review and confirm a fresh action only after this reconciliation notice.
  storage.removeItem(key);
  throw Error('PREVIOUS TRANSACTION INCLUDED · CODE '+included.code+' · TX '+pending.hash+' — REVIEW NEW ACTION SEPARATELY');
}
export async function journalBroadcast(client,sender,messages,fee,memo,options={}) {
  const storage=options.storage||globalThis.localStorage, locks=options.locks||globalThis.navigator?.locks;
  if(!storage || !locks?.request) throw Error('PERSISTENT TRANSACTION STORAGE AND DEVICE LOCK REQUIRED');
  const chain=await client.getChainId(), key=prefix+chain+':'+sender;
  return locks.request(key,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock)throw Error('ANOTHER TAB IS SIGNING FOR THIS ACCOUNT');
    await reconcile(client,storage,key);
    let explicit=fee;
    if(fee==='auto'||typeof fee==='number') {
      const gas=await client.simulate(sender,messages,memo);
      // The shared Socials/DAO path formerly used "auto". Preserve CosmJS fee
      // calculation while signing only once; the client owns configured price.
      const {calculateFee}=await import('@cosmjs/stargate');
      if(!Number.isSafeInteger(gas)||gas<=0||gas>2000000)throw Error('UNSAFE TRANSACTION GAS');
      if(!client.gasPrice || typeof client.gasPrice.denom!=='string')throw Error('EXPLICIT GAS PRICE REQUIRED');
      explicit=calculateFee(Math.ceil(gas*(typeof fee==='number'?fee:1.4)),client.gasPrice);
    }
    save(storage,key,{version:1,status:'signing',chain,sender});
    let signed;
    try { signed=await client.sign(sender,messages,explicit,memo); }
    catch(error) {
      // sign() never broadcasts. A rejected/offline signature is safe to clear.
      storage.removeItem(key); throw error;
    }
    const bytes=TxRaw.encode(signed).finish(), transactionHash=hash(bytes);
    const auth=AuthInfo.decode(signed.authInfoBytes);
    if(auth.signerInfos.length!==1) throw Error('UNEXPECTED SIGNER COUNT — REMAIN LOCKED');
    const sequence=auth.signerInfos[0].sequence.toString();
    save(storage,key,{version:1,status:'pending',chain,sender,hash:transactionHash,sequence,bytes:toBase64(bytes)});
    let result;
    try { result=await client.broadcastTx(bytes); }
    catch(error) {
      throw Error('TRANSACTION OUTCOME UNKNOWN — RETRY LOCKED · TX '+transactionHash,{cause:error});
    }
    if(result?.transactionHash?.toUpperCase()!==transactionHash || !Number.isSafeInteger(result.height)||result.height<1 || !Number.isInteger(result.code))
      throw Error('UNVERIFIED BROADCAST RESULT — RETRY LOCKED · TX '+transactionHash);
    storage.removeItem(key);
    if(result.code!==0) throw Error('TRANSACTION FAILED · CODE '+result.code+' · TX '+transactionHash);
    return result;
  });
}
