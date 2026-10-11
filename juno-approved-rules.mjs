import { reader, quorum } from './juno-community-governance.mjs?v=2';
import { GOVERNANCE_SOURCES } from './governance-chain-read.mjs';
import { PROGRAMME, policy, canonical, fingerprint } from './juno-delegation-core.mjs';

const title = 'Juno Delegation Programme — allocation rules';
const sources = [GOVERNANCE_SOURCES['juno-polkachu'], GOVERNANCE_SOURCES['juno-stavr']];
const positive = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value);

// This discovers display data only. It is not an execution approval or authority proof.
export async function approvedRule(proposal, now = Date.now()) {
  const body = proposal?.summary;
  if (
    proposal?.status !== 'PROPOSAL_STATUS_PASSED' ||
    !proposal.title?.startsWith(title) ||
    typeof body !== 'string' ||
    !body.split('\n').includes(`Programme: ${PROGRAMME}`)
  )
    return null;
  const ended = Date.parse(proposal.voting_end_time);
  if (
    !positive(proposal.id) ||
    !Number.isFinite(ended) ||
    ended > now ||
    !body.split('\n').includes('Chain: juno-1') ||
    !Array.isArray(proposal.messages) ||
    proposal.messages.length ||
    proposal.failed_reason
  )
    throw Error(`Proposal #${proposal.id}: invalid rule approval content.`);
  const sections = [...body.matchAll(/^## Exact policy\n\n```json\n([\s\S]*?)\n```/gm)];
  const hashes = [...body.matchAll(/^Rule SHA-256: ([a-f0-9]{64})$/gm)];
  if (sections.length !== 1 || hashes.length !== 1)
    throw Error(`Proposal #${proposal.id}: exact policy or fingerprint unavailable.`);
  let raw, rule;
  try {
    raw = JSON.parse(sections[0][1]);
    rule = policy(raw);
    if (canonical(raw) !== canonical(rule)) throw Error('Unsupported fields');
  } catch {
    throw Error(
      `Proposal #${proposal.id}: this approved rule version is not supported by the planner.`
    );
  }
  const hash = await fingerprint(rule);
  if (hash !== hashes[0][1]) throw Error(`Proposal #${proposal.id}: rule fingerprint mismatch.`);
  return { proposalId: proposal.id, votingEndedAt: proposal.voting_end_time, rule, hash };
}

export async function currentApprovedRules({ endpoints = sources, ...options } = {}) {
  const now = options.now ?? Date.now();
  const good = await quorum(
    endpoints,
    async (endpoint) => {
      const source = await reader(endpoint, 'juno-1', { ...options, now });
      const proposals = [],
        ids = new Set(),
        keys = new Set();
      let key = '',
        complete = false;
      // Forward pagination: reverse pagination is unsupported by some Juno node versions.
      for (let page = 0; page < 100; page++) {
        const path =
          '/cosmos/gov/v1/proposals?pagination.limit=100' +
          (key ? '&pagination.key=' + encodeURIComponent(key) : '');
        const result = await source.get(path);
        if (
          !Array.isArray(result.proposals) ||
          !result.pagination ||
          !Object.hasOwn(result.pagination, 'next_key')
        )
          throw Error('Incomplete proposal history.');
        for (const proposal of result.proposals) {
          if (!positive(proposal.id) || ids.has(proposal.id))
            throw Error('Invalid or repeated proposal ID.');
          ids.add(proposal.id);
          if (
            proposal.status === 'PROPOSAL_STATUS_PASSED' &&
            proposal.title?.startsWith(title) &&
            typeof proposal.summary === 'string' &&
            proposal.summary.split('\n').includes(`Programme: ${PROGRAMME}`)
          ) {
            if (!Number.isFinite(Date.parse(proposal.voting_end_time)))
              throw Error('Rule approval date unavailable.');
            proposals.push(proposal);
          }
        }
        const next = result.pagination.next_key;
        if (next === null || next === '') {
          complete = true;
          break;
        }
        if (typeof next !== 'string' || next.length > 1024 || keys.has(next))
          throw Error('Incomplete proposal pagination.');
        keys.add(next);
        key = next;
      }
      if (!complete) throw Error('Proposal history limit reached.');
      proposals.sort(
        (a, b) =>
          Date.parse(b.voting_end_time) - Date.parse(a.voting_end_time) ||
          (BigInt(a.id) > BigInt(b.id) ? -1 : 1)
      );
      const current = proposals.length ? await approvedRule(proposals[0], now) : null;
      return {
        current,
        history: proposals.map((p) => ({
          id: p.id,
          summary: p.summary,
          messages: p.messages,
          voting_end_time: p.voting_end_time
        })),
        source: { endpoint, height: source.height },
        checkedAt: now
      };
    },
    (value) => ({ current: value.current, history: value.history }),
    'Approved rules'
  );
  return { current: good[0].current, sources: good.map((v) => v.source), checkedAt: now };
}
