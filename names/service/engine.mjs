import {createHash} from 'node:crypto';
import {normalizeName, validateJunoAddress} from '../../names-profile-core.mjs';
import {issueQuote, marketPrice} from '../quote-policy.mjs';
import {MainnetReader, readUsd, validateDeployment} from './chain.mjs';
import {POLICY, POOL, USD_SOURCE} from './constants.mjs';
import {addObservation, averagedPool, uint} from './market.mjs';

export function settings(input = {}, key) {
  const allowed = ['signing_enabled', 'deployment', 'baseline'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) throw Error('Unknown quote service configuration.');
  if (input.signing_enabled !== undefined && typeof input.signing_enabled !== 'boolean') throw Error('Invalid signing flag.');
  const config = {signing_enabled: input.signing_enabled === true, deployment: input.deployment || null, baseline: input.baseline || null};
  if (config.deployment) validateDeployment(config.deployment, key);
  if (config.baseline) {
    uint(config.baseline.usd_per_neta_12, true);
    if (!Number.isSafeInteger(config.baseline.observed_at) || config.baseline.observed_at < 1) throw Error('Invalid initial baseline timestamp.');
  }
  if (config.signing_enabled && (!config.deployment || !config.baseline)) throw Error('Signed quotes need a reviewed deployment and initial baseline.');
  return config;
}

export class QuoteEngine {
  constructor({store, config = {}, reader = new MainnetReader(), usdReader = readUsd, now = () => Math.floor(Date.now() / 1000)}) {
    this.store = store; this.now = now; this.reader = reader; this.usdReader = usdReader;
    this.config = settings(config, store.publicKey);
    // A deliberately changed baseline/policy starts a new observation window;
    // ordinary restarts preserve it. Wallet or deployment changes don't erase data.
    this.stateKey = 'market:' + createHash('sha256').update(JSON.stringify({policy: POLICY, baseline: this.config.baseline})).digest('hex');
    this.state = store.get(this.stateKey) || {samples: [], prices: []};
    this.market = null; this.error = 'Waiting for verified market observations.'; this.polling = false;
  }
  reference(now) {
    return this.state.prices.findLast(p => p.observed_at <= now - 3600) || this.state.prices[0] || this.config.baseline;
  }
  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const [sample, usd] = await Promise.all([this.reader.pool(), this.usdReader()]);
      const now = this.now();
      this.state.samples = addObservation(this.state.samples, sample, POLICY);
      this.store.set(this.stateKey, this.state);
      const pool = averagedPool(this.state.samples, POLICY, now);
      // Indicative price is public even in observe mode; issuance still needs baseline.
      if (now - usd.observed_at > POLICY.max_usd_age || usd.observed_at > now) throw Error('USD reference stale or future-dated.');
      this.indicative = {usd_per_neta_12: (BigInt(pool.twap_price_6) * uint(usd.usd_per_juno_12, true) / 1000000n).toString(), observed_at: pool.observed_at, usd_observed_at: usd.observed_at};
      this.market = {pool, usd, previous: this.reference(now)};
      const price = marketPrice({...this.market, policy: POLICY, now});
      if (!this.state.prices.length || now > this.state.prices.at(-1).observed_at) this.state.prices.push({observed_at: now, usd_per_neta_12: price});
      this.state.prices = this.state.prices.filter(p => now - p.observed_at <= 7200).slice(-250);
      this.store.set(this.stateKey, this.state); this.store.prune(now);
      this.error = null;
    } catch (e) {this.market = null; this.error = e.message;}
    finally {this.polling = false;}
  }
  status() {
    const now = this.now(); let marketReady = false, reason = this.error;
    if (this.market) {
      try {marketPrice({...this.market, policy: POLICY, now}); marketReady = true;} catch (e) {reason = e.message;}
    }
    return {service: 'nns-wynd-quotes-v1', mode: this.config.signing_enabled ? 'signing' : 'observe',
      // Never claim registry readiness from cached market data. /quote rechecks it.
      market_ready: marketReady, signing_enabled: this.config.signing_enabled,
      quote_public_key: this.store.publicKey, registry: this.config.deployment?.registry || null,
      pool: POOL, usd_source: USD_SOURCE, policy: POLICY, reason,
      latest_pool: this.state.samples.at(-1) || null, indicative: this.indicative || null,
      quote_ttl_seconds: 300, limits: {attempts_per_minute: 20, attempts_per_day: 1000}};
  }
  async quote(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'name,operation,payer,years') throw Error('Supply only operation, payer, name and years.');
    if (!['register', 'renew'].includes(input.operation) || !Number.isSafeInteger(input.years) || input.years < 1 || input.years > 5) throw Error('Invalid quote operation or term.');
    validateJunoAddress(input.payer);
    const request = {...input, name: normalizeName(input.name)};
    if (!this.config.signing_enabled || !this.status().market_ready) throw Error('Signed price offers are not ready.');
    if (!this.store.take(this.now())) throw Error('Quote attempt limit reached.');
    const {value: {config, identity}} = await this.reader.registry(this.config.deployment, this.store.publicKey, request);
    // Recheck freshness AFTER network reads. Never reuse a captured old market.
    const now = this.now(), market = this.market;
    if (!market || this.error) throw Error('Market observations unavailable.');
    let preimage;
    const offer = await issueQuote({deployment: this.config.deployment, config, request, identity, market, policy: POLICY, now,
      sign: bytes => {preimage = bytes; return 'pending';}});
    offer.signature = this.store.issue(preimage, offer.quote, now);
    return offer;
  }
}
