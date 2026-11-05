/** The general programme entry opens the available Juno editor directly. */
export function delegationEntry(location) {
  const url = new URL('/community-tools/juno/delegation/', location.href);
  url.search = location.search;
  url.hash = location.hash || '#rules';
  return url.href;
}
if (typeof window !== 'undefined') window.location.replace(delegationEntry(window.location));
