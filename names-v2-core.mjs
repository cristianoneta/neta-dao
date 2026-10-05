import {normalizeName} from './names-profile-core.mjs?v=20261004-1';

export const NAMES_V2_DEPLOYMENT = null;
export const YEAR = 365 * 24 * 60 * 60;
export const GRACE = 30 * 24 * 60 * 60;
export const QUOTE_TTL = 300;
const encoder = new TextEncoder();
const MAX128 = (1n << 128n) - 1n;
export const DEFAULT_TARIFF = Object.freeze({three_cents:9900, four_cents:1900, standard_cents:500});

function integer(value, min=0) {
  if (!Number.isSafeInteger(value) || value < min) throw Error('Invalid integer or timestamp.');
  return value;
}
function decimal(value, positive = true) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,38})$/.test(value)) throw Error('Expected canonical integer amount.');
  const n = BigInt(value);
  if (n > MAX128 || (positive && n === 0n)) throw Error('Amount outside Uint128 bounds.');
  return n;
}
function atom(value) {
  if (typeof value !== 'string' || !/^[a-z0-9-]{3,100}$/.test(value)) throw Error('Invalid chain/address context.');
  return value;
}
export function feeAmount(name, years, usdPerNeta12, tariff = DEFAULT_TARIFF) {
  const label = normalizeName(name).slice(0, -5);
  integer(years,1); if (years > 5) throw Error('Choose one to five years.');
  const cents = integer(label.length === 3 ? tariff.three_cents : label.length === 4 ? tariff.four_cents : tariff.standard_cents, 1);
  const numerator = BigInt(cents) * BigInt(years) * 1_000_000n * 1_000_000_000_000n;
  const denominator = 100n * decimal(usdPerNeta12);
  const result = (numerator + denominator - 1n) / denominator;
  if (result < 1n || result > MAX128) throw Error('Fee outside Uint128 bounds.');
  return result.toString();
}
export function renewalExpiry(record, years, now) {
  integer(record.expires_at,1); integer(now,1); integer(years,1);
  if (years > 5 || now >= record.expires_at + GRACE) throw Error('Name cannot be renewed for this term.');
  const end = Math.max(now,record.expires_at) + years * YEAR;
  if (end > now + 5 * YEAR || !Number.isSafeInteger(end)) throw Error('Maximum five years remaining.');
  return end;
}
export function quotePreimage(deployment, config, q) {
  for (const value of [deployment.chain_id, deployment.registry, config.token, config.treasury, q.payer, q.owner]) atom(value);
  if (!['juno-1','uni-7'].includes(deployment.chain_id) || config.chain_id !== deployment.chain_id) throw Error('Registry chain mismatch.');
  if (!['register','renew'].includes(q.operation) || normalizeName(q.name) !== q.name || !/^[a-f0-9]{64}$/.test(q.nonce)) throw Error('Malformed quote identity.');
  for (const field of ['generation','ownership_revision','years','tariff_version','signer_version','issued_at','expires_at']) integer(q[field],1);
  integer(q.expected_expires_at); decimal(q.amount); decimal(q.usd_per_neta_12);
  return [
    'NETA names quote v2', `Registry chain: ${deployment.chain_id}`, `Registry: ${deployment.registry}`,
    `Token: ${config.token}`, `Treasury: ${config.treasury}`, `Operation: ${q.operation}`, `Payer: ${q.payer}`,
    `Owner: ${q.owner}`, `Name: ${q.name}`, `Generation: ${q.generation}`, `Ownership revision: ${q.ownership_revision}`,
    `Expected expiry: ${q.expected_expires_at}`, `Years: ${q.years}`, `Tariff version: ${q.tariff_version}`,
    `Signer version: ${q.signer_version}`, `USD per NETA (12 decimals): ${q.usd_per_neta_12}`,
    `Amount (micro NETA): ${q.amount}`, `Nonce: ${q.nonce}`, `Issued at: ${q.issued_at}`, `Expires at: ${q.expires_at}`,
  ].join('\n');
}
function decodeBase64(value, size) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw Error('Malformed signature encoding.');
  const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  if(bytes.length!==size || btoa(String.fromCharCode(...bytes))!==value) throw Error('Invalid signature length or encoding.');
  return bytes;
}
export async function validateQuote({deployment, config, offer, expected, now, cryptoProvider=globalThis.crypto}) {
  if (config.purchases_paused !== false) throw Error('Name purchases are paused.');
  const q = offer.quote;
  const text = quotePreimage(deployment,config,q);
  integer(now,1);
  if (q.issued_at > now || q.expires_at <= now || q.expires_at <= q.issued_at || q.expires_at > q.issued_at + QUOTE_TTL) throw Error('Quote expired or outside its validity window.');
  if (q.tariff_version !== config.tariff_version || q.signer_version !== config.signer_version) throw Error('Quote policy changed.');
  const required = ['operation','payer','owner','name','generation','ownership_revision','expected_expires_at','years'];
  for(const field of required) if(expected[field]===undefined || expected[field]!==q[field]) throw Error(`Quote does not match the reviewed ${field}.`);
  if(q.operation==='register' && (q.payer!==q.owner || q.ownership_revision!==1 || q.expected_expires_at!==0)) throw Error('Registration must be paid by its owner.');
  if(q.operation==='renew') renewalExpiry({expires_at:q.expected_expires_at},q.years,now);
  if(q.amount!==feeAmount(q.name,q.years,q.usd_per_neta_12,config.tariff)) throw Error('Incorrect quote fee.');
  const key=await cryptoProvider.subtle.importKey('raw',decodeBase64(config.quote_public_key,32),{name:'Ed25519'},false,['verify']);
  if(!await cryptoProvider.subtle.verify('Ed25519',key,decodeBase64(offer.signature,64),encoder.encode(text))) throw Error('Invalid quote authority signature.');
  return structuredClone(q);
}
export async function commitmentHash(deployment, owner, name, salt, cryptoProvider=globalThis.crypto) {
  atom(deployment.chain_id);atom(deployment.registry);atom(owner);
  if(!/^[a-f0-9]{64}$/.test(salt)) throw Error('A 32-byte random salt is required.');
  const bytes=encoder.encode(`NETA names commitment v2\n${deployment.chain_id}\n${deployment.registry}\n${owner}\n${normalizeName(name)}\n${salt}`);
  return [...new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function paymentMessage(deployment, config, offer, salt) {
  // Call only after validateQuote and a fresh identity/wallet check.
  const hook=offer.quote.operation==='register'?{register:{offer,salt}}:{renew:{offer}};
  if(offer.quote.operation==='register' && !/^[a-f0-9]{64}$/.test(salt)) throw Error('Missing registration commitment secret.');
  const msg=btoa(String.fromCharCode(...encoder.encode(JSON.stringify(hook))));
  return {contract:config.token,msg:{send:{contract:deployment.registry,amount:offer.quote.amount,msg}}};
}
