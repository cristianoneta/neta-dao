export const CHAIN = 'uni-7';
export const DENOM = 'ujunox';
export const RESTS = ['https://juno.test.api.nodeshub.online', 'https://juno.api.t.stavr.tech'];
export const RPCS = ['https://juno.test.rpc.nodeshub.online', 'https://juno.rpc.t.stavr.tech'];
export const CHAIN_CONFIG = {
  chainId: CHAIN, chainName: 'Juno Testnet', rpc: RPCS[0], rest: RESTS[0], bip44: {coinType:118},
  bech32Config: {bech32PrefixAccAddr:'juno',bech32PrefixAccPub:'junopub',bech32PrefixValAddr:'junovaloper',bech32PrefixValPub:'junovaloperpub',bech32PrefixConsAddr:'junovalcons',bech32PrefixConsPub:'junovalconspub'},
  currencies:[{coinDenom:'JUNOX',coinMinimalDenom:DENOM,coinDecimals:6}],
  feeCurrencies:[{coinDenom:'JUNOX',coinMinimalDenom:DENOM,coinDecimals:6,gasPriceStep:{low:.1,average:.2,high:.3}}],
  stakeCurrency:{coinDenom:'JUNOX',coinMinimalDenom:DENOM,coinDecimals:6}, features:['cosmwasm']
};
export function amountToMicro(value, whole = false) {
  if (typeof value !== 'string' || !(whole ? /^[1-9]\d{0,11}$/ : /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/).test(value))
    throw Error(whole ? 'Enter a positive whole number of JUNOX.' : 'Enter a positive amount with at most 6 decimal places.');
  const [units, fraction = ''] = value.split('.');
  const amount = BigInt(units) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  if (amount <= 0n) throw Error('Amount must be greater than zero.');
  return amount.toString();
}
export function formatMicro(value) {
  const micro = BigInt(String(value).split('.')[0]);
  const fraction = (micro % 1000000n).toString().padStart(6,'0').replace(/0+$/, '');
  return (micro / 1000000n).toLocaleString('en-US') + (fraction ? '.' + fraction : '');
}
export function rewardsMicro(rewards) {
  // SDK DecCoins have fractional micro-units; truncate only after summing.
  return (rewards.reduce((sum, coin) => {
    if (coin.denom !== DENOM) return sum;
    if (!/^\d+(\.\d{1,18})?$/.test(coin.amount)) throw Error('Invalid rewards data');
    const [a, b = ''] = coin.amount.split('.');
    return sum + BigInt(a) * 10n**18n + BigInt(b.padEnd(18,'0'));
  }, 0n) / 10n**18n).toString();
}
export function messagesFor(action, address, target, amount) {
  if (action === 'donate') return [{typeUrl:'/cosmos.bank.v1beta1.MsgSend',value:{fromAddress:address,toAddress:target,amount:[{denom:DENOM,amount:amountToMicro(amount,true)}]}}];
  if (!['stake','unstake'].includes(action)) throw Error('Unknown transaction');
  return [{typeUrl:'/cosmos.staking.v1beta1.'+(action === 'stake' ? 'MsgDelegate' : 'MsgUndelegate'),value:{delegatorAddress:address,validatorAddress:target,amount:{denom:DENOM,amount:amountToMicro(amount)}}}];
}
export class Uni7Reader {
  constructor(fetcher = fetch) { this.fetcher = (...args) => fetcher(...args); this.base = null; }
  async get(base, path) {
    const response = await this.fetcher(base + path, {cache:'no-store',signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw Error('UNI-7 data request failed ('+response.status+').');
    return response.json();
  }
  async verify() {
    this.base = null;
    for (const base of RESTS) {
      try {
        const info = await this.get(base,'/cosmos/base/tendermint/v1beta1/node_info');
        if (info.default_node_info?.network !== CHAIN) throw Error('UNI-7 network mismatch');
        this.base = base; return;
      } catch (error) { if (/mismatch/.test(error.message)) throw error; }
    }
    throw Error('UNI-7 is unavailable. Try Refresh shortly.');
  }
  async query(path) { if (!this.base) throw Error('Verify UNI-7 first'); return this.get(this.base,path); }
  async pages(path, field) {
    const rows = [], seen = new Set(); let next = '';
    for (let i=0; i<100; i++) {
      const data = await this.query(path + '?pagination.limit=200' + (next ? '&pagination.key='+encodeURIComponent(next) : ''));
      if (!Array.isArray(data[field])) throw Error('Incomplete UNI-7 response');
      rows.push(...data[field]); next = data.pagination?.next_key;
      if (!next) return rows;
      if (seen.has(next)) throw Error('Repeated UNI-7 pagination cursor');
      seen.add(next);
    }
    throw Error('UNI-7 data exceeds the page limit; no partial totals shown.');
  }
  async validators() {
    const [rows, parameters] = await Promise.all([this.pages('/cosmos/staking/v1beta1/validators','validators'),this.query('/cosmos/staking/v1beta1/params')]);
    if (parameters.params?.bond_denom !== DENOM) throw Error('Unexpected UNI-7 staking token');
    return {rows:rows.sort((a,b)=>(a.description?.moniker || a.operator_address).localeCompare(b.description?.moniker || b.operator_address,'en',{sensitivity:'base'})),unbonding:parameters.params.unbonding_time};
  }
  async account(address) {
    const root = '/cosmos/staking/v1beta1/delegators/'+address;
    const [balance,delegations,unbondings,rewards,withdraw] = await Promise.all([
      this.query('/cosmos/bank/v1beta1/balances/'+address+'/by_denom?denom='+DENOM),
      this.pages('/cosmos/staking/v1beta1/delegations/'+address,'delegation_responses'),this.pages(root+'/unbonding_delegations','unbonding_responses'),
      this.query('/cosmos/distribution/v1beta1/delegators/'+address+'/rewards'),
      this.query('/cosmos/distribution/v1beta1/delegators/'+address+'/withdraw_address')]);
    if (balance.balance?.denom !== DENOM || !/^\d+$/.test(balance.balance.amount) || !Array.isArray(rewards.rewards) || !Array.isArray(rewards.total) || !withdraw.withdraw_address)
      throw Error('Incomplete wallet data');
    for (const row of delegations) if (row.balance?.denom !== DENOM || !/^\d+$/.test(row.balance.amount)) throw Error('Invalid stake data');
    for (const row of unbondings) for (const e of row.entries) if (!/^\d+$/.test(e.balance) || !Number.isFinite(Date.parse(e.completion_time))) throw Error('Invalid unbonding data');
    return {balance:balance.balance.amount,delegations,unbondings,rewards,withdraw:withdraw.withdraw_address};
  }
}
