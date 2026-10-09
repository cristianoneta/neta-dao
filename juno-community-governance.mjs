import { claimValidators, depositTerms, proposalContent } from './juno-governance-core.mjs';

export const REVIEW_CONTRACT = 'juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw';
export const DEPOSIT = '/cosmos.gov.v1.MsgDeposit';
export const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]])
        )
      : item
  );
const positive = (value) => /^[1-9]\d*$/.test(String(value));
const endpointsOf = (endpoints) => [
  ...new Map(endpoints.map((e) => [new URL(e).origin, e.replace(/\/$/, '')])).values()
];
export function reviewKind(values) {
  const messages = JSON.parse(values.actions_json);
  if (messages.length) {
    claimValidators(messages);
    return 'CLAIM_REWARDS';
  }
  if (values.title.startsWith('Juno Delegation Programme — allocation rules'))
    return 'RULE_APPROVAL';
  throw Error('This review does not contain a supported programme proposal.');
}
export function reviewValues(revision) {
  return Object.fromEntries(
    ['title', 'summary', 'body', 'actions_json'].map((key) => {
      if (typeof revision?.[key] !== 'string') throw Error('Incomplete review content.');
      return [key, revision[key]];
    })
  );
}
export async function finalizedReview(proposal, revision) {
  if (
    !positive(proposal?.id) ||
    proposal.withdrawn ||
    !positive(proposal.finalized_version) ||
    proposal.latest_version !== proposal.finalized_version ||
    revision?.version !== proposal.finalized_version ||
    revision.proposal_id !== proposal.id ||
    !/^[a-f0-9]{64}$/.test(proposal.finalized_hash || '')
  )
    throw Error('Finalize the latest community review before mainnet submission.');
  const values = reviewValues(revision);
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(values)))
  );
  const hash = [...bytes].map((v) => v.toString(16).padStart(2, '0')).join('');
  if (hash !== proposal.finalized_hash)
    throw Error('Finalized review content does not match its on-chain hash.');
  const kind = reviewKind(values),
    content = proposalContent(kind, values);
  const metadata = `cosmoot:review:uni-7:${REVIEW_CONTRACT}:${proposal.id}:${hash}`;
  return {
    id: `review-${proposal.id}-${hash}`,
    reviewId: String(proposal.id),
    hash,
    kind,
    values,
    author: proposal.author,
    content: { ...content, metadata }
  };
}

async function reader(endpoint, chain, { fetcher = fetch, now = Date.now() } = {}) {
  let height;
  const get = async (path) => {
    const response = await fetcher(endpoint + path, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
      headers: height ? { 'x-cosmos-block-height': height } : {}
    });
    if (!response.ok) throw Error('Chain data is unavailable.');
    const returned = response.headers.get('x-cosmos-block-height');
    if (height && returned && returned !== height) throw Error('Chain query height mismatch.');
    return response.json();
  };
  const data = await get('/cosmos/base/tendermint/v1beta1/blocks/latest');
  const header = data.block?.header || data.sdk_block?.header,
    age = now - Date.parse(header?.time);
  if (
    header?.chain_id !== chain ||
    !positive(header?.height) ||
    !Number.isFinite(age) ||
    age < -30000 ||
    age > 120000
  )
    throw Error('Fresh data from the expected chain is required.');
  height = String(header.height);
  return { get, height, endpoint, checkedAt: now };
}
async function quorum(endpoints, read, same) {
  const results = await Promise.allSettled(endpointsOf(endpoints).map(read));
  const good = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (good.length < 2) throw Error('Two independent chain sources must verify this action.');
  if (good.some((v) => canonical(same(v)) !== canonical(same(good[0]))))
    throw Error('Chain sources disagree. Refresh and review again.');
  return good;
}
export async function verifyReview(endpoints, expected, options = {}) {
  const good = await quorum(
    endpoints,
    async (endpoint) => {
      const { get } = await reader(endpoint, 'uni-7', options);
      const query = async (q) =>
        (
          await get(
            `/cosmwasm/wasm/v1/contract/${REVIEW_CONTRACT}/smart/${encodeURIComponent(btoa(JSON.stringify(q)))}`
          )
        ).data;
      const proposal = await query({ proposal: { proposal_id: Number(expected.reviewId) } });
      // Fetch precisely the final revision, even when the review has more than 100 revisions.
      const revisions = await query({
        revisions: {
          proposal_id: Number(expected.reviewId),
          start_after: proposal.finalized_version > 1 ? proposal.finalized_version - 1 : null,
          limit: 1
        }
      });
      return finalizedReview(proposal, revisions?.[0]);
    },
    (v) => v
  );
  if (canonical(good[0]) !== canonical(expected))
    throw Error('The finalized community review changed. Reopen it.');
  return good[0];
}
function decodedMessages(messages) {
  return messages.map((message) => {
    if (message['@type'] !== '/cosmwasm.wasm.v1.MsgExecuteContract') return message;
    const msg =
      typeof message.msg === 'string'
        ? JSON.parse(
            new TextDecoder().decode(Uint8Array.from(atob(message.msg), (c) => c.charCodeAt(0)))
          )
        : message.msg;
    return {
      '@type': message['@type'],
      sender: message.sender,
      contract: message.contract,
      funds: message.funds || [],
      msg
    };
  });
}
export function matchesReview(proposal, content) {
  try {
    return (
      proposal.metadata === content.metadata &&
      proposal.title === content.title &&
      proposal.summary === content.summary &&
      !proposal.expedited &&
      canonical(decodedMessages(proposal.messages)) === canonical(content.messages)
    );
  } catch {
    return false;
  }
}
export async function findReviewSubmission(endpoints, content, options = {}) {
  const results = await quorum(
    endpoints,
    async (endpoint) => {
      const { get } = await reader(endpoint, 'juno-1', options);
      let key = '',
        found = [],
        seen = new Set();
      for (let page = 0; page < 100; page++) {
        const result = await get(
          '/cosmos/gov/v1/proposals?pagination.limit=100&pagination.reverse=true' +
            (key ? '&pagination.key=' + encodeURIComponent(key) : '')
        );
        if (!Array.isArray(result.proposals)) throw Error('Proposal history unavailable.');
        found.push(
          ...result.proposals.filter((p) => matchesReview(p, content)).map((p) => String(p.id))
        );
        key = result.pagination?.next_key || '';
        if (!key) return found.sort();
        if (seen.has(key)) break;
        seen.add(key);
      }
      throw Error('Complete proposal history could not be checked.');
    },
    (v) => v
  );
  return results[0];
}
export function fundingTerms(proposal, params, now = Date.now()) {
  if (proposal?.expedited) throw Error('Expedited proposal funding is not supported in this view.');
  if (!positive(proposal?.id)) throw Error('Invalid proposal ID.');
  const terms = depositTerms(params);
  for (const key of ['burn_vote_veto', 'burn_vote_quorum', 'burn_proposal_deposit_prevote'])
    if (typeof params[key] !== 'boolean') throw Error('Unknown deposit refund and burn rules.');
  const ratio = params.min_deposit_ratio;
  if (!/^(0|1)(\.\d{1,18})?$/.test(ratio || '')) throw Error('Unknown minimum contribution.');
  const [whole, frac = ''] = ratio.split('.'),
    scale = 10n ** BigInt(frac.length),
    factor = BigInt(whole) * scale + BigInt(frac || '0');
  if (factor > scale) throw Error('Invalid minimum contribution.');
  if (
    !Array.isArray(proposal.total_deposit) ||
    proposal.total_deposit.length > 1 ||
    proposal.total_deposit.some((c) => c.denom !== 'ujuno' || !/^\d+$/.test(c.amount))
  )
    throw Error('Unsupported proposal deposit.');
  const total = BigInt(terms.total),
    funded = BigInt(proposal.total_deposit[0]?.amount || '0'),
    remaining = funded >= total ? 0n : total - funded,
    minimum = (total * factor + scale - 1n) / scale || 1n,
    deadline = Date.parse(proposal.deposit_end_time);
  if (!Number.isFinite(deadline)) throw Error('Unknown deposit deadline.');
  return {
    total: total.toString(),
    funded: funded.toString(),
    remaining: remaining.toString(),
    minimum: minimum.toString(),
    deadline,
    status: proposal.status,
    open: proposal.status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD' && deadline > now && remaining > 0n,
    burnVeto: params.burn_vote_veto,
    burnQuorum: params.burn_vote_quorum,
    burnUnfunded: params.burn_proposal_deposit_prevote
  };
}
export function validateContribution(raw, terms) {
  if (!terms.open) throw Error('This proposal is no longer accepting funding in Cosmoot.');
  if (!positive(raw) || BigInt(raw) < BigInt(terms.minimum))
    throw Error('The contribution is below the current chain minimum.');
  // If less than the chain minimum remains, show the unavoidable excess explicitly.
  const cap =
    BigInt(terms.remaining) > BigInt(terms.minimum)
      ? BigInt(terms.remaining)
      : BigInt(terms.minimum);
  if (BigInt(raw) > cap) throw Error('The remaining amount changed. Refresh before contributing.');
  return raw;
}
export function proposalIdentity(p) {
  return {
    id: String(p.id),
    title: p.title,
    summary: p.summary,
    metadata: p.metadata,
    messages: p.messages,
    expedited: p.expedited || false
  };
}
export async function fundingProof(endpoints, id, sender = null, options = {}) {
  if (!positive(id)) throw Error('Invalid proposal ID.');
  const proofs = await quorum(
    endpoints,
    async (endpoint) => {
      const source = await reader(endpoint, 'juno-1', options);
      const [record, parameters, balance] = await Promise.all([
        source.get(`/cosmos/gov/v1/proposals/${id}`),
        source.get('/cosmos/gov/v1/params/deposit'),
        sender
          ? source.get(
              `/cosmos/bank/v1beta1/spendable_balances/${encodeURIComponent(sender)}/by_denom?denom=ujuno`
            )
          : null
      ]);
      if (String(record.proposal?.id) !== String(id)) throw Error('Proposal identity mismatch.');
      const terms = fundingTerms(record.proposal, parameters.params, options.now ?? Date.now());
      if (sender && (balance?.balance?.denom !== 'ujuno' || !/^\d+$/.test(balance.balance.amount)))
        throw Error('Spendable JUNO balance unavailable.');
      return {
        ...source,
        get: undefined,
        proposal: record.proposal,
        terms,
        balance: balance?.balance?.amount || '0',
        params: parameters.params
      };
    },
    (v) => ({ identity: proposalIdentity(v.proposal), terms: v.terms, params: v.params })
  );
  return {
    ...proofs[0],
    balance: proofs.reduce(
      (min, p) => (BigInt(p.balance) < BigInt(min) ? p.balance : min),
      proofs[0].balance
    )
  };
}
