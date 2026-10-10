import { REVIEW_MAINNET_RELEASE } from './juno-review-mainnet-config.mjs';
import { namesNetwork } from './names/networks.mjs';
export const UNI7_REVIEW_CONTRACT =
  'juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw';
export function reviewNetwork(chainId = 'juno-1') {
  if (!['juno-1', 'uni-7'].includes(chainId)) throw Error('Unsupported review network.');
  if (chainId === 'juno-1' && !REVIEW_MAINNET_RELEASE)
    throw Error('Mainnet review deployment is not configured.');
  return Object.freeze({
    chainId,
    ...namesNetwork(chainId),
    contract: chainId === 'juno-1' ? REVIEW_MAINNET_RELEASE.contract : UNI7_REVIEW_CONTRACT,
    coin: chainId === 'juno-1' ? 'JUNO' : 'JUNOX',
    minimumNeta: chainId === 'juno-1' ? 0 : 1
  });
}
export function selectedReviewNetwork(params, native = true) {
  if (!native) return reviewNetwork('uni-7');
  const explicit = params.get('reviewChain');
  // Unqualified links were issued by UNI-7. They must never open a different mainnet review with the same numeric ID.
  const profile = reviewNetwork(explicit || (params.has('review') ? 'uni-7' : 'juno-1'));
  if (params.has('reviewContract') && params.get('reviewContract') !== profile.contract)
    throw Error('Shared review contract does not match the selected network.');
  return profile;
}
