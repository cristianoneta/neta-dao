import {SigningStargateClient, GasPrice} from '@cosmjs/stargate';
import {fromBech32} from '@cosmjs/encoding';
import {journalBroadcast} from './broadcast-journal.mjs';
import {bankSendFee} from './transfer-fee.mjs';

export function validAddress(value, prefix = 'juno') {
  try { const decoded = fromBech32(value); return decoded.prefix === prefix && decoded.data.length === 20; }
  catch { return false; }
}
export async function connect(rpc, signer) {
  const client = await SigningStargateClient.connectWithSigner(rpc, signer, {gasPrice: GasPrice.fromString('0.2ujunox')});
  if (await client.getChainId() !== 'uni-7') { client.disconnect(); throw Error('UNI-7 network mismatch'); }
  return client;
}
export async function broadcast(client, address, messages, memo) {
  if (await client.getChainId() !== 'uni-7') throw Error('UNI-7 network mismatch');
  const bankSend=messages.length===1 && messages[0].typeUrl==='/cosmos.bank.v1beta1.MsgSend';
  const fee=bankSend?bankSendFee(await client.simulate(address,messages,memo)):'auto';
  try{return await journalBroadcast(client, address, messages, fee, memo);}
  catch(error){
    const failed=bankSend && /^TRANSACTION FAILED · CODE 11 · TX ([0-9A-F]{64})$/.exec(error.message||'');
    if(failed)throw Error('Transfer ran out of gas (code 11). No tokens were transferred; the network fee was charged. Review a new transaction separately. TX '+failed[1],{cause:error});
    throw error;
  }
}
