// Browser-safe quote preparation. Only the shared price carries an authority signature;
// the payer authorizes the exact purchase with their ordinary wallet transaction.
import {feeAmount, validatePriceSnapshot, validateQuote, QUOTE_TTL} from '../names-v2-core.mjs';

export async function snapshotOffer({deployment,config,signedPrice,expected,now=Math.floor(Date.now()/1000),cryptoProvider=globalThis.crypto}) {
  if(deployment.pricing_protocol!=='treasury-snapshot-v1') throw Error('A reviewed snapshot-capable deployment is required.');
  const snapshot=await validatePriceSnapshot({deployment,config,snapshot:signedPrice.snapshot,signature:signedPrice.signature,now,cryptoProvider});
  const quote={...expected,tariff_version:config.tariff_version,signer_version:config.signer_version,
    usd_per_neta_12:snapshot.usd_per_neta_12,
    amount:feeAmount(expected.name,expected.years,snapshot.usd_per_neta_12,config.tariff),
    nonce:[...cryptoProvider.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join(''),
    issued_at:now,expires_at:Math.min(now+QUOTE_TTL,snapshot.expires_at)};
  const offer={quote,snapshot,signature:signedPrice.signature};
  await validateQuote({deployment,config,offer,expected,now,cryptoProvider});
  return offer;
}

export async function validatePublishedPrice({deployment,config,signedPrice,now=Math.floor(Date.now()/1000),cryptoProvider=globalThis.crypto}) {
  if(signedPrice?.schema_version!==1 || signedPrice.chain_id!==deployment.chain_id || signedPrice.registry!==deployment.registry || signedPrice.token!==config.token || signedPrice.treasury!==config.treasury) throw Error('Published price deployment mismatch.');
  await validatePriceSnapshot({deployment,config,snapshot:signedPrice.snapshot,signature:signedPrice.signature,now,cryptoProvider});
  return structuredClone(signedPrice);
}

export async function fetchSignedPrice({deployment,config,fetcher=globalThis.fetch,now=Math.floor(Date.now()/1000),cryptoProvider=globalThis.crypto}) {
  // Fixed same-origin public artifact. No user-selected oracle URL or signing API.
  const response=await fetcher(new URL('../data/nns/price.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw Error('Published NETA price unavailable. Try again after the next update.');
  const text=await response.text();
  if(text.length>16000) throw Error('Published NETA price response too large.');
  const signedPrice=JSON.parse(text);
  return validatePublishedPrice({deployment,config,signedPrice,now,cryptoProvider});
}

export async function fetchSnapshotOffer({deployment,config,expected,fetcher=globalThis.fetch,now=Math.floor(Date.now()/1000),cryptoProvider=globalThis.crypto}) {
  const signedPrice=await fetchSignedPrice({deployment,config,fetcher,now,cryptoProvider});
  return snapshotOffer({deployment,config,signedPrice,expected,now,cryptoProvider});
}

export function snapshotReview(offer) {
  if(!offer.snapshot) throw Error('Missing reviewed price snapshot.');
  const amount=BigInt(offer.quote.amount), rate=BigInt(offer.snapshot.usd_per_neta_12);
  return `Exact debit: ${amount/1000000n}.${(amount%1000000n).toString().padStart(6,'0')} NETA\n`+
    `Snapshot price: USD ${rate/1000000000000n}.${(rate%1000000000000n).toString().padStart(12,'0')} per NETA\n`+
    `Price observed: ${new Date(offer.snapshot.observed_at*1000).toISOString()}\n`+
    `Price valid until: ${new Date(offer.snapshot.expires_at*1000).toISOString()}\n`+
    `Payment review expires: ${new Date(offer.quote.expires_at*1000).toISOString()}\n`+
    'Uses a periodically updated price. It may differ from the current market price.';
}
