// Public profile data and the ADR-36 protocol used by neta-validator-profiles.
// No live registry address is inferred from a wallet, URL or browser storage.
export const PROFILE_DEPLOYMENT = null;
const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const encoder = new TextEncoder();
export const CONTACT_FIELDS = ['description', 'discord', 'telegram', 'twitter', 'email', 'website'];

function polymod(values) {
  let sum = 1;
  for (const value of values) {
    const top = sum >>> 25;
    sum = ((sum & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) sum ^= generators[i];
  }
  return sum >>> 0;
}
function expand(prefix) {
  return [...prefix].map(c => c.charCodeAt(0) >>> 5).concat(0, [...prefix].map(c => c.charCodeAt(0) & 31));
}
function encodeAddress(prefix, words) {
  const checksum = polymod([...expand(prefix), ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  return prefix + '1' + [...words, ...Array.from({length: 6}, (_, i) => (checksum >>> (5 * (5 - i))) & 31)].map(w => alphabet[w]).join('');
}
function decodeAddress(address, prefix, length) {
  if (typeof address !== 'string' || address !== address.toLowerCase() || address.length > 90) throw Error('Use a lowercase Bech32 address.');
  const split = address.lastIndexOf('1');
  const words = [...address.slice(split + 1)].map(c => alphabet.indexOf(c));
  if (address.slice(0, split) !== prefix || words.length !== length + 6 || words.some(w => w < 0) || polymod([...expand(prefix), ...words]) !== 1) throw Error(`Invalid ${prefix} address or checksum.`);
  return words.slice(0, -6);
}
export function operatorAccount(address) {
  return encodeAddress('juno', decodeAddress(address, 'junovaloper', 32));
}
export function normalizeName(value) {
  if (typeof value !== 'string') throw Error('Enter a .neta name.');
  const label = value.trim().toLowerCase().replace(/\.neta$/, '');
  if (!/^(?=.{3,32}$)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label) || ['dao', 'admin', 'neta', 'relay', 'support', 'treasury', 'governance'].includes(label)) throw Error('Use 3–32 letters, numbers or interior hyphens. System names are reserved.');
  return label + '.neta';
}
export function normalizeContacts(input) {
  const contacts = {};
  const limits = {description: 500, discord: 64, telegram: 32, twitter: 15, email: 254, website: 512};
  for (const field of CONTACT_FIELDS) {
    if (input[field] !== undefined && typeof input[field] !== 'string') throw Error(`Invalid ${field}.`);
    const raw = (input[field] || '').trim();
    const value = ['telegram', 'twitter'].includes(field) ? raw.replace(/^@/, '') : raw;
    if (encoder.encode(value).length > limits[field] || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw Error(`${field}: too long or contains control characters.`);
    contacts[field] = value;
  }
  for (const field of ['telegram', 'twitter']) {
    contacts[field] = contacts[field].replace(/^@/, '');
    if (!/^[a-zA-Z0-9_]*$/.test(contacts[field])) throw Error(`${field}: enter a username, not a link.`);
  }
  if (!/^[a-zA-Z0-9._#]*$/.test(contacts.discord)) throw Error('Discord: enter your username.');
  if (contacts.email && (!/^[^@\s<>"'\\?&#]+@[^@\s<>"'\\?&#]+\.[^@\s<>"'\\?&#]+$/.test(contacts.email) || /[^\x20-\x7e]/.test(contacts.email))) throw Error('Enter a valid public email address.');
  if (contacts.website) {
    if (!contacts.website.startsWith('https://') || /[^\x21-\x7e]|[<>"'\\]/.test(contacts.website)) throw Error('Website: use a public HTTPS URL.');
    const url = new URL(contacts.website);
    if (url.username || url.password || !url.hostname.includes('.') || url.protocol !== 'https:') throw Error('Website: use HTTPS without embedded credentials.');
  }
  return contacts;
}
export function contactLinks(contacts) {
  const c = normalizeContacts(contacts);
  return [
    {label: 'Discord', text: c.discord, href: null},
    {label: 'Telegram', text: c.telegram, href: c.telegram ? `https://t.me/${c.telegram}` : null},
    {label: 'X / Twitter', text: c.twitter, href: c.twitter ? `https://x.com/${c.twitter}` : null},
    {label: 'Email', text: c.email, href: c.email ? `mailto:${encodeURIComponent(c.email)}` : null},
    {label: 'Homepage', text: c.website, href: c.website || null},
  ].filter(item => item.text);
}
export function validatePair(pair) {
  if (pair?.mainnet?.chain_id !== 'juno-1' || pair?.testnet?.chain_id !== 'uni-7') throw Error('This adapter supports Juno mainnet and UNI-7.');
  operatorAccount(pair.mainnet.address);
  operatorAccount(pair.testnet.address);
  return pair;
}
function safeInteger(value, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) throw Error('Invalid registry counter or timestamp.');
  return value;
}
export function proofChallenge({deployment, profile, pair, expiresAt, now, revoke = false}) {
  validatePair(pair);
  if (!['uni-7', 'juno-1'].includes(deployment?.chain_id)) throw Error('Unsupported registry chain.');
  for (const address of [deployment.contract, deployment.registry, profile.identity.owner]) {
    // Contracts are 32-byte addresses, wallets 20-byte addresses.
    try { decodeAddress(address, 'juno', 32); } catch { const words = decodeAddress(address, 'juno', 52); if (words[51] & 15) throw Error('Invalid contract address padding.'); }
  }
  const i = profile.identity;
  if (normalizeName(i.name) !== i.name) throw Error('Noncanonical name.');
  [now, expiresAt, i.expires_at, i.generation, i.ownership_revision].forEach(v => safeInteger(v, true));
  safeInteger(profile.revision);
  if (expiresAt <= now || expiresAt > now + 600 || expiresAt > i.expires_at) throw Error('Proof must expire within ten minutes and before name expiry.');
  return [
    'NETA validator profile v1', `Purpose: ${revoke ? 'revoke-validator-link' : 'link-validators'}`,
    `Registry chain: ${deployment.chain_id}`, `Profile contract: ${deployment.contract}`, `Name registry: ${deployment.registry}`,
    `Name: ${i.name}`, `Owner: ${i.owner}`, `Generation: ${i.generation}`, `Ownership revision: ${i.ownership_revision}`,
    `Profile revision: ${profile.revision}`, `Mainnet chain: ${pair.mainnet.chain_id}`, `Mainnet operator: ${pair.mainnet.address}`,
    `Testnet chain: ${pair.testnet.chain_id}`, `Testnet operator: ${pair.testnet.address}`, `Expires at (Unix seconds): ${expiresAt}`,
  ].join('\n');
}

// Collects gas-free proofs only. It never broadcasts or marks a profile verified.
// The contract verifies both signatures; the caller must reload profile state
// and show the final transaction before submitting the returned execute payload.
export async function collectOperatorProofs({keplr, deployment, profile, pair, expiresAt, now = () => Math.floor(Date.now() / 1000), beforeOperator = async () => {}}) {
  if (!keplr?.signArbitrary || !keplr?.getKey) throw Error('Keplr ownership signing is unavailable.');
  const snapshot = structuredClone({deployment, profile, pair, expiresAt});
  const text = proofChallenge({...snapshot, now: now()});
  const proofs = [];
  for (const role of ['mainnet', 'testnet']) {
    const op = snapshot.pair[role], signer = operatorAccount(op.address);
    await beforeOperator({role, chainId: op.chain_id, signer, text});
    await keplr.enable(op.chain_id);
    if ((await keplr.getKey(op.chain_id)).bech32Address !== signer) throw Error(`Select the ${role} operator wallet ${signer}.`);
    proofChallenge({...snapshot, now: now()});
    const signed = await keplr.signArbitrary(op.chain_id, signer, text);
    if ((await keplr.getKey(op.chain_id)).bech32Address !== signer) throw Error('Wallet changed while signing; review again.');
    if (signed?.pub_key?.type !== 'tendermint/PubKeySecp256k1' || typeof signed.signature !== 'string' || typeof signed.pub_key.value !== 'string') throw Error('Unsupported operator signature.');
    proofs.push({public_key: signed.pub_key.value, signature: signed.signature});
  }
  proofChallenge({...snapshot, now: now()});
  return {link_validators: {name: snapshot.profile.identity.name, expected_revision: snapshot.profile.revision,
    pair: snapshot.pair, expires_at: expiresAt, mainnet_proof: proofs[0], testnet_proof: proofs[1]}};
}

// Input must come from the pinned profile contract and chain readers, never an
// editable profile preview. Unknown data are NOT zero points or inactivity.
export function testnetBonusEligibility({profileResponse, mainnet, testnet, now}) {
  safeInteger(now, true);
  if (!profileResponse || typeof profileResponse.active !== 'boolean') return {status: 'unknown', reason: 'Name data unavailable'};
  const p = profileResponse.profile;
  if (!profileResponse.active) return {status: 'ineligible', reason: 'An active .neta name is required for testnet bonus points'};
  if (!p?.identity || !Number.isSafeInteger(p.identity.expires_at)) return {status: 'unknown', reason: 'Invalid name identity'};
  if (p.identity.expires_at <= now) return {status: 'ineligible', reason: 'An active .neta name is required for testnet bonus points'};
  if (!p.validators) return {status: 'ineligible', reason: 'No verified validator link'};
  try { validatePair(p.validators); safeInteger(p.identity.expires_at, true); } catch { return {status: 'unknown', reason: 'Invalid profile data'}; }
  for (const [observation, op] of [[mainnet, p.validators.mainnet], [testnet, p.validators.testnet]]) {
    if (!observation || observation.chain_id !== op.chain_id || !Number.isSafeInteger(observation.height) || observation.height <= 0
      || observation.validator?.operator_address !== op.address) return {status: 'unknown', reason: 'Validator data unavailable or mismatched'};
  }
  // Mainnet active-set membership is deliberately not a requirement.
  const v = testnet.validator;
  if (!['BOND_STATUS_BONDED', 'BOND_STATUS_UNBONDING', 'BOND_STATUS_UNBONDED'].includes(v.status) || typeof v.jailed !== 'boolean') return {status: 'unknown', reason: 'Testnet status unavailable'};
  if (v.jailed || v.status !== 'BOND_STATUS_BONDED') return {status: 'ineligible', reason: 'Testnet validator is not active'};
  if (!Array.isArray(testnet.consensus_pubkeys) || !v.consensus_pubkey?.key) return {status: 'unknown', reason: 'Consensus set unavailable'};
  if (!testnet.consensus_pubkeys.includes(v.consensus_pubkey.key)) return {status: 'ineligible', reason: 'Testnet validator is not in the consensus set'};
  return {status: 'eligible', reason: 'Verified link and active testnet validator', testnet_height: testnet.height};
}
