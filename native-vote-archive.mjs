// Archived ballots are public observations, independent of wallet/signing state.
import { ballot } from './native-voting-core.mjs';
import { validateJunoAddress } from './names-profile-core.mjs';
import { nativeTally } from './native-governance-display.mjs';

export const voteArchiveDirectory = '/data/governance/juno-votes/';
const statuses = {
  proposal_passed: 'PROPOSAL_STATUS_PASSED',
  proposal_rejected: 'PROPOSAL_STATUS_REJECTED',
  proposal_failed: 'PROPOSAL_STATUS_FAILED'
};
function block(value) {
  return (
    value &&
    Number.isSafeInteger(value.height) &&
    value.height > 0 &&
    /^[0-9a-f]{64}$/.test(value.hash) &&
    Number.isFinite(Date.parse(value.time))
  );
}

export function archivedParticipation(record, proposal) {
  if (
    record?.schema !== 1 ||
    record.chainId !== 'juno-1' ||
    record.proposalId !== String(proposal.id) ||
    !block(record.through) ||
    (record.start !== null &&
      (!block(record.start) || record.start.height > record.through.height)) ||
    !Array.isArray(record.votes) ||
    (record.outcome !== null &&
      statuses[record.outcome] !== proposal.status &&
      !['cancel_proposal', 'inactive_proposal'].includes(record.outcome))
  )
    throw Error('Archive identity or voting period mismatch.');
  const seen = new Set();
  const direct = record.votes.map((v) => {
    const address = validateJunoAddress(v.voter);
    if (seen.has(address)) throw Error('Duplicate archived voting address.');
    seen.add(address);
    return { address, ballot: ballot(v) };
  });
  const result = {
    archived: true,
    complete: Boolean(record.start),
    final: Boolean(record.outcome),
    height: record.through.height,
    blockTime: record.through.time,
    direct,
    validators: [],
    own: null
  };
  const prev = record.previousPower;
  if (
    prev &&
    block({ height: prev.height, hash: prev.blockHash, time: prev.blockTime }) &&
    prev.height < result.height &&
    Array.isArray(prev.direct) &&
    Array.isArray(prev.validators) &&
    prev.metrics
  )
    result.previousPower = { ...prev, archived: true, previous: true };
  const p = record.power;
  if (
    !p ||
    p.blockHash !== record.through.hash ||
    String(p.height) !== String(record.through.height) ||
    !Array.isArray(p.direct) ||
    !Array.isArray(p.validators) ||
    !p.metrics ||
    !p.direct.every(
      (v, i) =>
        v.address === direct[i]?.address &&
        JSON.stringify(v.ballot) === JSON.stringify(direct[i].ballot)
    ) ||
    p.direct.length !== direct.length
  )
    return result;
  if (record.outcome && statuses[record.outcome]) {
    const tally = nativeTally(proposal.final_tally_result);
    if (Object.entries(tally).some(([k, v]) => p.tally?.[k] !== v)) return result;
  }
  return {
    ...result,
    direct: p.direct,
    validators: p.validators,
    metrics: p.metrics,
    directWeight: p.directWeight,
    inheritedWeight: p.inheritedWeight
  };
}

export async function loadArchivedParticipation(proposal, fetcher = fetch) {
  if (!/^[1-9]\d{0,19}$/.test(String(proposal.id))) throw Error('Invalid proposal ID.');
  const response = await fetcher(voteArchiveDirectory + proposal.id + '.json', {
    credentials: 'omit',
    signal: AbortSignal.timeout(8000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw Error('Vote archive is currently unavailable.');
  return archivedParticipation(await response.json(), proposal);
}
