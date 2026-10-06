import {normalizeName} from './names-profile-core.mjs';
export const NAME_GRACE = 30 * 86400;
export const INTENT_PHASES = ['prepared','commit_pending','committed','payment_pending','complete','write_pending'];
// Read-only presentation of the existing journal. The transaction client remains
// responsible for cryptographic validation, locking, recovery and every write.
export function readNamesIntent(storage, deployment, owner) {
  if (!deployment || !owner) return null;
  const raw = storage.getItem(`neta-nns-v2-intent:${deployment.chain_id}:${deployment.registry}:${owner}`);
  if (raw === null) return null;
  let value;
  try { value = JSON.parse(raw); } catch { throw Error('Saved transaction could not be read. Keep this browser’s site data for recovery.'); }
  if (value?.schema !== 1 || value.owner !== owner || value.chain_id !== deployment.chain_id ||
      value.registry !== deployment.registry || !INTENT_PHASES.includes(value.phase) || typeof value.name !== 'string') {
    throw Error('Saved transaction has an unknown format. Keep this browser’s site data for recovery.');
  }
  return value;
}
export function nameState(record, owner, now = Date.now()/1000) {
  if (!record || record.owner !== owner) return null;
  if (normalizeName(record.name) !== record.name || !Number.isSafeInteger(record.expires_at) ||
      !Number.isSafeInteger(record.generation) || record.generation < 1 ||
      !Number.isSafeInteger(record.ownership_revision) || record.ownership_revision < 1) throw Error('Name identity is incomplete. Retry the lookup.');
  return now < record.expires_at ? 'active' : now < record.expires_at + NAME_GRACE ? 'grace' : 'released';
}
export function intentLabel(intent) {
  return ({prepared:'Ready to start registration',commit_pending:'Registration confirmation needs checking',
    committed:'Registration started — payment still needed',payment_pending:'Payment outcome needs checking',
    write_pending:'Transaction outcome needs checking',complete:'Completed'})[intent?.phase] || '';
}
