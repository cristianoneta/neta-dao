import {personalMainnetProfile} from './relay-personal-network.mjs';

// A reviewed source change must pin the real contract and approved backup origin.
// URL parameters, local storage and page globals cannot activate messaging.
export const PERSONAL_MAINNET_RELEASE = null;

export function verifiedPersonalRelease(release = PERSONAL_MAINNET_RELEASE) {
  if (!release || release.enabled !== true) return null;
  personalMainnetProfile(release.deployment);
  const url = new URL(release.backupUrl);
  if (url.protocol !== 'https:' || url.origin !== release.backupUrl || url.username || url.password)
    throw Error('A pinned HTTPS backup origin is required');
  return Object.freeze({deployment: Object.freeze({...release.deployment}), backupUrl: url.origin});
}
