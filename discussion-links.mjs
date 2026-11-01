// Public identities, not a user-selected RPC or contract execution target.
export function discussionSource({ kind, chainId, contract, id }) {
  if (
    !['native', 'review', 'dao'].includes(kind) ||
    !['juno-1', 'uni-7'].includes(chainId) ||
    !/^[1-9]\d{0,15}$/.test(String(id)) ||
    !Number.isSafeInteger(Number(id)) ||
    (kind === 'native'
      ? contract !== 'gov' || chainId !== 'juno-1'
      : !/^juno1[023456789acdefghjklmnpqrstuvwxyz]{38,58}$/.test(contract || ''))
  )
    throw Error('Invalid discussion source.');
  return [kind, chainId, contract, String(id)].join(':');
}
export function parseDiscussionSource(key) {
  if (typeof key !== 'string' || key.length > 120) throw Error('Invalid discussion source.');
  const [kind, chainId, contract, id, extra] = key.split(':');
  if (extra !== undefined || discussionSource({ kind, chainId, contract, id }) !== key)
    throw Error('Invalid discussion source.');
  return { kind, chainId, contract, id };
}
export function discussionUrl(source) {
  parseDiscussionSource(source);
  return '/discussions.html?source=' + encodeURIComponent(source);
}
export const DISCUSSION_API = 'https://api.cosmoot.com/discussions';
