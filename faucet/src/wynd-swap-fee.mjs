import {calculateFee, GasPrice} from '@cosmjs/stargate';

// Reuse the estimate already checked by the controller. A numeric CosmJS fee
// would simulate a second time and could bypass that earlier gas ceiling.
export function fixedFee(gas, adjustment, gasPrice, gasCap) {
  if (!Number.isSafeInteger(gas) || gas <= 0 || !Number.isSafeInteger(gasCap) ||
      gasCap <= 0 || gas > gasCap || !Number.isFinite(adjustment) || adjustment < 1 || adjustment > 3) {
    throw new Error('INVALID OR EXCESSIVE TRANSACTION GAS');
  }
  const gasLimit = Math.ceil(gas * adjustment);
  if (!Number.isSafeInteger(gasLimit)) throw new Error('TRANSACTION GAS OVERFLOW');
  const price = GasPrice.fromString(gasPrice);
  if (price.amount.toString()==="0") throw new Error('INVALID TRANSACTION GAS PRICE');
  return calculateFee(gasLimit, price);
}
