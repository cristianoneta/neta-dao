// Server-side quote construction, with injected custody and market readers.
// The production adapter lives in service/; this module also retains test fixtures.
import {feeAmount,quotePreimage,QUOTE_TTL,renewalExpiry} from '../names-v2-core.mjs';
import {normalizeName} from '../names-profile-core.mjs';
import {randomBytes} from 'node:crypto';

function positive(value) {
  if(typeof value!=='string'||! /^[1-9]\d{0,38}$/.test(value)) throw Error('Invalid positive market integer.');
  return BigInt(value);
}
// Both reserves have six decimals. USD reference is USD per JUNO * 10^12.
// Policy values and identities must be reviewed/pinned before a service starts.
export function marketPrice({pool, usd, previous, policy, now}) {
  if(!policy || !Number.isSafeInteger(now) || now<=0) throw Error('Market policy unavailable.');
  for(const key of ['pool','neta_token','usd_source']) if(typeof policy[key]!=='string'||!policy[key].trim()||policy[key]!==policy[key].trim()) throw Error('Market identities must be explicitly pinned.');
  for(const key of ['max_pool_age','max_usd_age','max_jump_bps','max_baseline_age']) if(!Number.isSafeInteger(policy[key])||policy[key]<=0) throw Error('Incomplete market policy.');
  if(policy.max_jump_bps>10000) throw Error('Invalid price jump policy.');
  if(pool?.chain_id!=='juno-1'||pool.address!==policy.pool||pool.token!==policy.neta_token||pool.native_denom!=='ujuno'||pool.token_decimals!==6||pool.native_decimals!==6||usd?.source!==policy.usd_source||usd.asset!=='JUNO') throw Error('Market identity mismatch.');
  for(const [sample,maxAge] of [[pool,policy.max_pool_age],[usd,policy.max_usd_age]]) {
    if(!Number.isSafeInteger(sample.observed_at)||sample.observed_at<=0||sample.observed_at>now||now-sample.observed_at>maxAge) throw Error('Market data stale or future-dated.');
  }
  if(!Number.isSafeInteger(pool.height)||pool.height<=0) throw Error('Missing pool observation height.');
  const juno=positive(pool.juno_reserve), neta=positive(pool.neta_reserve), junoUsd=positive(usd.usd_per_juno_12);
  if(juno<positive(policy.min_juno_reserve)||neta<positive(policy.min_neta_reserve)) throw Error('Pool reserves below the approved minimum.');
  let price=juno*junoUsd/neta;
  if(policy.twap_seconds!==undefined){
    if(!Number.isSafeInteger(policy.twap_seconds)||policy.twap_seconds<1800||!Number.isSafeInteger(pool.twap_start)||pool.observed_at-pool.twap_start<policy.twap_seconds) throw Error('Verified pool average unavailable.');
    price=positive(pool.twap_price_6)*junoUsd/1000000n;
  }
  if(price<=0n || price>((1n<<128n)-1n)) throw Error('Invalid derived NETA price.');
  if(!previous || !Number.isSafeInteger(previous.observed_at)||previous.observed_at>now||now-previous.observed_at>policy.max_baseline_age) throw Error('Reviewed price baseline unavailable.');
  const old=positive(previous.usd_per_neta_12), difference=price>old?price-old:old-price;
  if(difference*10000n>old*BigInt(policy.max_jump_bps)) throw Error('Price movement exceeds the approved limit.');
  return price.toString();
}

export async function issueQuote({deployment,config,request,identity,market,policy,now,sign}) {
  if(config.purchases_paused!==false || typeof sign!=='function') throw Error('Quote issuance is not enabled.');
  const name=normalizeName(request.name);
  if(!['register','renew'].includes(request.operation)) throw Error('Unknown quote operation.');
  let owner,generation,ownership_revision,expected_expires_at;
  if(request.operation==='register') {
    // Explicit result of a verified registry Resolve query, not a missing fetch.
    if(identity?.available!==true||!Number.isSafeInteger(identity.next_generation)||identity.next_generation<1||identity.name!==name) throw Error('Name unavailable or registration state unknown.');
    owner=request.payer;generation=identity.next_generation;ownership_revision=1;expected_expires_at=0;
  } else {
    if(identity?.name!==name||!identity.owner) throw Error('Renewal identity unavailable.');
    ({owner,generation,ownership_revision}=identity);expected_expires_at=identity.expires_at;
    renewalExpiry(identity,request.years,now);
  }
  const price=marketPrice({...market,policy,now});
  const quote={operation:request.operation,payer:request.payer,owner,name,generation,ownership_revision,expected_expires_at,
    years:request.years,tariff_version:config.tariff_version,signer_version:config.signer_version,usd_per_neta_12:price,
    amount:feeAmount(name,request.years,price,config.tariff),nonce:randomBytes(32).toString('hex'),issued_at:now,expires_at:now+QUOTE_TTL};
  const text=quotePreimage(deployment,config,quote);
  // The signer must use the pinned Ed25519 key; return only the public signature.
  const signature=await sign(new TextEncoder().encode(text));
  return {quote,signature};
}
