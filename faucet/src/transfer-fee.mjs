import {GasPrice,calculateFee} from '@cosmjs/stargate';

export const TRANSFER_GAS_POLICY='bank-send-gas-v1';
// UNI-7 simulation understated the owner's first donation: a 136,997 limit
// exhausted at 137,382 before completion. Bank sends get room for writes/new
// recipient accounts; keep simulation, an upper bound and the fixed UNI-7 price.
export function bankSendFee(estimate){
  if(!Number.isSafeInteger(estimate)||estimate<=0||estimate>500000)throw Error('Unsafe UNI-7 transfer gas estimate.');
  return calculateFee(Math.max(250000,Math.ceil(estimate*1.8)),GasPrice.fromString('0.2ujunox'));
}
