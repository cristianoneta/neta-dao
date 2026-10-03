import {SigningStargateClient, GasPrice} from '@cosmjs/stargate';
import {fromBech32} from '@cosmjs/encoding';
import {journalBroadcast} from './broadcast-journal.mjs';

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
  return journalBroadcast(client, address, messages, 'auto', memo);
}
