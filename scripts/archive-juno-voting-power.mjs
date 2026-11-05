// Optional enrichment. Explicit ballots are already durable if a staking provider is pruned.
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { participationAtBlock } from '../native-voting-core.mjs';
import { archivedParticipation, voteArchiveDirectory } from '../native-vote-archive.mjs';
import { nativeTally } from '../native-governance-display.mjs';
import { GOVERNANCE_SOURCES } from '../governance-chain-read.mjs';

export async function archivedPower(record, endpoint, fetcher = fetch) {
  const { height, hash, time } = record.through;
  const get = async (path) => {
    const res = await fetcher(endpoint + path, {
      headers: { 'x-cosmos-block-height': String(height) },
      redirect: 'error',
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok || res.headers.get('x-cosmos-block-height') !== String(height))
      throw Error('Pinned staking state unavailable.');
    return res.json();
  };
  const block = await get('/cosmos/base/tendermint/v1beta1/blocks/' + height);
  const header = (block.block || block.sdk_block)?.header;
  if (
    header?.chain_id !== 'juno-1' ||
    header.height !== String(height) ||
    header.time !== time ||
    Buffer.from(block.block_id?.hash || '', 'base64').toString('hex') !== hash
  )
    throw Error('Different block for archived voting power.');
  const path = '/cosmos/gov/v1/proposals/' + record.proposalId;
  const { proposal } = await get(path);
  if (!record.outcome && proposal.status !== 'PROPOSAL_STATUS_VOTING_PERIOD')
    throw Error('Archive and source voting phase differ.');
  archivedParticipation(record, proposal);
  const tally = nativeTally(
    record.outcome ? proposal.final_tally_result : (await get(path + '/tally')).tally
  );
  const { direct, validators, metrics, directWeight, inheritedWeight } = await participationAtBlock(
    { get, height, endpoint },
    proposal,
    record.votes,
    tally
  );
  return {
    height,
    blockHash: hash,
    blockTime: time,
    tally,
    direct,
    validators,
    metrics,
    directWeight,
    inheritedWeight
  };
}

async function main() {
  const dir = resolve('.' + voteArchiveDirectory);
  const names = (
    await readdir(dir).catch((e) => {
      if (e.code === 'ENOENT') return [];
      throw e;
    })
  ).filter((n) => /^[1-9]\d{0,19}\.json$/.test(n));
  // Prioritize newly closed proposals while their staking block is still available.
  const candidates = [];
  for (const name of names) {
    const path = resolve(dir, name);
    const record = JSON.parse(await readFile(path, 'utf8'));
    if (
      record.start &&
      !record.power &&
      (!record.outcome || Date.now() - Date.parse(record.through.time) < 7 * 86400000) &&
      !['cancel_proposal', 'inactive_proposal'].includes(record.outcome)
    )
      candidates.push({ path, record });
  }
  candidates.sort(
    (a, b) =>
      Number(!!b.record.outcome) - Number(!!a.record.outcome) ||
      b.record.through.height - a.record.through.height
  );
  for (const { path, record } of candidates) {
    for (const endpoint of [
      GOVERNANCE_SOURCES['juno-stavr'],
      GOVERNANCE_SOURCES['juno-polkachu']
    ]) {
      try {
        record.power = await archivedPower(record, endpoint);
        break;
      } catch (e) {
        console.warn(
          'Voting power unavailable for proposal ' + record.proposalId + ': ' + e.message
        );
      }
    }
    if (!record.power) continue;
    const temp = path + '.tmp';
    await writeFile(temp, JSON.stringify(record) + '\n', { mode: 0o644 });
    await rename(temp, path);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
